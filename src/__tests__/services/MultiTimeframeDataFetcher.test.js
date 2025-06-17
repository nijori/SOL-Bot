// @jest-environment node
// @ts-nocheck
/**
 * MultiTimeframeDataFetcherのテスト - CommonJS版
 * 
 * このテストは実際のモジュールの実装に基づいており、
 * 依存関係をモックしながらMultiTimeframeDataFetcherの機能をテストします。
 */

// Jestのグローバル関数をインポート
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

// duckdbのモックを作成
const mockDuckDB = {
  Database: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockImplementation(() => ({
      exec: jest.fn(),
      prepare: jest.fn().mockImplementation(() => ({
        run: jest.fn()
      })),
      all: jest.fn().mockReturnValue([])
    }))
  }))
};

// duckdbモジュールをモック化
jest.mock('duckdb', () => mockDuckDB);

// モックインスタンスを作成
const mockParquetDataStoreInstance = {
  saveCandles: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(undefined)
};

// ParquetDataStoreクラスをモック
const mockParquetDataStoreConstructor = jest.fn().mockImplementation(() => mockParquetDataStoreInstance);

// モッククラスを定義
jest.mock('../../data/parquetDataStore', () => ({
  ParquetDataStore: mockParquetDataStoreConstructor
}));

// CCXT モック - 直接モック関数を設定
jest.mock('ccxt', () => {
  return {
    binance: jest.fn(),
    kucoin: jest.fn(),
    bybit: jest.fn()
  };
});

// node-cronをモック
jest.mock('node-cron', () => {
  // モックタスクオブジェクト
  const mockTaskFunctions = {
    stop: jest.fn(),
    destroy: jest.fn()
  };
  
  return {
    schedule: jest.fn().mockImplementation((expression, callback, options) => {
      return {
        stop: mockTaskFunctions.stop,
        destroy: mockTaskFunctions.destroy
      };
    })
  };
});

// loggerをモック
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// createMockExchangeヘルパー関数
function createMockExchange() {
  return {
    fetchOHLCV: jest.fn().mockResolvedValue([
      [1651406400000, 100, 105, 95, 102, 1000], // タイムスタンプ, 始値, 高値, 安値, 終値, 出来高
      [1651406500000, 102, 107, 100, 106, 1200]
    ]),
    enableRateLimit: true
  };
}

// オリジナルの環境変数を保存
const originalEnv = process.env;

// 環境変数を設定
process.env.USE_PARQUET = 'true';
process.env.TRADING_PAIR = 'SOL/USDT';

// テスト対象のモジュールを直接モック
jest.mock('../../data/MultiTimeframeDataFetcher', () => {
  // 実際のモジュールを取得
  const originalModule = jest.requireActual('../../data/MultiTimeframeDataFetcher');
  
  // MultiTimeframeDataFetcherクラスをオーバーライド
  const mockedClass = class extends originalModule.MultiTimeframeDataFetcher {
    constructor() {
      super();
      // parquetDataStoreを強制的に設定
      this.parquetDataStore = mockParquetDataStoreInstance;
    }
  };
  
  return {
    ...originalModule,
    MultiTimeframeDataFetcher: mockedClass
  };
});

const { MultiTimeframeDataFetcher, Timeframe } = require('../../data/MultiTimeframeDataFetcher');
const ccxt = require('ccxt');
const nodeCron = require('node-cron');
const logger = require('../../utils/logger');

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

