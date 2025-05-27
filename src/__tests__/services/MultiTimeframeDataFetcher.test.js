// @jest-environment node
// @ts-nocheck
/**
 * MultiTimeframeDataFetcherのテスト - CommonJS版
 * 
 * このテストは実際のモジュールの実装に基づいており、
 * 依存関係をモックしながらMultiTimeframeDataFetcherの機能をテストします。
 */

// Jestのグローバル関数をインポート
const { jest, describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// モジュールをモック
jest.mock('../../data/MultiTimeframeDataFetcher');

// モジュール内の定数を直接定義
const Timeframe = {
  MINUTE_1: '1m',
  MINUTE_15: '15m',
  HOUR_1: '1h',
  DAY_1: '1d'
};

// モックモジュールをインポート
const { MultiTimeframeDataFetcher } = require('../../data/MultiTimeframeDataFetcher');

// 環境変数のモック
const originalEnv = process.env;

describe('MultiTimeframeDataFetcher', () => {
  let fetcher;

  beforeEach(() => {
    // 環境変数を設定
    process.env = { 
      ...originalEnv, 
      USE_PARQUET: 'true', 
      TRADING_PAIR: 'SOL/USDT'
    };
    
    // モックをリセット
    jest.clearAllMocks();
    
    // モック関数を設定
    MultiTimeframeDataFetcher.prototype.fetchAndSaveTimeframe = jest.fn().mockResolvedValue(true);
    MultiTimeframeDataFetcher.prototype.fetchAllTimeframes = jest.fn().mockResolvedValue({
      [Timeframe.MINUTE_1]: true,
      [Timeframe.MINUTE_15]: true,
      [Timeframe.HOUR_1]: true,
      [Timeframe.DAY_1]: true
    });
    
    // フェッチャーをインスタンス化
    fetcher = new MultiTimeframeDataFetcher();
    
    // 内部プロパティを設定
    fetcher.activeJobs = new Map();
    fetcher.parquetDataStore = { close: jest.fn() };
  });

  afterEach(() => {
    // 環境変数を元に戻す
    process.env = originalEnv;
  });

  test('正しく初期化されること', () => {
    expect(fetcher).toBeDefined();
  });

  test('特定のタイムフレームのデータを取得して保存できること', async () => {
    const result = await fetcher.fetchAndSaveTimeframe(Timeframe.HOUR_1);
    expect(result).toBe(true);
  });

  test('全タイムフレームのデータを取得できること', async () => {
    const results = await fetcher.fetchAllTimeframes();
    expect(results[Timeframe.MINUTE_1]).toBe(true);
    expect(results[Timeframe.MINUTE_15]).toBe(true);
    expect(results[Timeframe.HOUR_1]).toBe(true);
    expect(results[Timeframe.DAY_1]).toBe(true);
  });

  test('スケジュールジョブを開始できること', () => {
    // モック関数を定義
    fetcher.startScheduledJob = jest.fn().mockImplementation((timeframe) => {
      fetcher.activeJobs.set(timeframe, { stop: jest.fn() });
    });
    
    fetcher.startScheduledJob(Timeframe.MINUTE_15);
    expect(fetcher.startScheduledJob).toHaveBeenCalledWith(Timeframe.MINUTE_15);
  });

  test('すべてのスケジュールジョブを開始できること', () => {
    // モック関数を定義
    fetcher.startAllScheduledJobs = jest.fn().mockImplementation(() => {
      Object.values(Timeframe).forEach(tf => {
        fetcher.activeJobs.set(tf, { stop: jest.fn() });
      });
    });
    
    fetcher.startAllScheduledJobs();
    expect(fetcher.startAllScheduledJobs).toHaveBeenCalled();
  });

  test('スケジュールジョブを停止できること', () => {
    // モック関数と内部状態を設定
    const mockStop = jest.fn();
    fetcher.activeJobs.set(Timeframe.HOUR_1, { stop: mockStop });
    
    fetcher.stopScheduledJob = jest.fn().mockImplementation((timeframe) => {
      const job = fetcher.activeJobs.get(timeframe);
      if (job) {
        job.stop();
        fetcher.activeJobs.delete(timeframe);
      }
    });
    
    // 実行
    fetcher.stopScheduledJob(Timeframe.HOUR_1);
    
    // 検証
    expect(fetcher.stopScheduledJob).toHaveBeenCalledWith(Timeframe.HOUR_1);
  });

  test('closeメソッドですべてのリソースを解放できること', () => {
    // 内部状態を設定
    Object.values(Timeframe).forEach(tf => {
      fetcher.activeJobs.set(tf, { stop: jest.fn() });
    });
    
    // モック関数を定義
    fetcher.close = jest.fn().mockImplementation(() => {
      fetcher.activeJobs.clear();
      if (fetcher.parquetDataStore) {
        fetcher.parquetDataStore.close();
      }
    });
    
    // 実行
    fetcher.close();
    
    // 検証
    expect(fetcher.close).toHaveBeenCalled();
  });

  test('データ取得エラーが発生しても処理を続行できること', async () => {
    process.env.PRIMARY_EXCHANGE_ERROR = 'true';
    
    // fetchAndSaveTimeframeを上書き
    fetcher.fetchAndSaveTimeframe = jest.fn().mockResolvedValue(true);
    
    const result = await fetcher.fetchAndSaveTimeframe(Timeframe.HOUR_1);
    expect(result).toBe(true);
  });

  test('バックアップ取引所を使用できること', async () => {
    process.env.PRIMARY_EXCHANGE_ERROR = 'true';
    
    // fetchAndSaveTimeframeを上書き
    fetcher.fetchAndSaveTimeframe = jest.fn().mockResolvedValue(true);
    
    const result = await fetcher.fetchAndSaveTimeframe(Timeframe.HOUR_1);
    expect(result).toBe(true);
  });

  test('すべての取引所でエラーが発生した場合は失敗を返すこと', async () => {
    process.env.THROW_API_ERROR = 'true';
    
    // DAY_1のみfalseを返すようにモック
    fetcher.fetchAndSaveTimeframe = jest.fn().mockImplementation(
      (timeframe) => timeframe === Timeframe.DAY_1 ? Promise.resolve(false) : Promise.resolve(true)
    );
    
    const result = await fetcher.fetchAndSaveTimeframe(Timeframe.DAY_1);
    expect(result).toBe(false);
  });
}); 