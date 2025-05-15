// ESM環境向けに変換されたテストファイル
/**
 * DataRepository 並列E2Eテスト
 *
 * DataRepositoryの並列書き込み競合を検証するE2Eテスト
 * TST-013並列E2Eテスト
 */

import { jest, describe, beforeEach, afterEach, test, it, expect, beforeAll, afterAll } from '@jest/globals';

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === 'undefined') {
  globalThis.__jest_import_meta_url = 'file:///';
}

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { DataRepository } from '../../data/dataRepository.js';
import { Candle, Order, PerformanceMetrics, OrderType, OrderSide, OrderStatus } from '../../core/types.js';
import logger from '../../utils/logger.js';

/**
 * DataRepository 並列E2Eテスト
 *
 * DataRepositoryの並列書き込み競合を検証するE2Eテスト
 * TST-013並列E2Eテスト
 */

// テスト用データディレクトリ
const TEST_DATA_DIR = path.join(process.cwd(), 'data', 'test-e2e');
const TEST_CANDLES_DIR = path.join(TEST_DATA_DIR, 'candles');
const TEST_ORDERS_DIR = path.join(TEST_DATA_DIR, 'orders');
const TEST_METRICS_DIR = path.join(TEST_DATA_DIR, 'metrics');

// テスト用ヘルパープロセスのパス
const WORKER_SCRIPT_PATH = path.join(process.cwd(), 'src', '__tests__', 'data', 'dataRepositoryWorker.js');

// テスト設定
const NUM_WORKERS = 5;         // テスト用ワーカー数
const OPERATIONS_PER_WORKER = 20; // 各ワーカーが実行する操作数
const TEST_SYMBOL = 'TEST/USDT';
const TEST_TIMEFRAME = '1h';

/**
 * テスト用の拡張PerformanceMetrics
 * @typedef {Object} TestPerformanceMetrics
 * @property {number} [startTimestamp] - テスト開始タイムスタンプ
 * @property {number} [endTimestamp] - テスト終了タイムスタンプ
 * @property {number} [runDuration] - 実行時間
 * @property {string} [symbol] - 取引ペア
 * @property {number} [initialBalance] - 初期残高
 * @property {number} [finalBalance] - 最終残高
 * @property {number} [workerId] - ワーカーID
 */

/**
 * テスト用のモックローソク足を作成
 */
function createMockCandles(count, startTimestamp = Date.now()) {
  const candles = [];
  
  for (let i = 0; i < count; i++) {
    const timestamp = startTimestamp + i * 60000; // 1分間隔
    const price = 1000 + Math.random() * 100;     // 1000-1100のランダムな価格
    
    candles.push({
      timestamp,
      open: price,
      high: price * 1.01,
      low: price * 0.99,
      close: price * (1 + (Math.random() * 0.02 - 0.01)), // ±1%変動
      volume: price * 100
    });
  }
  
  return candles;
}

/**
 * テスト用のモック注文を作成
 */
function createMockOrders(count, symbol = TEST_SYMBOL) {
  const orders = [];
  
  for (let i = 0; i < count; i++) {
    const timestamp = Date.now() + i * 1000; // 1秒間隔
    const price = 1000 + Math.random() * 100;
    
    orders.push({
      id: `order-${i}-${Date.now()}`,
      symbol,
      type: OrderType.MARKET,
      side: Math.random() > 0.5 ? OrderSide.BUY : OrderSide.SELL,
      amount: Math.random() * 1,
      timestamp,
      status: OrderStatus.FILLED
    });
  }
  
  return orders;
}

/**
 * テスト用のモックパフォーマンスメトリクスを作成
 */
