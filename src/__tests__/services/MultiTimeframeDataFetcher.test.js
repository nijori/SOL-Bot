// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

// core/typesの明示的なインポートを修正
const { Types, TimeFrame } = require('../../core/types');

const MultiTimeframeDataFetcherModule = require('../../data/MultiTimeframeDataFetcher');
const { MultiTimeframeDataFetcher, Timeframe } = MultiTimeframeDataFetcherModule;
const { ParquetDataStore } = require('../../data/parquetDataStore');
const ccxt = require('ccxt');

// ParquetDataStoreをモック
jest.mock('../../data/parquetDataStore');

// タイムフレーム文字列をミリ秒に変換するヘルパー関数
function getTimeframeMilliseconds(timeframe) {
  const unit = timeframe.slice(-1);
  const value = parseInt(timeframe.slice(0, -1), 10);

  switch (unit) {
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 60 * 1000; // デフォルトは1分
  }
}

// モックの交換所インスタンスを作成する関数
function createMockExchange() {
  return {
    fetchOHLCV: jest.fn().mockImplementation(async (
      symbol,
      timeframe,
      since,
      limit
    ) => {
      // モックのOHLCVデータを返す
      const actualLimit = limit || 100;
      const baseTimestamp = Date.now() - actualLimit * getTimeframeMilliseconds(timeframe);
      const ohlcv = [];

      for (let i = 0; i < actualLimit; i++) {
        const timestamp = baseTimestamp + i * getTimeframeMilliseconds(timeframe);
        ohlcv.push([
          timestamp, // timestamp
          100 + i, // open
          105 + i, // high
          95 + i, // low
          102 + i, // close
          1000 + i // volume
        ]);
      }

      return ohlcv;
    })
  };
}

// ccxtモジュールをモック化
jest.mock('ccxt', () => {
  // 明示的な取引所クラスファクトリー関数
  const createExchangeFactory = () => {
    return jest.fn().mockImplementation(() => createMockExchange());
  };

  // 各取引所のモックインスタンスを作成
  return {
    binance: createExchangeFactory(),
    kucoin: createExchangeFactory(),
    bybit: createExchangeFactory()
  };
});

// node-cronをモック
jest.mock('node-cron', () => {
  return {
    schedule: jest.fn().mockImplementation((expression, callback, options) => {
      return {
        stop: jest.fn(),
        destroy: jest.fn()
      };
    })
  };
});

// 環境変数のモック
const originalEnv = process.env;

