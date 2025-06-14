/**
 * マルチシンボル対応の型定義ファイル
 * CORE-005: backtestRunnerとtradingEngineのマルチシンボル対応拡張
 * BT-008: MultiSymbolBacktestRunner並列化
 */

import type { BacktestConfig, BacktestResult } from '../core/interfaces';
import type { MemoryPeaks } from '../utils/memoryMonitor';

/**
 * シンボル間の資金配分戦略
 */
export declare const AllocationStrategy: {
  readonly EQUAL: 'EQUAL';
  readonly MARKET_CAP: 'MARKET_CAP'; 
  readonly VOLATILITY: 'VOLATILITY';
  readonly CUSTOM: 'CUSTOM';
};

export type AllocationStrategyType = typeof AllocationStrategy[keyof typeof AllocationStrategy];

/**
 * マルチシンボルバックテスト設定
 */
export interface MultiSymbolBacktestConfig {
  symbols: string[];
  startDate: string;
  endDate: string;
  timeframeHours: number;
  initialBalance: number;
  allocationStrategy: AllocationStrategyType;
  weights?: Record<string, number>; // CUSTOM戦略の場合の重み
  slippage?: number;
  commissionRate?: number;
  isSmokeTest?: boolean;
  quiet?: boolean;
  batchSize?: number;
  memoryMonitoring?: boolean;
  gcInterval?: number;
  parallelization?: boolean;
  maxWorkers?: number;
}

/**
 * シンボル別バックテスト結果
 */
export interface SymbolBacktestResult extends BacktestResult {
  symbol: string;
  allocation: number; // 配分された資金額
  allocationPercentage: number; // 配分率
  symbolSpecificMetrics?: Record<string, any>;
}

/**
 * マルチシンボルバックテスト結果
 */
export interface MultiSymbolBacktestResult {
  symbols: string[];
  startDate: string;
  endDate: string;
  totalInitialBalance: number;
  totalFinalBalance: number;
  totalReturn: number;
  totalReturnPercentage: number;
  allocationStrategy: AllocationStrategyType;
  symbolResults: SymbolBacktestResult[];
  aggregatedMetrics: {
    totalTrades: number;
    totalWinningTrades: number;
    totalLosingTrades: number;
    overallWinRate: number;
    portfolioSharpeRatio: number;
    portfolioMaxDrawdown: number;
    correlationMatrix?: Record<string, Record<string, number>>;
  };
  executionTime: number;
  memoryUsage?: MemoryPeaks;
  parallelization?: {
    enabled: boolean;
    workersUsed: number;
    averageWorkerTime: number;
  };
}

/**
 * ポートフォリオ統計
 */
export interface PortfolioStatistics {
  totalValue: number;
  totalPnl: number;
  totalPnlPercentage: number;
  symbolBreakdown: Array<{
    symbol: string;
    value: number;
    pnl: number;
    pnlPercentage: number;
    allocation: number;
  }>;
  riskMetrics: {
    portfolioVolatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    var95: number; // Value at Risk (95%)
  };
}