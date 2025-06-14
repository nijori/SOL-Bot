/**
 * ATRキャリブレーションユーティリティ
 *
 * 通貨ペアのボラティリティ特性に基づいてATR%やその他パラメータを動的に調整する機能
 * ALG-040: ATR%自動キャリブレーション
 */

import { Candle } from '../core/types.js';
import { calculateATR } from './atrUtils.js';
import { parameterService } from '../config/parameterService.js';
import logger from './logger.js';

// パラメータをサービスから取得
const MIN_LOOKBACK_CANDLES = parameterService.get<number>('risk.minLookbackCandles', 30);
const DEFAULT_ATR_PERIOD = parameterService.get<number>('market.atr_period', 14);
const MAX_CALIBRATION_LOOKBACK = parameterService.get<number>('risk.maxCalibrationLookback', 90);

/**
 * キャリブレーション結果
 */
export interface CalibrationResult {
  symbol: string;
  atrPercentage: number;
  atrValue: number;
  recommendedParameters: {
    atrPercentageThreshold: number;
    trailingStopFactor: number;
    gridAtrMultiplier: number;
    stopDistanceMultiplier: number;
  };
  volatilityProfile: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  calculatedFrom: {
    candleCount: number;
    periodDays: number;
    averagePrice: number;
  };
}

/**
 * キャリブレーション結果のキャッシュ
 */
interface CalibrationCache {
  [symbol: string]: {
    result: CalibrationResult;
    timestamp: number;
    expiresAt: number;
  };
}

/**
 * ATR自動キャリブレーションクラス
 * 通貨ペアごとのATR%に基づいてトレーディングパラメータを自動調整
 */
export class ATRCalibrator {
  private static instance: ATRCalibrator;
  private calibrationCache: CalibrationCache = {};
  private cacheTTL: number;

