/**
 * ポジションサイジングユーティリティ
 * 戦略間で共通のポジションサイジングロジックを提供
 * INF-032: CommonJS形式への変換
 */
// @ts-nocheck
// 循環参照を避けるため、型チェックを一時的に無効化

// モジュールの依存関係をrequireスタイルで読み込み
const moduleHelperRef = require('./moduleHelper');
const loggerRef = moduleHelperRef.hasModule('logger') 
  ? moduleHelperRef.getModule('logger') 
  : require('./logger').default;

// ParameterServiceをrequireで読み込み
const ParameterServiceRef = require('../config/parameterService').ParameterService;

// パラメータサービスのインスタンスを取得
const parameterService = ParameterServiceRef.getInstance();

// リスク関連のパラメータを取得
const MAX_RISK_PER_TRADE = parameterService.get('risk.max_risk_per_trade', 0.01);
const MIN_STOP_DISTANCE_PERCENTAGE = parameterService.get(
  'risk.minStopDistancePercentage',
  0.01
);
const MAX_POSITION_PERCENTAGE = parameterService.get(
  'riskManagement.maxPositionSize',
  0.35
);

/**
 * リスクに基づいたポジションサイズを計算
 * @param {number} accountBalance 口座残高
 * @param {number} entryPrice エントリー価格
 * @param {number} stopPrice ストップ価格
 * @param {number} [riskPercentage=MAX_RISK_PER_TRADE] リスク割合
 * @param {string} [strategyName='Strategy'] 戦略名（ログ出力用）
 * @returns {number} 適切なポジションサイズ
 */
function calculateRiskBasedPositionSize(
  accountBalance,
  entryPrice,
  stopPrice,
  riskPercentage = MAX_RISK_PER_TRADE,
  strategyName = 'Strategy'
) {
  // ストップ距離を計算
  let stopDistance = Math.abs(entryPrice - stopPrice);

  // ストップ距離が非常に小さい、あるいは0の場合のフォールバック
  if (stopDistance < entryPrice * 0.001) {
    loggerRef.warn(
      `[${strategyName}] ストップ距離が非常に小さいため、フォールバック値を使用: 元の値=`,
      stopDistance
    );
    // 最小ストップ距離としてパラメータから値を取得
    stopDistance = entryPrice * MIN_STOP_DISTANCE_PERCENTAGE;
    loggerRef.info(
      `[${strategyName}] フォールバックストップ距離: ${stopDistance} (${MIN_STOP_DISTANCE_PERCENTAGE * 100}%)`
    );
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

// モジュールとしてエクスポート
const positionSizing = {
  calculateRiskBasedPositionSize,
  MAX_RISK_PER_TRADE,
  MIN_STOP_DISTANCE_PERCENTAGE,
  MAX_POSITION_PERCENTAGE
};

// モジュールレジストリに登録
moduleHelperRef.registerModule('positionSizing', positionSizing);

// CommonJS形式でエクスポート
module.exports = positionSizing;
