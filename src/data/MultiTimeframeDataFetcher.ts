/**
 * MultiTimeframeDataFetcher.ts
 * 複数の時間足（1m, 15m, 1h, 1d）データを取得して保存するクラス
 */

import ccxt from 'ccxt';
import { Candle, normalizeTimestamp } from '../core/types';
import { ParquetDataStore } from './parquetDataStore';
import logger from '../utils/logger';
import * as cron from 'node-cron';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';

// 設定パラメータ
const DEFAULT_SYMBOL = process.env.TRADING_PAIR || 'SOL/USDT';
const RETRY_COUNT = 3;
const EXCHANGES = ['binance', 'kucoin', 'bybit'];
const USE_PARQUET = process.env.USE_PARQUET === 'true';

// サポートする時間足
export enum Timeframe {
  MINUTE_1 = '1m',
  MINUTE_15 = '15m',
  HOUR_1 = '1h',
  DAY_1 = '1d'
}

// 時間足ごとのデフォルト取得件数
const DEFAULT_LIMITS: Record<Timeframe, number> = {
  [Timeframe.MINUTE_1]: 500,  // 分足は多く取得
  [Timeframe.MINUTE_15]: 300,
  [Timeframe.HOUR_1]: 200,
  [Timeframe.DAY_1]: 100
};

// 時間足ごとのスケジュール設定（cron式）
const SCHEDULES: Record<Timeframe, string> = {
  [Timeframe.MINUTE_1]: '* * * * *',        // 毎分実行
  [Timeframe.MINUTE_15]: '*/15 * * * *',    // 15分ごと
  [Timeframe.HOUR_1]: '0 * * * *',          // 毎時0分
  [Timeframe.DAY_1]: '0 0 * * *'            // 毎日0時
};

/**
 * マルチタイムフレーム対応のデータ取得クラス
 */
export class MultiTimeframeDataFetcher {
  private parquetDataStore: ParquetDataStore | null = null;
  private exchanges: Map<string, ccxt.Exchange>;
  private activeJobs: Map<string, any> = new Map(); // クロンジョブを保持
  private isRunning: Record<Timeframe, boolean> = {
    [Timeframe.MINUTE_1]: false,
    [Timeframe.MINUTE_15]: false,
    [Timeframe.HOUR_1]: false,
    [Timeframe.DAY_1]: false
  };

