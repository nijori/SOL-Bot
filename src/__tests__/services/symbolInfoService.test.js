// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

/**
 * SymbolInfoService テスト
 *
 * 通貨ペア情報取得ユーティリティのテスト
 * TST-059: SymbolInfoServiceテストのモック設定と実行時間改善
 */

const { SymbolInfoService } = require('../../services/symbolInfoService');
const { ExchangeService } = require('../../services/exchangeService');
const { Types } = require('../../core/types');

// リソーストラッカーとテストクリーンアップ関連のインポート
const ResourceTracker = require('../../utils/test-helpers/resource-tracker');
const { 
  standardBeforeEach, 
  standardAfterEach, 
  standardAfterAll 
} = require('../../utils/test-helpers/test-cleanup');

// タイムアウト設定を増加
jest.setTimeout(60000);

// ExchangeServiceのモック
jest.mock('../../services/exchangeService');

// ロガーをモック
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// 共通のモックデータ
const mockMarketInfo = {
  symbol: 'BTC/USDT',
  base: 'BTC',
  quote: 'USDT',
  active: true,
  precision: {
    price: 2,
    amount: 6,
    cost: 8
  },
  limits: {
    price: { min: 0.01, max: 1000000 },
    amount: { min: 0.000001, max: 1000 },
    cost: { min: 10 }
  },
  info: {
    filters: [
      { filterType: 'PRICE_FILTER', tickSize: '0.01' },
      { filterType: 'LOT_SIZE', stepSize: '0.000001' }
    ]
  }
};

// 基本的なSymbolInfoServiceテスト - 基本機能
describe('SymbolInfoService - Basic Functions', () => {
  let symbolInfoService;
  let exchangeService;

  // テスト前に毎回モックをリセットし、リソーストラッカーを準備
  beforeEach(() => {
    jest.clearAllMocks();
    standardBeforeEach();
    
    // ExchangeServiceのモックを設定
    exchangeService = new ExchangeService();
    exchangeService.getMarketInfo = jest.fn().mockResolvedValue(mockMarketInfo);

    // 正しいモックを使用してSymbolInfoServiceのインスタンスを作成
    symbolInfoService = new SymbolInfoService(exchangeService);
  });

  // 各テスト後にリソース解放
  afterEach(async () => {
    await standardAfterEach();
  });

  // テストグループ完了後にクリーンアップを実行
  afterAll(async () => {
    await standardAfterAll();
  });

  it('通貨ペア情報を正しく取得できること', async () => {
    // テスト実行
    const result = await symbolInfoService.getSymbolInfo('BTC/USDT');

    // 検証
    expect(exchangeService.getMarketInfo).toHaveBeenCalledWith('BTC/USDT');
    expect(result.symbol).toBe('BTC/USDT');
    expect(result.base).toBe('BTC');
    expect(result.quote).toBe('USDT');
    expect(result.pricePrecision).toBe(2);
    expect(result.amountPrecision).toBe(6);
    expect(result.minAmount).toBe(0.000001);
    expect(result.tickSize).toBe(0.01);
    expect(result.stepSize).toBe(0.000001);
  });

  it('キャッシュから通貨ペア情報を取得できること', async () => {
    // 最初のリクエスト
    await symbolInfoService.getSymbolInfo('BTC/USDT');
    exchangeService.getMarketInfo.mockClear();

    // 2回目のリクエスト（キャッシュから取得されるはず）
    const result = await symbolInfoService.getSymbolInfo('BTC/USDT');

    // 検証
    expect(exchangeService.getMarketInfo).not.toHaveBeenCalled();
    expect(result.symbol).toBe('BTC/USDT');
  });
});

// キャッシュ関連のテスト - 別グループに分離
describe('SymbolInfoService - Cache Behavior', () => {
  let symbolInfoService;
  let exchangeService;

  beforeEach(() => {
    jest.clearAllMocks();
    standardBeforeEach();
    
    // ExchangeServiceのモックを設定
    exchangeService = new ExchangeService();
    exchangeService.getMarketInfo = jest.fn().mockResolvedValue(mockMarketInfo);

    // 正しいモックを使用してSymbolInfoServiceのインスタンスを作成
    symbolInfoService = new SymbolInfoService(exchangeService);
    
    // タイマーをモック
    jest.useFakeTimers({ doNotFake: [] });
  });

  afterEach(async () => {
    jest.resetAllMocks();
    jest.useRealTimers();
    await standardAfterEach();
  });

  afterAll(async () => {
    await standardAfterAll();
  });

  it('forceRefreshがtrueの場合はキャッシュをバイパスすること', async () => {
    // 最初のリクエスト
    await symbolInfoService.getSymbolInfo('BTC/USDT');
    exchangeService.getMarketInfo.mockClear();

    // forceRefresh=trueで2回目のリクエスト
    await symbolInfoService.getSymbolInfo('BTC/USDT', { ttl: 3600000, forceRefresh: true });

    // 検証
    expect(exchangeService.getMarketInfo).toHaveBeenCalledWith('BTC/USDT');
  });

  it('キャッシュTTLが切れた場合に再取得すること', async () => {
    // 最初のリクエスト
    await symbolInfoService.getSymbolInfo('BTC/USDT', { ttl: 100 });
    exchangeService.getMarketInfo.mockClear();

    // キャッシュTTLを経過させる
    jest.runAllTimers();
    jest.advanceTimersByTime(200);

    // 2回目のリクエスト（TTL切れのため再取得されるはず）
    await symbolInfoService.getSymbolInfo('BTC/USDT', { ttl: 100 });

    // 検証
    expect(exchangeService.getMarketInfo).toHaveBeenCalledWith('BTC/USDT');
  });
});

