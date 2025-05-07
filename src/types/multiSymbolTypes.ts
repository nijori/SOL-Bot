/**
 * マルチシンボル対応の型定義
 * CORE-005: backtestRunnerとtradingEngineのマルチシンボル対応拡張
 */

import { BacktestConfig, BacktestResult } from '../core/backtestRunner';

/**
 * マルチシンボルバックテスト設定
 */
export interface MultiSymbolBacktestConfig {
  symbols: string[];                           // 複数シンボル
  timeframeHours: number | number[];           // 単一または複数のタイムフレーム
  startDate: string;                           // 開始日
  endDate: string;                             // 終了日
  initialBalance: number;                      // 初期残高
  allocationStrategy?: AllocationStrategy;     // 資金配分戦略
  symbolParams?: Record<string, Partial<BacktestConfig>>; // シンボル固有の設定
  parameters?: Record<string, any>;            // 共通パラメータ
  correlationAnalysis?: boolean;               // 相関分析を行うかどうか
  isSmokeTest?: boolean;                       // スモークテスト
  slippage?: number;                           // スリッページ
  commissionRate?: number;                     // 取引手数料率
  quiet?: boolean;                             // ログ出力を抑制するモード
  batchSize?: number;                          // データ処理バッチサイズ
  memoryMonitoring?: boolean;                  // メモリ監視を有効にするか
  gcInterval?: number;                         // ガベージコレクション実行間隔（キャンドル数）
}

/**
 * シンボル間の資金配分戦略
 */
export enum AllocationStrategy {
  EQUAL = 'EQUAL',               // 均等配分
  MARKET_CAP = 'MARKET_CAP',     // 時価総額比例配分
  VOLATILITY = 'VOLATILITY',     // ボラティリティ逆比例配分
  CUSTOM = 'CUSTOM'              // カスタム配分（weights指定）
}

/**
 * カスタム資金配分の設定
 */
export interface AllocationWeights {
  strategy: AllocationStrategy;
  weights?: Record<string, number>; // シンボルごとの配分比率
}

/**
 * マルチシンボルバックテスト結果
 */
export interface MultiSymbolBacktestResult {
  symbolResults: Record<string, BacktestResult>;   // シンボルごとのバックテスト結果
  portfolioMetrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    calmarRatio: number;
    sortinoRatio: number;
    correlationMatrix?: Record<string, Record<string, number>>; // シンボル間の相関行列
  };
  equity: {
    timestamp: string;
    equity: number;
    symbolEquity: Record<string, number>; // シンボルごとの資産推移
  }[];
  allocationStrategy: AllocationStrategy;
  parameters: Record<string, any>;
}

/**
 * マルチシンボルトレーディングエンジン設定
 */
export interface MultiSymbolEngineConfig {
  symbols: string[];
  timeframeHours: number | number[];
  allocationStrategy?: AllocationStrategy;
  symbolParams?: Record<string, any>;
  portfolioRiskLimit?: number;   // ポートフォリオ全体のリスク上限
  correlationLimit?: number;     // 相関係数の上限（リスク分散）
}

/**
 * ポートフォリオリスク分析の結果
 */
export interface PortfolioRiskAnalysis {
  valueAtRisk: number;           // VaR (Value at Risk)
  expectedShortfall: number;     // 期待ショートフォール
  concentrationRisk: number;     // 集中リスク
  correlationRisk: number;       // 相関リスク
  stressTestResults: {           // ストレステスト
    scenario: string;
    impact: number;
  }[];
} 