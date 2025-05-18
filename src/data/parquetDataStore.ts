/**
 * Parquet形式でのデータ永続化処理を実装
 * DuckDBとParquetを利用して効率的なデータ保存と取得を行う
 */

// @ts-nocheck
// 外部モジュールのインポート
const fs = require('fs');
const path = require('path');
// duckdbのインポート方法を修正
const duckdb = require('duckdb');
const { Candle, isNumericTimestamp, normalizeTimestamp } = require('../core/types');
const logger = require('../utils/logger');

// データフォルダのパス設定
const DATA_DIR = path.join(process.cwd(), 'data');
const PARQUET_DIR = path.join(DATA_DIR, 'candles');

/**
 * Parquetデータストアクラス
 * 時系列データをParquet形式で効率的に保存・取得する機能を提供
 */
class ParquetDataStore {
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
  ensureDirectoriesExist() {
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
  async saveCandles(symbol, timeframe, candles) {
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
  async loadCandles(symbol, timeframe, date) {
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
      const result = this.conn.exec(`
        SELECT 
          timestamp,
          open,
          high,
          low,
          close,
          volume
        FROM ${tableName}
        ORDER BY timestamp ASC;
      `).all();

      // ビューを削除
      this.conn.exec(`DROP VIEW ${tableName};`);

      // 結果をCandle配列に変換
      const candles = result.map((row) => ({
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
  async queryCandles(symbol, timeframe, startTimestamp, endTimestamp) {
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

      // 一時テーブルを作成 (UNION ALLを使用)
      this.conn.exec(`CREATE VIEW ${tableName} AS `);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this.conn.exec(`${i === 0 ? '' : 'UNION ALL '}SELECT * FROM read_parquet('${file}')`);
      }
      this.conn.exec(`;`);

      // WHERE条件を設定
      let whereClause = '';
      const params = [];
      if (startTimestamp !== undefined && endTimestamp !== undefined) {
        whereClause = `WHERE timestamp >= ${startTimestamp} AND timestamp <= ${endTimestamp}`;
      } else if (startTimestamp !== undefined) {
        whereClause = `WHERE timestamp >= ${startTimestamp}`;
      } else if (endTimestamp !== undefined) {
        whereClause = `WHERE timestamp <= ${endTimestamp}`;
      }

      // クエリを実行
      const query = `
        SELECT 
          timestamp,
          open,
          high,
          low,
          close,
          volume
        FROM ${tableName}
        ${whereClause}
        ORDER BY timestamp ASC;
      `;

      const result = this.conn.exec(query).all();

      // ビューを削除
      this.conn.exec(`DROP VIEW ${tableName};`);

      // 結果をCandle配列に変換
      const candles = result.map((row) => ({
        timestamp: Number(row.timestamp),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume)
      }));

      logger.info(`${symbol}の${timeframe}足データを${candles.length}件取得しました`);
      return candles;
    } catch (error) {
      logger.error(`Parquetクエリエラー: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * すべての時間足のデータを取得する
   * @param symbol 銘柄シンボル (例: 'binance_SOL_USDT')
   * @param timeframes 時間足の配列 (例: ['1m', '5m', '1h', '1d'])
   * @param limit 取得するローソク足の数
   * @returns 時間足ごとのローソク足データのマップ
   */
  async getLatestDataForAllTimeframes(symbol, timeframes, limit = 100) {
    const result = {};

    try {
      for (const timeframe of timeframes) {
        try {
          const candles = await this.getLatestCandles(symbol, timeframe, limit);
          if (candles.length > 0) {
            result[timeframe] = candles;
          }
        } catch (error) {
          logger.error(
            `${symbol}の${timeframe}足データ取得エラー: ${error instanceof Error ? error.message : String(error)}`
          );
          // エラーが発生しても処理を続行
        }
      }
    } catch (error) {
      logger.error(
        `複数時間足データ取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return result;
  }

  /**
   * 最新のローソク足データを取得する
   * @param symbol 銘柄シンボル (例: 'binance_SOL_USDT')
   * @param timeframe 時間枠 (例: '1h')
   * @param limit 取得するローソク足の数
   * @returns ローソク足データの配列
   */
  async getLatestCandles(symbol, timeframe, limit = 100) {
    try {
      // ファイルパターンの作成
      const filePattern = `${symbol.replace('/', '_')}_${timeframe}_*.parquet`;
      
      // すべての対象ファイルを探す
      const files = fs
        .readdirSync(PARQUET_DIR)
        .filter((file) => file.startsWith(`${symbol.replace('/', '_')}_${timeframe}_`))
        .sort((a, b) => {
          // ファイル名から日付部分を抽出して比較（降順）
          const dateA = a.split('_').pop()?.replace('.parquet', '') || '';
          const dateB = b.split('_').pop()?.replace('.parquet', '') || '';
          return dateB.localeCompare(dateA);
        });

      if (files.length === 0) {
        logger.warn(`パターン${filePattern}に一致するファイルが見つかりません`);
        return [];
      }

      // テーブル名を設定
      const tableName = `temp_latest_${Date.now()}`;

      // 最新のファイルから順に処理
      let allCandles = [];
      for (const file of files) {
        if (allCandles.length >= limit) break;

        const filePath = path.join(PARQUET_DIR, file);
        
        // Parquetファイルからデータを読み込み
        this.conn.exec(`
          CREATE VIEW ${tableName} AS SELECT * FROM read_parquet('${filePath}');
        `);

        // データを取得（最新のものから指定数）
        const remainingLimit = limit - allCandles.length;
        const result = this.conn.exec(`
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
        `).all();

        // ビューを削除
        this.conn.exec(`DROP VIEW ${tableName};`);

        if (result.length > 0) {
          // 結果をCandle配列に変換して追加
          const candles = result.map((row) => ({
            timestamp: Number(row.timestamp),
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
            volume: Number(row.volume)
          }));
          
          allCandles = [...allCandles, ...candles];
        }
      }

      // タイムスタンプでソート（降順）
      allCandles.sort((a, b) => b.timestamp - a.timestamp);
      
      // 指定数に制限
      if (allCandles.length > limit) {
        allCandles = allCandles.slice(0, limit);
      }

      // ソート順を元に戻す（昇順）
      allCandles.sort((a, b) => a.timestamp - b.timestamp);

      logger.info(`${symbol}の${timeframe}足データを${allCandles.length}件取得しました`);
      return allCandles;
    } catch (error) {
      logger.error(
        `最新データ取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * 特定の日付範囲のローソク足データを取得する
   * @param options 取得オプション
   * @returns ローソク足データの配列
   */
  async getCandleData(options) {
    const { symbol, timeframeHours, startDate, endDate } = options;
    
    // 時間枠の文字列を生成
    const timeframe = timeframeHours === 1 ? '1h' : 
                      timeframeHours === 24 ? '1d' : 
                      timeframeHours < 1 ? `${timeframeHours * 60}m` : 
                      `${timeframeHours}h`;
    
    // タイムスタンプに変換
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();
    
    return await this.queryCandles(symbol, timeframe, startTimestamp, endTimestamp);
  }

  /**
   * リソースを解放する
   */
  close() {
    try {
      if (this.conn && this.db) {
        // クエリの実行中かもしれないので、適切に終了する
        this.conn.close();
        this.db.close();
        logger.info('ParquetDataStoreを正常に終了しました');
      }
    } catch (error) {
      logger.error(`ParquetDataStore終了エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 利用可能なデータファイルをリストアップする
   * @param symbol 銘柄シンボル（フィルタリングに使用）
   * @param timeframe 時間枠（フィルタリングに使用）
   * @returns ファイル情報の配列
   */
  listAvailableData(symbol, timeframe) {
    try {
      if (!fs.existsSync(PARQUET_DIR)) {
        return [];
      }

      let files = fs.readdirSync(PARQUET_DIR).filter((file) => file.endsWith('.parquet'));

      // シンボルでフィルタリング
      if (symbol) {
        const symbolPattern = symbol.replace('/', '_');
        files = files.filter((file) => file.includes(symbolPattern));
      }

      // 時間枠でフィルタリング
      if (timeframe) {
        files = files.filter((file) => {
          const parts = file.split('_');
          return parts.length >= 3 && parts[parts.length - 2] === timeframe;
        });
      }

      // ファイル情報を作成
      return files.map((file) => {
        const filePath = path.join(PARQUET_DIR, file);
        const stats = fs.statSync(filePath);
        
        // ファイル名から日付を抽出
        const datePart = file.split('_').pop()?.replace('.parquet', '') || '';
        
        return {
          file,
          date: datePart,
          size: Math.round(stats.size / 1024) // サイズをKBで表示
        };
      });
    } catch (error) {
      logger.error(
        `データファイル一覧取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }
}

module.exports = { ParquetDataStore };
