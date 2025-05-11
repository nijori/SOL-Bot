/**
 * アプリケーション全体で使用する型定義
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

// タイムスタンプの型ガード関数
export function isNumericTimestamp(timestamp: number | string): timestamp is number {
  return typeof timestamp === 'number';
}

// ISO文字列タイムスタンプをミリ秒数値に変換する関数
export function normalizeTimestamp(timestamp: number | string): number {
  if (isNumericTimestamp(timestamp)) {
    return timestamp;
  }
  // ISO文字列からDateオブジェクトを生成し、ミリ秒タイムスタンプに変換
  return new Date(timestamp).getTime();
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
  UNKNOWN = 'unknown'
}

// 取引戦略の種類
export enum StrategyType {
  TREND_FOLLOWING = 'trend_following',
  RANGE_TRADING = 'range_trading',
  MEAN_REVERT = 'mean_revert',
  EMERGENCY = 'emergency',
  DONCHIAN_BREAKOUT = 'donchian_breakout'
}

// 注文のタイプ
export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP = 'stop',
  STOP_LIMIT = 'stop_limit',
  STOP_MARKET = 'stop_market'
}

// 注文の方向
export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell'
}

// 注文のステータス
export enum OrderStatus {
  OPEN = 'open', // システム内で作成された注文（取引所送信前）
  PLACED = 'placed', // 取引所に送信され受け付けられた注文
  FILLED = 'filled', // 約定済みの注文
  CANCELED = 'canceled', // キャンセルされた注文
  REJECTED = 'rejected' // 拒否された注文
}

// 注文情報の型
export interface Order {
  id?: string; // システム内部の注文ID
  exchangeOrderId?: string; // 取引所から返された注文ID
  symbol: string; // 取引ペア
  type: OrderType; // 注文タイプ
  side: OrderSide; // 買い/売り
  price?: number | undefined; // 価格（成行注文の場合はundefined）
  // 指値注文では必須、成行注文では省略またはundefined
  // ccxt互換性のため、null値は使用せずundefinedのみ使用する
  amount: number; // 数量
  status?: OrderStatus; // 注文ステータス
  timestamp?: number; // タイムスタンプ
  stopPrice?: number; // ストップ価格（ストップ注文の場合）
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
  stopPrice?: number; // ストップ価格（オプショナル）
}

// 約定情報の型
export interface Fill {
  orderId?: string;
  exchangeOrderId?: string;
  symbol: string;
  side: OrderSide;
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

/**
 * アカウント状態の型定義
 */
export type AccountState = 'NORMAL' | 'MARGIN_CALL' | 'LIQUIDATION' | 'RESTRICTED';

/**
 * タイムフレーム型定義
 */
export type TimeFrame = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

// 戦略の実行結果
export interface StrategyResult {
  strategy: StrategyType;
  signals: Order[];
  timestamp: number;
  error?: string; // エラーメッセージ（オプショナル）
  metadata?: any; // メタデータ（オプショナル）
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

/**
 * システムモード
 */
export enum SystemMode {
  NORMAL = 'normal',
  RISK_REDUCTION = 'risk_reduction',
  STANDBY = 'standby',
  EMERGENCY = 'emergency',
  KILL_SWITCH = 'kill_switch'
}

/**
 * リスクレベル
 */
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

/**
 * 戦略からの売買シグナル
 */
export interface Signal {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price?: number;
  amount: number;
  stopLoss?: number;
  takeProfit?: number;
}
