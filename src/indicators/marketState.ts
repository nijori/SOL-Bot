import { EMA, ATR } from 'technicalindicators';
import { 
  Candle, 
  MarketEnvironment, 
  MarketAnalysisResult, 
  StrategyType 
} from '../core/types';
import { MARKET_PARAMETERS } from '../config/parameters';

/**
 * EMAの傾きを計算（線形回帰方式）
 * @param emaValues EMAの値の配列
 * @param periods 傾きを計算する期間
 * @param timeframeHours タイムフレーム（時間単位、例：1, 4, 24）
 * @returns 傾きの値（標準化された値）
 */
function calculateSlope(emaValues: number[], periods: number = 5, timeframeHours: number = 4): number {
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
    const normalizedPrice = recentEma[i] / avgPrice;  // 価格を正規化
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
  const annualizedSlope = slope * (365 * 24 / timeframeHours) * 100;
  
  return annualizedSlope;
}

/**
 * 傾きを角度（度数法）に変換
 * @param slope 傾き
 * @returns 角度（度数法）
 */
function slopeToAngle(slope: number): number {
  // arctan(slope) * (180/π) で角度（度数法）に変換
  return Math.atan(slope) * (180 / Math.PI);
}

/**
 * EMAの傾きを確認する期間を動的に調整する関数
 * ボラティリティに応じて期間を変える
 * @param atrPercentage ATRパーセンテージ（ボラティリティ指標）
 * @param defaultPeriods デフォルトの期間
 * @returns 調整された期間
 */
function adjustSlopePeriods(atrPercentage: number, defaultPeriods: number = 5): number {
  // ボラティリティが高い場合、期間を短くする（素早く反応）
  // ボラティリティが低い場合、期間を長くする（フィルタリング効果を高める）
  if (atrPercentage > 8) {
    return Math.max(3, defaultPeriods - 2);  // 高ボラティリティ：短い期間
  } else if (atrPercentage < 3) {
    return defaultPeriods + 3;  // 低ボラティリティ：長い期間
  }
  return defaultPeriods;  // 通常のボラティリティ：デフォルト期間
}

/**
 * ATRの変化率を計算
 * @param atrValues ATRの値の配列
 * @param periods 変化率を計算する期間
 * @returns 変化率
 */
function calculateAtrChange(atrValues: number[], periods: number = 10): number {
  if (!atrValues || atrValues.length === 0) {
    console.warn('[MarketState] ATR配列が空です');
    return 1; // デフォルト値として1を返す（変化なし）
  }
  
  // 配列長が足りない場合は必要な期間を調整
  const actualPeriods = Math.min(periods, atrValues.length - 1);
  
  if (actualPeriods <= 0) {
    console.warn(`[MarketState] ATR配列長不足: length=${atrValues.length}, required=${periods + 1}`);
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
    console.error(`[MarketState] ATR変化率計算エラー: ${error instanceof Error ? error.message : String(error)}`);
    return 1; // エラー時は変化なしとして1を返す
  }
}

/**
 * ATRパーセンテージを計算（ATR/Close）
 * @param atr ATR値
 * @param closePrice 終値
 * @returns ATRパーセンテージ
 */
function calculateAtrPercentage(atr: number, closePrice: number): number {
  return (atr / closePrice) * 100;
}

/**
 * 市場環境を分析する
 * @param candles ローソク足データ
 * @param timeframeHours タイムフレーム（時間単位、例：1, 4, 24）
 * @returns 市場分析の結果
 */
