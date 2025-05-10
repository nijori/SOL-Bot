import { Order, OrderStatus, Fill } from "../core/types.js";
import logger from "./logger.js";

/**
 * simulateFill処理用に注文オブジェクトを更新する
 * createOrderの結果をsimulatedFillに適切に渡すためのヘルパー関数
 *
 * @param originalOrder 元の注文オブジェクト
 * @param updatedOrder 更新された注文オブジェクト（取引所APIからのレスポンス等）
 * @returns 同期された注文オブジェクト
 */
export function syncOrderForSimulateFill(originalOrder: Order, updatedOrder: Order): Order {
  // IDの同期（取引所からのIDが返ってきている場合）
  const syncedOrder: Order = {
    ...originalOrder,
    ...updatedOrder,
    // 必須フィールドが欠落した場合は元の値を保持
    symbol: updatedOrder.symbol || originalOrder.symbol,
    side: updatedOrder.side || originalOrder.side,
    type: updatedOrder.type || originalOrder.type,
    amount: updatedOrder.amount || originalOrder.amount
  };

  logger.debug(
    `[OrderUtils] 注文同期: ID=${originalOrder.id || 'unknown'} → ${syncedOrder.id || 'unknown'}, ExchangeID=${syncedOrder.exchangeOrderId || 'unknown'}`
  );

  return syncedOrder;
}

/**
 * 注文IDと約定情報を同期する
 * 取引所APIからの約定レスポンスと内部注文オブジェクトを一致させる
 *
 * @param order 注文オブジェクト
 * @param fill 約定情報
 * @returns 同期された約定情報
 */
export function syncFillWithOrder(order: Order, fill: Partial<Fill>): Fill {
  const syncedFill: Fill = {
    orderId: order.id,
    exchangeOrderId: order.exchangeOrderId,
    symbol: order.symbol,
    side: order.side,
    amount: fill.amount || order.amount,
    price: fill.price || order.price || 0,
    timestamp: fill.timestamp || Date.now()
  };

  logger.debug(
    `[OrderUtils] 約定同期: OrderID=${order.id || 'unknown'}, ExchangeID=${order.exchangeOrderId || 'unknown'}`
  );

  return syncedFill;
}

/**
 * 注文状態を取引所の状態に基づいて更新する
 *
 * @param order 更新する注文オブジェクト
 * @param exchangeStatus 取引所から返された状態文字列
 * @returns 更新された注文オブジェクト
 */
export function updateOrderStatus(order: Order, exchangeStatus: string | undefined | null): Order {
  const updatedOrder = { ...order };

  // exchangeStatusが未定義の場合は現在の状態を維持
  if (!exchangeStatus) {
    return updatedOrder;
  }

  // 取引所の状態文字列をアプリケーションの OrderStatus に変換
  switch (exchangeStatus.toLowerCase()) {
    case 'filled':
    case 'closed':
      updatedOrder.status = OrderStatus.FILLED;
      break;
    case 'canceled':
    case 'cancelled':
    case 'expired':
      updatedOrder.status = OrderStatus.CANCELED;
      break;
    case 'open':
    case 'active':
    case 'new':
    case 'partially_filled':
      updatedOrder.status = OrderStatus.PLACED;
      break;
    case 'rejected':
      updatedOrder.status = OrderStatus.REJECTED;
      break;
    default:
      // 状態が不明な場合は変更しない
      logger.warn(
        `[OrderUtils] 不明な注文状態: ${exchangeStatus}, 注文ID: ${order.id || 'unknown'}`
      );
  }

  return updatedOrder;
}
