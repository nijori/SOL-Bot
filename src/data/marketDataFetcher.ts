/**
 * marketDataFetcher.ts
 * 1h足データ取り込みジョブの実装
 * ccxtライブラリを使用して取引所から定期的にデータを取得し、DuckDBに保存する処理
 */

// Node.js関連の型定義
declare const require: any;
declare const process: any;
declare const module: any;

import ccxt from 'ccxt';
import { Candle } from '../core/types';
import { DataRepository } from './dataRepository';
import { ParquetDataStore } from './parquetDataStore';
import logger from '../utils/logger';
import cron from 'node-cron';
import 'dotenv/config';
import { OPERATION_MODE } from '../config/parameters';

// 取り込み設定
const DEFAULT_SYMBOL = process.env.TRADING_PAIR || 'SOL/USDT';
const DEFAULT_TIMEFRAME = '1h'; // 1時間足
const DEFAULT_LIMIT = 100; // 一度に取得するローソク足の数
const EXCHANGES = ['binance', 'kucoin', 'bybit']; // 利用する取引所のリスト
const RETRY_COUNT = 3; // エラー時の再試行回数
const USE_PARQUET = process.env.USE_PARQUET === 'true'; // 追加: Parquet形式を使用するかどうか

export class MarketDataFetcher {
  private dataRepository: DataRepository;
  private parquetDataStore: ParquetDataStore | null = null; // 追加: Parquetデータストア
  private exchanges: Map<string, ccxt.Exchange>;
  private isRunning: boolean = false;

  constructor() {
    this.dataRepository = new DataRepository();
    
    // Parquet形式を使用する場合は初期化
    if (USE_PARQUET) {
      try {
        this.parquetDataStore = new ParquetDataStore();
        logger.info('Parquetデータストアを初期化しました');
      } catch (error) {
        logger.error(`Parquetデータストア初期化エラー: ${error instanceof Error ? error.message : String(error)}`);
        this.parquetDataStore = null;
      }
    }
    
    this.exchanges = new Map();
    
    // 指定された取引所を初期化
    for (const exchangeId of EXCHANGES) {
      try {
        const exchange = new (ccxt as any)[exchangeId]({
          enableRateLimit: true, // レート制限を有効化
        });
        this.exchanges.set(exchangeId, exchange);
        logger.info(`取引所接続初期化: ${exchangeId}`);
      } catch (error) {
        logger.error(`取引所初期化エラー (${exchangeId}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * 指定した取引所からローソク足データを取得する
   */
  private async fetchCandlesFromExchange(
    exchangeId: string,
    symbol: string = DEFAULT_SYMBOL,
    timeframe: string = DEFAULT_TIMEFRAME,
    limit: number = DEFAULT_LIMIT
  ): Promise<Candle[]> {
    const exchange = this.exchanges.get(exchangeId);
    if (!exchange) {
      throw new Error(`取引所が初期化されていません: ${exchangeId}`);
    }

    // 現在のUTCタイムスタンプ取得
    const now = Date.now();
    let retries = 0;
    
    while (retries < RETRY_COUNT) {
      try {
        // ローソク足データを取得
        const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
        
        // レスポンスを標準形式に変換
        const candles: Candle[] = ohlcv.map((candle: number[]) => ({
          timestamp: candle[0],
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5]
        }));
        
        logger.info(`${exchangeId}から${symbol}の${timeframe}足データを${candles.length}件取得しました`);
        return candles;
      } catch (error) {
        retries++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`取得エラー (${exchangeId}, 試行${retries}/${RETRY_COUNT}): ${errorMessage}`);
        
        if (retries < RETRY_COUNT) {
          // 再試行前に一定時間待機
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw new Error(`データ取得失敗 (${exchangeId}): ${errorMessage}`);
        }
      }
    }
    
    return []; // コンパイルエラー回避のため（この行は実行されない）
  }

  /**
   * すべての設定済み取引所からデータを取得して保存
   */
  public async fetchAndSaveCandles(
    symbol: string = DEFAULT_SYMBOL,
    timeframe: string = DEFAULT_TIMEFRAME
  ): Promise<boolean> {
    if (this.isRunning) {
      logger.warn("データ取得ジョブが既に実行中です");
      return false;
    }

    this.isRunning = true;
    let success = true;

    try {
      // すべての利用可能な取引所からデータを取得
      for (const exchangeId of this.exchanges.keys()) {
        try {
          const candles = await this.fetchCandlesFromExchange(exchangeId, symbol, timeframe);
          if (candles.length > 0) {
            // 取引所IDを含むファイル名で保存
            const symbolKey = `${exchangeId}_${symbol}`;
            
            // Parquet形式で保存
            if (this.parquetDataStore && USE_PARQUET) {
              await this.parquetDataStore.saveCandles(symbolKey, timeframe, candles);
            }
            
            // 従来のJSON形式でも保存（互換性のため）
            await this.dataRepository.saveCandles(symbolKey, timeframe, candles);
          }
        } catch (error) {
          logger.error(`${exchangeId}からのデータ取得中にエラーが発生: ${error instanceof Error ? error.message : String(error)}`);
          success = false;
          // 一つの取引所の失敗で全体を中断せず、次の取引所へ進む
        }
      }
    } finally {
      this.isRunning = false;
    }

    return success;
  }

  /**
   * スケジュールされたジョブを開始する
   * デフォルトでは毎時0分に実行
   */
  public startScheduledJob(cronExpression: string = '0 * * * *'): void {
    cron.schedule(cronExpression, async () => {
      logger.info("定期データ取得ジョブを開始します");
      await this.fetchAndSaveCandles();
    });
    
    logger.info(`1時間足データ取得ジョブをスケジュールしました (${cronExpression})`);
    if (USE_PARQUET) {
      logger.info('データはParquet形式で保存されます');
    } else {
      logger.info('データはJSON形式で保存されます');
    }
  }

  /**
   * 手動でデータ取得を実行する
   * 初期データロードや特定期間のデータ取得に使用
   */
  public async manualFetch(
    symbol: string = DEFAULT_SYMBOL,
    timeframe: string = DEFAULT_TIMEFRAME,
    days: number = 7 // 取得する日数
  ): Promise<boolean> {
    logger.info(`${symbol}の${days}日分の${timeframe}足データを取得します`);
    return await this.fetchAndSaveCandles(symbol, timeframe);
  }
  
  /**
   * リソースを解放する
   */
  public close(): void {
    if (this.parquetDataStore) {
      try {
        this.parquetDataStore.close();
      } catch (error) {
        logger.error(`Parquetデータストアの終了中にエラーが発生: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

// スクリプトとして直接実行された場合
if (typeof require !== 'undefined' && require.main === module) {
  (async () => {
    const fetcher = new MarketDataFetcher();
    await fetcher.manualFetch();
    // スケジュールされたジョブを開始
    fetcher.startScheduledJob();
    
    // プロセス終了時にリソースを解放
    process.on('SIGINT', () => {
      fetcher.close();
      process.exit(0);
    });
  })();
} 