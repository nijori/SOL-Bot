/**
 * 拡張バックテスト型定義
 * core/multiSymbolBacktestRunnerで使用される追加プロパティを定義
 */

import { BacktestResult as OriginalBacktestResult } from '../core/backtestRunner.js';

/**
 * 拡張されたバックテスト結果インターフェース
 */
export interface ExtendedBacktestResult extends OriginalBacktestResult {
  // 既存のmetricsに追加のプロパティを拡張
  metrics: OriginalBacktestResult['metrics'] & {
    winningTrades: number;
    losingTrades: number;
  };
  // 追加プロパティ
  initialBalance: number;
  equityHistory: number[];
}

/**
 * 型変換ヘルパー関数 - 標準のBacktestResultを拡張型に変換
 */
export function toExtendedBacktestResult(
  result: OriginalBacktestResult,
  initialBalance: number
): ExtendedBacktestResult {
  // ウィニングトレードと負けトレードを計算
  // TST-070: profit属性がない場合はpnl属性を使用
  const winningTrades = result.trades.filter((trade: any) => {
    // tradeにprofit属性があればそれを使用、なければpnl属性を使用
    const profitValue = 'profit' in trade ? trade.profit : ('pnl' in trade ? trade.pnl : 0);
    return profitValue > 0;
  }).length;
  
  const losingTrades = result.trades.filter((trade: any) => {
    // tradeにprofit属性があればそれを使用、なければpnl属性を使用
    const profitValue = 'profit' in trade ? trade.profit : ('pnl' in trade ? trade.pnl : 0);
    return profitValue <= 0;
  }).length;
  
  // エクイティヒストリーの数値配列を構築
  const equityHistory = result.equity.map((point: any) => point.equity);
  
  return {
    ...result,
    metrics: {
      ...result.metrics,
      winningTrades,
      losingTrades
    },
    initialBalance,
    equityHistory
  };
} 