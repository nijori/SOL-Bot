/**
 * バックテスト実行クラス
 * 指定されたパラメータと期間でバックテストを実行し、結果を返す
 */
import * as fs from 'fs';
import * as path from 'path';
import { ParquetDataStore } from '../data/parquetDataStore';
import { TradingEngine } from './tradingEngine';
import { applyParameters } from '../config/parameterService';

/**
 * バックテスト設定インターフェース
 */
export interface BacktestConfig {
  symbol: string;
  timeframeHours: number;
  startDate: string;
  endDate: string;
  initialBalance: number;
  parameters?: Record<string, any>;
  isSmokeTest?: boolean;
}

/**
 * バックテスト結果インターフェース
 */
export interface BacktestResult {
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    calmarRatio: number;
    sortinoRatio: number;
    averageWin: number;
    averageLoss: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
  };
  trades: any[];
  equity: {
    timestamp: string;
    equity: number;
  }[];
  parameters: Record<string, any>;
}

export class BacktestRunner {
  private config: BacktestConfig;
  
  constructor(config: BacktestConfig) {
    this.config = {
      ...config,
      // デフォルト値を設定
      initialBalance: config.initialBalance || 10000,
      parameters: config.parameters || {}
    };
  }
  
  /**
   * バックテストを実行
   */
  async run(): Promise<BacktestResult> {
    console.log(`[BacktestRunner] バックテスト開始: ${this.config.symbol} (${this.config.startDate} - ${this.config.endDate})`);

    try {
      // データの読み込み
      const candles = await this.loadData();
      console.log(`[BacktestRunner] データ読み込み完了: ${candles.length}件のローソク足`);
      
      // カスタムパラメータの適用
      if (this.config.parameters && Object.keys(this.config.parameters).length > 0) {
        applyParameters(this.config.parameters);
        console.log(`[BacktestRunner] カスタムパラメータを適用: ${Object.keys(this.config.parameters).length}個のパラメータ`);
      }
      
      // トレーディングエンジンの初期化
      const engine = new TradingEngine({
        symbol: this.config.symbol,
        initialBalance: this.config.initialBalance,
        isBacktest: true,
        timeframeHours: this.config.timeframeHours
      });
      
      // すべてのローソク足でシミュレーション実行
      const equityHistory: {timestamp: string, equity: number}[] = [];
      const allTrades: any[] = [];
      
      for (const candle of candles) {
        // キャンドルでエンジンを更新
        await engine.update(candle);
        
        // エクイティ履歴を記録
        equityHistory.push({
          timestamp: new Date(candle.timestamp).toISOString(),
          equity: engine.getEquity()
        });
        
        // 完了した取引を取得
        const completedTrades = engine.getCompletedTrades();
        if (completedTrades.length > 0) {
          allTrades.push(...completedTrades);
        }
      }
      
      // 最終的なすべての取引をクローズ
      await engine.closeAllPositions();
      
      // 最終ポジションクローズ後の取引を取得
      const finalTrades = engine.getCompletedTrades();
      if (finalTrades.length > 0) {
        allTrades.push(...finalTrades.filter(t => !allTrades.some(at => at.id === t.id)));
      }
      
      // 取引データから指標計算
      const metrics = this.calculateMetrics(allTrades, equityHistory);
      
      const result: BacktestResult = {
        metrics,
        trades: allTrades,
        equity: equityHistory,
        parameters: this.config.parameters || {}
      };
      
      console.log(`[BacktestRunner] バックテスト完了: トータルリターン=${metrics.totalReturn.toFixed(2)}%, シャープレシオ=${metrics.sharpeRatio.toFixed(2)}`);
      return result;
      
    } catch (error) {
      console.error(`[BacktestRunner] バックテスト実行エラー:`, error);
      throw error;
    }
  }
  
