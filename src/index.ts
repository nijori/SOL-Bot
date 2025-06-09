/**
 * SOL-Bot メインエントリーポイント
 * INF-032: CommonJS形式への変換
 * 
 * @fileoverview このファイルはアプリケーションのメインエントリーポイントです
 * @author SOL-Bot Team
 */
// @ts-nocheck

// REF-031対応: グローバル型拡張
// TypeScriptの型定義
// import { Express, Request, Response } from 'express';
// import { Exchange } from 'ccxt';

// CommonJSモジュールであることを明示
// export {};

// グローバル型定義 - TypeScriptのみに影響するためコメントとして保持
/**
 * TypeScript用の型定義 (CommonJS環境で利用するためコメントとして残し参照用に)
 * 
 * interface Express {}
 * interface Request {}
 * interface Response {}
 * interface Exchange {}
 * 
 * declare global {
 *   namespace NodeJS {
 *     interface Global {
 *       __ESM_ENVIRONMENT: boolean;
 *     }
 *   }
 * }
 */

// CommonJS環境設定
(global as any).__ESM_ENVIRONMENT = false;

// 依存関係のインポート (CommonJS形式)
require('dotenv/config');
var express = require('express');
var cron = require('node-cron');
var ccxt = require('ccxt');
var { TradingEngine } = require('./core/tradingEngine');
var { OrderManagementSystem } = require('./core/orderManagementSystem');
var { OperationMode, OPERATION_MODE } = require('./config/parameters');
var logger = require('./utils/logger').default;
var { Candle } = require('./core/types');
var { ExchangeService } = require('./services/exchangeService');
var { parameterService } = require('./config/parameterService');
var metricsService = require('./utils/metrics').default;
var { CliParser } = require('./utils/cliParser');
var { BacktestRunner } = require('./core/backtestRunner');
var { checkAndExecuteKillSwitch } = require('./utils/killSwitchChecker');

/**
 * インターフェース定義 (TypeScript型定義用コメントとして保持)
 * 
 * interface Order {
 *   symbol: string;
 *   type: string;
 *   side: string;
 *   amount: number;
 *   price?: number;
 * }
 * 
 * type EngineStatus = {
 *   balance: number;
 *   position: number;
 *   unrealizedPnL: number;
 *   [key: string]: any;
 * };
 */

// 設定
var PORT = process.env.PORT || 3000;
var DEFAULT_SYMBOL = process.env.TRADING_PAIR || 'SOL/USDT';
var DEFAULT_TIMEFRAME = process.env.TIMEFRAME || '5m';
var INITIAL_BALANCE = parseFloat(process.env.INITIAL_BALANCE || '10000');

// CLIモードのチェック
var isCliMode = process.argv.length > 2;

// CLIモードの場合はCLIを実行
if (isCliMode) {
  // CommonJSスタイルの動的ロード
  var cli = require('./scripts/cli');
  logger.info('CLIモードで実行しています');
  process.exit(0);
}

// 通常のサーバーモードで実行
logger.info(`サーバーモードで実行しています（CLI引数なし）`);
logger.info(`動作モード: ${OPERATION_MODE}`);

// 取引所の初期化
/** @type {any} */
var exchange;
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
var oms = new OrderManagementSystem();

// マルチシンボル対応：複数のトレーディングエンジンを管理
/** @type {Map<string, any>} */
var tradingEngines = new Map();

// デフォルトシンボルのトレーディングエンジンを初期化
/**
 * トレーディングエンジンを初期化する関数
 * @param {string} symbol トレーディングペア
 * @returns {any} 初期化されたエンジンインスタンス
 */
