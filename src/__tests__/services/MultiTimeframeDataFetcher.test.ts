import { MultiTimeframeDataFetcher, Timeframe } from '../../data/MultiTimeframeDataFetcher';
import { ParquetDataStore } from '../../data/parquetDataStore';
import ccxt from 'ccxt';

// ParquetDataStoreをモック
jest.mock('../../data/parquetDataStore');

// ccxtモジュールをモック
jest.mock('ccxt', () => {
  // モックの取引所インスタンスを作成する関数
  const createMockExchange = () => {
    return {
      fetchOHLCV: jest.fn().mockImplementation(async (symbol, timeframe, since, limit) => {
        // モックのOHLCVデータを返す
        const baseTimestamp = Date.now() - (limit * getTimeframeMilliseconds(timeframe));
        const ohlcv = [];
        
        for (let i = 0; i < limit; i++) {
          const timestamp = baseTimestamp + (i * getTimeframeMilliseconds(timeframe));
          ohlcv.push([
            timestamp,  // timestamp
            100 + i,    // open
            105 + i,    // high
            95 + i,     // low
            102 + i,    // close
            1000 + i    // volume
          ]);
        }
        
        return ohlcv;
      })
    };
  };
  
  // タイムフレーム文字列をミリ秒に変換するヘルパー関数
  function getTimeframeMilliseconds(timeframe: string): number {
    const unit = timeframe.slice(-1);
    const value = parseInt(timeframe.slice(0, -1), 10);
    
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 60 * 1000; // デフォルトは1分
    }
  }
  
  // ccxtモジュールのモック
  return {
    // 各取引所のクラスをモックする
    binance: jest.fn().mockImplementation(() => createMockExchange()),
    kucoin: jest.fn().mockImplementation(() => createMockExchange()),
    bybit: jest.fn().mockImplementation(() => createMockExchange())
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

describe('MultiTimeframeDataFetcher', () => {
  let fetcher: MultiTimeframeDataFetcher;
  
  beforeEach(() => {
    // テスト前の準備
    jest.clearAllMocks();
    
    // ParquetDataStoreのモックをセットアップ
    (ParquetDataStore as jest.Mock).mockImplementation(() => {
      return {
        saveCandles: jest.fn().mockResolvedValue(true),
        close: jest.fn()
      };
    });
    
    // プロセス環境変数をモック
    process.env.USE_PARQUET = 'true';
    process.env.TRADING_PAIR = 'SOL/USDT';
    
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
    const binanceMock = (ccxt as any).binance;
    expect(binanceMock).toHaveBeenCalled();
    
    // fetchOHLCVが呼ばれたことを確認
    const binanceInstance = binanceMock.mock.results[0].value;
    expect(binanceInstance.fetchOHLCV).toHaveBeenCalledWith(
      'SOL/USDT',
      Timeframe.HOUR_1,
      undefined,
      expect.any(Number)
    );
    
    // ParquetDataStoreのsaveCandlesが呼ばれたことを確認
    const parquetStore = (ParquetDataStore as jest.Mock).mock.instances[0];
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
    const binanceInstance = (ccxt as any).binance.mock.results[0].value;
    expect(binanceInstance.fetchOHLCV).toHaveBeenCalledTimes(12); // 3取引所 × 4タイムフレーム
  });
  
  test('スケジュールジョブを開始できること', () => {
    const cronMock = require('node-cron');
    
    // 特定のタイムフレームのジョブを開始
    fetcher.startScheduledJob(Timeframe.MINUTE_15);
    
    // node-cron.scheduleが呼ばれたことを確認
    expect(cronMock.schedule).toHaveBeenCalledWith(
      '*/15 * * * *',  // 15分ごとのcron式
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
    const parquetStore = (ParquetDataStore as jest.Mock).mock.instances[0];
    expect(parquetStore.close).toHaveBeenCalled();
    
    // すべてのジョブが停止されたことを確認
    const cronMock = require('node-cron');
    const scheduledTasks = cronMock.schedule.mock.results;
    
    scheduledTasks.forEach((result: any) => {
      expect(result.value.stop).toHaveBeenCalled();
      expect(result.value.destroy).toHaveBeenCalled();
    });
  });
  
  test('取得エラー時にもクラッシュせずにfalseを返すこと', async () => {
    // fetchOHLCVを一時的にエラーを投げるようにオーバーライド
    const binanceInstance = (ccxt as any).binance.mock.results[0].value;
    const originalFetchOHLCV = binanceInstance.fetchOHLCV;
    
    binanceInstance.fetchOHLCV = jest.fn().mockRejectedValue(new Error('API Error'));
    
    // データ取得を実行
    const result = await fetcher.fetchAndSaveTimeframe(Timeframe.MINUTE_1);
    
    // 結果が失敗を示していることを確認
    expect(result).toBe(false);
    
    // モックを元に戻す
    binanceInstance.fetchOHLCV = originalFetchOHLCV;
  });
}); 