// REF-031対応: グローバル型拡張
declare global {
  var __ESM_ENVIRONMENT: boolean;
}

// REF-031対応: CommonJS/ESM環境検出
if (typeof module !== 'undefined' && module.exports) {
  // CommonJS環境
  global.__ESM_ENVIRONMENT = false;
} else {
  // ESM環境
  global.__ESM_ENVIRONMENT = true;
}

import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
// ccxtのインポート
import * as ccxtTypes from 'ccxt';
const ccxt = require('ccxt');
import { TradingEngine } from './core/tradingEngine.js';
import { OrderManagementSystem } from './core/orderManagementSystem.js';
import { OperationMode, OPERATION_MODE } from './config/parameters.js';
import logger from './utils/logger.js';
import { Candle, Order } from './core/types.js';
import { ExchangeService } from './services/exchangeService.js';
import { parameterService } from './config/parameterService.js';
import metricsService from './utils/metrics.js';
import { CliParser } from './utils/cliParser.js';
import { BacktestRunner } from './core/backtestRunner.js';
import { checkAndExecuteKillSwitch } from './utils/killSwitchChecker.js';

// 設定
const PORT = process.env.PORT || 3000;
const DEFAULT_SYMBOL = process.env.TRADING_PAIR || 'SOL/USDT';
const DEFAULT_TIMEFRAME = process.env.TIMEFRAME || '5m';
const INITIAL_BALANCE = parseFloat(process.env.INITIAL_BALANCE || '10000');

// CLIモードのチェック
const isCliMode = process.argv.length > 2;

// CLIモードの場合はCLIを実行
if (isCliMode) {
  import('./scripts/cli.js').then((cli) => {
    // CLIモジュールをロードして実行する
    logger.info('CLIモードで実行しています');
  });
  // CLIモードではここでメイン処理を終了する
  process.exit(0);
}

// 通常のサーバーモードで実行
logger.info(`サーバーモードで実行しています（CLI引数なし）`);
logger.info(`動作モード: ${OPERATION_MODE}`);

// 取引所の初期化
let exchange: ccxtTypes.Exchange;
try {
  exchange = new ccxt.binance({
    apiKey: process.env.EXCHANGE_API_KEY,
    secret: process.env.EXCHANGE_SECRET_KEY,
    enableRateLimit: true
  });
  logger.info(`取引所に接続しました: ${exchange.id}`);
} catch (error) {
  logger.error(`取引所接続エラー: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

// OrderManagementSystemのインスタンスを作成
const oms = new OrderManagementSystem();

// マルチシンボル対応：複数のトレーディングエンジンを管理
const tradingEngines = new Map<string, TradingEngine>();

// デフォルトシンボルのトレーディングエンジンを初期化
function initializeTradingEngine(symbol: string): TradingEngine {
  // シンボル固有のパラメータを取得
  const symbolParams = parameterService.getParametersForSymbol(symbol);

  const engine = new TradingEngine({
    symbol,
    initialBalance: INITIAL_BALANCE,
    oms
    // 将来的にexchangeServiceを追加する場合はここで注入
  });

  logger.info(`${symbol}のトレーディングエンジンを初期化しました`);
  return engine;
}

// デフォルトエンジンを初期化
tradingEngines.set(DEFAULT_SYMBOL, initializeTradingEngine(DEFAULT_SYMBOL));

// Expressアプリの設定
const app = express();
app.use(express.json());

// ステータスエンドポイント
app.get('/api/status', (req, res) => {
  // すべてのエンジンのステータスを取得
  const engineStatuses: Record<string, any> = {};

  tradingEngines.forEach((engine, symbol) => {
    engineStatuses[symbol] = engine.getStatus();
  });

  res.json({
    status: 'running',
    mode: OPERATION_MODE,
    engines: engineStatuses
  });
});

// シンボル一覧エンドポイント
app.get('/api/symbols', (req, res) => {
  const symbols = Array.from(tradingEngines.keys());
  res.json({ symbols });
});

// 特定シンボルの詳細エンドポイント
app.get('/api/symbol/:symbol', (req, res) => {
  const symbol = req.params.symbol;
  const engine = tradingEngines.get(symbol);

  if (!engine) {
    return res.status(404).json({ error: `シンボル ${symbol} が見つかりません` });
  }

  res.json({
    symbol,
    status: engine.getStatus()
  });
});

// 手動注文エンドポイント
app.post('/api/order', async (req, res) => {
  try {
    if (OPERATION_MODE === OperationMode.LIVE) {
      const order: Order = req.body;
      // 実際の取引所で注文を実行するロジックをここに実装
      // 本番環境では追加の認証と検証が必要
      res.json({ success: true, message: '注文を送信しました', order });
    } else {
      res.status(403).json({ success: false, message: 'ライブモードでのみ使用可能です' });
    }
  } catch (error) {
    logger.error(`注文エラー: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ success: false, message: '注文処理中にエラーが発生しました' });
  }
});

