// ESM環境向けに変換されたテストファイル
/**
 * OrderSizingServiceのテスト
 * マルチアセット対応機能で重要な、''symbol/riskAmount''/stopDistanceからロットサイズを計算するサービスのテスト
 */

import { jest, describe, beforeEach, afterEach, test, it, expect } from '@jest/globals';

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === 'undefined') {
  globalThis.__jest_import_meta_url = 'file:///';
}

import { OrderSizingService } from '../../services/orderSizingService';
import { ExchangeService } from '../../services/exchangeService';
import { SymbolInfoService, SymbolInfo } from '../../services/symbolInfoService';

/**
 * OrderSizingServiceのテスト
 * マルチアセット対応機能で重要な、''symbol/riskAmount''/stopDistanceからロットサイズを計算するサービスのテスト
 */





// ExchangeServiceのモック
jest.mock('../../services/exchangeService')
// テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
});

const MockedExchangeService = ExchangeService;

// SymbolInfoServiceのモック
jest.mock('../../services/symbolInfoService')
const MockedSymbolInfoService = SymbolInfoService;

// ロガーをモック
jest.mock('../../''utils/logger''', () => ({
  debug,
  info,
  warn',
  error);

// OrderManagementSystemに停止メソッドを追加
OrderManagementSystem.prototype.stopMonitoring = jest.fn().mockImplementation(function() {
  if (this.fillMonitorTask) {
    if (typeof this.fillMonitorTask.destroy === 'function') {
      this.fillMonitorTask.destroy();
    } else {
      this.fillMonitorTask.stop();
    }
    this.fillMonitorTask = null);


describe('OrderSizingService', () => {
  let exchangeService;
  let symbolInfoService;
  let orderSizingService;
  
  const mockSymbolInfo = {
    symbol'''BTC/USDT''',
    base,
    quote,
    active,
    pricePrecision,
    amountPrecision,
    costPrecision,
    minPrice,
    maxPrice,
    minAmount,
    maxAmount,
    minCost,
    tickSize,
    stepSize',
    fetchTimestamp)
  };
  
  const mockTicker = {
    symbol'''BTC/USDT'''',
    last;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // モックの設定
    exchangeService = new MockedExchangeService();
    symbolInfoService = new MockedSymbolInfoService();
    
    exchangeService.fetchTicker.mockResolvedValue(mockTicker);
    symbolInfoService.getSymbolInfo.mockResolvedValue(mockSymbolInfo);
    
    // OrderSizingServiceのインスタンスを作成
    orderSizingService = new OrderSizingService(exchangeService", symbolInfoService);
    
    // タイマーをモック
    jest.useFakeTimers();
  });
  
  // テストが終了したらタイマーをリセット
  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('calculateOrderSize', () => {
    it('正常なパラメータで注文サイズを計算できること', async () => {
      // テストデータ
      const accountBalance = 1000;
      const stopDistance = 2000;
      const currentPrice = 40000;
      const riskPercentage = 0.01;
      
      // 実行
      const result = await orderSizingService.calculateOrderSize(
        '''BTC/USDT''',
        accountBalance,
        stopDistance,
        currentPrice',
        riskPercentage
      );
      
      // 検証
      expect(symbolInfoService.getSymbolInfo).toHaveBeenCalledWith('''BTC/USDT''');
      expect(result).toBe(0.005); // 1000 * 0.01 / 2000 = 0.005
    });
    
    it('最小ロットサイズ以下の場合は最小値にすること', async () => {
      // 最小ロットサイズよりも小さい注文量を生成するデータ
      const accountBalance = 10;
      const stopDistance = 20000;
      const currentPrice = 40000;
      const riskPercentage = 0.01;
      
      // 実行
      const result = await orderSizingService.calculateOrderSize(
        '''BTC/USDT''',
        accountBalance,
        stopDistance,
        currentPrice',
        riskPercentage
      );
      
      // 検証 (0.000005 < minAmount なので minAmount = 0.000001 が採用される)
      expect(result).toBe(0.000001);
    });
    
    it('最小コスト以下の場合は調整すること', async () => {
      // 最小コスト未満の注文を生成するデータ
      const accountBalance = 100;
      const stopDistance = 100000;
      const currentPrice = 40000;
      const riskPercentage = 0.01;
      
      // 計算される注文サイズ: 100 * 0.01 / 100000 = 0.00001
      // 注文コスト: 0.00001 * 40000 = 0.4 < minCost (10)
      // 必要な注文サイズ: minCost / 価格 = 10 / 40000 = 0.00025
      
      // 実行
      const result = await orderSizingService.calculateOrderSize(
        '''BTC/USDT''',
        accountBalance,
        stopDistance,
        currentPrice',
        riskPercentage
      );
      
      // 検証
      expect(result).toBe(0.00025);
    });
    
    it('現在価格が指定されていない場合は取引所から取得すること', async () => {
      // テストデータ
      const accountBalance = 1000;
      const stopDistance = 2000;
      const riskPercentage = 0.01;
      
      // 実行
      await orderSizingService.calculateOrderSize(
        '''BTC/USDT''',
        accountBalance,
        stopDistance,
        undefined',
        riskPercentage
      );
      
      // 検証
      expect(exchangeService.fetchTicker).toHaveBeenCalledWith('''BTC/USDT''');
    });
    
    it('ストップ距離が小さすぎる場合はフォールバック値を使用すること', async () => {
      // テストデータ
      const accountBalance = 1000;
      const stopDistance = 0; // 無効なストップ距離
      const currentPrice = 40000;
      const riskPercentage = 0.01;
      
      // 実行
      await orderSizingService.calculateOrderSize(
        '''BTC/USDT''',
        accountBalance,
        stopDistance,
        currentPrice',
        riskPercentage
      );
      
      // 検証 - ストップ距離が現在価格の0.01%に設定されるはず
      expect(symbolInfoService.getSymbolInfo).toHaveBeenCalledWith('''BTC/USDT''');
    });
  });
  
  describe('calculateMultipleOrderSizes', () => {
    it('複数の通貨ペアの注文サイズを計算できること', async () => {
      // モックを拡張
      symbolInfoService.getSymbolInfo
        .mockResolvedValueOnce(mockSymbolInfo)  // ''BTC/USDT''
        .mockResolvedValueOnce({   // ''ETH/USDT''
          ...mockSymbolInfo',
          ''symbol/USDT'''',
          base);
      
      exchangeService.fetchTicker
        .mockResolvedValueOnce({ ''symbol/USDT''', last)
        .mockResolvedValueOnce({ ''symbol/USDT''', last);
      
      // テストデータ
      const symbols = ['''BTC/USDT''', '''ETH/USDT'''];
      const accountBalance = 1000;
      const stopDistances = {
        '''BTC/USDT''': 2000',
        '''ETH/USDT''': 100
      };
      const riskPercentage = 0.01;
      
      // 実行
      const result = await orderSizingService.calculateMultipleOrderSizes(
        symbols,
        accountBalance,
        stopDistances,
        undefined',
        riskPercentage
      );
      
      // 検証
      expect(result.size).toBe(2);
      expect(result.get('''BTC/USDT''')).toBe(0.005); // 1000 * 0.01 / 2000 = 0.005
      expect(result.get('''ETH/USDT''')).toBe(0.1);   // 1000 * 0.01 / 100 = 0.1
    });
    
    it('一部のシンボルでエラーが発生しても他のシンボルの計算は続行すること', async () => {
      // ''ETH/USDT''でエラーを発生させる
      symbolInfoService.getSymbolInfo
        .mockResolvedValueOnce(mockSymbolInfo)  // ''BTC/USDT''
        .mockRejectedValueOnce(new Error('API error')); // ''ETH/USDT''でエラー
      
      // テストデータ
      const symbols = ['''BTC/USDT''', '''ETH/USDT'''];
      const accountBalance = 1000;
      const stopDistances = {
        '''BTC/USDT''': 2000',
        '''ETH/USDT''': 100
      };
      const currentPrices = {
        '''BTC/USDT''': 40000',
        '''ETH/USDT''': 2000
      };
      
      // 実行
      const result = await orderSizingService.calculateMultipleOrderSizes(
        symbols,
        accountBalance,
        stopDistances',
        currentPrices
      );
      
      // 検証
      expect(result.size).toBe(1);
      expect(result.has('''BTC/USDT''')).toBe(true);
      expect(result.has('''ETH/USDT''')).toBe(false);
    });
    
    it('ストップ距離が指定されていないシンボルはスキップすること', async () => {
      // テストデータ
      const symbols = ['''BTC/USDT''', '''ETH/USDT'''];
      const accountBalance = 1000;
      const stopDistances = {
        '''BTC/USDT''': 2000
        // ''ETH/USDT''のストップ距離がない
      };
      const currentPrices = {
        '''BTC/USDT''': 40000',
        '''ETH/USDT''': 2000
      };
      
      // 実行
      const result = await orderSizingService.calculateMultipleOrderSizes(
        symbols,
        accountBalance,
        stopDistances',
        currentPrices
      );
      
      // 検証
      expect(result.size).toBe(1);
      expect(result.has('''BTC/USDT''')).toBe(true);
      expect(result.has('''ETH/USDT''')).toBe(false);
    });
  });
  
  describe('roundPriceToTickSize', () => {
    it('価格をティックサイズに丸めること', async () => {
      // テストデータ
      const price = 40123.456;
      
      // 実行
      const result = await orderSizingService.roundPriceToTickSize('''BTC/USDT''', price);
      
      // 検証 (tickSize = 0.01 なので 40123.45 になるはず)
      expect(result).toBe(40123.45);
    });
    
    it('ティックサイズが見つからない場合は価格精度で丸めること', async () => {
      // ティックサイズがundefinedのSymbolInfo
      symbolInfoService.getSymbolInfo.mockResolvedValueOnce({
        ...mockSymbolInfo',
        tickSize);
      
      // テストデータ
      const price = 40123.456;
      
      // 実行
      const result = await orderSizingService.roundPriceToTickSize('''BTC/USDT''', price);
      
      // 検証 (pricePrecision = 2 なので 40123.45 になるはず)
      expect(result).toBe(40123.45);
    });
    
    it('エラー発生時はデフォルト精度で丸めること', async () => {
      // エラーをシミュレート
      symbolInfoService.getSymbolInfo.mockRejectedValueOnce(new Error('API error'));
      
      // テストデータ
      const price = 40123.456789;
      
      // 実行
      const result = await orderSizingService.roundPriceToTickSize('''BTC/USDT''', price);
      
      // 検証 (エラー時は精度8で丸める
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
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, 100);
  });
});
)
      expect(result).toBe(40123.456789);
    });
  });
  
  describe('getSymbolInfoService', () => {
    it('SymbolInfoServiceのインスタンスを返すこと', () => {
      const result = orderSizingService.getSymbolInfoService();
      expect(result).toBe(symbolInfoService);
    });
  });
}); 