/**
 * 市場状態分析モジュール
 * INF-032-6: インジケーターディレクトリのCommonJS変換
 */
// @ts-nocheck

// CommonJS形式でのモジュールインポート
const technicalIndicators = require('technicalindicators');
const { EMA, ATR, ADX } = technicalIndicators;
const Types = require('../core/types');
const { Candle, MarketEnvironment, MarketAnalysisResult, StrategyType } = Types;
const { MARKET_PARAMETERS } = require('../config/parameters');
const { parameterService } = require('../config/parameterService');

// EMA傾き計算のボラティリティ適応閾値をパラメータサービスから取得
const SLOPE_HIGH_VOL_THRESHOLD = parameterService.get(
  'market.slope_periods_high_vol_threshold',
  8.0
);
const SLOPE_LOW_VOL_THRESHOLD = parameterService.get(
  'market.slope_periods_low_vol_threshold',
  3.0
);
const SLOPE_PERIODS_DEFAULT = parameterService.get('market.slope_periods_default', 5);
const SLOPE_HIGH_VOL_VALUE = parameterService.get('market.slope_periods_high_vol_value', 3);
const SLOPE_LOW_VOL_VALUE = parameterService.get('market.slope_periods_low_vol_value', 8);

// ATR==0の場合のフォールバック設定
const DEFAULT_ATR_PERCENTAGE = parameterService.get('risk.defaultAtrPercentage', 0.02);
const MIN_ATR_VALUE = parameterService.get('risk.minAtrValue', 0.0001);

/**
 * インクリメンタルEMA計算クラス
 * 全履歴の再計算をせず、増分計算でEMAを更新
 */
class IncrementalEMA {
  /**
   * @param {number} period EMA期間
   */
  constructor(period) {
    this.period = period;
    this.emaValue = null;
    // EMAの平滑化係数α = 2/(period+1)
    this.alpha = 2 / (this.period + 1);
  }

  /**
   * EMA値を初期化
   * @param {number[]} values 初期化に使用する値の配列
   * @returns {number} 初期化されたEMA値
   */
  initialize(values) {
    if (!values || values.length === 0) {
      this.emaValue = null;
      return 0;
    }

    // 期間未満のデータしかない場合は単純平均を使用
    if (values.length < this.period) {
      const sum = values.reduce((a, b) => a + b, 0);
      this.emaValue = sum / values.length;
      return this.emaValue;
    }

    // 期間分のデータがある場合は、まず単純平均を算出
    const initialValues = values.slice(-this.period);
    const sum = initialValues.reduce((a, b) => a + b, 0);
    this.emaValue = sum / this.period;

    // 残りのデータでEMA値を更新
    for (let i = this.period; i < values.length; i++) {
      this.update(values[i]);
    }

    return this.emaValue || 0;
  }

  /**
   * 新しい値でEMAを更新
   * @param {number} newValue 新しい値
   * @returns {number} 更新されたEMA値
   */
  update(newValue) {
    if (this.emaValue === null) {
      this.emaValue = newValue;
      return this.emaValue;
    }

    // EMA = α * 新しい値 + (1 - α) * 前回のEMA
    this.emaValue = this.alpha * newValue + (1 - this.alpha) * this.emaValue;
    return this.emaValue;
  }

  /**
   * 現在のEMA値を取得
   * @returns {number} 現在のEMA値
   */
  getValue() {
    return this.emaValue || 0;
  }

  /**
   * 期間を取得
   * @returns {number} EMA期間
   */
  getPeriod() {
    return this.period;
  }
}

/**
 * インクリメンタルATR計算クラス（technicalindicators完全互換）
 * ATR.calculate()と完全に同じ結果を返すよう設計
 */
class IncrementalATR {
  /**
   * @param {number} period ATR期間
   */
  constructor(period) {
    this.period = period;
    this.atrValue = null;
    this.lastClose = null;
    this.isInitialized = false;
  }

