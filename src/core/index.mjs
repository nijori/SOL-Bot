/**
 * core/index.mjs
 * SOL-Bot コアモジュール ESM エントリポイント
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

// コアモジュールの直接インポートとエクスポート
export { TradingEngine, createTradingEngine } from './tradingEngine.js';
export { BacktestRunner, runBacktest } from './backtestRunner.js';
export { OrderManagementSystem } from './orderManagementSystem.js';
export * from './types.js';
export { MultiSymbolTradingEngine } from './multiSymbolTradingEngine.js';
export { MultiSymbolBacktestRunner } from './multiSymbolBacktestRunner.js';

// 便利なグループ化エクスポート
export const core = {
  TradingEngine: './tradingEngine.js',
  BacktestRunner: './backtestRunner.js',
  OrderManagementSystem: './orderManagementSystem.js',
  MultiSymbolTradingEngine: './multiSymbolTradingEngine.js',
  MultiSymbolBacktestRunner: './multiSymbolBacktestRunner.js'
};

// デフォルトエクスポート
export default {
  core
}; 