/**
 * UnifiedOrderManager テスト
 *
 * 複数取引所の注文を統合管理するクラスのテスト
 * OMS-009: 複数取引所対応
 */

import { UnifiedOrderManager, AllocationStrategy } from '../../services/UnifiedOrderManager.js';
import { ExchangeService } from '../../services/exchangeService.js';
import { OrderManagementSystem } from '../../core/orderManagementSystem.js';
import { Order, OrderSide, OrderType, OrderStatus, Position } from '../../core/types.js';

// モックの作成
jest.mock('../../services/exchangeService');
jest.mock('../../core/orderManagementSystem');

describe('UnifiedOrderManager', () => {
  let unifiedManager: UnifiedOrderManager;
  let mockExchangeService1: jest.Mocked<ExchangeService>;
  let mockExchangeService2: jest.Mocked<ExchangeService>;

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();

    // ExchangeServiceモックの作成
    mockExchangeService1 = new ExchangeService() as jest.Mocked<ExchangeService>;
    mockExchangeService2 = new ExchangeService() as jest.Mocked<ExchangeService>;

    // UnifiedOrderManagerのインスタンス作成
    unifiedManager = new UnifiedOrderManager();

    // モックメソッドの設定
    mockExchangeService1.getExchangeName = jest.fn().mockReturnValue('Binance');
    mockExchangeService2.getExchangeName = jest.fn().mockReturnValue('Bybit');

    // OrderManagementSystemのcreateOrderメソッドをモック
    OrderManagementSystem.prototype.createOrder = jest.fn().mockImplementation((order: Order) => {
      return `mock-order-id-${Math.random()}`;
    });

    // OrderManagementSystemのgetPositionsBySymbolメソッドをモック
    OrderManagementSystem.prototype.getPositionsBySymbol = jest
      .fn()
      .mockImplementation((symbol: string) => {
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
      .mockImplementation((orderId: string) => {
        return orderId === 'order1';
      });
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
      const order: Order = {
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
      const order1: Order = {
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 100,
        amount: 1
      };

      const order2: Order = {
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
      const order: Order = {
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 100,
        amount: 2
      };

      const orderIds = unifiedManager.createOrder(order);

      // 両方の取引所に注文が作成されることを確認
      expect(orderIds.size).toBe(2);
      expect(orderIds.has('binance')).toBe(true);
      expect(orderIds.has('bybit')).toBe(true);

      // 注文量が均等に分割されていることを確認
      expect(OrderManagementSystem.prototype.createOrder).toHaveBeenCalledTimes(2);

      // 分割された注文を検証
      const calls = (OrderManagementSystem.prototype.createOrder as jest.Mock).mock.calls;
      expect(calls[0][0].amount).toBe(1); // 1つ目の呼び出しの注文量
      expect(calls[1][0].amount).toBe(1); // 2つ目の呼び出しの注文量
    });

    test('カスタム配分方式', () => {
      // カスタム配分率を設定（binance: 70%, bybit: 30%）
      const customRatios = new Map<string, number>();
      customRatios.set('binance', 0.7);
      customRatios.set('bybit', 0.3);

      unifiedManager.setAllocationStrategy({
        strategy: AllocationStrategy.CUSTOM,
        customRatios
      });

      // 注文を作成
      const order: Order = {
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

      // 注文量が配分率に応じて分割されていることを確認
      expect(OrderManagementSystem.prototype.createOrder).toHaveBeenCalledTimes(2);

      // 分割された注文を検証
      const calls = (OrderManagementSystem.prototype.createOrder as jest.Mock).mock.calls;
      expect(calls[0][0].amount).toBe(7); // binance: 10 * 0.7 = 7
      expect(calls[1][0].amount).toBe(3); // bybit: 10 * 0.3 = 3
    });
  });

  describe('ポジション管理テスト', () => {
    beforeEach(() => {
      // テスト用に取引所を追加
      unifiedManager.addExchange('binance', mockExchangeService1, 1);
      unifiedManager.addExchange('bybit', mockExchangeService2, 2);
    });

    test('全ポジションの取得', () => {
      const positions = unifiedManager.getAllPositions('SOL/USDT');

      // 両方の取引所からポジションが取得されることを確認
      expect(positions.size).toBe(2);
      expect(positions.has('binance')).toBe(true);
      expect(positions.has('bybit')).toBe(true);

      // getPositionsBySymbolが呼ばれたことを確認
      expect(OrderManagementSystem.prototype.getPositionsBySymbol).toHaveBeenCalledTimes(2);
      expect(OrderManagementSystem.prototype.getPositionsBySymbol).toHaveBeenCalledWith('SOL/USDT');
    });

    test('合計ポジションの計算', () => {
      const totalPosition = unifiedManager.getTotalPosition('SOL/USDT');

      // 合計ポジションが計算されることを確認
      expect(totalPosition).not.toBeNull();
      expect(totalPosition?.symbol).toBe('SOL/USDT');
      expect(totalPosition?.amount).toBe(20); // 2つの取引所で各10
      expect(totalPosition?.side).toBe(OrderSide.BUY);

      // getPositionsBySymbolが呼ばれたことを確認
      expect(OrderManagementSystem.prototype.getPositionsBySymbol).toHaveBeenCalledTimes(2);
      expect(OrderManagementSystem.prototype.getPositionsBySymbol).toHaveBeenCalledWith('SOL/USDT');
    });
  });

  describe('注文管理テスト', () => {
    beforeEach(() => {
      // テスト用に取引所を追加
      unifiedManager.addExchange('binance', mockExchangeService1, 1);
      unifiedManager.addExchange('bybit', mockExchangeService2, 2);
    });

    test('注文キャンセル', () => {
      const result1 = unifiedManager.cancelOrder('binance', 'order1');
      const result2 = unifiedManager.cancelOrder('binance', 'unknown');
      const result3 = unifiedManager.cancelOrder('unknown', 'order1');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(result3).toBe(false);

      // cancelOrderが呼ばれたことを確認
      expect(OrderManagementSystem.prototype.cancelOrder).toHaveBeenCalledTimes(2);
      expect(OrderManagementSystem.prototype.cancelOrder).toHaveBeenCalledWith('order1');
    });

    test('全注文キャンセル', () => {
      const cancelCount = unifiedManager.cancelAllOrders('SOL/USDT');

      // キャンセルされた注文数を確認
      expect(cancelCount).toBe(2); // 2つの取引所で各1つ

      // getOrdersとcancelOrderが呼ばれたことを確認
      expect(OrderManagementSystem.prototype.getOrders).toHaveBeenCalledTimes(2);
      expect(OrderManagementSystem.prototype.cancelOrder).toHaveBeenCalledTimes(2);
    });
  });

  describe('注文同期テスト', () => {
    beforeEach(() => {
      // テスト用に取引所を追加
      unifiedManager.addExchange('binance', mockExchangeService1, 1);
      unifiedManager.addExchange('bybit', mockExchangeService2, 2);

      // syncOrdersメソッドをモック
      OrderManagementSystem.prototype.syncOrders = jest.fn().mockResolvedValue(2);
    });

    test('すべての取引所の注文同期', async () => {
      await unifiedManager.syncAllOrders();

      // syncOrdersが各取引所で呼ばれたことを確認
      expect(OrderManagementSystem.prototype.syncOrders).toHaveBeenCalledTimes(2);
    });
  });
});
