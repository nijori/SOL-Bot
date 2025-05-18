/**
 * ESMエントリポイント - ES Modules形式でライブラリをエクスポート
 * 
 * REF-033: ESMとCommonJSの共存基盤構築の一部
 */

// コアモジュールの直接インポート
export { TradingEngine, createTradingEngine } from './core/tradingEngine.js';
export { BacktestRunner, runBacktest } from './core/backtestRunner.js';
export { OrderManagementSystem } from './core/orderManagementSystem.js';
export * from './core/types.js';

// 戦略モジュールのエクスポート
export { TrendFollowStrategy } from './strategies/trendFollowStrategy.js';
export { MeanReversionStrategy } from './strategies/meanReversionStrategy.js';
export { DonchianBreakoutStrategy } from './strategies/donchianBreakoutStrategy.js';

// 設定モジュールのエクスポート
export { default as parameterService } from './config/parameterService.js';
export * from './config/parameters.js';

// サービスモジュールのエクスポート
export { ExchangeService, createExchangeService } from './services/exchangeService.js';

// ユーティリティモジュールのエクスポート
export { default as logger } from './utils/logger.js';
export * from './utils/atrUtils.js';
export * from './utils/positionSizing.js';
export { default as metrics } from './utils/metrics.js';
export { CliParser } from './utils/cliParser.js';

// データ関連モジュールのエクスポート
export { DataService } from './data/dataService.js';
export { MultiTimeframeDataFetcher } from './data/multiTimeframeDataFetcher.js';

// インジケーター関連モジュールのエクスポート
export * from './indicators/trendIndicators.js';
export * from './indicators/volatilityIndicators.js';

// グループ化されたエクスポート
export const core = {
  TradingEngine'./core/tradingEngine.js',
  BacktestRunner'./core/backtestRunner.js',
  OrderManagementSystem'./core/orderManagementSystem.js',
  types'./core/types.js'
};

export const strategies = {
  TrendFollowStrategy'./strategies/trendFollowStrategy.js',
  MeanReversionStrategy'./strategies/meanReversionStrategy.js',
  DonchianBreakoutStrategy'./strategies/donchianBreakoutStrategy.js'
};

export const services = {
  ExchangeService'./services/exchangeService.js'
};

export const utils = {
  logger'./utils/logger.js',
  atrUtils'./utils/atrUtils.js',
  positionSizing'./utils/positionSizing.js',
  metrics'./utils/metrics.js',
  cliParser'./utils/cliParser.js'
};

export const data = {
  DataService'./data/dataService.js',
  MultiTimeframeDataFetcher'./data/multiTimeframeDataFetcher.js'
};

export const indicators = {
  trendIndicators'./indicators/trendIndicators.js',
  volatilityIndicators'./indicators/volatilityIndicators.js'
};

// ESMからCommonJSモジュールをロードするヘルパー
export { require, __filename, __dirname, resolveDir, resolveFilePath, isESMEnvironment, isMainModule } from './utils/esm-compat.mjs'; 