  /**
   * コンストラクタ
   * @param cacheTTLHours キャッシュの有効期間（時間）
   */
  constructor(cacheTTLHours: number = 24) {
    this.cacheTTL = cacheTTLHours * 60 * 60 * 1000; // ミリ秒に変換
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ATRCalibrator {
    if (!ATRCalibrator.instance) {
      ATRCalibrator.instance = new ATRCalibrator();
    }
    return ATRCalibrator.instance;
  }

  /**
   * ロウソク足データからATR%をキャリブレーションし、最適なパラメータを算出
   * @param symbol 通貨ペア
   * @param candles ロウソク足データ
   * @param timeframeHours タイムフレーム（時間）
   * @param useCache キャッシュを使用するかどうか
   * @returns キャリブレーション結果
   */
  public calibrateATR(
    symbol: string,
    candles: Candle[],
    timeframeHours: number = 1,
    useCache: boolean = true
  ): CalibrationResult {
    // キャッシュチェック
    if (useCache && this.hasValidCache(symbol)) {
      logger.debug(`[ATRCalibrator] キャッシュされたキャリブレーション結果を使用: ${symbol}`);
      return this.calibrationCache[symbol].result;
    }

    // データ不足チェック
    if (!candles || candles.length < MIN_LOOKBACK_CANDLES) {
      logger.warn(
        `[ATRCalibrator] キャリブレーションに十分なデータがありません: ${candles?.length || 0} < ${MIN_LOOKBACK_CANDLES} (${symbol})`
      );
      return this.getFallbackCalibration(symbol, candles);
    }

    // 最大ルックバック期間に制限
    const maxLookback = Math.min(candles.length, MAX_CALIBRATION_LOOKBACK);
    const relevantCandles = candles.slice(-maxLookback);

    // ATR計算
    const atrValue = calculateATR(relevantCandles, DEFAULT_ATR_PERIOD, 'ATRCalibrator');

    // 平均価格を計算
    const avgPrice = this.calculateAveragePrice(relevantCandles);

    // ATR%計算 - 平均価格が0またはNaNの場合のチェックを追加
    const atrPercentage = avgPrice > 0 ? (atrValue / avgPrice) * 100 : parameterService.get<number>('risk.defaultAtrPercentage', 0.02) * 100;

    // ボラティリティプロファイル分類
    const volatilityProfile = this.classifyVolatility(atrPercentage);

    // 最適パラメータを計算
    const recommendedParameters = this.calculateOptimalParameters(atrPercentage, volatilityProfile);

    // 期間（日数）を計算
    const periodDays = (maxLookback * timeframeHours) / 24;

    // 結果を作成
    const result: CalibrationResult = {
      symbol,
      atrPercentage,
      atrValue,
      recommendedParameters,
      volatilityProfile,
      calculatedFrom: {
        candleCount: maxLookback,
        periodDays,
        averagePrice: avgPrice
      }
    };

    // キャッシュに保存
    this.cacheResult(symbol, result);

    logger.info(
      `[ATRCalibrator] ${symbol} のATR%キャリブレーション完了: ${atrPercentage.toFixed(2)}% (${volatilityProfile})`
    );
    return result;
  }

  /**
   * ボラティリティプロファイル（低/中/高/極高）を分類
   * @param atrPercentage ATR%
   * @returns ボラティリティプロファイル
   */
  private classifyVolatility(atrPercentage: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    // ボラティリティの閾値をパラメータから取得
    const lowThreshold = parameterService.get<number>('risk.volatilityLowThreshold', 2.0);
    const mediumThreshold = parameterService.get<number>('risk.volatilityMediumThreshold', 5.0);
    const highThreshold = parameterService.get<number>('risk.volatilityHighThreshold', 10.0);

    // NaNチェックを追加
    if (isNaN(atrPercentage)) {
      return 'MEDIUM'; // NaNの場合はMEDIUMを返す
    }

    if (atrPercentage < lowThreshold) {
      return 'LOW';
    } else if (atrPercentage < mediumThreshold) {
      return 'MEDIUM';
    } else if (atrPercentage < highThreshold) {
      return 'HIGH';
    } else {
      return 'EXTREME';
    }
  }

  /**
   * ATR%に基づいて最適なパラメータを計算
   * @param atrPercentage ATR%
   * @param volatilityProfile ボラティリティプロファイル
   * @returns 推奨パラメータ
   */
  private calculateOptimalParameters(
    atrPercentage: number,
    volatilityProfile: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
  ): CalibrationResult['recommendedParameters'] {
    // ボラティリティに応じたパラメータ調整ロジック
    let atrPercentageThreshold: number;
    let trailingStopFactor: number;
    let gridAtrMultiplier: number;
    let stopDistanceMultiplier: number;

    switch (volatilityProfile) {
      case 'LOW':
        // 低ボラティリティ - 反転が起こりやすいので小さい値を使用
        atrPercentageThreshold = Math.min(atrPercentage * 1.2, 3.0);
        trailingStopFactor = 2.0; // より広いトレイリングストップ
        gridAtrMultiplier = 0.8; // より広いグリッド幅
        stopDistanceMultiplier = 1.5; // より広いストップロス
        break;

      case 'MEDIUM':
        // 中ボラティリティ - バランスの取れた値
        atrPercentageThreshold = Math.min(atrPercentage * 1.1, 6.0);
        trailingStopFactor = 1.5;
        gridAtrMultiplier = 0.6;
        stopDistanceMultiplier = 1.2;
        break;

      case 'HIGH':
        // 高ボラティリティ - トレンドが発生しやすいので大きい値を使用
        atrPercentageThreshold = Math.min(atrPercentage * 0.9, 10.0);
        trailingStopFactor = 1.2;
        gridAtrMultiplier = 0.5;
        stopDistanceMultiplier = 1.0;
        break;

      case 'EXTREME':
        // 極高ボラティリティ - リスク管理を強化
        atrPercentageThreshold = Math.min(atrPercentage * 0.8, 15.0);
        trailingStopFactor = 1.0;
        gridAtrMultiplier = 0.4;
        stopDistanceMultiplier = 0.8;
        break;
    }

    return {
      atrPercentageThreshold,
      trailingStopFactor,
      gridAtrMultiplier,
      stopDistanceMultiplier
    };
  }

  /**
   * ロウソク足の平均価格を計算
   * @param candles ロウソク足データ
   * @returns 平均価格
   */
  private calculateAveragePrice(candles: Candle[]): number {
    if (!candles || candles.length === 0) {
      return 0;
    }

    // VWAP (Volume Weighted Average Price) を計算
    let totalVolume = 0;
    let totalVolumePrice = 0;

    for (const candle of candles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const volume = candle.volume || 1; // ボリュームがない場合は1と仮定

      totalVolumePrice += typicalPrice * volume;
      totalVolume += volume;
    }

    return totalVolume > 0 ? totalVolumePrice / totalVolume : candles[candles.length - 1].close;
  }

  /**
   * キャリブレーション結果をキャッシュに保存
   * @param symbol 通貨ペア
   * @param result キャリブレーション結果
   */
  private cacheResult(symbol: string, result: CalibrationResult): void {
    const now = Date.now();
    this.calibrationCache[symbol] = {
      result,
      timestamp: now,
      expiresAt: now + this.cacheTTL
    };
  }

  /**
   * 有効なキャッシュがあるかチェック
   * @param symbol 通貨ペア
   * @returns 有効なキャッシュがあるかどうか
   */
  private hasValidCache(symbol: string): boolean {
    const cache = this.calibrationCache[symbol];
    if (!cache) {
      return false;
    }

    const now = Date.now();
    return cache.expiresAt > now;
  }

  /**
   * キャッシュを無効化（期限切れ）にする
   * @param symbol 通貨ペア（省略時は全キャッシュを無効化）
   */
  public invalidateCache(symbol?: string): void {
    if (symbol) {
      if (this.calibrationCache[symbol]) {
        delete this.calibrationCache[symbol];
        logger.debug(`[ATRCalibrator] ${symbol} のキャッシュを無効化しました`);
      }
    } else {
      this.calibrationCache = {};
      logger.debug('[ATRCalibrator] 全キャッシュを無効化しました');
    }
  }

  /**
   * キャッシュのTTL（有効期間）を設定
   * @param hours 時間単位のTTL
   */
  public setCacheTTL(hours: number): void {
    this.cacheTTL = hours * 60 * 60 * 1000;
    logger.debug(`[ATRCalibrator] キャッシュTTLを ${hours} 時間に設定しました`);
  }

  /**
   * データが不足している場合のフォールバック値
   * @param symbol 通貨ペア
   * @param candles 既存のロウソク足（少量）
   * @returns フォールバックのキャリブレーション結果
   */
  private getFallbackCalibration(symbol: string, candles?: Candle[]): CalibrationResult {
    logger.warn(`[ATRCalibrator] ${symbol} のフォールバックキャリブレーションを使用します`);

    // デフォルトのATR%（パラメータサービスから取得）
    const defaultAtrPercentage = parameterService.get<number>('risk.defaultAtrPercentage', 0.02) * 100;

    // 平均価格を計算（データがある場合）
    const avgPrice = candles && candles.length > 0 ? this.calculateAveragePrice(candles) : 0;

    // デフォルトプロファイルはMEDIUM
    const volatilityProfile = 'MEDIUM';

    // ミディアムボラティリティ用のパラメータ
    const recommendedParameters = {
      atrPercentageThreshold: defaultAtrPercentage * 1.1,
      trailingStopFactor: 1.5,
      gridAtrMultiplier: 0.6,
      stopDistanceMultiplier: 1.2
    };

    return {
      symbol,
      atrPercentage: defaultAtrPercentage,
      atrValue: avgPrice * (defaultAtrPercentage / 100),
      recommendedParameters,
      volatilityProfile,
      calculatedFrom: {
        candleCount: candles?.length || 0,
        periodDays: 0,
        averagePrice: avgPrice
      }
    };
  }

  /**
   * マルチシンボルのキャリブレーションを実行
   * @param symbolsCandles 通貨ペアごとのロウソク足データマップ
   * @param timeframeHours タイムフレーム（時間）
   * @param useCache キャッシュを使用するかどうか
   * @returns 通貨ペアごとのキャリブレーション結果マップ
   */
  public calibrateMultipleSymbols(
    symbolsCandles: Map<string, Candle[]>,
    timeframeHours: number = 1,
    useCache: boolean = true
  ): Map<string, CalibrationResult> {
    const results = new Map<string, CalibrationResult>();

    for (const [symbol, candles] of symbolsCandles.entries()) {
      const result = this.calibrateATR(symbol, candles, timeframeHours, useCache);
      results.set(symbol, result);
    }

    return results;
  }
}

// シングルトンインスタンスをエクスポート
export const atrCalibrator = ATRCalibrator.getInstance();

// CommonJS形式でエクスポート
module.exports = {
  ATRCalibrator,
  atrCalibrator: ATRCalibrator.getInstance()
};
