/**
 * アプリケーション全体で使用する型定義
 */

// ローソク足データの型
export interface Candle {
  timestamp: number;
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

// 市場環境の種類
export enum MarketEnvironment {
  UPTREND = 'uptrend',
  DOWNTREND = 'downtrend',
  STRONG_UPTREND = 'strong_uptrend',
  STRONG_DOWNTREND = 'strong_downtrend',
  WEAK_UPTREND = 'weak_uptrend',
  WEAK_DOWNTREND = 'weak_downtrend',
  RANGE = 'range',
  UNKNOWN = 'unknown',
}

// 取引戦略の種類
export enum StrategyType {
  TREND_FOLLOWING = 'trend_following',
  RANGE_TRADING = 'range_trading',
  EMERGENCY = 'emergency',
}

// 注文のタイプ
export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP = 'stop',
  STOP_LIMIT = 'stop_limit',
}

// 注文の方向
export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

// 注文のステータス
export enum OrderStatus {
  OPEN = 'open',
  FILLED = 'filled',
  CANCELED = 'canceled',
  REJECTED = 'rejected',
}

// 注文情報の型
export interface Order {
  id?: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  price?: number;
  amount: number;
  status?: OrderStatus;
  timestamp?: number;
  stopPrice?: number;
}

// ポジション情報の型
export interface Position {
  symbol: string;
  side: OrderSide;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
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
  strategy: StrategyType;
  signals: Order[];
  timestamp: number;
}

// 市場分析の結果
export interface MarketAnalysisResult {
  environment: MarketEnvironment;
  recommendedStrategy: StrategyType;
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