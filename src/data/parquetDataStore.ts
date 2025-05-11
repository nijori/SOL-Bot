/**
 * Parquet形式でのデータ永続化処理を実装
 * DuckDBとParquetを利用して効率的なデータ保存と取得を行う
 */

// 外部モジュールのインポート
import fs from 'fs';
import path from 'path';
import * as duckdbModule from 'duckdb';
import { Candle, isNumericTimestamp, normalizeTimestamp } from '../core/types.js';
import logger from '../utils/logger.js';

// このファイル内で使用するfs、pathのinterface
interface FileSystem {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  readdirSync(path: string): string[];
  promises: {
    writeFile(path: string, data: string): Promise<void>;
    readFile(path: string, encoding: string): Promise<string>;
  };
}

interface Path {
  join(...paths: string[]): string;
}

// duckdbの型定義
interface DuckDBConnection {
  exec(sql: string): any;
  prepare(sql: string): DuckDBStatement;
  all(): any[];
}

interface DuckDBStatement {
  run(...params: any[]): void;
  all(): any[];
}

interface DuckDBDatabase {
  connect(): DuckDBConnection;
  close(): void;
}

// duckdbモジュールのinterface
interface DuckDB {
  Database: new (path: string) => DuckDBDatabase;
}

// ESM対応方法でduckdbの参照を取得
const duckdb = duckdbModule as unknown as DuckDB;

// データフォルダのパス設定
const DATA_DIR = path.join(process.cwd(), 'data');
const PARQUET_DIR = path.join(DATA_DIR, 'candles');

/**
 * データベースから返されるローソク足レコードの型
 */
interface CandleRecord {
  timestamp: number | string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume: number | string;
}

/**
 * Parquetデータストアクラス
 * 時系列データをParquet形式で効率的に保存・取得する機能を提供
 */
export class ParquetDataStore {
  private db: DuckDBDatabase;
  private conn: DuckDBConnection;

  constructor() {
    this.ensureDirectoriesExist();

    // インメモリモードでDuckDBを初期化
    this.db = new duckdb.Database(':memory:');
    this.conn = this.db.connect();

    // DuckDBの初期設定
    this.conn.exec(`
      INSTALL parquet;
      LOAD parquet;
      SET memory_limit='1GB';
    `);

    logger.info('ParquetDataStoreを初期化しました');
  }