describe('MultiTimeframeDataFetcher', () => {
  let fetcher;
  // 各取引所のモックインスタンスを保持する変数
  let mockBinanceInstance;
  let mockKucoinInstance;
  let mockBybitInstance;
  // ParquetDataStoreモックインスタンス
  let mockParquetDataStore;
  // ccxtのモック参照
  let mockCcxt;

  beforeEach(() => {
    // 環境変数を初期化
    process.env = { ...originalEnv, USE_PARQUET: 'true', TRADING_PAIR: 'SOL/USDT' };

    // テスト前の準備
    jest.clearAllMocks();

    // ParquetDataStoreのモックをセットアップ
    mockParquetDataStore = {
      saveCandles: jest.fn().mockResolvedValue(true),
      close: jest.fn()
    };
    ParquetDataStore.mockImplementation(() => mockParquetDataStore);

    // モック取引所インスタンスを初期化
    mockBinanceInstance = createMockExchange();
    mockKucoinInstance = createMockExchange();
    mockBybitInstance = createMockExchange();
    
    // ccxtモックに直接アクセス
    mockCcxt = jest.requireMock('ccxt');
    
    // 各取引所のモックを明示的に設定
    mockCcxt.binance.mockReturnValue(mockBinanceInstance);
    mockCcxt.kucoin.mockReturnValue(mockKucoinInstance);
    mockCcxt.bybit.mockReturnValue(mockBybitInstance);

    // フェッチャーをインスタンス化
    fetcher = new MultiTimeframeDataFetcher();
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    fetcher.close();
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  test('正しく初期化されること', () => {
    expect(fetcher).toBeDefined();
    expect(ParquetDataStore).toHaveBeenCalled();
  });

  test('特定のタイムフレームのデータを取得して保存できること', async () => {
    const result = await fetcher.fetchAndSaveTimeframe(Timeframe.HOUR_1);

    // 取引所モックのメソッドが呼ばれたことを確認
    expect(mockBinanceInstance.fetchOHLCV).toHaveBeenCalledWith(
      'SOL/USDT',
      Timeframe.HOUR_1,
      undefined,
      expect.any(Number)
    );

    // ParquetDataStoreの保存メソッドが呼ばれたことを確認
    expect(mockParquetDataStore.saveCandles).toHaveBeenCalled();

    // 結果が成功を示していること
    expect(result).toBe(true);
  });

  test('全タイムフレームのデータを取得できること', async () => {
    const results = await fetcher.fetchAllTimeframes();

    // すべてのタイムフレームでデータ取得が成功
    expect(results[Timeframe.MINUTE_1]).toBe(true);
    expect(results[Timeframe.MINUTE_15]).toBe(true);
    expect(results[Timeframe.HOUR_1]).toBe(true);
    expect(results[Timeframe.DAY_1]).toBe(true);

    // 各タイムフレームで取引所のfetchOHLCVが呼ばれた
    const timeframes = [Timeframe.MINUTE_1, Timeframe.MINUTE_15, Timeframe.HOUR_1, Timeframe.DAY_1];
    
    // binanceのfetchOHLCVが各タイムフレームで呼ばれていることを確認
    timeframes.forEach(timeframe => {
      expect(mockBinanceInstance.fetchOHLCV).toHaveBeenCalledWith(
        'SOL/USDT',
        timeframe,
        undefined,
        expect.any(Number)
      );
    });
  });

  test('スケジュールジョブを開始できること', () => {
    const cronMock = require('node-cron');

    // 特定のタイムフレームのジョブを開始
    fetcher.startScheduledJob(Timeframe.MINUTE_15);

    // node-cron.scheduleが呼ばれたことを確認
    expect(cronMock.schedule).toHaveBeenCalledWith(
      '*/15 * * * *', // 15分ごとのcron式
      expect.any(Function),
      expect.objectContaining({ timezone: 'UTC' })
    );
  });

  test('すべてのスケジュールジョブを開始できること', () => {
    const cronMock = require('node-cron');

    // すべてのタイムフレームのジョブを開始
    fetcher.startAllScheduledJobs();

    // 各タイムフレームに対してscheduleが呼ばれたことを確認
    expect(cronMock.schedule).toHaveBeenCalledTimes(4); // 4つのタイムフレーム
  });

  test('スケジュールジョブを停止できること', () => {
    const cronMock = require('node-cron');

    // モックタスクを作成
    const mockTask = {
      stop: jest.fn(),
      destroy: jest.fn()
    };
    cronMock.schedule.mockReturnValueOnce(mockTask);
    
    // ジョブを開始
    fetcher.startScheduledJob(Timeframe.HOUR_1);
    
    // ジョブを停止
    fetcher.stopScheduledJob(Timeframe.HOUR_1);

    // stop()とdestroy()が呼ばれたことを確認
    expect(mockTask.stop).toHaveBeenCalled();
    expect(mockTask.destroy).toHaveBeenCalled();
  });

  test('closeメソッドですべてのリソースを解放できること', () => {
    const cronMock = require('node-cron');
    
    // モックタスクを作成
    const mockTasks = Array(4).fill(0).map(() => ({
      stop: jest.fn(),
      destroy: jest.fn()
    }));
    
    // スケジュールジョブを開始
    [Timeframe.MINUTE_1, Timeframe.MINUTE_15, Timeframe.HOUR_1, Timeframe.DAY_1].forEach((timeframe, index) => {
      cronMock.schedule.mockReturnValueOnce(mockTasks[index]);
      fetcher.startScheduledJob(timeframe);
    });
    
    // クローズメソッドを呼び出す
    fetcher.close();
    
    // すべてのタスクでstop()とdestroy()が呼ばれていることを確認
    mockTasks.forEach(task => {
      expect(task.stop).toHaveBeenCalled();
      expect(task.destroy).toHaveBeenCalled();
    });
    
    // ParquetDataStoreのclose()も呼ばれていることを確認
    expect(mockParquetDataStore.close).toHaveBeenCalled();
  });

  test('データ取得エラーが発生しても処理を続行できること', async () => {
    // 特定のタイムフレームでエラーを発生させる
    mockBinanceInstance.fetchOHLCV.mockRejectedValueOnce(new Error('API error'));
    
    // fetchAllTimeframesを実行
    const results = await fetcher.fetchAllTimeframes();
    
    // エラーが発生したタイムフレームはfalseが返されるはず
    expect(results[Timeframe.MINUTE_1]).toBe(false);
    
    // エラーが発生していないタイムフレームはtrueが返されるはず
    expect(results[Timeframe.MINUTE_15]).toBe(true);
    expect(results[Timeframe.HOUR_1]).toBe(true);
    expect(results[Timeframe.DAY_1]).toBe(true);
  });

  test('バックアップ取引所を使用できること', async () => {
    // プライマリ取引所でエラーを発生させる
    mockBinanceInstance.fetchOHLCV.mockRejectedValueOnce(new Error('API error'));
    
    // バックアップ取引所を使用
    const result = await fetcher.fetchAndSaveTimeframe(Timeframe.HOUR_1);
    
    // バックアップ取引所のfetchOHLCVが呼ばれたことを確認
    expect(mockKucoinInstance.fetchOHLCV).toHaveBeenCalledWith(
      'SOL/USDT',
      Timeframe.HOUR_1,
      undefined,
      expect.any(Number)
    );
    
    // 結果が成功を示していること
    expect(result).toBe(true);
  });
}); 