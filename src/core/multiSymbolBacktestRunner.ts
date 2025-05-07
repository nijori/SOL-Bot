/**
 * マルチシンボルバックテスト実行クラス
 * 複数通貨ペアの同時バックテストを実行
 * 
 * CORE-005: backtestRunnerとtradingEngineのマルチシンボル対応拡張
 */

import { BacktestRunner, BacktestConfig, BacktestResult } from './backtestRunner';
import { 
  MultiSymbolBacktestConfig, 
  MultiSymbolBacktestResult, 
  AllocationStrategy,
  AllocationWeights
} from '../types/multiSymbolTypes';
import logger from '../utils/logger';
import { MemoryMonitor } from '../utils/memoryMonitor';
import { parameterService } from '../config/parameterService';
import { normalizeTimestamp } from './types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * マルチシンボルバックテスト実行クラス
 */
export class MultiSymbolBacktestRunner {
  private config: MultiSymbolBacktestConfig;
  private memoryMonitor: MemoryMonitor | null = null;
  private symbolRunners: Map<string, BacktestRunner> = new Map();
  private allocationWeights: Record<string, number> = {};

  /**
   * コンストラクタ
   * @param config マルチシンボルバックテスト設定
   */
  constructor(config: MultiSymbolBacktestConfig) {
    this.config = config;

    // メモリモニタリングの初期化
    if (config.memoryMonitoring) {
      this.memoryMonitor = new MemoryMonitor();
      this.memoryMonitor.startMonitoring();
    }

    // 資金配分戦略の処理
    this.calculateAllocationWeights();

    // 各シンボル用のバックテストランナーを初期化
    this.initializeSymbolRunners();

    if (!config.quiet) {
      logger.info(`[MultiSymbolBacktestRunner] ${config.symbols.length}個のシンボルで初期化しました`);
      logger.info(`[MultiSymbolBacktestRunner] 資金配分戦略: ${config.allocationStrategy || AllocationStrategy.EQUAL}`);
    }
  }

  /**
   * 資金配分比率を計算
   */
  private calculateAllocationWeights(): void {
    const strategy = this.config.allocationStrategy || AllocationStrategy.EQUAL;
    const symbols = this.config.symbols;

    switch (strategy) {
      case AllocationStrategy.EQUAL:
        // 均等配分
        const equalWeight = 1 / symbols.length;
        symbols.forEach(symbol => {
          this.allocationWeights[symbol] = equalWeight;
        });
        break;

      case AllocationStrategy.CUSTOM:
        // カスタム配分（symbolParamsから取得）
        let customWeights: Record<string, number> = {};
        let totalWeight = 0;

        symbols.forEach(symbol => {
          const weight = (this.config.symbolParams?.[symbol]?.parameters as any)?.weight || 1;
          customWeights[symbol] = weight;
          totalWeight += weight;
        });

        // 合計が1になるように正規化
        symbols.forEach(symbol => {
          this.allocationWeights[symbol] = customWeights[symbol] / totalWeight;
        });
        break;

      case AllocationStrategy.VOLATILITY:
        // 実装時はATRなどのボラティリティ指標を使用して逆比例配分
        // 現時点では簡易的に均等配分
        symbols.forEach(symbol => {
          this.allocationWeights[symbol] = 1 / symbols.length;
        });
        if (!this.config.quiet) {
          logger.warn(`[MultiSymbolBacktestRunner] ボラティリティ配分は未実装のため均等配分を使用します`);
        }
        break;

      case AllocationStrategy.MARKET_CAP:
        // 実装時は時価総額データを使用
        // 現時点では簡易的に均等配分
        symbols.forEach(symbol => {
          this.allocationWeights[symbol] = 1 / symbols.length;
        });
        if (!this.config.quiet) {
          logger.warn(`[MultiSymbolBacktestRunner] 時価総額配分は未実装のため均等配分を使用します`);
        }
        break;

      default:
        // デフォルトは均等配分
        symbols.forEach(symbol => {
          this.allocationWeights[symbol] = 1 / symbols.length;
        });
    }

    if (!this.config.quiet) {
      logger.info(`[MultiSymbolBacktestRunner] 資金配分比率:`);
      Object.entries(this.allocationWeights).forEach(([symbol, weight]) => {
        logger.info(`  ${symbol}: ${(weight * 100).toFixed(2)}%`);
      });
    }
  }

