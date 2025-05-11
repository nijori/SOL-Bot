/**
 * トレーディングパラメータ設定
 *
 * このファイルは下位互換性のために保持されています。
 * 実際のパラメータ設定はparameters.yamlとparameterService.tsで管理されています。
 */

import 'dotenv/config';
import { parameterService } from './parameterService';

// 相場環境判定用パラメータ
export const MARKET_PARAMETERS = parameterService.getMarketParameters();

// トレンド戦略用パラメータ
export const TREND_PARAMETERS = parameterService.getTrendParameters();

// レンジ戦略用パラメータ
export const RANGE_PARAMETERS = parameterService.getRangeParameters();

// リスク管理パラメータ
export const RISK_PARAMETERS = parameterService.getRiskParameters();

// ログと監視パラメータ
export const MONITORING_PARAMETERS = parameterService.getMonitoringParameters();

// バックテストパラメータ
export const BACKTEST_PARAMETERS = parameterService.getBacktestParameters();

// モード設定
export enum OperationMode {
  LIVE = 'live',
  SIMULATION = 'simulation',
  BACKTEST = 'backtest'
}

export const OPERATION_MODE =
  (parameterService.getOperationMode() as OperationMode) || OperationMode.SIMULATION;

// すべてのパラメータを1つのオブジェクトとして取得するヘルパー関数
export const getAllParameters = () => parameterService.getAllParameters();
