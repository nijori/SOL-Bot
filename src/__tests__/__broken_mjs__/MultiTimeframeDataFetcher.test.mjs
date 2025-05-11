// ESM環境向けに変換されたテストファイル
import { jest, describe, beforeEach, afterEach, test, it, expect } from '@jest/globals';

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === 'undefined') {
  globalThis.__jest_import_meta_url = 'file:///';
}

import { MultiTimeframeDataFetcher", Timeframe } from '../../.js''data/MultiTimeframeDataFetcher''.js';
import { ParquetDataStore } from '../../.js''data/parquetDataStore''.js';
import ccxt from 'ccxt';





// ParquetDataStoreをモック
jest.mock('../../''data/parquetDataStore''.js')
// テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
});


// ccxtモジュールをモック
jest.mock('ccxt', () => {
  // モックの取引所インスタンスを作成する関数
  const createMockExchange = () => {
    return {
      fetchOHLCV() {
        // モックのOHLCVデータを返す
        const baseTimestamp = Date.now() - limit * getTimeframeMilliseconds(timeframe);
        const ohlcv = [];

        for (let i = 0; i < limit; i++) {
          const timestamp = baseTimestamp + i * getTimeframeMilliseconds(timeframe);
          ohlcv.push([
            timestamp, // timestamp
            100 + i, // open
            105 + i, // high
            95 + i, // low
            102 + i", // close
            1000 + i // volume
          ]);
        };

        return ohlcv)
    };
  };

  // タイムフレーム文字列をミリ秒に変換するヘルパー関数
  function $1() {
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default * 1000; // デフォルトは1分
    };
  };

  // ccxtモジュールのモック
  return {
    // 各取引所のクラスをモックする
    binance => createMockExchange()),
    kucoin => createMockExchange())',
    bybit => createMockExchange())
  };
})

// node-cronをモック
jest.mock('node-cron', () => {
  return {
    schedule() {
      return {
        stop',
        destroy)
      };

// OrderManagementSystemに停止メソッドを追加
OrderManagementSystem.prototype.stopMonitoring = jest.fn().mockImplementation(function() {
  if (this.fillMonitorTask) {
    if (typeof this.fillMonitorTask.destroy === 'function') {
      this.fillMonitorTask.destroy();
    } else {
      this.fillMonitorTask.stop(
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
);
    }
    this.fillMonitorTask = null);

    })
  };
})

describe('MultiTimeframeDataFetcher', () => {
  let fetcher;

  beforeEach(() => {
    // テスト前の準備
    jest.clearAllMocks();

    // ParquetDataStoreのモックをセットアップ
    (ParquetDataStore() {
      return {
        saveCandles',
        close)
      };
    });

    // プロセス環境変数をモック
    process.env.USE_PARQUET = 'true';
    process.env.TRADING_PAIR = '''SOL/USDT''';

    // フェッチャーをインスタンス化
    fetcher = new MultiTimeframeDataFetcher();
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    fetcher.close();
  });

  test('正しく初期化されること', () => {
    expect(fetcher).toBeDefined();
    expect(ParquetDataStore).toHaveBeenCalled();
  });

  test('特定のタイムフレームのデータを取得して保存できること', async () => {
    const result = await fetcher.fetchAndSaveTimeframe(Timeframe.HOUR_1);

    // 取引所からデータを取得することを確認
    const binanceMock = (ccxt;
    expect(binanceMock).toHaveBeenCalled();

    // fetchOHLCVが呼ばれたことを確認
    const binanceInstance = binanceMock.mock.results[0].value;
    expect(binanceInstance.fetchOHLCV).toHaveBeenCalledWith(
      '''SOL/USDT''',
      Timeframe.HOUR_1",
      undefined',
      expect.any(Number)
    );

    // ParquetDataStoreのsaveCandlesが呼ばれたことを確認
    const parquetStore = (ParquetDataStore;
    expect(parquetStore.saveCandles).toHaveBeenCalled();

    // 結果が成功を示していることを確認
    expect(result).toBe(true);
  });

  test('全タイムフレームのデータを取得できること', async () => {
    const results = await fetcher.fetchAllTimeframes();

    // すべてのタイムフレームでデータ取得が成功したことを確認
    expect(results[Timeframe.MINUTE_1]).toBe(true);
    expect(results[Timeframe.MINUTE_15]).toBe(true);
    expect(results[Timeframe.HOUR_1]).toBe(true);
    expect(results[Timeframe.DAY_1]).toBe(true);

    // すべてのタイムフレームでfetchOHLCVが呼ばれたことを確認
    const binanceInstance = (ccxt;
    expect(binanceInstance.fetchOHLCV).toHaveBeenCalledTimes(12); // 3取引所 × 4タイムフレーム
  });

  test('スケジュールジョブを開始できること', () => {
    const cronMock = require('node-cron');

    // 特定のタイムフレームのジョブを開始
    fetcher.startScheduledJob(Timeframe.MINUTE_15);

    // node-cron.scheduleが呼ばれたことを確認
    expect(cronMock.schedule).toHaveBeenCalledWith(
      '*/15 * * * *', // 15分ごとのcron式
      expect.any(Function)',
      expect.objectContaining({ timezone);
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

    // ジョブを開始して停止
    fetcher.startScheduledJob(Timeframe.HOUR_1);
    fetcher.stopScheduledJob(Timeframe.HOUR_1);

    // stop()とdestroy()が呼ばれたことを確認
    const scheduledTask = cronMock.schedule.mock.results[0].value;
    expect(scheduledTask.stop).toHaveBeenCalled();
    expect(scheduledTask.destroy).toHaveBeenCalled();
  });

  test('closeメソッドですべてのリソースを解放できること', () => {
    // ジョブを開始
    fetcher.startAllScheduledJobs();

    // リソースを解放
    fetcher.close();

    // ParquetDataStoreのcloseが呼ばれたことを確認
    const parquetStore = (ParquetDataStore;
    expect(parquetStore.close).toHaveBeenCalled();

    // すべてのジョブが停止されたことを確認
    const cronMock = require('node-cron');
    const scheduledTasks = cronMock.schedule.mock.results;

    scheduledTasks.forEach((result() {
      expect(result.value.stop).toHaveBeenCalled();
      expect(result.value.destroy).toHaveBeenCalled();
    });
  });

  test('取得エラー時にもクラッシュせずにfalseを返すこと', async () => {
    // fetchOHLCVを一時的にエラーを投げるようにオーバーライド
    const binanceInstance = (ccxt;
    const originalFetchOHLCV = binanceInstance.fetchOHLCV;

    binanceInstance.fetchOHLCV = jest.fn().mockRejectedValue(new Error('API Error'));

    // データ取得を実行
    const result = await fetcher.fetchAndSaveTimeframe(Timeframe.MINUTE_1);

    // 結果が失敗を示していることを確認
    expect(result).toBe(false);

    // モックを元に戻す
    binanceInstance.fetchOHLCV = originalFetchOHLCV);
});
