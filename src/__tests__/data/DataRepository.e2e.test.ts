import { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { DataRepository } from '../../data/dataRepository';
import {
  Candle,
  Order,
  PerformanceMetrics,
  OrderType,
  OrderSide,
  OrderStatus
} from '../../core/types';
import logger from '../../utils/logger';

/**
 * DataRepository テスト
 * TST-013: DataRepository並列E2Eテスト
 * TST-069: RealTimeDataProcessorとデータリポジトリテストの修正
 */

// テスト用データディレクトリ
const TEST_DATA_DIR = path.join(process.cwd(), 'data', 'test-e2e');
const TEST_CANDLES_DIR = path.join(TEST_DATA_DIR, 'candles');
const TEST_ORDERS_DIR = path.join(TEST_DATA_DIR, 'orders');
const TEST_METRICS_DIR = path.join(TEST_DATA_DIR, 'metrics');

// テスト設定
const TEST_SYMBOL = 'TEST/USDT';
const TEST_TIMEFRAME = '1h';

/**
 * テスト用のモックローソク足を作成
 */
function createMockCandles(count: number, startTimestamp: number = Date.now()): Candle[] {
  const candles: Candle[] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = startTimestamp + i * 60000; // 1分間隔
    const price = 1000 + Math.random() * 100; // 1000-1100のランダムな価格

    candles.push({
      timestamp,
      open: price,
      high: price * 1.01,
      low: price * 0.99,
      close: price * (1 + (Math.random() * 0.02 - 0.01)), // ±1%変動
      volume: Math.random() * 100
    });
  }

  return candles;
}

/**
 * テスト用のモック注文を作成
 */
function createMockOrders(count: number, idPrefix: string = ''): Order[] {
  const orders: Order[] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = Date.now() + i * 1000; // 1秒間隔
    const price = 1000 + Math.random() * 100;

    orders.push({
      id: `order-${idPrefix}-${i}-${Date.now()}`,
      symbol: TEST_SYMBOL,
      type: OrderType.LIMIT,
      side: Math.random() > 0.5 ? OrderSide.BUY : OrderSide.SELL,
      price,
      amount: Math.random() * 1,
      timestamp,
      status: OrderStatus.OPEN
    });
  }

  return orders;
}

/**
 * テスト用のモックパフォーマンスメトリクスを作成
 */
function createMockPerformanceMetrics(id: number): PerformanceMetrics {
  return {
    totalTrades: Math.floor(Math.random() * 100),
    winningTrades: Math.floor(Math.random() * 50),
    losingTrades: Math.floor(Math.random() * 30),
    totalReturn: Math.random() * 1000 - 500,
    maxDrawdown: Math.random() * 100,
    sharpeRatio: Math.random() * 3 - 1,
    winRate: Math.random() * 0.6 + 0.3, // 30%〜90%
    averageWin: Math.random() * 100 + 50,
    averageLoss: Math.random() * 50 + 20,
    profitFactor: Math.random() * 2 + 0.5,
    annualizedReturn: Math.random() * 50
  };
}

// テスト用のDataRepositoryクラス
class TestDataRepository extends DataRepository {
  constructor() {
    super();
  }
  
  // テスト用データディレクトリを使用するようオーバーライド
  protected getDataDirectories() {
    return {
      dataDir: TEST_DATA_DIR,
      candlesDir: TEST_CANDLES_DIR,
      ordersDir: TEST_ORDERS_DIR,
      metricsDir: TEST_METRICS_DIR
    };
  }

  // TST-069: 並列アクセス問題の解決のための待機メソッド追加
  async waitForFileOperations(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // TST-069: ファイルパスの重複作成を避けるための一意性確保関数
  getUniqueTestId() {
    return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  // TST-069: ファイル操作失敗時のリトライ処理
  async retryFileOperation(operation, maxRetries = 3, delayMs = 50) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        console.warn(`ファイル操作に失敗しました (リトライ ${i+1}/${maxRetries}): ${err instanceof Error ? err.message : String(err)}`);
        await this.waitForFileOperations(delayMs * (i + 1));
      }
    }
    throw lastError;
  }
}

