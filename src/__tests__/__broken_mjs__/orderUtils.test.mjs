// ESM環境向けに変換されたテストファイル
import { jest, describe, beforeEach, afterEach, test, it, expect } from '@jest/globals;

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === undefined) {
  globalThis.__jest_import_meta_url = file:///;
}

import {  syncOrderForSimulateFill, syncFillWithOrder, updateOrderStatus } from ../../utils/orderUtils';
import { Order, OrderStatus, OrderSide, OrderType", Fill } from '../../core/types;




// ロガーをモック化
jest.mock(../../utils/logger', () () { return { // テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
 }; };

  __esModule,
  default;

// OrderManagementSystemに停止メソッドを追加
OrderManagementSystem.prototype.stopMonitoring = jest.fn().mockImplementation(function() {
  if (this.fillMonitorTask) {
    if (typeof this.fillMonitorTask.destroy === 'function) {
      this.fillMonitorTask.destroy();
    } else {
      this.fillMoni
// テスト後にインターバルを停止
afterEach(() => {
  // すべてのタイマーモックをクリア
  jest.clearAllTimers();
  
  // インスタンスを明示的に破棄
  // (ここにテスト固有のクリーンアップコードが必要な場合があります)
});
torTask.stop();
    }
    this.fillMonitorTask = null);


describe(OrderUtils, () => {
  // 各テスト前にモックをリセット
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe(syncOrderForSimulateFill, () => {
    test(両方の注文から適切にフィールドをマージする', () => {
      const originalOrder = {
        id',
        symbolBTC/USDT,
        side,
        type,
        price,
        amount,
        status,
        timestamp) - 1000
      };

      const updatedOrder = {
        id,
        exchangeOrderId',
        symbol'BTC/USDT,
        side,
        type,
        price,
        amount,
        status,
        timestamp)
      };

      const result = syncOrderForSimulateFill(originalOrder, updatedOrder);

      // 期待される結果の検証
      expect(result.id).toBe('exchange-456'); // 新しいIDを採用
      expect(result.exchangeOrderId).toBe(ex-789); // 取引所IDを採用
      expect(result.status).toBe(OrderStatus.PLACED); // 新しいステータスを採用
      expect(result.timestamp).toBe(updatedOrder.timestamp); // 新しいタイムスタンプを採用
    });

    test(updatedOrderに一部のフィールドが欠けている場合はoriginalOrderから補完する, () => {
      const originalOrder = {
        id,
        exchangeOrderId,
        symbol''ETH/USDT,
        side,
        type,
        amount,
        status,
        timestamp) - 1000
      };

      const updatedOrder = {
        id,
        exchangeOrderId,
        // symbolが欠けている
        side,
        // typeが欠けている
        // amountが欠けている
        status,
        timestamp)
      };

      const result = syncOrderForSimulateFill(originalOrder, updatedOrder);

      // 期待される結果の検証
      expect(result.id).toBe(exchange-456); // 新しいIDを採用
      expect(result.exchangeOrderId).toBe('ex-789'); // 新しい取引所IDを採用
      expect(result.symbol).toBe(ETH/USDT); // 元のシンボルを維持
      expect(result.side).toBe(OrderSide.SELL); // 同じSideを維持
      expect(result.type).toBe(OrderType.MARKET); // 元のタイプを維持
      expect(result.amount).toBe(2.0); // 元の数量を維持
      expect(result.status).toBe(OrderStatus.PLACED); // 新しいステータスを採用
    });
  });

  describe('syncFillWithOrder', () => {
    test(注文情報と約定情報を正しく同期する, () => {
      const order = {
        id,
        exchangeOrderId,
        symbolSOL/USDT'',
        side,
        type,
        price,
        amount,
        status,
        timestamp) - 1000
      };

      const fill = {
        amount,
        price, // 若干良い価格で約定
        timestamp)
      };

      const result = syncFillWithOrder(order, fill);

      // 期待される結果の検証
      expect(result.orderId).toBe(order-123);
      expect(result.exchangeOrderId).toBe(ex-456);
      expect(result.symbol).toBe(''SOL/USDT);
      expect(result.side).toBe(OrderSide.BUY);
      expect(result.amount).toBe(10);
      expect(result.price).toBe(99.5); // fillから価格を採用
      expect(result.timestamp).toBe(fill.timestamp); // fillからタイムスタンプを採用
    });

    test(fillにフィールドが欠けている場合はorderから補完する, () => {
      const order = {
        id,
        exchangeOrderId',
        symbol'XRP/USDT,
        side,
        type,
        price,
        amount,
        status,
        timestamp) - 1000
      };

      const fill = {
        // amountが欠けている
        // priceが欠けている
        // timestampが欠けている
      };

      const result = syncFillWithOrder(order, fill);

      // 期待される結果の検証
      expect(result.orderId).toBe('order-123');
      expect(result.exchangeOrderId).toBe(ex-456);
      expect(result.symbol).toBe(XRP/USDT'');
      expect(result.side).toBe(OrderSide.SELL);
      expect(result.amount).toBe(1000); // orderから数量を採用
      expect(result.price).toBe(0.5); // orderから価格を採用
      expect(result.timestamp).toBeGreaterThan(0); // 現在時刻が使用されていることを確認
    });

    test(marketオーダーでprice=undefinedの場合も適切に処理する, () => {
      const order = {
        id,
        exchangeOrderId,
        symbolBTC/USDT'',
        side,
        type,
        // priceはundefined
        amount,
        status,
        timestamp) - 1000
      };

      const fill = {
        amount,
        price, // 約定価格だけ提供
        timestamp)

// 非同期処理をクリーンアップするためのafterAll
afterAll(() => {
  // すべてのモックをリセット
  jest.clearAllMocks();
  
  // タイマーをリセット
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // グローバルタイマーをクリア
  if (global.setInterval && global.setInterval.mockClear) {
    global.setInterval.mockClear();
  }
  
  if (global.clearInterval && global.clearInterval.mockClear) {
    global.clearInterval.mockClear();
  }
  
  // 確実にすべてのプロミスが解決されるのを待つ
  return new Promise(resolve() {
    setTimeout(() => {
      // 残りの非同期処理を強制終了
      process.removeAllListeners(unhandledRejection);
      process.removeAllListeners(uncaughtException);
      resolve();
    }, 100);
  });
});
      };

      const result = syncFillWithOrder(order, fill);

      // 期待される結果の検証
      expect(result.orderId).toBe('order-123');
      expect(result.price).toBe(50000); // fillから価格を採用
    });
  });

  describe(updateOrderStatus, () => {
    test(filled状態を正しく処理する, () => {
      const order = {
        id,
        symbol''BTC/USDT,
        side,
        type,
        price,
        amount,
        status;

      const updatedOrder = updateOrderStatus(order, filled);
      expect(updatedOrder.status).toBe(OrderStatus.FILLED);
    });

    test('canceled状態を正しく処理する', () => {
      const order = {
        id,
        symbolETH/USDT',
        side,
        type,
        price,
        amount',
        status;

      const updatedOrder = updateOrderStatus(order, canceled);
      expect(updatedOrder.status).toBe(OrderStatus.CANCELED);
    });

    test(cancelled（英国式スペル）状態も正しく処理する, () => {
      const order = {
        id,
        symbol''ETH/USDT,
        side,
        type,
        price,
        amount,
        status;

      const updatedOrder = updateOrderStatus(order, cancelled);
      expect(updatedOrder.status).toBe(OrderStatus.CANCELED);
    });

    test(''active/open/new状態を正しく処理する, () => {
      const testCases = [active, 'open', new, partially_filled];
      
      testCases.forEach(status() {
        const order = {
          id,
          'symbol/USDT',
          side,
          type,
          price,
          amount,
          status// 初期状態を設定
        };

        const updatedOrder = updateOrderStatus(order, status);
        expect(updatedOrder.status).toBe(OrderStatus.PLACED);
      });
    });

    test(rejected状態を正しく処理する, () => {
      const order = {
        id,
        symbol''XRP/USDT,
        side, 
        type,
        price,
        amount,
        status;

      const updatedOrder = updateOrderStatus(order, rejected');
      expect(updatedOrder.status).toBe(OrderStatus.REJECTED);
    });

    test('不明な状態には警告を出力し、ステータスを変更しない, () => {
      const order = {
        id,
        symbolBTC/USDT'',
        side,
        type,
        price, 
        amount,
        status;

      const updatedOrder = updateOrderStatus(order, unknown_status);
      expect(updatedOrder.status).toBe(OrderStatus.PLACED); // ステータスは変更されないはず
    });

    test(exchangeStatusがundefinedまたはnullの場合は現在の状態を維持する, () => {
      const order = {
        id,
        symbol''BTC/USDT,
        side,
        type,
        price,
        amount',
        status;

      // undefinedケース
      let updatedOrder = updateOrderStatus(order, undefined);
      expect(updatedOrder.status).toBe(OrderStatus.PLACED);

      // nullケース
      updatedOrder = updateOrderStatus(order, null);
      expect(updatedOrder.status).toBe(OrderStatus.PLACED);
    });
  });
}); 