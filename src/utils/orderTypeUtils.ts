/**
 * 注文タイプと注文サイド（売買方向）の変換ユーティリティ関数
 * 
 * このファイルはOrderTypeとOrderSideの間の安全な変換を提供し、
 * 型推論と型安全性を強化するためのヘルパー関数を提供します。
 */

import { OrderType, OrderSide, OrderStatus } from '../core/types';
import logger from './logger';

/**
 * 文字列をOrderTypeに安全に変換する
 * @param typeStr 変換する文字列
 * @returns OrderType enum値、または無効な場合はundefined
 */
export function stringToOrderType(typeStr: string): OrderType | undefined {
  // 大文字小文字を正規化
  const normalizedType = typeStr.toLowerCase();
  
  // 直接一致するケース
  switch (normalizedType) {
    case 'market':
      return OrderType.MARKET;
    case 'limit':
      return OrderType.LIMIT;
    case 'stop':
      return OrderType.STOP;
    case 'stop_limit':
    case 'stop-limit':
    case 'stoplimit':
      return OrderType.STOP_LIMIT;
    case 'stop_market':
    case 'stop-market':
    case 'stopmarket':
      return OrderType.STOP_MARKET;
    default:
      // パターンマッチで部分一致
      if (normalizedType.includes('market')) {
        return OrderType.MARKET;
      } else if (normalizedType.includes('limit')) {
        // 'stop'と'limit'の両方を含む場合
        if (normalizedType.includes('stop')) {
          return OrderType.STOP_LIMIT;
        }
        return OrderType.LIMIT;
      } else if (normalizedType.includes('stop')) {
        // デフォルトでSTOP_MARKETと解釈
        return OrderType.STOP_MARKET;
      }
      
      // 一致するものが見つからない場合
      logger.warn(`未知の注文タイプ文字列: ${typeStr}`);
      return undefined;
  }
}

/**
 * 文字列をOrderSideに安全に変換する
 * @param sideStr 変換する文字列
 * @returns OrderSide enum値、または無効な場合はundefined
 */
export function stringToOrderSide(sideStr: string): OrderSide | undefined {
  // 大文字小文字を正規化
  const normalizedSide = sideStr.toLowerCase();
  
  switch (normalizedSide) {
    case 'buy':
    case 'bid':
    case 'long':
      return OrderSide.BUY;
    case 'sell':
    case 'ask':
    case 'short':
      return OrderSide.SELL;
    default:
      logger.warn(`未知の注文サイド文字列: ${sideStr}`);
      return undefined;
  }
}

/**
 * 文字列をOrderStatusに安全に変換する
 * @param statusStr 変換する文字列
 * @returns OrderStatus enum値、または無効な場合はundefined
 */
export function stringToOrderStatus(statusStr: string): OrderStatus | undefined {
  // 大文字小文字を正規化
  const normalizedStatus = statusStr.toLowerCase();
  
  switch (normalizedStatus) {
    case 'open':
    case 'pending':
    case 'new':
      return OrderStatus.OPEN;
    case 'placed':
    case 'accepted':
      return OrderStatus.PLACED;
    case 'filled':
    case 'closed':
    case 'executed':
    case 'complete':
    case 'completed':
      return OrderStatus.FILLED;
    case 'canceled':
    case 'cancelled':
      return OrderStatus.CANCELED;
    case 'rejected':
    case 'failed':
      return OrderStatus.REJECTED;
    default:
      logger.warn(`未知の注文ステータス文字列: ${statusStr}`);
      return undefined;
  }
}

/**
 * OrderTypeをユーザーフレンドリーな表示文字列に変換する
 * @param orderType 変換するOrderType
 * @returns 人間が読みやすい表示文字列
 */
export function orderTypeToDisplayString(orderType: OrderType): string {
  switch (orderType) {
    case OrderType.MARKET:
      return '成行注文';
    case OrderType.LIMIT:
      return '指値注文';
    case OrderType.STOP:
      return 'ストップ注文';
    case OrderType.STOP_LIMIT:
      return 'ストップ指値注文';
    case OrderType.STOP_MARKET:
      return 'ストップ成行注文';
    default:
      return `不明な注文タイプ: ${orderType}`;
  }
}

/**
 * OrderSideをユーザーフレンドリーな表示文字列に変換する
 * @param orderSide 変換するOrderSide
 * @returns 人間が読みやすい表示文字列
 */
