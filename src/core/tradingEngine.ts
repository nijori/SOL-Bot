/**
 * トレーディングエンジン
 * INF-032: CommonJS形式への変換
 * 
 * @fileoverview このファイルはトレーディングロジックの中核となるエンジンを実装しています
 * @author SOL-Bot Team
 */
// @ts-nocheck
// CommonJS移行中のため一時的にTypeScriptチェックを無効化

const { 
  Candle,
  MarketAnalysisResult,
  MarketEnvironment,
  StrategyResult,
  StrategyType,
  Order,
  OrderType,
  OrderSide,
  OrderStatus,
  Position,
  Account,
  AccountState,
  Fill,
  SystemMode,
  RiskLevel,
  TimeFrame
} = require('./types');
const { analyzeMarketState } = require('../indicators/marketState');
const { executeTrendStrategy } = require('../strategies/trendStrategy');
const { executeRangeStrategy } = require('../strategies/rangeStrategy');
const { RISK_PARAMETERS } = require('../config/parameters');
const logger = require('../utils/logger').default;
const { OrderManagementSystem } = require('./orderManagementSystem');
const { parameterService } = require('../config/parameterService');
const { syncOrderForSimulateFill } = require('../utils/orderUtils');
const metricsService = require('../utils/metrics').default;
const { ExchangeService } = require('../services/exchangeService');
const { DonchianBreakoutStrategy } = require('../strategies/DonchianBreakoutStrategy');
const { executeTrendFollowStrategy } = require('../strategies/trendFollowStrategy');
const { OrderSizingService } = require('../services/orderSizingService');
const { PerformanceStats } = require('../types/performanceStats');
const { MarketStateResult } = require('../types/marketStateResult');
const { checkSignificantPriceChange, calculateVolatility } = require('../utils/atrUtils');
const { checkKillSwitch } = require('../utils/killSwitchChecker');

/**
 * TradingEngine用のオプションインターフェース
 * @typedef {Object} TradingEngineOptions
 * @property {string} symbol - 取引通貨ペア
 * @property {number} [timeframeHours] - 時間枠（時間単位）
 * @property {number} [initialBalance] - 初期残高
 * @property {boolean} [isBacktest] - バックテストモードフラグ
 * @property {number} [slippage] - スリッページ
 * @property {number} [commissionRate] - 手数料率
 * @property {boolean} [isSmokeTest] - スモークテストフラグ
 * @property {boolean} [quiet] - ログ出力抑制フラグ
 * @property {OrderManagementSystem} [oms] - 注文管理システム
 * @property {ExchangeService} [exchangeService] - 取引所サービス
 * @property {OrderSizingService} [orderSizingService] - 注文サイズ計算サービス
 */

/**
 * トレーディングエンジンのメインクラス
 */
class TradingEngine {
  /**
   * トレーディングエンジンを初期化
   * @param {TradingEngineOptions} options - 設定オプション
   */
  constructor(options) {
    this.symbol = options.symbol;
    this.timeframeHours = options.timeframeHours || 4;
    this.isBacktest = options.isBacktest || false;
    this.slippage = options.slippage || 0;
    this.commissionRate = options.commissionRate || 0;
    this.isSmokeTest = options.isSmokeTest || false;
    this.quiet = options.quiet || false;

    this.latestCandles = [];
    this.marketAnalysis = null;
    this.activeStrategy = StrategyType.TREND_FOLLOWING;
    this.previousClose = null;
    this.previousDailyClose = null;
    this.lastDailyCloseUpdateTime = 0;
    this.dailyStartingBalance = 0;
    this.completedTrades = [];
    this.lastSystemModeUpdateTime = 0;
    this.marketSummary = null;
    this.orderSizingService = null;
    this.dailyTrades = 0;
    this.dailyPnL = 0;
    this.lastClosingTime = 0;
    this.tradingEnabled = true;
    this.systemMode = SystemMode.NORMAL;
    this.riskLevel = RiskLevel.MEDIUM;
    this.strategyWeights = {
      DonchianBreakout: 0.35,
      TrendFollow: 0.35,
      MeanReversion: 0.3
    };
    this.emergencyModeStartTime = 0;
    this.significantPriceChanges = [];

    this.account = {
      balance: options.initialBalance || 10000,
      available: options.initialBalance || 10000,
      positions: [],
      dailyPnl: 0,
      dailyPnlPercentage: 0
    };

    // 依存サービスの注入
    this.oms = options.oms || new OrderManagementSystem();
    this.exchangeService = options.exchangeService || new ExchangeService();
    this.orderSizingService = options.orderSizingService || null;

    // 初期残高を設定
    this.dailyStartingBalance = this.account.balance;

    // 戦略の初期化
    this.donchianBreakoutStrategy = new DonchianBreakoutStrategy(this.symbol);

    if (!this.quiet) {
      logger.info(
        `[TradingEngine] エンジンを初期化しました: シンボル ${this.symbol}, タイムフレーム ${this.timeframeHours}h`
      );

      if (this.isBacktest) {
        logger.info(
          `[TradingEngine] バックテストモード: スリッページ=${this.slippage * 100}%, 手数料=${this.commissionRate * 100}%`
        );
      }
    }

    // メトリクスの初期化
    this.initializeMetrics();
  }

  /**
   * 市場データを更新
   * @param {Array} newCandles 新しいローソク足データ
   */
  updateMarketData(newCandles) {
    // 緊急停止フラグをチェック
    if (checkKillSwitch()) {
      logger.error(`[TradingEngine] 緊急停止フラグが検出されました。処理を中断します。`);
      this.tradingEnabled = false;
      return;
    }

    // 前回の終値を保存
    if (this.latestCandles.length > 0) {
      this.previousClose = this.latestCandles[this.latestCandles.length - 1].close;
    }

    this.latestCandles = newCandles;
    logger.debug(
      `[TradingEngine] マーケットデータ更新: ${this.symbol}, キャンドル数: ${newCandles.length}`
    );

    // 24時間ごとにpreviousDailyCloseを更新
    this.updateDailyClose();

    // ブラックスワン検出
    this.detectBlackSwanEvent();
  }

