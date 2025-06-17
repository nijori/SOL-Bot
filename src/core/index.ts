/**
 * coreモジュールのTypeScriptエントリポイント
 * 
 * TST-051: テスト環境のビルド出力問題解決の一部
 * INF-032: CommonJS形式への変換
 */

// CommonJSスタイルのrequire
const { TradingEngine } = require('./tradingEngine');
const { BacktestRunner } = require('./backtestRunner');
const { OrderManagementSystem } = require('./orderManagementSystem');
const Types = require('./types');

// 型定義のためのエクスポート（TypeScript用）
export {
  TradingEngine,
  BacktestRunner,
  OrderManagementSystem,
  Types
};

// CommonJSスタイルのエクスポート
module.exports = {
  TradingEngine,
  BacktestRunner,
  OrderManagementSystem,
  Types
}; 