function createMockPerformanceMetrics(workerId = 0) {
  const metrics = {
    totalTrades: Math.floor(Math.random() * 100),
    winningTrades: Math.floor(Math.random() * 50),
    losingTrades: Math.floor(Math.random() * 20),
    breakEvenTrades: Math.floor(Math.random() * 10),
    winRate: Math.random(),
    totalPnL: Math.random() * 1000,
    averagePnL: Math.random() * 100,
    maxDrawdown: Math.random() * 200,
    sharpeRatio: Math.random() * 3,
    sortinoRatio: Math.random() * 4,
    startTimestamp: Date.now() - 86400000,
    endTimestamp: Date.now(),
    runDuration: 86400000,
    symbol: TEST_SYMBOL,
    initialBalance: 10000,
    finalBalance: 10000 + Math.random() * 1000,
    workerId
  };
  
  return metrics;
}

/**
 * ワーカープロセスを起動
 */
function startWorker(workerId) {
  console.log(`ワーカー ${workerId} を起動します...`);
  
  const worker = spawn('node', [
    WORKER_SCRIPT_PATH,
    workerId.toString(),
    NUM_WORKERS.toString(),
    OPERATIONS_PER_WORKER.toString(),
    TEST_SYMBOL,
    TEST_TIMEFRAME,
    TEST_DATA_DIR
  ], {
    stdio: 'pipe',
    env: process.env
  });
  
  // ログ出力のリダイレクト
  worker.stdout.on('data', (data) => {
    console.log(`[Worker ${workerId}] ${data.toString().trim()}`);
  });
  
  worker.stderr.on('data', (data) => {
    console.error(`[Worker ${workerId}] ERROR: ${data.toString().trim()}`);
  });
  
  return worker;
}

/**
 * テストデータディレクトリのセットアップ
 */
function setupTestDirectories() {
  // テストディレクトリをクリーンアップ
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true });
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
 * ワーカースクリプトを生成
 */
