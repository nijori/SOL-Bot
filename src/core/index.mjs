/**
 * coreモジュールのESMエントリポイント
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

// コアモジュールのエクスポート
export { TradingEngine, createTradingEngine } from './tradingEngine.js';
export { BacktestRunner, runBacktest } from './backtestRunner.js';
export { OrderManagementSystem } from './orderManagementSystem.js';
export * from './types.js';

// ESMからCommonJSモジュールをロードするヘルパー
export { require, __filename, __dirname } from '../utils/esm-compat.mjs';

// デフォルトエクスポート
export default {
  TradingEngine'./tradingEngine.js',
  BacktestRunner'./backtestRunner.js',
  OrderManagementSystem'./orderManagementSystem.js',
  types'./types.js'
}; 