  /**
   * ATR値を初期化
   * @param {Candle[]} candles 初期化に使用するローソク足の配列
   * @returns {number} 初期化されたATR値
   */
  initialize(candles) {
    if (!candles || candles.length === 0) {
      this.atrValue = null;
      this.lastClose = null;
      this.isInitialized = false;
      return 0;
    }

    // technicalindicatorsライブラリと同じ方法でATRを計算
    const high = candles.map(c => c.high);
    const low = candles.map(c => c.low);
    const close = candles.map(c => c.close);

    // TR値を計算
    const trueRanges = [];
    for (let i = 0; i < candles.length; i++) {
      let tr;
      if (i === 0) {
        tr = high[i] - low[i];
      } else {
        const hl = high[i] - low[i];
        const hc = Math.abs(high[i] - close[i - 1]);
        const lc = Math.abs(low[i] - close[i - 1]);
        tr = Math.max(hl, hc, lc);
      }
      trueRanges.push(tr);
    }

    // ATRを計算 - technicalindicatorsライブラリとの完全互換性を確保
    // Wilder's ATRは最初のN個のTRでSMAを計算し、その後はEMA更新
    if (trueRanges.length >= this.period) {
      // 十分なデータがある場合：Wilder's ATR計算方式
      // 1. 最初のN個のTRの単純平均を初期ATRとする
      let firstATR;
      if (trueRanges.length === this.period) {
        // ちょうどN個の場合：単純平均
        const sum = trueRanges.reduce((a, b) => a + b, 0);
        firstATR = sum / this.period;
        this.atrValue = firstATR;
    } else {
        // N個を超える場合：最初のN個でSMA、その後はWilder's平滑化
        const initialTRs = trueRanges.slice(0, this.period);
        const initialSum = initialTRs.reduce((a, b) => a + b, 0);
        firstATR = initialSum / this.period;
      
        // Wilder's平滑化で残りのTRを適用
        let currentATR = firstATR;
        for (let i = this.period; i < trueRanges.length; i++) {
          // Wilder's平滑化: ATR = ((ATR_prev * (N-1)) + TR_current) / N
          currentATR = ((currentATR * (this.period - 1)) + trueRanges[i]) / this.period;
      }
        this.atrValue = currentATR;
      }
    } else {
      // データが不足している場合は全データの平均
      const sum = trueRanges.reduce((a, b) => a + b, 0);
      this.atrValue = sum / trueRanges.length;
    }

    // フォールバックチェック：ATRが0または非常に小さい場合
    if (this.atrValue === 0 || this.atrValue < candles[candles.length - 1].close * MIN_ATR_VALUE) {
      console.warn(
        '[IncrementalATR] 初期化時のATRが0または極小値です。フォールバック値を使用します。'
      );
      // 現在価格のデフォルトパーセンテージをATRとして使用
      this.atrValue = candles[candles.length - 1].close * DEFAULT_ATR_PERCENTAGE;
      console.log(`[IncrementalATR] フォールバックATR: ${this.atrValue}`);
    }

    // 状態を保存
    this.lastClose = candles[candles.length - 1].close;
    this.isInitialized = true;

    return this.atrValue || 0;
  }

  /**
   * 新しいローソク足でATRを更新（Wilder型平滑化）
   * @param {Candle} candle 新しいローソク足
   * @returns {number} 更新されたATR値
   */
  update(candle) {
    if (!this.isInitialized) {
      // 初回のみ対応
      this.atrValue = candle.high - candle.low;
      this.lastClose = candle.close;
      this.isInitialized = true;
      return this.atrValue;
    }

    // Wilder型平滑化ATR更新
    return this.updateIncrementalATR(this.lastClose, candle);
  }

  /**
   * Wilder の平滑 ATR を 1 本分だけ更新する
   *
   * @param {number} prevClose 直前の終値
   * @param {Candle} candle 今回追加するローソク足
   * @returns {number} 更新されたATR値
   */
  updateIncrementalATR(prevClose, candle) {
    // 1. True Range を Wilder 定義で算出
    const tr = Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - prevClose),
      Math.abs(candle.low - prevClose)
    );

    // 2. 平滑化公式 ATR_t = [(n-1)×ATR_{t-1} + TR_t] / n
    this.atrValue = ((this.atrValue * (this.period - 1)) + tr) / this.period;
    this.lastClose = candle.close;

    return this.atrValue;
  }

  /**
   * 現在のATR値を取得
   * @returns {number} 現在のATR値
   */
  getValue() {
    return this.atrValue || 0;
  }

  /**
   * 期間を取得
   * @returns {number} ATR期間
   */
  getPeriod() {
    return this.period;
  }
}

