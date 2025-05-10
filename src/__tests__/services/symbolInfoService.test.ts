/**
 * SymbolInfoService テスト
 *
 * 通貨ペア情報取得ユーティリティのテスト
 */

import { SymbolInfoService, SymbolInfo } from '../../services/symbolInfoService.js';
import { ExchangeService } from '../../services/exchangeService.js';

// ExchangeServiceのモック
jest.mock('../../services/exchangeService');
const MockedExchangeService = ExchangeService as jest.MockedClass<typeof ExchangeService>;

// ロガーをモック
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('SymbolInfoService', () => {
  let symbolInfoService: SymbolInfoService;
  let exchangeService: jest.Mocked<ExchangeService>;

  // モックマーケット情報
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

  // テスト前の準備
  beforeEach(() => {
    jest.clearAllMocks();

    // ExchangeServiceのモックを設定
    exchangeService = new MockedExchangeService() as jest.Mocked<ExchangeService>;
    exchangeService.getMarketInfo = jest.fn().mockResolvedValue(mockMarketInfo);

    // SymbolInfoServiceのインスタンスを作成
    symbolInfoService = new SymbolInfoService(exchangeService);

    // タイマーをモック
    jest.useFakeTimers();
  });

  // テスト後の後処理
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getSymbolInfo', () => {
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
      jest.advanceTimersByTime(200);

      // 2回目のリクエスト（TTL切れのため再取得されるはず）
      await symbolInfoService.getSymbolInfo('BTC/USDT', { ttl: 100 });

      // 検証
      expect(exchangeService.getMarketInfo).toHaveBeenCalledWith('BTC/USDT');
    });

    it('取得エラー時に適切にエラーを投げること', async () => {
      // エラーをシミュレート
      exchangeService.getMarketInfo.mockRejectedValueOnce(new Error('API error'));

      // テスト実行と検証
      await expect(symbolInfoService.getSymbolInfo('BTC/USDT')).rejects.toThrow(
        '通貨ペア情報の取得に失敗'
      );
    });

    it('並行リクエストを適切に処理すること', async () => {
      // 取得に時間がかかることをシミュレート
      const delayedPromise = new Promise<any>((resolve) => {
        setTimeout(() => resolve(mockMarketInfo), 100);
      });
      exchangeService.getMarketInfo.mockReturnValueOnce(delayedPromise);

      // 並行リクエスト
      const promise1 = symbolInfoService.getSymbolInfo('BTC/USDT');
      const promise2 = symbolInfoService.getSymbolInfo('BTC/USDT');

      // 両方のプロミスを解決
      const [result1, result2] = await Promise.all([promise1, promise2]);

      // 検証
      expect(exchangeService.getMarketInfo).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });
  });

  describe('getMultipleSymbolInfo', () => {
    beforeEach(() => {
      // 複数シンボル用のモック設定
      exchangeService.getMarketInfo
        .mockResolvedValueOnce({
          ...mockMarketInfo,
          symbol: 'BTC/USDT'
        })
        .mockResolvedValueOnce({
          ...mockMarketInfo,
          symbol: 'ETH/USDT',
          base: 'ETH'
        });
    });

    it('複数の通貨ペア情報を一括取得できること', async () => {
      // テスト実行
      const result = await symbolInfoService.getMultipleSymbolInfo(['BTC/USDT', 'ETH/USDT']);

      // 検証
      expect(exchangeService.getMarketInfo).toHaveBeenCalledTimes(2);
      expect(result.get('BTC/USDT')?.base).toBe('BTC');
      expect(result.get('ETH/USDT')?.base).toBe('ETH');
    });

    it('重複したシンボルを一度だけ取得すること', async () => {
      // テスト実行
      await symbolInfoService.getMultipleSymbolInfo(['BTC/USDT', 'BTC/USDT', 'ETH/USDT']);

      // 検証
      expect(exchangeService.getMarketInfo).toHaveBeenCalledTimes(2);
    });

    it('一部のシンボル取得に失敗しても他のシンボルを返すこと', async () => {
      // ETH/USDTの取得に失敗するように設定
      exchangeService.getMarketInfo
        .mockResolvedValueOnce(mockMarketInfo) // BTC/USDT成功
        .mockRejectedValueOnce(new Error('API error')); // ETH/USDT失敗

      // テスト実行
      const result = await symbolInfoService.getMultipleSymbolInfo(['BTC/USDT', 'ETH/USDT']);

      // 検証
      expect(result.has('BTC/USDT')).toBe(true);
      expect(result.has('ETH/USDT')).toBe(false);
    });
  });

  describe('clearCache & refreshCache', () => {
    it('キャッシュをクリアできること', async () => {
      // キャッシュに格納
      await symbolInfoService.getSymbolInfo('BTC/USDT');
      exchangeService.getMarketInfo.mockClear();

      // キャッシュをクリア
      symbolInfoService.clearCache();

      // 再度取得
      await symbolInfoService.getSymbolInfo('BTC/USDT');

      // 検証
      expect(exchangeService.getMarketInfo).toHaveBeenCalledTimes(1);
    });

    it('特定のシンボルのキャッシュのみクリアできること', async () => {
      // 2つのシンボルをキャッシュに格納
      await symbolInfoService.getMultipleSymbolInfo(['BTC/USDT', 'ETH/USDT']);
      exchangeService.getMarketInfo.mockClear();

      // BTC/USDTのキャッシュのみクリア
      symbolInfoService.clearCache('BTC/USDT');

      // 再度取得
      await symbolInfoService.getMultipleSymbolInfo(['BTC/USDT', 'ETH/USDT']);

      // 検証
      expect(exchangeService.getMarketInfo).toHaveBeenCalledTimes(1);
      expect(exchangeService.getMarketInfo).toHaveBeenCalledWith('BTC/USDT');
    });

    it('期限切れのキャッシュを更新できること', async () => {
      // 2つのシンボルをキャッシュに格納（TTL = 100ms）
      await symbolInfoService.getMultipleSymbolInfo(['BTC/USDT', 'ETH/USDT'], { ttl: 100 });
      exchangeService.getMarketInfo.mockClear();

      // 時間を経過させてBTC/USDTのキャッシュのみ期限切れにする
      jest.advanceTimersByTime(200);

      // キャッシュを更新
      await symbolInfoService.refreshCache(['BTC/USDT', 'ETH/USDT'], 100);

      // 検証
      expect(exchangeService.getMarketInfo).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCacheStats', () => {
    it('キャッシュ統計を正しく取得できること', async () => {
      // キャッシュが空の場合
      const emptyStats = symbolInfoService.getCacheStats();
      expect(emptyStats.cacheSize).toBe(0);
      expect(emptyStats.oldestEntry).toBeNull();
      expect(emptyStats.newestEntry).toBeNull();

      // キャッシュにデータを追加
      await symbolInfoService.getSymbolInfo('BTC/USDT');
      jest.advanceTimersByTime(1000);
      await symbolInfoService.getSymbolInfo('ETH/USDT');

      // 統計を取得
      const stats = symbolInfoService.getCacheStats();
      expect(stats.cacheSize).toBe(2);
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });
  });

  describe('エクストラクター関数', () => {
    it('tickSizeを正しく抽出できること', async () => {
      // precision.priceからの計算
      exchangeService.getMarketInfo.mockResolvedValueOnce({
        ...mockMarketInfo,
        info: {}
      });
      const result1 = await symbolInfoService.getSymbolInfo('BTC/USDT');
      expect(result1.tickSize).toBe(0.01); // 10^(-2)

      // info.tickSizeから直接取得
      exchangeService.getMarketInfo.mockResolvedValueOnce({
        ...mockMarketInfo,
        precision: {},
        info: { tickSize: '0.05' }
      });
      const result2 = await symbolInfoService.getSymbolInfo('ETH/USDT');
      expect(result2.tickSize).toBe(0.05);

      // filtersから取得
      exchangeService.getMarketInfo.mockResolvedValueOnce({
        ...mockMarketInfo,
        precision: {},
        info: {
          filters: [{ filterType: 'PRICE_FILTER', tickSize: '0.001' }]
        }
      });
      const result3 = await symbolInfoService.getSymbolInfo('XRP/USDT');
      expect(result3.tickSize).toBe(0.001);
    });

    it('stepSizeを正しく抽出できること', async () => {
      // precision.amountからの計算
      exchangeService.getMarketInfo.mockResolvedValueOnce({
        ...mockMarketInfo,
        info: {}
      });
      const result1 = await symbolInfoService.getSymbolInfo('BTC/USDT');
      expect(result1.stepSize).toBe(0.000001); // 10^(-6)

      // info.stepSizeから直接取得
      exchangeService.getMarketInfo.mockResolvedValueOnce({
        ...mockMarketInfo,
        precision: {},
        info: { stepSize: '0.01' }
      });
      const result2 = await symbolInfoService.getSymbolInfo('ETH/USDT');
      expect(result2.stepSize).toBe(0.01);

      // filtersから取得
      exchangeService.getMarketInfo.mockResolvedValueOnce({
        ...mockMarketInfo,
        precision: {},
        info: {
          filters: [{ filterType: 'LOT_SIZE', stepSize: '0.1' }]
        }
      });
      const result3 = await symbolInfoService.getSymbolInfo('XRP/USDT');
      expect(result3.stepSize).toBe(0.1);
    });
  });
});
