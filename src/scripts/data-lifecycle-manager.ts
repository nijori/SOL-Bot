/**
 * データライフサイクル管理スクリプト
 *
 * 古いデータファイル（Parquet/Log/JSON）を自動的にS3にアップロードし、
 * 一定期間後にGlacierに移行するスクリプト
 *
 * INF-023: 古い Parquet/Log 自動ローテーション
 */

import path from 'path';
import fs from 'fs';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { GlacierClient, InitiateJobCommand } from '@aws-sdk/client-glacier';
import cron from 'node-cron';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

// 環境変数を読み込む
dotenv.config();

// 定数
const DEFAULT_RETENTION_DAYS = 90; // 90日経過したファイルをS3に移行
const DEFAULT_GLACIER_MOVE_DAYS = 30; // S3に保存してから30日経過したらGlacierに移行
const S3_BUCKET = process.env.S3_BUCKET || 'solbot-data';
const S3_ARCHIVE_BUCKET = process.env.S3_ARCHIVE_BUCKET || 'solbot-archive';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';
const DATA_DIR = path.join(process.cwd(), 'data');
const LOG_DIR = path.join(process.cwd(), 'logs');

// S3クライアントの初期化
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

// Glacierクライアントの初期化
const glacierClient = new GlacierClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

/**
 * ファイルが指定した日数より古いかチェック
 * @param filePath ファイルパス
 * @param days 日数
 * @returns 古い場合はtrue
 */
function isFileOlderThanDays(filePath: string, days: number): boolean {
  const stats = fs.statSync(filePath);
  const fileDate = new Date(stats.mtime);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  return fileDate < cutoffDate;
}

/**
 * ファイル名からデータタイプを抽出
 * @param fileName ファイル名
 * @returns データタイプ（candles, orders, metrics, logs）
 */
function getDataTypeFromFileName(fileName: string): string {
  if (fileName.includes('candle') || fileName.endsWith('.parquet')) {
    return 'candles';
  } else if (fileName.includes('order')) {
    return 'orders';
  } else if (fileName.includes('metric')) {
    return 'metrics';
  } else if (fileName.endsWith('.log')) {
    return 'logs';
  }
  return 'other';
}

/**
 * ファイル名から日付を抽出（YYYYMMDD形式）
 * @param fileName ファイル名
 * @returns 日付文字列。見つからない場合は空文字列
 */
function extractDateFromFileName(fileName: string): string {
  // 日付パターン（YYYYMMDD）を検索
  const dateMatch = fileName.match(/(\d{8})/);
  if (dateMatch && dateMatch[1]) {
    return dateMatch[1];
  }

  // 日付が見つからない場合はファイルの作成日を使用
  try {
    const stats = fs.statSync(fileName);
    const date = new Date(stats.mtime);
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  } catch (err) {
    return '';
  }
}

/**
 * S3にファイルをアップロード
 * @param filePath ファイルパス
 * @param s3Key S3内のキー
 * @returns 成功した場合true
 */
async function uploadFileToS3(filePath: string, s3Key: string): Promise<boolean> {
  try {
    const fileContent = fs.readFileSync(filePath);
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: filePath.endsWith('.json')
        ? 'application/json'
        : filePath.endsWith('.parquet')
          ? 'application/octet-stream'
          : filePath.endsWith('.log')
            ? 'text/plain'
            : 'application/octet-stream'
    });

    await s3Client.send(command);
    logger.info(`ファイルをS3にアップロードしました: ${s3Key}`);
    return true;
  } catch (err) {
    logger.error(`S3アップロードエラー: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * S3のファイルをGlacierに移行
 * @param s3Key S3内のキー
 * @returns 成功した場合true
 */
async function moveFromS3ToGlacier(s3Key: string): Promise<boolean> {
  try {
    const dataType = s3Key.split('/')[0];
    const archiveKey = `${dataType}/archive/${path.basename(s3Key)}`;

    // S3からGlacierストレージクラスで新しいバケットにコピー
    const copyCommand = new CopyObjectCommand({
      Bucket: S3_ARCHIVE_BUCKET,
      Key: archiveKey,
      CopySource: `${S3_BUCKET}/${s3Key}`,
      StorageClass: 'GLACIER'
    });

    await s3Client.send(copyCommand);

    // コピー成功後、元のファイルを削除
    const deleteCommand = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key
    });

    await s3Client.send(deleteCommand);
    logger.info(`ファイルをGlacierに移行しました: ${s3Key} -> ${archiveKey}`);
    return true;
  } catch (err) {
    logger.error(`Glacier移行エラー: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * ディレクトリ内の古いファイルをS3に移行
 * @param directory 検索対象ディレクトリ
 * @param retentionDays 保持日数
 * @param filePattern 検索ファイルパターン
 * @returns 処理したファイル数
 */
async function migrateOldFilesToS3(
  directory: string,
  retentionDays: number,
  filePattern: RegExp
): Promise<number> {
  let processedCount = 0;

  try {
    const processDir = async (currentDir: string) => {
      const files = fs.readdirSync(currentDir);

      for (const file of files) {
        const filePath = path.join(currentDir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          // サブディレクトリを再帰的に処理
          await processDir(filePath);
        } else if (filePattern.test(file) && isFileOlderThanDays(filePath, retentionDays)) {
          // ファイルが古い場合はS3に移行
          const relativeDir = path.relative(process.cwd(), currentDir);
          const dataType = getDataTypeFromFileName(file);
          const date = extractDateFromFileName(file);
          let s3Key = `${dataType}/${date}/${file}`;

          // ディレクトリ構造を維持するために追加処理
          if (
            relativeDir.includes('candles') ||
            relativeDir.includes('orders') ||
            relativeDir.includes('metrics')
          ) {
            // データディレクトリの場合
            const parts = relativeDir.split(path.sep);
            if (parts.length > 1) {
              // シンボル別ディレクトリの場合
              const symbol = parts[parts.length - 1];
              if (symbol) {
                s3Key = `${dataType}/${symbol}/${date}/${file}`;
              }
            }
          }

          const uploaded = await uploadFileToS3(filePath, s3Key);
          if (uploaded) {
            processedCount++;
            // アップロード成功したらローカルファイルを削除
            fs.unlinkSync(filePath);
            logger.info(`ローカルファイルを削除しました: ${filePath}`);
          }
        }
      }
    };

    await processDir(directory);
    return processedCount;
  } catch (err) {
    logger.error(`ファイル処理エラー: ${err instanceof Error ? err.message : String(err)}`);
    return processedCount;
  }
}

/**
 * S3内の古いファイルをGlacierに移行
 * @param glacierMoveDays Glacier移行までの日数
 * @returns 処理したファイル数
 */
async function moveOldS3FilesToGlacier(glacierMoveDays: number): Promise<number> {
  let processedCount = 0;

  try {
    const listParams = {
      Bucket: S3_BUCKET
    };

    const response = await s3Client.send(new ListObjectsV2Command(listParams));

    if (response.Contents) {
      for (const object of response.Contents) {
        const key = object.Key;
        const lastModified = object.LastModified;

        if (key && lastModified) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - glacierMoveDays);

          if (lastModified < cutoffDate) {
            // Glacierに移行
            const moved = await moveFromS3ToGlacier(key);
            if (moved) {
              processedCount++;
            }
          }
        }
      }
    }

    return processedCount;
  } catch (err) {
    logger.error(`S3ファイル処理エラー: ${err instanceof Error ? err.message : String(err)}`);
    return processedCount;
  }
}

