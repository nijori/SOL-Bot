/**
 * マルチシンボルトレーディングエンジン
 * 複数通貨ペアを同時に取引するエンジン
 *
 * CORE-005: backtestRunnerとtradingEngineのマルチシンボル対応拡張
 */

import { TradingEngine, TradingEngineOptions } from './tradingEngine.js';
import {
  MultiSymbolEngineConfig,
  AllocationStrategy,
  PortfolioRiskAnalysis
} from '../types/multiSymbolTypes.js';
import { Candle, Position, Order, OrderSide, OrderType, SystemMode, RiskLevel } from './types.js';
import logger from '../utils/logger.js';
import { OrderManagementSystem } from './orderManagementSystem.js';
import { UnifiedOrderManager } from '../services/UnifiedOrderManager.js';
import { ExchangeService } from '../services/exchangeService.js';
import { OrderSizingService } from '../services/orderSizingService.js';
import { calculatePearsonCorrelation } from '../utils/mathUtils.js';
import { volBasedAllocationWeights } from '../indicators/marketState.js';

/**
 * マルチシンボルトレーディングエンジン
 */
export class MultiSymbolTradingEngine {
  private engines: Map<string, TradingEngine> = new Map();
  private config: MultiSymbolEngineConfig;
  private allocationWeights: Record<string, number> = {};
  private portfolioEquity: number = 0;
  private symbolsPnL: Record<string, number> = {};
  private symbolsPositions: Record<string, Position[]> = {};
  private correlationMatrix: Record<string, Record<string, number>> = {};
  private lastCorrelationUpdate: number = 0;
  private correlationUpdateInterval: number = 24 * 60 * 60 * 1000; // 24時間ごとに更新
  private unifiedOrderManager: UnifiedOrderManager | null = null;
  private isBacktest: boolean = false;
  private quietMode: boolean = false;
  private systemMode: SystemMode = SystemMode.NORMAL;
  private previousCandles: Record<string, Candle[]> = {};
  private equityHistory: { timestamp: number; total: number; bySymbol: Record<string, number> }[] =
    [];

  /**
   * コンストラクタ
   * @param config マルチシンボルエンジン設定
   * @param options 共通オプション
   */
  constructor(
    config: MultiSymbolEngineConfig,
    options: {
      isBacktest?: boolean;
      unifiedOrderManager?: UnifiedOrderManager;
      quiet?: boolean;
    } = {}
  ) {
    this.config = config;
    this.isBacktest = options.isBacktest || false;
    this.quietMode = options.quiet || false;
    this.unifiedOrderManager = options.unifiedOrderManager || null;

    // 資金配分比率を計算
    this.calculateAllocationWeights();

    // エンジンの初期化
    this.initializeEngines();

    if (!this.quietMode) {
      logger.info(
        `[MultiSymbolTradingEngine] ${config.symbols.length}個のシンボルで初期化しました`
      );
      logger.info(
        `[MultiSymbolTradingEngine] 資金配分戦略: ${config.allocationStrategy || AllocationStrategy.EQUAL}`
      );
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
        symbols.forEach((symbol) => {
          this.allocationWeights[symbol] = equalWeight;
        });
        break;

      case AllocationStrategy.CUSTOM:
        // カスタム配分（symbolParamsから取得）
        const customWeights: Record<string, number> = {};
        let totalWeight = 0;

        symbols.forEach((symbol) => {
          const weight = (this.config.symbolParams?.[symbol] as any)?.weight || 1;
          customWeights[symbol] = weight;
          totalWeight += weight;
        });

        // 合計が1になるように正規化
        symbols.forEach((symbol) => {
          this.allocationWeights[symbol] = customWeights[symbol] / totalWeight;
        });
        break;

      case AllocationStrategy.VOLATILITY:
        // ATRなどのボラティリティ指標を使用して逆比例配分
        if (this.previousCandles && Object.keys(this.previousCandles).length > 0) {
          try {
            // 十分なデータがある場合はボラティリティベースの配分を計算
            this.allocationWeights = volBasedAllocationWeights(this.previousCandles);
          } catch (error) {
            // エラー時は均等配分にフォールバック
            symbols.forEach((symbol) => {
              this.allocationWeights[symbol] = 1 / symbols.length;
            });
            if (!this.quietMode) {
              logger.error(
                `[MultiSymbolTradingEngine] ボラティリティ配分計算エラー: ${error instanceof Error ? error.message : String(error)}`
              );
              logger.warn(
                `[MultiSymbolTradingEngine] ボラティリティ配分計算に失敗したため均等配分を使用します`
              );
            }
          }
        } else {
          // データ不足の場合は均等配分を使用
          symbols.forEach((symbol) => {
            this.allocationWeights[symbol] = 1 / symbols.length;
          });
          if (!this.quietMode) {
            logger.warn(
              `[MultiSymbolTradingEngine] キャンドルデータ不足のため均等配分を使用します`
            );
          }
        }
        break;

      case AllocationStrategy.MARKET_CAP:
        // 実装時は時価総額データを使用
        // 現時点では簡易的に均等配分
        symbols.forEach((symbol) => {
          this.allocationWeights[symbol] = 1 / symbols.length;
        });
        if (!this.quietMode) {
          logger.warn(`[MultiSymbolTradingEngine] 時価総額配分は未実装のため均等配分を使用します`);
        }
        break;

      default:
        // デフォルトは均等配分
        symbols.forEach((symbol) => {
          this.allocationWeights[symbol] = 1 / symbols.length;
        });
    }

    if (!this.quietMode) {
      logger.info(`[MultiSymbolTradingEngine] 資金配分比率:`);
      Object.entries(this.allocationWeights).forEach(([symbol, weight]) => {
        logger.info(`  ${symbol}: ${(weight * 100).toFixed(2)}%`);
      });
    }
  }

