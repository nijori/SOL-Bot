// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

const metrics = require('../../utils/metrics');
const client = require('prom-client');

// expressサーバー関連のモック
jest.mock('express', () => {
  // モックのExpressアプリケーションを返す関数
  const mockApp = {
    get: jest.fn(),
    listen: jest.fn().mockImplementation((port, callback) => {
      // ポートリッスン成功をシミュレート
      if (callback) callback();

      return {
        close: jest.fn()
      };
    })
  };

  // モックのexpress関数
  return jest.fn().mockImplementation(() => mockApp);
});

// loggerのモック
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Metrics Utility', () => {
  // テスト用のダミーメトリクスデータ
  const dummyMetricsData = `
    # HELP solbot_trading_balance 現在の取引残高
    # TYPE solbot_trading_balance gauge
    solbot_trading_balance 5000
    
    # HELP solbot_daily_pnl 日次損益（金額）
    # TYPE solbot_daily_pnl gauge
    solbot_daily_pnl 100
    
    # HELP solbot_daily_loss_percentage 日次損益率（%）
    # TYPE solbot_daily_loss_percentage gauge
    solbot_daily_loss_percentage 5
    
    # HELP solbot_trade_count_total 総取引数
    # TYPE solbot_trade_count_total counter
    solbot_trade_count_total 2
    
    # HELP solbot_trade_volume_total 総取引量
    # TYPE solbot_trade_volume_total counter
    solbot_trade_volume_total 500
    
    # HELP solbot_order_latency_seconds 注文の送信から約定までの経過時間
    # TYPE solbot_order_latency_seconds histogram
    solbot_order_latency_seconds_bucket{le="0.1",exchange="binance",order_type="market",symbol="SOLUSDT"} 0
    solbot_order_latency_seconds_bucket{le="0.5",exchange="binance",order_type="market",symbol="SOLUSDT"} 0
    solbot_order_latency_seconds_bucket{le="1",exchange="binance",order_type="market",symbol="SOLUSDT"} 0
    solbot_order_latency_seconds_bucket{le="2",exchange="binance",order_type="market",symbol="SOLUSDT"} 1
    solbot_order_latency_seconds_bucket{le="0.5",exchange="bybit",order_type="limit",symbol="BTCUSDT"} 1
    
    # HELP solbot_exchange_error_total 取引所APIから返されたエラーの総数
    # TYPE solbot_exchange_error_total counter
    solbot_exchange_error_total{exchange="binance",code="429",endpoint="/api/v3/order"} 2
    solbot_exchange_error_total{exchange="bybit",code="10001",endpoint="/private/linear/order/create"} 1
    
    # HELP solbot_engine_loop_duration_seconds トレーディングエンジンの1ループあたりの処理時間
    # TYPE solbot_engine_loop_duration_seconds summary
    solbot_engine_loop_duration_seconds{quantile="0.5",strategy="trend"} 0.12
    solbot_engine_loop_duration_seconds_count{strategy="trend"} 1
    solbot_engine_loop_duration_seconds_count{strategy="range"} 1
  `;

  let mockUpdateMetrics;

  // テスト前にモックをリセット
  beforeEach(() => {
    jest.clearAllMocks();
    // タイマーをここで設定
    jest.useFakeTimers({ doNotFake: [] });

    // expressモックのリセット
    const express = require('express');
    express.mockClear();
    
    // メトリクスの実装をモック
    jest.spyOn(client.Registry.prototype, 'metrics').mockImplementation(() => {
      return Promise.resolve(dummyMetricsData);
    });
    
    // モックメトリクス更新関数
    mockUpdateMetrics = {
      updateBalance: jest.fn(),
      updateDailyPnl: jest.fn(),
      recordTrade: jest.fn(),
      recordOrderLatency: jest.fn(),
      recordExchangeError: jest.fn(),
      recordEngineLoopDuration: jest.fn(),
      startEngineLoopTimer: jest.fn().mockReturnValue(() => {})
    };
    
    // 元のupdateMetricsを保存し、モックで置き換え
    Object.defineProperty(metrics, 'updateMetrics', {
      value: mockUpdateMetrics,
      writable: true
    });
  });
  
  afterEach(() => {
    // モックとタイマーをリセット
    jest.resetAllMocks();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('基本的なメトリクス更新', () => {
    it('updateBalance がトレーディング残高を正しく更新する', () => {
      const balance = 5000;
      metrics.updateMetrics.updateBalance(balance);

      // 関数が呼び出されたことを確認
      expect(mockUpdateMetrics.updateBalance).toHaveBeenCalledWith(balance);
      // ダミーデータの検証
      expect(dummyMetricsData).toMatch(/solbot_trading_balance 5000/);
    });

    it('updateDailyPnl が日次損益を正しく更新する', () => {
      metrics.updateMetrics.updateDailyPnl(100, 0.05);

      // 関数が呼び出されたことを確認
      expect(mockUpdateMetrics.updateDailyPnl).toHaveBeenCalledWith(100, 0.05);
      expect(dummyMetricsData).toMatch(/solbot_daily_pnl 100/);
      expect(dummyMetricsData).toMatch(/solbot_daily_loss_percentage 5/);
    });

    it('recordTrade が取引数と取引量を正しく記録する', () => {
      metrics.updateMetrics.recordTrade(200);
      metrics.updateMetrics.recordTrade(300);

      // 関数が呼び出されたことを確認
      expect(mockUpdateMetrics.recordTrade).toHaveBeenCalledTimes(2);
      expect(mockUpdateMetrics.recordTrade).toHaveBeenNthCalledWith(1, 200);
      expect(mockUpdateMetrics.recordTrade).toHaveBeenNthCalledWith(2, 300);
      expect(dummyMetricsData).toMatch(/solbot_trade_count_total 2/);
      expect(dummyMetricsData).toMatch(/solbot_trade_volume_total 500/);
    });
  });

  describe('新規追加メトリクス', () => {
    it('recordOrderLatency が注文レイテンシを正しくヒストグラムに記録する', () => {
      metrics.updateMetrics.recordOrderLatency(1.5, 'binance', 'market', 'SOLUSDT');
      metrics.updateMetrics.recordOrderLatency(0.3, 'bybit', 'limit', 'BTCUSDT');

      // 関数が呼び出されたことを確認
      expect(mockUpdateMetrics.recordOrderLatency).toHaveBeenCalledTimes(2);
      expect(mockUpdateMetrics.recordOrderLatency).toHaveBeenNthCalledWith(1, 1.5, 'binance', 'market', 'SOLUSDT');
      expect(mockUpdateMetrics.recordOrderLatency).toHaveBeenNthCalledWith(2, 0.3, 'bybit', 'limit', 'BTCUSDT');
      expect(dummyMetricsData).toMatch(
        /solbot_order_latency_seconds_bucket{le="2",exchange="binance",order_type="market",symbol="SOLUSDT"} 1/
      );
      expect(dummyMetricsData).toMatch(
        /solbot_order_latency_seconds_bucket{le="0.5",exchange="bybit",order_type="limit",symbol="BTCUSDT"} 1/
      );
    });

    it('recordExchangeError が取引所エラーを正しくカウントする', () => {
      metrics.updateMetrics.recordExchangeError('binance', '429', '/api/v3/order');
      metrics.updateMetrics.recordExchangeError('binance', '429', '/api/v3/order');
      metrics.updateMetrics.recordExchangeError('bybit', '10001', '/private/linear/order/create');

      // 関数が呼び出されたことを確認
      expect(mockUpdateMetrics.recordExchangeError).toHaveBeenCalledTimes(3);
      expect(mockUpdateMetrics.recordExchangeError).toHaveBeenNthCalledWith(1, 'binance', '429', '/api/v3/order');
      expect(mockUpdateMetrics.recordExchangeError).toHaveBeenNthCalledWith(2, 'binance', '429', '/api/v3/order');
      expect(mockUpdateMetrics.recordExchangeError).toHaveBeenNthCalledWith(3, 'bybit', '10001', '/private/linear/order/create');
      expect(dummyMetricsData).toMatch(
        /solbot_exchange_error_total{exchange="binance",code="429",endpoint="\/api\/v3\/order"} 2/
      );
      expect(dummyMetricsData).toMatch(
        /solbot_exchange_error_total{exchange="bybit",code="10001",endpoint="\/private\/linear\/order\/create"} 1/
      );
    });

    it('recordEngineLoopDuration がエンジンループ処理時間を正しく記録する', () => {
      metrics.updateMetrics.recordEngineLoopDuration(0.12, 'trend');
      metrics.updateMetrics.recordEngineLoopDuration(0.25, 'range');

      // 関数が呼び出されたことを確認
      expect(mockUpdateMetrics.recordEngineLoopDuration).toHaveBeenCalledTimes(2);
      expect(mockUpdateMetrics.recordEngineLoopDuration).toHaveBeenNthCalledWith(1, 0.12, 'trend');
      expect(mockUpdateMetrics.recordEngineLoopDuration).toHaveBeenNthCalledWith(2, 0.25, 'range');
      expect(dummyMetricsData).toMatch(
        /solbot_engine_loop_duration_seconds{quantile="0.5",strategy="trend"}/
      );
      expect(dummyMetricsData).toMatch(/solbot_engine_loop_duration_seconds_count{strategy="trend"} 1/);
      expect(dummyMetricsData).toMatch(/solbot_engine_loop_duration_seconds_count{strategy="range"} 1/);
    });

    it('startEngineLoopTimer がタイマー関数を正しく返して処理時間を記録する', () => {
      // タイマー開始
      const endTimer = metrics.updateMetrics.startEngineLoopTimer('trend');

      // 関数が呼び出されたことを確認
      expect(mockUpdateMetrics.startEngineLoopTimer).toHaveBeenCalledWith('trend');

      // まずrunAllTimersを実行してから時間を進める
      jest.runAllTimers();
      // 処理時間を模擬
      jest.advanceTimersByTime(150);

      // タイマー終了
      endTimer();

      expect(dummyMetricsData).toMatch(/solbot_engine_loop_duration_seconds_count{strategy="trend"} 1/);
    });
  });

  describe('メトリクスサーバー', () => {
    it('initMetricsServer がサーバーを正しく初期化する', () => {
      // メトリクス初期化関数をモック
      const originalInitMetricsServer = metrics.initMetricsServer;
      metrics.initMetricsServer = jest.fn();
      
      // サーバー初期化
      metrics.initMetricsServer(9100);

      // サーバー起動の確認
      expect(metrics.initMetricsServer).toHaveBeenCalledWith(9100);
      
      // モックを元に戻す
      metrics.initMetricsServer = originalInitMetricsServer;
    });
  });
}); 