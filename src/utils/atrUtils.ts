/**
 * ATRユーティリティ
 * 戦略間で共通のATR計算とフォールバックロジックを提供
 */

import { ATR } from 'technicalindicators';
import { Candle } from '../core/types.js';
import { parameterService } from '../config/parameterService.js';
import logger from './logger.js';

// ATR==0の場合のフォールバック設定をパラメータから取得
const DEFAULT_ATR_PERCENTAGE = parameterService.get<number>('risk.defaultAtrPercentage', 0.02);
const MIN_ATR_VALUE = parameterService.get<number>('risk.minAtrValue', 0.0001);
const MIN_STOP_DISTANCE_PERCENTAGE = parameterService.get<number>(
  'risk.minStopDistancePercentage',
  0.01
);

/**
 * ATRを計算する関数
 * @param candles ローソク足データ
 * @param period 期間
 * @param strategyName 戦略名（ログ用）
 * @returns ATR値（極小値や計算エラー時はフォールバック値）
 */
export function calculateATR(
  candles: Candle[],
  period: number,
  strategyName: string = 'Strategy'
): number {
  // データ不足チェック
  if (candles.length < period) {
    logger.warn(
      `[${strategyName}] ATR計算に必要なローソク足データが不足しています: ${candles.length} < ${period}`
    );
    return getFallbackATR(candles, strategyName);
  }

  const atrInput = {
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
    period
  };

  try {
    const atrValues = ATR.calculate(atrInput);
    const currentAtr = atrValues[atrValues.length - 1];

    // ATRが0または非常に小さい値の場合のフォールバック
    if (isATRTooSmall(currentAtr, candles)) {
      return getFallbackATR(candles, strategyName);
    }

    return currentAtr;
  } catch (error) {
    logger.error(`[${strategyName}] ATR計算エラー:`, error);

    // エラー時は簡易計算（過去n期間の高値-安値の平均）を使用
    const simplifiedAtr = calculateSimplifiedATR(candles, period);

    // 計算されたATRが0または非常に小さい場合もフォールバックを使用
    if (isATRTooSmall(simplifiedAtr, candles)) {
      return getFallbackATR(candles, strategyName);
    }

    return simplifiedAtr;
  }
}

/**
 * 簡易ATR計算（高値-安値の平均）
 * @param candles ローソク足データ
 * @param period 期間
 * @returns 簡易計算のATR値
 */
function calculateSimplifiedATR(candles: Candle[], period: number): number {
  const recentCandles = candles.slice(-period);
  let totalRange = 0;

  for (const candle of recentCandles) {
    totalRange += candle.high - candle.low;
  }

  return totalRange / period;
}

/**
 * ATRが計算不能または極小値の場合のフォールバック値
 * @param candles ローソク足データ
 * @param strategyName 戦略名（ログ用）
 * @returns フォールバックATR値
 */
export function getFallbackATR(candles: Candle[], strategyName: string = 'Strategy'): number {
  // 現在価格が取得できない場合（データなし）
  if (candles.length === 0) {
    logger.error(`[${strategyName}] フォールバックATR計算に必要なローソク足データがありません`);
    return 0;
  }

  // 現在価格のデフォルトパーセンテージをATRとして使用
  const currentPrice = candles[candles.length - 1].close;
  const fallbackAtr = currentPrice * DEFAULT_ATR_PERCENTAGE;

  logger.warn(
    `[${strategyName}] ATR値が0または非常に小さいため、フォールバック値を使用: ${fallbackAtr.toFixed(6)} (${DEFAULT_ATR_PERCENTAGE * 100}%)`
  );
  return fallbackAtr;
}

/**
 * ATR値が極小かどうかをチェック
 * @param atrValue ATR値
 * @param candles ローソク足データ
 * @returns true: 極小またはゼロ, false: 正常
 */
export function isATRTooSmall(atrValue: number, candles: Candle[]): boolean {
  if (candles.length === 0) return true;

  const currentPrice = candles[candles.length - 1].close;
  return atrValue === 0 || atrValue < currentPrice * MIN_ATR_VALUE;
}

/**
 * ストップ距離が極小の場合にフォールバック値を提供
 * @param price 現在価格
 * @param stopDistance 計算されたストップ距離
 * @param strategyName 戦略名（ログ用）
 * @returns 適切なストップ距離（極小の場合はフォールバック値）
 */
export function getValidStopDistance(
  price: number,
  stopDistance: number,
  strategyName: string = 'Strategy'
): number {
  // ストップ距離が非常に小さい、あるいは0の場合のフォールバック
  if (stopDistance < price * MIN_STOP_DISTANCE_PERCENTAGE) {
    const fallbackDistance = price * MIN_STOP_DISTANCE_PERCENTAGE;
    logger.warn(
      `[${strategyName}] ストップ距離が極小値のため、フォールバック値を使用: ${fallbackDistance.toFixed(6)} (${MIN_STOP_DISTANCE_PERCENTAGE * 100}%)`
    );
    return fallbackDistance;
  }

  return stopDistance;
}

/**
 * ATR（Average True Range）に関連するユーティリティ関数
 */

/**
 * 直近の価格変動が有意か判定する
 * @param current 現在価格
 * @param previous 前回価格
 * @param atr ATR値
 * @param multiplier 倍率（デフォルト: 2.0）
 * @returns 有意な変動があればtrue
 */
export function checkSignificantPriceChange(
  current: number,
  previous: number,
  atr: number,
  multiplier: number = 2.0
): boolean {
  const change = Math.abs(current - previous);
  return change > atr * multiplier;
}

/**
 * 価格のボラティリティを計算する
 * @param candles キャンドルデータ配列
 * @param period 期間（デフォルト: 14）
 * @returns ボラティリティ値（ATR）
 */
export function calculateVolatility(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) {
    return 0;
  }

  // ATRの計算
  let atrSum = 0;
  
  for (let i = 1; i <= period; i++) {
    const current = candles[candles.length - i];
    const previous = candles[candles.length - i - 1];
    
    // True Rangeの計算
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
    
    atrSum += tr;
  }
  
  return atrSum / period;
}

/**
 * ATRに基づくストップロス価格を計算
 * @param price 現在価格
 * @param atr ATR値
 * @param multiplier 倍率（デフォルト: 2.0）
 * @param side 取引サイド ('buy' または 'sell')
 * @returns ストップロス価格
 */
export function calculateATRStopLoss(
  price: number,
  atr: number,
  multiplier: number = 2.0,
  side: 'buy' | 'sell'
): number {
  if (side === 'buy') {
    return price - (atr * multiplier);
  } else {
    return price + (atr * multiplier);
  }
}