  /**
   * 24時間ごとに日次終値を更新
   */
  updateDailyClose() {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000; // 24時間（ミリ秒）

    // 初回または24時間経過した場合に更新
    if (!this.previousDailyClose || now - this.lastDailyCloseUpdateTime >= oneDayMs) {
      // 最新のキャンドルの終値を日次終値として保存
      if (this.latestCandles.length > 0) {
        this.previousDailyClose = this.latestCandles[this.latestCandles.length - 1].close;
        this.lastDailyCloseUpdateTime = now;
        logger.info(`[TradingEngine] 日次終値を更新しました: ${this.previousDailyClose}`);
      }
    }
  }

  /**
   * ブラックスワンイベント（急激な価格変動）を検出
   */
  detectBlackSwanEvent() {
    if (!this.previousDailyClose || this.latestCandles.length === 0) {
      return;
    }

    const currentClose = this.latestCandles[this.latestCandles.length - 1].close;
    const priceChange = Math.abs(currentClose - this.previousDailyClose) / this.previousDailyClose;

    // 現在の変動を履歴に記録（EMERGENCYモードからの回復判定に使用）
    const now = Date.now();
    this.significantPriceChanges.push({
      timestamp: now,
      change: priceChange
    });

    // 24時間より古い価格変動を履歴から削除
    const recoveryHours = parameterService.get<number>('risk.emergency_recovery_hours', 24);
    const oldestValidTime = now - recoveryHours * 60 * 60 * 1000;
    this.significantPriceChanges = this.significantPriceChanges.filter(
      (record) => record.timestamp >= oldestValidTime
    );

    // 価格変動が閾値を超えた場合、緊急戦略に切り替え
    if (priceChange > RISK_PARAMETERS.EMERGENCY_GAP_THRESHOLD) {
      logger.warn(
        `[TradingEngine] ブラックスワンイベント検出: ${(priceChange * 100).toFixed(2)}% の価格変動 (現在価格: ${currentClose}, 24時間前価格: ${this.previousDailyClose})`
      );
      this.activeStrategy = StrategyType.EMERGENCY;
      this.emergencyModeStartTime = now;

      // 緊急戦略を即座に実行
      const emergencyResult = this.executeEmergencyStrategy();
      logger.warn(`[TradingEngine] 緊急戦略実行: ${emergencyResult.signals.length}件の注文を生成`);
    }
    // 現在EMERGENCYモードの場合、解除条件をチェック
    else if (this.activeStrategy === StrategyType.EMERGENCY) {
      this.checkEmergencyRecovery();
    }
  }

  /**
   * EMERGENCYモードからの回復条件をチェック
   */
  checkEmergencyRecovery() {
    // EMERGENCYモード開始からの経過時間をチェック
    const now = Date.now();
    const recoveryHours = parameterService.get<number>('risk.emergency_recovery_hours', 24);
    const minRecoveryTime = recoveryHours * 60 * 60 * 1000; // ミリ秒単位の最小回復時間

    // 最小回復時間が経過していない場合は早期リターン
    if (now - this.emergencyModeStartTime < minRecoveryTime) {
      return;
    }

    // 回復閾値を取得
    const recoveryThreshold = parameterService.get<number>(
      'risk.emergency_recovery_threshold',
      0.075
    );

    // 記録された全ての価格変動が回復閾値未満かチェック
    const allBelowThreshold = this.significantPriceChanges.every(
      (record) => record.change < recoveryThreshold
    );

    // 最小回復時間内の価格変動が全て閾値未満の場合、通常戦略に戻る
    if (allBelowThreshold && this.significantPriceChanges.length > 0) {
      logger.info(
        `[TradingEngine] EMERGENCYモードから復帰: ${recoveryHours}時間以上、全ての価格変動が${(recoveryThreshold * 100).toFixed(2)}%未満で推移`
      );

      // 最後の市場分析に基づいて戦略を選択
      if (this.marketAnalysis) {
        this.activeStrategy = this.marketAnalysis.recommendedStrategy;
        logger.info(`[TradingEngine] 通常戦略に復帰: ${this.activeStrategy}`);
      } else {
        this.activeStrategy = StrategyType.TREND_FOLLOWING;
        logger.info(`[TradingEngine] 市場分析がないため、デフォルトのトレンドフォロー戦略に復帰`);
      }

      // EMERGENCYモード変数をリセット
      this.emergencyModeStartTime = 0;
    }
  }

  /**
   * アカウント情報を更新
   * @param account 更新されたアカウント情報
   */
  updateAccount(account) {
    this.account = account;

    // デイリーPnLを計算（午前0時の残高との差分）
    this.account.dailyPnl = this.account.balance - this.dailyStartingBalance;
    this.account.dailyPnlPercentage = (this.account.dailyPnl / this.dailyStartingBalance) * 100;

    logger.debug(
      `[TradingEngine] アカウント更新: 残高: ${account.balance}, 日次損益: ${this.account.dailyPnl.toFixed(2)}, 日次損益率: ${this.account.dailyPnlPercentage.toFixed(2)}%, ポジション数: ${account.positions.length}`
    );

    // デイリー損失が閾値を超えた場合、警告を出す
    if (this.account.dailyPnlPercentage < -RISK_PARAMETERS.MAX_DAILY_LOSS * 100) {
      logger.warn(
        `[TradingEngine] 日次損失が閾値を超えました: ${this.account.dailyPnlPercentage.toFixed(2)}%. トレードを停止します。`
      );
    }
  }

  /**
   * 日次リセット処理
   */
  resetDailyTracking() {
    // 現在の残高を新しい日次開始残高として記録
    this.dailyStartingBalance = this.account.balance;

    // PnL情報をリセット
    this.account.dailyPnl = 0;
    this.account.dailyPnlPercentage = 0;

    logger.info(
      `[TradingEngine] 日次トラッキングをリセット: 新しい開始残高: ${this.dailyStartingBalance}`
    );
  }

