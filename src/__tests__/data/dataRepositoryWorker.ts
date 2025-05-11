/**
 * DataRepository テスト用ワーカープロセス
 */
import path from 'path';
import fs from 'fs';
import { DataRepository } from '../../data/dataRepository.js';
import { OrderType, OrderSide, OrderStatus } from '../../core/types.js';

// コマンドライン引数の取得
const workerId = parseInt(process.argv[2], 10);
const totalWorkers = parseInt(process.argv[3], 10);
const operationsPerWorker = parseInt(process.argv[4], 10);
const testSymbol = process.argv[5];
const testTimeframe = process.argv[6];
const testDataDir = process.argv[7];

// プロセス間の競合を作るために少しスリープする関数
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * テスト用のモックローソク足を作成
 */
function createMockCandles(count: number, startTimestamp: number = Date.now()): any[] {
  const candles: any[] = [];
  
  for (let i = 0; i < count; i++) {
    const timestamp = startTimestamp + i * 60000; // 1分間隔
    const price = 1000 + Math.random() * 100;     // 1000-1100のランダムな価格
    
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
function createMockOrders(count: number): any[] {
  const orders: any[] = [];
  
  for (let i = 0; i < count; i++) {
    const timestamp = Date.now() + i * 1000; // 1秒間隔
    const price = 1000 + Math.random() * 100;
    
    orders.push({
      id: `order-${workerId}-${i}-${Date.now()}`,
      symbol: testSymbol,
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
function createMockPerformanceMetrics(): any {
  return {
    totalTrades: Math.floor(Math.random() * 100),
    winningTrades: Math.floor(Math.random() * 50),
    losingTrades: Math.floor(Math.random() * 30),
    totalReturn: Math.random() * 1000 - 500,
    maxDrawdown: Math.random() * 100,
    sharpeRatio: Math.random() * 3 - 1,
    startTimestamp: Date.now() - 86400000, // 1日前
    endTimestamp: Date.now(),
    runDuration: 86400000,
    symbol: testSymbol,
    initialBalance: 10000,
    finalBalance: 10000 + (Math.random() * 2000 - 1000),
    winRate: Math.random() * 0.6 + 0.3, // 30%〜90%
    averageWin: Math.random() * 100 + 50,
    averageLoss: Math.random() * 50 + 20,
    profitFactor: Math.random() * 2 + 0.5,
    annualizedReturn: Math.random() * 50,
    workerId: workerId // 検証用に書き込み元ワーカーIDを含める
  };
}

// テスト用のDataRepositoryインスタンスを作成
class TestDataRepository extends DataRepository {
  constructor() {
    super();
  }
  
  // テスト用データディレクトリを使用するようオーバーライド
  protected getDataDirectories() {
    return {
      dataDir: testDataDir,
      candlesDir: path.join(testDataDir, 'candles'),
      ordersDir: path.join(testDataDir, 'orders'),
      metricsDir: path.join(testDataDir, 'metrics')
    };
  }
}

// メインの実行関数
async function run() {
  try {
    console.log(`ワーカー ${workerId} が起動しました - 操作数: ${operationsPerWorker}`);
    
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
          console.log(`ワーカー ${workerId} - 操作 ${i + 1}：ローソク足データを保存しました`);
        } else if (operationType === 1) {
          // 注文データの保存
          const orders = createMockOrders(3);
          const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
          await repository.saveOrders(orders, date, testSymbol);
          console.log(`ワーカー ${workerId} - 操作 ${i + 1}：注文データを保存しました`);
        } else {
          // パフォーマンスメトリクスの保存
          const metrics = createMockPerformanceMetrics();
          const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
          await repository.savePerformanceMetrics(metrics, date, testSymbol);
          console.log(`ワーカー ${workerId} - 操作 ${i + 1}：メトリクスデータを保存しました`);
        }
        
        // スレッド競合を発生させるために少し待機
        await sleep(Math.random() * 50);
      } catch (error) {
        console.error(`ワーカー ${workerId} - 操作 ${i + 1} エラー: ${error.message}`);
      }
    }
    
    console.log(`ワーカー ${workerId} が全ての操作を完了しました`);
  } catch (error) {
    console.error(`ワーカー ${workerId} の実行中にエラーが発生しました: ${error.message}`);
    process.exit(1);
  }
}

// 実行
run().then(() => process.exit(0)).catch(err => {
  console.error(`ワーカープロセスでのエラー: ${err.message}`);
  process.exit(1);
});