function initializeTradingEngine(symbol) {
  // シンボル固有のパラメータを取得
  var symbolParams = parameterService.getParametersForSymbol(symbol);

  var engine = new TradingEngine({
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
var app = express();
app.use(express.json());

// ステータスエンドポイント
app.get('/api/status', (req, res) => {
  // すべてのエンジンのステータスを取得
  /** @type {Record<string, any>} */
  var engineStatuses = {};

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
  var symbols = Array.from(tradingEngines.keys());
  res.json({ symbols });
});

// 特定シンボルの詳細エンドポイント
app.get('/api/symbol/:symbol', (req, res) => {
  var symbol = req.params.symbol;
  var engine = tradingEngines.get(symbol);

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
      var order = req.body;
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
 * @param {string} symbol 取引ペア
 * @param {string} timeframe タイムフレーム
 * @returns {Promise<Array>} ローソク足データの配列
 */
async function fetchMarketData(symbol, timeframe) {
  try {
    if (OPERATION_MODE === OperationMode.SIMULATION) {
      // シミュレーションモードではダミーデータを生成
      var now = Date.now();
      /** @type {Array<any>} */
      var candles = [];

      for (let i = 100; i >= 0; i--) {
        var timestamp = now - i * 60000; // 1分ごと
        var basePrice = 100 + Math.sin(i / 10) * 10; // 基本的な価格の変動
        var noise = Math.random() * 2 - 1; // ランダムなノイズ

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
      var ohlcv = await exchange.fetchOHLCV(symbol, timeframe);

      return ohlcv.map((candle) => ({
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
 * @param {Array} orders 注文の配列
 * @returns {Promise<void>}
 */
async function executeOrders(orders) {
  if (orders.length === 0) return;

  logger.info(`${orders.length}件の注文を実行します`);

  for (const order of orders) {
    try {
      if (OPERATION_MODE === OperationMode.LIVE) {
        // 実際の取引所で注文を実行
        var params = {};
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
 * @returns {Promise<void>}
 */
async function runTradingLogic() {
  try {
    // 各シンボルに対して処理を実行
    for (const [symbol, engine] of tradingEngines.entries()) {
      logger.info(`${symbol}の取引ロジックを実行中...`);

      // 市場データを取得
      var candles = await fetchMarketData(symbol, DEFAULT_TIMEFRAME);
      if (candles.length === 0) {
        logger.warn(`${symbol}の市場データが取得できませんでした`);
        continue;
      }

      // トレーディングエンジンにデータを供給
      engine.updateMarketData(candles);

      // 市場分析を実行
      var marketAnalysis = engine.analyzeMarket();

      // 戦略を実行して新しい注文を取得
      var strategyResult = engine.executeStrategy();
      var newOrders = strategyResult.signals || [];

      // 新しい注文があれば実行
      if (newOrders.length > 0) {
        await executeOrders(newOrders);
      }

      // エンジンの状態を報告
      var status = engine.getStatus();
      logger.info(
        `${symbol} 状態: 残高=${status.account.balance.toFixed(2)}USDT, ポジション数=${
          status.account.positions.length
        }, 日次PnL=${status.account.dailyPnl.toFixed(2)}`
      );

      // メトリクス更新
      try {
        if (metricsService && metricsService.updateMetrics) {
          metricsService.updateMetrics.updateBalance(status.account.balance);
          metricsService.updateMetrics.updateDailyPnl(status.account.dailyPnl, status.account.dailyPnlPercentage || 0);
        }
      } catch (metricsError) {
        logger.warn(`メトリクス更新エラー: ${metricsError instanceof Error ? metricsError.message : String(metricsError)}`);
      }
    }
  } catch (error) {
    logger.error(`取引ロジック実行エラー: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * メイン関数
 * @returns {Promise<void>}
 */
async function main() {
  logger.info('SOL-Bot 起動中...');

  // 緊急停止フラグのチェック (INF-004対応)
  checkAndExecuteKillSwitch();

  // 定期的に緊急停止フラグをチェック (5分ごと)
  cron.schedule('*/5 * * * *', () => {
    checkAndExecuteKillSwitch();
  });

  // APIサーバーの起動
  app.listen(PORT, () => {
    logger.info(`API サーバーが http://localhost:${PORT} で起動しました`);
  });

  // 取引ロジックの定期実行 (1分ごと)
  cron.schedule('* * * * *', () => {
    runTradingLogic().catch((error) => {
      logger.error(`定期実行エラー: ${error instanceof Error ? error.message : String(error)}`);
    });
  });

  // クリーンアップ処理の登録
  var cleanupTasks = () => {
    logger.info('アプリケーションを終了中...');
    // 必要なクリーンアップ処理をここに追加
    // 例: DB接続を閉じる、一時ファイルを削除するなど
    process.exit(0);
  };

  // SIGINTシグナル (Ctrl+C) のハンドラ
  process.on('SIGINT', cleanupTasks);
  // SIGTERMシグナル (kill) のハンドラ
  process.on('SIGTERM', cleanupTasks);

  // 初回の取引ロジック実行
  await runTradingLogic();
}

// アプリケーションの起動
if (require.main === module) {
  main().catch((error) => {
    logger.error(`アプリケーション起動エラー: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

// モジュールエクスポート (テスト用)
module.exports = {
  app,
  initializeTradingEngine,
  executeOrders,
  fetchMarketData,
  runTradingLogic
};
