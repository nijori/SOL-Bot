// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

/**
 * UnifiedOrderManager テスト
 *
 * 複数取引所の注文を統合管理するクラスのテスト
 * OMS-009: 複数取引所対応
 */

const { UnifiedOrderManager, AllocationStrategy } = require('../../services/UnifiedOrderManager');
const { ExchangeService } = require('../../services/exchangeService');
const { OrderManagementSystem } = require('../../core/orderManagementSystem');
const { Types, OrderSide, OrderType, OrderStatus } = require('../../core/types');

// リソーストラッカーとテストクリーンアップ関連のインポート (CommonJS形式)
const ResourceTracker = require('../../utils/test-helpers/resource-tracker');
const { 
  standardBeforeEach, 
  standardAfterEach, 
  standardAfterAll 
} = require('../../utils/test-helpers/test-cleanup');

// モックの作成
jest.mock('../../services/exchangeService');
jest.mock('../../core/orderManagementSystem');

describe('UnifiedOrderManager', () => {
  let unifiedManager;
  let mockExchangeService1;
  let mockExchangeService2;

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();
    standardBeforeEach();
    
    // グローバルリソーストラッカーの初期化（必要な場合）
    if (!global.__RESOURCE_TRACKER) {
      global.__RESOURCE_TRACKER = new ResourceTracker();
    }

    // ExchangeServiceモックの作成
    mockExchangeService1 = new ExchangeService();
    mockExchangeService2 = new ExchangeService();

    // UnifiedOrderManagerのインスタンス作成
    unifiedManager = new UnifiedOrderManager();

    // モックメソッドの設定
    mockExchangeService1.getExchangeName = jest.fn().mockReturnValue('Binance');
    mockExchangeService2.getExchangeName = jest.fn().mockReturnValue('Bybit');

    // OrderManagementSystemのcreateOrderメソッドをモック
    OrderManagementSystem.prototype.createOrder = jest.fn().mockImplementation((order) => {
      return `mock-order-id-${Math.random()}`;
    });

    // OrderManagementSystemのgetPositionsBySymbolメソッドをモック
    OrderManagementSystem.prototype.getPositionsBySymbol = jest
      .fn()
      .mockImplementation((symbol) => {
        if (symbol === 'SOL/USDT') {
          return [
            {
              symbol: 'SOL/USDT',
              side: OrderSide.BUY,
              amount: 10,
              entryPrice: 100,
              currentPrice: 110,
              unrealizedPnl: 100,
              timestamp: Date.now()
            }
          ];
        }
        return [];
      });

    // TST-070: OrderManagementSystemのgetPositionsメソッドをモック
    OrderManagementSystem.prototype.getPositions = jest
      .fn()
      .mockImplementation(() => {
        return [
          {
            symbol: 'SOL/USDT',
            side: OrderSide.BUY,
            amount: 10,
            entryPrice: 100,
            currentPrice: 110,
            unrealizedPnl: 100,
            timestamp: Date.now()
          }
        ];
      });

    // OrderManagementSystemのgetOrdersメソッドをモック
    OrderManagementSystem.prototype.getOrders = jest.fn().mockReturnValue([
      {
        id: 'order1',
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 100,
        amount: 1,
        status: OrderStatus.OPEN
      },
      {
        id: 'order2',
        symbol: 'SOL/USDT',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        price: 110,
        amount: 1,
        status: OrderStatus.FILLED
      }
    ]);

    // OrderManagementSystemのcancelOrderメソッドをモック
    OrderManagementSystem.prototype.cancelOrder = jest
      .fn()
      .mockImplementation((orderId) => {
        return orderId === 'order1';
      });
  });

  afterEach(async () => {
    await standardAfterEach();
  });

  afterAll(async () => {
    await standardAfterAll();
  });

  describe('基本機能テスト', () => {
    test('取引所の追加', () => {
      // 取引所を追加
      const result1 = unifiedManager.addExchange('binance', mockExchangeService1, 1);
      const result2 = unifiedManager.addExchange('bybit', mockExchangeService2, 2);

      // 同じIDで再度追加（失敗するはず）
      const result3 = unifiedManager.addExchange('binance', mockExchangeService1, 3);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(false);

      // OrderManagementSystem.setExchangeServiceが呼ばれたことを確認
      expect(OrderManagementSystem.prototype.setExchangeService).toHaveBeenCalledTimes(2);
    });

    test('取引所の削除', () => {
      // 取引所を追加
      unifiedManager.addExchange('binance', mockExchangeService1, 1);
      unifiedManager.addExchange('bybit', mockExchangeService2, 2);

      // 取引所を削除
      const result1 = unifiedManager.removeExchange('binance');
      const result2 = unifiedManager.removeExchange('unknown');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    test('取引所の有効/無効切り替え', () => {
      // 取引所を追加
      unifiedManager.addExchange('binance', mockExchangeService1, 1);

      // 有効/無効を切り替え
      const result1 = unifiedManager.setExchangeActive('binance', false);
      const result2 = unifiedManager.setExchangeActive('unknown', false);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });

  describe('注文配分テスト', () => {
    beforeEach(() => {
      // テスト用に取引所を追加
      unifiedManager.addExchange('binance', mockExchangeService1, 1);
      unifiedManager.addExchange('bybit', mockExchangeService2, 2);
    });

    test('優先度配分方式', () => {
      // 優先度配分に設定（デフォルト）
      unifiedManager.setAllocationStrategy({ strategy: AllocationStrategy.PRIORITY });

      // 注文を作成
      const order = {
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 100,
        amount: 1
      };

      const orderIds = unifiedManager.createOrder(order);

      // 最高優先度の取引所のみに注文が作成されることを確認
      expect(orderIds.size).toBe(1);
      expect(orderIds.has('binance')).toBe(true);
      expect(OrderManagementSystem.prototype.createOrder).toHaveBeenCalledTimes(1);
    });

    test('ラウンドロビン配分方式', () => {
      // ラウンドロビン配分に設定
      unifiedManager.setAllocationStrategy({ strategy: AllocationStrategy.ROUND_ROBIN });

      // 2回注文を作成
      const order1 = {
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 100,
        amount: 1
      };

      const order2 = {
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 101,
        amount: 1
      };

      const orderIds1 = unifiedManager.createOrder(order1);
      const orderIds2 = unifiedManager.createOrder(order2);

      // 1回目と2回目で異なる取引所に注文が作成されることを確認
      expect(orderIds1.size).toBe(1);
      expect(orderIds2.size).toBe(1);

      // 両方の取引所に1回ずつ注文が作成されることを確認
      expect(OrderManagementSystem.prototype.createOrder).toHaveBeenCalledTimes(2);
    });

    test('均等分割配分方式', () => {
      // 均等分割配分に設定
      unifiedManager.setAllocationStrategy({ strategy: AllocationStrategy.SPLIT_EQUAL });

      // 注文を作成
      const order = {
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 100,
        amount: 10
      };

      const orderIds = unifiedManager.createOrder(order);

      // 両方の取引所に注文が作成されることを確認
      expect(orderIds.size).toBe(2);
      expect(orderIds.has('binance')).toBe(true);
      expect(orderIds.has('bybit')).toBe(true);

      // 注文が均等に分割されることを確認（2取引所なので5ずつ）
      expect(OrderManagementSystem.prototype.createOrder).toHaveBeenCalledTimes(2);
      expect(OrderManagementSystem.prototype.createOrder).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ amount: 5 })
      );
      expect(OrderManagementSystem.prototype.createOrder).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ amount: 5 })
      );
    });

    test('重み付き配分方式', () => {
      // 重み付き配分に設定
      unifiedManager.setAllocationStrategy({
        strategy: AllocationStrategy.WEIGHTED,
        weights: { binance: 0.7, bybit: 0.3 }
      });

      // 注文を作成
      const order = {
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 100,
        amount: 10
      };

      const orderIds = unifiedManager.createOrder(order);

      // 両方の取引所に注文が作成されることを確認
      expect(orderIds.size).toBe(2);
      expect(orderIds.has('binance')).toBe(true);
      expect(orderIds.has('bybit')).toBe(true);

      // 重みに従って注文が分割されることを確認（7:3）
      expect(OrderManagementSystem.prototype.createOrder).toHaveBeenCalledTimes(2);
      expect(OrderManagementSystem.prototype.createOrder).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ amount: 7 })
      );
      expect(OrderManagementSystem.prototype.createOrder).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ amount: 3 })
      );
    });
  });

  describe('ポジション管理テスト', () => {
    beforeEach(() => {
      // テスト用に取引所を追加
      unifiedManager.addExchange('binance', mockExchangeService1, 1);
      unifiedManager.addExchange('bybit', mockExchangeService2, 2);
    });

    test('ポジション取得', () => {
      // 特定シンボルのポジションを取得
      const positions = unifiedManager.getPositionsBySymbol('SOL/USDT');

      // 正しいポジションが返されることを確認
      expect(positions.length).toBe(2); // 2つの取引所から各1つずつ
      expect(positions[0].symbol).toBe('SOL/USDT');
      expect(positions[0].side).toBe(OrderSide.BUY);
      expect(positions[0].amount).toBe(10);
    });

    test('全ポジション取得', () => {
      // 全ポジションを取得
      const allPositions = unifiedManager.getAllPositions();

      // 返されるマップが正しいことを確認
      expect(allPositions.size).toBe(2); // 2つの取引所
      expect(allPositions.has('binance')).toBe(true);
      expect(allPositions.has('bybit')).toBe(true);

      // 各取引所のポジションが正しいことを確認
      const binancePositions = allPositions.get('binance');
      expect(binancePositions.length).toBe(1);
      expect(binancePositions[0].symbol).toBe('SOL/USDT');
    });

    test('統合ポジション取得', () => {
      // 統合ポジションを取得
      const consolidatedPositions = unifiedManager.getConsolidatedPositions();

      // 統合ポジションが正しいことを確認
      expect(consolidatedPositions.length).toBe(1);
      expect(consolidatedPositions[0].symbol).toBe('SOL/USDT');
      expect(consolidatedPositions[0].amount).toBe(20); // 2つの取引所の合計
    });

    test('特定取引所のポジション取得', () => {
      // 特定取引所のポジションを取得
      const binancePositions = unifiedManager.getExchangePositions('binance');

      // 正しいポジションが返されることを確認
      expect(binancePositions.length).toBe(1);
      expect(binancePositions[0].symbol).toBe('SOL/USDT');
    });
  });

  describe('注文管理テスト', () => {
    beforeEach(() => {
      // テスト用に取引所を追加
      unifiedManager.addExchange('binance', mockExchangeService1, 1);
    });

    test('注文キャンセル', () => {
      // 注文をキャンセル
      const result1 = unifiedManager.cancelOrder('binance', 'order1');
      const result2 = unifiedManager.cancelOrder('binance', 'unknown');
      const result3 = unifiedManager.cancelOrder('unknown', 'order1');

      // 結果が正しいことを確認
      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(result3).toBe(false);

      // キャンセルメソッドが呼ばれたことを確認
      expect(OrderManagementSystem.prototype.cancelOrder).toHaveBeenCalledTimes(2);
    });

    test('全注文キャンセル', () => {
      // 全注文をキャンセル
      const result = unifiedManager.cancelAllOrders('binance');

      // 結果が正しいことを確認
      expect(result).toBe(true);

      // getOrdersとcancelOrderが呼ばれたことを確認
      expect(OrderManagementSystem.prototype.getOrders).toHaveBeenCalledTimes(1);
      expect(OrderManagementSystem.prototype.cancelOrder).toHaveBeenCalledTimes(2);
    });

    test('注文情報取得', () => {
      // 注文情報を取得
      const orders = unifiedManager.getOrders('binance');

      // 正しい注文情報が返されることを確認
      expect(orders.length).toBe(2);
      expect(orders[0].id).toBe('order1');
      expect(orders[1].id).toBe('order2');
    });

    test('全注文情報取得', () => {
      // 全注文情報を取得
      const allOrders = unifiedManager.getAllOrders();

      // 正しい注文情報が返されることを確認
      expect(allOrders.size).toBe(1);
      expect(allOrders.has('binance')).toBe(true);

      const binanceOrders = allOrders.get('binance');
      expect(binanceOrders.length).toBe(2);
    });
  });

  // TST-070: エラーハンドリングテストを追加
  describe('エラーハンドリングテスト', () => {
    test('無効な配分戦略の処理', () => {
      // 無効な配分戦略の設定を試みる
      expect(() => {
        unifiedManager.setAllocationStrategy({ strategy: 'INVALID_STRATEGY' });
      }).toThrow();
    });

    test('不十分な重みの処理', () => {
      // 取引所を追加
      unifiedManager.addExchange('binance', mockExchangeService1, 1);
      unifiedManager.addExchange('bybit', mockExchangeService2, 2);

      // 重み付き配分に設定するが、一部の取引所の重みが欠けている
      expect(() => {
        unifiedManager.setAllocationStrategy({
          strategy: AllocationStrategy.WEIGHTED,
          weights: { binance: 1.0 } // bybitの重みが欠けている
        });
      }).toThrow();
    });

    test('不適切な取引所IDの処理', () => {
      // 存在しない取引所IDで注文を作成
      const order = {
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 100,
        amount: 1
      };

      // 取引所が追加されていない状態での注文作成
      const orderIds = unifiedManager.createOrder(order);

      // 注文が作成されないことを確認
      expect(orderIds.size).toBe(0);
    });
  });
}); 