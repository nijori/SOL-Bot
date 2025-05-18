/**
 * データの永続化と取得を管理するリポジトリ
 *
 * このファイルはローソク足データや取引履歴などの情報を保存・取得するための
 * インターフェースを提供します。実際のストレージはファイルベースまたはデータベースベースで実装できます。
 *
 * DAT-014: データストアマルチシンボル拡張
 * TST-013: DataRepository並列E2Eテスト対応
 */

// @ts-nocheck
const fs = require('fs');
const path = require('path');
const { Candle, Order, PerformanceMetrics } = require('../core/types');
const logger = require('../utils/logger');
const { Mutex } = require('async-mutex');

// データフォルダのパス設定
const DATA_DIR = path.join(process.cwd(), 'data');
const CANDLES_DIR = path.join(DATA_DIR, 'candles');
const ORDERS_DIR = path.join(DATA_DIR, 'orders');
const METRICS_DIR = path.join(DATA_DIR, 'metrics');

/**
 * マルチシンボル対応のデータリポジトリ
 */
class DataRepository {
  /**
   * シングルトンインスタンスを取得
   */
  static getInstance() {
    if (!DataRepository.instance) {
      DataRepository.instance = new DataRepository();
    }
    return DataRepository.instance;
  }

  constructor() {
    this.fileLocks = new Map(); // ファイルごとのロック
    this.ensureDirectoriesExist();
  }