  /**
   * 各シンボル用のバックテストランナーを初期化
   */
  private initializeSymbolRunners(): void {
    this.config.symbols.forEach(symbol => {
      // シンボル固有の設定とグローバル設定をマージ
      const symbolSpecificConfig = this.config.symbolParams?.[symbol] || {};
      
      // 初期残高を配分比率に応じて設定
      const allocation = this.allocationWeights[symbol];
      const symbolInitialBalance = this.config.initialBalance * allocation;

      const backtestConfig: BacktestConfig = {
        symbol,
        timeframeHours: this.config.timeframeHours instanceof Array ? 
                         this.config.timeframeHours[0] : 
                         this.config.timeframeHours,
        startDate: this.config.startDate,
        endDate: this.config.endDate,
        initialBalance: symbolInitialBalance,
        parameters: {
          ...this.config.parameters,
          ...(symbolSpecificConfig.parameters || {})
        },
        isSmokeTest: this.config.isSmokeTest,
        slippage: symbolSpecificConfig.slippage || this.config.slippage,
        commissionRate: symbolSpecificConfig.commissionRate || this.config.commissionRate,
        quiet: true, // 個別ログは抑制（全体ログのみ表示）
        batchSize: symbolSpecificConfig.batchSize || this.config.batchSize,
        gcInterval: symbolSpecificConfig.gcInterval || this.config.gcInterval,
        memoryMonitoring: false // 個別メモリ監視は無効（全体で監視）
      };

      const runner = new BacktestRunner(backtestConfig);
      this.symbolRunners.set(symbol, runner);

      if (!this.config.quiet) {
        logger.debug(`[MultiSymbolBacktestRunner] ${symbol}のバックテストランナーを初期化しました`);
      }
    });
  }

