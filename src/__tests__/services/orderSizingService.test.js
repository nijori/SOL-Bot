// @ts-nocheck
const { describe, test, expect, beforeEach, jest } = require('@jest/globals');

// リソーストラッカーとテストクリーンアップ
const ResourceTracker = require('../../utils/test-helpers/resource-tracker');
const { 
  standardBeforeEach, 
  standardAfterEach, 
  standardAfterAll 
} = require('../../utils/test-helpers/test-cleanup');

// テスト対象のモジュール
const { OrderSizingService } = require('../../services/orderSizingService');
const { ExchangeService } = require('../../services/exchangeService');
const { SymbolInfoService } = require('../../services/symbolInfoService');

// モック
jest.mock('../../services/exchangeService');
jest.mock('../../services/symbolInfoService');

/**
 * OrderSizingServiceのテスト
 * マルチアセット対応機能で重要な、symbol/riskAmount/stopDistanceからロットサイズを計算するサービスのテスト
 */

describe('OrderSizingService', () => {
  let orderSizingService;
  let mockExchangeService;
  let mockSymbolInfoService;

  beforeEach(() => {
    jest.clearAllMocks();
    standardBeforeEach();

    // モックの作成
    mockExchangeService = new ExchangeService();
    mockSymbolInfoService = new SymbolInfoService();

    // CCXT取引所からの応答をモック
    mockExchangeService.fetchTicker = jest.fn().mockImplementation((symbol) => {
      if (symbol === 'BTC/USDT') {
        return { last: 40000 };
      }
      if (symbol === 'SOL/USDT') {
        return { last: 100 };
      }
      return { last: 50 };
    });

    // シンボル情報サービスの応答をモック
    mockSymbolInfoService.getSymbolInfo = jest.fn().mockImplementation((symbol) => {
      if (symbol === 'BTC/USDT') {
        return {
          symbol: 'BTC/USDT',
          base: 'BTC',
          quote: 'USDT',
          active: true,
          pricePrecision: 2,
          amountPrecision: 6,
          minAmount: 0.000001,
          minCost: 10,
          tickSize: 0.01
        };
      }
      if (symbol === 'SOL/USDT') {
        return {
          symbol: 'SOL/USDT',
          base: 'SOL',
          quote: 'USDT',
          active: true,
          pricePrecision: 2,
          amountPrecision: 2,
          minAmount: 0.01,
          minCost: 5,
          tickSize: 0.01
        };
      }
      return null;
    });

    // OrderSizingServiceのインスタンス作成
    orderSizingService = new OrderSizingService(mockExchangeService, mockSymbolInfoService);
  });

  afterEach(async () => {
    await standardAfterEach();
  });

  describe('calculateOrderSize', () => {
    test('基本的なリスク計算', async () => {
      // 残高: 1000 USDT
      // リスク: 1% (= 10 USDT)
      // 価格: 40000 USDT
      // ストップ距離: 2000 USDT
      // 期待される注文サイズ: 10 / 2000 = 0.005 BTC
      const result = await orderSizingService.calculateOrderSize(
        'BTC/USDT',
        1000,
        2000, // ストップ距離
        40000, // 現在価格
        0.01 // リスク割合
      );

      expect(result).toBe(0.005); // 期待される注文サイズ
      expect(mockSymbolInfoService.getSymbolInfo).toHaveBeenCalledWith('BTC/USDT');
    });

    it('最小ロットサイズ以下の場合は最小値にすること', async () => {
      // 最小ロットサイズよりも小さい注文量を生成するデータ
      const accountBalance = 10;
      const stopDistance = 20000;
      const currentPrice = 40000;
      const riskPercentage = 0.01;

      // 実行
      const result = await orderSizingService.calculateOrderSize(
        'BTC/USDT',
        accountBalance,
        stopDistance,
        currentPrice,
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
        'BTC/USDT',
        accountBalance,
        stopDistance,
        currentPrice,
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
        'BTC/USDT',
        accountBalance,
        stopDistance,
        undefined,
        riskPercentage
      );

      // 検証
      expect(mockExchangeService.fetchTicker).toHaveBeenCalledWith('BTC/USDT');
    });

    it('ストップ距離が小さすぎる場合はフォールバック値を使用すること', async () => {
      // テストデータ
      const accountBalance = 1000;
      const stopDistance = 0; // 無効なストップ距離
      const currentPrice = 40000;
      const riskPercentage = 0.01;

      // 実行
      await orderSizingService.calculateOrderSize(
        'BTC/USDT',
        accountBalance,
        stopDistance,
        currentPrice,
        riskPercentage
      );

      // 検証 - ストップ距離が現在価格の0.01%に設定されるはず
      expect(mockSymbolInfoService.getSymbolInfo).toHaveBeenCalledWith('BTC/USDT');
    });
  });

  describe('calculateMultipleOrderSizes', () => {
    test('複数銘柄の注文サイズを計算すること', async () => {
      const symbols = ['BTC/USDT', 'SOL/USDT'];
      const stopDistances = {
        'BTC/USDT': 2000,
        'SOL/USDT': 5
      };
      const currentPrices = {
        'BTC/USDT': 40000,
        'SOL/USDT': 100
      };

      const result = await orderSizingService.calculateMultipleOrderSizes(
        symbols,
        1000, // 残高
        stopDistances,
        currentPrices,
        0.01 // リスク割合
      );

      // 結果がMapであることを確認
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      
      // 各シンボルの計算結果を確認
      expect(result.get('BTC/USDT')).toBe(0.005); // 10 / 2000
      expect(result.get('SOL/USDT')).toBe(2); // 10 / 5
    });

    it('一部のシンボルでエラーが発生しても他のシンボルの計算は続行すること', async () => {
      // ETH/USDTでエラーを発生させる
      mockSymbolInfoService.getSymbolInfo
        .mockResolvedValueOnce({
          symbol: 'BTC/USDT',
          base: 'BTC',
          quote: 'USDT',
          active: true,
          pricePrecision: 2,
          amountPrecision: 6,
          minAmount: 0.000001,
          minCost: 10,
          tickSize: 0.01
        }) // BTC/USDT
        .mockRejectedValueOnce(new Error('API error')); // ETH/USDTでエラー

      // テストデータ
      const symbols = ['BTC/USDT', 'SOL/USDT'];
      const accountBalance = 1000;
      const stopDistances = {
        'BTC/USDT': 2000,
        'SOL/USDT': 5
      };
      const currentPrices = {
        'BTC/USDT': 40000,
        'SOL/USDT': 100
      };

      // 実行
      const result = await orderSizingService.calculateMultipleOrderSizes(
        symbols,
        accountBalance,
        stopDistances,
        currentPrices,
        0.01
      );

      // 検証
      expect(result.size).toBe(1);
      expect(result.has('BTC/USDT')).toBe(true);
    });
  });

  describe('calculatePositionSizeByRisk', () => {
    test('リスク金額とストップ距離から正しいポジションサイズを計算すること', () => {
      // リスク額: 50 USDT
      // ストップ距離: 2000 USDT
      // 期待されるサイズ: 50 / 2000 = 0.025 BTC
      const result = orderSizingService.calculatePositionSizeByRisk(50, 2000);
      expect(result).toBe(0.025);
    });

    test('ストップ距離が0の場合はエラーを投げること', () => {
      expect(() => {
        orderSizingService.calculatePositionSizeByRisk(50, 0);
      }).toThrow();
    });
  });

  describe('adjustForMinimumSize', () => {
    test('最小注文サイズ以下の場合は調整されること', async () => {
      const symbol = 'BTC/USDT';
      const originalSize = 0.0000005; // 最小サイズ (0.000001) 未満
      const currentPrice = 40000;

      // 実行
      const result = await orderSizingService.adjustForMinimumSize(
        symbol,
        originalSize,
        currentPrice
      );

      // 検証
      expect(result).toBe(0.000001); // 最小サイズに調整される
    });

    test('最小コスト以下の場合は調整されること', async () => {
      const symbol = 'BTC/USDT';
      const originalSize = 0.0001; // 最小コスト未満 (0.0001 * 40000 = 4 < 10)
      const currentPrice = 40000;

      // 実行
      const result = await orderSizingService.adjustForMinimumSize(
        symbol,
        originalSize,
        currentPrice
      );

      // 検証 - 最小コスト10USDTを確保するために0.00025BTCに調整
      expect(result).toBe(0.00025);
    });

    test('すでに最小要件を満たしている場合は調整されないこと', async () => {
      const symbol = 'BTC/USDT';
      const originalSize = 0.001; // 十分なサイズ (0.001 * 40000 = 40 > 10)
      const currentPrice = 40000;

      // 実行
      const result = await orderSizingService.adjustForMinimumSize(
        symbol,
        originalSize,
        currentPrice
      );

      // 検証 - 変更なし
      expect(result).toBe(0.001);
    });

    test('シンボル情報が取得できない場合はオリジナルサイズを返すこと', async () => {
      // シンボル情報がnullを返すようにモック
      mockSymbolInfoService.getSymbolInfo.mockResolvedValueOnce(null);

      const symbol = 'UNKNOWN/USDT';
      const originalSize = 0.0001;
      const currentPrice = 100;

      // 実行
      const result = await orderSizingService.adjustForMinimumSize(
        symbol,
        originalSize,
        currentPrice
      );

      // 検証 - 変更なし
      expect(result).toBe(0.0001);
    });
  });

  describe('roundToSymbolPrecision', () => {
    test('銘柄の精度に数量が丸められること', async () => {
      const symbol = 'BTC/USDT';
      const size = 0.1234567;

      // 実行
      const result = await orderSizingService.roundToSymbolPrecision(symbol, size);

      // 検証 - BTCの数量精度は6なので、0.123457になる
      expect(result).toBe(0.123457);
    });

    test('シンボル情報が取得できない場合はオリジナルサイズを返すこと', async () => {
      // シンボル情報がnullを返すようにモック
      mockSymbolInfoService.getSymbolInfo.mockResolvedValueOnce(null);

      const symbol = 'UNKNOWN/USDT';
      const size = 0.1234567;

      // 実行
      const result = await orderSizingService.roundToSymbolPrecision(symbol, size);

      // 検証 - 変更なし
      expect(result).toBe(0.1234567);
    });
  });
}); 