function generateWorkerScript() {
  // トランスパイル済みのJSファイルを生成するため、TypeScriptファイルを作成してからコンパイル
  const tsWorkerPath = WORKER_SCRIPT_PATH.replace('.js', '.ts');
  
  const workerCode = `/**
 * DataRepository テスト用ワーカープロセス
 */

import { DataRepository } from '../../data/dataRepository';
import { Candle, Order, PerformanceMetrics, OrderType, OrderSide, OrderStatus } from '../../core/types';
import path from 'path';

// コマンドライン引数の取得
const workerId = parseInt(process.argv[2], 10);
const totalWorkers = parseInt(process.argv[3], 10);
const operationsPerWorker = parseInt(process.argv[4], 10);
const testSymbol = process.argv[5];
const testTimeframe = process.argv[6];
const testDataDir = process.argv[7];

// プロセス間の競合を作るために少しスリープする関数
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * テスト用のモックローソク足を作成
 */
function createMockCandles(count: number, startTimestamp: number = Date.now()): Candle[] {
  const candles: Candle[] = [];
  
  for (let i = 0; i < count; i++) {
    const timestamp = startTimestamp + i * 60000; // 1分間隔
    const price = 1000 + Math.random() * 100;     // 1000-1100のランダムな価格
    
    candles.push({
      timestamp,
      open: price,
      high: price * 1.01,
      low: price * 0.99,
      close: price * (1 + (Math.random() * 0.02 - 0.01)), // ±1%変動
      volume: price * 100
    });
  }
  
  return candles;
}

/**
 * テスト用のモック注文を作成
 */
function createMockOrders(count: number, symbol: string = testSymbol): Order[] {
  const orders: Order[] = [];
  
  for (let i = 0; i < count; i++) {
    const timestamp = Date.now() + i * 1000; // 1秒間隔
    const price = 1000 + Math.random() * 100;
    
    orders.push({
      id: \`order-\${workerId}-\${i}-\${Date.now()}\`,
      symbol,
      type: OrderType.MARKET,
      side: Math.random() > 0.5 ? OrderSide.BUY : OrderSide.SELL,
      amount: Math.random() * 1,
      timestamp,
      status: OrderStatus.FILLED
    });
  }
  
  return orders;
}

/**
 * テスト用のモックパフォーマンスメトリクスを作成
 */
function createMockPerformanceMetrics(): PerformanceMetrics {
  return {
    totalTrades: Math.floor(Math.random() * 100),
    winningTrades: Math.floor(Math.random() * 50),
    losingTrades: Math.floor(Math.random() * 20),
    breakEvenTrades: Math.floor(Math.random() * 10),
    winRate: Math.random(),
    totalPnL: Math.random() * 1000,
    averagePnL: Math.random() * 100,
    maxDrawdown: Math.random() * 200,
    sharpeRatio: Math.random() * 3,
    sortinoRatio: Math.random() * 4,
    workerId
  };
}

// テスト用のDataRepositoryサブクラス
class TestDataRepository extends DataRepository {
  constructor() {
    super();
  }
  
  // テスト用データディレクトリを使用するようオーバーライド
  getDataDirectories() {
    const dataDir = testDataDir;
    const candlesDir = path.join(dataDir, 'candles');
    const ordersDir = path.join(dataDir, 'orders');
    const metricsDir = path.join(dataDir, 'metrics');
    
    return {
      dataDir,
      candlesDir,
      ordersDir,
      metricsDir
    };
  }
}

// メインの実行関数
async function run() {
  try {
    console.log(\`ワーカー \${workerId} が起動しました - 操作数: \${operationsPerWorker}\`);
    
    const repository = new TestDataRepository();
    
    // ランダムな待機時間で並列実行を再現
    await sleep(Math.random() * 100);
    
    for (let i = 0; i < operationsPerWorker; i++) {
      // ランダムな操作を選択
      const operationType = Math.floor(Math.random() * 3); // 0, 1, 2
      
      try {
        if (operationType === 0) {
          // ローソク足データの保存
          const candles = createMockCandles(5);
          await repository.saveCandles(testSymbol, testTimeframe, candles);
          console.log(\`ワーカー \${workerId} - 操作 \${i + 1}：ローソク足データを保存しました\`);
        } else if (operationType === 1) {
          // 注文データの保存
          const orders = createMockOrders(3);
          const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
          await repository.saveOrders(orders, date, testSymbol);
          console.log(\`ワーカー \${workerId} - 操作 \${i + 1}：注文データを保存しました\`);
        } else {
          // パフォーマンスメトリクスの保存
          const metrics = createMockPerformanceMetrics();
          const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
          await repository.savePerformanceMetrics(metrics, date, testSymbol);
          console.log(\`ワーカー \${workerId} - 操作 \${i + 1}：メトリクスデータを保存しました\`);
        }
        
        // スレッド競合を発生させるために少し待機
        await sleep(Math.random() * 50);
      } catch (error) {
        console.error(\`ワーカー \${workerId} - 操作 \${i + 1} エラー: \${error.message}\`);
      }
    }
    
    console.log(\`ワーカー \${workerId} が全ての操作を完了しました\`);
  } catch (error) {
    console.error(\`ワーカー \${workerId} の実行中にエラーが発生しました: \${error.message}\`);
    process.exit(1);
  }
}

// 実行
run().then(() => process.exit(0)).catch((err) => {
  console.error(\`ワーカープロセスでのエラー: \${err.message}\`);
  process.exit(1);
});
`;

  // ワーカースクリプトを書き込み
  fs.mkdirSync(path.dirname(tsWorkerPath), { recursive: true });
  fs.writeFileSync(tsWorkerPath, workerCode);
  
  // TypeScriptファイルをコンパイル
  try {
    execSync(`npx tsc ${tsWorkerPath} --outDir ${path.dirname(WORKER_SCRIPT_PATH)}`);
    console.log(`ワーカースクリプトをコンパイルしました: ${WORKER_SCRIPT_PATH}`);
  } catch (error) {
    console.error('ワーカースクリプトのコンパイルに失敗しました:', error);
    throw error;
  }
}