export function orderSideToDisplayString(orderSide: OrderSide): string {
  switch (orderSide) {
    case OrderSide.BUY:
      return '買い';
    case OrderSide.SELL:
      return '売り';
    default:
      return `不明な注文方向: ${orderSide}`;
  }
}

/**
 * OrderTypeとccxtの注文タイプ文字列の間の変換マッピング
 */
export const ORDER_TYPE_TO_CCXT_MAPPING: Record<OrderType, string> = {
  [OrderType.MARKET]: 'market',
  [OrderType.LIMIT]: 'limit',
  [OrderType.STOP]: 'stop',
  [OrderType.STOP_LIMIT]: 'stop_limit',
  [OrderType.STOP_MARKET]: 'stop_market',
};

/**
 * ccxt注文タイプ文字列からOrderTypeへの変換マッピング
 */
export const CCXT_TO_ORDER_TYPE_MAPPING: Record<string, OrderType> = {
  'market': OrderType.MARKET,
  'limit': OrderType.LIMIT,
  'stop': OrderType.STOP,
  'stop_limit': OrderType.STOP_LIMIT,
  'stop_market': OrderType.STOP_MARKET,
  // 取引所特有の名称にも対応
  'STOP_LOSS': OrderType.STOP_MARKET,
  'STOP_LOSS_LIMIT': OrderType.STOP_LIMIT,
  'TAKE_PROFIT': OrderType.STOP_MARKET,
  'TAKE_PROFIT_LIMIT': OrderType.STOP_LIMIT,
};

/**
 * OrderTypeをccxt用の注文タイプ文字列に変換する
 * @param orderType 変換するOrderType
 * @returns ccxtで使用する注文タイプ文字列
 */
export function orderTypeToCcxt(orderType: OrderType): string {
  if (orderType in ORDER_TYPE_TO_CCXT_MAPPING) {
    return ORDER_TYPE_TO_CCXT_MAPPING[orderType];
  }
  
  // マッピングにない場合は小文字にして返す（後方互換性）
  logger.warn(`マッピングにないOrderType: ${orderType}、小文字に変換します`);
  return orderType.toString().toLowerCase();
}

/**
 * ccxtの注文タイプ文字列からOrderTypeに変換する
 * @param ccxtOrderType ccxtの注文タイプ文字列
 * @returns OrderType enum値
 */
export function ccxtToOrderType(ccxtOrderType: string): OrderType {
  // 文字列の正規化（小文字に変換）
  const normalizedType = ccxtOrderType.toLowerCase();
  
  // マッピングテーブルでの直接一致を最初に試みる
  if (normalizedType in CCXT_TO_ORDER_TYPE_MAPPING) {
    return CCXT_TO_ORDER_TYPE_MAPPING[normalizedType];
  }
  
  // 直接一致しなかった場合、文字列の部分一致で判断
  if (normalizedType.includes('market')) {
    return OrderType.MARKET;
  } else if (normalizedType.includes('limit')) {
    // 'stop'と'limit'の両方を含む場合
    if (normalizedType.includes('stop')) {
      return OrderType.STOP_LIMIT;
    }
    return OrderType.LIMIT;
  } else if (normalizedType.includes('stop')) {
    return OrderType.STOP_MARKET;
  }
  
  // デフォルトはLIMITとする（最も安全なフォールバック）
  logger.warn(`未知のccxt注文タイプ: ${ccxtOrderType}、デフォルトでLIMITに変換します`);
  return OrderType.LIMIT;
}

/**
 * 注文タイプが成行注文かどうかをチェックする
 * @param orderType チェックする注文タイプ
 * @returns 成行注文の場合はtrue
 */
export function isMarketOrder(orderType: OrderType): boolean {
  return orderType === OrderType.MARKET || orderType === OrderType.STOP_MARKET;
}

/**
 * 注文タイプが指値注文かどうかをチェックする
 * @param orderType チェックする注文タイプ
 * @returns 指値注文の場合はtrue
 */
export function isLimitOrder(orderType: OrderType): boolean {
  return orderType === OrderType.LIMIT || orderType === OrderType.STOP_LIMIT;
}

/**
 * 注文タイプがストップ注文かどうかをチェックする
 * @param orderType チェックする注文タイプ
 * @returns ストップ注文の場合はtrue
 */
export function isStopOrder(orderType: OrderType): boolean {
  return orderType === OrderType.STOP || 
         orderType === OrderType.STOP_LIMIT || 
         orderType === OrderType.STOP_MARKET;
} 