  /**
   * マルチシンボルバックテストを実行
   */
  async run(): Promise<MultiSymbolBacktestResult> {
    // 処理時間計測開始
    const startTime = Date.now();

    if (!this.config.quiet) {
      logger.info(`
=== マルチシンボルバックテスト開始 ===
シンボル: ${this.config.symbols.join(', ')}
期間: ${this.config.startDate} ～ ${this.config.endDate}
初期資金: ${this.config.initialBalance}
配分戦略: ${this.config.allocationStrategy || AllocationStrategy.EQUAL}
      `);
    }

    try {
      // 各シンボルのバックテスト結果を格納するオブジェクト
      const symbolResults: Record<string, BacktestResult> = {};
      let totalEquity: number = 0;
      
      // エクイティ履歴を結合するためのマップ
      type EquityPoint = { timestamp: string; equity: number; };
      const allEquityPoints = new Map<string, { 
        total: number, 
        bySymbol: Record<string, number> 
      }>();

      // 各シンボルのバックテストを順次実行
      for (const [symbol, runner] of this.symbolRunners.entries()) {
        if (!this.config.quiet) {
          logger.info(`[MultiSymbolBacktestRunner] ${symbol}のバックテスト実行中...`);
        }

        // バックテスト実行
        const result = await runner.run();
        symbolResults[symbol] = result;
        
        // 最終エクイティを累積
        const finalEquity = result.equity[result.equity.length - 1]?.equity || 0;
        totalEquity += finalEquity;

        // エクイティ履歴をマージ用マップに追加
        result.equity.forEach((point: EquityPoint) => {
          if (!allEquityPoints.has(point.timestamp)) {
            allEquityPoints.set(point.timestamp, { 
              total: 0, 
              bySymbol: {} 
            });
          }
          
          const entry = allEquityPoints.get(point.timestamp)!;
          entry.total += point.equity;
          entry.bySymbol[symbol] = point.equity;
        });

        if (!this.config.quiet) {
          logger.info(`[MultiSymbolBacktestRunner] ${symbol}のバックテスト完了: リターン=${result.metrics.totalReturn.toFixed(2)}%, 取引数=${result.trades.length}件`);
        }
      }

      // 統合されたエクイティ履歴を作成
      const equityHistory = Array.from(allEquityPoints.entries())
        .map(([timestamp, data]) => ({
          timestamp,
          equity: data.total,
          symbolEquity: data.bySymbol
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // ポートフォリオ全体のメトリクスを計算
      const portfolioMetrics = this.calculatePortfolioMetrics(symbolResults, equityHistory);

      // 相関分析（オプション）
      if (this.config.correlationAnalysis) {
        portfolioMetrics.correlationMatrix = this.calculateCorrelationMatrix(symbolResults, equityHistory);
      }

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

      const result: MultiSymbolBacktestResult = {
        symbolResults,
        portfolioMetrics,
        equity: equityHistory,
        allocationStrategy: this.config.allocationStrategy || AllocationStrategy.EQUAL,
        parameters: {
          ...this.config.parameters,
          slippage: this.config.slippage,
          commissionRate: this.config.commissionRate
        }
      };

      if (!this.config.quiet) {
        logger.info(`
=== マルチシンボルバックテスト完了 ===
実行時間: ${(processingTimeMS / 1000).toFixed(1)}秒
最大メモリ使用量: ${peakMemoryUsageMB.toFixed(2)}MB
シンボル数: ${this.config.symbols.length}
ポートフォリオ リターン: ${portfolioMetrics.totalReturn.toFixed(2)}%
ポートフォリオ シャープレシオ: ${portfolioMetrics.sharpeRatio.toFixed(2)}
ポートフォリオ 最大ドローダウン: ${(portfolioMetrics.maxDrawdown * 100).toFixed(2)}%
        `);
      }

      return result;
    } catch (error) {
      // エラー発生時もメモリモニタリングを停止
      if (this.memoryMonitor) {
        this.memoryMonitor.stopMonitoring();
      }

      logger.error(`[MultiSymbolBacktestRunner] マルチシンボルバックテスト実行エラー:`, error);
      throw error;
    }
  }

  /**
   * ポートフォリオ全体のメトリクスを計算
   */
  private calculatePortfolioMetrics(
    symbolResults: Record<string, BacktestResult>,
    equityHistory: { timestamp: string; equity: number; symbolEquity: Record<string, number> }[]
  ): MultiSymbolBacktestResult['portfolioMetrics'] {
    // デフォルト値で初期化
    const metrics: MultiSymbolBacktestResult['portfolioMetrics'] = {
      totalReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      profitFactor: 0,
      calmarRatio: 0,
      sortinoRatio: 0
    };

    // エクイティから計算可能なメトリクスを計算
    if (equityHistory.length > 0) {
      // 初期資金と最終資金から総リターンを計算
      const initialEquity = equityHistory[0].equity;
      const finalEquity = equityHistory[equityHistory.length - 1].equity;
      metrics.totalReturn = ((finalEquity / initialEquity) - 1) * 100;

      // 最大ドローダウンを計算
      let maxEquity = initialEquity;
      let currentDrawdown = 0;
      let maxDrawdown = 0;

      for (const point of equityHistory) {
        if (point.equity > maxEquity) {
          maxEquity = point.equity;
        }

        currentDrawdown = 1 - (point.equity / maxEquity);
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }
      }
      metrics.maxDrawdown = maxDrawdown;

      // 日次リターンを計算してシャープレシオとソルティノレシオを計算
      if (equityHistory.length > 1) {
        const dailyReturns: number[] = [];
        
        // 日次リターンを計算（日ごとの価格変化率）
        for (let i = 1; i < equityHistory.length; i++) {
          const prevEquity = equityHistory[i - 1].equity;
          const currentEquity = equityHistory[i].equity;
          dailyReturns.push((currentEquity / prevEquity) - 1);
        }

        // 平均リターンと標準偏差を計算
        const averageReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
        const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - averageReturn, 2), 0) / dailyReturns.length;
        const stdDev = Math.sqrt(variance);

        // 年間化シャープレシオを計算（リスクフリーレート=0と仮定）
        metrics.sharpeRatio = stdDev > 0 ? (averageReturn / stdDev) * Math.sqrt(252) : 0;

        // ネガティブリターンのみの標準偏差を計算（ソルティノレシオ用）
        const negativeReturns = dailyReturns.filter(ret => ret < 0);
        const negativeVariance = negativeReturns.length > 0 
          ? negativeReturns.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / negativeReturns.length 
          : 0;
        const negativeStdDev = Math.sqrt(negativeVariance);

        // ソルティノレシオを計算
        metrics.sortinoRatio = negativeStdDev > 0 ? (averageReturn / negativeStdDev) * Math.sqrt(252) : 0;

        // カルマーレシオを計算
        metrics.calmarRatio = metrics.maxDrawdown > 0 ? (metrics.totalReturn / 100) / metrics.maxDrawdown : 0;
      }

      // 集計情報からwinRate, profitFactorを計算
      let totalWins = 0;
      let totalLosses = 0;
      let totalProfit = 0;
      let totalLoss = 0;
      let totalTrades = 0;

      Object.values(symbolResults).forEach(result => {
        // 勝ちトレードと負けトレード
        const winningTrades = result.trades.filter(t => t.pnl > 0);
        const losingTrades = result.trades.filter(t => t.pnl < 0);
        
        totalWins += winningTrades.length;
        totalLosses += losingTrades.length;
        totalTrades += result.trades.length;

        // 合計利益と合計損失
        totalProfit += winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        totalLoss += Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
      });

      // 勝率を計算
      metrics.winRate = totalTrades > 0 ? totalWins / totalTrades : 0;

      // プロフィットファクターを計算
      metrics.profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    }

    return metrics;
  }

