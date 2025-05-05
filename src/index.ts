import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import ccxt from 'ccxt';
import { TradingEngine } from './core/tradingEngine';
import { OperationMode, OPERATION_MODE, MARKET_PARAMETERS } from './config/parameters';
import logger from './utils/logger';
import { Candle, Order } from './core/types';

// 設定
const PORT = process.env.PORT || 3000;
const SYMBOL = process.env.TRADING_PAIR || 'SOL/USDT';
const TIMEFRAME = process.env.TIMEFRAME || '5m';
const INITIAL_BALANCE = parseFloat(process.env.INITIAL_BALANCE || '10000');

// 取引所の初期化
let exchange: ccxt.Exchange;
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

// トレーディングエンジンの初期化
const tradingEngine = new TradingEngine(SYMBOL, INITIAL_BALANCE);

// Expressアプリの設定
const app = express();
app.use(express.json());

// ステータスエンドポイント
app.get('/api/status', (req, res) => {
  const status = tradingEngine.getStatus();
  res.json({ 
    status: 'running', 
    mode: OPERATION_MODE, 
    ...status 
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
 */
async function fetchMarketData(): Promise<Candle[]> {
  try {
    if (OPERATION_MODE === OperationMode.SIMULATION) {
      // シミュレーションモードではダミーデータを生成
      const now = Date.now();
      const candles: Candle[] = [];
      
      for (let i = 100; i >= 0; i--) {
        const timestamp = now - (i * 60000); // 1分ごと
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
      const ohlcv = await exchange.fetchOHLCV(SYMBOL, TIMEFRAME);
      
      return ohlcv.map(candle => ({
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
        logger.info(`注文実行: ${order.side} ${order.amount} ${order.symbol} @ ${order.price || 'market'}`);
      } else {
        // シミュレーションモードではログのみ
        logger.info(`[シミュレーション] 注文: ${order.side} ${order.amount} ${order.symbol} @ ${order.price || 'market'}`);
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
    // 市場データを取得
    const candles = await fetchMarketData();
    if (candles.length === 0) {
      logger.warn('市場データが取得できませんでした');
      return;
    }
    
    // トレーディングエンジンにデータを更新
    tradingEngine.updateMarketData(candles);
    
    // 市場分析を実行
    const analysis = tradingEngine.analyzeMarket();
    
    // 戦略を実行してシグナルを取得
    const strategyResult = tradingEngine.executeStrategy();
    
    // シグナルに基づいて注文を実行
    if (strategyResult.signals.length > 0) {
      await executeOrders(strategyResult.signals);
    }
  } catch (error) {
    logger.error(`取引ロジック実行エラー: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// アプリケーションの起動
app.listen(PORT, () => {
  logger.info(`サーバーが起動しました: http://localhost:${PORT}`);
  logger.info(`モード: ${OPERATION_MODE}, シンボル: ${SYMBOL}, タイムフレーム: ${TIMEFRAME}`);
  
  // トレーディングロジックのスケジュール設定（5分ごとに実行）
  cron.schedule('*/5 * * * *', runTradingLogic);
  
  // 日次リセット処理（毎日0時に実行）
  cron.schedule('0 0 * * *', () => {
    tradingEngine.resetDailyTracking();
    logger.info('日次トラッキングをリセットしました');
  });
  
  // 初期実行
  runTradingLogic();
}); 