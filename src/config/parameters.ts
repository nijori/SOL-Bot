/**
 * トレーディングパラメータ設定
 *
 * このファイルは下位互換性のために保持されています。
 * 実際のパラメータ設定はparameters.yamlとparameterService.tsで管理されています。
 */

// @ts-nocheck
// CommonJS対応
require('dotenv/config');
const { parameterService } = require('./parameterService');

// 相場環境判定用パラメータ
const MARKET_PARAMETERS = parameterService.getMarketParameters();

// トレンド戦略用パラメータ
const TREND_PARAMETERS = parameterService.getTrendParameters();

// レンジ戦略用パラメータ
const RANGE_PARAMETERS = parameterService.getRangeParameters();

// リスク管理パラメータ
const RISK_PARAMETERS = parameterService.getRiskParameters();

// ログと監視パラメータ
const MONITORING_PARAMETERS = parameterService.getMonitoringParameters();

// バックテストパラメータ
const BACKTEST_PARAMETERS = parameterService.getBacktestParameters();

// モード設定
const OperationMode = {
  LIVE: 'live',
  SIMULATION: 'simulation',
  BACKTEST: 'backtest'
};

const OPERATION_MODE =
  parameterService.getOperationMode() || OperationMode.SIMULATION;

// すべてのパラメータを1つのオブジェクトとして取得するヘルパー関数
const getAllParameters = () => parameterService.getAllParameters();

// CommonJS形式でエクスポート
module.exports = {
  MARKET_PARAMETERS,
  TREND_PARAMETERS,
  RANGE_PARAMETERS,
  RISK_PARAMETERS,
  MONITORING_PARAMETERS,
  BACKTEST_PARAMETERS,
  OperationMode,
  OPERATION_MODE,
  getAllParameters
};
