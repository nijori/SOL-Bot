#!/usr/bin/env node
/**
 * fetchHourlyData.ts
 * 1h足データ取り込みスクリプト
 * 
 * 使用方法:
 * npm run fetch-hourly -- --symbol SOL/USDT --days 7
 */

import { MarketDataFetcher } from './marketDataFetcher';
import logger from '../utils/logger';

// コマンドライン引数の解析
const args = process.argv.slice(2);
let symbol = 'SOL/USDT';
let days = 7;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--symbol' && i + 1 < args.length) {
    symbol = args[i + 1];
    i++;
  } else if (args[i] === '--days' && i + 1 < args.length) {
    days = parseInt(args[i + 1], 10);
    if (isNaN(days)) {
      days = 7;
      logger.warn('正しい日数が指定されていません。デフォルトの7日間を使用します。');
    }
    i++;
  }
}

// メイン処理
async function main() {
  logger.info(`${symbol}の${days}日間の1時間足データ取得を開始します`);
  
  const fetcher = new MarketDataFetcher();
  
  try {
    // データ取得実行
    const success = await fetcher.manualFetch(symbol, '1h', days);
    
    if (success) {
      logger.info('データ取得が完了しました');
      
      // スケジュールされたジョブを開始するかどうかを確認
      const shouldSchedule = args.includes('--schedule');
      if (shouldSchedule) {
        logger.info('定期的なデータ取得ジョブをスケジュールします');
        fetcher.startScheduledJob();
        logger.info('Ctrl+Cで終了するまでジョブが実行されます');
      } else {
        logger.info('定期的なデータ取得をスケジュールするには --schedule オプションを使用してください');
      }
    } else {
      logger.error('データ取得中にエラーが発生しました');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`予期しないエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// スクリプト実行
main().catch(error => {
  logger.error(`スクリプト実行エラー: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}); 