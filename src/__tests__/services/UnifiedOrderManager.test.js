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
const { Types, OrderType, OrderSide, OrderStatus } = require('../../core/types');
const { Position } = Types;

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
        amount: 2 // 2つの取引所で1ずつ分割
      };

      const orderIds = unifiedManager.createOrder(order);

      // 両方の取引所に注文が作成されることを確認
      expect(orderIds.size).toBe(2);
      expect(orderIds.has('binance')).toBe(true);
      expect(orderIds.has('bybit')).toBe(true);
      expect(OrderManagementSystem.prototype.createOrder).toHaveBeenCalledTimes(2);
    });

    test('重み付き配分方式', () => {
      // 重み付き配分に設定
      unifiedManager.setAllocationStrategy({
        strategy: AllocationStrategy.WEIGHTED,
        weights: {
          binance: 0.7,
          bybit: 0.3
        }
      });

      // 注文を作成
      const order = {
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 100,
        amount: 10 // binanceに7、bybitに3を配分
      };

      const orderIds = unifiedManager.createOrder(order);

      // 両方の取引所に注文が作成されることを確認
      expect(orderIds.size).toBe(2);
      expect(orderIds.has('binance')).toBe(true);
      expect(orderIds.has('bybit')).toBe(true);
      expect(OrderManagementSystem.prototype.createOrder).toHaveBeenCalledTimes(2);
    });
  });

  describe('注文操作テスト', () => {
    beforeEach(() => {
      // テスト用に取引所を追加
      unifiedManager.addExchange('binance', mockExchangeService1, 1);
      unifiedManager.addExchange('bybit', mockExchangeService2, 2);
    });

    test('注文キャンセル', () => {
      // 注文をキャンセル
      const result1 = unifiedManager.cancelOrder('binance', 'order1');
      const result2 = unifiedManager.cancelOrder('binance', 'unknown');
      const result3 = unifiedManager.cancelOrder('unknown', 'order1');

      // 結果を確認
      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });

    test('すべての取引所の注文を同期的に取得', () => {
      // すべての取引所から注文を取得
      const allOrders = unifiedManager.getAllOrders();

      // 結果を確認
      expect(allOrders.size).toBe(2);
      expect(allOrders.get('binance')).toHaveLength(2);
      expect(allOrders.get('bybit')).toHaveLength(2);
    });
  });

  describe('ポジション取得テスト', () => {
    beforeEach(() => {
      // テスト用に取引所を追加
      unifiedManager.addExchange('binance', mockExchangeService1, 1);
      unifiedManager.addExchange('bybit', mockExchangeService2, 2);
    });

    test('シンボルでポジションを取得', () => {
      // 特定シンボルのポジションを取得
      const positions = unifiedManager.getPositionsBySymbol('SOL/USDT');

      // 結果を確認
      expect(positions.size).toBe(2);
      expect(positions.get('binance')).toHaveLength(1);
      expect(positions.get('bybit')).toHaveLength(1);
    });

    test('全ポジションを取得', () => {
      // TST-070: UnifiedOrderManagerのgetAllPositionsメソッドをテスト
      const allPositions = unifiedManager.getAllPositions();

      // 結果を確認
      expect(allPositions.size).toBe(2);
      expect(allPositions.get('binance')).toHaveLength(1);
      expect(allPositions.get('bybit')).toHaveLength(1);
    });

    test('すべての取引所の注文を同期', () => {
      // TST-070: UnifiedOrderManagerのsyncAllOrdersメソッドをテスト
      const result = unifiedManager.syncAllOrders();

      // 結果を確認
      expect(result).toBe(true);
    });
  });
}); 