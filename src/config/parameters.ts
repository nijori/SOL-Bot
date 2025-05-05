import 'dotenv/config';

/**
 * トレーディングパラメータ設定
 */

// 相場環境判定用パラメータ
export const MARKET_PARAMETERS = {
  SHORT_TERM_EMA: process.env.SHORT_TERM_EMA ? parseInt(process.env.SHORT_TERM_EMA) : 10,
  LONG_TERM_EMA: process.env.LONG_TERM_EMA ? parseInt(process.env.LONG_TERM_EMA) : 50,
  ATR_PERIOD: process.env.ATR_PERIOD ? parseInt(process.env.ATR_PERIOD) : 14,
  // 相場判定のしきい値
  TREND_SLOPE_THRESHOLD: 0.2,  // EMAの傾きがこの値より大きいとトレンド判定
  VOLATILITY_THRESHOLD: 2.0,   // ATRがこの値倍以上に増えると高ボラティリティ判定
  ATR_PERCENTAGE_THRESHOLD: 6.0,  // ATR%がこの値未満だとLOW_VOL判定
}

// トレンド戦略用パラメータ
export const TREND_PARAMETERS = {
  DONCHIAN_PERIOD: process.env.DONCHIAN_PERIOD ? parseInt(process.env.DONCHIAN_PERIOD) : 20,
  ADX_PERIOD: process.env.ADX_PERIOD ? parseInt(process.env.ADX_PERIOD) : 14,
  ADX_THRESHOLD: process.env.ADX_THRESHOLD ? parseInt(process.env.ADX_THRESHOLD) : 25,
  TRAILING_STOP_PERCENTAGE: 0.03,  // 3%のトレイリングストップ（非推奨：ATR_TRAILING_STOP_MULTIPLIERを使用）
  ATR_TRAILING_STOP_MULTIPLIER: 1.2,  // トレイリングストップ = ATR * 1.2
  ADD_ON_POSITION_MULTIPLIER: 0.5,  // 1R進むごとに0.5R追加、最大2回
  POSITION_SIZING: 0.2,  // ポジションサイズ（利用可能資金の20%）
}

// レンジ戦略用パラメータ
export const RANGE_PARAMETERS = {
  RANGE_PERIOD: 30,  // 30日間の高値・安値をレンジ境界として使用
  GRID_LEVELS: 5,    // グリッドレベルのデフォルト数（動的調整時の初期値）
  POSITION_SIZING: 0.1,  // ポジションサイズ（利用可能資金の10%）
}

// リスク管理パラメータ
export const RISK_PARAMETERS = {
  MAX_RISK_PER_TRADE: process.env.RISK_PER_TRADE ? parseFloat(process.env.RISK_PER_TRADE) : 0.01,  // 取引ごとの最大リスク（口座の1%）
  MAX_DAILY_LOSS: process.env.MAX_DAILY_LOSS ? parseFloat(process.env.MAX_DAILY_LOSS) : 0.05,     // 1日の最大損失（口座の5%）
  EMERGENCY_GAP_THRESHOLD: 0.15,  // 15%の急落を緊急事態とみなす
  EMERGENCY_POSITION_REDUCTION: 0.5,  // 緊急時にポジションを50%削減
}

// ログと監視パラメータ
export const MONITORING_PARAMETERS = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  PERFORMANCE_METRIC_INTERVAL: 86400000,  // パフォーマンス評価間隔（1日）
}

// バックテストパラメータ
export const BACKTEST_PARAMETERS = {
  START_DATE: '2023-01-01',
  END_DATE: '2023-12-31',
  COMMISSION_RATE: 0.001,  // 0.1%の取引手数料
  SLIPPAGE: 0.001,         // 0.1%のスリッページ
}

// モード設定
export enum OperationMode {
  LIVE = 'live',
  SIMULATION = 'simulation',
  BACKTEST = 'backtest',
}

export const OPERATION_MODE: OperationMode = 
  (process.env.MODE as OperationMode) || OperationMode.SIMULATION; 