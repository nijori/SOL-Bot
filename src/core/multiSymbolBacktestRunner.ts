/**
 * マルチシンボルバックテスト実行クラス
 * 複数通貨ペアの同時バックテストを実行
 *
 * CORE-005: backtestRunnerとtradingEngineのマルチシンボル対応拡張
 * BT-008: MultiSymbolBacktestRunner並列化
 */

// @ts-nocheck
// CommonJS移行中のため一時的にTypeScriptチェックを無効化

const { BacktestRunner } = require('./backtestRunner');
const logger = require('../utils/logger').default;
const { MemoryMonitor } = require('../utils/memoryMonitor');
const { parameterService } = require('../config/parameterService');
const { normalizeTimestamp } = require('./types');
const path = require('path');
const fs = require('fs');
const pLimit = require('p-limit');
const { volBasedAllocationWeights } = require('../indicators/marketState');
const { toExtendedBacktestResult } = require('../types/extendedBacktestTypes');
const { AllocationStrategy } = require('../types/multiSymbolTypes');

/**
 * マルチシンボルバックテスト実行クラス
 */
class MultiSymbolBacktestRunner {
  private config: MultiSymbolBacktestConfig;
  private memoryMonitor: MemoryMonitor | null = null;
  private symbolRunners: Map<string, BacktestRunner> = new Map();
  private allocationWeights: Record<string, number> = {};
  private parallelLimit: number;

  /**
   * コンストラクタ
   * @param config マルチシンボルバックテスト設定
   */
  constructor(config: MultiSymbolBacktestConfig) {
    this.config = config;

    // 並列処理の制限値を設定（デフォルトはシンボル数、最大8）
    this.parallelLimit = config.parallelLimit || Math.min(config.symbols.length, 8);

    // メモリモニタリングの初期化
    if (config.memoryMonitoring) {
      this.memoryMonitor = new MemoryMonitor();
      this.memoryMonitor.startMonitoring();
    }

    // 注意: 初期化はinitializeメソッドで実行
    if (!config.quiet) {
      logger.info(
        `[MultiSymbolBacktestRunner] ${config.symbols.length}個のシンボルで初期化しました`
      );
      logger.info(
        `[MultiSymbolBacktestRunner] 資金配分戦略: ${config.allocationStrategy || AllocationStrategy.EQUAL}`
      );
      logger.info(
        `[MultiSymbolBacktestRunner] 並列実行制限: ${this.parallelLimit}（同時実行最大数）`
      );
    }
  }

  /**
   * 非同期初期化処理
   */
  async initialize(): Promise<void> {
    // 資金配分戦略の処理
    await this.calculateAllocationWeights();

    // 各シンボル用のバックテストランナーを初期化
    this.initializeSymbolRunners();
  }