export function analyzeMarketState(candles: Candle[], timeframeHours: number = 4): MarketAnalysisResult {
  // データ不足時のエラーハンドリングを強化
  const minRequiredCandles = Math.max(MARKET_PARAMETERS.LONG_TERM_EMA, MARKET_PARAMETERS.ATR_PERIOD) + 10;
  
  if (!candles || !Array.isArray(candles) || candles.length < minRequiredCandles) {
    console.warn(`[MarketState] データ不足: ${candles?.length || 0} 件（必要: ${minRequiredCandles}件）`);
    
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
    // 短期EMAを計算
    const shortTermEmaInput = {
      period: MARKET_PARAMETERS.SHORT_TERM_EMA,
      values: candles.map(c => c.close)
    };
    let shortTermEmaValues = EMA.calculate(shortTermEmaInput);
    
    // 長期EMAを計算
    const longTermEmaInput = {
      period: MARKET_PARAMETERS.LONG_TERM_EMA,
      values: candles.map(c => c.close)
    };
    let longTermEmaValues = EMA.calculate(longTermEmaInput);
    
    // ATRを計算
    const atrInput = {
      high: candles.map(c => c.high),
      low: candles.map(c => c.low),
      close: candles.map(c => c.close),
      period: MARKET_PARAMETERS.ATR_PERIOD || 14 // デフォルト値を提供
    };
    
    let atrValues;
    try {
      atrValues = ATR.calculate(atrInput);
    } catch (atrError) {
      console.warn(`[MarketState] ATR計算エラー: ${atrError instanceof Error ? atrError.message : String(atrError)}`);
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
    
    // EMAの値が空の場合、単純移動平均を計算
    if (!shortTermEmaValues || shortTermEmaValues.length === 0) {
      console.warn(`[MarketState] 短期EMA計算結果が空です。単純移動平均を使用します。`);
      const period = MARKET_PARAMETERS.SHORT_TERM_EMA || 10;
      shortTermEmaValues = [];
      for (let i = period - 1; i < candles.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += candles[i - j].close;
        }
        shortTermEmaValues.push(sum / period);
      }
    }
    
    if (!longTermEmaValues || longTermEmaValues.length === 0) {
      console.warn(`[MarketState] 長期EMA計算結果が空です。単純移動平均を使用します。`);
      const period = MARKET_PARAMETERS.LONG_TERM_EMA || 50;
      longTermEmaValues = [];
      for (let i = period - 1; i < candles.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += candles[i - j].close;
        }
        longTermEmaValues.push(sum / period);
      }
    }
    
    // 現在の終値
    const currentClose = candles[candles.length - 1].close;
    
    // 現在のATR
    const currentAtr = atrValues[atrValues.length - 1];
    
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
    
    // 市場環境を判定するフラグ
    const strongTrendFlag = Math.abs(shortTermSlopeAngle) > MARKET_PARAMETERS.TREND_SLOPE_THRESHOLD * 1.5;
    const trendFlag = Math.abs(shortTermSlopeAngle) > MARKET_PARAMETERS.TREND_SLOPE_THRESHOLD;
    const weakTrendFlag = Math.abs(shortTermSlopeAngle) > MARKET_PARAMETERS.TREND_SLOPE_THRESHOLD * 0.7;
    
    // 低ボラティリティ判定（ATR%が閾値未満 かつ EMA勾配が0.15°未満）
    const lowVolFlag = atrPercentage < MARKET_PARAMETERS.ATR_PERCENTAGE_THRESHOLD && 
                      Math.abs(shortTermSlopeAngle) < 0.15;
    
    // トレンドの方向性を判定（短期・長期EMAの位置関係とスロープの符号）
    const latestShortEma = shortTermEmaValues[shortTermEmaValues.length - 1];
    const latestLongEma = longTermEmaValues[longTermEmaValues.length - 1];
    const emaCrossover = latestShortEma > latestLongEma;
    const bullFlag = emaCrossover && shortTermSlope > 0;
    const bearFlag = !emaCrossover && shortTermSlope < 0;
    
    // 傾きの一致（短期と長期の傾きの方向が一致するか）
    const slopesAligned = (shortTermSlope > 0 && longTermSlope > 0) || (shortTermSlope < 0 && longTermSlope < 0);
    
    // 市場環境を判定（改良版ロジック）
    let environment = MarketEnvironment.RANGE;
    let recommendedStrategy = StrategyType.RANGE_TRADING;
    
    if (lowVolFlag) {
      // 低ボラティリティ環境
      environment = MarketEnvironment.RANGE;
      recommendedStrategy = StrategyType.RANGE_TRADING;
    } else if (bullFlag && strongTrendFlag && slopesAligned) {
      // 強い上昇トレンド
      environment = MarketEnvironment.STRONG_UPTREND;
      recommendedStrategy = StrategyType.TREND_FOLLOWING;
    } else if (bearFlag && strongTrendFlag && slopesAligned) {
      // 強い下降トレンド
      environment = MarketEnvironment.STRONG_DOWNTREND;
      recommendedStrategy = StrategyType.TREND_FOLLOWING;
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
      
      // 戦略選択：弱いトレンドでもトレンドフォロー
      recommendedStrategy = StrategyType.TREND_FOLLOWING;
    } else {
      // レンジ相場
      environment = MarketEnvironment.RANGE;
      recommendedStrategy = StrategyType.RANGE_TRADING;
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