  /**
   * 各シンボル用のトレーディングエンジンを初期化
   */
  private initializeEngines(): void {
    // UnifiedOrderManagerが指定されていない場合は作成
    if (!this.unifiedOrderManager && !this.isBacktest) {
      this.unifiedOrderManager = new UnifiedOrderManager();

      // 各シンボル用のExchangeServiceを作成して登録
      this.config.symbols.forEach((symbol, index) => {
        const exchangeService = new ExchangeService();
        // 実際の実装では取引所との接続設定を行う
        this.unifiedOrderManager?.addExchange(symbol, exchangeService, index + 1);
      });
    }

    // シンボルごとのトレーディングエンジンを作成
    this.config.symbols.forEach((symbol) => {
      // シンボル固有のパラメータ設定
      const symbolParams = this.config.symbolParams?.[symbol] || {};

      // バックテストの場合は残高を配分比率に合わせて調整
      const initialBalance = this.isBacktest
        ? (symbolParams.initialBalance || 10000) * this.allocationWeights[symbol]
        : symbolParams.initialBalance || 10000;

      // 各シンボル用のOrderManagementSystemを作成
      const oms = new OrderManagementSystem();

      // トレーディングエンジンのオプション
      const engineOptions: TradingEngineOptions = {
        symbol: symbol,
        timeframeHours: Array.isArray(this.config.timeframeHours)
          ? this.config.timeframeHours[0]
          : this.config.timeframeHours,
        initialBalance: initialBalance,
        isBacktest: this.isBacktest,
        oms: oms,
        slippage: symbolParams.slippage,
        commissionRate: symbolParams.commissionRate,
        isSmokeTest: symbolParams.isSmokeTest,
        quiet: true, // 個別ログは抑制（全体ログのみ表示）
        exchangeService: new ExchangeService(), // 実際の実装では適切なExchangeServiceを設定
        orderSizingService: new OrderSizingService() // 実際の実装では適切なOrderSizingServiceを設定
      };

      // エンジンを作成して保存
      const engine = new TradingEngine(engineOptions);
      this.engines.set(symbol, engine);

      // シンボルごとの初期データを設定
      this.symbolsPnL[symbol] = 0;
      this.symbolsPositions[symbol] = [];
      this.previousCandles[symbol] = [];

      if (!this.quietMode) {
        logger.debug(`[MultiSymbolTradingEngine] ${symbol}のエンジンを初期化しました`);
      }
    });
  }

