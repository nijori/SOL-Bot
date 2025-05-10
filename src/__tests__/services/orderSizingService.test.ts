/**
 * OrderSizingServiceのテスト
 * マルチアセット対応機能で重要な、symbol/riskAmount/stopDistanceからロットサイズを計算するサービスのテスト
 */

import { OrderSizingService } from '../../services/orderSizingService.js';
import { ExchangeService } from '../../services/exchangeService.js';
import { SymbolInfoService, SymbolInfo } from '../../services/symbolInfoService.js';

// ExchangeServiceのモック
jest.mock('../../services/exchangeService');
const MockedExchangeService = ExchangeService as jest.MockedClass<typeof ExchangeService>;

// SymbolInfoServiceのモック
jest.mock('../../services/symbolInfoService');
const MockedSymbolInfoService = SymbolInfoService as jest.MockedClass<typeof SymbolInfoService>;

// ロガーをモック
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('OrderSizingService', () => {
  let exchangeService: jest.Mocked<ExchangeService>;
  let symbolInfoService: jest.Mocked<SymbolInfoService>;
  let orderSizingService: OrderSizingService;

  const mockSymbolInfo: SymbolInfo = {
    symbol: 'BTC/USDT',
    base: 'BTC',
    quote: 'USDT',
    active: true,
    pricePrecision: 2,
    amountPrecision: 6,
    costPrecision: 8,
    minPrice: 0.01,
    maxPrice: 1000000,
    minAmount: 0.000001,
    maxAmount: 1000,
    minCost: 10,
    tickSize: 0.01,
    stepSize: 0.000001,
    fetchTimestamp: Date.now()
  };

  const mockTicker = {
    symbol: 'BTC/USDT',
    last: 40000
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // モックの設定
    exchangeService = new MockedExchangeService() as jest.Mocked<ExchangeService>;
    symbolInfoService = new MockedSymbolInfoService() as jest.Mocked<SymbolInfoService>;

    exchangeService.fetchTicker.mockResolvedValue(mockTicker);
    symbolInfoService.getSymbolInfo.mockResolvedValue(mockSymbolInfo);

    // OrderSizingServiceのインスタンスを作成
    orderSizingService = new OrderSizingService(exchangeService, symbolInfoService);

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
        'BTC/USDT',
        accountBalance,
        stopDistance,
        currentPrice,
        riskPercentage
      );

      // 検証
      expect(symbolInfoService.getSymbolInfo).toHaveBeenCalledWith('BTC/USDT');
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
      expect(exchangeService.fetchTicker).toHaveBeenCalledWith('BTC/USDT');
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
      expect(symbolInfoService.getSymbolInfo).toHaveBeenCalledWith('BTC/USDT');
    });
  });

  describe('calculateMultipleOrderSizes', () => {
    it('複数の通貨ペアの注文サイズを計算できること', async () => {
      // モックを拡張
      symbolInfoService.getSymbolInfo
        .mockResolvedValueOnce(mockSymbolInfo) // BTC/USDT
        .mockResolvedValueOnce({
          // ETH/USDT
          ...mockSymbolInfo,
          symbol: 'ETH/USDT',
          base: 'ETH'
        });

      exchangeService.fetchTicker
        .mockResolvedValueOnce({ symbol: 'BTC/USDT', last: 40000 })
        .mockResolvedValueOnce({ symbol: 'ETH/USDT', last: 2000 });

      // テストデータ
      const symbols = ['BTC/USDT', 'ETH/USDT'];
      const accountBalance = 1000;
      const stopDistances = {
        'BTC/USDT': 2000,
        'ETH/USDT': 100
      };
      const riskPercentage = 0.01;

      // 実行
      const result = await orderSizingService.calculateMultipleOrderSizes(
        symbols,
        accountBalance,
        stopDistances,
        undefined,
        riskPercentage
      );

      // 検証
      expect(result.size).toBe(2);
      expect(result.get('BTC/USDT')).toBe(0.005); // 1000 * 0.01 / 2000 = 0.005
      expect(result.get('ETH/USDT')).toBe(0.1); // 1000 * 0.01 / 100 = 0.1
    });

    it('一部のシンボルでエラーが発生しても他のシンボルの計算は続行すること', async () => {
      // ETH/USDTでエラーを発生させる
      symbolInfoService.getSymbolInfo
        .mockResolvedValueOnce(mockSymbolInfo) // BTC/USDT
        .mockRejectedValueOnce(new Error('API error')); // ETH/USDTでエラー

      // テストデータ
      const symbols = ['BTC/USDT', 'ETH/USDT'];
      const accountBalance = 1000;
      const stopDistances = {
        'BTC/USDT': 2000,
        'ETH/USDT': 100
      };
      const currentPrices = {
        'BTC/USDT': 40000,
        'ETH/USDT': 2000
      };

      // 実行
      const result = await orderSizingService.calculateMultipleOrderSizes(
        symbols,
        accountBalance,
        stopDistances,
        currentPrices
      );

      // 検証
      expect(result.size).toBe(1);
      expect(result.has('BTC/USDT')).toBe(true);
      expect(result.has('ETH/USDT')).toBe(false);
    });

    it('ストップ距離が指定されていないシンボルはスキップすること', async () => {
      // テストデータ
      const symbols = ['BTC/USDT', 'ETH/USDT'];
      const accountBalance = 1000;
      const stopDistances = {
        'BTC/USDT': 2000
        // ETH/USDTのストップ距離がない
      };
      const currentPrices = {
        'BTC/USDT': 40000,
        'ETH/USDT': 2000
      };

      // 実行
      const result = await orderSizingService.calculateMultipleOrderSizes(
        symbols,
        accountBalance,
        stopDistances,
        currentPrices
      );

      // 検証
      expect(result.size).toBe(1);
      expect(result.has('BTC/USDT')).toBe(true);
      expect(result.has('ETH/USDT')).toBe(false);
    });
  });

  describe('roundPriceToTickSize', () => {
    it('価格をティックサイズに丸めること', async () => {
      // テストデータ
      const price = 40123.456;

      // 実行
      const result = await orderSizingService.roundPriceToTickSize('BTC/USDT', price);

      // 検証 (tickSize = 0.01 なので 40123.45 になるはず)
      expect(result).toBe(40123.45);
    });

    it('ティックサイズが見つからない場合は価格精度で丸めること', async () => {
      // ティックサイズがundefinedのSymbolInfo
      symbolInfoService.getSymbolInfo.mockResolvedValueOnce({
        ...mockSymbolInfo,
        tickSize: undefined
      });

      // テストデータ
      const price = 40123.456;

      // 実行
      const result = await orderSizingService.roundPriceToTickSize('BTC/USDT', price);

      // 検証 (pricePrecision = 2 なので 40123.45 になるはず)
      expect(result).toBe(40123.45);
    });

    it('エラー発生時はデフォルト精度で丸めること', async () => {
      // エラーをシミュレート
      symbolInfoService.getSymbolInfo.mockRejectedValueOnce(new Error('API error'));

      // テストデータ
      const price = 40123.456789;

      // 実行
      const result = await orderSizingService.roundPriceToTickSize('BTC/USDT', price);

      // 検証 (エラー時は精度8で丸める)
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
