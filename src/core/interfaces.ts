/**
 * アプリケーション全体で使用する型定義（インターフェースのみ）
 * INF-032: CommonJS形式への変換
 * 
 * このファイルは純粋な型定義のみを提供し、実行時の値は含みません。
 */

// ローソク足データの型
export interface Candle {
  timestamp: number | string; // ISO文字列またはUNIXタイムスタンプ（ミリ秒）
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 取引所から取得した市場データの型
export interface MarketData {
  symbol: string;
  timeframe: string;
  candles: Candle[];
}

// 注文情報の型
export interface Order {
  id?: string; // システム内部の注文ID
  exchangeOrderId?: string; // 取引所から返された注文ID
  symbol: string; // 取引ペア
  type: string; // 注文タイプ
  side: string; // 買い/売り
  price?: number | undefined; // 価格（成行注文の場合はundefined）
  // 指値注文では必須、成行注文では省略またはundefined
  // ccxt互換性のため、null値は使用せずundefinedのみ使用する
  amount: number; // 数量
  status?: string; // 注文ステータス
  timestamp?: number; // タイムスタンプ
  stopPrice?: number; // ストップ価格（ストップ注文の場合）
}

// ポジション情報の型
export interface Position {
  symbol: string;
  side: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  timestamp: number;
  stopPrice?: number; // ストップ価格（オプショナル）
}

// 約定情報の型
export interface Fill {
  orderId?: string;
  exchangeOrderId?: string;
  symbol: string;
  side: string;
  amount: number;
  price: number;
  timestamp: number;
}

// 口座情報の型
export interface Account {
  balance: number;
  available: number;
  positions: Position[];
  dailyPnl: number;
  dailyPnlPercentage: number;
}

// 戦略の実行結果
export interface StrategyResult {
  strategy: string;
  signals: Order[];
  timestamp: number;
  error?: string; // エラーメッセージ（オプショナル）
  metadata?: any; // メタデータ（オプショナル）
}

// 市場分析の結果
export interface MarketAnalysisResult {
  environment: string;
  recommendedStrategy: string;
  indicators: Record<string, any>;
  timestamp: number;
}

// パフォーマンス指標
export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalReturn: number;
  annualizedReturn: number;
}

/**
 * 戦略からの売買シグナル
 */
export interface Signal {
  id: string;
  symbol: string;
  side: string;
  type: string;
  price?: number;
  amount: number;
  stopLoss?: number;
  takeProfit?: number;
}

/**
 * バックテスト設定
 */
export interface BacktestConfig {
  symbol: string;
  startDate: string;
  endDate: string;
  timeframeHours: number;
  initialBalance: number;
  slippage?: number;
  commissionRate?: number;
  isSmokeTest?: boolean;
  quiet?: boolean;
  batchSize?: number;
  memoryMonitoring?: boolean;
  gcInterval?: number;
  parameters?: Record<string, any>;
}

/**
 * バックテスト結果
 */
export interface BacktestResult {
  symbol: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  totalReturnPercentage: number;
  trades: any[];
  equityHistory: any[];
  metrics: PerformanceMetrics;
  executionTime: number;
  memoryUsage?: any;
}