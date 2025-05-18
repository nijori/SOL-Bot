/**
 * MultiTimeframeDataFetcher.ts
 * 複数の時間足（1m, 15m, 1h, 1d）データを取得して保存するクラス
 * TST-052: デュアルフォーマット実行の互換性向上
 */

// @ts-nocheck
const ccxt = require('ccxt');
const { Candle, normalizeTimestamp } = require('../core/types');
const { ParquetDataStore } = require('./parquetDataStore');
const logger = require('../utils/logger');
const cron = require('node-cron');
require('dotenv/config');
const path = require('path');
const fs = require('fs');

// isMainModuleを直接importせず、実行時に動的に判定
// CommonJS/ESM互換性問題を解決するための対応
let isMainModuleFn;

try {
  // Dynamic import to avoid static parse errors
  const importMetaHelper = require('../utils/importMetaHelper');
  isMainModuleFn = importMetaHelper.isMainModule;
} catch (err) {
  // Fallback for environments where dynamic require fails
  isMainModuleFn = () => {
    if (typeof require !== 'undefined' && typeof module !== 'undefined') {
      return require.main === module;
    }
    return false;
  };
}

// 設定パラメータ
const DEFAULT_SYMBOL = process.env.TRADING_PAIR || 'SOL/USDT';
const RETRY_COUNT = 3;
const EXCHANGES = ['binance', 'kucoin', 'bybit'];
const USE_PARQUET = process.env.USE_PARQUET === 'true';

// サポートする時間足
const Timeframe = {
  MINUTE_1: '1m',
  MINUTE_15: '15m',
  HOUR_1: '1h',
  DAY_1: '1d'
};

// 時間足ごとのデフォルト取得件数
const DEFAULT_LIMITS = {
  [Timeframe.MINUTE_1]: 500, // 分足は多く取得
  [Timeframe.MINUTE_15]: 300,
  [Timeframe.HOUR_1]: 200,
  [Timeframe.DAY_1]: 100
};

// 時間足ごとのスケジュール設定（cron式）
const SCHEDULES = {
  [Timeframe.MINUTE_1]: '* * * * *', // 毎分実行
  [Timeframe.MINUTE_15]: '*/15 * * * *', // 15分ごと
  [Timeframe.HOUR_1]: '0 * * * *', // 毎時0分
  [Timeframe.DAY_1]: '0 0 * * *' // 毎日0時
};

/**
 * マルチタイムフレーム対応のデータ取得クラス
 */