  /**
   * シンボル間の相関行列を計算
   */
  private calculateCorrelationMatrix(
    symbolResults: Record<string, BacktestResult>,
    equityHistory: { timestamp: string; equity: number; symbolEquity: Record<string, number> }[]
  ): Record<string, Record<string, number>> {
    const correlationMatrix: Record<string, Record<string, number>> = {};
    const symbols = Object.keys(symbolResults);

    // 各シンボルの初期化
    symbols.forEach(symbol => {
      correlationMatrix[symbol] = {};
      symbols.forEach(innerSymbol => {
        correlationMatrix[symbol][innerSymbol] = symbol === innerSymbol ? 1.0 : 0.0;
      });
    });

    // エクイティポイントが少なすぎる場合は計算しない
    if (equityHistory.length < 10) {
      return correlationMatrix;
    }

    // 各シンボルの日次リターンを計算
    const symbolReturns: Record<string, number[]> = {};
    
    symbols.forEach(symbol => {
      symbolReturns[symbol] = [];
      
      for (let i = 1; i < equityHistory.length; i++) {
        const prevEquity = equityHistory[i - 1].symbolEquity[symbol] || 0;
        const currentEquity = equityHistory[i].symbolEquity[symbol] || 0;
        
        if (prevEquity > 0 && currentEquity > 0) {
          symbolReturns[symbol].push((currentEquity / prevEquity) - 1);
        } else {
          symbolReturns[symbol].push(0); // 欠損値の場合は0とする
        }
      }
    });

    // ピアソン相関係数を計算
    symbols.forEach((symbolA, indexA) => {
      symbols.forEach((symbolB, indexB) => {
        if (indexA < indexB) { // 対角線より上半分だけ計算
          const returnsA = symbolReturns[symbolA];
          const returnsB = symbolReturns[symbolB];
          
          // 両方のシンボルで十分なデータがある場合のみ計算
          if (returnsA.length >= 10 && returnsB.length >= 10) {
            const correlation = this.calculatePearsonCorrelation(returnsA, returnsB);
            correlationMatrix[symbolA][symbolB] = correlation;
            correlationMatrix[symbolB][symbolA] = correlation; // 対称行列
          }
        }
      });
    });

    return correlationMatrix;
  }