// データの整合性チェック用関数
function validateDataIntegrity() {
  const normalizedSymbol = TEST_SYMBOL.replace('/', '_');
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  // 各ファイルの存在チェック
  const metricsPath = path.join(TEST_METRICS_DIR, normalizedSymbol, `metrics_${date}.json`);
  const ordersPath = path.join(TEST_ORDERS_DIR, normalizedSymbol, `orders_${date}.json`);
  const candlesPath = path.join(TEST_CANDLES_DIR, normalizedSymbol, `${TEST_TIMEFRAME}_${date}.json`);
  
  const files = [metricsPath, ordersPath, candlesPath];
  const missingFiles = files.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length > 0) {
    console.error('以下のファイルが見つかりません:', missingFiles);
    return false;
  }
  
  // ファイルが正しいJSONかチェック
  try {
    const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    const candles = JSON.parse(fs.readFileSync(candlesPath, 'utf8'));
    
    // メトリクスが正しいか
    if (!metrics.totalTrades || !metrics.winningTrades) {
      console.error('メトリクスデータが不完全です');
      return false;
    }
    
    // 注文データが配列か
    if (!Array.isArray(orders)) {
      console.error('注文データが配列ではありません');
      return false;
    }
    
    // ローソク足データが配列か
    if (!Array.isArray(candles)) {
      console.error('ローソク足データが配列ではありません');
      return false;
    }
    
    console.log('データ整合性チェックに成功しました');
    console.log(`- メトリクス: ${metrics.totalTrades} トレード`);
    console.log(`- 注文: ${orders.length} 件`);
    console.log(`- ローソク足: ${candles.length} 本`);
    
    return true;
  } catch (error) {
    console.error('データ整合性チェックに失敗しました:', error);
    return false;
  }
}

/**
 * テストを実行する関数
 */
async function runE2ETest() {
  try {
    console.log(`並列E2Eテストを開始します... ワーカー数: ${NUM_WORKERS}, 操作数/ワーカー: ${OPERATIONS_PER_WORKER}`);
    
    // テスト用ディレクトリをセットアップ
    setupTestDirectories();
    
    // ワーカースクリプトを生成
    generateWorkerScript();
    
    // ワーカープロセスを起動
    const workers = [];
    for (let i = 0; i < NUM_WORKERS; i++) {
      workers.push(startWorker(i));
    }
    
    // すべてのワーカーの完了を待機
    const results = await Promise.all(
      workers.map(
        (worker, i) =>
          new Promise((resolve) => {
            worker.on('exit', (code) => {
              console.log(`ワーカー ${i} が終了しました (コード: ${code})`);
              resolve(code === 0);
            });
          })
      )
    );
    
    // すべてのワーカーが成功したかチェック
    const allSucceeded = results.every(result => result);
    if (!allSucceeded) {
      console.error('一部のワーカーが失敗しました');
      return false;
    }
    
    // データの整合性をチェック
    const dataIntegrity = validateDataIntegrity();
    
    return dataIntegrity;
  } catch (error) {
    console.error('E2Eテスト実行中にエラーが発生しました:', error);
    return false;
  }
}

// テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
});

// テスト後にインターバルを停止
afterEach(() => {
  // すべてのタイマーモックをクリア
  jest.clearAllTimers();
  
  // インスタンスを明示的に破棄
  // (ここにテスト固有のクリーンアップコードが必要な場合があります)
});

// 非同期処理をクリーンアップするためのafterAll
afterAll(() => {
  // すべてのモックをリセット
  jest.clearAllMocks();
  
  // タイマーをリセット
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // グローバルタイマーをクリア
  if (global.setInterval && global.setInterval.mockClear) {
    global.setInterval.mockClear();
  }
  
  if (global.clearInterval && global.clearInterval.mockClear) {
    global.clearInterval.mockClear();
  }
  
  // 確実にすべてのプロミスが解決されるのを待つ
  return new Promise((resolve) => {
    setTimeout(() => {
      // 残りの非同期処理を強制終了
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, 100);
  });
});

describe('DataRepository 並列E2Eテスト (TST-013)', () => {
  // テスト実行時間を長めに設定
  jest.setTimeout(60000);
  
  it('複数プロセスからの同時書き込みを正しく処理できること', async () => {
    const result = await runE2ETest();
    expect(result).toBe(true);
  });
}); 