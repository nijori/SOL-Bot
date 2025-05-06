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
import { Candle, normalizeTimestamp } from './types';
import logger from '../utils/logger';
import { OrderManagementSystem } from './orderManagementSystem';
import { MemoryMonitor } from '../utils/memoryMonitor';

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
  batchSize?: number;       // データ処理バッチサイズ
  memoryMonitoring?: boolean; // メモリ監視を有効にするか
  gcInterval?: number;      // ガベージコレクション実行間隔（キャンドル数）
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
    peakMemoryUsageMB?: number; // 最大メモリ使用量
    processingTimeMS?: number;  // 処理時間
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
  private dataStore: ParquetDataStore;
  private memoryMonitor: MemoryMonitor | null = null;
  
  constructor(config: BacktestConfig) {
    // デフォルト値の設定
    this.config = {
      ...config,
      batchSize: config.batchSize || 5000,     // デフォルトのバッチサイズ
      memoryMonitoring: config.memoryMonitoring !== undefined ? config.memoryMonitoring : !config.quiet, // quietモードでなければデフォルトで有効
      gcInterval: config.gcInterval || 10000   // デフォルトのGC間隔
    };
    
    this.dataStore = new ParquetDataStore();

    // メモリモニターの初期化
    if (this.config.memoryMonitoring) {
      this.memoryMonitor = new MemoryMonitor('backtest', !config.quiet);
    }
  }
  
  /**
   * バックテストを実行
   */
  async run(): Promise<BacktestResult> {
    // 処理時間計測開始
    const startTime = Date.now();
    
    // メモリモニタリングを開始
    if (this.memoryMonitor) {
      this.memoryMonitor.startMonitoring(2000); // 2秒ごとにスナップショット
    }
    
    // quietモードでない場合のみログを出力
    if (!this.config.quiet) {
      logger.info(`
=== バックテスト実行開始 ===
シンボル: ${this.config.symbol}
期間: ${this.config.startDate} - ${this.config.endDate}
タイムフレーム: ${this.config.timeframeHours}時間
初期残高: ${this.config.initialBalance}
スモークテスト: ${this.config.isSmokeTest ? "有効" : "無効"}
バッチサイズ: ${this.config.batchSize}
メモリ監視: ${this.config.memoryMonitoring ? "有効" : "無効"}
GC間隔: ${this.config.gcInterval}キャンドルごと
      `);
    }

    try {
      // データの読み込み
      const candles = await this.loadData();
      if (!this.config.quiet) {
        logger.debug(`[BacktestRunner] データ読み込み完了: ${candles.length}件のローソク足`);
      }
      
      // カスタムパラメータの適用
      if (this.config.parameters && Object.keys(this.config.parameters).length > 0) {
        applyParameters(this.config.parameters);
        if (!this.config.quiet) {
          logger.debug(`[BacktestRunner] カスタムパラメータを適用: ${Object.keys(this.config.parameters).length}個のパラメータ`);
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
        logger.debug(`[BacktestRunner] エンジン初期化完了: スモークテストモード=${this.config.isSmokeTest ? "有効" : "無効"}`);
      }
      
      // すべてのローソク足でシミュレーション実行
      const equityHistory: {timestamp: string, equity: number}[] = [];
      const allTrades: any[] = [];
      
      // 取引の重複を防ぐために最後のトレードのインデックスを追跡
      let lastTradeIndex = 0;
      // トレードIDのセットを使用して重複チェック（安全策）
      const processedTradeIds = new Set<string>();
      
      if (!this.config.quiet) {
        logger.debug(`[BacktestRunner] キャンドル処理開始: 合計${candles.length}本`);
      }

      // バッチ処理のための設定
      const batchSize = this.config.batchSize || 5000; // デフォルト値を設定
      const totalBatches = Math.ceil(candles.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, candles.length);
        const currentBatch = candles.slice(start, end);
        
        if (!this.config.quiet) {
          logger.debug(`[BacktestRunner] バッチ処理 ${batchIndex + 1}/${totalBatches}: ${currentBatch.length}本のキャンドル`);
        }
        
        for (let i = 0; i < currentBatch.length; i++) {
          const candle = currentBatch[i];
          
          // キャンドルでエンジンを更新
          await engine.update(candle);
          
          // エクイティ履歴を記録 - normalizeTimestamp関数を使用して型安全性を確保
          // 過剰なメモリ使用を避けるため、10本ごとまたはバッチの最後のキャンドルでのみ記録
          if (i % 10 === 0 || i === currentBatch.length - 1) {
            equityHistory.push({
              timestamp: new Date(normalizeTimestamp(candle.timestamp)).toISOString(),
              equity: engine.getEquity()
            });
          }
          
          // 完了した取引を取得
          const completedTrades = engine.getCompletedTrades();
          
          // 新しい取引のみを追加（重複を防止）
          if (completedTrades.length > lastTradeIndex) {
            const newTrades = completedTrades.slice(lastTradeIndex);
            // ユニークIDの付与と重複チェック
            const uniqueNewTrades = newTrades.filter(trade => {
              // 各トレードにユニークIDを付与（なければ）
              if (!trade.id) {
                trade.id = `trade-${trade.entryTime}-${trade.exitTime}-${Math.random().toString(36).substring(2, 10)}`;
              }
              
              // 既に処理済みのIDかチェック
              if (processedTradeIds.has(trade.id)) {
                if (!this.config.quiet) {
                  logger.warn(`[BacktestRunner] 重複トレードをスキップ: ID=${trade.id}, 時刻=${new Date(normalizeTimestamp(trade.exitTime)).toISOString()}`);
                }
                return false;
              }
              
              // 処理済みセットに追加
              processedTradeIds.add(trade.id);
              return true;
            });
            
            if (uniqueNewTrades.length > 0 && !this.config.quiet) {
              logger.info(`[BacktestRunner] 新規取引完了: ${uniqueNewTrades.length}件（合計${processedTradeIds.size}件）`);
              if (uniqueNewTrades.length !== newTrades.length) {
                logger.debug(`[BacktestRunner] 重複トレードを${newTrades.length - uniqueNewTrades.length}件検出し除外しました`);
              }
            }
            
            allTrades.push(...uniqueNewTrades);
            lastTradeIndex = completedTrades.length;
          }
          
          // 定期的なガベージコレクション実行（大量のデータ処理時のメモリ使用量削減）
          const totalProcessed = start + i + 1;
          if (global.gc && this.config.gcInterval && totalProcessed % this.config.gcInterval === 0) {
            if (!this.config.quiet) {
              logger.debug(`[BacktestRunner] メモリ最適化: ${totalProcessed}/${candles.length}本処理後にGC実行`);
            }
            global.gc();
          }
        }
        
        // バッチ処理後のメモリ状況レポート（最適化のための情報収集）
        if (this.memoryMonitor && !this.config.quiet) {
          const memSnapshot = this.memoryMonitor.takeSnapshot();
          if (memSnapshot) {
            logger.debug(`[BacktestRunner] バッチ${batchIndex + 1}完了後のメモリ: ${memSnapshot.heapUsed.toFixed(2)}MB / ${memSnapshot.heapTotal.toFixed(2)}MB (${(memSnapshot.heapUsed / memSnapshot.heapTotal * 100).toFixed(1)}%)`);
          }
        }
        
        // バッチ処理間でのガベージコレクション（バッチ処理間でのメモリ解放）
        if (global.gc && totalBatches > 1) {
          global.gc();
        }
      }
      
      // 最終的なすべての取引をクローズ
      await engine.closeAllPositions();
      
      // 最終的な完了取引を取得
      const finalCompletedTrades = engine.getCompletedTrades();
      
      // 最後のクローズで新しい取引があれば追加
      if (finalCompletedTrades.length > lastTradeIndex) {
        const newTrades = finalCompletedTrades.slice(lastTradeIndex);
        // ユニークIDの付与と重複チェック
        const uniqueNewTrades = newTrades.filter(trade => {
          // 各トレードにユニークIDを付与（なければ）
          if (!trade.id) {
            trade.id = `trade-${trade.entryTime}-${trade.exitTime}-${Math.random().toString(36).substring(2, 10)}`;
          }
          
          // 既に処理済みのIDかチェック
          if (processedTradeIds.has(trade.id)) {
            if (!this.config.quiet) {
              logger.warn(`[BacktestRunner] 最終処理で重複トレードをスキップ: ID=${trade.id}`);
            }
            return false;
          }
          
          // 処理済みセットに追加
          processedTradeIds.add(trade.id);
          return true;
        });
        
        if (uniqueNewTrades.length > 0 && !this.config.quiet) {
          logger.info(`[BacktestRunner] 最終取引完了: ${uniqueNewTrades.length}件の新規取引`);
          if (uniqueNewTrades.length !== newTrades.length) {
            logger.debug(`[BacktestRunner] 最終処理で重複トレードを${newTrades.length - uniqueNewTrades.length}件検出し除外しました`);
          }
        }
        
        allTrades.push(...uniqueNewTrades);
      }
      
      if (!this.config.quiet) {
        logger.info(`[BacktestRunner] 最終取引総数: ${allTrades.length}件（重複チェック済み）`);
      }
      
      // タイムスタンプでソート（トレード実行順に並べる）
      allTrades.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return normalizeTimestamp(a.timestamp) - normalizeTimestamp(b.timestamp);
      });
      
      // メモリモニタリングを停止
      let peakMemoryUsageMB = 0;
      if (this.memoryMonitor) {
        this.memoryMonitor.stopMonitoring();
        peakMemoryUsageMB = this.memoryMonitor.getMaxHeapUsed();
        
        if (!this.config.quiet) {
          this.memoryMonitor.logSummary();
        }
      }
      
      // 処理時間計測終了
      const processingTimeMS = Date.now() - startTime;
      
      // 完了したバックテストの結果を取得して評価
      const metrics = this.calculateMetrics(allTrades, equityHistory);
      
      // メモリ使用量と処理時間をメトリクスに追加
      metrics.peakMemoryUsageMB = peakMemoryUsageMB;
      metrics.processingTimeMS = processingTimeMS;
      
      const result: BacktestResult = {
        metrics,
        trades: allTrades,
        equity: equityHistory,
        parameters: {
          ...this.config.parameters,
          slippage: this.config.slippage,
          commissionRate: this.config.commissionRate,
          batchSize: this.config.batchSize
        }
      };
      
      if (!this.config.quiet) {
        logger.info(`
=== バックテスト完了 ===
実行時間: ${(processingTimeMS / 1000).toFixed(1)}秒
最大メモリ使用量: ${peakMemoryUsageMB.toFixed(2)}MB
トータルリターン: ${metrics.totalReturn.toFixed(2)}%
シャープレシオ: ${metrics.sharpeRatio.toFixed(2)}
最大ドローダウン: ${(metrics.maxDrawdown * 100).toFixed(2)}%
勝率: ${(metrics.winRate * 100).toFixed(2)}%
取引数: ${allTrades.length}件
        `);
      }
      
      // リソース解放
      this.dataStore.close();
      
      return result;
      
    } catch (error) {
      // エラー発生時もメモリモニタリングを停止
      if (this.memoryMonitor) {
        this.memoryMonitor.stopMonitoring();
      }
      
      logger.error(`[BacktestRunner] バックテスト実行エラー:`, error);
      
      // リソース解放
      this.dataStore.close();
      
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
      if (!this.config.quiet) {
        logger.debug(`[BacktestRunner] データ検索条件: ${this.config.symbol}, ${this.config.timeframeHours}h時間足, 期間=${this.config.startDate} - ${this.config.endDate}`);
      }
      
      // データディレクトリの内容を確認して表示
      // すでにインポートしているfsとpathを使用（再requireしない）
      const dataDir = path.join(process.cwd(), 'data/candles');
      
      if (!this.config.quiet && fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir);
        logger.debug(`[BacktestRunner] データディレクトリ内のファイル: ${files.join(', ')}`);
      } else if (!this.config.quiet) {
        logger.debug(`[BacktestRunner] データディレクトリが見つかりません: ${dataDir}`);
      }
      
      const candles = await dataStore.getCandleData({
        symbol: this.config.symbol,
        timeframeHours: this.config.timeframeHours,
        startDate: new Date(this.config.startDate),
        endDate: new Date(this.config.endDate)
      });
      
      // データストアを閉じる
      dataStore.close();
      
      if (!this.config.quiet) {
        logger.debug(`[BacktestRunner] データ読み込み完了: ${candles.length}件のローソク足`);
      }
      
      if (candles.length === 0 && this.config.isSmokeTest) {
        // スモークテスト用の最小限のサンプルデータ生成（改善版）
        if (!this.config.quiet) {
          logger.info(`[BacktestRunner] スモークテスト用のサンプルデータを生成します`);
        }
        
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
      logger.error(`[BacktestRunner] データ読み込みエラー:`, error);
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

  /**
   * コマンドライン引数から設定を解析してバックテストを実行
   */
  static async runFromCli(): Promise<void> {
    const args = process.argv.slice(2);
    
    // スモークテストフラグ
    const isSmokeTest = args.includes('--smoke-test');
    
    // テスト日数（スモークテストで使用）
    let days = 5; // デフォルト5日間
    const daysIndex = args.indexOf('--days');
    if (daysIndex !== -1 && args.length > daysIndex + 1) {
      days = parseInt(args[daysIndex + 1], 10);
    }
    
    // スモークテストモードの場合は、現在から指定日数分の期間を設定
    if (isSmokeTest) {
      const quietMode = args.includes('--quiet');
      if (!quietMode) {
        logger.info(`[BacktestRunner] スモークテストモードで実行 (${days}日間)`);
      } else {
        console.log(`[BacktestRunner] スモークテストモードで実行 (${days}日間)`);
      }
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // スモークテスト用の設定
      const config: BacktestConfig = {
        symbol: 'SOLUSDT',
        timeframeHours: 1,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        initialBalance: 10000,
        isSmokeTest: true,
        quiet: quietMode
      };
      
      // 各種オプションのパース
      // スリッページ
      const slippageIndex = args.indexOf('--slippage');
      if (slippageIndex !== -1 && args.length > slippageIndex + 1) {
        config.slippage = parseFloat(args[slippageIndex + 1]);
      }
      
      // 手数料
      const commissionRateIndex = args.indexOf('--commission-rate');
      if (commissionRateIndex !== -1 && args.length > commissionRateIndex + 1) {
        config.commissionRate = parseFloat(args[commissionRateIndex + 1]);
      }
      
      // バッチサイズ (メモリ最適化用)
      const batchSizeIndex = args.indexOf('--batch-size');
      if (batchSizeIndex !== -1 && args.length > batchSizeIndex + 1) {
        config.batchSize = parseInt(args[batchSizeIndex + 1], 10);
      }
      
      // GC間隔
      const gcIntervalIndex = args.indexOf('--gc-interval');
      if (gcIntervalIndex !== -1 && args.length > gcIntervalIndex + 1) {
        config.gcInterval = parseInt(args[gcIntervalIndex + 1], 10);
      }
      
      // メモリモニタリングフラグ
      config.memoryMonitoring = !args.includes('--no-memory-monitor');
      
      if (!quietMode) {
        logger.info(`[BacktestRunner] 設定:`, config);
      }
      
      // バックテスト実行
      const runner = new BacktestRunner(config);
      await runner.run();
      return;
    }
    
    // 通常のバックテスト実行の場合: 引数からパラメータを解析
    let symbol = 'SOLUSDT';
    let timeframeHours = 1;
    let startDate = '2023-01-01T00:00:00Z';
    let endDate = '2023-12-31T23:59:59Z';
    let initialBalance = 10000;
    let slippage: number | undefined;
    let commissionRate: number | undefined;
    let quiet = false;
    let batchSize: number | undefined;
    let gcInterval: number | undefined;
    let memoryMonitoring = true;
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--symbol' && i + 1 < args.length) {
        symbol = args[++i];
      } else if (arg === '--timeframe' && i + 1 < args.length) {
        timeframeHours = parseFloat(args[++i]);
      } else if (arg === '--start-date' && i + 1 < args.length) {
        startDate = args[++i];
      } else if (arg === '--end-date' && i + 1 < args.length) {
        endDate = args[++i];
      } else if (arg === '--initial-balance' && i + 1 < args.length) {
        initialBalance = parseFloat(args[++i]);
      } else if (arg === '--slippage' && i + 1 < args.length) {
        slippage = parseFloat(args[++i]);
      } else if (arg === '--commission-rate' && i + 1 < args.length) {
        commissionRate = parseFloat(args[++i]);
      } else if (arg === '--quiet') {
        quiet = true;
      } else if (arg === '--batch-size' && i + 1 < args.length) {
        batchSize = parseInt(args[++i], 10);
      } else if (arg === '--gc-interval' && i + 1 < args.length) {
        gcInterval = parseInt(args[++i], 10);
      } else if (arg === '--no-memory-monitor') {
        memoryMonitoring = false;
      } else if (arg === '--help') {
        console.log(`
バックテスト実行コマンド:
  ts-node src/core/backtestRunner.ts [オプション]

オプション:
  --symbol <シンボル>              取引ペア (デフォルト: SOLUSDT)
  --timeframe <時間>              時間枠（時間単位、例: 1, 4, 12） (デフォルト: 1)
  --start-date <開始日>           開始日時 (デフォルト: 2023-01-01T00:00:00Z)
  --end-date <終了日>             終了日時 (デフォルト: 2023-12-31T23:59:59Z)
  --initial-balance <残高>        初期残高 (デフォルト: 10000)
  --slippage <値>                 スリッページ率 (0.001 = 0.1%)
  --commission-rate <値>          手数料率 (0.001 = 0.1%)
  --quiet                         詳細ログを表示しない
  --smoke-test                    スモークテストモード
  --days <日数>                   スモークテスト時の日数 (デフォルト: 5)
  
  // メモリ最適化オプション
  --batch-size <数>               バッチサイズ（キャンドル数） (デフォルト: 5000)
  --gc-interval <数>              ガベージコレクション間隔（キャンドル数） (デフォルト: 10000)
  --no-memory-monitor             メモリモニタリングを無効化
  
  --help                          ヘルプの表示

例:
  ts-node src/core/backtestRunner.ts --symbol SOLUSDT --timeframe 1 --start-date 2023-01-01 --end-date 2023-06-30
  ts-node src/core/backtestRunner.ts --smoke-test --days 10
  ts-node src/core/backtestRunner.ts --batch-size 2000 --gc-interval 5000
        `);
        process.exit(0);
      }
    }
    
    // 設定を作成してバックテストを実行
    const config: BacktestConfig = {
      symbol,
      timeframeHours,
      startDate,
      endDate,
      initialBalance,
      slippage,
      commissionRate,
      quiet,
      batchSize,
      gcInterval,
      memoryMonitoring
    };
    
    if (!quiet) {
      logger.info(`バックテスト設定:`, config);
    }
    
    const runner = new BacktestRunner(config);
    const result = await runner.run();
    
    if (!quiet) {
      console.log(JSON.stringify(result, null, 2));
    }
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
  let startDateStr = args['start-date'] as string || '';
  let endDateStr = args['end-date'] as string || '';
  
  // quietモードの検出
  const quiet = args['quiet'] === true;
  
  if (!startDateStr || !endDateStr) {
    // デフォルトは過去30日
    const days = Number(args['days'] as string) || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    if (!quiet) {
      logger.info(`[BacktestRunner] スモークテストモードで実行 (${days}日間)`);
    } else {
      console.log(`[BacktestRunner] スモークテストモードで実行 (${days}日間)`);
    }
    
    endDateStr = endDate.toISOString();
    startDateStr = startDate.toISOString();
  }
  
  // 追加パラメータの処理
  const paramStrings = args['params'] ? (args['params'] as string).split(',') : [];
  const parameters: Record<string, any> = {};
  
  for (const paramString of paramStrings) {
    const [key, value] = paramString.split('=');
    if (key && value) {
      // 数値に変換可能な場合は数値化
      const numValue = Number(value);
      parameters[key] = isNaN(numValue) ? value : numValue;
    }
  }
  
  // スモークテスト
  const isSmokeTest = args['smoke-test'] === true;
  
  // 設定オブジェクトの作成
  const config: BacktestConfig = {
    symbol: args['symbol'] as string || 'SOL/USDT',
    timeframeHours: parseFloat(args['timeframe'] as string || '1'),
    startDate: startDateStr,
    endDate: endDateStr,
    initialBalance: parseFloat(args['balance'] as string || '10000'),
    isSmokeTest,
    quiet,
    parameters
  };
  
  // スリッページと手数料があれば設定
  if (args['slippage']) {
    config.slippage = parseFloat(args['slippage'] as string);
  }
  
  if (args['commission']) {
    config.commissionRate = parseFloat(args['commission'] as string);
  }
  
  if (!quiet) {
    logger.info(`[BacktestRunner] 設定:`, config);
  }
  
  const runner = new BacktestRunner(config);
  const result = await runner.run();
  
  // 結果のJSON出力
  const outputPath = args['output'] as string || `./backtest-result-${new Date().toISOString().replace(/:/g, '-')}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  
  if (!quiet) {
    logger.info(`[BacktestRunner] 結果を保存: ${outputPath}`);
  }
}

// スクリプトが直接実行された場合はCLIモードで実行
if (require.main === module) {
  BacktestRunner.runFromCli().catch(err => {
    console.error('バックテスト実行エラー:', err);
    process.exit(1);
  });
} 