class MultiTimeframeDataFetcher {
  constructor() {
    this.parquetDataStore = null;
    this.exchanges = new Map();
    this.activeJobs = new Map(); // クロンジョブを保持
    this.isRunning = {
      [Timeframe.MINUTE_1]: false,
      [Timeframe.MINUTE_15]: false,
      [Timeframe.HOUR_1]: false,
      [Timeframe.DAY_1]: false
    };

    // Parquet形式を使用する場合は初期化
    if (USE_PARQUET) {
      try {
        this.parquetDataStore = new ParquetDataStore();
        logger.info('マルチタイムフレーム用Parquetデータストアを初期化しました');
      } catch (error) {
        logger.error(
          `Parquetデータストア初期化エラー: ${error instanceof Error ? error.message : String(error)}`
        );
        this.parquetDataStore = null;
      }
    }

    // 指定された取引所を初期化
    for (const exchangeId of EXCHANGES) {
      try {
        const exchange = new ccxt[exchangeId]({
          enableRateLimit: true
        });
        this.exchanges.set(exchangeId, exchange);
        logger.info(`取引所接続初期化: ${exchangeId}`);
      } catch (error) {
        logger.error(
          `取引所初期化エラー (${exchangeId}): ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * 指定した取引所から指定の時間足でローソク足データを取得する
   */
  async fetchCandlesFromExchange(
    exchangeId,
    symbol = DEFAULT_SYMBOL,
    timeframe,
    limit = DEFAULT_LIMITS[timeframe]
  ) {
    const exchange = this.exchanges.get(exchangeId);
    if (!exchange) {
      throw new Error(`取引所が初期化されていません: ${exchangeId}`);
    }

    let retries = 0;

    while (retries < RETRY_COUNT) {
      try {
        logger.debug(`${exchangeId}から${symbol}の${timeframe}足データを取得中...`);
        const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);

        const candles = ohlcv.map((candle) => ({
          // タイムスタンプはnumber型として統一
          timestamp: candle[0],
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5]
        }));

        logger.info(
          `${exchangeId}から${symbol}の${timeframe}足データを${candles.length}件取得しました`
        );
        return candles;
      } catch (error) {
        retries++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
          `取得エラー (${exchangeId}, ${timeframe}, 試行${retries}/${RETRY_COUNT}): ${errorMessage}`
        );

        if (retries < RETRY_COUNT) {
          // 再試行前に一定時間待機（短い時間足の場合は待機時間を短く）
          const waitTime = timeframe === Timeframe.MINUTE_1 ? 1000 : 2000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
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
  async fetchAndSaveTimeframe(
    timeframe,
    symbol = DEFAULT_SYMBOL
  ) {
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
              logger.info(
                `${symbolKey} ${timeframe}データをParquet形式で保存しました（${candles.length}件）`
              );
            } else {
              logger.warn(
                `Parquetストアが初期化されていないため、${timeframe}データは保存されませんでした`
              );
            }
          }
        } catch (error) {
          logger.error(
            `${exchangeId}からの${timeframe}データ取得中にエラー: ${error instanceof Error ? error.message : String(error)}`
          );
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
  async fetchAllTimeframes(
    symbol = DEFAULT_SYMBOL
  ) {
    const results = {
      [Timeframe.MINUTE_1]: false,
      [Timeframe.MINUTE_15]: false,
      [Timeframe.HOUR_1]: false,
      [Timeframe.DAY_1]: false
    };

    logger.info(`${symbol}の全タイムフレームデータ取得を開始します`);

    // 日足 → 時間足 → 15分足 → 分足の順で取得（粒度の粗いものから）
    for (const timeframe of [
      Timeframe.DAY_1,
      Timeframe.HOUR_1,
      Timeframe.MINUTE_15,
      Timeframe.MINUTE_1
    ]) {
      logger.info(`${timeframe}データの取得を開始...`);
      results[timeframe] = await this.fetchAndSaveTimeframe(timeframe, symbol);
    }

    return results;
  }

  /**
   * 各タイムフレームのスケジュールに従ってジョブを開始する
   */
  startAllScheduledJobs(symbol = DEFAULT_SYMBOL) {
    for (const timeframe of Object.values(Timeframe)) {
      this.startScheduledJob(timeframe, symbol);
    }
    logger.info(`全タイムフレーム(${Object.values(Timeframe).join(', ')})のスケジュールジョブを開始しました`);
  }

  /**
   * 特定のタイムフレームのスケジュールジョブを開始する
   */
  startScheduledJob(timeframe, symbol = DEFAULT_SYMBOL) {
    // 既存のジョブがあれば停止
    this.stopScheduledJob(timeframe);

    // 新しいジョブをスケジュール
    const job = cron.schedule(SCHEDULES[timeframe], async () => {
      logger.info(`${timeframe}定期データ取得ジョブを実行します`);
      await this.fetchAndSaveTimeframe(timeframe, symbol);
    });

    // アクティブなジョブを保持
    this.activeJobs.set(timeframe, job);
    logger.info(`${timeframe}足データ取得ジョブをスケジュールしました (${SCHEDULES[timeframe]})`);
  }

  /**
   * 特定のタイムフレームのスケジュールジョブを停止する
   */
  stopScheduledJob(timeframe) {
    const job = this.activeJobs.get(timeframe);
    if (job) {
      job.stop();
      this.activeJobs.delete(timeframe);
      logger.info(`${timeframe}足データ取得ジョブを停止しました`);
    }
  }

  /**
   * すべてのスケジュールジョブを停止する
   */
  stopAllScheduledJobs() {
    for (const timeframe of Object.values(Timeframe)) {
      this.stopScheduledJob(timeframe);
    }
    logger.info('全タイムフレームのスケジュールジョブを停止しました');
  }

  /**
   * リソースを解放する
   */
  close() {
    this.stopAllScheduledJobs();

    if (this.parquetDataStore) {
      try {
        this.parquetDataStore.close();
        logger.info('Parquetデータストアを正常に終了しました');
      } catch (error) {
        logger.error(
          `Parquetデータストア終了エラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
}

async function main() {
  try {
    const fetcher = new MultiTimeframeDataFetcher();
    
    // コマンドライン引数を解析
    const args = process.argv.slice(2);
    const argTimeframe = args.find(arg => arg.startsWith('--timeframe='))?.split('=')[1];
    const runAll = args.includes('--all');
    const startService = args.includes('--service');
    
    if (startService) {
      // サービスモードで起動（定期実行）
      logger.info('データ取得サービスを開始します');
      fetcher.startAllScheduledJobs();
      
      // プロセス終了時にリソースを解放
      process.on('SIGINT', () => {
        fetcher.close();
        process.exit(0);
      });
    } else if (runAll) {
      // 全タイムフレーム取得
      logger.info('全タイムフレームのデータを取得します');
      await fetcher.fetchAllTimeframes();
      fetcher.close();
    } else if (argTimeframe) {
      // 特定タイムフレーム取得
      const timeframeValues = Object.values(Timeframe);
      if (timeframeValues.includes(argTimeframe)) {
        logger.info(`${argTimeframe}タイムフレームのデータを取得します`);
        await fetcher.fetchAndSaveTimeframe(argTimeframe);
      } else {
        logger.error(`無効なタイムフレーム: ${argTimeframe}. 有効値: ${timeframeValues.join(', ')}`);
      }
      fetcher.close();
    } else {
      // デフォルト: 時間足データを取得
      logger.info('デフォルトで1h足データを取得します');
      await fetcher.fetchAndSaveTimeframe(Timeframe.HOUR_1);
      fetcher.close();
    }
  } catch (error) {
    logger.error(`メインプロセス実行エラー: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// スクリプトとして直接実行された場合
if (isMainModuleFn()) {
  main().catch(err => {
    logger.error(`アプリケーション実行エラー: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}

module.exports = {
  MultiTimeframeDataFetcher,
  Timeframe
};