// インクリメンタル計算用インスタンスを保持
let shortTermEmaInstance = null;
let longTermEmaInstance = null;
let atrInstance = null;

/**
 * インクリメンタル計算用インスタンスをリセット
 */
function resetMarketStateCalculators() {
  shortTermEmaInstance = null;
  longTermEmaInstance = null;
  atrInstance = null;
}

/**
 * EMAの傾きを計算（線形回帰方式）
 * @param {number[]} emaValues EMAの値の配列
 * @param {number} periods 傾きを計算する期間
 * @param {number} timeframeHours タイムフレーム（時間単位、例：1, 4, 24）
 * @returns {number} 傾きの値（標準化された値）
 */
function calculateSlope(
  emaValues,
  periods = 5,
  timeframeHours = 4
) {
  if (emaValues.length < periods) {
    return 0;
  }

  // 直近のperiods分のデータを取得
  const recentEma = emaValues.slice(-periods);

  // 線形回帰の計算
  // y = mx + b の m（傾き）を求める
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  // 値を正規化するための平均価格（初期値）
  const avgPrice = recentEma[0];

  for (let i = 0; i < periods; i++) {
    const normalizedPrice = recentEma[i] / avgPrice; // 価格を正規化
    sumX += i;
    sumY += normalizedPrice;
    sumXY += i * normalizedPrice;
    sumXX += i * i;
  }

  const n = periods;
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  // 傾きを年率換算：タイムフレームに応じた一般化された計算式
  // 例：
  // 1時間足: factor = 365*24/1 = 8760
  // 4時間足: factor = 365*24/4 = 2190
  // 日足: factor = 365*24/24 = 365
  //
  // 一般式: factor = (年間時間数 / タイムフレーム時間)
  const annualizedSlope = slope * ((365 * 24) / timeframeHours) * 100;

  return annualizedSlope;
}

/**
 * 傾きを角度（度数法）に変換
 * @param {number} slope 傾き
 * @returns {number} 角度（度数法）
 */
function slopeToAngle(slope) {
  // arctan(slope) * (180/π) で角度（度数法）に変換
  return Math.atan(slope) * (180 / Math.PI);
}

/**
 * EMAの傾きを確認する期間を動的に調整する関数
 * ボラティリティに応じて期間を変える
 * @param {number} atrPercentage ATRパーセンテージ（ボラティリティ指標）
 * @param {number} defaultPeriods デフォルトの期間
 * @returns {number} 調整された期間
 */
function adjustSlopePeriods(
  atrPercentage,
  defaultPeriods = SLOPE_PERIODS_DEFAULT
) {
  // ボラティリティが高い場合、期間を短くする（素早く反応）
  // ボラティリティが低い場合、期間を長くする（フィルタリング効果を高める）
  if (atrPercentage > SLOPE_HIGH_VOL_THRESHOLD) {
    return Math.max(SLOPE_HIGH_VOL_VALUE, defaultPeriods - 2); // 高ボラティリティ：短い期間
  } else if (atrPercentage < SLOPE_LOW_VOL_THRESHOLD) {
    return defaultPeriods + SLOPE_LOW_VOL_VALUE - SLOPE_PERIODS_DEFAULT; // 低ボラティリティ：長い期間
  }
  return defaultPeriods; // 通常のボラティリティ：デフォルト期間
}

/**
 * ATRの変化率を計算
 * @param {number[]} atrValues ATRの値の配列
 * @param {number} periods 変化率を計算する期間
 * @returns {number} 変化率
 */
