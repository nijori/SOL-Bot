/**
 * トレーディングエンジン関連の型定義
 */

import { Candle } from '../core/types.js';
import { Order } from '../core/types.js';
import { Position } from '../core/types.js';
import { ExchangeService } from '../services/exchangeService.js';
import { OrderSizingService } from '../services/orderSizingService.js';
import { OrderManagementSystem } from '../core/orderManagementSystem.js';

/**
 * トレーディングエンジンオプションインターフェース
 */
export interface TradingEngineOptions {
  // 基本設定
  symbol: string;
  timeframeHours?: number;
  initialBalance?: number;
  isBacktest?: boolean;
  slippage?: number;
  commissionRate?: number;
  isSmokeTest?: boolean;
  quiet?: boolean; // ログ出力を抑制するモード

  // 依存サービス
  oms?: OrderManagementSystem;
  exchangeService?: ExchangeService;
  orderSizingService?: OrderSizingService;
}

/**
 * トレーディングエンジンインターフェース
 */
export interface ITradingEngine {
  // 既存メソッド
  update(candle: Candle): Promise<void>;
  getEquity(): number;
  getCompletedTrades(): any[];
  
  // 追加するメソッド
  getPositions(): Position[];
  getRecentSignals(): Order[];
  getCurrentPrice(): number;
  initializeMetrics(): void;
  stop(): void;
  setSystemMode(mode: string | SystemMode): void;
}

/**
 * トレーディングエンジンの動作モード
 */
export enum SystemMode {
  NORMAL = 'NORMAL',           // 通常モード
  RISK_REDUCTION = 'RISK_REDUCTION', // リスク削減モード
  STANDBY = 'STANDBY',         // 待機モード
  EMERGENCY = 'EMERGENCY'      // 緊急モード
} 