import * as client from 'prom-client';
import express from 'express';
import logger from "./logger.js";

// デフォルトのレジストリを初期化
const register = new client.Registry();

// デフォルトのメトリクスを追加（Node.js固有のメトリクス）
client.collectDefaultMetrics({ register });

// トレーディング残高メトリクス
const tradingBalance = new client.Gauge({
  name: 'solbot_trading_balance',
  help: '現在の取引残高',
  registers: [register]
});

// 日次損益メトリクス
const dailyPnl = new client.Gauge({
  name: 'solbot_daily_pnl',
  help: '日次損益（金額）',
  registers: [register]
});

// 日次損益率メトリクス
const dailyPnlPercentage = new client.Gauge({
  name: 'solbot_daily_loss_percentage',
  help: '日次損益率（%）',
  registers: [register]
});

// 勝率メトリクス
const winRate = new client.Gauge({
  name: 'solbot_win_rate',
  help: '勝率（0-1の間）',
  registers: [register]
});

// 最大ドローダウンメトリクス
const maxDrawdown = new client.Gauge({
  name: 'solbot_max_drawdown',
  help: '最大ドローダウン（0-1の間）',
  registers: [register]
});

// 取引数カウンター
const tradeCount = new client.Counter({
  name: 'solbot_trade_count_total',
  help: '総取引数',
  registers: [register]
});

// 取引量カウンター
const tradeVolume = new client.Counter({
  name: 'solbot_trade_volume_total',
  help: '総取引量',
  registers: [register]
});

// エラーカウンター
const errorCount = new client.Counter({
  name: 'solbot_error_total',
  help: '発生したエラーの総数',
  labelNames: ['type'],
  registers: [register]
});

// シャープレシオメトリクス
const sharpeRatio = new client.Gauge({
  name: 'solbot_sharpe_ratio',
  help: 'シャープレシオ',
  registers: [register]
});

// 注文レイテンシヒストグラム（新規追加）
const orderLatency = new client.Histogram({
  name: 'solbot_order_latency_seconds',
  help: '注文の送信から約定までの経過時間',
  labelNames: ['exchange', 'order_type', 'symbol'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60], // 0.1秒から60秒までのバケット
  registers: [register]
});

// 取引所エラーカウンター（新規追加）
const exchangeErrorCount = new client.Counter({
  name: 'solbot_exchange_error_total',
  help: '取引所APIから返されたエラーの総数',
  labelNames: ['exchange', 'code', 'endpoint'],
  registers: [register]
});

// エンジンループ処理時間サマリー（新規追加）
const engineLoopDuration = new client.Summary({
  name: 'solbot_engine_loop_duration_seconds',
  help: 'トレーディングエンジンの1ループあたりの処理時間',
  labelNames: ['strategy'],
  percentiles: [0.5, 0.9, 0.95, 0.99], // 50%, 90%, 95%, 99%パーセンタイル
  registers: [register]
});

/**
 * メトリクス更新関数
 */
export const updateMetrics = {
  // 残高更新
  updateBalance: (balance: number) => {
    tradingBalance.set(balance);
  },

  // 日次損益更新
  updateDailyPnl: (pnl: number, pnlPercentage: number) => {
    dailyPnl.set(pnl);
    dailyPnlPercentage.set(Math.abs(pnlPercentage) * 100); // 絶対値に変換して%表示
  },

  // パフォーマンスメトリクス更新
  updatePerformanceMetrics: (
    winRateValue: number,
    maxDrawdownValue: number,
    sharpeRatioValue: number
  ) => {
    winRate.set(winRateValue);
    maxDrawdown.set(maxDrawdownValue);
    sharpeRatio.set(sharpeRatioValue);
  },

  // 取引記録
  recordTrade: (volume: number) => {
    tradeCount.inc(1);
    tradeVolume.inc(volume);
  },

  // エラー記録
  recordError: (type: string) => {
    errorCount.inc({ type });
  },

  // 注文レイテンシ記録（新規追加）
  recordOrderLatency: (
    latencySeconds: number,
    exchange: string,
    orderType: string,
    symbol: string
  ) => {
    orderLatency.observe({ exchange, order_type: orderType, symbol }, latencySeconds);
  },

  // 取引所エラー記録（新規追加）
  recordExchangeError: (exchange: string, errorCode: string, endpoint: string) => {
    exchangeErrorCount.inc({ exchange, code: errorCode, endpoint });
  },

  // エンジンループ処理時間記録（新規追加）
  recordEngineLoopDuration: (durationSeconds: number, strategy: string) => {
    engineLoopDuration.observe({ strategy }, durationSeconds);
  },

  // エンジンループ処理時間計測用タイマー（新規追加）
  startEngineLoopTimer: (strategy: string): (() => void) => {
    const end = engineLoopDuration.startTimer({ strategy });
    return end; // 終了時に呼び出す関数を返す
  }
};

/**
 * メトリクスサーバーの初期化
 * @param port サーバーポート（デフォルト：9100）
 */
export const initMetricsServer = (port: number = 9100): void => {
  const app = express();

  // メトリクスエンドポイントを設定
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error(
        `[Metrics] メトリクス生成エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      res.status(500).end();
    }
  });

  // ヘルスチェックエンドポイント
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  // サーバー起動
  app.listen(port, () => {
    logger.info(`[Metrics] メトリクスサーバーがポート ${port} で起動しました`);
  });
};

/**
 * テスト用のレジストリリセット
 * 主にユニットテスト時に使用
 */
export const resetRegistry = (): void => {
  // 新しいレジストリを作成
  const newRegistry = new client.Registry();

  // デフォルトメトリクスを追加
  client.collectDefaultMetrics({ register: newRegistry });

  // 既存のメトリクス定義をコピー（実装省略、必要に応じて実装）
};

export default {
  initMetricsServer,
  updateMetrics,
  resetRegistry
};
