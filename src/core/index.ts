/**
 * coreモジュールのTypeScriptエントリポイント
 * 
 * TST-051: テスト環境のビルド出力問題解決の一部
 */

import { TradingEngine } from './tradingEngine';
import { BacktestRunner } from './backtestRunner';
import { OrderManagementSystem } from './orderManagementSystem';
import * as Types from './types';

// メインエクスポート
export {
  TradingEngine,
  BacktestRunner,
  OrderManagementSystem,
  Types
};

// デフォルトエクスポート
export default {
  TradingEngine,
  BacktestRunner,
  OrderManagementSystem,
  Types
}; 