/**
 * 注文ユーティリティ関数
 * INF-032: CommonJS形式への変換
 */
// @ts-nocheck
// 循環参照を避けるため、型チェックを一時的に無効化

// モジュールヘルパーを使用
var moduleHelperRef = require('./moduleHelper');
var OrderStatusRef;

// 型を動的にロード（循環参照を避けるため）
try {
  OrderStatusRef = require('../core/types').OrderStatus;
} catch (err) {
  // フォールバック：型が定義されていない場合は空オブジェクトを作成
  OrderStatusRef = {
    NEW: 'NEW',
    PLACED: 'PLACED',
    FILLED: 'FILLED',
    CANCELED: 'CANCELED',
    REJECTED: 'REJECTED'
  };
}

// ロガーを安全にロード
var loggerRef = moduleHelperRef.hasModule('logger') 
  ? moduleHelperRef.getModule('logger') 
  : require('./logger').default;

/**
 * simulateFill処理用に注文オブジェクトを更新する
 * createOrderの結果をsimulatedFillに適切に渡すためのヘルパー関数
 *
 * @param {Object} originalOrder 元の注文オブジェクト
 * @param {Object} updatedOrder 更新された注文オブジェクト（取引所APIからのレスポンス等）
 * @returns {Object} 同期された注文オブジェクト
 */
function syncOrderForSimulateFillImpl(originalOrder, updatedOrder) {
  // IDの同期（取引所からのIDが返ってきている場合）
  const syncedOrder = {
    ...originalOrder,
    ...updatedOrder,
    // 必須フィールドが欠落した場合は元の値を保持
    symbol: updatedOrder.symbol || originalOrder.symbol,
    side: updatedOrder.side || originalOrder.side,
    type: updatedOrder.type || originalOrder.type,
    amount: updatedOrder.amount || originalOrder.amount
  };

  loggerRef.debug(
    `[OrderUtils] 注文同期: ID=${originalOrder.id || 'unknown'} → ${syncedOrder.id || 'unknown'}, ExchangeID=${syncedOrder.exchangeOrderId || 'unknown'}`
  );

  return syncedOrder;
}

/**
 * 注文IDと約定情報を同期する
 * 取引所APIからの約定レスポンスと内部注文オブジェクトを一致させる
 *
 * @param {Object} order 注文オブジェクト
 * @param {Object} fill 約定情報
 * @returns {Object} 同期された約定情報
 */
function syncFillWithOrderImpl(order, fill) {
  const syncedFill = {
    orderId: order.id,
    exchangeOrderId: order.exchangeOrderId,
    symbol: order.symbol,
    side: order.side,
    amount: fill.amount || order.amount,
    price: fill.price || order.price || 0,
    timestamp: fill.timestamp || Date.now()
  };

  loggerRef.debug(
    `[OrderUtils] 約定同期: OrderID=${order.id || 'unknown'}, ExchangeID=${order.exchangeOrderId || 'unknown'}`
  );

  return syncedFill;
}

/**
 * 注文状態を取引所の状態に基づいて更新する
 *
 * @param {Object} order 更新する注文オブジェクト
 * @param {string|undefined|null} exchangeStatus 取引所から返された状態文字列
 * @returns {Object} 更新された注文オブジェクト
 */
function updateOrderStatusImpl(order, exchangeStatus) {
  const updatedOrder = { ...order };

  // exchangeStatusが未定義の場合は現在の状態を維持
  if (!exchangeStatus) {
    return updatedOrder;
  }

  // 取引所の状態文字列をアプリケーションの OrderStatus に変換
  switch (exchangeStatus.toLowerCase()) {
    case 'filled':
    case 'closed':
      updatedOrder.status = OrderStatusRef.FILLED;
      break;
    case 'canceled':
    case 'cancelled':
    case 'expired':
      updatedOrder.status = OrderStatusRef.CANCELED;
      break;
    case 'open':
    case 'active':
    case 'new':
    case 'partially_filled':
      updatedOrder.status = OrderStatusRef.PLACED;
      break;
    case 'rejected':
      updatedOrder.status = OrderStatusRef.REJECTED;
      break;
    default:
      // 状態が不明な場合は変更しない
      loggerRef.warn(
        `[OrderUtils] 不明な注文状態: ${exchangeStatus}, 注文ID: ${order.id || 'unknown'}`
      );
  }

  return updatedOrder;
}

// モジュールエクスポート用のオブジェクトを作成
var orderUtils = {
  syncOrderForSimulateFill: syncOrderForSimulateFillImpl,
  syncFillWithOrder: syncFillWithOrderImpl,
  updateOrderStatus: updateOrderStatusImpl
};

// モジュールレジストリに登録
moduleHelperRef.registerModule('orderUtils', orderUtils);

// CommonJS形式でエクスポート
module.exports = orderUtils;
