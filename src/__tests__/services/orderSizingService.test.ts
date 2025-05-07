/**
 * OrderSizingServiceのテスト
 * マルチアセット対応機能で重要な、symbol/riskAmount/stopDistanceからロットサイズを計算するサービスのテスト
 */

import { OrderSizingService } from '../../services/orderSizingService';
import { ExchangeService } from '../../services/exchangeService';

// ExchangeServiceのモック
jest.mock('../../services/exchangeService');
const MockedExchangeService = ExchangeService as jest.MockedClass<typeof ExchangeService>;

describe('OrderSizingService', () => {
  let orderSizingService: OrderSizingService;
  let mockExchangeService: jest.Mocked<ExchangeService>;

  beforeEach(() => {
    // テスト用のモックMarketInfoオブジェクト
    const mockMarketInfos: Record<string, any> = {
      'BTC/USDT': {
        id: 'btcusdt',
        symbol: 'BTC/USDT',
        base: 'BTC',
        quote: 'USDT',
        precision: {
          price: 2,
          amount: 5
        },
        limits: {
          amount: {
            min: 0.00001,
            max: 1000
          },
          price: {
            min: 0.01,
            max: 1000000
          },
          cost: {
            min: 10
          }
        }
      },
      'SOL/USDT': {
        id: 'solusdt',
        symbol: 'SOL/USDT',
        base: 'SOL',
        quote: 'USDT',
        precision: {
          price: 2,
          amount: 1
        },
        limits: {
          amount: {
            min: 0.1,
            max: 100000
          },
          price: {
            min: 0.01,
            max: 10000
          },
          cost: {
            min: 5
          }
        }
      },
      'ETH/USDT': {
        id: 'ethusdt',
        symbol: 'ETH/USDT',
        base: 'ETH',
        quote: 'USDT',
        precision: {
          price: 2,
          amount: 4
        },
        limits: {
          amount: {
            min: 0.0001,
            max: 10000
          },
          price: {
            min: 0.01,
            max: 100000
          },
          cost: {
            min: 5
          }
        }
      }
    };

    // ExchangeServiceのモック
    mockExchangeService = new MockedExchangeService() as jest.Mocked<ExchangeService>;
    mockExchangeService.getMarketInfo = jest.fn().mockImplementation((symbol) => {
      return mockMarketInfos[symbol] || null;
    });
    
    // fetchTickerのモックを追加
    mockExchangeService.fetchTicker = jest.fn().mockImplementation((symbol) => {
      const prices = {
        'BTC/USDT': 50000,
        'SOL/USDT': 100,
        'ETH/USDT': 3000
      };
      
      return Promise.resolve({
        symbol,
        last: prices[symbol as keyof typeof prices] || 1000,
        bid: prices[symbol as keyof typeof prices] * 0.999 || 999,
        ask: prices[symbol as keyof typeof prices] * 1.001 || 1001
      });
    });

    // OrderSizingServiceのインスタンス化
    orderSizingService = new OrderSizingService(mockExchangeService);
  });

  test('異なる通貨ペアで最小ロットサイズ制限を守る', async () => {
    // BTC/USDT - 最小ロットサイズ: 0.00001
    const btcSize = await orderSizingService.calculateOrderSize('BTC/USDT', 100, 1000);
    expect(btcSize).toBeGreaterThanOrEqual(0.00001);
    
    // SOL/USDT - 最小ロットサイズ: 0.1
    const solSize = await orderSizingService.calculateOrderSize('SOL/USDT', 100, 5);
    expect(solSize).toBeGreaterThanOrEqual(0.1);
  });

  test('最小注文価値（コスト）制限を守る', async () => {
    // BTC/USDT - 最小コスト: 10 USDT
    // 価格が50,000USDTの場合、最小量は10/50000 = 0.0002
    const btcPrice = 50000;
    const btcSize = await orderSizingService.calculateOrderSize('BTC/USDT', 100, 1000, btcPrice);
    expect(btcSize * btcPrice).toBeGreaterThanOrEqual(10);
    
    // SOL/USDT - 最小コスト: 5 USDT
    // 価格が100USDTの場合、最小量は5/100 = 0.05
    const solPrice = 100;
    const solSize = await orderSizingService.calculateOrderSize('SOL/USDT', 100, 5, solPrice);
    expect(solSize * solPrice).toBeGreaterThanOrEqual(5);
  });

  test('金額が不足している場合は可能な最大値を返す', async () => {
    // 利用可能残高: 100 USDT
    // リスク額: 100 * 0.01 = 1 USDT
    // ストップ距離: 1000 USD
    // 理論上のサイズ: 1 / 1000 = 0.001 BTC
    // ただし最小ロットサイズは0.00001で、コスト制限は10 USDT
    const availableBalance = 5; // 5 USDT
    const btcPrice = 50000;
    const btcSize = await orderSizingService.calculateOrderSize(
      'BTC/USDT', 
      availableBalance, 
      1000, 
      btcPrice, 
      0.01 // 1% リスク
    );
    
    // 金額不足のため、最小コスト制限かロットサイズの制約に基づいた値のうち大きい方を返す
    // 最小コスト制限: 10/50000 = 0.0002, これが最小ロットサイズ0.00001より大きいため採用される
    expect(btcSize).toBeCloseTo(0.0002, 5);
  });

  test('異なる通貨ペアでの精度に正しく対応する', async () => {
    // BTC/USDT - 数量精度: 5桁
    const btcSize = await orderSizingService.calculateOrderSize('BTC/USDT', 1000, 500, 50000);
    const btcSizeStr = btcSize.toString();
    const btcDecimalPlaces = btcSizeStr.includes('.') ? btcSizeStr.split('.')[1].length : 0;
    expect(btcDecimalPlaces).toBeLessThanOrEqual(5);
    
    // SOL/USDT - 数量精度: 1桁
    const solSize = await orderSizingService.calculateOrderSize('SOL/USDT', 1000, 10, 100);
    const solSizeStr = solSize.toString();
    const solDecimalPlaces = solSizeStr.includes('.') ? solSizeStr.split('.')[1].length : 0;
    expect(solDecimalPlaces).toBeLessThanOrEqual(1);
  });

  test('リスク計算が正しく行われる', async () => {
    // 利用可能残高: 1000 USDT
    // リスク率: 1% (0.01)
    // リスク額: 1000 * 0.01 = 10 USDT
    // ストップ距離: 500 USD
    // 期待されるサイズ: 10 / 500 = 0.02 BTC
    const btcSize = await orderSizingService.calculateOrderSize(
      'BTC/USDT', 
      1000, 
      500, 
      50000, 
      0.01
    );
    expect(btcSize).toBeCloseTo(0.02, 5);
  });

  test('マーケット情報が取得できない場合はエラーをスローする', async () => {
    await expect(
      orderSizingService.calculateOrderSize('XRP/USDT', 1000, 10)
    ).rejects.toThrow('マーケット情報が見つかりません: XRP/USDT');
  });

  test('ストップ距離が0または非常に小さい場合はフォールバック値を使用する', async () => {
    // ストップ距離が0
    const btcSizeWithZeroStop = await orderSizingService.calculateOrderSize(
      'BTC/USDT', 
      1000, 
      0, 
      50000, 
      0.01
    );
    expect(btcSizeWithZeroStop).toBeGreaterThan(0);
    
    // ストップ距離が非常に小さい
    const btcSizeWithTinyStop = await orderSizingService.calculateOrderSize(
      'BTC/USDT', 
      1000, 
      0.0000001, 
      50000, 
      0.01
    );
    expect(btcSizeWithTinyStop).toBeGreaterThan(0);
  });
}); 