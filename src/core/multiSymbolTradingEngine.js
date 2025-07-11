/**
 * マルチシンボルトレーディングエンジン
 * 複数通貨ペアを同時に取引するエンジン
 *
 * CORE-005: backtestRunnerとtradingEngineのマルチシンボル対応拡張
 */

// @ts-nocheck
// CommonJS移行中のため一時的にTypeScriptチェックを無効化

const { TradingEngine } = require('./tradingEngine');
const { UnifiedOrderManager } = require('../services/UnifiedOrderManager');
const { ExchangeService } = require('../services/exchangeService');
const { OrderSizingService } = require('../services/orderSizingService');
const { SymbolInfoService } = require('../services/symbolInfoService');
const logger = require('../utils/logger').default;
const { OrderManagementSystem } = require('./orderManagementSystem');
const { AllocationManager } = require('./AllocationManager');
const { PortfolioRiskAnalyzer } = require('./PortfolioRiskAnalyzer');
const { SystemMode } = require('../types/tradingEngineTypes.js');
const { OrderSide } = require('./types');

/**
 * ピアソン相関係数を計算
 * @param {number[]} x 第1データ系列
 * @param {number[]} y 第2データ系列
 * @returns {number} 相関係数 (-1 to 1)
 */
function calculatePearsonCorrelation(x, y) {
  if (x.length !== y.length || x.length === 0) {
    return 0;
  }

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

/**
 * マルチシンボルトレーディングエンジン
 */
class MultiSymbolTradingEngine {
  /**
   * コンストラクタ
   * @param config マルチシンボルエンジン設定
   * @param options 共通オプション
   */
  constructor(
    config,
    options = {}
  ) {
    // プロパティ初期化
    this.engines = new Map();
    this.config = config;
    this.portfolioEquity = 0;
    this.symbolsPnL = {};
    this.symbolsPositions = {};
    this.unifiedOrderManager = options.unifiedOrderManager || null;
    this.isBacktest = options.isBacktest || false;
    this.quietMode = options.quiet || false;
    this.systemMode = SystemMode.NORMAL;
    this.previousCandles = {};
    this.equityHistory = [];

    // 分離したモジュールを初期化
    this.allocationManager = new AllocationManager(config, options);
    this.riskAnalyzer = new PortfolioRiskAnalyzer(options);
    
    // 相関行列を初期化
    this.correlationMatrix = {};

    // エンジンの初期化
    this.initializeEngines();

    if (!this.quietMode) {
      logger.info(
        `[MultiSymbolTradingEngine] ${config.symbols.length}個のシンボルで初期化しました`
      );
    }
  }

  /**
   * 資金配分比率を取得（AllocationManagerから）
   */
  getAllocationWeights() {
    return this.allocationManager.getAllocationWeights();
  }

  /**
   * 各シンボル用のトレーディングエンジンを初期化
   */
  initializeEngines() {
    // UnifiedOrderManagerが指定されていない場合は作成
    if (!this.unifiedOrderManager && !this.isBacktest) {
      this.unifiedOrderManager = new UnifiedOrderManager();

      // 各シンボル用のExchangeServiceを作成して登録
      this.config.symbols.forEach((symbol, index) => {
        const exchangeService = new ExchangeService();
        // 実際の実装では取引所との接続設定を行う
        if (this.unifiedOrderManager) {
          this.unifiedOrderManager.addExchange(symbol, exchangeService, index + 1);
        }
      });
    }

    // シンボルごとのトレーディングエンジンを作成
    this.config.symbols.forEach((symbol) => {
      // シンボル固有のパラメータ設定
      const symbolParams = (this.config.symbolParams && this.config.symbolParams[symbol]) || {};

      // バックテストの場合は残高を配分比率に合わせて調整
      const baseBalance = symbolParams.initialBalance || 10000;
      const initialBalance = this.isBacktest
        ? this.allocationManager.calculateInitialBalance(symbol, baseBalance)
        : baseBalance;

      // 各シンボル用のOrderManagementSystemを作成
      const oms = new OrderManagementSystem();

      // トレーディングエンジンのオプション
      const engineOptions = {
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
        orderSizingService: new OrderSizingService(new ExchangeService()) // ExchangeServiceを渡す
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
      async update(candles) {
    // メインのタイムスタンプを取得（最初のキャンドルから）
    const firstCandle = Object.values(candles)[0];
    const timestamp = (firstCandle && firstCandle.timestamp) || Date.now();

    // 各シンボルのエンジンを更新
    const updatePromises = [];
    const signalsBySymbol = {};

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
        const signals = (engine.getRecentSignals && engine.getRecentSignals()) || [];
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
  analyzePortfolioRisk() {
    // 各シンボルのポジションと価値を取得
    const positionsBySymbol = {};
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
  filterSignalsByRisk(
    signalsBySymbol,
    riskAnalysis
  ) {
          const filteredSignals = {};
    const portfolioRiskLimit = this.config.portfolioRiskLimit || 0.2; // デフォルト20%

    // シグナルをフィルタリング
    for (const [symbol, signals] of Object.entries(signalsBySymbol)) {
              const filteredSymbolSignals = [];

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
  estimateSignalValue(signal) {
    // 簡易的な実装: 注文金額（量 * 価格）を返す
    const engine = this.engines.get(signal.symbol);
    if (!engine) return 0;

    const currentPrice = (engine.getCurrentPrice && engine.getCurrentPrice()) || 0;
    const price = signal.price || currentPrice;

    return signal.amount * price;
  }

  /**
   * 特定シンボルの現在のリスク比率を取得
   */
  getCurrentSymbolRisk(symbol) {
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
  getHighlyCorrelatedPairs(threshold) {
          const pairs = [];
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
  areSameDirectionSignals(signalsA, signalsB) {
    // シグナル配列内での優勢な方向を判断
    const getNetDirection = (signals) => {
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
  updateCorrelationMatrix() {
    const symbols = this.config.symbols;
          const returns = {};

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
  updateEquityHistory(timestamp) {
    // タイムスタンプを数値に変換
    const numericTimestamp = typeof timestamp === 'string' 
      ? new Date(timestamp).getTime() 
      : timestamp;
    
    const equityBySymbol = {};
    let totalEquity = 0;

    // 各シンボルのエクイティを取得
    for (const [symbol, engine] of this.engines.entries()) {
      const equity = engine.getEquity();
      equityBySymbol[symbol] = equity;
      totalEquity += equity;
    }

    this.portfolioEquity = totalEquity;

    // 履歴に追加
    this.equityHistory.push({
      timestamp: numericTimestamp,
      total: totalEquity,
      bySymbol: equityBySymbol
    });

    // 履歴が長すぎる場合は古いものを削除
    if (this.equityHistory.length > 1000) {
      this.equityHistory.shift();
    }
  }

  /**
   * 現在のポートフォリオエクイティを取得
   */
  getPortfolioEquity() {
    return this.portfolioEquity;
  }

  /**
   * エクイティ履歴を取得
   */
  getEquityHistory() {
    return this.equityHistory;
  }

  /**
   * 各シンボルのポジションを取得
   */
  getAllPositions() {
    return this.symbolsPositions;
  }

  /**
   * 特定シンボルのエンジンを取得
   */
  getEngine(symbol) {
    return this.engines.get(symbol);
  }

  /**
   * 全体システムモードを取得
   */
  getSystemMode() {
    return this.systemMode;
  }

  /**
   * システムモードを設定
   */
  setSystemMode(mode) {
    this.systemMode = mode;
    
    // 各エンジンにもモードを伝播
    for (const engine of this.engines.values()) {
      // CoreSystemModeからStringに変換して渡す
      engine.setSystemMode(mode);
    }

    if (!this.quietMode) {
      logger.info(`[MultiSymbolTradingEngine] システムモードを変更しました: ${mode}`);
    }
  }

  /**
   * 最近のポートフォリオリスク分析を取得
   */
  getPortfolioRiskAnalysis() {
    return this.analyzePortfolioRisk();
  }

  /**
   * シンボル間の相関行列を取得
   */
  getCorrelationMatrix() {
    return this.correlationMatrix;
  }

  /**
   * 全シンボルのシグナルを処理
   * 注: テスト用に追加されたメソッド
   */
  async processAllSignals() {
          // 各シンボルからシグナルを収集
      const signalsBySymbol = {};
    
    for (const [symbol, engine] of this.engines.entries()) {
      // シグナルを収集
              const signals = (engine.getRecentSignals && engine.getRecentSignals()) || [];
      if (signals.length > 0) {
        signalsBySymbol[symbol] = signals;
      }
    }

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
  }
}

// CommonJS エクスポート
module.exports = { MultiSymbolTradingEngine };
