/**
 * ポジションサイジングユーティリティ
 * 戦略間で共通のポジションサイジングロジックを提供
 */

import logger from './logger';
import { ParameterService } from '../config/parameterService';

// パラメータサービスのインスタンスを取得
const parameterService = ParameterService.getInstance();

// リスク関連のパラメータを取得
const MAX_RISK_PER_TRADE = parameterService.get<number>('risk.max_risk_per_trade', 0.01);
const MIN_STOP_DISTANCE_PERCENTAGE = parameterService.get<number>('risk.minStopDistancePercentage', 0.01);
const MAX_POSITION_PERCENTAGE = parameterService.get<number>('riskManagement.maxPositionSize', 0.35);

/**
 * リスクに基づいたポジションサイズを計算
 * @param accountBalance 口座残高
 * @param entryPrice エントリー価格
 * @param stopPrice ストップ価格
 * @param riskPercentage リスク割合（デフォルト:MAX_RISK_PER_TRADEから取得）
 * @param strategyName 戦略名（ログ出力用）
 * @returns 適切なポジションサイズ
 */
export function calculateRiskBasedPositionSize(
  accountBalance: number,
  entryPrice: number,
  stopPrice: number,
  riskPercentage: number = MAX_RISK_PER_TRADE,
  strategyName: string = 'Strategy'
): number {
  // ストップ距離を計算
  let stopDistance = Math.abs(entryPrice - stopPrice);
  
  // ストップ距離が非常に小さい、あるいは0の場合のフォールバック
  if (stopDistance < entryPrice * 0.001) {
    logger.warn(`[${strategyName}] ストップ距離が非常に小さいため、フォールバック値を使用: 元の値=`, stopDistance);
    // 最小ストップ距離としてパラメータから値を取得
    stopDistance = entryPrice * MIN_STOP_DISTANCE_PERCENTAGE;
    logger.info(`[${strategyName}] フォールバックストップ距離: ${stopDistance} (${MIN_STOP_DISTANCE_PERCENTAGE * 100}%)`);
  }
  
  // リスク許容額を計算
  const riskAmount = accountBalance * riskPercentage;
  
  // ポジションサイズを計算 = リスク許容額 / ストップ距離
  const positionSize = riskAmount / stopDistance;
  
  // 過度に大きいポジションを制限（口座の最大設定値以上は取らない）
  const maxPositionValue = accountBalance * MAX_POSITION_PERCENTAGE;
  const positionValue = positionSize * entryPrice;
  
  if (positionValue > maxPositionValue) {
    return maxPositionValue / entryPrice;
  }
  
  return positionSize;
} 