// エラーハンドリングのテスト - 別グループに分離
describe('SymbolInfoService - Error Handling', () => {
  let symbolInfoService;
  let exchangeService;

  beforeEach(() => {
    jest.clearAllMocks();
    standardBeforeEach();
    
    // ExchangeServiceのモックを設定
    exchangeService = new ExchangeService();
    exchangeService.getMarketInfo = jest.fn().mockResolvedValue(mockMarketInfo);

    // 正しいモックを使用してSymbolInfoServiceのインスタンスを作成
    symbolInfoService = new SymbolInfoService(exchangeService);
  });

  afterEach(async () => {
    await standardAfterEach();
  });

  afterAll(async () => {
    await standardAfterAll();
  });

  it('取得エラー時に適切にエラーを投げること', async () => {
    // エラーをシミュレート
    exchangeService.getMarketInfo.mockRejectedValueOnce(new Error('API error'));

    // テスト実行と検証
    await expect(symbolInfoService.getSymbolInfo('BTC/USDT')).rejects.toThrow(
      '通貨ペア情報の取得に失敗'
    );
  });
});

// 並列処理テスト - 別グループに分離
describe('SymbolInfoService - Concurrent Requests', () => {
  let symbolInfoService;
  let exchangeService;

  beforeEach(() => {
    jest.clearAllMocks();
    standardBeforeEach();
    
    // ExchangeServiceのモックを設定
    exchangeService = new ExchangeService();
    exchangeService.getMarketInfo = jest.fn().mockResolvedValue(mockMarketInfo);

    // 正しいモックを使用してSymbolInfoServiceのインスタンスを作成
    symbolInfoService = new SymbolInfoService(exchangeService);
  });

  afterEach(async () => {
    await standardAfterEach();
  });

  afterAll(async () => {
    await standardAfterAll();
  });

  it('並行リクエストを適切に処理すること', async () => {
    // 取得に時間がかかることをシミュレート
    const delayedPromise = new Promise((resolve) => {
      setTimeout(() => resolve(mockMarketInfo), 10);
    });
    exchangeService.getMarketInfo.mockReturnValueOnce(delayedPromise);

    // 並行リクエスト
    const promise1 = symbolInfoService.getSymbolInfo('BTC/USDT');
    const promise2 = symbolInfoService.getSymbolInfo('BTC/USDT');

    // 両方のプロミスを解決
    const [result1, result2] = await Promise.all([promise1, promise2]);

    // 検証（同じリクエストなので1回だけAPI呼び出しが行われるべき）
    expect(exchangeService.getMarketInfo).toHaveBeenCalledTimes(1);
    expect(result1).toEqual(result2);
  });
});

// 複数通貨ペア情報取得の新しいテスト
describe('SymbolInfoService - Multiple Symbols', () => {
  let symbolInfoService;
  let exchangeService;

  // ETH/USDTのモックデータ
  const mockEthMarketInfo = {
    ...mockMarketInfo,
    symbol: 'ETH/USDT',
    base: 'ETH',
    quote: 'USDT'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    standardBeforeEach();
    
    // ExchangeServiceのモックを設定
    exchangeService = new ExchangeService();
    exchangeService.getMarketInfo = jest.fn().mockImplementation((symbol) => {
      if (symbol === 'BTC/USDT') {
        return Promise.resolve(mockMarketInfo);
      } else if (symbol === 'ETH/USDT') {
        return Promise.resolve(mockEthMarketInfo);
      }
      return Promise.reject(new Error(`未知のシンボル: ${symbol}`));
    });

    // 正しいモックを使用してSymbolInfoServiceのインスタンスを作成
    symbolInfoService = new SymbolInfoService(exchangeService);
  });

  afterEach(async () => {
    await standardAfterEach();
  });

  afterAll(async () => {
    await standardAfterAll();
  });

  it('複数の通貨ペア情報を一括取得できること', async () => {
    // テスト実行
    const result = await symbolInfoService.getMultipleSymbolInfo(['BTC/USDT', 'ETH/USDT']);

    // 検証
    expect(exchangeService.getMarketInfo).toHaveBeenCalledTimes(2);
    expect(result.size).toBe(2);
    expect(result.get('BTC/USDT')?.symbol).toBe('BTC/USDT');
    expect(result.get('ETH/USDT')?.symbol).toBe('ETH/USDT');
  });

  it('一部の通貨ペア情報取得に失敗しても続行できること', async () => {
    // 1つはエラーになるよう設定
    exchangeService.getMarketInfo = jest.fn().mockImplementation((symbol) => {
      if (symbol === 'BTC/USDT') {
        return Promise.resolve(mockMarketInfo);
      }
      return Promise.reject(new Error(`API error: ${symbol}`));
    });

    // テスト実行
    const result = await symbolInfoService.getMultipleSymbolInfo(['BTC/USDT', 'ETH/USDT']);

    // 検証
    expect(exchangeService.getMarketInfo).toHaveBeenCalledTimes(2);
    expect(result.size).toBe(1);
    expect(result.get('BTC/USDT')?.symbol).toBe('BTC/USDT');
  });
}); 