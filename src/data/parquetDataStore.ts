/**
 * Parquet形式でのデータ永続化処理を実装
 * DuckDBとParquetを利用して効率的なデータ保存と取得を行う
 */

// fs, path, processなどのNode.js組み込み型を定義
declare const require: any;
declare const process: {
  cwd(): string;
};

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

// モジュールをrequireで読み込み
const fs = require('fs') as FileSystem;
const path = require('path') as Path;
import { Candle } from '../core/types';
import logger from '../utils/logger';

// duckdbの型定義
interface DuckDBConnection {
  exec(sql: string): any;
  prepare(sql: string): DuckDBStatement;
  close(): void;
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

// duckdbをimportする
const duckdb: DuckDB = require('duckdb');

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
        logger.error(`ディレクトリ作成エラー: ${error instanceof Error ? error.message : String(error)}`);
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
      const result = this.conn.prepare(`SELECT * FROM ${tableName} ORDER BY timestamp`).all();

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

      logger.info(`Parquetファイルから${candles.length}件のローソク足データを読み込みました: ${filePath}`);
      return candles;
    } catch (error) {
      logger.error(`Parquet読み込みエラー: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 複数のParquetファイルから条件に一致するデータを検索して結合
   * @param symbol 銘柄シンボル (例: 'SOL_USDT')
   * @param timeframe 時間枠 (例: '1h')
   * @param startTimestamp 開始タイムスタンプ（ミリ秒）
   * @param endTimestamp 終了タイムスタンプ（ミリ秒）
   * @returns ローソク足データの配列
   */
  public async queryCandles(
    symbol: string,
    timeframe: string,
    startTimestamp?: number,
    endTimestamp?: number
  ): Promise<Candle[]> {
    try {
      const formattedSymbol = symbol.replace('/', '_');
      
      // ファイル名のパターンを調整（厳格なパターンからゆるいパターンへ）
      const files = fs.readdirSync(PARQUET_DIR)
        .filter((file: string) => {
          // SOLUSDT_1h で始まるすべてのParquetファイルを検索
          return file.startsWith(`${formattedSymbol}_${timeframe}`) && file.endsWith('.parquet');
        });

      if (files.length === 0) {
        logger.warn(`${formattedSymbol}_${timeframe}*.parquetに一致するファイルが見つかりません。対象ディレクトリ: ${PARQUET_DIR}`);
        return [];
      }

      // デバッグ情報を追加
      logger.info(`以下のファイルが検索条件に一致しました: ${files.join(', ')}`);

      // ファイルパスをカンマ区切りで結合
      const filesList = files.map((file: string) => `'${path.join(PARQUET_DIR, file)}'`).join(', ');
      
      // テーブル名を設定
      const tableName = `temp_query_${Date.now()}`;

      try {
        // 一時テーブルを作成
        this.conn.exec(`
          CREATE TABLE ${tableName} AS 
          SELECT * FROM read_parquet([${filesList}]);
        `);

        // テーブルの行数を確認
        const countResult = this.conn.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).all();
        const count = countResult && countResult[0] ? countResult[0].count : 0;
        logger.info(`テーブル ${tableName} に ${count} 行のデータが読み込まれました`);

        // クエリを構築
        let query = `SELECT * FROM ${tableName}`;
        const conditions = [];
        
        if (startTimestamp) {
          conditions.push(`timestamp >= ${startTimestamp}`);
        }
        
        if (endTimestamp) {
          conditions.push(`timestamp <= ${endTimestamp}`);
        }
        
        if (conditions.length > 0) {
          query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY timestamp`;

        // デバッグ情報: 実行されるSQLを表示
        logger.info(`実行クエリ: ${query}`);

        // クエリを実行 - エラーハンドリングを強化
        let resultRows;
        try {
          const statement = this.conn.prepare(query);
          resultRows = statement.all();
        } catch (queryError) {
          logger.error(`クエリ実行エラー: ${queryError instanceof Error ? queryError.message : String(queryError)}`);
          
          // シンプルなクエリを試す
          try {
            logger.info(`シンプルなクエリでリトライします: SELECT * FROM ${tableName} LIMIT 10`);
            resultRows = this.conn.prepare(`SELECT * FROM ${tableName} LIMIT 10`).all();
          } catch (retryError) {
            logger.error(`シンプルクエリも失敗: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
            return [];
          }
        }
        
        // 結果が配列であることを確認
        if (!Array.isArray(resultRows)) {
          logger.error(`クエリ結果が配列ではありません: ${typeof resultRows}, 値: ${JSON.stringify(resultRows)}`);
          return [];
        }

        if (resultRows.length === 0) {
          logger.warn(`クエリ結果が0件です`);
          return [];
        }

        logger.info(`クエリが ${resultRows.length} 件のデータを返しました`);

        // 結果をCandle配列に変換
        const candles: Candle[] = [];
        
        for (let i = 0; i < resultRows.length; i++) {
          const row = resultRows[i];
          if (row && typeof row === 'object') {
            try {
              const candle: Candle = {
                timestamp: Number(row.timestamp),
                open: Number(row.open),
                high: Number(row.high),
                low: Number(row.low),
                close: Number(row.close),
                volume: Number(row.volume)
              };
              candles.push(candle);
            } catch (convError) {
              logger.error(`${i}番目の行の変換エラー: ${JSON.stringify(row)}, エラー: ${convError instanceof Error ? convError.message : String(convError)}`);
            }
          } else {
            logger.warn(`${i}番目の行が不正な形式です: ${JSON.stringify(row)}`);
          }
        }

        logger.info(`${files.length}ファイルから${candles.length}件のローソク足データを取得しました`);
        return candles;
      } finally {
        // 一時テーブルを削除（エラーの有無にかかわらず実行）
        try {
          this.conn.exec(`DROP TABLE IF EXISTS ${tableName}`);
        } catch (dropError) {
          logger.warn(`一時テーブル削除エラー: ${dropError instanceof Error ? dropError.message : String(dropError)}`);
        }
      }
    } catch (error) {
      logger.error(`Parquetクエリエラー: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * バックテスト用にローソク足データを取得
   * @param options バックテスト用データ取得オプション
   * @returns ローソク足データの配列
   */
  public async getCandleData(options: {
    symbol: string;
    timeframeHours: number;
    startDate: Date;
    endDate: Date;
  }): Promise<Candle[]> {
    try {
      const { symbol, timeframeHours, startDate, endDate } = options;
      
      // 時間枠を文字列に変換 (例: 1 -> '1h')
      const timeframe = `${timeframeHours}h`;
      
      // タイムスタンプに変換
      const startTimestamp = startDate.getTime();
      const endTimestamp = endDate.getTime();
      
      logger.info(`バックテスト用データ取得: ${symbol} ${timeframe} (${startDate.toISOString()} - ${endDate.toISOString()})`);
      
      // queryCandles を使用してデータを取得
      const candles = await this.queryCandles(symbol, timeframe, startTimestamp, endTimestamp);
      
      if (candles.length === 0) {
        logger.warn(`${symbol} ${timeframe} の期間 ${startDate.toISOString()} - ${endDate.toISOString()} のデータが見つかりません`);
      } else {
        logger.info(`${candles.length}件のローソク足データを取得しました`);
      }
      
      return candles;
    } catch (error) {
      logger.error(`バックテストデータ取得エラー: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * リソースを解放する
   */
  public close(): void {
    try {
      this.conn.close();
      this.db.close();
      logger.info('ParquetDataStoreを終了しました');
    } catch (error) {
      logger.error(`ParquetDataStore終了エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 