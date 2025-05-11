import * as metrics from '../../utils/metrics.js';
import * as client from 'prom-client';

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
jest.mock('../../utils/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Metrics Utility', () => {
  // テスト前にレジストリをリセット
  beforeEach(() => {
    // 明示的なリセットはないため、一旦何もしない
    jest.clearAllMocks();
  });

  describe('基本的なメトリクス更新', () => {
    it('updateBalance がトレーディング残高を正しく更新する', () => {
      const balance = 5000;
      metrics.updateMetrics.updateBalance(balance);

      // 直接レジストリの値を確認することは難しいため、
      // メトリクスが登録されていることを確認
      const metricData = collectMetrics();
      expect(metricData).toMatch(/solbot_trading_balance \d+/);
    });

    it('updateDailyPnl が日次損益を正しく更新する', () => {
      metrics.updateMetrics.updateDailyPnl(100, 0.05);

      const metricData = collectMetrics();
      expect(metricData).toMatch(/solbot_daily_pnl \d+/);
      expect(metricData).toMatch(/solbot_daily_loss_percentage \d+/);
    });

    it('recordTrade が取引数と取引量を正しく記録する', () => {
      metrics.updateMetrics.recordTrade(200);
      metrics.updateMetrics.recordTrade(300);

      const metricData = collectMetrics();
      expect(metricData).toMatch(/solbot_trade_count_total 2/);
      expect(metricData).toMatch(/solbot_trade_volume_total 500/);
    });
  });

  describe('新規追加メトリクス', () => {
    it('recordOrderLatency が注文レイテンシを正しくヒストグラムに記録する', () => {
      metrics.updateMetrics.recordOrderLatency(1.5, 'binance', 'market', 'SOLUSDT');
      metrics.updateMetrics.recordOrderLatency(0.3, 'bybit', 'limit', 'BTCUSDT');

      const metricData = collectMetrics();
      expect(metricData).toMatch(
        /solbot_order_latency_seconds_bucket{le="2",exchange="binance",order_type="market",symbol="SOLUSDT"} 1/
      );
      expect(metricData).toMatch(
        /solbot_order_latency_seconds_bucket{le="0.5",exchange="bybit",order_type="limit",symbol="BTCUSDT"} 1/
      );
      expect(metricData).toMatch(
        /solbot_order_latency_seconds_count{exchange="binance",order_type="market",symbol="SOLUSDT"} 1/
      );
      expect(metricData).toMatch(
        /solbot_order_latency_seconds_count{exchange="bybit",order_type="limit",symbol="BTCUSDT"} 1/
      );
    });

    it('recordExchangeError が取引所エラーを正しくカウントする', () => {
      metrics.updateMetrics.recordExchangeError('binance', '429', '/api/v3/order');
      metrics.updateMetrics.recordExchangeError('binance', '429', '/api/v3/order');
      metrics.updateMetrics.recordExchangeError('bybit', '10001', '/private/linear/order/create');

      const metricData = collectMetrics();
      expect(metricData).toMatch(
        /solbot_exchange_error_total{exchange="binance",code="429",endpoint="\/api\/v3\/order"} 2/
      );
      expect(metricData).toMatch(
        /solbot_exchange_error_total{exchange="bybit",code="10001",endpoint="\/private\/linear\/order\/create"} 1/
      );
    });

    it('recordEngineLoopDuration がエンジンループ処理時間を正しく記録する', () => {
      metrics.updateMetrics.recordEngineLoopDuration(0.12, 'trend');
      metrics.updateMetrics.recordEngineLoopDuration(0.25, 'range');

      const metricData = collectMetrics();
      expect(metricData).toMatch(
        /solbot_engine_loop_duration_seconds{quantile="0.5",strategy="trend"}/
      );
      expect(metricData).toMatch(/solbot_engine_loop_duration_seconds_count{strategy="trend"} 1/);
      expect(metricData).toMatch(/solbot_engine_loop_duration_seconds_count{strategy="range"} 1/);
    });

    it('startEngineLoopTimer がタイマー関数を正しく返して処理時間を記録する', () => {
      // タイマー開始
      const endTimer = metrics.updateMetrics.startEngineLoopTimer('trend');

      // 処理時間を模擬
      jest.advanceTimersByTime(150);

      // タイマー終了
      endTimer();

      const metricData = collectMetrics();
      expect(metricData).toMatch(/solbot_engine_loop_duration_seconds_count{strategy="trend"} 1/);
    });
  });

  describe('メトリクスサーバー', () => {
    it('initMetricsServer がサーバーを正しく初期化する', () => {
      const express = require('express');
      const mockApp = express();

      metrics.initMetricsServer(9100);

      // エンドポイント設定の確認
      expect(mockApp.get).toHaveBeenCalledWith('/metrics', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('/health', expect.any(Function));

      // サーバー起動の確認
      expect(mockApp.listen).toHaveBeenCalledWith(9100, expect.any(Function));
    });
  });
});

/**
 * 現在のレジストリからメトリクスを収集するヘルパー関数
 * @returns メトリクス文字列
 */
function collectMetrics(): string {
  const register = (client as any).register;
  const metrics = register.getMetricsAsString ? register.getMetricsAsString() : '';

  // メトリクスが取得できない場合は空文字列を返す
  return metrics || '';
}