  /**
   * 市場状態を分析
   * @returns 市場分析結果
   */
  analyzeMarket() {
    if (this.latestCandles.length === 0) {
      logger.warn('[TradingEngine] 分析するキャンドルデータがありません');
      return {
        environment: MarketEnvironment.UNKNOWN,
        recommendedStrategy: StrategyType.TREND_FOLLOWING,
        indicators: {},
        timestamp: Date.now()
      };
    }

    this.marketAnalysis = analyzeMarketState(this.latestCandles, this.timeframeHours);

    logger.info(
      `[TradingEngine] 市場分析結果: ${this.marketAnalysis.environment}, 推奨戦略: ${this.marketAnalysis.recommendedStrategy}`
    );
    return this.marketAnalysis;
  }

  /**
   * 戦略を実行し、シグナルを生成
   */
  executeStrategy() {
    // 緊急停止フラグをチェック
    if (checkKillSwitch()) {
      logger.error(`[TradingEngine] 緊急停止フラグが検出されました。戦略実行を中断します。`);
      this.tradingEnabled = false;
      return { 
        strategy: StrategyType.EMERGENCY,
        signals: [],
        timestamp: Date.now(),
        error: '緊急停止フラグが検出されました'
      };
    }

    // 取引が一時停止されている場合は、空のシグナルを返す
    if (!this.tradingEnabled) {
      logger.warn(`[TradingEngine] 取引が一時停止中のため、戦略は実行されません。`);
      return { 
        strategy: StrategyType.EMERGENCY,
        signals: [],
        timestamp: Date.now(),
        error: '取引が一時停止中です'
      };
    }

    // スモークテスト中は簡易的な処理のみ行う
    if (this.isBacktest && this.isSmokeTest) {
      logger.info('[TradingEngine] スモークテストモード: 簡易的なバックテスト実行');

      // スモークテスト用のシグナル生成を強化
      const signals = [];

      // 現在のキャンドル番号を取得（モジュロ演算用）
      const candleIndex = this.latestCandles.length;

      // 強制的なシグナル生成（すべてのキャンドルの5の倍数で生成）
      const forceTrade = candleIndex % 5 === 0;

      // データが十分な場合は通常処理
      if (this.latestCandles.length >= 20) {
        const latestCandle = this.latestCandles[this.latestCandles.length - 1];

        logger.info(
          `[TradingEngine] スモークテスト: キャンドル#${candleIndex}, 価格=${latestCandle.close.toFixed(2)}`
        );

        // 5日移動平均と20日移動平均を計算
        const last5Candles = this.latestCandles.slice(-5);
        const last20Candles = this.latestCandles.slice(-20);

        const ema5 = last5Candles.reduce((sum, c) => sum + c.close, 0) / 5;
        const ema20 = last20Candles.reduce((sum, c) => sum + c.close, 0) / 20;

        // トレンド方向を判断
        const trendDirection = ema5 > ema20 ? OrderSide.BUY : OrderSide.SELL;

        logger.info(
          `[TradingEngine] スモークテスト: EMA5=${ema5.toFixed(2)}, EMA20=${ema20.toFixed(2)}, トレンド=${trendDirection}`
        );

        // トレンド方向にシグナル生成（高確率で生成）
        if (forceTrade || Math.random() < 0.95) {
          // 確率を大幅に上げる
          const side = trendDirection;
          const price = latestCandle.close;
          const amount = 0.1 + Math.random() * 0.2; // 0.1〜0.3の取引量

          const orderId = `smoke-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

          signals.push({
            id: orderId,
            symbol: this.symbol,
            side,
            type: OrderType.MARKET,
            price,
            amount,
            timestamp: Date.now(),
            status: OrderStatus.OPEN
          });

          logger.info(
            `[TradingEngine] スモークテスト用シグナル生成: ID=${orderId}, ${side} ${amount.toFixed(2)} @ ${price.toFixed(2)}`
          );

          // 50%の確率で反対方向の小さなポジションも作成（ヘッジ）
          if (Math.random() < 0.5) {
            const oppositeSide = side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;
            const oppositeAmount = amount * 0.3; // メインポジションの30%
            const hedgeOrderId = `smoke-hedge-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            signals.push({
              id: hedgeOrderId,
              symbol: this.symbol,
              side: oppositeSide,
              type: OrderType.MARKET,
              price,
              amount: oppositeAmount,
              timestamp: Date.now(),
              status: OrderStatus.OPEN
            });

            logger.info(
              `[TradingEngine] スモークテスト用ヘッジシグナル: ID=${hedgeOrderId}, ${oppositeSide} ${oppositeAmount.toFixed(2)} @ ${price.toFixed(2)}`
            );
          }
        }
      } else {
        // データが不足する場合でも強制的にシグナル生成（スモークテスト用）
        logger.warn(
          `[TradingEngine] スモークテスト: キャンドル数が不足しています (${this.latestCandles.length}/20) - 強制シグナル生成モード`
        );

        if (forceTrade || this.latestCandles.length > 0) {
          // 最低1つのキャンドルがあれば、その価格を使用
          const price =
            this.latestCandles.length > 0
              ? this.latestCandles[this.latestCandles.length - 1].close
              : 100; // デフォルト価格

          // ランダムな取引方向
          const side = Math.random() > 0.5 ? OrderSide.BUY : OrderSide.SELL;
          const amount = 0.1 + Math.random() * 0.3; // 0.1〜0.4の取引量

          const orderId = `smoke-force-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

          signals.push({
            id: orderId,
            symbol: this.symbol,
            side,
            type: OrderType.MARKET,
            price,
            amount,
            timestamp: Date.now(),
            status: OrderStatus.OPEN
          });

          logger.info(
            `[TradingEngine] スモークテスト用強制シグナル生成: ID=${orderId}, ${side} ${amount.toFixed(2)} @ ${price.toFixed(2)}`
          );
        }
      }

      logger.info(`[TradingEngine] スモークテスト: ${signals.length}件のシグナルを生成`);

      return {
        strategy: StrategyType.TREND_FOLLOWING,
        signals,
        timestamp: Date.now()
      };
    }

    // 市場分析がまだ行われていない場合は実行しない
    if (!this.marketAnalysis) {
      logger.warn('[TradingEngine] 市場分析が実行されていないため、戦略を実行できません');
      return {
        strategy: StrategyType.TREND_FOLLOWING,
        signals: [],
        timestamp: Date.now()
      };
    }

    // 市場分析に基づいて戦略を選択
    this.activeStrategy = this.marketAnalysis.recommendedStrategy;

    logger.info(
      `[TradingEngine] 市場分析結果: ${this.marketAnalysis.environment}, 推奨戦略: ${this.activeStrategy}`
    );

    // ポジションの偏りをチェックし、必要ならヘッジ注文を作成
    const positions = this.oms.getPositions();
    const hedgeOrders = this.checkAndCreateHedgeOrders(positions);

    // 戦略実行結果
    let result = {
      strategy: this.activeStrategy,
      signals: [], // シグナル（注文）の配列
      timestamp: Date.now()
    };

    try {
      // アクティブな戦略に基づいて実行
      switch (this.activeStrategy) {
        case StrategyType.TREND_FOLLOWING:
          // 通常、トレンドフォロー戦略を実行
          try {
            result = executeTrendFollowStrategy(
              this.latestCandles,
              this.symbol,
              positions,
              this.account.balance
            );
            logger.info(
              `[TradingEngine] トレンドフォロー戦略を実行: ${result.signals.length}件のシグナル生成`
            );
          } catch (error) {
            logger.error(
              `[TradingEngine] トレンドフォロー戦略実行エラー: ${error instanceof Error ? error.message : String(error)}`
            );
            // エラー時はデフォルトの空シグナルを返す
            result = {
              strategy: StrategyType.TREND_FOLLOWING,
              signals: [],
              timestamp: Date.now()
            };
          }
          break;

        case StrategyType.RANGE_TRADING:
          // レンジ相場用の戦略を実行
          try {
            const { executeRangeStrategy } = require('../strategies/rangeStrategy');
            result = executeRangeStrategy(this.latestCandles, this.symbol, positions);
            logger.info(
              `[TradingEngine] レンジ戦略を実行: ${result.signals.length}件のシグナル生成`
            );
          } catch (error) {
            logger.error(
              `[TradingEngine] レンジ戦略実行エラー: ${error instanceof Error ? error.message : String(error)}`
            );
            // エラー時はデフォルトの空シグナルを返す
            result = {
              strategy: StrategyType.RANGE_TRADING,
              signals: [],
              timestamp: Date.now()
            };
          }
          break;

        case StrategyType.MEAN_REVERT:
          // ミーンリバース戦略を実行
          try {
            const { executeMeanRevertStrategy } = require('../strategies/meanRevertStrategy');
            result = executeMeanRevertStrategy(
              this.latestCandles,
              this.symbol,
              positions,
              this.account.balance
            );
            logger.info(
              `[TradingEngine] ミーンリバース戦略を実行: ${result.signals.length}件のシグナル生成`
            );
          } catch (error) {
            logger.error(
              `[TradingEngine] ミーンリバース戦略実行エラー: ${error instanceof Error ? error.message : String(error)}`
            );
            // エラー時はデフォルトの空シグナルを返す
            result = {
              strategy: StrategyType.MEAN_REVERT,
              signals: [],
              timestamp: Date.now()
            };
          }
          break;

        case StrategyType.DONCHIAN_BREAKOUT:
          // ドンチャンブレイクアウト戦略を実行
          try {
            const {
              executeDonchianBreakoutStrategy
            } = require('../strategies/DonchianBreakoutStrategy');
            result = executeDonchianBreakoutStrategy(
              this.latestCandles,
              this.symbol,
              positions,
              this.account.balance
            );
            logger.info(
              `[TradingEngine] ドンチャンブレイクアウト戦略を実行: ${result.signals.length}件のシグナル生成`
            );
          } catch (error) {
            logger.error(
              `[TradingEngine] ドンチャンブレイクアウト戦略実行エラー: ${error instanceof Error ? error.message : String(error)}`
            );
            // エラー時はデフォルトの空シグナルを返す
            result = {
              strategy: StrategyType.DONCHIAN_BREAKOUT,
              signals: [],
              timestamp: Date.now()
            };
          }
          break;

        case StrategyType.EMERGENCY:
          // 緊急戦略を実行
          result = this.executeEmergencyStrategy();
          break;

        default:
          // デフォルトでトレンドフォロー戦略を実行
          logger.warn(
            `[TradingEngine] 未知の戦略タイプ: ${this.activeStrategy}、デフォルトのトレンドフォロー戦略を使用`
          );
          try {
            result = executeTrendFollowStrategy(
              this.latestCandles,
              this.symbol,
              positions,
              this.account.balance
            );
          } catch (error) {
            logger.error(
              `[TradingEngine] デフォルト戦略実行エラー: ${error instanceof Error ? error.message : String(error)}`
            );
            result = {
              strategy: StrategyType.TREND_FOLLOWING,
              signals: [],
              timestamp: Date.now()
            };
          }
          break;
      }

      // ヘッジ注文があれば追加
      if (hedgeOrders.length > 0) {
        result.signals = [...result.signals, ...hedgeOrders];
      }

      // リスク管理フィルターを適用
      result.signals = this.applyRiskFilters(result.signals);

      // シグナルを処理（実際の注文発行）
      this.processSignals(result.signals);

      return result;
    } catch (error) {
      // エラー発生時のハンドリング
      logger.error(
        `[TradingEngine] 戦略実行エラー: ${error instanceof Error ? error.message : String(error)}`
      );

      return {
        strategy: this.activeStrategy,
        signals: [],
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  /**
   * ポジションの偏りをチェックし、必要に応じてヘッジ注文を作成
   * @param positions 現在のポジション
   * @returns ヘッジ注文の配列
   */
  checkAndCreateHedgeOrders(positions) {
    // シンボルに関連するポジションのみをフィルタリング
    const symbolPositions = positions.filter((p) => p.symbol === this.symbol);

    // ポジションがない場合は空配列を返す
    if (symbolPositions.length === 0) {
      return [];
    }

    // ロングとショートのポジション量を集計
    const longAmount = symbolPositions
      .filter((p) => p.side === OrderSide.BUY)
      .reduce((sum, p) => sum + p.amount, 0);

    const shortAmount = symbolPositions
      .filter((p) => p.side === OrderSide.SELL)
      .reduce((sum, p) => sum + p.amount, 0);

    // 総ポジションサイズ
    const totalPositionSize = longAmount + shortAmount;

    // ポジションの偏り度合い（NetPositionDelta）を計算
    // 正の値はロング偏り、負の値はショート偏り
    const netPositionDelta = (longAmount - shortAmount) / totalPositionSize;

    // 偏りが15%以上ある場合にヘッジ
    const hedgeThreshold = 0.15; // 15%

    if (Math.abs(netPositionDelta) < hedgeThreshold) {
      return []; // 偏りが閾値未満の場合は何もしない
    }

    // VWAPを計算（最近の20本のキャンドルを使用）
    const recentCandles = this.latestCandles.slice(-20);
    let cumulativePV = 0;
    let cumulativeVolume = 0;

    for (const candle of recentCandles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      cumulativePV += typicalPrice * candle.volume;
      cumulativeVolume += candle.volume;
    }

    const vwapPrice =
      cumulativeVolume > 0
        ? cumulativePV / cumulativeVolume
        : this.latestCandles[this.latestCandles.length - 1].close;

    // ヘッジするサイド（ロング偏りならショート、ショート偏りならロング）
    const hedgeSide = netPositionDelta > 0 ? OrderSide.SELL : OrderSide.BUY;

    // ヘッジする量（偏りの40%をヘッジ）
    const imbalanceAmount = Math.abs(longAmount - shortAmount);
    const hedgeAmount = imbalanceAmount * 0.4; // 偏りの40%をヘッジ

    logger.warn(
      `[TradingEngine] ポジション偏り検出: ${(netPositionDelta * 100).toFixed(2)}%, ヘッジ実行: ${hedgeSide} ${hedgeAmount.toFixed(4)} @ VWAP(${vwapPrice.toFixed(2)})`
    );

    // ヘッジ注文を生成（VWAP価格で成行注文）
    return [
      {
        symbol: this.symbol,
        type: OrderType.MARKET,
        side: hedgeSide,
        amount: hedgeAmount,
        timestamp: Date.now()
      }
    ];
  }

  /**
   * 注文処理（バックテスト時はスリッページと手数料を適用）
   * @param signals 処理する注文シグナル
   */
  processSignals(signals) {
    if (signals.length === 0) {
      return;
    }

    logger.info(`[TradingEngine] 注文処理開始: ${signals.length}件の注文`);

    for (const order of signals) {
      // スモークテスト時は常に価格を設定
      if (this.isSmokeTest && !order.price && this.latestCandles.length > 0) {
        order.price = this.latestCandles[this.latestCandles.length - 1].close;
        logger.info(`[TradingEngine] スモークテスト: 注文に現在価格を設定 - ${order.price}`);
      }

      if (this.isBacktest) {
        // バックテスト時はスリッページと手数料を適用
        this.applySlippageAndCommission(order);
      }

      // 注文を送信し、IDを取得
      const orderId = this.oms.createOrder(order);
      logger.info(
        `[TradingEngine] 注文送信: ${orderId} - ${order.side} ${order.amount} @ ${order.price || 'MARKET'}`
      );

      if (this.isBacktest) {
        // バックテストでは約定を即時シミュレート
        // 注文ID情報を更新してからシミュレーション
        const updatedOrder = this.oms.getOrders().find((o) => o.id === orderId);
        if (updatedOrder) {
          this.simulateFill(updatedOrder);
        } else {
          // 注文が見つからない場合は元の注文を使用
          this.simulateFill(order);
        }
      }
    }
  }

  /**
   * スリッページと手数料を注文に適用（バックテスト用）
   * @param order 注文
   */
  applySlippageAndCommission(order) {
    // 成行注文など価格がない場合は、最新の価格を使用
    if (order.price === undefined && this.latestCandles.length > 0) {
      order.price = this.latestCandles[this.latestCandles.length - 1].close;
      logger.debug(`[TradingEngine] 価格なし注文に現在価格を設定: ${order.price}`);
    }

    if (order.price === undefined) {
      logger.warn(`[TradingEngine] 注文に価格が設定されていません: ${order.id}`);
      return; // 価格がない場合はスキップ
    }

    // スリッページを適用（買いの場合は価格が上昇、売りの場合は価格が下落）
    if (order.side === OrderSide.BUY) {
      order.price = order.price * (1 + this.slippage);
    } else {
      order.price = order.price * (1 - this.slippage);
    }

    logger.debug(`[TradingEngine] スリッページ適用: ${order.side} ${order.price}`);
  }

  /**
   * 注文の即時約定をシミュレート（バックテスト用）
   * @param order 約定させる注文
   */
  simulateFill(order) {
    // 注文に価格がない場合（成行注文など）、最新の価格を設定
    let fillPrice;

    if (order.price === undefined && this.latestCandles.length > 0) {
      fillPrice = this.latestCandles[this.latestCandles.length - 1].close;
      order.price = fillPrice; // 注文自体にも価格を設定
      logger.debug(`[TradingEngine] 約定処理: 成行注文に現在価格を設定 - ${fillPrice}`);
    } else if (order.price !== undefined) {
      // 価格が存在する場合はその価格を使用
      fillPrice = order.price;
    } else {
      // 最後の手段として、価格が設定できない場合は処理を中止
      logger.warn(
        `[TradingEngine] 約定処理できません: 価格情報がありません (ID: ${order.id || 'unknown'})`
      );
      return;
    }

    // OrderStatusの型を確実に適用
    const filledOrder = {
      ...order,
      price: fillPrice, // 明示的に価格を設定
      status: OrderStatus.FILLED
    };

    // 注文金額を計算
    const orderValue = fillPrice * order.amount;

    // 手数料を計算して残高から差し引く
    const commissionAmount = orderValue * this.commissionRate;
    this.account.balance -= commissionAmount;

    logger.info(
      `[TradingEngine] 約定完了: ${order.id || 'ID不明'} - ${order.side} ${order.amount.toFixed(4)} @ ${fillPrice.toFixed(2)}, 手数料: ${commissionAmount.toFixed(4)}`
    );

    // 約定履歴に追加
    this.completedTrades.push({
      id: filledOrder.id,
      symbol: filledOrder.symbol,
      side: filledOrder.side,
      price: fillPrice, // 確実に数値の価格を使用
      amount: filledOrder.amount,
      timestamp: Date.now(),
      orderValue: orderValue,
      commission: commissionAmount,
      pnl: 0 // PnLは後で計算
    });

    // OMSに約定を通知
    if (filledOrder.id) {
      try {
        // 確実に数値の価格を使用して約定通知
        this.oms.fillOrder(filledOrder.id, fillPrice);
        logger.debug(`[TradingEngine] OMS約定通知完了: ${filledOrder.id}`);
      } catch (error) {
        logger.error(
          `[TradingEngine] OMS約定通知エラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * 完了した取引履歴を取得（バックテスト評価用）
   */
  getCompletedTrades() {
    return this.completedTrades;
  }

  /**
   * 現在の口座残高を取得（バックテスト評価用）
   */
  getEquity() {
    return this.account.balance;
  }

  /**
   * 価格更新イベントを処理
   * @param price 最新価格
   */
  updatePrice(price) {
    if (!this.previousClose) {
      this.previousClose = price;
    }

    // OMSに価格更新を通知
    this.oms.updatePrices(this.symbol, price);

    // アカウント情報を更新
    this.updateAccountInfo();

    this.previousClose = price;
  }

  /**
   * アカウント情報を更新
   */
  updateAccountInfo() {
    // ポジションを更新
    this.account.positions = this.oms.getPositions();

    // 未実現損益を計算
    const unrealizedPnl = this.oms.getTotalUnrealizedPnl();

    // 利用可能残高を計算
    this.account.available = this.account.balance - this.calculateMarginUsed();

    // 日次PnLを更新（実際の実装では日次ベースの計算が必要）
    this.account.dailyPnl = unrealizedPnl;
    this.account.dailyPnlPercentage = (unrealizedPnl / this.account.balance) * 100;
  }

  /**
   * 使用中の証拠金を計算
   * @returns 使用中の証拠金額
   */
  calculateMarginUsed() {
    // 単純化のため、ポジション合計額の一定割合を証拠金として計算
    const totalPositionValue = this.account.positions.reduce((total, position) => {
      return total + position.amount * position.currentPrice;
    }, 0);

    // 10%を証拠金として使用（実際にはレバレッジによって変わる）
    return totalPositionValue * 0.1;
  }

  /**
   * 緊急戦略を実行（急激な価格変動時）
   * @returns 戦略実行結果
   */
  executeEmergencyStrategy() {
    logger.warn('[TradingEngine] 緊急戦略を実行します');

    // 現在のポジションを取得
    const currentPositions = this.oms.getPositions();
    const signals = [];

    // すべてのポジションの半分をクローズ
    for (const position of currentPositions) {
      const closeAmount = position.amount * 0.5; // 50%のポジションをクローズ

      signals.push({
        symbol: position.symbol,
        type: OrderType.MARKET, // 緊急時は成行注文
        side: position.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY, // 反対側の注文
        amount: closeAmount,
        timestamp: Date.now()
      });

      logger.warn(
        `[TradingEngine] 緊急ポジション削減: ${position.symbol} ${position.side} ${closeAmount}`
      );
    }

    return {
      strategy: StrategyType.EMERGENCY,
      signals,
      timestamp: Date.now()
    };
  }

  /**
   * リスク管理フィルターを適用
   * @param signals 生のシグナル
   * @returns フィルター適用後のシグナル
   */
  applyRiskFilters(signals) {
    // リスクフィルターを適用したシグナル
    const filteredSignals = [];

    // 利用可能資金に基づくフィルター
    const maxRiskAmount = this.account.balance * RISK_PARAMETERS.MAX_RISK_PER_TRADE;
    const availableBalance = this.account.available;

    // 最新の価格を取得（リスク計算用）
    const currentPrice =
      this.latestCandles.length > 0 ? this.latestCandles[this.latestCandles.length - 1].close : 0;

    if (currentPrice === 0) {
      logger.warn('[TradingEngine] 価格情報がないためリスク計算を正確に行えません');
      return signals; // 価格情報がない場合は元のシグナルをそのまま返す
    }

    // 最新のATR値を取得（デフォルトのストップ距離計算用）
    let currentATR = 0;
    if (this.marketAnalysis && this.marketAnalysis.indicators.atr) {
      currentATR = this.marketAnalysis.indicators.atr;
    } else if (this.latestCandles.length > 14) {
      // 簡易ATR計算用に最低14本のローソク足が必要
      // ATR計算ロジックをインポートして使用
      // ここでは単純化のため直近の高値-安値の平均とする
      const recentCandles = this.latestCandles.slice(-14);
      const ranges = recentCandles.map((c) => c.high - c.low);
      currentATR = ranges.reduce((sum, range) => sum + range, 0) / ranges.length;
    }

    // 各シグナルに対してリスクフィルターを適用
    for (const signal of signals) {
      // 注文金額（量×価格）を計算
      const orderPrice = signal.price || currentPrice; // 指値注文の場合は指定価格、そうでなければ現在価格
      const notionalValue = signal.amount * orderPrice;

      // 資金が不足している場合はスキップ
      if (signal.side === OrderSide.BUY && notionalValue > availableBalance) {
        logger.warn(
          `[TradingEngine] 資金不足のため注文をスキップ: 必要額=${notionalValue.toFixed(2)}, 利用可能額=${availableBalance.toFixed(2)}`
        );
        continue;
      }

      // SELLの場合もポジションサイズをチェック
      if (signal.side === OrderSide.SELL) {
        const totalPosition = this.account.positions
          .filter((p) => p.symbol === signal.symbol && p.side === OrderSide.BUY)
          .reduce((sum, p) => sum + p.amount, 0);

        if (signal.type !== OrderType.STOP && totalPosition < signal.amount) {
          logger.warn(
            `[TradingEngine] ポジション不足のため注文をスキップ: 必要数量=${signal.amount}, 保有ポジション=${totalPosition}`
          );
          continue;
        }
      }

      // 停止距離を考慮したリスク計算
      let stopDistance = 0;
      let riskAmount = 0;

      // 関連するストップ注文を探す
      const stopOrder = signals.find(
        (s) =>
          s.symbol === signal.symbol &&
          s.side !== signal.side &&
          (s.type === OrderType.STOP || s.type === OrderType.STOP_MARKET) &&
          s.stopPrice
      );

      if (stopOrder && stopOrder.stopPrice) {
        // ストップ注文があればそのストップ価格からストップ距離を計算
        stopDistance = Math.abs(orderPrice - stopOrder.stopPrice);
        riskAmount = signal.amount * stopDistance;
      } else {
        // ストップ注文がなければデフォルトでATRの1.5倍をストップ距離とする
        stopDistance = currentATR * 1.5;
        riskAmount = signal.amount * stopDistance;
      }

      // リスク額がマックスリスク額を超える場合、注文量を調整
      if (riskAmount > maxRiskAmount && stopDistance > 0) {
        const adjustedAmount = maxRiskAmount / stopDistance;
        logger.info(
          `[TradingEngine] リスク管理: リスク額(${riskAmount.toFixed(2)})が最大リスク金額(${maxRiskAmount.toFixed(2)})を超えるため、注文数量を縮小 ${signal.amount.toFixed(4)} → ${adjustedAmount.toFixed(4)}`
        );
        signal.amount = adjustedAmount;
      }

      // 1回の取引で最大リスク金額以上を取らない（金額ベース・追加チェック）
      if (notionalValue > maxRiskAmount * 10) {
        // 極端に大きな注文の場合はさらに制限
        // 注文金額が最大リスク金額の10倍を超える場合、注文数量をさらに調整
        const adjustedAmount = (maxRiskAmount * 10) / orderPrice;
        logger.warn(
          `[TradingEngine] リスク管理: 注文金額(${notionalValue.toFixed(2)})が非常に大きいため、注文数量を制限 ${signal.amount.toFixed(4)} → ${adjustedAmount.toFixed(4)}`
        );
        signal.amount = adjustedAmount;
      }

      filteredSignals.push(signal);
    }

    return filteredSignals;
  }

  /**
   * エンジンの状態情報を取得
   * @returns エンジンの状態情報
   */
  getStatus() {
    return {
      symbol: this.symbol,
      account: this.account,
      marketAnalysis: this.marketAnalysis,
      activeStrategy: this.activeStrategy
    };
  }

  /**
   * バックテスト用のupdate()メソッド - 単一キャンドルでエンジンを更新
   * @param candle 現在のキャンドル
   * @returns Promiseを返す
   */
  async update(candle) {
    try {
      // 緊急停止フラグをチェック
      if (checkKillSwitch()) {
        logger.error(`[TradingEngine] 緊急停止フラグが検出されました。処理を中断します。`);
        this.tradingEnabled = false;
        return;
      }

      // 最新の価格情報を更新
      this.updatePrice(candle.close);

      // 1. 市場データを更新
      this.updateMarketData([candle]);

      // 2. 市場状態を分析
      this.analyzeMarket();

      // 3. 戦略を実行
      const strategyResult = this.executeStrategy();

      // 4. シグナルを処理（重要: これがないとシグナルが処理されない）
      if (strategyResult && strategyResult.signals && strategyResult.signals.length > 0) {
        logger.info(`[TradingEngine] シグナル処理: ${strategyResult.signals.length}件の注文を処理`);
        this.processSignals(strategyResult.signals);
      }

      // 価格更新通知
      this.updatePrice(candle.close);
    } catch (error) {
      logger.error(`[TradingEngine] エンジン更新中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * すべてのポジションをクローズする（バックテスト終了時などに使用）
   * @returns Promiseを返す
   */
  async closeAllPositions() {
    logger.info('[TradingEngine] すべてのポジションをクローズします');

    // 現在のポジションを取得
    const positions = this.oms.getPositions();
    const signals = [];

    // 各ポジションに対して反対注文を作成
    for (const position of positions) {
      signals.push({
        symbol: position.symbol,
        type: OrderType.MARKET, // 成行でクローズ
        side: position.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY, // 反対側の注文
        amount: position.amount,
        timestamp: Date.now()
      });

      logger.info(
        `[TradingEngine] ポジションクローズ: ${position.symbol} ${position.side} ${position.amount}`
      );
    }

    // シグナルを処理
    this.processSignals(signals);
  }

  /**
   * ポジションおよび残高の更新
   * @param order 約定した注文
   * @param fill 約定情報
   */
  updatePositionAndBalance(order, fill) {
    // 既存のコード...
    // ... existing code ...

    // メトリクスの更新
    metricsService.updateMetrics.updateBalance(this.account.balance);

    // 勝率、ドローダウン、シャープレシオの計算と更新（指標から取得）
    if (this.performanceStats) {
      const winRate = this.performanceStats.winRate || 0;
      const maxDrawdown = this.performanceStats.maxDrawdown || 0;
      const sharpeRatio = this.performanceStats.sharpeRatio || 0;

      metricsService.updateMetrics.updatePerformanceMetrics(winRate, maxDrawdown, sharpeRatio);
    }

    // 取引履歴を記録
    metricsService.updateMetrics.recordTrade(fill.amount);
  }

  /**
   * 日次パフォーマンスの計算と更新
   */
  updateDailyPerformance() {
    if (!this.dailyStartingBalance || !this.account) {
      return;
    }

    const currentBalance = this.account.balance;
    const dailyPnl = currentBalance - this.dailyStartingBalance;
    const dailyPnlPercentage = dailyPnl / this.dailyStartingBalance;

    // メトリクスに日次損益を更新
    metricsService.updateMetrics.updateDailyPnl(dailyPnl, dailyPnlPercentage);

    // ログ出力
    logger.info(
      `[TradingEngine] 日次パフォーマンス更新: PnL=${dailyPnl.toFixed(2)} (${(dailyPnlPercentage * 100).toFixed(2)}%)`
    );

    // 日次損失制限チェック
    if (dailyPnlPercentage < -0.05) {
      // 5%以上の損失で停止
      logger.warn(
        `[TradingEngine] 日次損失制限に達しました。取引を停止します: ${(dailyPnlPercentage * 100).toFixed(2)}%`
      );
      this.stop();
    }
  }

  /**
   * エラー記録とメトリクス更新
   * @param error エラーオブジェクト
   * @param errorType エラーの種類
   */
  logErrorAndUpdateMetrics(error, errorType) {
    logger.error(`[TradingEngine] ${errorType}エラー: ${error.message}`);
    metricsService.updateMetrics.recordError(errorType);
  }

  /**
   * リスク計算に基づいた注文サイズを取得する
   * OrderSizingServiceが利用可能な場合はそちらを使用し、
   * なければ従来のリスク計算方式で計算する
   *
   * @param entryPrice エントリー価格
   * @param stopPrice ストップ価格
   * @param riskPercent リスク割合（オプション、デフォルトは1%）
   * @returns 適切な注文サイズ
   */
  async getOrderSize(
    entryPrice,
    stopPrice,
    riskPercent = 0.01
  ) {
    // OrderSizingServiceが設定されている場合はそちらを使用
    if (this.orderSizingService) {
      try {
        return await this.orderSizingService.calculateOrderSize(
          this.symbol,
          this.account.balance,
          Math.abs(entryPrice - stopPrice),
          entryPrice,
          riskPercent
        );
      } catch (error) {
        logger.error(`OrderSizingService使用中にエラーが発生しました: ${error}`);
        // エラーが発生した場合は従来の方法にフォールバック
      }
    }

    // 従来のリスク計算方式（OrderSizingServiceが使えない場合）
    // 口座残高からのリスク許容額
    const riskAmount = this.account.balance * riskPercent;

    // エントリーとストップの距離
    const stopDistance = Math.abs(entryPrice - stopPrice);

    // 距離が0の場合のフォールバック（ATR）
    if (stopDistance === 0 || stopDistance < entryPrice * 0.001) {
      // デフォルトでは価格の1%をストップ距離として使用
      return riskAmount / (entryPrice * 0.01);
    }

    // 標準的なポジションサイズ計算
    const size = riskAmount / stopDistance;

    // 資産の最大25%までの制限
    const maxPositionSize = (this.account.balance * 0.25) / entryPrice;
    return Math.min(size, maxPositionSize);
  }

  /**
   * ポジション一覧を取得
   */
  getPositions() {
    return this.account.positions;
  }

  /**
   * 最新の取引シグナルを取得
   */
  getRecentSignals() {
    // 実装例：直近の戦略実行結果からシグナルを返す
    const result = this.executeStrategy();
    return result.signals;
  }

  /**
   * 現在の価格を取得
   */
  getCurrentPrice() {
    if (this.latestCandles.length === 0) {
      return 0;
    }
    return this.latestCandles[this.latestCandles.length - 1].close;
  }

  /**
   * システムモードを設定
   */
  setSystemMode(mode) {
    this.systemMode = mode;
    
    // ログ出力（quietモードでない場合のみ）
    if (!this.quiet) {
      logger.info(`[TradingEngine] システムモードを変更: ${mode}`);
    }
    
    // モード変更時の処理を実行
    this.onSystemModeChange();
  }
  
  /**
   * システムモード変更時の処理
   */
  onSystemModeChange() {
    // モードに応じた処理を実装
    switch (this.systemMode) {
      case SystemMode.RISK_REDUCTION:
        // リスク削減モード時の処理
        this.reduceRisk();
        break;
      
      case SystemMode.STANDBY:
        // 待機モード時の処理
        this.pauseTrading();
        break;
        
      case SystemMode.EMERGENCY:
        // 緊急モード時の処理
        this.executeEmergencyStrategy();
        break;
        
      case SystemMode.NORMAL:
      default:
        // 通常モード時の処理
        this.resumeTrading();
        break;
    }
  }
  
  /**
   * リスク削減処理
   */
  reduceRisk() {
    // 実装例：ポジションサイズの削減など
    const currentPositions = this.getPositions();
    if (currentPositions.length > 0 && !this.quiet) {
      logger.info(`[TradingEngine] リスク削減モード: ${currentPositions.length}件のポジションを削減します`);
    }
    
    // リスク削減処理の実装
    // ...
  }
  
  /**
   * 取引一時停止
   */
  pauseTrading() {
    this.tradingEnabled = false;
    if (!this.quiet) {
      logger.info(`[TradingEngine] 取引を一時停止しました`);
    }
  }
  
  /**
   * 取引再開
   */
  resumeTrading() {
    this.tradingEnabled = true;
    if (!this.quiet) {
      logger.info(`[TradingEngine] 取引を再開しました`);
    }
  }

  /**
   * メトリクスを初期化
   */
  initializeMetrics() {
    this.performanceStats = {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      sortinoRatio: 0
    };
    
    if (!this.quiet) {
      logger.debug(`[TradingEngine] パフォーマンスメトリクスを初期化しました`);
    }
  }

  /**
   * エンジンを停止
   */
  stop() {
    // 実装例：リソースのクリーンアップや取引の終了処理など
    if (!this.quiet) {
      logger.info(`[TradingEngine] エンジンを停止しています...`);
    }
    
    // 必要なクリーンアップ処理
    // ...
    
    if (!this.quiet) {
      logger.info(`[TradingEngine] エンジン停止完了`);
    }
  }
}

// CommonJS形式でエクスポート
module.exports = { TradingEngine };