  /**
   * 必要なディレクトリが存在することを確認する
   */
  ensureDirectoriesExist() {
    [DATA_DIR, CANDLES_DIR, ORDERS_DIR, METRICS_DIR].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch (error) {
          logger.error(
            `ディレクトリ作成エラー: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    });
  }

  /**
   * シンボルに対応するディレクトリを確保する
   * @param symbol 銘柄（例: 'SOL/USDT'）
   * @param baseDir ベースディレクトリ
   * @returns シンボル固有のディレクトリパス
   */
  ensureSymbolDirectory(symbol, baseDir) {
    const normalizedSymbol = symbol.replace('/', '_');
    const symbolDir = path.join(baseDir, normalizedSymbol);

    if (!fs.existsSync(symbolDir)) {
      try {
        fs.mkdirSync(symbolDir, { recursive: true });
        logger.debug(`シンボルディレクトリを作成しました: ${symbolDir}`);
      } catch (error) {
        logger.error(
          `シンボルディレクトリ作成エラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return symbolDir;
  }

  /**
   * ファイルパスに対するミューテックスを取得する（ない場合は作成）
   * @param filePath ファイルパス
   * @returns そのファイルに対するミューテックス
   */
  getFileLock(filePath) {
    if (!this.fileLocks.has(filePath)) {
      this.fileLocks.set(filePath, new Mutex());
    }
    return this.fileLocks.get(filePath);
  }

  /**
   * データディレクトリ情報を取得する
   * テスト用にオーバーライド可能
   * @returns データディレクトリのパス情報
   */
  getDataDirectories() {
    return {
      dataDir: DATA_DIR,
      candlesDir: CANDLES_DIR,
      ordersDir: ORDERS_DIR,
      metricsDir: METRICS_DIR
    };
  }

  /**
   * ローソク足データを保存する
   * @param symbol 銘柄（例: 'SOL/USDT'）
   * @param timeframe 時間枠（例: '1h'）
   * @param candles ローソク足データの配列
   * @returns 成功したかどうか
   */
  async saveCandles(symbol, timeframe, candles) {
    const dirs = this.getDataDirectories();
    const symbolDir = this.ensureSymbolDirectory(symbol, dirs.candlesDir);

    // ファイル名を作成（例: '1h_20250605.json'）
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `${timeframe}_${date}.json`;
    const filePath = path.join(symbolDir, filename);

    // このファイルに対するロックを取得
    const fileLock = this.getFileLock(filePath);

    // ロックを取得してファイル操作を行う
    return await fileLock.runExclusive(async () => {
      try {
        // 既存のデータと結合する必要があるかチェック
        let allCandles = [...candles];
        if (fs.existsSync(filePath)) {
          try {
            const existingData = await fs.promises.readFile(filePath, 'utf8');
            const existingCandles = JSON.parse(existingData);

            // 既存のデータとマージ (タイムスタンプでソート)
            allCandles = [...existingCandles, ...candles].sort((a, b) => {
              return a.timestamp - b.timestamp;
            });

            // 重複を除去（同じタイムスタンプのデータは後のものを優先）
            const uniqueCandles = [];
            const timestampSet = new Set();

            // 重複を取り除く
            allCandles.forEach((candle) => {
              if (!timestampSet.has(candle.timestamp)) {
                timestampSet.add(candle.timestamp);
                uniqueCandles.push(candle);
              }
            });

            allCandles = uniqueCandles;
          } catch (error) {
            // 既存ファイルが無効な場合は新しいデータだけを使用
            logger.warn(
              `既存のローソク足データの読み込みに失敗しました: ${filePath}. 新しいデータのみを使用します。`
            );
          }
        }

        // JSONとして保存
        await fs.promises.writeFile(filePath, JSON.stringify(allCandles, null, 2));
        logger.debug(`ローソク足データを保存しました: ${filePath}`);
        return true;
      } catch (error) {
        logger.error(
          `ローソク足データ保存エラー: ${error instanceof Error ? error.message : String(error)}`
        );
        return false;
      }
    });
  }

  /**
   * ローソク足データを読み込む
   * @param symbol 銘柄（例: 'SOL/USDT'）
   * @param timeframe 時間枠（例: '1h'）
   * @param date 読み込む日付（形式: 'YYYYMMDD'）
   * @returns ローソク足データの配列
   */
  async loadCandles(symbol, timeframe, date) {
    try {
      const dirs = this.getDataDirectories();
      const normalizedSymbol = symbol.replace('/', '_');
      const symbolDir = path.join(dirs.candlesDir, normalizedSymbol);

      if (!fs.existsSync(symbolDir)) {
        logger.warn(`シンボルディレクトリが見つかりません: ${symbolDir}`);
        return [];
      }

      const filename = `${timeframe}_${date}.json`;
      const filePath = path.join(symbolDir, filename);

      if (!fs.existsSync(filePath)) {
        logger.warn(`ローソク足データが見つかりません: ${filePath}`);
        return [];
      }

      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error(
        `ローソク足データ読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * 複数シンボルのローソク足データを一括で読み込む
   * @param symbols 銘柄の配列（例: ['SOL/USDT', 'BTC/USDT']）
   * @param timeframe 時間枠（例: '1h'）
   * @param date 読み込む日付（形式: 'YYYYMMDD'）
   * @returns シンボルごとのローソク足データのマップ
   */
  async loadMultipleSymbolCandles(symbols, timeframe, date) {
    const result = new Map();

    for (const symbol of symbols) {
      try {
        const candles = await this.loadCandles(symbol, timeframe, date);
        if (candles.length > 0) {
          result.set(symbol, candles);
        }
      } catch (error) {
        logger.error(
          `シンボル ${symbol} のローソク足データ読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
        );
        // エラーが発生しても処理を続行（部分的な読み込み失敗を許容）
      }
    }

    return result;
  }

  /**
   * 利用可能なシンボルの一覧を取得する
   * @returns 利用可能なシンボルの配列
   */
  getAvailableSymbols() {
    try {
      const dirs = this.getDataDirectories();
      const filesAndDirs = fs.readdirSync(dirs.candlesDir);
      
      // ディレクトリのみをフィルタリング
      const symbols = filesAndDirs.filter((item) => {
        const fullPath = path.join(dirs.candlesDir, item);
        return fs.statSync(fullPath).isDirectory();
      });
      
      // '_' を '/' に戻す
      return symbols.map((symbol) => symbol.replace('_', '/'));
    } catch (error) {
      logger.error(
        `利用可能なシンボル取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * 特定シンボルの利用可能な時間枠を取得する
   * @param symbol 銘柄（例: 'SOL/USDT'）
   * @returns 利用可能な時間枠の配列
   */
  getAvailableTimeframes(symbol) {
    try {
      const dirs = this.getDataDirectories();
      const normalizedSymbol = symbol.replace('/', '_');
      const symbolDir = path.join(dirs.candlesDir, normalizedSymbol);

      if (!fs.existsSync(symbolDir)) {
        logger.warn(`シンボルディレクトリが見つかりません: ${symbolDir}`);
        return [];
      }

      const files = fs.readdirSync(symbolDir);
      
      // ファイル名から時間枠を抽出
      const timeframes = new Set();
      files.forEach((file) => {
        if (file.endsWith('.json')) {
          const timeframe = file.split('_')[0];
          timeframes.add(timeframe);
        }
      });
      
      return Array.from(timeframes);
    } catch (error) {
      logger.error(
        `利用可能な時間枠取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * 注文データを保存する
   * @param orders 注文データの配列
   * @param date 保存する日付（省略時は現在の日付）
   * @param symbol 銘柄（省略時は'all'）
   * @returns 成功したかどうか
   */
  async saveOrders(orders, date, symbol = 'all') {
    if (orders.length === 0) {
      logger.warn('保存する注文データがありません');
      return false;
    }

    const dirs = this.getDataDirectories();
    const symbolDir = this.ensureSymbolDirectory(symbol, dirs.ordersDir);

    // ファイル名を作成（例: '20250605.json'）
    const saveDate = date || new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `${saveDate}.json`;
    const filePath = path.join(symbolDir, filename);

    // このファイルに対するロックを取得
    const fileLock = this.getFileLock(filePath);

    // ロックを取得してファイル操作を行う
    return await fileLock.runExclusive(async () => {
      try {
        // 既存の注文と結合
        let allOrders = [...orders];
        if (fs.existsSync(filePath)) {
          try {
            const existingData = await fs.promises.readFile(filePath, 'utf8');
            const existingOrders = JSON.parse(existingData);
            allOrders = [...existingOrders, ...orders];
          } catch (error) {
            logger.warn(
              `既存の注文データの読み込みに失敗しました: ${filePath}. 新しいデータのみを使用します。`
            );
          }
        }

        // JSONとして保存
        await fs.promises.writeFile(filePath, JSON.stringify(allOrders, null, 2));
        logger.debug(`注文データを保存しました: ${filePath}`);
        return true;
      } catch (error) {
        logger.error(
          `注文データ保存エラー: ${error instanceof Error ? error.message : String(error)}`
        );
        return false;
      }
    });
  }

  /**
   * 注文データを読み込む
   * @param date 読み込む日付（形式: 'YYYYMMDD'）
   * @param symbol 銘柄（省略時は'all'）
   * @returns 注文データの配列
   */
  async loadOrders(date, symbol = 'all') {
    try {
      const dirs = this.getDataDirectories();
      const normalizedSymbol = symbol.replace('/', '_');
      const symbolDir = path.join(dirs.ordersDir, normalizedSymbol);

      if (!fs.existsSync(symbolDir)) {
        logger.warn(`シンボルディレクトリが見つかりません: ${symbolDir}`);
        return [];
      }

      const filename = `${date}.json`;
      const filePath = path.join(symbolDir, filename);

      if (!fs.existsSync(filePath)) {
        logger.warn(`注文データが見つかりません: ${filePath}`);
        return [];
      }

      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error(
        `注文データ読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * 複数シンボルの注文データを一括で読み込む
   * @param date 読み込む日付（形式: 'YYYYMMDD'）
   * @param symbols 銘柄の配列（例: ['SOL/USDT', 'BTC/USDT']）
   * @returns シンボルごとの注文データのマップ
   */
  async loadMultipleSymbolOrders(date, symbols) {
    const result = new Map();

    // まず「全シンボル共通」の注文データを読み込む
    try {
      const allOrders = await this.loadOrders(date, 'all');
      if (allOrders.length > 0) {
        result.set('all', allOrders);
      }
    } catch (error) {
      logger.error(
        `全シンボル共通の注文データ読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 各シンボル固有の注文データを読み込む
    for (const symbol of symbols) {
      try {
        const orders = await this.loadOrders(date, symbol);
        if (orders.length > 0) {
          result.set(symbol, orders);
        }
      } catch (error) {
        logger.error(
          `シンボル ${symbol} の注文データ読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
        );
        // エラーが発生しても処理を続行
      }
    }

    return result;
  }

  /**
   * パフォーマンスメトリクスを保存する
   * @param metrics パフォーマンスメトリクス
   * @param date 保存する日付（省略時は現在の日付）
   * @param symbol 銘柄（省略時は'all'）
   * @returns 成功したかどうか
   */
  async savePerformanceMetrics(metrics, date, symbol = 'all') {
    if (!metrics) {
      logger.warn('保存するメトリクスデータがありません');
      return false;
    }

    const dirs = this.getDataDirectories();
    const symbolDir = this.ensureSymbolDirectory(symbol, dirs.metricsDir);

    // ファイル名を作成（例: '20250605.json'）
    const saveDate = date || new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `${saveDate}.json`;
    const filePath = path.join(symbolDir, filename);

    // このファイルに対するロックを取得
    const fileLock = this.getFileLock(filePath);

    // ロックを取得してファイル操作を行う
    return await fileLock.runExclusive(async () => {
      try {
        // 既存のメトリクスと結合（今日の分は上書き）
        let allMetrics = { ...metrics };
        if (fs.existsSync(filePath)) {
          try {
            const existingData = await fs.promises.readFile(filePath, 'utf8');
            const existingMetrics = JSON.parse(existingData);
            
            // 既存のメトリクスを現在のもので上書き更新
            allMetrics = {
              ...existingMetrics,
              ...metrics,
              // 配列データはマージではなく置換
              trades: metrics.trades || existingMetrics.trades,
              dailyReturns: metrics.dailyReturns || existingMetrics.dailyReturns
            };
          } catch (error) {
            logger.warn(
              `既存のメトリクスデータの読み込みに失敗しました: ${filePath}. 新しいデータのみを使用します。`
            );
          }
        }

        // JSONとして保存
        await fs.promises.writeFile(filePath, JSON.stringify(allMetrics, null, 2));
        logger.debug(`パフォーマンスメトリクスを保存しました: ${filePath}`);
        return true;
      } catch (error) {
        logger.error(
          `メトリクスデータ保存エラー: ${error instanceof Error ? error.message : String(error)}`
        );
        return false;
      }
    });
  }

  /**
   * パフォーマンスメトリクスを読み込む
   * @param date 読み込む日付（形式: 'YYYYMMDD'）
   * @param symbol 銘柄（省略時は'all'）
   * @returns パフォーマンスメトリクス
   */
  async loadPerformanceMetrics(date, symbol = 'all') {
    try {
      const dirs = this.getDataDirectories();
      const normalizedSymbol = symbol.replace('/', '_');
      const symbolDir = path.join(dirs.metricsDir, normalizedSymbol);

      if (!fs.existsSync(symbolDir)) {
        logger.warn(`シンボルディレクトリが見つかりません: ${symbolDir}`);
        return null;
      }

      const filename = `${date}.json`;
      const filePath = path.join(symbolDir, filename);

      if (!fs.existsSync(filePath)) {
        logger.warn(`メトリクスデータが見つかりません: ${filePath}`);
        return null;
      }

      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error(
        `メトリクスデータ読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * 複数シンボルのパフォーマンスメトリクスを一括で読み込む
   * @param date 読み込む日付（形式: 'YYYYMMDD'）
   * @param symbols 銘柄の配列（例: ['SOL/USDT', 'BTC/USDT']）
   * @returns シンボルごとのパフォーマンスメトリクスのマップ
   */
  async loadMultipleSymbolMetrics(date, symbols) {
    const result = new Map();

    // まず「全シンボル共通」のメトリクスを読み込む
    try {
      const allMetrics = await this.loadPerformanceMetrics(date, 'all');
      if (allMetrics) {
        result.set('all', allMetrics);
      }
    } catch (error) {
      logger.error(
        `全シンボル共通のメトリクスデータ読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 各シンボル固有のメトリクスを読み込む
    for (const symbol of symbols) {
      try {
        const metrics = await this.loadPerformanceMetrics(date, symbol);
        if (metrics) {
          result.set(symbol, metrics);
        }
      } catch (error) {
        logger.error(
          `シンボル ${symbol} のメトリクスデータ読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
        );
        // エラーが発生しても処理を続行
      }
    }

    return result;
  }

  /**
   * 指定されたシンボルと時間枠の全ローソク足データを取得する
   * @param symbol 銘柄（例: 'SOL/USDT'）
   * @param timeframe 時間枠（例: '1h'）
   * @returns すべてのローソク足データを結合した配列
   */
  async getCandles(symbol, timeframe) {
    try {
      const dirs = this.getDataDirectories();
      const normalizedSymbol = symbol.replace('/', '_');
      const symbolDir = path.join(dirs.candlesDir, normalizedSymbol);

      if (!fs.existsSync(symbolDir)) {
        logger.warn(`シンボルディレクトリが見つかりません: ${symbolDir}`);
        return [];
      }

      // 指定された時間枠のJSONファイルを探す
      const files = fs.readdirSync(symbolDir)
        .filter(file => file.startsWith(`${timeframe}_`) && file.endsWith('.json'))
        .sort(); // 日付順にソート

      if (files.length === 0) {
        logger.warn(`${symbol}の${timeframe}データが見つかりません`);
        return [];
      }

      // すべてのファイルからデータを読み込んで結合
      let allCandles = [];
      for (const file of files) {
        const filePath = path.join(symbolDir, file);
        try {
          const data = await fs.promises.readFile(filePath, 'utf8');
          const candles = JSON.parse(data);
          allCandles = allCandles.concat(candles);
        } catch (error) {
          logger.error(
            `ファイル読み込みエラー (${filePath}): ${error instanceof Error ? error.message : String(error)}`
          );
          // エラーが発生しても他のファイルの処理を続行
        }
      }

      // タイムスタンプでソートし、重複を除去
      const uniqueCandles = [];
      const timestampSet = new Set();
      
      // まずタイムスタンプでソート
      allCandles.sort((a, b) => a.timestamp - b.timestamp);
      
      // 重複を取り除く
      allCandles.forEach(candle => {
        if (!timestampSet.has(candle.timestamp)) {
          timestampSet.add(candle.timestamp);
          uniqueCandles.push(candle);
        }
      });

      logger.info(`${symbol}の${timeframe}データを${uniqueCandles.length}件取得しました`);
      return uniqueCandles;
    } catch (error) {
      logger.error(
        `ローソク足データ取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }
}

module.exports = { DataRepository };