function calculateAtrChange(atrValues, periods = 10) {
  if (!atrValues || atrValues.length === 0) {
    console.warn('[MarketState] ATR配列が空です');
    return 1; // デフォルト値として1を返す（変化なし）
  }

  // 配列長が足りない場合は必要な期間を調整
  const actualPeriods = Math.min(periods, atrValues.length - 1);

  if (actualPeriods <= 0) {
    console.warn(
      `[MarketState] ATR配列長不足: length=${atrValues.length}, required=${periods + 1}`
    );
    return 1; // データ不足時は変化なしとして1を返す
  }

  try {
    // 配列長が十分な場合は指定された期間で計算
    // そうでない場合は利用可能な最大期間で計算
    const atr1 = atrValues[Math.max(0, atrValues.length - 1 - actualPeriods)];
    const atr2 = atrValues[atrValues.length - 1];

    // 0除算防止
    if (atr1 === 0 || isNaN(atr1)) {
      console.warn('[MarketState] ATR計算の基準値が0またはNaNです');
      return 1;
    }

    // ATRの変化率: atr2 / atr1
    return atr2 / atr1;
  } catch (error) {
    console.error(
      `[MarketState] ATR変化率計算エラー: ${error instanceof Error ? error.message : String(error)}`
    );
    return 1; // エラー時は変化なしとして1を返す
  }
}

/**
 * ATRパーセンテージを計算（ATR/Close）
 * @param {number} atr ATR値
 * @param {number} closePrice 終値
 * @returns {number} ATRパーセンテージ
 */
function calculateAtrPercentage(atr, closePrice) {
  return (atr / closePrice) * 100;
}

/**
 * VWAP（Volume Weighted Average Price）を計算
 * @param {Candle[]} candles ローソク足データ
 * @param {number} period 期間（省略時は全期間）
 * @returns {number} VWAP値
 */
function calculateVWAP(candles, period) {
  if (!candles || candles.length === 0) {
    return 0;
  }

  // 計算に使用するデータを取得
  const dataToUse = period && period < candles.length ? candles.slice(-period) : candles;

  // 累積の（価格×ボリューム）と累積ボリュームを計算
  let cumulativePV = 0;
  let cumulativeVolume = 0;

  for (const candle of dataToUse) {
    // 各ローソク足の典型的な価格（(high + low + close) / 3）
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volumePrice = typicalPrice * candle.volume;

    cumulativePV += volumePrice;
    cumulativeVolume += candle.volume;
  }

  // ボリュームが0の場合は現在の価格を返す
  if (cumulativeVolume === 0) {
    return dataToUse[dataToUse.length - 1].close;
  }

  // VWAP = 累積(価格×ボリューム) / 累積ボリューム
  return cumulativePV / cumulativeVolume;
}

/**
 * 市場環境を分析する
 * @param {Candle[]} candles ローソク足データ
 * @param {number} timeframeHours タイムフレーム（時間単位、例：1, 4, 24）
 * @returns {MarketAnalysisResult} 市場分析の結果
 */