  /**
   * キャンドルデータでエンジンを更新
   * @param candles シンボルごとのキャンドルデータ
   */
  public async update(candles: Record<string, Candle>): Promise<void> {
    // メインのタイムスタンプを取得（最初のキャンドルから）
    const timestamp = Object.values(candles)[0]?.timestamp || Date.now();

    // 各シンボルのエンジンを更新
    const updatePromises: Promise<void>[] = [];
    const signalsBySymbol: Record<string, Order[]> = {};

    // エンジン更新とシグナル取得
    for (const [symbol, engine] of this.engines.entries()) {
      const candle = candles[symbol];
      if (!candle) continue;

      // キャンドル履歴を更新
      if (!this.previousCandles[symbol]) {
        this.previousCandles[symbol] = [];
      }
      this.previousCandles[symbol].push(candle);
      if (this.previousCandles[symbol].length > 100) {
        this.previousCandles[symbol].shift(); // 最大100個まで保持
      }

      // エンジンを更新
      const updatePromise = engine.update(candle).then(() => {
        // 最新ポジション情報を取得
        this.symbolsPositions[symbol] = engine.getPositions();

        // シグナルを収集
        const signals = engine.getRecentSignals?.() || [];
        if (signals.length > 0) {
          signalsBySymbol[symbol] = signals;
        }
      });

      updatePromises.push(updatePromise);
    }

    // すべてのエンジン更新を待機
    await Promise.all(updatePromises);

    // ポートフォリオリスク分析を実行
    const riskAnalysis = this.analyzePortfolioRisk();

    // リスク分析に基づいてシグナルをフィルタリング
    const filteredSignals = this.filterSignalsByRisk(signalsBySymbol, riskAnalysis);

    // フィルタリングされたシグナルを処理
    for (const [symbol, signals] of Object.entries(filteredSignals)) {
      if (signals.length > 0) {
        if (!this.quietMode) {
          logger.info(`[MultiSymbolTradingEngine] ${symbol}のシグナルを処理: ${signals.length}件`);
        }

        if (this.isBacktest) {
          // バックテストモードでは各エンジンで個別に処理
          const engine = this.engines.get(symbol);
          if (engine) {
            engine['processSignals'](signals); // privateメソッドにアクセス
          }
        } else {
          // 実トレードモードではUnifiedOrderManagerを使用
          if (this.unifiedOrderManager) {
            for (const signal of signals) {
              this.unifiedOrderManager.createOrder(signal);
            }
          }
        }
      }
    }

    // エクイティ情報を更新
    this.updateEquityHistory(timestamp);

    // 定期的に相関行列を更新
    if (Date.now() - this.lastCorrelationUpdate > this.correlationUpdateInterval) {
      this.updateCorrelationMatrix();
      this.lastCorrelationUpdate = Date.now();
    }
  }