  /**
   * 期間内のデータを読み込む
   */
  private async loadData(): Promise<any[]> {
    try {
      // Parquetストアから読み込み
      const dataStore = new ParquetDataStore();
      const candles = await dataStore.getCandleData({
        symbol: this.config.symbol,
        timeframeHours: this.config.timeframeHours,
        startDate: new Date(this.config.startDate),
        endDate: new Date(this.config.endDate)
      });
      
      return candles;
    } catch (error) {
      console.error(`[BacktestRunner] データ読み込みエラー:`, error);
      throw new Error(`データ読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * 取引結果から各種指標を計算
   */
  private calculateMetrics(trades: any[], equityHistory: {timestamp: string, equity: number}[]): BacktestResult['metrics'] {
    // 勝率計算
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    
    // 平均損益
    const averageWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length 
      : 0;
    
    const averageLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length)
      : 0;
    
    // 総利益と総損失
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    
    // プロフィットファクター
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    
    // 最大連勝・連敗
    let currentWins = 0;
    let currentLosses = 0;
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    
    for (const trade of trades) {
      if (trade.pnl > 0) {
        currentWins++;
        currentLosses = 0;
        if (currentWins > maxConsecutiveWins) {
          maxConsecutiveWins = currentWins;
        }
      } else {
        currentLosses++;
        currentWins = 0;
        if (currentLosses > maxConsecutiveLosses) {
          maxConsecutiveLosses = currentLosses;
        }
      }
    }
    
    // 最大ドローダウン計算
    let maxEquity = this.config.initialBalance;
    let currentDrawdown = 0;
    let maxDrawdown = 0;
    
    for (const point of equityHistory) {
      if (point.equity > maxEquity) {
        maxEquity = point.equity;
        currentDrawdown = 0;
      } else {
        currentDrawdown = (maxEquity - point.equity) / maxEquity;
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }
      }
    }
    
    // トータルリターン
    const initialBalance = this.config.initialBalance;
    const finalBalance = equityHistory.length > 0 ? equityHistory[equityHistory.length - 1].equity : initialBalance;
    const totalReturn = ((finalBalance - initialBalance) / initialBalance) * 100;
    
    // シャープレシオ計算
    // 日次リターンを計算
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityHistory.length; i++) {
      const prevEquity = equityHistory[i - 1].equity;
      const currEquity = equityHistory[i].equity;
      const dailyReturn = (currEquity - prevEquity) / prevEquity;
      dailyReturns.push(dailyReturn);
    }
    
    // 平均リターンと標準偏差
    const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const stdDev = Math.sqrt(
      dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length
    );
    
    // 年率換算（252取引日として）
    const annualizedReturn = avgReturn * 252;
    const annualizedStdDev = stdDev * Math.sqrt(252);
    
    // シャープレシオ計算（リスクフリーレートを0と仮定）
    const sharpeRatio = annualizedStdDev > 0 ? annualizedReturn / annualizedStdDev : 0;
    
    // カルマーレシオ計算
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
    
    // ソルティノレシオ計算（下方リスクのみ考慮）
    const downReturns = dailyReturns.filter(r => r < 0);
    const downSideDev = Math.sqrt(
      downReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / dailyReturns.length
    );
    const annualizedDownSideDev = downSideDev * Math.sqrt(252);
    const sortinoRatio = annualizedDownSideDev > 0 ? annualizedReturn / annualizedDownSideDev : 0;
    
    return {
      totalReturn,
      sharpeRatio,
      maxDrawdown: maxDrawdown * 100, // パーセント表示
      winRate: winRate * 100, // パーセント表示
      profitFactor,
      calmarRatio,
      sortinoRatio,
      averageWin,
      averageLoss,
      maxConsecutiveWins,
      maxConsecutiveLosses
    };
  }
}

/**
 * コマンドライン引数を解析
 */
function parseCommandLineArgs(): { [key: string]: string | boolean } {
  const args: { [key: string]: string | boolean } = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    if (arg.startsWith('--')) {
      const key = arg.substring(2);
      if (i + 1 < process.argv.length && !process.argv[i + 1].startsWith('--')) {
        args[key] = process.argv[i + 1];
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

/**
 * メイン関数 - コマンドラインから実行された場合に使用
 */
async function main() {
  const args = parseCommandLineArgs();
  
  // 日付処理
  let startDate = args['start-date'] as string || '';
  let endDate = args['end-date'] as string || '';
  
  // スモークテストモード
  const isSmokeTest = args['smoke-test'] === true;
  const days = parseInt(args['days'] as string || '3');
  
  if (isSmokeTest) {
    console.log(`[BacktestRunner] スモークテストモードで実行 (${days}日間)`);
    endDate = new Date().toISOString();
    const start = new Date();
    start.setDate(start.getDate() - days);
    startDate = start.toISOString();
  } else if (!startDate || !endDate) {
    // デフォルト：過去3ヶ月
    endDate = new Date().toISOString();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    startDate = start.toISOString();
  }
  
  const config: BacktestConfig = {
    symbol: args['symbol'] as string || 'SOLUSDT',
    timeframeHours: parseInt(args['timeframe'] as string || '1'),
    startDate,
    endDate,
    initialBalance: parseFloat(args['balance'] as string || '10000'),
    isSmokeTest
  };
  
  console.log(`[BacktestRunner] 設定:`, config);
  
  const runner = new BacktestRunner(config);
  try {
    const result = await runner.run();
    
    if (args['output']) {
      const outputPath = args['output'] as string;
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`[BacktestRunner] 結果を保存: ${outputPath}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`[BacktestRunner] エラー:`, error);
    process.exit(1);
  }
}

// エントリーポイント - コマンドライン実行の場合
if (require.main === module) {
  main();
} 