  constructor() {
    // Parquet形式を使用する場合は初期化
    if (USE_PARQUET) {
      try {
        this.parquetDataStore = new ParquetDataStore();
        logger.info('マルチタイムフレーム用Parquetデータストアを初期化しました');
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
          enableRateLimit: true,
        });
        this.exchanges.set(exchangeId, exchange);
        logger.info(`取引所接続初期化: ${exchangeId}`);
      } catch (error) {
        logger.error(`取引所初期化エラー (${exchangeId}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * 指定した取引所から指定の時間足でローソク足データを取得する
   */
  private async fetchCandlesFromExchange(
    exchangeId: string,
    symbol: string = DEFAULT_SYMBOL,
    timeframe: Timeframe,
    limit: number = DEFAULT_LIMITS[timeframe]
  ): Promise<Candle[]> {
    const exchange = this.exchanges.get(exchangeId);
    if (!exchange) {
      throw new Error(`取引所が初期化されていません: ${exchangeId}`);
    }

    let retries = 0;
    
    while (retries < RETRY_COUNT) {
      try {
        logger.debug(`${exchangeId}から${symbol}の${timeframe}足データを取得中...`);
        const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
        
        const candles: Candle[] = ohlcv.map((candle: number[]) => ({
          // タイムスタンプはnumber型として統一
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
        logger.error(`取得エラー (${exchangeId}, ${timeframe}, 試行${retries}/${RETRY_COUNT}): ${errorMessage}`);
        
        if (retries < RETRY_COUNT) {
          // 再試行前に一定時間待機（短い時間足の場合は待機時間を短く）
          const waitTime = timeframe === Timeframe.MINUTE_1 ? 1000 : 2000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          throw new Error(`データ取得失敗 (${exchangeId}, ${timeframe}): ${errorMessage}`);
        }
      }
    }
    
    return [];
  }

  /**
   * 指定の時間足ですべての取引所からデータを取得し保存する
   */
  public async fetchAndSaveTimeframe(
    timeframe: Timeframe,
    symbol: string = DEFAULT_SYMBOL
  ): Promise<boolean> {
    if (this.isRunning[timeframe]) {
      logger.warn(`${timeframe}のデータ取得ジョブが既に実行中です`);
      return false;
    }

    this.isRunning[timeframe] = true;
    let success = true;

    try {
      logger.info(`${symbol}の${timeframe}足データ取得を開始します`);
      
      // すべての利用可能な取引所からデータを取得
      for (const exchangeId of this.exchanges.keys()) {
        try {
          const candles = await this.fetchCandlesFromExchange(exchangeId, symbol, timeframe);
          if (candles.length > 0) {
            // 取引所IDを含むファイル名で保存
            const symbolKey = `${exchangeId}_${symbol.replace('/', '_')}`;
            
            // Parquet形式で保存
            if (this.parquetDataStore && USE_PARQUET) {
              await this.parquetDataStore.saveCandles(symbolKey, timeframe, candles);
              logger.info(`${symbolKey} ${timeframe}データをParquet形式で保存しました（${candles.length}件）`);
            } else {
              logger.warn(`Parquetストアが初期化されていないため、${timeframe}データは保存されませんでした`);
            }
          }
        } catch (error) {
          logger.error(`${exchangeId}からの${timeframe}データ取得中にエラー: ${error instanceof Error ? error.message : String(error)}`);
          success = false;
        }
      }
    } finally {
      this.isRunning[timeframe] = false;
    }

    return success;
  }

  /**
   * 全タイムフレームのデータを取得する
   * 主に初期データロード用
   */
  public async fetchAllTimeframes(symbol: string = DEFAULT_SYMBOL): Promise<Record<Timeframe, boolean>> {
    const results: Record<Timeframe, boolean> = {
      [Timeframe.MINUTE_1]: false,
      [Timeframe.MINUTE_15]: false,
      [Timeframe.HOUR_1]: false,
      [Timeframe.DAY_1]: false
    };

    logger.info(`${symbol}の全タイムフレームデータ取得を開始します`);
    
    // 日足 → 時間足 → 15分足 → 分足の順で取得（粒度の粗いものから）
    for (const timeframe of [Timeframe.DAY_1, Timeframe.HOUR_1, Timeframe.MINUTE_15, Timeframe.MINUTE_1]) {
      logger.info(`${timeframe}データの取得を開始...`);
      results[timeframe] = await this.fetchAndSaveTimeframe(timeframe, symbol);
    }
    
    return results;
  }

  /**
   * 各タイムフレームのスケジュールに従ってジョブを開始する
   */
  public startAllScheduledJobs(symbol: string = DEFAULT_SYMBOL): void {
    // タイムフレームごとにスケジュールをセットアップ
    for (const timeframe of Object.values(Timeframe)) {
      this.startScheduledJob(timeframe, symbol);
    }
    
    logger.info(`すべてのタイムフレームデータ取得ジョブをスケジュールしました`);
  }

  /**
   * 指定の時間足のスケジュールジョブを開始する
   */
  public startScheduledJob(timeframe: Timeframe, symbol: string = DEFAULT_SYMBOL): void {
    // すでにジョブが実行中なら停止
    this.stopScheduledJob(timeframe);
    
    // cronスケジュールの設定
    const cronExpression = SCHEDULES[timeframe];
    
    // cron jobを作成
    const task = cron.schedule(cronExpression, async () => {
      logger.info(`${timeframe}足データ定期取得ジョブを実行します`);
      await this.fetchAndSaveTimeframe(timeframe, symbol);
    }, {
      timezone: 'UTC'  // UTCタイムゾーンで実行
    });
    
    // ジョブを保存
    this.activeJobs.set(timeframe, task);
    
    logger.info(`${timeframe}足データ取得ジョブをスケジュールしました (${cronExpression})`);
  }

  /**
   * 特定の時間足のスケジュールジョブを停止する
   */
  public stopScheduledJob(timeframe: Timeframe): void {
    const task = this.activeJobs.get(timeframe);
    if (task) {
      task.destroy(); // クリーンアップ
      task.stop();    // 停止
      this.activeJobs.delete(timeframe);
      logger.info(`${timeframe}足データ取得ジョブを停止しました`);
    }
  }

  /**
   * すべてのスケジュールジョブを停止する
   */
  public stopAllScheduledJobs(): void {
    for (const timeframe of Object.values(Timeframe)) {
      this.stopScheduledJob(timeframe);
    }
    logger.info('すべてのデータ取得ジョブを停止しました');
  }

  /**
   * リソースを解放する
   */
  public close(): void {
    // すべてのジョブを停止
    this.stopAllScheduledJobs();
    
    // Parquetデータストアを閉じる
    if (this.parquetDataStore) {
      try {
        this.parquetDataStore.close();
        logger.info('Parquetデータストアを正常に終了しました');
      } catch (error) {
        logger.error(`Parquetデータストアの終了中にエラー: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

// スクリプトとして直接実行された場合
if (typeof require !== 'undefined' && require.main === module) {
  (async () => {
    const fetcher = new MultiTimeframeDataFetcher();
    
    // 初期データロード（全タイムフレーム）
    await fetcher.fetchAllTimeframes();
    
    // 定期実行ジョブを開始
    fetcher.startAllScheduledJobs();
    
    // プロセス終了時にリソースを解放
    process.on('SIGINT', () => {
      fetcher.close();
      process.exit(0);
    });
  })();
} 