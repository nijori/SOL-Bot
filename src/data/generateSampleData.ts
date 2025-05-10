/**
 * Optuna最適化とバックテスト用のサンプルデータを生成
 * このスクリプトは、バックテストで使用するためのSOLUSDTのサンプルローソク足データを生成します
 */

import * as fs from 'fs';
import * as path from 'path';
import { Candle } from '../core/types.js';
import { ParquetDataStore } from './parquetDataStore.js';
import logger from '../utils/logger.js';

// 乱数生成用関数
function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * ランダムなローソク足データを生成
 * 実際の市場のような動きを模倣するために、いくつかのトレンドとボラティリティを含む
 */
function generateCandleData(options: {
  symbol: string;
  startDate: Date;
  endDate: Date;
  timeframeHours: number;
  initialPrice: number;
  volatility: number;
  trendStrength: number;
}): Candle[] {
  const { startDate, endDate, timeframeHours, initialPrice, volatility, trendStrength } = options;

  const candles: Candle[] = [];
  const timeframeMs = timeframeHours * 60 * 60 * 1000;

  // 開始時間をタイムフレームの境界に合わせる
  const startTime = new Date(startDate);
  startTime.setUTCHours(
    Math.floor(startTime.getUTCHours() / timeframeHours) * timeframeHours,
    0,
    0,
    0
  );

  // 現在時刻をタイムフレームごとに進める
  let currentTime = startTime.getTime();
  let currentPrice = initialPrice;

  // トレンドとボラティリティの周期
  const trendCycleDays = 7; // 7日周期のトレンド
  const trendCycleMs = trendCycleDays * 24 * 60 * 60 * 1000;

  while (currentTime <= endDate.getTime()) {
    // トレンドの方向性（時間によって周期的に変化）
    const trendPhase = (currentTime % trendCycleMs) / trendCycleMs;
    const trendDirection = Math.sin(trendPhase * Math.PI * 2);

    // 価格変動の計算
    const trendChange = trendDirection * trendStrength * currentPrice;
    const randomChange = randomBetween(-volatility, volatility) * currentPrice;
    const totalChange = trendChange + randomChange;

    // 新しい価格
    const newPrice = currentPrice + totalChange;

    // 高値と安値の計算
    const highLowRange = Math.abs(randomChange) * 1.5;
    const high = Math.max(currentPrice, newPrice) + randomBetween(0, highLowRange);
    const low = Math.min(currentPrice, newPrice) - randomBetween(0, highLowRange);

    // ローソク足の作成
    const candle: Candle = {
      timestamp: currentTime,
      open: currentPrice,
      high: high,
      low: low,
      close: newPrice,
      volume: randomBetween(10000, 1000000)
    };

    candles.push(candle);

    // 次の時間枠へ
    currentTime += timeframeMs;
    currentPrice = newPrice;
  }

  return candles;
}

/**
 * サンプルデータを生成して保存
 */
export async function generateAndSaveSampleData() {
  try {
    const symbol = 'SOLUSDT';
    const timeframeHours = 1; // 1時間足

    // 1年分のデータを生成（現在から1年前まで）
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    logger.info(
      `サンプルデータ生成: ${symbol} ${timeframeHours}h (${startDate.toISOString()} - ${endDate.toISOString()})`
    );

    // サンプルデータの生成
    const candles = generateCandleData({
      symbol,
      startDate,
      endDate,
      timeframeHours,
      initialPrice: 100, // 初期価格
      volatility: 0.01, // 1%のボラティリティ
      trendStrength: 0.002 // 0.2%のトレンド強度
    });

    logger.info(`${candles.length}件のサンプルローソク足データを生成しました`);

    // データを3か月ごとに分割して保存
    const dataStore = new ParquetDataStore();

    // 3ヶ月ごとのデータ分割
    const months = 3;
    const candlesPerBatch = Math.ceil(candles.length / (12 / months));

    for (let i = 0; i < candles.length; i += candlesPerBatch) {
      const batchCandles = candles.slice(i, i + candlesPerBatch);

      if (batchCandles.length > 0) {
        // 日付に基づいてファイル名を作成
        const batchDate = new Date(batchCandles[0].timestamp);
        const dateString = batchDate.toISOString().split('T')[0].replace(/-/g, '');

        // Parquetに保存
        const saved = await dataStore.saveCandles(symbol, `${timeframeHours}h`, batchCandles);

        if (saved) {
          logger.info(
            `バッチ ${Math.floor(i / candlesPerBatch) + 1}: ${batchCandles.length}件のデータを保存しました`
          );
        } else {
          logger.error(`バッチ ${Math.floor(i / candlesPerBatch) + 1}: データ保存に失敗しました`);
        }
      }
    }

    // リソースを解放
    dataStore.close();

    logger.info('サンプルデータの生成と保存が完了しました');
  } catch (error) {
    logger.error(
      `サンプルデータ生成エラー: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// スクリプトとして実行された場合のみ実行
if (require.main === module) {
  generateAndSaveSampleData().catch((err) => {
    logger.error('サンプルデータ生成中にエラーが発生しました:', err);
    process.exit(1);
  });
}