/**
 * テストデータディレクトリのセットアップ
 */
function setupTestDirectories() {
  // テストディレクトリをクリーンアップ
  if (fs.existsSync(TEST_DATA_DIR)) {
    try {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      console.warn(`テストディレクトリのクリーンアップに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // テストディレクトリを作成
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  fs.mkdirSync(TEST_CANDLES_DIR, { recursive: true });
  fs.mkdirSync(TEST_ORDERS_DIR, { recursive: true });
  fs.mkdirSync(TEST_METRICS_DIR, { recursive: true });

  // 通貨ペア用のディレクトリも作成
  const normalizedSymbol = TEST_SYMBOL.replace('/', '_');
  fs.mkdirSync(path.join(TEST_CANDLES_DIR, normalizedSymbol), { recursive: true });
  fs.mkdirSync(path.join(TEST_ORDERS_DIR, normalizedSymbol), { recursive: true });
  fs.mkdirSync(path.join(TEST_METRICS_DIR, normalizedSymbol), { recursive: true });
}

/**
 * データの整合性チェック
 */
function validateDataIntegrity(): boolean {
  const normalizedSymbol = TEST_SYMBOL.replace('/', '_');
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');

  // 各ファイルパスを取得
  const metricsPath = path.join(TEST_METRICS_DIR, normalizedSymbol, `metrics_${date}.json`);
  const ordersPath = path.join(TEST_ORDERS_DIR, normalizedSymbol, `orders_${date}.json`);
  const candlesPath = path.join(
    TEST_CANDLES_DIR,
    normalizedSymbol,
    `${TEST_TIMEFRAME}_${date}.json`
  );

  console.log('データファイルをチェックしています:');
  console.log(`- メトリクス: ${metricsPath}`);
  console.log(`- 注文: ${ordersPath}`);
  console.log(`- ローソク足: ${candlesPath}`);

  // ファイルの存在チェック
  const existingFiles = [
    fs.existsSync(metricsPath) ? metricsPath : null,
    fs.existsSync(ordersPath) ? ordersPath : null,
    fs.existsSync(candlesPath) ? candlesPath : null
  ].filter(Boolean);

  if (existingFiles.length === 0) {
    console.error('データファイルが見つかりません');
    return false;
  }

  // ファイルの内容をチェック
  let validFiles = 0;

  for (const filePath of existingFiles) {
    try {
      const content = JSON.parse(fs.readFileSync(filePath as string, 'utf8'));
      if (filePath === metricsPath && typeof content === 'object') {
        console.log(`- メトリクス: 有効なJSONデータ`);
        validFiles++;
      } else if ((filePath === ordersPath || filePath === candlesPath) && Array.isArray(content)) {
        console.log(`- ${filePath === ordersPath ? '注文' : 'ローソク足'}: ${content.length} 件`);
        validFiles++;
      }
    } catch (error) {
      console.error(`ファイル ${filePath} の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (validFiles > 0) {
    console.log(`データ整合性チェックに成功しました (${validFiles}種類のデータファイルを確認)`);
    return true;
  } else {
    console.error('有効なデータファイルがありません');
    return false;
  }
}

describe('DataRepository E2Eテスト', () => {
  let repository: TestDataRepository;
  const testId = Date.now(); // TST-069: 一意のテストID
  
  // テスト準備
  beforeAll(async () => {
    // TST-069: テスト実行前に十分な待機時間を追加
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // テストディレクトリを作成
    if (fs.existsSync(TEST_DATA_DIR)) {
      try {
        fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
        // 削除が確実に完了するのを待機
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.warn(`テストディレクトリの削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    try {
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
      fs.mkdirSync(TEST_CANDLES_DIR, { recursive: true });
      fs.mkdirSync(TEST_ORDERS_DIR, { recursive: true });
      fs.mkdirSync(TEST_METRICS_DIR, { recursive: true });
      
      const normalizedSymbol = TEST_SYMBOL.replace('/', '_');
      fs.mkdirSync(path.join(TEST_CANDLES_DIR, normalizedSymbol), { recursive: true });
      fs.mkdirSync(path.join(TEST_ORDERS_DIR, normalizedSymbol), { recursive: true });
      fs.mkdirSync(path.join(TEST_METRICS_DIR, normalizedSymbol), { recursive: true });
      
      // ディレクトリが確実に作成されるのを待機
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`テストディレクトリの作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
    
    repository = new TestDataRepository();
  });
  
  // テスト終了後のクリーンアップ
  afterAll(async () => {
    // 最終的なテスト結果の永続化が確実に完了するのを待機
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      if (fs.existsSync(TEST_DATA_DIR)) {
        fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`テストディレクトリのクリーンアップに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  
  // テストタイムアウトを増加
  jest.setTimeout(60000);
  
  it('ローソク足データを保存し読み込める', async () => {
    // テスト用ローソク足データを作成
    const candles: Candle[] = [
      {
        timestamp: Date.now(),
        open: 1000,
        high: 1050,
        low: 950,
        close: 1020,
        volume: 100
      },
      {
        timestamp: Date.now() + 60000,
        open: 1020,
        high: 1080,
        low: 990,
        close: 1040,
        volume: 120
      }
    ];
    
    // データを保存
    await repository.saveCandles(TEST_SYMBOL, TEST_TIMEFRAME, candles);
    
    // TST-069: ファイル操作の完了を待機
    await (repository as TestDataRepository).waitForFileOperations(200);
    
    // 日付を取得（現在の日付をYYYYMMDD形式で）
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    // データを読み込み
    const loadedCandles = await repository.loadCandles(TEST_SYMBOL, TEST_TIMEFRAME, date);
    
    // 保存したデータが読み込めることを確認
    expect(loadedCandles).toBeDefined();
    expect(loadedCandles.length).toBe(2);
    expect(loadedCandles[0].open).toBe(1000);
    expect(loadedCandles[1].close).toBe(1040);
  });
  
  it('注文データを保存し読み込める', async () => {
    // テスト用注文データを作成
    const orders: Order[] = [
      {
        id: 'order-1',
        symbol: TEST_SYMBOL,
        type: OrderType.LIMIT,
        side: OrderSide.BUY,
        price: 1000,
        amount: 1,
        timestamp: Date.now(),
        status: OrderStatus.OPEN
      },
      {
        id: 'order-2',
        symbol: TEST_SYMBOL,
        type: OrderType.MARKET,
        side: OrderSide.SELL,
        price: 1050,
        amount: 0.5,
        timestamp: Date.now() + 1000,
        status: OrderStatus.FILLED
      }
    ];
    
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    // データを保存
    await repository.saveOrders(orders, date, TEST_SYMBOL);
    
    // TST-069: ファイル操作の完了を待機
    await (repository as TestDataRepository).waitForFileOperations(200);
    
    // データを読み込み
    const loadedOrders = await repository.loadOrders(date, TEST_SYMBOL);
    
    // 保存したデータが読み込めることを確認
    expect(loadedOrders).toBeDefined();
    expect(loadedOrders.length).toBe(2);
    expect(loadedOrders[0].id).toBe('order-1');
    expect(loadedOrders[1].price).toBe(1050);
  });
  
  it('パフォーマンスメトリクスを保存し読み込める', async () => {
    // テスト用メトリクスデータを作成
    const metrics: PerformanceMetrics = {
      totalTrades: 100,
      winningTrades: 60,
      losingTrades: 40,
      totalReturn: 500,
      maxDrawdown: 200,
      sharpeRatio: 1.5,
      winRate: 0.6,
      averageWin: 20,
      averageLoss: 10,
      profitFactor: 2.0,
      annualizedReturn: 30
    };
    
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    // データを保存
    await repository.savePerformanceMetrics(metrics, date, TEST_SYMBOL);
    
    // TST-069: ファイル操作の完了を待機
    await (repository as TestDataRepository).waitForFileOperations(200);
    
    // データを読み込み
    const loadedMetrics = await repository.loadPerformanceMetrics(date, TEST_SYMBOL);
    
    // 保存したデータが読み込めることを確認
    expect(loadedMetrics).toBeDefined();
    // nullチェック後に値を検証
    if (loadedMetrics) {
      expect(loadedMetrics.totalTrades).toBe(100);
      expect(loadedMetrics.winRate).toBe(0.6);
      expect(loadedMetrics.sharpeRatio).toBe(1.5);
    }
  });
  
  // TST-069: 並列アクセスのテストを追加
  it('複数の操作を並列に実行できる', async () => {
    // 一意のテストIDを使用
    const uniquePrefix = `parallel-${Date.now()}`;
    const candles = createMockCandles(5);
    const orders = createMockOrders(5, uniquePrefix);
    const metrics = createMockPerformanceMetrics(1);
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    // 操作ごとに待機時間を取る
    const savePromises: Promise<void>[] = [];
    
    // キャンドルデータ保存
    savePromises.push(
      (async () => {
        await repository.saveCandles(TEST_SYMBOL, TEST_TIMEFRAME, candles);
        await (repository as TestDataRepository).waitForFileOperations(100);
      })()
    );
    
    // 注文データ保存
    savePromises.push(
      (async () => {
        await repository.saveOrders(orders, date, TEST_SYMBOL);
        await (repository as TestDataRepository).waitForFileOperations(100);
      })()
    );
    
    // メトリクスデータ保存
    savePromises.push(
      (async () => {
        await repository.savePerformanceMetrics(metrics, date, TEST_SYMBOL);
        await (repository as TestDataRepository).waitForFileOperations(100);
      })()
    );
    
    // 並列でデータを保存し、すべての操作が完了するのを待つ
    await Promise.all(savePromises);
    
    // 操作間の競合を避けるための追加待機
    await (repository as TestDataRepository).waitForFileOperations(300);
    
    // データが確実に保存されたか確認するための個別読み込み
    let loadedCandles, loadedOrders, loadedMetrics;
    
    try {
      loadedCandles = await repository.loadCandles(TEST_SYMBOL, TEST_TIMEFRAME, date);
      expect(loadedCandles).toBeDefined();
      expect(Array.isArray(loadedCandles)).toBe(true);
      console.log(`ローソク足データ読み込み成功: ${loadedCandles.length}件`);
    } catch (err) {
      console.error(`ローソク足データの読み込みに失敗: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
    
    try {
      loadedOrders = await repository.loadOrders(date, TEST_SYMBOL);
      expect(loadedOrders).toBeDefined();
      expect(Array.isArray(loadedOrders)).toBe(true);
      console.log(`注文データ読み込み成功: ${loadedOrders.length}件`);
    } catch (err) {
      console.error(`注文データの読み込みに失敗: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
    
    try {
      loadedMetrics = await repository.loadPerformanceMetrics(date, TEST_SYMBOL);
      expect(loadedMetrics).toBeDefined();
      console.log(`メトリクスデータ読み込み成功`);
    } catch (err) {
      console.error(`メトリクスデータの読み込みに失敗: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
    
    // すべてのデータが正しく読み込めていることを確認
    expect(loadedCandles.length).toBeGreaterThan(0);
    expect(loadedOrders.length).toBeGreaterThan(0);
    expect(loadedMetrics).toBeDefined();
    
    // メトリクスがnullでないことを確認してから検証
    if (loadedMetrics) {
      expect(loadedMetrics.totalTrades).toBe(metrics.totalTrades);
    }
  }, 30000); // 30秒のタイムアウトを設定
});
