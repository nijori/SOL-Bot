/**
 * トレーディングエンジン関連の型定義
 */

// @ts-nocheck
// CommonJS移行中のため一時的にTypeScriptチェックを無効化

// CommonJS インポート
const { Candle } = require('../core/types');
const { Order } = require('../core/types');
const { Position } = require('../core/types');
const { ExchangeService } = require('../services/exchangeService');
const { OrderSizingService } = require('../services/orderSizingService');
const { OrderManagementSystem } = require('../core/orderManagementSystem');

/**
 * CommonJS環境では型定義は削除
 * 実行時に必要な定数のみ保持
 */

/**
 * トレーディングエンジンの動作モード
 */
const SystemMode = {
  NORMAL: 'NORMAL',           // 通常モード
  RISK_REDUCTION: 'RISK_REDUCTION', // リスク削減モード
  STANDBY: 'STANDBY',         // 待機モード
  EMERGENCY: 'EMERGENCY'      // 緊急モード
};

// CommonJS エクスポート
module.exports = {
  SystemMode
}; 