/**
 * マルチシンボル対応の型定義
 * CORE-005: backtestRunnerとtradingEngineのマルチシンボル対応拡張
 * BT-008: MultiSymbolBacktestRunner並列化
 */

// @ts-nocheck
// CommonJS移行中のため一時的にTypeScriptチェックを無効化

// CommonJS インポート
const { BacktestConfig, BacktestResult } = require('../core/backtestRunner');
const { MemoryPeaks } = require('../utils/memoryMonitor');

/**
 * マルチシンボルバックテスト設定
 * CommonJS環境では型定義は削除
 */

/**
 * シンボル間の資金配分戦略
 */
const AllocationStrategy = {
  EQUAL: 'EQUAL', // 均等配分
  MARKET_CAP: 'MARKET_CAP', // 時価総額比例配分
  VOLATILITY: 'VOLATILITY', // ボラティリティ逆比例配分
  CUSTOM: 'CUSTOM' // カスタム配分（weights指定）
};

/**
 * CommonJS環境では型定義は削除
 * 実行時に必要な定数のみ保持
 */

// CommonJS エクスポート
module.exports = {
  AllocationStrategy
};