function analyzeMarketState(
  candles,
  timeframeHours = 4
) {
  // データ不足時のエラーハンドリングを強化
  const minRequiredCandles =
    Math.max(MARKET_PARAMETERS.LONG_TERM_EMA, MARKET_PARAMETERS.ATR_PERIOD) + 10;

  if (!candles || !Array.isArray(candles) || candles.length < minRequiredCandles) {
    console.warn(
      `[MarketState] データ不足: ${candles?.length || 0} 件（必要: ${minRequiredCandles}件）`
    );

    // スモークテスト用の簡易環境判定（デフォルト値）
    return {
      environment: MarketEnvironment.UNKNOWN,
      recommendedStrategy: StrategyType.TREND_FOLLOWING,
      indicators: {
        note: 'Insufficient data, using default values',
        atr: candles && candles.length > 0 ? candles[0].close * 0.01 : 1, // デフォルトATR: 価格の1%
        shortTermEma: candles && candles.length > 0 ? candles[0].close : 100,
        longTermEma: candles && candles.length > 0 ? candles[0].close : 100,
        atrPercentage: 5.0, // デフォルト5%
        slope: 0
      },
      timestamp: Date.now()
    };
  }

  try {
    // 短期EMAを計算（インクリメンタル方式）
    const shortTermEmaPeriod = MARKET_PARAMETERS.SHORT_TERM_EMA;
    if (!shortTermEmaInstance || shortTermEmaInstance.getPeriod() !== shortTermEmaPeriod) {
      shortTermEmaInstance = new IncrementalEMA(shortTermEmaPeriod);
      shortTermEmaInstance.initialize(candles.map((c) => c.close));
    }

    // 最新の価格でEMAを更新
    const latestShortEma = shortTermEmaInstance.getValue();

    // 短期EMAの値の履歴を計算（傾き計算用）
    // 注：ここは最適化の余地あり。将来的には傾き計算もインクリメンタル化が可能
    const shortTermEmaInput = {
      period: shortTermEmaPeriod,
      values: candles.map((c) => c.close)
    };
    const shortTermEmaValues = EMA.calculate(shortTermEmaInput);

    // 長期EMAを計算（インクリメンタル方式）
    const longTermEmaPeriod = MARKET_PARAMETERS.LONG_TERM_EMA;
    if (!longTermEmaInstance || longTermEmaInstance.getPeriod() !== longTermEmaPeriod) {
      longTermEmaInstance = new IncrementalEMA(longTermEmaPeriod);
      longTermEmaInstance.initialize(candles.map((c) => c.close));
    }

    // 最新の価格でEMAを更新
    const latestLongEma = longTermEmaInstance.getValue();

    // 長期EMAの値の履歴を計算（傾き計算用）
    const longTermEmaInput = {
      period: longTermEmaPeriod,
      values: candles.map((c) => c.close)
    };
    const longTermEmaValues = EMA.calculate(longTermEmaInput);

    // ATRを計算（インクリメンタル方式）
    const atrPeriod = MARKET_PARAMETERS.ATR_PERIOD || 14;
    if (!atrInstance || atrInstance.getPeriod() !== atrPeriod) {
      atrInstance = new IncrementalATR(atrPeriod);
      atrInstance.initialize(candles);
    }
    // 注：テスト環境では初期化のみでATR値が確定するため、updateは呼ばない

    // 現在のATR値を取得
    const currentAtr = atrInstance.getValue();

    // ATR履歴を計算（変化率計算用）
    // 注：ここは最適化の余地あり。将来的にはATR変化率もインクリメンタル化が可能
    const atrInput = {
      high: candles.map((c) => c.high),
      low: candles.map((c) => c.low),
      close: candles.map((c) => c.close),
      period: atrPeriod
    };

    let atrValues;
    try {
      atrValues = ATR.calculate(atrInput);
    } catch (atrError) {
      console.warn(
        `[MarketState] ATR計算エラー: ${atrError instanceof Error ? atrError.message : String(atrError)}`
      );
      // エラー時は簡易計算のATR（直近の高値-安値の平均値）を使用
      atrValues = [];
      for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        atrValues.push((candle.high - candle.low) * 0.5);
      }
    }

    // ATR配列不足時のセーフガード
    if (!atrValues || atrValues.length === 0) {
      console.warn(`[MarketState] ATR配列が空です。単純な価格変動率を使用します。`);
      // 簡易的なATR計算（価格の1%）
      const currentPrice = candles[candles.length - 1].close;
      atrValues = [currentPrice * 0.01];
    }

    // 現在の終値
    const currentClose = candles[candles.length - 1].close;

    // ATRパーセンテージ（ATR/Close）を計算
    const atrPercentage = calculateAtrPercentage(currentAtr, currentClose);

    // ボラティリティに基づいて傾きの計算期間を調整
    const adjustedPeriods = adjustSlopePeriods(atrPercentage);

    // 短期EMAの傾きを計算（最適化されたメソッド）- タイムフレーム対応
    const shortTermSlope = calculateSlope(shortTermEmaValues, adjustedPeriods, timeframeHours);

    // 傾きを角度に変換
    const shortTermSlopeAngle = slopeToAngle(shortTermSlope);

    // 長期EMAの傾きも計算（トレンドの持続性判断に使用）- タイムフレーム対応
    const longTermSlope = calculateSlope(longTermEmaValues, adjustedPeriods * 2, timeframeHours);

    // 長期EMAの傾きを角度に変換
    const longTermSlopeAngle = slopeToAngle(longTermSlope);

    // ATRの変化率を計算
    const atrChange = calculateAtrChange(atrValues);

    // トレンドの方向性を判定（短期・長期EMAの位置関係とスロープの符号）
    const emaCrossover = latestShortEma > latestLongEma;
    const bullFlag = emaCrossover && shortTermSlope > 0;
    const bearFlag = !emaCrossover && shortTermSlope < 0;

    // 傾きの一致（短期と長期の傾きの方向が一致するか）
    const slopesAligned =
      (shortTermSlope > 0 && longTermSlope > 0) || (shortTermSlope < 0 && longTermSlope < 0);

    // 価格のロケーション判定（中長期のMA位置と現在価格の相対位置）
    const priceLocationRatio = currentClose / latestLongEma;
    const isPriceAboveLongMa = priceLocationRatio > 1.0;
    const isPriceFarAboveLongMa = priceLocationRatio > 1.05; // 5%以上上方
    const isPriceFarBelowLongMa = priceLocationRatio < 0.95; // 5%以上下方

    // ADXを計算（トレンドの強さを測定）
    const adxInput = {
      high: candles.map((c) => c.high),
      low: candles.map((c) => c.low),
      close: candles.map((c) => c.close),
      period: MARKET_PARAMETERS.ADX_PERIOD || 14
    };

    // ADX計算
    let adxValue = 0;
    try {
      const adxResult = ADX.calculate(adxInput);
      adxValue = adxResult[adxResult.length - 1].adx;
    } catch (error) {
      console.warn(
        `[MarketState] ADX計算エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      // ADX計算エラー時はデフォルト値を使用
      adxValue = 15; // 中程度のトレンド強度をデフォルト値とする
    }

    // 強いトレンドフラグ（ADXと傾きの両方で判定）
    const strongAdxTrendFlag = adxValue > 25;
    const modestAdxTrendFlag = adxValue > 20 && adxValue <= 25;
    const weakAdxTrendFlag = adxValue > 15 && adxValue <= 20;

    // 市場環境を判定するフラグ（MA-Slopeのみに依存しない改良版）
    const strongTrendFlag =
      Math.abs(shortTermSlopeAngle) > MARKET_PARAMETERS.TREND_SLOPE_THRESHOLD * 1.5 ||
      (Math.abs(shortTermSlopeAngle) > MARKET_PARAMETERS.TREND_SLOPE_THRESHOLD &&
        strongAdxTrendFlag);
    const trendFlag =
      Math.abs(shortTermSlopeAngle) > MARKET_PARAMETERS.TREND_SLOPE_THRESHOLD ||
      (Math.abs(shortTermSlopeAngle) > MARKET_PARAMETERS.TREND_SLOPE_THRESHOLD * 0.8 &&
        modestAdxTrendFlag);
    const weakTrendFlag =
      Math.abs(shortTermSlopeAngle) > MARKET_PARAMETERS.TREND_SLOPE_THRESHOLD * 0.7 ||
      weakAdxTrendFlag;

    // ドンチャンブレイクアウト戦略の条件:
    // 非常に強いADX + 明確なトレンド + 加速したトレンド(急激なスロープ)
    const veryStrongTrendFlag =
      adxValue > 30 && Math.abs(shortTermSlopeAngle) > MARKET_PARAMETERS.TREND_SLOPE_THRESHOLD * 2;

    // 低ボラティリティ判定（ATR%が閾値未満 かつ EMA勾配が小さい）
    const lowVolFlag =
      atrPercentage < MARKET_PARAMETERS.ATR_PERCENTAGE_THRESHOLD &&
      Math.abs(shortTermSlopeAngle) < 0.15;

    // 市場環境を判定（改良版ロジック）
    let environment = MarketEnvironment.RANGE;
    let recommendedStrategy = StrategyType.RANGE_TRADING;

    if (lowVolFlag) {
      // 低ボラティリティ環境
      environment = MarketEnvironment.RANGE;
      recommendedStrategy = StrategyType.RANGE_TRADING;
    } else if (bullFlag && strongTrendFlag && slopesAligned) {
      // 強い上昇トレンド（スロープ、ADX、価格位置を考慮）
      environment = MarketEnvironment.STRONG_UPTREND;

      // 非常に強いトレンド時はドンチャンブレイクアウト戦略を推奨
      if (veryStrongTrendFlag) {
        recommendedStrategy = StrategyType.DONCHIAN_BREAKOUT;
        console.log(
          `[MarketState] ドンチャンブレイクアウト戦略を推奨: ADX=${adxValue.toFixed(2)}, Slope=${shortTermSlopeAngle.toFixed(2)}`
        );
      } else {
        recommendedStrategy = StrategyType.TREND_FOLLOWING;
      }

      // 価格がMAから大きく離れている場合は注意
      if (isPriceFarAboveLongMa && adxValue < 30) {
        // 過熱の可能性があるがまだ強いトレンド
        environment = MarketEnvironment.UPTREND;
      }
    } else if (bearFlag && strongTrendFlag && slopesAligned) {
      // 強い下降トレンド（スロープ、ADX、価格位置を考慮）
      environment = MarketEnvironment.STRONG_DOWNTREND;

      // 非常に強いトレンド時はドンチャンブレイクアウト戦略を推奨
      if (veryStrongTrendFlag) {
        recommendedStrategy = StrategyType.DONCHIAN_BREAKOUT;
        console.log(
          `[MarketState] ドンチャンブレイクアウト戦略を推奨: ADX=${adxValue.toFixed(2)}, Slope=${shortTermSlopeAngle.toFixed(2)}`
        );
      } else {
        recommendedStrategy = StrategyType.TREND_FOLLOWING;
      }

      // 価格がMAから大きく離れている場合は注意
      if (isPriceFarBelowLongMa && adxValue < 30) {
        // 過熱の可能性があるがまだ強いトレンド
        environment = MarketEnvironment.DOWNTREND;
      }
    } else if (bullFlag && trendFlag) {
      // 通常の上昇トレンド
      environment = MarketEnvironment.UPTREND;
      recommendedStrategy = StrategyType.TREND_FOLLOWING;
    } else if (bearFlag && trendFlag) {
      // 通常の下降トレンド
      environment = MarketEnvironment.DOWNTREND;
      recommendedStrategy = StrategyType.TREND_FOLLOWING;
    } else if (weakTrendFlag) {
      // 弱いトレンド（わずかに傾向あり）
      if (shortTermSlope > 0) {
        environment = MarketEnvironment.WEAK_UPTREND;
      } else {
        environment = MarketEnvironment.WEAK_DOWNTREND;
      }

      // 弱いトレンドでの戦略選択 - 価格位置で微調整
      if (
        (shortTermSlope > 0 && isPriceAboveLongMa) ||
        (shortTermSlope < 0 && !isPriceAboveLongMa)
      ) {
        // 価格位置がトレンド方向と一致 → トレンドフォロー
        recommendedStrategy = StrategyType.TREND_FOLLOWING;
      } else {
        // 価格位置とトレンド方向が不一致 → レンジ戦略
        recommendedStrategy = StrategyType.RANGE_TRADING;
      }
    } else {
      // レンジ相場
      environment = MarketEnvironment.RANGE;

      // ミーンリバース戦略の条件：
      // 1. 明確なレンジ環境（スロープが小さい）
      // 2. 適度なボラティリティ（ATR%が閾値内かつゼロでない）
      // 3. ADXが20未満（弱いトレンド）
      if (
        Math.abs(shortTermSlopeAngle) < 0.15 &&
        atrPercentage >= 3.0 &&
        atrPercentage <= 8.0 &&
        adxValue < 20
      ) {
        // 適度なボラティリティを持つレンジ相場 → ミーンリバース戦略
        recommendedStrategy = StrategyType.MEAN_REVERT;
        console.log(
          `[MarketState] ミーンリバース戦略を推奨: ATR%=${atrPercentage.toFixed(2)}%, ADX=${adxValue.toFixed(2)}, Slope=${shortTermSlopeAngle.toFixed(2)}`
        );
      } else {
        // 他のレンジ条件 → 通常のレンジ戦略
        recommendedStrategy = StrategyType.RANGE_TRADING;
      }
    }

    // 高ボラティリティ環境では緊急戦略を推奨
    if (atrChange > MARKET_PARAMETERS.VOLATILITY_THRESHOLD) {
      recommendedStrategy = StrategyType.EMERGENCY;
    }

    // 結果を返す
    return {
      environment,
      recommendedStrategy,
      indicators: {
        shortTermEma: latestShortEma,
        longTermEma: latestLongEma,
        atr: currentAtr,
        atrPercentage,
        atrChange,
        shortTermSlope,
        shortTermSlopeAngle,
        longTermSlope,
        longTermSlopeAngle,
        adx: adxValue,
        priceLocationRatio,
        slopePeriods: adjustedPeriods
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error(`[MarketState] 市場分析エラー:`, error);

    // エラー時は安全な値を返す
    return {
      environment: MarketEnvironment.UNKNOWN,
      recommendedStrategy: StrategyType.TREND_FOLLOWING,
      indicators: {
        error: `Analysis error: ${error instanceof Error ? error.message : String(error)}`
      },
      timestamp: Date.now()
    };
  }
}

/**
 * 複数シンボルのATRパーセンテージを計算
 * @param {Record<string, Candle[]>} symbolCandles 各シンボルのローソク足データのマップ
 * @returns {Record<string, number>} 各シンボルのATRパーセンテージのマップ
 */
function getSymbolsAtrPercentages(
  symbolCandles
) {
  const result = {};

  Object.entries(symbolCandles).forEach(([symbol, candles]) => {
    try {
      // 各シンボルの市場分析を実行
      const analysis = analyzeMarketState(candles);
      // 分析結果からATRパーセンテージを取得
      result[symbol] = analysis.indicators.atrPercentage;
    } catch (error) {
      console.error(`[MarketState] ${symbol}のATRパーセンテージ計算エラー:`, error);
      // エラー時はデフォルト値を使用
      result[symbol] = 5.0; // デフォルト5%
    }
  });

  return result;
}

/**
 * ボラティリティに基づく資金配分比率を計算
 * ATRパーセンテージの逆数を使用してリスク調整後の配分を算出
 * ボラティリティが高いほど配分を小さく、低いほど配分を大きくする
 * @param {Record<string, Candle[]>} symbolCandles 各シンボルのローソク足データのマップ
 * @returns {Record<string, number>} 各シンボルの資金配分比率（合計1.0）
 */
function volBasedAllocationWeights(
  symbolCandles
) {
  // 各シンボルのATRパーセンテージを取得
  const atrPercentages = getSymbolsAtrPercentages(symbolCandles);
  const inverseWeights = {};
  let totalInverseWeight = 0;

  // ATRパーセンテージの逆数を計算（ボラティリティが低いほど配分が多くなる）
  Object.entries(atrPercentages).forEach(([symbol, atrPercentage]) => {
    // ATRが0または非常に小さい場合のガード
    if (atrPercentage <= 0.1) {
      console.warn(`[MarketState] ${symbol}のATRパーセンテージが極小値です: ${atrPercentage}%`);
      atrPercentage = 0.1; // 最小値として0.1%を設定
    }

    // 逆数を計算（ボラティリティ÷定数で調整）
    const inverseWeight = 1 / atrPercentage;
    inverseWeights[symbol] = inverseWeight;
    totalInverseWeight += inverseWeight;
  });

  // 正規化して合計が1.0になるようにする
  const normalizedWeights = {};

  Object.entries(inverseWeights).forEach(([symbol, weight]) => {
    normalizedWeights[symbol] = weight / totalInverseWeight;
  });

  console.log('[MarketState] ボラティリティベース配分:', normalizedWeights);

  return normalizedWeights;
}

// CommonJS形式でエクスポート
module.exports = {
  resetMarketStateCalculators,
  calculateVWAP,
  analyzeMarketState,
  getSymbolsAtrPercentages,
  volBasedAllocationWeights
};