  /**
   * ピアソン相関係数を計算
   */
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length) {
      throw new Error('配列の長さが一致しません');
    }

    const n = x.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) {
      return 0;
    }

    return numerator / denominator;
  }

  /**
   * マルチシンボルバックテストをCLIから実行
   */
  static async runFromCli(): Promise<void> {
    const args = process.argv.slice(2);
    
    // デフォルト設定
    let symbols: string[] = [];
    let timeframeHours: number | number[] = 4;
    let startDate: string = '';
    let endDate: string = '';
    let initialBalance: number = 10000;
    let allocationStrategy: AllocationStrategy = AllocationStrategy.EQUAL;
    let slippage: number = 0.001;
    let commissionRate: number = 0.001;
    let quiet: boolean = false;
    let batchSize: number = 5000;
    let gcInterval: number = 1000;
    let memoryMonitoring: boolean = false;
    let correlationAnalysis: boolean = false;
    let configFile: string = '';
    
    // 引数解析
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--symbols' && i + 1 < args.length) {
        symbols = args[++i].split(',');
      } else if (arg === '--timeframe' && i + 1 < args.length) {
        const timeframes = args[++i].split(',');
        if (timeframes.length === 1) {
          timeframeHours = parseFloat(timeframes[0]);
        } else {
          timeframeHours = timeframes.map(tf => parseFloat(tf));
        }
      } else if (arg === '--start-date' && i + 1 < args.length) {
        startDate = args[++i];
      } else if (arg === '--end-date' && i + 1 < args.length) {
        endDate = args[++i];
      } else if (arg === '--initial-balance' && i + 1 < args.length) {
        initialBalance = parseFloat(args[++i]);
      } else if (arg === '--allocation' && i + 1 < args.length) {
        const allocArg = args[++i].toUpperCase();
        if (Object.values(AllocationStrategy).includes(allocArg as AllocationStrategy)) {
          allocationStrategy = allocArg as AllocationStrategy;
        }
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
      } else if (arg === '--memory-monitoring') {
        memoryMonitoring = true;
      } else if (arg === '--correlation') {
        correlationAnalysis = true;
      } else if (arg === '--config' && i + 1 < args.length) {
        configFile = args[++i];
      }
    }
    
    // 設定ファイルからの読み込み（指定されている場合）
    if (configFile) {
      try {
        const configPath = path.resolve(process.cwd(), configFile);
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);
        
        // 設定ファイルの内容で上書き（CLIで指定されたものは優先）
        symbols = symbols.length > 0 ? symbols : config.symbols || [];
        timeframeHours = config.timeframeHours || timeframeHours;
        startDate = startDate || config.startDate;
        endDate = endDate || config.endDate;
        initialBalance = config.initialBalance || initialBalance;
        allocationStrategy = config.allocationStrategy || allocationStrategy;
        slippage = config.slippage ?? slippage;
        commissionRate = config.commissionRate ?? commissionRate;
        correlationAnalysis = config.correlationAnalysis ?? correlationAnalysis;
        
        if (!quiet) {
          logger.info(`[MultiSymbolBacktestRunner] 設定ファイル ${configFile} を読み込みました`);
        }
      } catch (error) {
        logger.error(`[MultiSymbolBacktestRunner] 設定ファイルの読み込みエラー:`, error);
      }
    }
    
    // シンボルが指定されていない場合はパラメータサービスから取得
    if (symbols.length === 0) {
      symbols = parameterService.get('general.markets', ['SOL/USDT']);
    }
    
    // 開始日と終了日が指定されていない場合はエラー
    if (!startDate || !endDate) {
      logger.error('[MultiSymbolBacktestRunner] 開始日と終了日を指定してください');
      process.exit(1);
    }
    
    // 設定を作成してマルチシンボルバックテストを実行
    const config: MultiSymbolBacktestConfig = {
      symbols,
      timeframeHours,
      startDate,
      endDate,
      initialBalance,
      allocationStrategy,
      slippage,
      commissionRate,
      quiet,
      batchSize,
      gcInterval,
      memoryMonitoring,
      correlationAnalysis
    };
    
    if (!quiet) {
      logger.info(`マルチシンボルバックテスト設定:`, config);
    }
    
    const runner = new MultiSymbolBacktestRunner(config);
    const result = await runner.run();
    
    if (!quiet) {
      console.log(JSON.stringify(result, null, 2));
    }
  }
} 