/**
 * コマンドラインインターフェース用の型定義
 * マルチシンボル対応と設定オーバーライド機能を含む
 */

/**
 * 共通のCLIオプション
 */
export interface CommonCliOptions {
  // 動作モード
  mode?: 'live' | 'simulation' | 'backtest';
  
  // 詳細出力
  verbose?: boolean;
  quiet?: boolean;
  
  // ヘルプ
  help?: boolean;
}

/**
 * バックテスト用CLIオプション
 */
export interface BacktestCliOptions extends CommonCliOptions {
  // 期間設定
  'start-date'?: string;
  'end-date'?: string;
  days?: number;
  
  // バックテスト設定
  'initial-balance'?: number;
  slippage?: number;
  'commission-rate'?: number;
  
  // パフォーマンス最適化
  'batch-size'?: number;
  'gc-interval'?: number;
  'no-memory-monitor'?: boolean;
  
  // テストモード
  'smoke-test'?: boolean;
}

/**
 * マルチシンボル対応CLIオプション
 */
export interface MultiSymbolCliOptions extends CommonCliOptions {
  // 単一シンボル（後方互換性のため）
  symbol?: string;
  
  // 複数シンボル
  symbols?: string[]; // カンマ区切りの複数シンボル
  
  // タイムフレーム
  timeframe?: string;
  timeframes?: string[]; // カンマ区切りの複数タイムフレーム
  
  // 設定オーバーライド
  'config-override'?: string; // JSON形式の文字列 or ファイルパス
}

/**
 * 実行時のCLIオプション
 */
export interface CliOptions extends BacktestCliOptions, MultiSymbolCliOptions {
  // 他の追加オプション
  [key: string]: any;
}

/**
 * シンボル別の設定オーバーライド型
 */
export interface SymbolConfig {
  // シンボル固有の設定
  [key: string]: any;
}

/**
 * マルチシンボル設定型
 * {
 *   "default": { ... 共通設定 ... },
 *   "SOL/USDT": { ... SOL固有設定 ... },
 *   "BTC/USDT": { ... BTC固有設定 ... }
 * }
 */
export interface MultiSymbolConfig {
  default: SymbolConfig;
  [symbol: string]: SymbolConfig;
} 