  /**
   * 資金配分比率を計算
   */
  private async calculateAllocationWeights(): Promise<void> {
    const strategy = this.config.allocationStrategy || AllocationStrategy.EQUAL;
    const symbols = this.config.symbols;

    switch (strategy) {
      case AllocationStrategy.EQUAL:
        // 均等配分
        const equalWeight = 1 / symbols.length;
        symbols.forEach((symbol) => {
          this.allocationWeights[symbol] = equalWeight;
        });
        break;

      case AllocationStrategy.CUSTOM:
        // カスタム配分（symbolParamsから取得）
        const customWeights: Record<string, number> = {};
        let totalWeight = 0;

        symbols.forEach((symbol) => {
          const weight = (this.config.symbolParams?.[symbol]?.parameters as any)?.weight || 1;
          customWeights[symbol] = weight;
          totalWeight += weight;
        });

        // 合計が1になるように正規化
        symbols.forEach((symbol) => {
          this.allocationWeights[symbol] = customWeights[symbol] / totalWeight;
        });
        break;

      case AllocationStrategy.VOLATILITY:
        try {
          // バックテスト前の初期化時にはボラティリティデータが必要
          // 各シンボルのキャンドルデータを読み込む必要がある
          if (!this.config.quiet) {
            logger.info(`[MultiSymbolBacktestRunner] ボラティリティベースの資金配分を計算中...`);
          }

          // データロード用の関数
          const getInitialCandlesForSymbol = async (symbol: string) => {
            try {
              // 各シンボルのデータパスを構築
              const dataDir = process.env.DATA_DIR || 'data/candles';
              const timeframe =
                this.config.timeframeHours instanceof Array
                  ? `${this.config.timeframeHours[0]}h`
                  : `${this.config.timeframeHours}h`;
              const filepath = path.join(dataDir, timeframe, `${symbol.replace('/', '_')}.json`);

              // ファイルが存在するか確認
              if (fs.existsSync(filepath)) {
                // データを読み込む（最大100件）
                const rawData = fs.readFileSync(filepath, 'utf-8');
                const allCandles = JSON.parse(rawData);
                // 最新の100件のみ使用
                return allCandles.slice(-100);
              }
              return [];
            } catch (error) {
              logger.error(
                `[MultiSymbolBacktestRunner] ${symbol}のキャンドルデータロードエラー: ${error instanceof Error ? error.message : String(error)}`
              );
              return [];
            }
          };

          // 各シンボルのキャンドルデータを非同期でロード
          const symbolCandlesPromises = symbols.map(async (symbol) => {
            const candles = await getInitialCandlesForSymbol(symbol);
            return { symbol, candles };
          });

          const symbolCandlesResults = await Promise.all(symbolCandlesPromises);

          // キャンドルデータをマップに変換
          const symbolCandles: Record<string, any[]> = {};
          symbolCandlesResults.forEach(({ symbol, candles }) => {
            symbolCandles[symbol] = candles;
          });

          // 十分なデータがあるかチェック
          const hasEnoughData = Object.values(symbolCandles).every(
            (candles) => candles.length >= 30
          );

          if (hasEnoughData) {
            // ボラティリティベースの配分を計算
            this.allocationWeights = volBasedAllocationWeights(symbolCandles);

            if (!this.config.quiet) {
              logger.info(
                `[MultiSymbolBacktestRunner] ボラティリティベースの資金配分を計算しました`
              );
            }
          } else {
            // データ不足時は均等配分
            symbols.forEach((symbol) => {
              this.allocationWeights[symbol] = 1 / symbols.length;
            });
            if (!this.config.quiet) {
              logger.warn(
                `[MultiSymbolBacktestRunner] 十分なキャンドルデータがないため均等配分を使用します`
              );
            }
          }
        } catch (error) {
          // エラー時は均等配分
          symbols.forEach((symbol) => {
            this.allocationWeights[symbol] = 1 / symbols.length;
          });
          if (!this.config.quiet) {
            logger.error(
              `[MultiSymbolBacktestRunner] ボラティリティ配分計算エラー: ${error instanceof Error ? error.message : String(error)}`
            );
            logger.warn(`[MultiSymbolBacktestRunner] エラーのため均等配分を使用します`);
          }
        }
        break;

      case AllocationStrategy.MARKET_CAP:
        // 実装時は時価総額データを使用
        // 現時点では簡易的に均等配分
        symbols.forEach((symbol) => {
          this.allocationWeights[symbol] = 1 / symbols.length;
        });
        if (!this.config.quiet) {
          logger.warn(`[MultiSymbolBacktestRunner] 時価総額配分は未実装のため均等配分を使用します`);
        }
        break;

      default:
        // デフォルトは均等配分
        symbols.forEach((symbol) => {
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
    this.config.symbols.forEach((symbol) => {
      // シンボル固有の設定とグローバル設定をマージ
      const symbolSpecificConfig = this.config.symbolParams?.[symbol] || {};

      // 初期残高を配分比率に応じて設定
      const allocation = this.allocationWeights[symbol];
      const symbolInitialBalance = this.config.initialBalance * allocation;

      const backtestConfig: BacktestConfig = {
        symbol,
        timeframeHours:
          this.config.timeframeHours instanceof Array
            ? this.config.timeframeHours[0]
            : this.config.timeframeHours,
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
    // 初期化を実行
    await this.initialize();
    
    // 処理時間計測開始
    const startTime = Date.now();

    if (!this.config.quiet) {
      logger.info(`
=== マルチシンボルバックテスト開始 ===
シンボル: ${this.config.symbols.join(', ')}
期間: ${this.config.startDate} ～ ${this.config.endDate}
初期資金: ${this.config.initialBalance}
配分戦略: ${this.config.allocationStrategy || AllocationStrategy.EQUAL}
並列数: ${this.parallelLimit}
      `);
    }

    try {
      // 各シンボルのバックテスト結果を格納するオブジェクト
      const symbolResults: Record<string, ExtendedBacktestResult> = {};
      let totalEquity = 0;
      const allEquityPoints = new Map<number, Record<string, number>>();

      // 一定数の並列処理に制限するためのリミッター
      const limit = pLimit(this.parallelLimit);

      // メモリ使用状況のベースライン計測
      const baselineMemory = process.memoryUsage();

      // 各シンボルのバックテストを並列実行
      const tasks = Array.from(this.symbolRunners.entries()).map(([symbol, runner]) =>
        limit(async () => {
          if (!this.config.quiet) {
            logger.info(`[MultiSymbolBacktestRunner] ${symbol}のバックテスト開始`);
          }

          // シンボルごとの開始時間
          const symbolStartTime = Date.now();

          // バックテスト実行
          const originalResult = await runner.run();
          
          // 拡張結果に変換
          // 各シンボルの初期残高を計算（allocationWeightsから取得）
          const symbolInitialBalance = this.config.initialBalance * this.allocationWeights[symbol];
          const result = toExtendedBacktestResult(originalResult, symbolInitialBalance);

          // シンボルごとの実行時間
          const symbolDuration = Date.now() - symbolStartTime;

          if (!this.config.quiet) {
            logger.info(
              `[MultiSymbolBacktestRunner] ${symbol}のバックテスト完了 (所要時間: ${(symbolDuration / 1000).toFixed(2)}秒)`
            );
          }

          return { symbol, result };
        })
      );

      // すべてのバックテストタスクを並列実行し完了を待機
      const results = await Promise.all(tasks);

      // 結果をマップに格納
      for (const { symbol, result } of results) {
        symbolResults[symbol] = result;
        totalEquity += result.equity[result.equity.length - 1]?.equity || 0;

        // エクイティポイントをマージ
        for (const equityPoint of result.equity) {
          const timestamp = normalizeTimestamp(equityPoint.timestamp);
          if (!allEquityPoints.has(timestamp)) {
            allEquityPoints.set(timestamp, {});
          }
          const point = allEquityPoints.get(timestamp)!;
          point[symbol] = equityPoint.equity;
        }
      }

      // 各シンボルの結果から統計を計算
      const totalTrades = Object.values(symbolResults).reduce(
        (sum, result) => sum + result.trades.length,
        0
      );
      const totalWinningTrades = Object.values(symbolResults).reduce(
        (sum, result) => sum + result.metrics.winningTrades,
        0
      );
      const totalLosingTrades = Object.values(symbolResults).reduce(
        (sum, result) => sum + result.metrics.losingTrades,
        0
      );

      // パフォーマンス指標を計算
      const performanceMetrics = this.calculateCombinedMetrics(symbolResults);

      // 処理時間計測終了
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // メモリ使用量計測
      const finalMemory = process.memoryUsage();
      const memoryDelta = {
        rss: finalMemory.rss - baselineMemory.rss,
        heapTotal: finalMemory.heapTotal - baselineMemory.heapTotal,
        heapUsed: finalMemory.heapUsed - baselineMemory.heapUsed,
        external: finalMemory.external - baselineMemory.external
      };

      // メモリモニタからピーク使用量を取得
      const memoryPeaks = this.memoryMonitor?.getMemoryPeaks() || {
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0
      };

      if (!this.config.quiet) {
        // 結果サマリーの表示
        logger.info(`
=== マルチシンボルバックテスト結果 ===
合計取引数: ${totalTrades}
勝率: ${totalWinningTrades}勝 ${totalLosingTrades}敗 (${((totalWinningTrades / totalTrades) * 100).toFixed(2)}%)
最終評価額: ${totalEquity.toFixed(2)}
シンボル数: ${this.config.symbols.length}
所要時間: ${(totalDuration / 1000).toFixed(2)}秒
シンボルあたり平均時間: ${(totalDuration / 1000 / this.config.symbols.length).toFixed(2)}秒
並列実行数: ${this.parallelLimit}

メモリ使用状況:
・現在の増加量: ${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)} MB
・ピーク使用量: ${(memoryPeaks.heapUsed / 1024 / 1024).toFixed(2)} MB
        `);
      }

      // 相関分析を行う場合
      if (this.config.correlationAnalysis) {
        const correlationMatrix = this.calculateCorrelationMatrix(symbolResults);
        if (!this.config.quiet) {
          logger.info('\n=== シンボル間のリターン相関行列 ===');
          this.printCorrelationMatrix(correlationMatrix);
        }
      }

      // 結果をファイルに保存
      if (this.config.saveResults) {
        await this.saveResultsToFile(symbolResults, performanceMetrics, {
          totalDuration,
          memoryPeaks,
          memoryDelta,
          correlationMatrix: this.config.correlationAnalysis
            ? this.calculateCorrelationMatrix(symbolResults)
            : undefined
        });
      }

      return {
        symbolResults,
        combinedMetrics: performanceMetrics,
        allEquityPoints: Array.from(allEquityPoints.entries()).map(([timestamp, points]) => ({
          timestamp,
          bySymbol: points,
          total: Object.values(points).reduce((sum, value) => sum + value, 0)
        })),
        totalEquity,
        executionStats: {
          totalDuration,
          memoryPeaks,
          memoryDelta,
          correlationMatrix: this.config.correlationAnalysis
            ? this.calculateCorrelationMatrix(symbolResults)
            : undefined
        }
      };
    } catch (error) {
      logger.error(
        `[MultiSymbolBacktestRunner] エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    } finally {
      // メモリモニタリングを停止
      if (this.memoryMonitor) {
        this.memoryMonitor.stopMonitoring();
      }
    }
  }

  /**
   * バックテスト結果をファイルに保存
   */
  private async saveResultsToFile(
    symbolResults: Record<string, ExtendedBacktestResult>,
    combinedMetrics: any,
    executionStats: any
  ): Promise<void> {
    try {
      // 結果を保存するディレクトリを作成
      const resultsDir = path.resolve(process.cwd(), 'data/optimization');
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }

      // タイムスタンプを含むファイル名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const configName = this.config.name || 'multi_symbol';
      const fileName = `${configName}_${timestamp}.json`;
      const filePath = path.join(resultsDir, fileName);

      // 保存するデータ
      const saveData = {
        config: this.config,
        symbolResults,
        combinedMetrics,
        executionStats,
        timestamp: Date.now()
      };

      // ファイルに書き込み
      fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2));

      if (!this.config.quiet) {
        logger.info(`[MultiSymbolBacktestRunner] 結果を保存しました: ${filePath}`);
      }
    } catch (error) {
      logger.error(
        `[MultiSymbolBacktestRunner] 結果の保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 複数シンボルのパフォーマンス指標を結合計算
   */
  private calculateCombinedMetrics(symbolResults: Record<string, ExtendedBacktestResult>): any {
    // 各シンボルのメトリクスを集計
    const totalTrades = Object.values(symbolResults).reduce(
      (sum, result) => sum + result.trades.length,
      0
    );
    const winningTrades = Object.values(symbolResults).reduce(
      (sum, result) => sum + result.metrics.winningTrades,
      0
    );
    const losingTrades = Object.values(symbolResults).reduce(
      (sum, result) => sum + result.metrics.losingTrades,
      0
    );

    // 加重平均の計算
    const totalInitialBalance = Object.values(symbolResults).reduce(
      (sum, result) => sum + result.initialBalance,
      0
    );

    // 加重平均最大ドローダウン
    const weightedMaxDrawdown = Object.values(symbolResults).reduce((sum, result) => {
      const weight = result.initialBalance / totalInitialBalance;
      return sum + result.metrics.maxDrawdown * weight;
    }, 0);

    // 加重平均シャープレシオ
    const weightedSharpeRatio = Object.values(symbolResults).reduce((sum, result) => {
      const weight = result.initialBalance / totalInitialBalance;
      return sum + result.metrics.sharpeRatio * weight;
    }, 0);

    // トータルリターン
    const initialTotal = Object.values(symbolResults).reduce(
      (sum, result) => sum + result.initialBalance,
      0
    );
    const finalTotal = Object.values(symbolResults).reduce(
      (sum, result) => sum + result.equity[result.equity.length - 1]?.equity || 0,
      0
    );
    const totalReturn = (finalTotal - initialTotal) / initialTotal;

    // 全シンボルの合計利益
    const totalProfit = finalTotal - initialTotal;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: totalTrades > 0 ? winningTrades / totalTrades : 0,
      maxDrawdown: weightedMaxDrawdown,
      sharpeRatio: weightedSharpeRatio,
      totalReturn,
      totalProfit,
      initialTotal,
      finalTotal
    };
  }

  /**
   * シンボル間のリターン相関行列を計算
   */
  private calculateCorrelationMatrix(
    symbolResults: Record<string, ExtendedBacktestResult>
  ): Record<string, Record<string, number>> {
    const symbols = Object.keys(symbolResults);
    const correlationMatrix: Record<string, Record<string, number>> = {};

    // 各シンボルごとに相関係数を計算
    for (const symbol1 of symbols) {
      correlationMatrix[symbol1] = {};

      for (const symbol2 of symbols) {
        if (symbol1 === symbol2) {
          correlationMatrix[symbol1][symbol2] = 1.0; // 自己相関は1
          continue;
        }

        // 2つのシンボルのエクイティ履歴からリターン系列を計算
        const returnsA = this.calculateReturns(symbolResults[symbol1].equityHistory);
        const returnsB = this.calculateReturns(symbolResults[symbol2].equityHistory);

        // リターン同士の相関係数を計算
        correlationMatrix[symbol1][symbol2] = this.calculatePearsonCorrelation(returnsA, returnsB);
      }
    }

    return correlationMatrix;
  }

  /**
   * リターン配列を計算
   */
  private calculateReturns(
    equityHistory: number[] | { timestamp: number | string; equity: number }[]
  ): number[] {
    // 入力がnumber[]の場合と、オブジェクト配列の場合で処理を分ける
    const equityValues = Array.isArray(equityHistory) && typeof equityHistory[0] === 'number'
      ? equityHistory as number[]
      : (equityHistory as { timestamp: number | string; equity: number }[]).map(point => point.equity);
    
    // リターン計算 (日次変化率)
    const returns: number[] = [];
    for (let i = 1; i < equityValues.length; i++) {
      const dailyReturn = (equityValues[i] - equityValues[i - 1]) / equityValues[i - 1];
      returns.push(dailyReturn);
    }
    return returns;
  }

  /**
   * ピアソン相関係数を計算
   * @param x 配列1
   * @param y 配列2
   * @returns 相関係数 (-1.0 から 1.0)
   */
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    // データ長が異なる場合は短い方に合わせる
    const n = Math.min(x.length, y.length);
    if (n <= 1) return 0; // 相関計算に十分なデータがない

    // 平均を計算
    const xMean = x.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.slice(0, n).reduce((sum, val) => sum + val, 0) / n;

    // 共分散と標準偏差を計算
    let covariance = 0;
    let xVariance = 0;
    let yVariance = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      covariance += xDiff * yDiff;
      xVariance += xDiff * xDiff;
      yVariance += yDiff * yDiff;
    }

    // 分母がゼロに近い場合は相関なしとみなす
    if (xVariance < 1e-10 || yVariance < 1e-10) return 0;

    // 相関係数を計算して返す
    return covariance / (Math.sqrt(xVariance) * Math.sqrt(yVariance));
  }

  /**
   * 相関行列を出力
   */
  private printCorrelationMatrix(matrix: Record<string, Record<string, number>>): void {
    const symbols = Object.keys(matrix);

    // ヘッダー行
    let header = '        '; // 左上の空白
    symbols.forEach((symbol) => {
      header += symbol.padEnd(10);
    });
    logger.info(header);

    // データ行
    symbols.forEach((symbol1) => {
      let row = symbol1.padEnd(8);

      symbols.forEach((symbol2) => {
        const correlation = matrix[symbol1][symbol2];
        // 小数点2桁までフォーマットして、10文字の幅に収める
        row += correlation.toFixed(2).padEnd(10);
      });

      logger.info(row);
    });
  }

  /**
   * CLI引数からマルチシンボルバックテストを実行
   */
  static async runFromCli(): Promise<void> {
    const args = process.argv.slice(2);

    // デフォルト設定
    let symbols: string[] = ['SOL/USDT'];
    let timeframeHours: number | number[] = 4;
    let startDate = '2023-01-01';
    let endDate = '2023-12-31';
    let initialBalance = 10000;
    let allocationStrategy: AllocationStrategy = AllocationStrategy.EQUAL;
    let slippage = 0.001;
    let commissionRate = 0.001;
    let quiet = false;
    let batchSize = 5000;
    let gcInterval = 10;
    let memoryMonitoring = false;
    let correlationAnalysis = false;
    let configFile = '';
    let parallelLimit = 4; // デフォルトの並列処理数
    let saveResults = false;

    // 引数の解析
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--symbols' && i + 1 < args.length) {
        symbols = args[++i].split(',');
      } else if (arg === '--timeframe' && i + 1 < args.length) {
        const timeframes = args[++i].split(',');
        if (timeframes.length === 1) {
          timeframeHours = parseFloat(timeframes[0]);
        } else {
          timeframeHours = timeframes.map((tf) => parseFloat(tf));
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
      } else if (arg === '--parallel' && i + 1 < args.length) {
        parallelLimit = parseInt(args[++i], 10);
      } else if (arg === '--save-results') {
        saveResults = true;
      }
    }

    // 設定を作成
    let config: MultiSymbolBacktestConfig = {
      symbols,
      timeframeHours,
      startDate,
      endDate,
      initialBalance,
      allocationStrategy,
      slippage,
      commissionRate,
      batchSize,
      gcInterval,
      memoryMonitoring,
      correlationAnalysis,
      parallelLimit,
      saveResults,
      quiet
    };

    // 設定ファイルがある場合は読み込み
    if (configFile) {
      try {
        const configData = fs.readFileSync(configFile, 'utf8');
        const fileConfig = JSON.parse(configData);
        // ファイル設定とコマンドライン設定をマージ
        config = { ...config, ...fileConfig };
      } catch (error) {
        logger.error(
          `設定ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // パラメータサービスからパラメータを取得
    const parameters = parameterService.getAllParameters();
    config.parameters = parameters;

    // マルチシンボルバックテストを実行
    const runner = new MultiSymbolBacktestRunner(config);
    await runner.run();
  }
}

// CommonJS エクスポート
module.exports = { MultiSymbolBacktestRunner };

// TypeScript用のESモジュールエクスポート（互換性のため）
export { MultiSymbolBacktestRunner };
