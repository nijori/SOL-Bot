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
 */
export interface MultiSymbolBacktestConfig {
  symbols: string[]; // 複数シンボル
  timeframeHours: number | number[]; // 単一または複数のタイムフレーム
  startDate: string; // 開始日
  endDate: string; // 終了日
  initialBalance: number; // 初期残高
  allocationStrategy?: AllocationStrategy; // 資金配分戦略
  symbolParams?: Record<string, Partial<BacktestConfig>>; // シンボル固有の設定
  parameters?: Record<string, any>; // 共通パラメータ
  correlationAnalysis?: boolean; // 相関分析を行うかどうか
  isSmokeTest?: boolean; // スモークテスト
  slippage?: number; // スリッページ
  commissionRate?: number; // 取引手数料率
  quiet?: boolean; // ログ出力を抑制するモード
  batchSize?: number; // データ処理バッチサイズ
  memoryMonitoring?: boolean; // メモリ監視を有効にするか
  gcInterval?: number; // ガベージコレクション実行間隔（キャンドル数）
  parallelLimit?: number; // 並列実行数の上限 (BT-008)
  saveResults?: boolean; // 結果をファイルに保存するかどうか (BT-008)
  name?: string; // バックテスト設定の名前 (保存時のファイル名に使用)
  customWeights?: Record<string, number>; // カスタム配分の重み (AllocationStrategy.CUSTOMで使用)
}

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
 * カスタム資金配分の設定
 */
export interface AllocationWeights {
  strategy: AllocationStrategy;
  weights?: Record<string, number>; // シンボルごとの配分比率
}

/**
 * 実行統計情報
 */
export interface ExecutionStats {
  totalDuration: number; // 合計実行時間 (ms)
  memoryPeaks: MemoryPeaks; // メモリ使用量のピーク値
  memoryDelta: {
    // メモリ使用量の増加分
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  correlationMatrix?: Record<string, Record<string, number>>; // シンボル間の相関行列
}

/**
 * エクイティ履歴ポイント
 */
export interface EquityPoint {
  timestamp: number; // タイムスタンプ
  bySymbol: Record<string, number>; // シンボルごとのエクイティ
  total: number; // 合計エクイティ
}

/**
 * マルチシンボルバックテスト結果
 */
export interface MultiSymbolBacktestResult {
  symbolResults: Record<string, BacktestResult>; // シンボルごとのバックテスト結果
  combinedMetrics: {
    // 統合された指標
    totalTrades: number; // 総取引数
    winningTrades: number; // 勝ちトレード数
    losingTrades: number; // 負けトレード数
    winRate: number; // 勝率
    maxDrawdown: number; // 最大ドローダウン
    sharpeRatio: number; // シャープレシオ
    totalReturn: number; // 総リターン
    totalProfit: number; // 総利益
    initialTotal: number; // 初期残高合計
    finalTotal: number; // 最終残高合計
  };
  allEquityPoints: EquityPoint[]; // 全エクイティポイント履歴
  totalEquity: number; // 総エクイティ
  executionStats: ExecutionStats; // 実行統計情報
}

/**
 * マルチシンボルトレーディングエンジン設定
 */
export interface MultiSymbolEngineConfig {
  symbols: string[];
  timeframeHours: number | number[];
  allocationStrategy?: AllocationStrategy;
  symbolParams?: Record<string, any>;
  portfolioRiskLimit?: number; // ポートフォリオ全体のリスク上限
  correlationLimit?: number; // 相関係数の上限（リスク分散）
}

/**
 * ポートフォリオリスク分析の結果
 */
export interface PortfolioRiskAnalysis {
  valueAtRisk: number; // VaR (Value at Risk)
  expectedShortfall: number; // 期待ショートフォール
  concentrationRisk: number; // 集中リスク
  correlationRisk: number; // 相関リスク
  stressTestResults: {
    // ストレステスト
    scenario: string;
    impact: number;
  }[];
}

// CommonJS エクスポート
module.exports = {
  AllocationStrategy
};

// TypeScript用のESモジュールエクスポート（互換性のため）
export { AllocationStrategy };
