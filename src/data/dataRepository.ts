/**
 * データの永続化と取得を管理するリポジトリ
 * 
 * このファイルはローソク足データや取引履歴などの情報を保存・取得するための
 * インターフェースを提供します。実際のストレージはファイルベースまたはデータベースベースで実装できます。
 */

import fs from 'fs';
import path from 'path';
import { Candle, Order, PerformanceMetrics } from '../core/types';
import logger from '../utils/logger';

// データフォルダのパス設定
const DATA_DIR = path.join(process.cwd(), 'data');
const CANDLES_DIR = path.join(DATA_DIR, 'candles');
const ORDERS_DIR = path.join(DATA_DIR, 'orders');
const METRICS_DIR = path.join(DATA_DIR, 'metrics');

/**
 * データリポジトリクラス
 */
export class DataRepository {
  constructor() {
    this.ensureDirectoriesExist();
  }

  /**
   * 必要なディレクトリが存在することを確認する
   */
  private ensureDirectoriesExist(): void {
    [DATA_DIR, CANDLES_DIR, ORDERS_DIR, METRICS_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch (error) {
          logger.error(`ディレクトリ作成エラー: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    });
  }

  /**
   * ローソク足データを保存する
   * @param symbol 銘柄（例: 'SOL_USDT'）
   * @param timeframe 時間枠（例: '1h'）
   * @param candles ローソク足データの配列
   * @returns 成功したかどうか
   */
  public async saveCandles(symbol: string, timeframe: string, candles: Candle[]): Promise<boolean> {
    try {
      // ファイル名を作成（例: 'SOL_USDT_1h_20250605.json'）
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `${symbol.replace('/', '_')}_${timeframe}_${date}.json`;
      const filePath = path.join(CANDLES_DIR, filename);

      // JSONとして保存
      await fs.promises.writeFile(filePath, JSON.stringify(candles, null, 2));
      logger.debug(`ローソク足データを保存しました: ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`ローソク足データ保存エラー: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * ローソク足データを読み込む
   * @param symbol 銘柄（例: 'SOL_USDT'）
   * @param timeframe 時間枠（例: '1h'）
   * @param date 読み込む日付（形式: 'YYYYMMDD'）
   * @returns ローソク足データの配列
   */
  public async loadCandles(symbol: string, timeframe: string, date: string): Promise<Candle[]> {
    try {
      const filename = `${symbol.replace('/', '_')}_${timeframe}_${date}.json`;
      const filePath = path.join(CANDLES_DIR, filename);

      if (!fs.existsSync(filePath)) {
        logger.warn(`ローソク足データが見つかりません: ${filePath}`);
        return [];
      }

      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data) as Candle[];
    } catch (error) {
      logger.error(`ローソク足データ読み込みエラー: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 注文履歴を保存する
   * @param orders 注文の配列
   * @returns 成功したかどうか
   */
  public async saveOrders(orders: Order[]): Promise<boolean> {
    try {
      // 実行日ごとにファイルを作成
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `orders_${date}.json`;
      const filePath = path.join(ORDERS_DIR, filename);

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
      logger.error(`注文履歴保存エラー: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 注文履歴を読み込む
   * @param date 日付（形式: 'YYYYMMDD'）
   * @returns 注文の配列
   */
  public async loadOrders(date: string): Promise<Order[]> {
    try {
      const filename = `orders_${date}.json`;
      const filePath = path.join(ORDERS_DIR, filename);

      if (!fs.existsSync(filePath)) {
        logger.warn(`注文履歴が見つかりません: ${filePath}`);
        return [];
      }

      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data) as Order[];
    } catch (error) {
      logger.error(`注文履歴読み込みエラー: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * パフォーマンスメトリクスを保存する
   * @param metrics パフォーマンスメトリクス
   * @returns 成功したかどうか
   */
  public async savePerformanceMetrics(metrics: PerformanceMetrics): Promise<boolean> {
    try {
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `metrics_${date}.json`;
      const filePath = path.join(METRICS_DIR, filename);

      await fs.promises.writeFile(filePath, JSON.stringify(metrics, null, 2));
      logger.debug(`パフォーマンスメトリクスを保存しました: ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`メトリクス保存エラー: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * パフォーマンスメトリクスを読み込む
   * @param date 日付（形式: 'YYYYMMDD'）
   * @returns パフォーマンスメトリクス
   */
  public async loadPerformanceMetrics(date: string): Promise<PerformanceMetrics | null> {
    try {
      const filename = `metrics_${date}.json`;
      const filePath = path.join(METRICS_DIR, filename);

      if (!fs.existsSync(filePath)) {
        logger.warn(`メトリクスが見つかりません: ${filePath}`);
        return null;
      }

      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data) as PerformanceMetrics;
    } catch (error) {
      logger.error(`メトリクス読み込みエラー: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
} 