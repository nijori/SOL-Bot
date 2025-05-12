import { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

import { MultiTimeframeDataFetcher, Timeframe } from '../../data/MultiTimeframeDataFetcher';
import { ParquetDataStore } from '../../data/parquetDataStore';
import * as ccxt from 'ccxt';

// モック用のインターフェース定義
interface MockParquetDataStore {
  saveCandles: jest.Mock;
  close: jest.Mock;
}

// 追加: 取引所APIの型定義強化
interface MockExchangeAPI {
  fetchOHLCV: jest.Mock;
}

// 追加: インポート時に実際の取引所クラスをモックするためのインターフェース
interface MockCCXT {
  binance: jest.Mock;
  kucoin: jest.Mock;
  bybit: jest.Mock;
}

// ParquetDataStoreをモック
jest.mock('../../data/parquetDataStore.js');

// タイムフレーム文字列をミリ秒に変換するヘルパー関数
function getTimeframeMilliseconds(timeframe: string): number {
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
function createMockExchange(): MockExchangeAPI {
  return {
    fetchOHLCV: jest.fn().mockImplementation(async (
      symbol: string,
      timeframe: string,
      since?: number,
      limit?: number
    ): Promise<number[][]> => {
      // モックのOHLCVデータを返す
      const actualLimit = limit || 100;
      const baseTimestamp = Date.now() - actualLimit * getTimeframeMilliseconds(timeframe);
      const ohlcv: number[][] = [];

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
  } as unknown as typeof ccxt;
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
  let fetcher: MultiTimeframeDataFetcher;
  // 各取引所のモックインスタンスを保持する変数を型安全に定義
  let mockBinanceInstance: MockExchangeAPI;
  let mockKucoinInstance: MockExchangeAPI;
  let mockBybitInstance: MockExchangeAPI;
  // ParquetDataStoreモックインスタンス
  let mockParquetDataStore: MockParquetDataStore;
  // ccxtの型付きモック参照
  let mockCcxt: MockCCXT;

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
    (ParquetDataStore as jest.Mock).mockImplementation(() => mockParquetDataStore);

    // モック取引所インスタンスを初期化
    mockBinanceInstance = createMockExchange();
    mockKucoinInstance = createMockExchange();
    mockBybitInstance = createMockExchange();
    
    // ccxtモックに直接アクセス
    mockCcxt = jest.requireMock('ccxt') as unknown as MockCCXT;
    
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
    
    // 各スケジュールジョブにモックタスクを割り当て
    cronMock.schedule
      .mockReturnValueOnce(mockTasks[0])
      .mockReturnValueOnce(mockTasks[1])
      .mockReturnValueOnce(mockTasks[2])
      .mockReturnValueOnce(mockTasks[3]);
    
    // すべてのジョブを開始
    fetcher.startAllScheduledJobs();
    
    // closeメソッドを呼び出してクリーンアップ
    fetcher.close();
    
    // すべてのタスクがstop()とdestroy()で終了したことを確認
    mockTasks.forEach(task => {
      expect(task.stop).toHaveBeenCalled();
      expect(task.destroy).toHaveBeenCalled();
    });
    
    // ParquetDataStoreも閉じられたことを確認
    expect(mockParquetDataStore.close).toHaveBeenCalled();
  });
});