/**
 * データライフサイクル管理を実行
 */
async function runDataLifecycleManagement(): Promise<void> {
  try {
    logger.info('データライフサイクル管理を開始します');

    const retentionDays = parseInt(
      process.env.DATA_RETENTION_DAYS || String(DEFAULT_RETENTION_DAYS),
      10
    );
    const glacierMoveDays = parseInt(
      process.env.GLACIER_MOVE_DAYS || String(DEFAULT_GLACIER_MOVE_DAYS),
      10
    );

    // 各種ファイルパターン
    const dataFilePattern = /\.(parquet|json)$/i;
    const logFilePattern = /\.log(\.\d+)?$/i;

    // データディレクトリの処理
    const dataCount = await migrateOldFilesToS3(DATA_DIR, retentionDays, dataFilePattern);
    logger.info(`${dataCount}件のデータファイルをS3に移行しました`);

    // ログディレクトリの処理
    const logCount = await migrateOldFilesToS3(LOG_DIR, retentionDays, logFilePattern);
    logger.info(`${logCount}件のログファイルをS3に移行しました`);

    // S3からGlacierへの移行
    const glacierCount = await moveOldS3FilesToGlacier(glacierMoveDays);
    logger.info(`${glacierCount}件のS3ファイルをGlacierに移行しました`);

    logger.info('データライフサイクル管理が完了しました');
  } catch (err) {
    logger.error(
      `データライフサイクル管理エラー: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * コマンドライン引数の処理
 */
function processArguments(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
データライフサイクル管理スクリプト

使用方法:
  npm run data-lifecycle [options]

オプション:
  --run-now      即時実行（デフォルトではcronジョブとして登録）
  --schedule     スケジュール設定して実行
  --help, -h     このヘルプを表示

環境変数:
  DATA_RETENTION_DAYS  ローカル保持日数（デフォルト: 90日）
  GLACIER_MOVE_DAYS    S3保持後Glacier移行までの日数（デフォルト: 30日）
  S3_BUCKET            S3バケット名（デフォルト: solbot-data）
  S3_ARCHIVE_BUCKET    Glacier保存用バケット名（デフォルト: solbot-archive）
  AWS_REGION           AWSリージョン（デフォルト: ap-northeast-1）
  AWS_ACCESS_KEY_ID    AWS認証キーID
  AWS_SECRET_ACCESS_KEY AWS認証シークレット
  CRON_SCHEDULE        Cron実行スケジュール（デフォルト: 毎日午前3時）
`);
    process.exit(0);
  }

  if (args.includes('--run-now')) {
    // 即時実行
    runDataLifecycleManagement()
      .then(() => {
        process.exit(0);
      })
      .catch((err) => {
        logger.error(`スクリプト実行エラー: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      });
  } else if (args.includes('--schedule')) {
    // cronスケジュールとして実行
    const cronSchedule = process.env.CRON_SCHEDULE || '0 3 * * *'; // デフォルト: 毎日午前3時
    logger.info(`スケジュール設定: ${cronSchedule}`);

    // cronジョブを登録
    cron.schedule(cronSchedule, () => {
      logger.info('スケジュールによりデータライフサイクル管理を開始します');
      runDataLifecycleManagement().catch((err) => {
        logger.error(`スケジュール実行エラー: ${err instanceof Error ? err.message : String(err)}`);
      });
    });

    logger.info('データライフサイクル管理スケジュールを登録しました');
    logger.info('Ctrl+Cで終了するまで実行を継続します...');
  } else {
    console.log('オプションが指定されていません。--help でヘルプを表示します。');
    process.exit(1);
  }
}

// メイン処理
processArguments();
