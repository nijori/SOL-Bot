/**
 * index.mjs
 * SOL-Bot ESM エントリポイント
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

// コアモジュールの直接インポート
export { TradingEngine, createTradingEngine } from './core/tradingEngine.js';
export { BacktestRunner, runBacktest } from './core/backtestRunner.js';
export { OrderManagementSystem } from './core/orderManagementSystem.js';
export * from './core/types.js';

// 戦略モジュールの直接インポート
export { TrendFollowStrategy } from './strategies/trendFollowStrategy.js';
export { MeanReversionStrategy } from './strategies/meanReversionStrategy.js';
export { DonchianBreakoutStrategy } from './strategies/DonchianBreakoutStrategy.js';

// ユーティリティモジュールの直接インポート
export * from './utils/atrUtils.js';
export * from './utils/positionSizing.js';
export * from './utils/logger.js';

// サービスモジュールの直接インポート
export { ExchangeService } from './services/exchangeService.js';

// グループ化されたエクスポート
export const strategies = {
  TrendFollowStrategy: './strategies/trendFollowStrategy.js',
  MeanReversionStrategy: './strategies/meanReversionStrategy.js',
  DonchianBreakoutStrategy: './strategies/DonchianBreakoutStrategy.js'
};

export const utils = {
  atrUtils: './utils/atrUtils.js',
  positionSizing: './utils/positionSizing.js',
  logger: './utils/logger.js'
};

export const services = {
  exchangeService: './services/exchangeService.js'
};

/**
 * ESMからCommonJSモジュールをロードするヘルパー
 */
export { require, __filename, __dirname, importCJS } from './utils/esm-compat.mjs';

// デフォルトエクスポート
export default {
  core: {
    TradingEngine: './core/tradingEngine.js',
    BacktestRunner: './core/backtestRunner.js',
    OrderManagementSystem: './core/orderManagementSystem.js'
  },
  strategies,
  utils,
  services
}; 