  /**
   * ポートフォリオのリスク分析を実行
   */
  private analyzePortfolioRisk(): PortfolioRiskAnalysis {
    // 各シンボルのポジションと価値を取得
    const positionsBySymbol: Record<string, { long: number; short: number; value: number }> = {};
    let totalPositionValue = 0;
    let maxPositionRatio = 0;

    // ポジション集計
    for (const [symbol, positions] of Object.entries(this.symbolsPositions)) {
      positionsBySymbol[symbol] = { long: 0, short: 0, value: 0 };

      for (const position of positions) {
        if (position.side === OrderSide.BUY) {
          positionsBySymbol[symbol].long += position.amount * position.currentPrice;
        } else {
          positionsBySymbol[symbol].short += position.amount * position.currentPrice;
        }
      }

      // 純ポジション価値を計算
      positionsBySymbol[symbol].value =
        positionsBySymbol[symbol].long - positionsBySymbol[symbol].short;

      // 合計ポジション価値を更新
      totalPositionValue += Math.abs(positionsBySymbol[symbol].value);

      // 最大ポジション比率を更新
      const positionRatio = Math.abs(positionsBySymbol[symbol].value) / this.portfolioEquity;
      if (positionRatio > maxPositionRatio) {
        maxPositionRatio = positionRatio;
      }
    }

    // 集中リスクを計算（ハーフィンダール指数を使用）
    let concentrationRisk = 0;
    if (totalPositionValue > 0) {
      for (const symbol of Object.keys(positionsBySymbol)) {
        const ratio = Math.abs(positionsBySymbol[symbol].value) / totalPositionValue;
        concentrationRisk += ratio * ratio; // 各シンボルの二乗を加算
      }
    }

    // 相関リスクを計算（平均相関係数）
    let correlationRisk = 0;
    let correlationCount = 0;

    const symbols = Object.keys(this.correlationMatrix);
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const symA = symbols[i];
        const symB = symbols[j];

        if (this.correlationMatrix[symA] && this.correlationMatrix[symA][symB] !== undefined) {
          // 正の相関のみをリスクとして考慮
          const corrValue = Math.max(0, this.correlationMatrix[symA][symB]);
          correlationRisk += corrValue;
          correlationCount++;
        }
      }
    }

    if (correlationCount > 0) {
      correlationRisk /= correlationCount; // 平均相関係数
    }

    // バリューアットリスク（VaR）計算の簡易版
    // 実際の実装ではヒストリカルVaRやモンテカルロVaRなどの手法を使用
    const valueAtRisk = totalPositionValue * 0.02; // 簡易的に2%をVaRとする

    // 期待ショートフォール（ES）計算の簡易版
    const expectedShortfall = valueAtRisk * 1.5; // 簡易的にVaRの1.5倍をESとする

    // ストレステスト（簡易版）
    const stressTestResults = [
      {
        scenario: 'マーケット全体5%下落',
        impact: -totalPositionValue * 0.05
      },
      {
        scenario: '最大ポジションシンボル10%下落',
        impact: -maxPositionRatio * this.portfolioEquity * 0.1
      },
      {
        scenario: '流動性枯渇（スリッページ3倍）',
        impact: -totalPositionValue * 0.01 // 1%のコスト増加と仮定
      }
    ];

    return {
      valueAtRisk,
      expectedShortfall,
      concentrationRisk,
      correlationRisk,
      stressTestResults
    };
  }

  /**
   * リスク分析に基づいてシグナルをフィルタリング
   */
  private filterSignalsByRisk(
    signalsBySymbol: Record<string, Order[]>,
    riskAnalysis: PortfolioRiskAnalysis
  ): Record<string, Order[]> {
    const filteredSignals: Record<string, Order[]> = {};
    const portfolioRiskLimit = this.config.portfolioRiskLimit || 0.2; // デフォルト20%

    // シグナルをフィルタリング
    for (const [symbol, signals] of Object.entries(signalsBySymbol)) {
      const filteredSymbolSignals: Order[] = [];

      for (const signal of signals) {
        // 各シグナルのリスク評価
        const signalValue = this.estimateSignalValue(signal);
        const currentSymbolRisk = this.getCurrentSymbolRisk(symbol);

        // リスク許容範囲内かチェック
        if (currentSymbolRisk + signalValue / this.portfolioEquity <= portfolioRiskLimit) {
          filteredSymbolSignals.push(signal);
        } else {
          if (!this.quietMode) {
            logger.warn(
              `[MultiSymbolTradingEngine] リスク超過のためシグナルをスキップ: ${symbol} ${signal.side} ${signal.amount}`
            );
          }
        }
      }

      if (filteredSymbolSignals.length > 0) {
        filteredSignals[symbol] = filteredSymbolSignals;
      }
    }

    // 相関リスクチェック
    if (this.config.correlationLimit && this.config.correlationLimit > 0) {
      // 高相関シンボルの同時ポジション制限
      const symbolPairs = this.getHighlyCorrelatedPairs(this.config.correlationLimit);

      for (const [symA, symB] of symbolPairs) {
        // 両方のシンボルに新規シグナルがある場合
        if (filteredSignals[symA] && filteredSignals[symB]) {
          // 同方向のシグナルか確認
          const signalsA = filteredSignals[symA];
          const signalsB = filteredSignals[symB];

          if (this.areSameDirectionSignals(signalsA, signalsB)) {
            // 相関リスクが高い場合は片方のシグナルのみ保持
            // 簡易的な実装では配分ウェイトが高い方を優先
            if (this.allocationWeights[symA] >= this.allocationWeights[symB]) {
              delete filteredSignals[symB];
              if (!this.quietMode) {
                logger.warn(
                  `[MultiSymbolTradingEngine] 相関リスク回避のため ${symB} のシグナルをスキップ (${symA}と高相関)`
                );
              }
            } else {
              delete filteredSignals[symA];
              if (!this.quietMode) {
                logger.warn(
                  `[MultiSymbolTradingEngine] 相関リスク回避のため ${symA} のシグナルをスキップ (${symB}と高相関)`
                );
              }
            }
          }
        }
      }
    }

    return filteredSignals;
  }

  /**
   * シグナルの予想価値を見積もる
   */
  private estimateSignalValue(signal: Order): number {
    // 簡易的な実装: 注文金額（量 * 価格）を返す
    const engine = this.engines.get(signal.symbol);
    if (!engine) return 0;

    const currentPrice = engine.getCurrentPrice?.() || 0;
    const price = signal.price || currentPrice;

    return signal.amount * price;
  }

  /**
   * 特定シンボルの現在のリスク比率を取得
   */
  private getCurrentSymbolRisk(symbol: string): number {
    // 簡易的な実装: 現在のポジション価値 / ポートフォリオ資産
    const positions = this.symbolsPositions[symbol] || [];
    let positionValue = 0;

    for (const position of positions) {
      positionValue += position.amount * position.currentPrice;
    }

    return this.portfolioEquity > 0 ? positionValue / this.portfolioEquity : 0;
  }

  /**
   * 高相関ペアのリストを取得
   */
  private getHighlyCorrelatedPairs(threshold: number): [string, string][] {
    const pairs: [string, string][] = [];
    const symbols = Object.keys(this.correlationMatrix);

    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const symA = symbols[i];
        const symB = symbols[j];

        if (
          this.correlationMatrix[symA] &&
          this.correlationMatrix[symA][symB] !== undefined &&
          this.correlationMatrix[symA][symB] > threshold
        ) {
          pairs.push([symA, symB]);
        }
      }
    }

    return pairs;
  }

  /**
   * 2つのシグナル配列が同方向かチェック
   */
  private areSameDirectionSignals(signalsA: Order[], signalsB: Order[]): boolean {
    // シグナル配列内での優勢な方向を判断
    const getNetDirection = (signals: Order[]): OrderSide | null => {
      let buyCount = 0;
      let sellCount = 0;

      for (const signal of signals) {
        if (signal.side === OrderSide.BUY) {
          buyCount++;
        } else {
          sellCount++;
        }
      }

      if (buyCount > sellCount) return OrderSide.BUY;
      if (sellCount > buyCount) return OrderSide.SELL;
      return null; // 同数の場合
    };

    const dirA = getNetDirection(signalsA);
    const dirB = getNetDirection(signalsB);

    return dirA !== null && dirA === dirB;
  }

  /**
   * 相関行列を更新
   */
  private updateCorrelationMatrix(): void {
    const symbols = this.config.symbols;
    const returns: Record<string, number[]> = {};

    // 各シンボルのリターン系列を計算
    for (const symbol of symbols) {
      const candles = this.previousCandles[symbol] || [];
      returns[symbol] = [];

      if (candles.length > 1) {
        for (let i = 1; i < candles.length; i++) {
          const prevClose = candles[i - 1].close;
          const currClose = candles[i].close;
          returns[symbol].push(currClose / prevClose - 1);
        }
      }
    }

    // 相関係数を計算
    for (let i = 0; i < symbols.length; i++) {
      const symA = symbols[i];

      if (!this.correlationMatrix[symA]) {
        this.correlationMatrix[symA] = {};
      }

      // 自己相関は1.0
      this.correlationMatrix[symA][symA] = 1.0;

      for (let j = i + 1; j < symbols.length; j++) {
        const symB = symbols[j];

        if (!this.correlationMatrix[symB]) {
          this.correlationMatrix[symB] = {};
        }

        if (returns[symA].length >= 10 && returns[symB].length >= 10) {
          // 最小10データポイントあれば相関係数を計算
          const correlation = calculatePearsonCorrelation(
            returns[symA].slice(0, Math.min(returns[symA].length, returns[symB].length)),
            returns[symB].slice(0, Math.min(returns[symA].length, returns[symB].length))
          );

          // 相互に登録
          this.correlationMatrix[symA][symB] = correlation;
          this.correlationMatrix[symB][symA] = correlation;
        } else {
          // データ不足の場合はゼロ相関と仮定
          this.correlationMatrix[symA][symB] = 0;
          this.correlationMatrix[symB][symA] = 0;
        }
      }
    }

    if (!this.quietMode) {
      logger.debug(`[MultiSymbolTradingEngine] 相関行列を更新しました`);
    }
  }

  /**
   * エクイティ履歴を更新
   */
  private updateEquityHistory(timestamp: number): void {
    const symbolEquity: Record<string, number> = {};
    let totalEquity = 0;

    // 各シンボルのエクイティを計算
    for (const [symbol, engine] of this.engines.entries()) {
      const equity = engine.getEquity?.() || 0;
      symbolEquity[symbol] = equity;
      totalEquity += equity;
    }

    // ポートフォリオエクイティを更新
    this.portfolioEquity = totalEquity;

    // エクイティ履歴に追加
    this.equityHistory.push({
      timestamp,
      total: totalEquity,
      bySymbol: { ...symbolEquity }
    });

    // 履歴サイズを制限（最大1000ポイント）
    if (this.equityHistory.length > 1000) {
      this.equityHistory.shift();
    }
  }

  /**
   * 現在のポートフォリオエクイティを取得
   */
  public getPortfolioEquity(): number {
    return this.portfolioEquity;
  }

  /**
   * エクイティ履歴を取得
   */
  public getEquityHistory(): {
    timestamp: number;
    total: number;
    bySymbol: Record<string, number>;
  }[] {
    return this.equityHistory;
  }

  /**
   * 各シンボルのポジションを取得
   */
  public getAllPositions(): Record<string, Position[]> {
    return this.symbolsPositions;
  }

  /**
   * 特定シンボルのエンジンを取得
   */
  public getEngine(symbol: string): TradingEngine | undefined {
    return this.engines.get(symbol);
  }

  /**
   * 全体システムモードを取得
   */
  public getSystemMode(): SystemMode {
    return this.systemMode;
  }

  /**
   * 全体システムモードを設定
   */
  public setSystemMode(mode: SystemMode): void {
    this.systemMode = mode;

    // 各エンジンにシステムモードを伝播
    for (const engine of this.engines.values()) {
      if (engine['setSystemMode']) {
        // privateメソッドにアクセス
        engine['setSystemMode'](mode);
      }
    }

    if (!this.quietMode) {
      logger.info(`[MultiSymbolTradingEngine] システムモードを変更: ${mode}`);
    }
  }

  /**
   * 最近のポートフォリオリスク分析を取得
   */
  public getPortfolioRiskAnalysis(): PortfolioRiskAnalysis {
    return this.analyzePortfolioRisk();
  }

  /**
   * シンボル間の相関行列を取得
   */
  public getCorrelationMatrix(): Record<string, Record<string, number>> {
    return this.correlationMatrix;
  }
}
