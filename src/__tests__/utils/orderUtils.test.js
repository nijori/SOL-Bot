// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

const orderUtils = require('../../utils/orderUtils');
const { syncOrderForSimulateFill, syncFillWithOrder, updateOrderStatus } = orderUtils;
const Types = require('../../core/types');
const { Order, OrderStatus, OrderSide, OrderType } = Types;

// ロガーをモック化
jest.mock('../../utils/logger', () => ({
  default: {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('OrderUtils', () => {
  // 各テスト前にモックをリセット
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('syncOrderForSimulateFill', () => {
    test('両方の注文から適切にフィールドをマージする', () => {
      const originalOrder = {
        id: 'original-123',
        symbol: 'BTC/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 50000,
        amount: 0.1,
        status: OrderStatus.OPEN,
        timestamp: Date.now() - 1000
      };

      const updatedOrder = {
        id: 'exchange-456',
        exchangeOrderId: 'ex-789',
        symbol: 'BTC/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 50000,
        amount: 0.1,
        status: OrderStatus.PLACED,
        timestamp: Date.now()
      };

      const result = syncOrderForSimulateFill(originalOrder, updatedOrder);

      // 期待される結果の検証
      expect(result.id).toBe('exchange-456'); // 新しいIDを採用
      expect(result.exchangeOrderId).toBe('ex-789'); // 取引所IDを採用
      expect(result.status).toBe(OrderStatus.PLACED); // 新しいステータスを採用
      expect(result.timestamp).toBe(updatedOrder.timestamp); // 新しいタイムスタンプを採用
    });

    test('updatedOrderに一部のフィールドが欠けている場合はoriginalOrderから補完する', () => {
      const originalOrder = {
        id: 'original-123',
        exchangeOrderId: 'old-ex-123',
        symbol: 'ETH/USDT',
        side: OrderSide.SELL,
        type: OrderType.MARKET,
        amount: 2.0,
        status: OrderStatus.OPEN,
        timestamp: Date.now() - 1000
      };

      const updatedOrder = {
        id: 'exchange-456',
        exchangeOrderId: 'ex-789',
        // symbolが欠けている
        side: OrderSide.SELL,
        // typeが欠けている
        // amountが欠けている
        status: OrderStatus.PLACED,
        timestamp: Date.now()
      };

      const result = syncOrderForSimulateFill(originalOrder, updatedOrder);

      // 期待される結果の検証
      expect(result.id).toBe('exchange-456'); // 新しいIDを採用
      expect(result.exchangeOrderId).toBe('ex-789'); // 新しい取引所IDを採用
      expect(result.symbol).toBe('ETH/USDT'); // 元のシンボルを維持
      expect(result.side).toBe(OrderSide.SELL); // 同じSideを維持
      expect(result.type).toBe(OrderType.MARKET); // 元のタイプを維持
      expect(result.amount).toBe(2.0); // 元の数量を維持
      expect(result.status).toBe(OrderStatus.PLACED); // 新しいステータスを採用
    });
  });

  describe('syncFillWithOrder', () => {
    test('注文情報と約定情報を正しく同期する', () => {
      const order = {
        id: 'order-123',
        exchangeOrderId: 'ex-456',
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 100,
        amount: 10,
        status: OrderStatus.PLACED,
        timestamp: Date.now() - 1000
      };

      const fill = {
        amount: 10,
        price: 99.5, // 若干良い価格で約定
        timestamp: Date.now()
      };

      const result = syncFillWithOrder(order, fill);

      // 期待される結果の検証
      expect(result.orderId).toBe('order-123');
      expect(result.exchangeOrderId).toBe('ex-456');
      expect(result.symbol).toBe('SOL/USDT');
      expect(result.side).toBe(OrderSide.BUY);
      expect(result.amount).toBe(10);
      expect(result.price).toBe(99.5); // fillから価格を採用
      expect(result.timestamp).toBe(fill.timestamp); // fillからタイムスタンプを採用
    });

    test('fillにフィールドが欠けている場合はorderから補完する', () => {
      const order = {
        id: 'order-123',
        exchangeOrderId: 'ex-456',
        symbol: 'XRP/USDT',
        side: OrderSide.SELL,
        type: OrderType.MARKET,
        price: 0.5,
        amount: 1000,
        status: OrderStatus.PLACED,
        timestamp: Date.now() - 1000
      };

      const fill = {
        // amountが欠けている
        // priceが欠けている
        // timestampが欠けている
      };

      const result = syncFillWithOrder(order, fill);

      // 期待される結果の検証
      expect(result.orderId).toBe('order-123');
      expect(result.exchangeOrderId).toBe('ex-456');
      expect(result.symbol).toBe('XRP/USDT');
      expect(result.side).toBe(OrderSide.SELL);
      expect(result.amount).toBe(1000); // orderから数量を採用
      expect(result.price).toBe(0.5); // orderから価格を採用
      expect(result.timestamp).toBeGreaterThan(0); // 現在時刻が使用されていることを確認
    });

    test('marketオーダーでprice=undefinedの場合も適切に処理する', () => {
      const order = {
        id: 'order-123',
        exchangeOrderId: 'ex-456',
        symbol: 'BTC/USDT',
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        // priceはundefined
        amount: 0.1,
        status: OrderStatus.PLACED,
        timestamp: Date.now() - 1000
      };

      const fill = {
        amount: 0.1,
        price: 50000, // 約定価格だけ提供
        timestamp: Date.now()
      };

      const result = syncFillWithOrder(order, fill);

      // 期待される結果の検証
      expect(result.orderId).toBe('order-123');
      expect(result.price).toBe(50000); // fillから価格を採用
    });
  });

  describe('updateOrderStatus', () => {
    test('filled状態を正しく処理する', () => {
      const order = {
        id: 'order-123',
        symbol: 'BTC/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 50000,
        amount: 0.1,
        status: OrderStatus.PLACED
      };

      const updatedOrder = updateOrderStatus(order, 'filled');
      expect(updatedOrder.status).toBe(OrderStatus.FILLED);
    });

    test('canceled状態を正しく処理する', () => {
      const order = {
        id: 'order-123',
        symbol: 'ETH/USDT',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        price: 3000,
        amount: 1.0,
        status: OrderStatus.PLACED
      };

      const updatedOrder = updateOrderStatus(order, 'canceled');
      expect(updatedOrder.status).toBe(OrderStatus.CANCELED);
    });

    test('cancelled（英国式スペル）状態も正しく処理する', () => {
      const order = {
        id: 'order-123',
        symbol: 'ETH/USDT',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        price: 3000,
        amount: 1.0,
        status: OrderStatus.PLACED
      };

      const updatedOrder = updateOrderStatus(order, 'cancelled');
      expect(updatedOrder.status).toBe(OrderStatus.CANCELED);
    });

    test('active/open/new状態を正しく処理する', () => {
      const testCases = ['active', 'open', 'new', 'partially_filled'];

      testCases.forEach((status) => {
        const order = {
          id: 'order-123',
          symbol: 'SOL/USDT',
          side: OrderSide.BUY,
          type: OrderType.LIMIT,
          price: 100,
          amount: 10,
          status: OrderStatus.OPEN // 初期状態を設定
        };

        const updatedOrder = updateOrderStatus(order, status);
        expect(updatedOrder.status).toBe(OrderStatus.PLACED);
      });
    });

    test('rejected状態を正しく処理する', () => {
      const order = {
        id: 'order-123',
        symbol: 'XRP/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 0.5,
        amount: 1000,
        status: OrderStatus.OPEN
      };

      const updatedOrder = updateOrderStatus(order, 'rejected');
      expect(updatedOrder.status).toBe(OrderStatus.REJECTED);
    });

    test('不明な状態には警告を出力し、ステータスを変更しない', () => {
      const order = {
        id: 'order-123',
        symbol: 'BTC/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 50000,
        amount: 0.1,
        status: OrderStatus.PLACED
      };

      const updatedOrder = updateOrderStatus(order, 'unknown_status');
      expect(updatedOrder.status).toBe(OrderStatus.PLACED); // ステータスは変更されないはず
    });

    test('exchangeStatusがundefinedまたはnullの場合は現在の状態を維持する', () => {
      const order = {
        id: 'order-123',
        symbol: 'BTC/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 50000,
        amount: 0.1,
        status: OrderStatus.PLACED
      };

      // undefinedケース
      let updatedOrder = updateOrderStatus(order, undefined);
      expect(updatedOrder.status).toBe(OrderStatus.PLACED);

      // nullケース
      updatedOrder = updateOrderStatus(order, null);
      expect(updatedOrder.status).toBe(OrderStatus.PLACED);
    });
  });
});
