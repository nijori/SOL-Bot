/**
 * データの永続化と取得を管理するリポジトリ
 *
 * このファイルはローソク足データや取引履歴などの情報を保存・取得するための
 * インターフェースを提供します。実際のストレージはファイルベースまたはデータベースベースで実装できます。
 *
 * DAT-014: データストアマルチシンボル拡張
 * TST-013: DataRepository並列E2Eテスト対応
 */

import fs from 'fs';
import path from 'path';
import { Candle, Order, PerformanceMetrics } from '../core/types.js';
import logger from '../utils/logger.js';
import { Mutex } from 'async-mutex';

// データフォルダのパス設定
const DATA_DIR = path.join(process.cwd(), 'data');
const CANDLES_DIR = path.join(DATA_DIR, 'candles');
const ORDERS_DIR = path.join(DATA_DIR, 'orders');
const METRICS_DIR = path.join(DATA_DIR, 'metrics');

/**
 * マルチシンボル対応のデータリポジトリ
 */
export class DataRepository {
  private static instance: DataRepository;
  private fileLocks: Map<string, Mutex> = new Map(); // ファイルごとのロック

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): DataRepository {
    if (!DataRepository.instance) {
      DataRepository.instance = new DataRepository();
    }
    return DataRepository.instance;
  }

  constructor() {
    this.ensureDirectoriesExist();
  }

  /**
   * 必要なディレクトリが存在することを確認する
   */
  private ensureDirectoriesExist(): void {
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
  private ensureSymbolDirectory(symbol: string, baseDir: string): string {
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
  private getFileLock(filePath: string): Mutex {
    if (!this.fileLocks.has(filePath)) {
      this.fileLocks.set(filePath, new Mutex());
    }
    return this.fileLocks.get(filePath)!;
  }

  /**
   * データディレクトリ情報を取得する
   * テスト用にオーバーライド可能
   * @returns データディレクトリのパス情報
   */
  protected getDataDirectories() {
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
  public async saveCandles(symbol: string, timeframe: string, candles: Candle[]): Promise<boolean> {
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
        let allCandles: Candle[] = [...candles];
        if (fs.existsSync(filePath)) {
          try {
            const existingData = await fs.promises.readFile(filePath, 'utf8');
            const existingCandles = JSON.parse(existingData) as Candle[];

            // 既存のデータとマージ (タイムスタンプでソート)
            allCandles = [...existingCandles, ...candles].sort((a, b) => {
              return (a.timestamp as number) - (b.timestamp as number);
            });

            // 重複を除去（同じタイムスタンプのデータは後のものを優先）
            const uniqueCandles: Candle[] = [];
            const timestampSet = new Set<number>();

            // 重複を取り除く
            allCandles.forEach((candle) => {
              if (!timestampSet.has(candle.timestamp as number)) {
                timestampSet.add(candle.timestamp as number);
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
  public async loadCandles(symbol: string, timeframe: string, date: string): Promise<Candle[]> {
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
      return JSON.parse(data) as Candle[];
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
  public async loadMultipleSymbolCandles(
    symbols: string[],
    timeframe: string,
    date: string
  ): Promise<Map<string, Candle[]>> {
    const result = new Map<string, Candle[]>();

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
  public getAvailableSymbols(): string[] {
    try {
      const dirs = this.getDataDirectories();
      if (!fs.existsSync(dirs.candlesDir)) {
        return [];
      }

      // ディレクトリ名からシンボルを抽出
      return fs
        .readdirSync(dirs.candlesDir)
        .filter((name) => fs.statSync(path.join(dirs.candlesDir, name)).isDirectory())
        .map((dir) => dir.replace('_', '/'));
    } catch (error) {
      logger.error(
        `シンボル一覧取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * 特定のシンボルで利用可能なタイムフレームの一覧を取得する
   * @param symbol 銘柄（例: 'SOL/USDT'）
   * @returns 利用可能なタイムフレームの配列
   */
  public getAvailableTimeframes(symbol: string): string[] {
    try {
      const dirs = this.getDataDirectories();
      const normalizedSymbol = symbol.replace('/', '_');
      const symbolDir = path.join(dirs.candlesDir, normalizedSymbol);

      if (!fs.existsSync(symbolDir)) {
        logger.warn(`シンボルディレクトリが見つかりません: ${symbolDir}`);
        return [];
      }

      // ファイル名からタイムフレームを抽出
      const uniqueTimeframes = new Set<string>();
      fs.readdirSync(symbolDir)
        .filter((file) => file.endsWith('.json'))
        .forEach((file) => {
          const matches = file.match(/^([^_]+)_/);
          if (matches && matches[1]) {
            uniqueTimeframes.add(matches[1]);
          }
        });

      return Array.from(uniqueTimeframes);
    } catch (error) {
      logger.error(
        `タイムフレーム一覧取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * 注文履歴を保存する
   * @param orders 注文の配列
   * @param date 保存する日付（形式: 'YYYYMMDD'）
   * @param symbol シンボル名（省略可。省略時は全シンボル共通の履歴として保存）
   * @returns 成功したかどうか
   */
  public async saveOrders(orders: Order[], date?: string, symbol?: string): Promise<boolean> {
    const dirs = this.getDataDirectories();
    let targetDir = dirs.ordersDir;

    // シンボルが指定されている場合はシンボル固有のディレクトリを使用
    if (symbol) {
      targetDir = this.ensureSymbolDirectory(symbol, dirs.ordersDir);
    }

    // 実行日ごとにファイルを作成
    const dateStr = date || new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `orders_${dateStr}.json`;
    const filePath = path.join(targetDir, filename);

    // このファイルに対するロックを取得
    const fileLock = this.getFileLock(filePath);

    // ロックを取得してファイル操作を行う
    return await fileLock.runExclusive(async () => {
      try {
        // 既存データがあれば結合
        let existingOrders: Order[] = [];
        if (fs.existsSync(filePath)) {
          const data = await fs.promises.readFile(filePath, 'utf8');
          existingOrders = JSON.parse(data) as Order[];
        }

        // 結合して保存
        const allOrders = [...existingOrders, ...orders];
        await fs.promises.writeFile(filePath, JSON.stringify(allOrders, null, 2));
        logger.debug(`注文履歴を保存しました: ${filePath}`);
        return true;
      } catch (error) {
        logger.error(
          `注文履歴保存エラー: ${error instanceof Error ? error.message : String(error)}`
        );
        return false;
      }
    });
  }

  /**
   * 注文履歴を読み込む
   * @param date 日付（形式: 'YYYYMMDD'）
   * @param symbol シンボル名（省略可。省略時は全シンボル共通の履歴を読み込み）
   * @returns 注文の配列
   */
  public async loadOrders(date: string, symbol?: string): Promise<Order[]> {
    try {
      const dirs = this.getDataDirectories();
      let targetDir = dirs.ordersDir;

      // シンボルが指定されている場合はシンボル固有のディレクトリを使用
      if (symbol) {
        const normalizedSymbol = symbol.replace('/', '_');
        targetDir = path.join(dirs.ordersDir, normalizedSymbol);

        if (!fs.existsSync(targetDir)) {
          logger.warn(`シンボル注文ディレクトリが見つかりません: ${targetDir}`);
          return [];
        }
      }

      const filename = `orders_${date}.json`;
      const filePath = path.join(targetDir, filename);

      if (!fs.existsSync(filePath)) {
        logger.warn(`注文履歴が見つかりません: ${filePath}`);
        return [];
      }

      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data) as Order[];
    } catch (error) {
      logger.error(
        `注文履歴読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * 複数シンボルの注文履歴を一括で読み込む
   * @param date 日付（形式: 'YYYYMMDD'）
   * @param symbols 銘柄の配列（例: ['SOL/USDT', 'BTC/USDT']）
   * @returns シンボルごとの注文履歴のマップ
   */
  public async loadMultipleSymbolOrders(
    date: string,
    symbols: string[]
  ): Promise<Map<string, Order[]>> {
    const result = new Map<string, Order[]>();

    // 共通の注文履歴を読み込む
    try {
      const commonOrders = await this.loadOrders(date);
      if (commonOrders.length > 0) {
        result.set('common', commonOrders);
      }
    } catch (error) {
      logger.error(
        `共通注文履歴読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 各シンボルの注文履歴を読み込む
    for (const symbol of symbols) {
      try {
        const orders = await this.loadOrders(date, symbol);
        if (orders.length > 0) {
          result.set(symbol, orders);
        }
      } catch (error) {
        logger.error(
          `シンボル ${symbol} の注文履歴読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
        );
        // エラーが発生しても処理を続行（部分的な読み込み失敗を許容）
      }
    }

    return result;
  }

  /**
   * パフォーマンスメトリクスを保存する
   * @param metrics パフォーマンスメトリクス
   * @param date 保存する日付（形式: 'YYYYMMDD'）
   * @param symbol シンボル名（省略可。省略時は全シンボル共通のメトリクスとして保存）
   * @returns 成功したかどうか
   */
  public async savePerformanceMetrics(
    metrics: PerformanceMetrics,
    date?: string,
    symbol?: string
  ): Promise<boolean> {
    const dirs = this.getDataDirectories();
    let targetDir = dirs.metricsDir;

    // シンボルが指定されている場合はシンボル固有のディレクトリを使用
    if (symbol) {
      targetDir = this.ensureSymbolDirectory(symbol, dirs.metricsDir);
    }

    const dateStr = date || new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `metrics_${dateStr}.json`;
    const filePath = path.join(targetDir, filename);

    // このファイルに対するロックを取得
    const fileLock = this.getFileLock(filePath);

    // ロックを取得してファイル操作を行う
    return await fileLock.runExclusive(async () => {
      try {
        // 既存のメトリクスがあればマージ
        if (fs.existsSync(filePath)) {
          try {
            const existingData = await fs.promises.readFile(filePath, 'utf8');
            const existingMetrics = JSON.parse(existingData) as PerformanceMetrics;

            // 既存メトリクスと新しいメトリクスをマージ
            // 新しいデータを優先するが、不足しているフィールドは既存データから補完
            const mergedMetrics = {
              ...existingMetrics,
              ...metrics
            };

            await fs.promises.writeFile(filePath, JSON.stringify(mergedMetrics, null, 2));
            logger.debug(`パフォーマンスメトリクスを更新しました: ${filePath}`);
            return true;
          } catch (error) {
            logger.warn(
              `既存のメトリクスデータの読み込みに失敗しました: ${filePath}. 新しいデータで上書きします。`
            );
          }
        }

        await fs.promises.writeFile(filePath, JSON.stringify(metrics, null, 2));
        logger.debug(`パフォーマンスメトリクスを保存しました: ${filePath}`);
        return true;
      } catch (error) {
        logger.error(
          `メトリクス保存エラー: ${error instanceof Error ? error.message : String(error)}`
        );
        return false;
      }
    });
  }

  /**
   * パフォーマンスメトリクスを読み込む
   * @param date 日付（形式: 'YYYYMMDD'）
   * @param symbol シンボル名（省略可。省略時は全シンボル共通のメトリクスを読み込み）
   * @returns パフォーマンスメトリクス
   */
  public async loadPerformanceMetrics(
    date: string,
    symbol?: string
  ): Promise<PerformanceMetrics | null> {
    try {
      const dirs = this.getDataDirectories();
      let targetDir = dirs.metricsDir;

      // シンボルが指定されている場合はシンボル固有のディレクトリを使用
      if (symbol) {
        const normalizedSymbol = symbol.replace('/', '_');
        targetDir = path.join(dirs.metricsDir, normalizedSymbol);

        if (!fs.existsSync(targetDir)) {
          logger.warn(`シンボルメトリクスディレクトリが見つかりません: ${targetDir}`);
          return null;
        }
      }

      const filename = `metrics_${date}.json`;
      const filePath = path.join(targetDir, filename);

      if (!fs.existsSync(filePath)) {
        logger.warn(`メトリクスが見つかりません: ${filePath}`);
        return null;
      }

      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data) as PerformanceMetrics;
    } catch (error) {
      logger.error(
        `メトリクス読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * 複数シンボルのパフォーマンスメトリクスを一括で読み込む
   * @param date 日付（形式: 'YYYYMMDD'）
   * @param symbols 銘柄の配列（例: ['SOL/USDT', 'BTC/USDT']）
   * @returns シンボルごとのパフォーマンスメトリクスのマップ
   */
  public async loadMultipleSymbolMetrics(
    date: string,
    symbols: string[]
  ): Promise<Map<string, PerformanceMetrics>> {
    const result = new Map<string, PerformanceMetrics>();

    // 共通のメトリクスを読み込む
    try {
      const commonMetrics = await this.loadPerformanceMetrics(date);
      if (commonMetrics) {
        result.set('common', commonMetrics);
      }
    } catch (error) {
      logger.error(
        `共通メトリクス読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 各シンボルのメトリクスを読み込む
    for (const symbol of symbols) {
      try {
        const metrics = await this.loadPerformanceMetrics(date, symbol);
        if (metrics) {
          result.set(symbol, metrics);
        }
      } catch (error) {
        logger.error(
          `シンボル ${symbol} のメトリクス読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
        );
        // エラーが発生しても処理を続行（部分的な読み込み失敗を許容）
      }
    }

    return result;
  }

  /**
   * 特定のシンボルとタイムフレームの最新ローソク足データを取得
   * @param symbol 銘柄（例: 'SOL/USDT'）
   * @param timeframe 時間枠（例: '1h'）
   * @returns ローソク足データの配列
   */
  public async getCandles(symbol: string, timeframe: string): Promise<Candle[]> {
    try {
      const dirs = this.getDataDirectories();
      const normalizedSymbol = symbol.replace('/', '_');
      const symbolDir = path.join(dirs.candlesDir, normalizedSymbol);

      if (!fs.existsSync(symbolDir)) {
        logger.warn(`シンボルディレクトリが見つかりません: ${symbolDir}`);
        return [];
      }

      // ディレクトリ内のファイルを取得し、指定されたタイムフレームのファイルのみをフィルタリング
      const files = fs
        .readdirSync(symbolDir)
        .filter((file) => file.startsWith(`${timeframe}_`) && file.endsWith('.json'))
        .sort(); // 日付でソート

      if (files.length === 0) {
        logger.warn(`${symbol}の${timeframe}データが見つかりません`);
        return [];
      }

      // 最新のファイルを取得
      const latestFile = files[files.length - 1];
      const filePath = path.join(symbolDir, latestFile);

      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data) as Candle[];
    } catch (error) {
      logger.error(
        `ローソク足データ取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }
}

// グローバルアクセス用のシングルトンインスタンス
export const dataRepository = DataRepository.getInstance();