  /**
   * 必要なディレクトリが存在することを確認する
   */
  private ensureDirectoriesExist(): void {
    if (!fs.existsSync(PARQUET_DIR)) {
      try {
        fs.mkdirSync(PARQUET_DIR, { recursive: true });
        logger.info(`ディレクトリを作成しました: ${PARQUET_DIR}`);
      } catch (error) {
        logger.error(
          `ディレクトリ作成エラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * ローソク足データをParquetファイルとして保存
   * @param symbol 銘柄シンボル (例: 'SOL_USDT')
   * @param timeframe 時間枠 (例: '1h')
   * @param candles ローソク足データの配列
   * @returns 保存に成功したかどうか
   */
  public async saveCandles(symbol: string, timeframe: string, candles: Candle[]): Promise<boolean> {
    if (candles.length === 0) {
      logger.warn('保存するデータがありません');
      return false;
    }

    try {
      // ファイル名を設定 (例: 'binance_SOL_USDT_1h_20250901.parquet')
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `${symbol.replace('/', '_')}_${timeframe}_${date}.parquet`;
      const filePath = path.join(PARQUET_DIR, filename);

      // テーブル名を設定
      const tableName = `temp_candles_${Date.now()}`;

      // 一時テーブルを作成
      this.conn.exec(`
        CREATE TABLE ${tableName} (
          timestamp BIGINT,
          open DOUBLE,
          high DOUBLE,
          low DOUBLE,
          close DOUBLE,
          volume DOUBLE
        );
      `);

      // データを挿入
      const insertStmt = this.conn.prepare(`
        INSERT INTO ${tableName} VALUES (?, ?, ?, ?, ?, ?);
      `);

      for (const candle of candles) {
        insertStmt.run(
          candle.timestamp,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume
        );
      }

      // Parquetファイルとして保存
      this.conn.exec(`
        COPY ${tableName} TO '${filePath}' (FORMAT PARQUET);
      `);

      // 一時テーブルを削除
      this.conn.exec(`DROP TABLE ${tableName};`);

      logger.info(`ローソク足データをParquet形式で保存しました: ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Parquet保存エラー: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Parquetファイルからローソク足データを読み込む
   * @param symbol 銘柄シンボル (例: 'SOL_USDT')
   * @param timeframe 時間枠 (例: '1h')
   * @param date 日付 (形式: 'YYYYMMDD')
   * @returns ローソク足データの配列
   */
  public async loadCandles(symbol: string, timeframe: string, date: string): Promise<Candle[]> {
    try {
      const filename = `${symbol.replace('/', '_')}_${timeframe}_${date}.parquet`;
      const filePath = path.join(PARQUET_DIR, filename);

      if (!fs.existsSync(filePath)) {
        logger.warn(`パーケットファイルが見つかりません: ${filePath}`);
        return [];
      }

      // テーブル名を設定
      const tableName = `temp_read_${Date.now()}`;

      // Parquetファイルからデータを読み込み
      this.conn.exec(`
        CREATE VIEW ${tableName} AS SELECT * FROM read_parquet('${filePath}');
      `);

      // データを取得
      const result = this.conn
        .exec(
          `
        SELECT 
          timestamp,
          open,
          high,
          low,
          close,
          volume
        FROM ${tableName}
        ORDER BY timestamp ASC;
      `
        )
        .all();

      // ビューを削除
      this.conn.exec(`DROP VIEW ${tableName};`);

      // 結果をCandle配列に変換
      const candles: Candle[] = result.map((row: CandleRecord) => ({
        timestamp: Number(row.timestamp),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume)
      }));

      logger.info(`${filePath}から${candles.length}件のローソク足データを読み込みました`);
      return candles;
    } catch (error) {
      logger.error(
        `Parquet読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * 特定の時間範囲のデータをクエリする
   * @param symbol 銘柄シンボル (例: 'binance_SOL_USDT')
   * @param timeframe 時間枠 (例: '1h')
   * @param startTimestamp 開始タイムスタンプ
   * @param endTimestamp 終了タイムスタンプ
   * @returns ローソク足データの配列
   */
  public async queryCandles(
    symbol: string,
    timeframe: string,
    startTimestamp?: number,
    endTimestamp?: number
  ): Promise<Candle[]> {
    try {
      // ファイルパターンの作成
      const filePattern = `${symbol.replace('/', '_')}_${timeframe}_*.parquet`;
      const globPattern = path.join(PARQUET_DIR, filePattern);

      // テーブル名を設定
      const tableName = `temp_query_${Date.now()}`;

      // すべての対象ファイルを探す
      const files = fs
        .readdirSync(PARQUET_DIR)
        .filter((file) => file.startsWith(`${symbol.replace('/', '_')}_${timeframe}_`))
        .map((file) => path.join(PARQUET_DIR, file));

      if (files.length === 0) {
        logger.warn(`パターン${globPattern}に一致するファイルが見つかりません`);
        return [];
      }

      // 複数のParquetファイルからデータを読み込むクエリを構築
      const filesStr = files.map((f) => `'${f}'`).join(', ');

      // ファイルリストからテーブルを作成
      this.conn.exec(`
        CREATE VIEW ${tableName} AS 
        SELECT * FROM read_parquet([${filesStr}]);
      `);

      // データを取得するクエリ（タイムスタンプ制約付き）
      let query = `
        SELECT 
          timestamp,
          open,
          high,
          low,
          close,
          volume
        FROM ${tableName}
      `;

      // 時間範囲の制約を追加
      const timeConstraints = [];

      if (startTimestamp) {
        timeConstraints.push(`timestamp >= ${startTimestamp}`);
      }
      if (endTimestamp) {
        timeConstraints.push(`timestamp <= ${endTimestamp}`);
      }

      if (timeConstraints.length > 0) {
        query += ` WHERE ${timeConstraints.join(' AND ')}`;
      }

      query += ` ORDER BY timestamp ASC;`;

      // クエリを実行
      const result = this.conn.exec(query).all();

      // ビューを削除
      this.conn.exec(`DROP VIEW ${tableName};`);

      // 結果をCandle配列に変換
      const candles: Candle[] = result.map((row: CandleRecord) => ({
        timestamp: Number(row.timestamp),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume)
      }));

      logger.info(
        `${timeframe}のデータを${candles.length}件取得しました（${startTimestamp ? new Date(startTimestamp).toISOString() : '最初'}〜${endTimestamp ? new Date(endTimestamp).toISOString() : '最後'}）`
      );
      return candles;
    } catch (error) {
      logger.error(
        `Parquetクエリエラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * タイムフレームごとの最新データを取得する（マルチタイムフレーム対応）
   * @param symbol 銘柄シンボル (例: 'binance_SOL_USDT')
   * @param timeframes 取得する時間枠の配列 (例: ['1m', '15m', '1h', '1d'])
   * @param limit 各時間枠で取得するデータの件数
   * @returns 時間枠ごとのローソク足データのマップ
   */
  public async getLatestDataForAllTimeframes(
    symbol: string,
    timeframes: string[],
    limit: number = 100
  ): Promise<Record<string, Candle[]>> {
    const result: Record<string, Candle[]> = {};

    for (const timeframe of timeframes) {
      try {
        // 最新データを取得
        const candles = await this.getLatestCandles(symbol, timeframe, limit);
        result[timeframe] = candles;

        logger.info(`${symbol}の${timeframe}データを${candles.length}件取得しました`);
      } catch (error) {
        logger.error(
          `${timeframe}データ取得エラー: ${error instanceof Error ? error.message : String(error)}`
        );
        result[timeframe] = [];
      }
    }

    return result;
  }

  /**
   * 特定のタイムフレームの最新データを取得する
   * @param symbol 銘柄シンボル (例: 'binance_SOL_USDT')
   * @param timeframe 時間枠 (例: '1h')
   * @param limit 取得するデータの件数
   * @returns ローソク足データの配列
   */
  public async getLatestCandles(
    symbol: string,
    timeframe: string,
    limit: number = 100
  ): Promise<Candle[]> {
    try {
      // ファイルパターンの作成
      const filePattern = `${symbol.replace('/', '_')}_${timeframe}_*.parquet`;

      // すべての対象ファイルを探す
      const files = fs
        .readdirSync(PARQUET_DIR)
        .filter((file) => file.startsWith(`${symbol.replace('/', '_')}_${timeframe}_`))
        .sort() // ファイル名でソート
        .reverse() // 新しいものから順に
        .map((file) => path.join(PARQUET_DIR, file));

      if (files.length === 0) {
        logger.warn(`${symbol}の${timeframe}データが見つかりません`);
        return [];
      }

      // 最新のファイルから順に処理
      let remainingLimit = limit;
      const allCandles: Candle[] = [];

      for (const filePath of files) {
        if (remainingLimit <= 0) break;

        // テーブル名を設定
        const tableName = `temp_latest_${Date.now()}`;

        // Parquetファイルからデータを読み込み
        this.conn.exec(`
          CREATE VIEW ${tableName} AS SELECT * FROM read_parquet('${filePath}');
        `);

        // 最新のデータを取得
        const query = `
          SELECT 
            timestamp,
            open,
            high,
            low,
            close,
            volume
          FROM ${tableName}
          ORDER BY timestamp DESC
          LIMIT ${remainingLimit};
        `;

        const result = this.conn.exec(query).all();

        // ビューを削除
        this.conn.exec(`DROP VIEW ${tableName};`);

        // 結果をCandle配列に変換
        const candles: Candle[] = result.map((row: CandleRecord) => ({
          timestamp: Number(row.timestamp),
          open: Number(row.open),
          high: Number(row.high),
          low: Number(row.low),
          close: Number(row.close),
          volume: Number(row.volume)
        }));

        // 結果を追加
        allCandles.push(...candles);
        remainingLimit -= candles.length;

        if (remainingLimit <= 0) break;
      }

      // タイムスタンプで昇順ソート - normalizeTimestamp関数を使用してタイムスタンプの型安全性を確保
      allCandles.sort((a, b) => normalizeTimestamp(a.timestamp) - normalizeTimestamp(b.timestamp));

      logger.info(`${symbol}の${timeframe}最新データを${allCandles.length}件取得しました`);
      return allCandles;
    } catch (error) {
      logger.error(
        `Parquet最新データ取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * 任意の日時範囲のデータを取得する
   * @param options オプション（シンボル、時間枠(時間単位)、開始日、終了日）
   * @returns ローソク足データの配列
   */
  public async getCandleData(options: {
    symbol: string;
    timeframeHours: number;
    startDate: Date;
    endDate: Date;
  }): Promise<Candle[]> {
    const { symbol, timeframeHours, startDate, endDate } = options;

    // 時間枠の文字列を構築
    let timeframe: string;
    if (timeframeHours < 1) {
      // 分単位の場合
      const minutes = timeframeHours * 60;
      timeframe = `${minutes}m`;
    } else if (timeframeHours === 24) {
      // 日単位の場合
      timeframe = '1d';
    } else {
      // 時間単位の場合
      timeframe = `${timeframeHours}h`;
    }

    // タイムスタンプに変換
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    return await this.queryCandles(symbol, timeframe, startTimestamp, endTimestamp);
  }

  /**
   * リソースを解放する
   */
  public close(): void {
    try {
      // DuckDB接続を閉じる
      if (this.conn) {
        this.conn.exec('DROP ALL;'); // すべての一時テーブルをクリア
      }
      if (this.db) {
        this.db.close();
        logger.info('DuckDB接続をクローズしました');
      }
    } catch (error) {
      logger.error(`DuckDB終了エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 指定したシンボルと時間足の利用可能なデータファイルを一覧表示
   * @param symbol 銘柄シンボル (例: 'binance_SOL_USDT')
   * @param timeframe 時間枠 (例: '1h')、省略すると全時間足
   * @returns 利用可能なデータファイルの情報（日付、ファイルサイズ）
   */
  public listAvailableData(
    symbol?: string,
    timeframe?: string
  ): { file: string; date: string; size: number }[] {
    try {
      const files = fs.readdirSync(PARQUET_DIR);
      let filteredFiles = files;

      // シンボルでフィルタリング
      if (symbol) {
        const symbolPrefix = symbol.replace('/', '_');
        filteredFiles = filteredFiles.filter((file) => file.startsWith(symbolPrefix));
      }

      // 時間足でフィルタリング
      if (timeframe) {
        filteredFiles = filteredFiles.filter((file) => file.includes(`_${timeframe}_`));
      }

      // ファイル情報を取得
      const fileInfos = filteredFiles.map((file) => {
        // ファイル名からデータを抽出（例: binance_SOL_USDT_1h_20250901.parquet）
        const parts = file.split('_');
        const datePart = parts[parts.length - 1].split('.')[0]; // 20250901

        // ファイルサイズを取得（バイト単位）
        const filePath = path.join(PARQUET_DIR, file);
        const stats = require('fs').statSync(filePath);

        return {
          file,
          date: datePart,
          size: stats.size
        };
      });

      // 日付の降順でソート
      fileInfos.sort((a, b) => b.date.localeCompare(a.date));

      return fileInfos;
    } catch (error) {
      logger.error(
        `データファイル一覧取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }
}
