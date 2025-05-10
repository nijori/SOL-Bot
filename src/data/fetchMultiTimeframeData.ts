/**
 * fetchMultiTimeframeData.ts
 * マルチタイムフレームデータ取得を実行するスクリプト
 */

import { MultiTimeframeDataFetcher, Timeframe } from "./MultiTimeframeDataFetcher.js";
import logger from "../utils/logger.js";
import 'dotenv/config';

// コマンドライン引数の解析
const args = process.argv.slice(2);
const cmd = args[0] || 'fetch-all'; // デフォルトはすべてのタイムフレームを取得
const symbol = process.env.TRADING_PAIR || 'SOL/USDT';

/**
 * コマンドの使用方法を表示
 */
function showUsage() {
  console.log(`
使用方法: npm run fetch-data -- [コマンド] [引数]

コマンド:
  fetch-all           すべてのタイムフレームのデータを一括取得
  fetch [timeframe]   特定のタイムフレームのデータのみ取得 (1m, 15m, 1h, 1d)
  start-all           すべてのタイムフレームの定期取得ジョブを開始
  start [timeframe]   特定のタイムフレームの定期取得ジョブのみ開始
  
例:
  npm run fetch-data -- fetch-all
  npm run fetch-data -- fetch 1h
  npm run fetch-data -- start-all
  npm run fetch-data -- start 15m
  `);
}

/**
 * タイムフレーム文字列をTimeframe列挙型に変換
 */
function parseTimeframe(tfString: string): Timeframe | null {
  const timeframeMap: Record<string, Timeframe> = {
    '1m': Timeframe.MINUTE_1,
    '15m': Timeframe.MINUTE_15,
    '1h': Timeframe.HOUR_1,
    '1d': Timeframe.DAY_1
  };

  return timeframeMap[tfString] || null;
}

/**
 * メイン処理
 */
async function main() {
  try {
    logger.info('マルチタイムフレームデータ取得ツールを開始します');
    const fetcher = new MultiTimeframeDataFetcher();

    if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
      showUsage();
      process.exit(0);
    }

    // コマンドに応じた処理
    switch (cmd) {
      case 'fetch-all':
        logger.info(`すべてのタイムフレームのデータを取得します (${symbol})`);
        const results = await fetcher.fetchAllTimeframes(symbol);

        // 結果のサマリーを表示
        console.log('\n=== データ取得結果 ===');
        for (const [timeframe, success] of Object.entries(results)) {
          console.log(`${timeframe}: ${success ? '成功 ✓' : '失敗 ✗'}`);
        }
        break;

      case 'fetch': {
        const tfString = args[1];
        if (!tfString) {
          logger.error('タイムフレームが指定されていません');
          showUsage();
          process.exit(1);
        }

        const timeframe = parseTimeframe(tfString);
        if (!timeframe) {
          logger.error(`無効なタイムフレーム: ${tfString}`);
          showUsage();
          process.exit(1);
        }

        logger.info(`${timeframe}データを取得します (${symbol})`);
        const success = await fetcher.fetchAndSaveTimeframe(timeframe, symbol);
        logger.info(`取得結果: ${success ? '成功' : '失敗'}`);
        break;
      }

      case 'start-all':
        logger.info(`すべてのタイムフレームの定期取得ジョブを開始します (${symbol})`);
        fetcher.startAllScheduledJobs(symbol);
        logger.info('定期取得ジョブが開始されました。Ctrl+Cで終了できます...');

        // プロセスがバックグラウンドで実行し続けるようにする
        process.on('SIGINT', () => {
          logger.info('ジョブを停止しています...');
          fetcher.close();
          process.exit(0);
        });
        break;

      case 'start': {
        const tfString = args[1];
        if (!tfString) {
          logger.error('タイムフレームが指定されていません');
          showUsage();
          process.exit(1);
        }

        const timeframe = parseTimeframe(tfString);
        if (!timeframe) {
          logger.error(`無効なタイムフレーム: ${tfString}`);
          showUsage();
          process.exit(1);
        }

        logger.info(`${timeframe}の定期取得ジョブを開始します (${symbol})`);
        fetcher.startScheduledJob(timeframe, symbol);
        logger.info('定期取得ジョブが開始されました。Ctrl+Cで終了できます...');

        // プロセスがバックグラウンドで実行し続けるようにする
        process.on('SIGINT', () => {
          logger.info('ジョブを停止しています...');
          fetcher.close();
          process.exit(0);
        });
        break;
      }

      default:
        logger.error(`不明なコマンド: ${cmd}`);
        showUsage();
        process.exit(1);
    }

    // すぐに終了するコマンドの場合はここで処理を終了
    if (cmd === 'fetch-all' || cmd === 'fetch') {
      fetcher.close();
      process.exit(0);
    }
  } catch (error) {
    logger.error(`エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// メイン処理を実行
main().catch((error) => {
  logger.error(`予期せぬエラー: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