/**
 * 市場データを取得する関数
 * @param symbol 取引ペア
 * @param timeframe タイムフレーム
 */
async function fetchMarketData(symbol: string, timeframe: string): Promise<Candle[]> {
  try {
    if (OPERATION_MODE === OperationMode.SIMULATION) {
      // シミュレーションモードではダミーデータを生成
      const now = Date.now();
      const candles: Candle[] = [];

      for (let i = 100; i >= 0; i--) {
        const timestamp = now - i * 60000; // 1分ごと
        const basePrice = 100 + Math.sin(i / 10) * 10; // 基本的な価格の変動
        const noise = Math.random() * 2 - 1; // ランダムなノイズ

        candles.push({
          timestamp,
          open: basePrice + noise,
          high: basePrice + 1 + noise,
          low: basePrice - 1 + noise,
          close: basePrice + 0.5 + noise,
          volume: 1000 + Math.random() * 500
        });
      }

      return candles;
    } else {
      // 実際の取引所からデータを取得
      const ohlcv = await exchange.fetchOHLCV(symbol, timeframe);

      return ohlcv.map((candle: any[]) => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5]
      }));
    }
  } catch (error) {
    logger.error(`市場データ取得エラー: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * 注文を実行する関数
 */
async function executeOrders(orders: Order[]): Promise<void> {
  if (orders.length === 0) return;

  logger.info(`${orders.length}件の注文を実行します`);

  for (const order of orders) {
    try {
      if (OPERATION_MODE === OperationMode.LIVE) {
        // 実際の取引所で注文を実行
        const params = {};
        await exchange.createOrder(
          order.symbol,
          order.type.toLowerCase(),
          order.side.toLowerCase(),
          order.amount,
          order.price
        );
        logger.info(
          `注文実行: ${order.side} ${order.amount} ${order.symbol} @ ${order.price || 'market'}`
        );
      } else {
        // シミュレーションモードではログのみ
        logger.info(
          `[シミュレーション] 注文: ${order.side} ${order.amount} ${order.symbol} @ ${order.price || 'market'}`
        );
      }
    } catch (error) {
      logger.error(`注文実行エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * メインの取引ロジックを実行する関数
 */
async function runTradingLogic(): Promise<void> {
  try {
    // 各シンボルに対して処理を実行
    for (const [symbol, engine] of tradingEngines.entries()) {
      logger.info(`${symbol}の取引ロジックを実行中...`);

      // 市場データを取得
      const candles = await fetchMarketData(symbol, DEFAULT_TIMEFRAME);
      if (candles.length === 0) {
        logger.warn(`${symbol}の市場データが取得できませんでした`);
        continue;
      }

      // トレーディングエンジンにデータを更新
      engine.updateMarketData(candles);

      // 市場分析を実行
      const analysis = engine.analyzeMarket();

      // 戦略を実行してシグナルを取得
      const strategyResult = engine.executeStrategy();

      // シグナルに基づいて注文を実行
      if (strategyResult.signals.length > 0) {
        await executeOrders(strategyResult.signals);
      }
    }
  } catch (error) {
    logger.error(
      `取引ロジック実行エラー: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function main() {
  try {
    // 起動時に緊急停止フラグをチェック
    if (checkAndExecuteKillSwitch()) {
      return;
    }
    
    // メトリクスサーバーの初期化
    metricsService.initMetricsServer();
    logger.info('メトリクスサーバーを初期化しました');

    // 定期実行のスケジュール設定
    cron.schedule('*/5 * * * *', async () => {
      // 緊急停止フラグをチェック
      if (checkAndExecuteKillSwitch()) {
        return;
      }
      
      logger.info('定期実行：取引ロジックを実行します');
      await runTradingLogic();
    });

    // 初回実行
    await runTradingLogic();

    // サーバー起動
    app.listen(PORT, () => {
      logger.info(`サーバーがポート${PORT}で起動しました`);
    });

    // クリーンアップタスクの登録
    const cleanupTasks = () => {
      logger.info('アプリケーションをシャットダウンしています...');
      // クリーンアップタスクを実行
      process.exit(0);
    };

    // シグナルハンドラーの登録
    process.on('SIGINT', cleanupTasks);
    process.on('SIGTERM', cleanupTasks);
  } catch (error) {
    logger.error(
      `アプリケーション起動エラー: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

// CLIモードでない場合にのみメイン処理を実行
if (!isCliMode) {
  main().catch((error) => {
    logger.error('致命的なエラー:', error);
    process.exit(1);
  });
}
