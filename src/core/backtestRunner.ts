/**
 * バックテスト実行クラス
 * 指定されたパラメータと期間でバックテストを実行し、結果を返す
 */
import * as fs from 'fs';
import * as path from 'path';
import { ParquetDataStore } from '../data/parquetDataStore';
import { TradingEngine } from './tradingEngine';
import { applyParameters } from '../config/parameterService';
import { BACKTEST_PARAMETERS } from '../config/parameters';
import { Candle } from './types';
import logger from '../utils/logger';
import { OrderManagementSystem } from './orderManagementSystem';

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
  slippage?: number;        // スリッページ
  commissionRate?: number;  // 取引手数料率
  quiet?: boolean;          // ログ出力を抑制するモード
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
      parameters: config.parameters || {},
      slippage: config.slippage || BACKTEST_PARAMETERS.DEFAULT_SLIPPAGE || 0,
      commissionRate: config.commissionRate || BACKTEST_PARAMETERS.DEFAULT_COMMISSION_RATE || 0,
      quiet: config.quiet || false // デフォルトはfalse（通常モード）
    };
  }
  
  /**
   * バックテストを実行
   */
  async run(): Promise<BacktestResult> {
    // quietモードでない場合のみログを出力
    if (!this.config.quiet) {
      console.log(`[BacktestRunner] バックテスト開始: ${this.config.symbol} (${this.config.startDate} - ${this.config.endDate})`);
      console.log(`[BacktestRunner] スリッページ: ${(this.config.slippage ?? 0) * 100}%, 取引手数料: ${(this.config.commissionRate ?? 0) * 100}%`);
      
      // スモークテストモードであることを明示的に表示
      if (this.config.isSmokeTest) {
        console.log(`[BacktestRunner] スモークテストモードが有効です`);
      }
      
      // quietモードの状態を表示
      if (this.config.quiet) {
        console.log(`[BacktestRunner] Quietモードが有効です（詳細ログ出力は抑制されます）`);
      }
    }

    try {
      // データの読み込み
      const candles = await this.loadData();
      if (!this.config.quiet) {
        console.log(`[BacktestRunner] データ読み込み完了: ${candles.length}件のローソク足`);
      }
      
      // カスタムパラメータの適用
      if (this.config.parameters && Object.keys(this.config.parameters).length > 0) {
        applyParameters(this.config.parameters);
        if (!this.config.quiet) {
          console.log(`[BacktestRunner] カスタムパラメータを適用: ${Object.keys(this.config.parameters).length}個のパラメータ`);
        }
      }
      
      // OrderManagementSystemのインスタンスを作成
      const oms = new OrderManagementSystem();
      
      // トレーディングエンジンの初期化（依存注入を使用）
      const engine = new TradingEngine({
        symbol: this.config.symbol,
        timeframeHours: this.config.timeframeHours,
        initialBalance: this.config.initialBalance,
        isBacktest: true,
        slippage: this.config.slippage,
        commissionRate: this.config.commissionRate,
        isSmokeTest: this.config.isSmokeTest, // スモークテストフラグを明示的に渡す
        oms: oms, // OMSを注入
        quiet: this.config.quiet // quietモードを伝播
      });
      
      // エンジン設定の確認ログ
      if (!this.config.quiet) {
        console.log(`[BacktestRunner] エンジン初期化完了: スモークテストモード=${this.config.isSmokeTest ? "有効" : "無効"}`);
      }
      
      // すべてのローソク足でシミュレーション実行
      const equityHistory: {timestamp: string, equity: number}[] = [];
      const allTrades: any[] = [];
      
      if (!this.config.quiet) {
        console.log(`[BacktestRunner] キャンドル処理開始: 合計${candles.length}本`);
      }
      
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
        if (completedTrades.length > 0 && !this.config.quiet) {
          console.log(`[BacktestRunner] 取引完了: ${completedTrades.length}件`);
          allTrades.push(...completedTrades);
        }
      }
      
      // 最終的なすべての取引をクローズ
      await engine.closeAllPositions();
      
      // 最終的な完了取引を取得
      const finalCompletedTrades = engine.getCompletedTrades();
      if (!this.config.quiet) {
        console.log(`[BacktestRunner] 最終取引総数: ${finalCompletedTrades.length}件`);
      }
      
      // 完了したバックテストの結果を取得して評価
      const metrics = this.calculateMetrics(finalCompletedTrades, equityHistory);
      
      const result: BacktestResult = {
        metrics,
        trades: finalCompletedTrades,
        equity: equityHistory,
        parameters: {
          ...this.config.parameters,
          slippage: this.config.slippage,
          commissionRate: this.config.commissionRate
        }
      };
      
      if (!this.config.quiet) {
        console.log(`[BacktestRunner] バックテスト完了: トータルリターン=${metrics.totalReturn.toFixed(2)}%, シャープレシオ=${metrics.sharpeRatio.toFixed(2)}`);
      }
      return result;
      
    } catch (error) {
      console.error(`[BacktestRunner] バックテスト実行エラー:`, error);
      throw error;
    }
  }
  
  /**
   * 期間内のデータを読み込む
   */
  private async loadData(): Promise<Candle[]> {
    try {
      // Parquetストアから読み込み
      const dataStore = new ParquetDataStore();
      
      // 期間とシンボル、タイムフレーム情報を詳細にログ出力
      console.log(`[BacktestRunner] データ検索条件: ${this.config.symbol}, ${this.config.timeframeHours}h時間足, 期間=${this.config.startDate} - ${this.config.endDate}`);
      
      // データディレクトリの内容を確認して表示
      const fs = require('fs');
      const path = require('path');
      const dataDir = path.join(process.cwd(), 'data/candles');
      
      if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir);
        console.log(`[BacktestRunner] データディレクトリ内のファイル: ${files.join(', ')}`);
      } else {
        console.log(`[BacktestRunner] データディレクトリが見つかりません: ${dataDir}`);
      }
      
      const candles = await dataStore.getCandleData({
        symbol: this.config.symbol,
        timeframeHours: this.config.timeframeHours,
        startDate: new Date(this.config.startDate),
        endDate: new Date(this.config.endDate)
      });
      
      // データストアを閉じる
      dataStore.close();
      
      console.log(`[BacktestRunner] データ読み込み完了: ${candles.length}件のローソク足`);
      
      if (candles.length === 0 && this.config.isSmokeTest) {
        // スモークテスト用の最小限のサンプルデータ生成（改善版）
        console.log(`[BacktestRunner] スモークテスト用のサンプルデータを生成します`);
        
        const now = new Date().getTime();
        const sampleData: Candle[] = [];
        
        // 技術指標計算のために十分なデータを生成（最低でも60本）
        const candleCount = 120; // より多くのデータポイントを生成
        const hoursPerCandle = this.config.timeframeHours;
        
        // より明確なトレンドパターンを生成
        let basePrice = 100;
        
        // 4つのセグメントに分けて異なるトレンドを作成（より明確な取引シグナルを生成するため）
        const segments = [
          { length: 30, trend: 1.2, volatility: 0.2 },  // 強い上昇トレンド
          { length: 25, trend: -1.0, volatility: 0.3 }, // 下降トレンド 
          { length: 35, trend: 0.1, volatility: 0.1 },  // レンジ相場
          { length: 30, trend: 0.9, volatility: 0.2 }   // 再度上昇トレンド
        ];
        
        let segmentIndex = 0;
        let positionInSegment = 0;
        
        for (let i = 0; i < candleCount; i++) {
          // 時間はcandleCount*hoursPerCandle時間前から現在までの間隔で均等に配置
          const timestamp = now - (candleCount - i) * hoursPerCandle * 60 * 60 * 1000;
          
          // 現在のセグメントを決定
          const currentSegment = segments[segmentIndex];
          
          // トレンドの強さを調整（セグメント内での位置に基づく）
          const positionRatio = positionInSegment / currentSegment.length;
          
          // トレンドを加えた価格（より明確なパターンを作成）
          const trendComponent = currentSegment.trend * positionRatio * 2;
          
          // サイクル成分（ウェーブパターンを追加）
          const cycleComponent = Math.sin(i / 8) * 1.5;
          
          // ランダム成分（ノイズ）- トレンドをより明確にするため減らす
          const randomComponent = (Math.random() - 0.5) * currentSegment.volatility;
          
          // 価格変動の計算
          const priceChange = trendComponent + cycleComponent + randomComponent;
          const price = basePrice * (1 + priceChange / 100);
          
          // ローソク足データ生成（トレンド方向に沿ったオープン・クローズ）
          let open, close;
          if (currentSegment.trend > 0) {
            // 上昇トレンドではクローズ > オープンが多い
            if (Math.random() < 0.7) {
              open = price * (1 - Math.random() * 0.01);
              close = price;
            } else {
              open = price;
              close = price * (1 - Math.random() * 0.005);
            }
          } else if (currentSegment.trend < 0) {
            // 下降トレンドではクローズ < オープンが多い
            if (Math.random() < 0.7) {
              open = price;
              close = price * (1 - Math.random() * 0.01);
            } else {
              open = price * (1 - Math.random() * 0.005);
              close = price;
            }
          } else {
            // レンジ相場ではランダム
            open = price * (1 + (Math.random() - 0.5) * 0.01);
            close = price;
          }
          
          // 高値と安値を設定（トレンド方向に強調）
          const highLowSpread = Math.max(Math.abs(currentSegment.trend) * 0.01, 0.005);
          const high = Math.max(open, close) * (1 + Math.random() * highLowSpread);
          const low = Math.min(open, close) * (1 - Math.random() * highLowSpread);
          
          // トレンド方向に合わせてボリュームを調整（トレンド強い時は取引量増加）
          const trendStrength = Math.abs(currentSegment.trend);
          const volume = 5000 + Math.random() * 5000 + trendStrength * 3000;
          
          sampleData.push({
            timestamp,
            open,
            high,
            low,
            close,
            volume
          });
          
          // セグメント内の位置を更新
          positionInSegment++;
          
          // セグメントが終了したら次のセグメントへ
          if (positionInSegment >= currentSegment.length) {
            segmentIndex = Math.min(segmentIndex + 1, segments.length - 1);
            positionInSegment = 0;
          }
          
          // 次の基準価格を更新
          basePrice = close;
        }
        
        return sampleData;
      }
      
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
    // タイムフレームごとのリターンを計算
    const periodicReturns: number[] = [];
    for (let i = 1; i < equityHistory.length; i++) {
      const prevEquity = equityHistory[i - 1].equity;
      const currEquity = equityHistory[i].equity;
      const periodicReturn = (currEquity - prevEquity) / prevEquity;
      periodicReturns.push(periodicReturn);
    }
    
    // 平均リターンと標準偏差
    const avgReturn = periodicReturns.length > 0 
      ? periodicReturns.reduce((sum, r) => sum + r, 0) / periodicReturns.length 
      : 0;
    const stdDev = periodicReturns.length > 0
      ? Math.sqrt(
          periodicReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / periodicReturns.length
        )
      : 0;
    
    // タイムフレームに基づいた年間バー数の計算
    // 1年間に何本のバーがあるかを計算（時間単位のタイムフレームを想定）
    const timeframeHours = this.config.timeframeHours || 1; // デフォルト値を1時間に設定
    const hoursInYear = 24 * 365; // 1年の時間数
    const barsPerYear = hoursInYear / timeframeHours;
    
    logger.debug(`タイムフレーム: ${timeframeHours}時間, 年間バー数: ${barsPerYear}`);
    
    // 年率換算（タイムフレームに応じた年間バー数で換算）
    const annualizedReturn = avgReturn * barsPerYear;
    const annualizedStdDev = stdDev * Math.sqrt(barsPerYear);
    
    // シャープレシオ計算（リスクフリーレートを0と仮定）
    const sharpeRatio = annualizedStdDev > 0 ? annualizedReturn / annualizedStdDev : 0;
    
    // カルマーレシオ計算
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
    
    // ソルティノレシオ計算（下方リスクのみ考慮）
    const downReturns = periodicReturns.filter(r => r < 0);
    const downSideDev = periodicReturns.length > 0
      ? Math.sqrt(
          downReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / periodicReturns.length
        )
      : 0;
    const annualizedDownSideDev = downSideDev * Math.sqrt(barsPerYear);
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
  
  // quietモードの検出
  const quiet = args['quiet'] === true;
  
  if (isSmokeTest) {
    if (!quiet) console.log(`[BacktestRunner] スモークテストモードで実行 (${days}日間)`);
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
    isSmokeTest,
    quiet
  };
  
  if (!quiet) console.log(`[BacktestRunner] 設定:`, config);
  
  const runner = new BacktestRunner(config);
  try {
    const result = await runner.run();
    
    if (args['output']) {
      const outputPath = args['output'] as string;
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      if (!quiet) console.log(`[BacktestRunner] 結果を保存: ${outputPath}`);
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