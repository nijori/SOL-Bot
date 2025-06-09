// @ts-nocheck
/**
 * アプリケーション全体で使用する型定義
 * INF-032: CommonJS形式への変換
 * 
 * このファイルはCommonJS形式と型定義の両立を目指して作成されています。
 * JavaScriptランタイムでは定数オブジェクトとして、
 * TypeScriptコンパイル時には型定義として機能します。
 */

// TypeScriptの名前空間を使って型定義を格納
// これにより実行時のJavaScriptには影響せず、型定義のみを提供
namespace Types {
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
}

// 市場環境の種類を表す定数オブジェクト
const MarketEnvironment = Object.freeze({
  UPTREND: 'uptrend',
  DOWNTREND: 'downtrend',
  STRONG_UPTREND: 'strong_uptrend',
  STRONG_DOWNTREND: 'strong_downtrend',
  WEAK_UPTREND: 'weak_uptrend',
  WEAK_DOWNTREND: 'weak_downtrend',
  RANGE: 'range',
  UNKNOWN: 'unknown'
});

// 取引戦略の種類を表す定数オブジェクト
const StrategyType = Object.freeze({
  TREND_FOLLOWING: 'trend_following',
  RANGE_TRADING: 'range_trading',
  MEAN_REVERT: 'mean_revert',
  EMERGENCY: 'emergency',
  DONCHIAN_BREAKOUT: 'donchian_breakout'
});

// 注文のタイプを表す定数オブジェクト
const OrderType = Object.freeze({
  MARKET: 'market',
  LIMIT: 'limit',
  STOP: 'stop',
  STOP_LIMIT: 'stop_limit',
  STOP_MARKET: 'stop_market'
});

// 注文の方向を表す定数オブジェクト
const OrderSide = Object.freeze({
  BUY: 'buy',
  SELL: 'sell'
});

// 注文のステータスを表す定数オブジェクト
const OrderStatus = Object.freeze({
  OPEN: 'open', // システム内で作成された注文（取引所送信前）
  PLACED: 'placed', // 取引所に送信され受け付けられた注文
  FILLED: 'filled', // 約定済みの注文
  CANCELED: 'canceled', // キャンセルされた注文
  REJECTED: 'rejected' // 拒否された注文
});

// アカウント状態を表す定数オブジェクト
const AccountState = Object.freeze({
  NORMAL: 'NORMAL',
  MARGIN_CALL: 'MARGIN_CALL',
  LIQUIDATION: 'LIQUIDATION',
  RESTRICTED: 'RESTRICTED'
});

// タイムフレームを表す定数オブジェクト
const TimeFrame = Object.freeze({
  ONE_MIN: '1m',
  FIVE_MIN: '5m',
  FIFTEEN_MIN: '15m',
  THIRTY_MIN: '30m',
  ONE_HOUR: '1h',
  FOUR_HOUR: '4h',
  ONE_DAY: '1d',
  ONE_WEEK: '1w'
});

// システムモードを表す定数オブジェクト
const SystemMode = Object.freeze({
  NORMAL: 'normal',
  RISK_REDUCTION: 'risk_reduction',
  STANDBY: 'standby',
  EMERGENCY: 'emergency',
  KILL_SWITCH: 'kill_switch'
});

// リスクレベルを表す定数オブジェクト
const RiskLevel = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
});

// タイムスタンプの型ガード関数
/**
 * タイムスタンプが数値型かどうかをチェックする
 * @param {number|string} timestamp チェック対象のタイムスタンプ
 * @returns {boolean} 数値型ならtrue
 */
function isNumericTimestamp(timestamp) {
  return typeof timestamp === 'number';
}

/**
 * ISO文字列タイムスタンプをミリ秒数値に変換する
 * @param {number|string} timestamp 変換対象のタイムスタンプ
 * @returns {number} ミリ秒単位のUNIXタイムスタンプ
 */
function normalizeTimestamp(timestamp) {
  if (isNumericTimestamp(timestamp)) {
    return timestamp;
  }
  // ISO文字列からDateオブジェクトを生成し、ミリ秒タイムスタンプに変換
  return new Date(timestamp).getTime();
}

// CommonJS環境でも動作するよう、TypeScript型定義をRuntime型として提供
const Types = {
  // 実行時に必要な定数をエクスポート
  OrderType,
  OrderSide,
  OrderStatus,
  MarketEnvironment,
  StrategyType,
  SystemMode,
  RiskLevel,
  AccountState,
  TimeFrame
};

// TypeScriptの型定義をエクスポート
const TypesExport = {
  // 型定義を参照可能にするための名前空間
  Types,
  // 関数
  isNumericTimestamp,
  normalizeTimestamp,
  // 定数も個別にエクスポート
  MarketEnvironment,
  StrategyType,
  OrderType,
  OrderSide,
  OrderStatus,
  SystemMode,
  RiskLevel,
  AccountState,
  TimeFrame
};

// CommonJS形式でエクスポート
module.exports = TypesExport;