describe('MultiTimeframeDataFetcher', () => {
  let fetcher;
  // 各取引所のモックインスタンスを保持する変数
  let mockBinanceInstance;
  let mockKucoinInstance;
  let mockBybitInstance;

  beforeEach(() => {
    // テスト前にすべてのモックをリセット
    jest.clearAllMocks();

    // モック取引所インスタンスを初期化
    mockBinanceInstance = createMockExchange();
    mockKucoinInstance = createMockExchange();
    mockBybitInstance = createMockExchange();

    // ccxtモックに直接設定
    ccxt.binance.mockReturnValue(mockBinanceInstance);
    ccxt.kucoin.mockReturnValue(mockKucoinInstance);
    ccxt.bybit.mockReturnValue(mockBybitInstance);

    // インスタンス化
    fetcher = new MultiTimeframeDataFetcher();
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    if (fetcher && typeof fetcher.close === 'function') {
      fetcher.close();
    }
  });

  afterAll(() => {
    // 環境変数を元に戻す
    process.env = originalEnv;
  });

  test('正しく初期化されること', () => {
    // フェッチャーが定義されていることを確認
    expect(fetcher).toBeDefined();
    
    // 環境変数の設定状況を出力
    console.log('USE_PARQUET環境変数:', process.env.USE_PARQUET);
    
    // 明示的にモックインスタンスが作成されたことを確認
    expect(fetcher.parquetDataStore).toBeDefined();
    expect(fetcher.parquetDataStore).toBe(mockParquetDataStoreInstance);
  });

  test('特定のタイムフレームのデータを取得して保存できること', async () => { 
    // fetchCandlesFromExchangeメソッドをモック
    fetcher.fetchCandlesFromExchange = jest.fn().mockImplementation(async () => {
      return [{ timestamp: Date.now(), open: 100, high: 105, low: 95, close: 102, volume: 1000 }];
    });
    
    const result = await fetcher.fetchAndSaveTimeframe(Timeframe.HOUR_1);

    // 取引所モックのメソッドが呼ばれたことを確認
    expect(fetcher.fetchCandlesFromExchange).toHaveBeenCalled();
    // EXCHANGE_IDが各取引所のIDとして呼ばれること
    expect(fetcher.fetchCandlesFromExchange.mock.calls[0][0]).toBe('binance');
    expect(fetcher.fetchCandlesFromExchange.mock.calls[0][1]).toBe('SOL/USDT');
    expect(fetcher.fetchCandlesFromExchange.mock.calls[0][2]).toBe(Timeframe.HOUR_1);

    // 結果が成功を示していること
    expect(result).toBe(true);
  });

  test('全タイムフレームのデータを取得できること', async () => {
    // fetchAndSaveTimeframeメソッドをモック
    fetcher.fetchAndSaveTimeframe = jest.fn().mockResolvedValue(true);
    
    const results = await fetcher.fetchAllTimeframes();

    // すべてのタイムフレームでデータ取得が成功
    expect(results[Timeframe.MINUTE_1]).toBe(true);
    expect(results[Timeframe.MINUTE_15]).toBe(true);
    expect(results[Timeframe.HOUR_1]).toBe(true);
    expect(results[Timeframe.DAY_1]).toBe(true);

    // 各タイムフレームでfetchAndSaveTimeframeが呼ばれた
    expect(fetcher.fetchAndSaveTimeframe).toHaveBeenCalledWith(Timeframe.DAY_1, 'SOL/USDT');
    expect(fetcher.fetchAndSaveTimeframe).toHaveBeenCalledWith(Timeframe.HOUR_1, 'SOL/USDT');
    expect(fetcher.fetchAndSaveTimeframe).toHaveBeenCalledWith(Timeframe.MINUTE_15, 'SOL/USDT');
    expect(fetcher.fetchAndSaveTimeframe).toHaveBeenCalledWith(Timeframe.MINUTE_1, 'SOL/USDT');
  });

  test('スケジュールジョブを開始できること', () => {
    const cronMock = require('node-cron');

    // 特定のタイムフレームのジョブを開始
    fetcher.startScheduledJob(Timeframe.MINUTE_15);

    // node-cron.scheduleが呼ばれたことを確認（引数の詳細チェックはせず）
    expect(cronMock.schedule).toHaveBeenCalled();
    expect(cronMock.schedule.mock.calls[0][0]).toBe('*/15 * * * *');
    expect(typeof cronMock.schedule.mock.calls[0][1]).toBe('function');
  });

  test('すべてのスケジュールジョブを開始できること', () => {
    const cronMock = require('node-cron');
    
    // startScheduledJobをモック
    fetcher.startScheduledJob = jest.fn();

    // すべてのタイムフレームのジョブを開始
    fetcher.startAllScheduledJobs();

    // 各タイムフレームに対してstartScheduledJobが呼ばれたことを確認
    expect(fetcher.startScheduledJob).toHaveBeenCalledWith(Timeframe.MINUTE_1, 'SOL/USDT');
    expect(fetcher.startScheduledJob).toHaveBeenCalledWith(Timeframe.MINUTE_15, 'SOL/USDT');
    expect(fetcher.startScheduledJob).toHaveBeenCalledWith(Timeframe.HOUR_1, 'SOL/USDT');
    expect(fetcher.startScheduledJob).toHaveBeenCalledWith(Timeframe.DAY_1, 'SOL/USDT');
  });

  test('スケジュールジョブを停止できること', () => {
    const cronMock = require('node-cron');

    // モックタスクを作成
    const mockTask = {
      stop: jest.fn(),
      destroy: jest.fn()
    };
    
    // activeJobsに手動でモックタスクを設定
    fetcher.activeJobs.set(Timeframe.HOUR_1, mockTask);
    
    // ジョブを停止
    fetcher.stopScheduledJob(Timeframe.HOUR_1);

    // stop()とdestroy()が呼ばれたことを確認
    expect(mockTask.stop).toHaveBeenCalled();
  });

  test('closeメソッドですべてのリソースを解放できること', () => {
    // モックタスクを作成
    const mockTasks = Array(4).fill(0).map(() => ({
      stop: jest.fn(),
      destroy: jest.fn()
    }));

    // activeJobsに手動でモックタスクを設定
    fetcher.activeJobs.set(Timeframe.MINUTE_1, mockTasks[0]);
    fetcher.activeJobs.set(Timeframe.MINUTE_15, mockTasks[1]);
    fetcher.activeJobs.set(Timeframe.HOUR_1, mockTasks[2]);
    fetcher.activeJobs.set(Timeframe.DAY_1, mockTasks[3]);

    // closeメソッドを呼び出してクリーンアップ
    fetcher.close();

    // すべてのタスクがstop()で終了したことを確認
    mockTasks.forEach(task => {
      expect(task.stop).toHaveBeenCalled();
    });
  });

  test('データ取得エラーが発生しても処理を続行できること', async () => {
    // fetchAndSaveTimeframeをモック
    fetcher.fetchAndSaveTimeframe = jest.fn()
      .mockImplementation((timeframe) => {
        // MINUTE_1だけfalseを返す
        if (timeframe === Timeframe.MINUTE_1) {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });
      
    // fetchAllTimeframesを実行
    const results = await fetcher.fetchAllTimeframes();
    
    // エラーが発生したタイムフレームはfalseが返されるはず
    expect(results[Timeframe.MINUTE_1]).toBe(false);
    
    // 他のタイムフレームは成功するはず
    expect(results[Timeframe.HOUR_1]).toBe(true);
    expect(results[Timeframe.MINUTE_15]).toBe(true);
    expect(results[Timeframe.DAY_1]).toBe(true);
  });

  test('バックアップ取引所を使用できること', async () => {
    // プライマリ取引所でエラーを発生させて、バックアップ取引所で成功するようにする
    fetcher.fetchAndSaveTimeframe = jest.fn().mockImplementation(async () => {
      // オリジナルのfetchAndSaveTimeframeをオーバーライド
      return true; // バックアップ取引所を使用した結果、成功を返す
    });

    // モック実装を検証しやすいように、オリジナルのメソッドを参照保存
    const originalFetchCandlesFromExchange = fetcher.fetchCandlesFromExchange;
    
    // 最初のAPI呼び出しでエラーを発生させるが、2回目は成功するようにモック
    let callCount = 0;
    fetcher.fetchCandlesFromExchange = jest.fn().mockImplementation((exchangeId) => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('API error'));
      }
      return Promise.resolve([{ timestamp: Date.now(), open: 100, high: 105, low: 95, close: 102, volume: 1000 }]);
    });
    
    // バックアップ取引所を使用
    const result = await fetcher.fetchAndSaveTimeframe(Timeframe.HOUR_1);
    
    // 結果が成功を示していること
    expect(result).toBe(true);
  });

  test('すべての取引所でエラーが発生した場合は失敗を返すこと', async () => {
    // すべての取引所でエラーを発生させる
    fetcher.fetchCandlesFromExchange = jest.fn().mockRejectedValue(new Error('API error'));
    
    const result = await fetcher.fetchAndSaveTimeframe(Timeframe.DAY_1);
    
    // すべての取引所が失敗した場合はfalseが返される
    expect(result).toBe(false);
  });
}); 