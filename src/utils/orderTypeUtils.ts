/**
 * 注文タイプと注文サイド（売買方向）の変換ユーティリティ関数
 *
 * このファイルはOrderTypeとOrderSideの間の安全な変換を提供し、
 * 型推論と型安全性を強化するためのヘルパー関数を提供します。
 * 
 * INF-032: CommonJS形式への変換
 */
// @ts-nocheck
// 循環参照を避けるため、型チェックを一時的に無効化

// モジュールの依存関係
const moduleHelperRef = require('./moduleHelper');
const loggerRef = moduleHelperRef.hasModule('logger') 
  ? moduleHelperRef.getModule('logger') 
  : require('./logger').default;

// 型を動的にロード（循環参照を避けるため）
const typesRef = require('../core/types');
const { OrderType, OrderSide, OrderStatus } = typesRef;

/**
 * 文字列をOrderTypeに安全に変換する
 * @param {string} typeStr 変換する文字列
 * @returns {OrderType|undefined} OrderType enum値、または無効な場合はundefined
 */
function stringToOrderType(typeStr) {
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
      loggerRef.warn(`未知の注文タイプ文字列: ${typeStr}`);
      return undefined;
  }
}

/**
 * 文字列をOrderSideに安全に変換する
 * @param {string} sideStr 変換する文字列
 * @returns {OrderSide|undefined} OrderSide enum値、または無効な場合はundefined
 */
function stringToOrderSide(sideStr) {
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
      loggerRef.warn(`未知の注文サイド文字列: ${sideStr}`);
      return undefined;
  }
}

/**
 * 文字列をOrderStatusに安全に変換する
 * @param {string} statusStr 変換する文字列
 * @returns {OrderStatus|undefined} OrderStatus enum値、または無効な場合はundefined
 */
function stringToOrderStatus(statusStr) {
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
      loggerRef.warn(`未知の注文ステータス文字列: ${statusStr}`);
      return undefined;
  }
}

/**
 * OrderTypeをユーザーフレンドリーな表示文字列に変換する
 * @param {OrderType} orderType 変換するOrderType
 * @returns {string} 人間が読みやすい表示文字列
 */
function orderTypeToDisplayString(orderType) {
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
 * @param {OrderSide} orderSide 変換するOrderSide
 * @returns {string} 人間が読みやすい表示文字列
 */
function orderSideToDisplayString(orderSide) {
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
const ORDER_TYPE_TO_CCXT_MAPPING = {
  [OrderType.MARKET]: 'market',
  [OrderType.LIMIT]: 'limit',
  [OrderType.STOP]: 'stop',
  [OrderType.STOP_LIMIT]: 'stop_limit',
  [OrderType.STOP_MARKET]: 'stop_market'
};

/**
 * ccxt注文タイプ文字列からOrderTypeへの変換マッピング
 */
const CCXT_TO_ORDER_TYPE_MAPPING = {
  market: OrderType.MARKET,
  limit: OrderType.LIMIT,
  stop: OrderType.STOP,
  stop_limit: OrderType.STOP_LIMIT,
  stop_market: OrderType.STOP_MARKET,
  // 取引所特有の名称にも対応
  STOP_LOSS: OrderType.STOP_MARKET,
  STOP_LOSS_LIMIT: OrderType.STOP_LIMIT,
  TAKE_PROFIT: OrderType.STOP_MARKET,
  TAKE_PROFIT_LIMIT: OrderType.STOP_LIMIT
};

/**
 * OrderTypeをccxt用の注文タイプ文字列に変換する
 * @param {OrderType} orderType 変換するOrderType
 * @returns {string} ccxtで使用する注文タイプ文字列
 */
function orderTypeToCcxt(orderType) {
  if (orderType in ORDER_TYPE_TO_CCXT_MAPPING) {
    return ORDER_TYPE_TO_CCXT_MAPPING[orderType];
  }

  // マッピングにない場合は小文字にして返す（後方互換性）
  loggerRef.warn(`マッピングにないOrderType: ${orderType}、小文字に変換します`);
  return orderType.toString().toLowerCase();
}

/**
 * ccxtの注文タイプ文字列からOrderTypeに変換する
 * @param {string} ccxtOrderType ccxtの注文タイプ文字列
 * @returns {OrderType} OrderType enum値
 */
function ccxtToOrderType(ccxtOrderType) {
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
  loggerRef.warn(`未知のccxt注文タイプ: ${ccxtOrderType}、デフォルトでLIMITに変換します`);
  return OrderType.LIMIT;
}

/**
 * 注文タイプが成行注文かどうかをチェックする
 * @param {OrderType} orderType チェックする注文タイプ
 * @returns {boolean} 成行注文の場合はtrue
 */
function isMarketOrder(orderType) {
  return orderType === OrderType.MARKET || orderType === OrderType.STOP_MARKET;
}

/**
 * 注文タイプが指値注文かどうかをチェックする
 * @param {OrderType} orderType チェックする注文タイプ
 * @returns {boolean} 指値注文の場合はtrue
 */
function isLimitOrder(orderType) {
  return orderType === OrderType.LIMIT || orderType === OrderType.STOP_LIMIT;
}

/**
 * 注文タイプがストップ注文かどうかをチェックする
 * @param {OrderType} orderType チェックする注文タイプ
 * @returns {boolean} ストップ注文の場合はtrue
 */
function isStopOrder(orderType) {
  return (
    orderType === OrderType.STOP ||
    orderType === OrderType.STOP_LIMIT ||
    orderType === OrderType.STOP_MARKET
  );
}

/**
 * 反対の注文サイドを取得する（BUY ⇔ SELL）
 * @param {OrderSide} orderSide 元の注文サイド
 * @returns {OrderSide} 反対の注文サイド
 */
function getOppositeSide(orderSide) {
  return orderSide === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;
}

// モジュールとしてまとめる
const orderTypeUtils = {
  stringToOrderType,
  stringToOrderSide,
  stringToOrderStatus,
  orderTypeToDisplayString,
  orderSideToDisplayString,
  orderTypeToCcxt,
  ccxtToOrderType,
  isMarketOrder,
  isLimitOrder,
  isStopOrder,
  getOppositeSide,
  ORDER_TYPE_TO_CCXT_MAPPING,
  CCXT_TO_ORDER_TYPE_MAPPING
};

// モジュールレジストリに登録
moduleHelperRef.registerModule('orderTypeUtils', orderTypeUtils);

// CommonJS形式でエクスポート
module.exports = orderTypeUtils;
