import { 
  Candle, 
  MarketAnalysisResult, 
  MarketEnvironment, 
  StrategyResult, 
  StrategyType, 
  Order, 
  OrderType,
  OrderSide,
  Position, 
  Account
} from './types';
import { analyzeMarketState } from '../indicators/marketState';
import { executeTrendStrategy } from '../strategies/trendStrategy';
import { executeRangeStrategy } from '../strategies/rangeStrategy';
import { RISK_PARAMETERS } from '../config/parameters';
import logger from '../utils/logger';
import { OrderManagementSystem } from './orderManagementSystem';

/**
 * トレーディングエンジンのメインクラス
 */
export class TradingEngine {
  private symbol: string;
  private latestCandles: Candle[] = [];
  private marketAnalysis: MarketAnalysisResult | null = null;
  private activeStrategy: StrategyType = StrategyType.TREND_FOLLOWING;
  private previousClose: number | null = null;
  private account: Account;
  private oms: OrderManagementSystem;

  constructor(symbol: string) {
    this.symbol = symbol;
    this.account = {
      balance: 10000,
      available: 10000,
      positions: [],
      dailyPnl: 0,
      dailyPnlPercentage: 0
    };
    this.oms = new OrderManagementSystem();
    logger.info(`[TradingEngine] エンジンを初期化しました: シンボル ${symbol}`);
  }
  
  /**
   * 市場データを更新
   * @param newCandles 新しいローソク足データ
   */
  public updateMarketData(newCandles: Candle[]): void {
    // 前回の終値を保存
    if (this.latestCandles.length > 0) {
      this.previousClose = this.latestCandles[this.latestCandles.length - 1].close;
    }
    
    this.latestCandles = newCandles;
    logger.debug(`[TradingEngine] マーケットデータ更新: ${this.symbol}, キャンドル数: ${newCandles.length}`);
    
    // ブラックスワン検出
    this.detectBlackSwanEvent();
  }
  
  /**
   * ブラックスワンイベント（急激な価格変動）を検出
   */
  private detectBlackSwanEvent(): void {
    if (!this.previousClose || this.latestCandles.length === 0) {
      return;
    }
    
    const currentClose = this.latestCandles[this.latestCandles.length - 1].close;
    const priceChange = Math.abs(currentClose - this.previousClose) / this.previousClose;
    
    // 価格変動が閾値を超えた場合、緊急戦略に切り替え
    if (priceChange > RISK_PARAMETERS.EMERGENCY_GAP_THRESHOLD) {
      logger.warn(`[TradingEngine] ブラックスワンイベント検出: ${(priceChange * 100).toFixed(2)}% の価格変動`);
      this.activeStrategy = StrategyType.EMERGENCY;
      
      // 緊急戦略を即座に実行
      const emergencyResult = this.executeEmergencyStrategy();
      logger.warn(`[TradingEngine] 緊急戦略実行: ${emergencyResult.signals.length}件の注文を生成`);
    }
  }
  
  /**
   * アカウント情報を更新
   * @param account 更新されたアカウント情報
   */
  public updateAccount(account: Account): void {
    this.account = account;
    
    // デイリーPnLを計算
    this.account.dailyPnl = this.account.balance - this.account.balance;
    this.account.dailyPnlPercentage = (this.account.dailyPnl / this.account.balance) * 100;
    
    logger.debug(`[TradingEngine] アカウント更新: 残高: ${account.balance}, ポジション数: ${account.positions.length}`);
    
    // デイリー損失が閾値を超えた場合、警告を出す
    if (this.account.dailyPnlPercentage < -RISK_PARAMETERS.MAX_DAILY_LOSS * 100) {
      logger.warn(`[TradingEngine] 日次損失が閾値を超えました: ${this.account.dailyPnlPercentage.toFixed(2)}%. トレードを停止します。`);
    }
  }
  
  /**
   * 日次リセット処理
   */
  public resetDailyTracking(): void {
    this.account.dailyPnl = 0;
    this.account.dailyPnlPercentage = 0;
    logger.info(`[TradingEngine] 日次トラッキングをリセット: 新しい開始残高: ${this.account.balance}`);
  }
  
  /**
   * 市場状態を分析
   * @returns 市場分析結果
   */
  public analyzeMarket(): MarketAnalysisResult {
    if (this.latestCandles.length === 0) {
      logger.warn('[TradingEngine] 分析するキャンドルデータがありません');
      return {
        environment: MarketEnvironment.UNKNOWN,
        recommendedStrategy: StrategyType.TREND_FOLLOWING,
        indicators: {},
        timestamp: Date.now()
      };
    }
    
    this.marketAnalysis = analyzeMarketState(this.latestCandles);
    
    logger.info(`[TradingEngine] 市場分析結果: ${this.marketAnalysis.environment}, 推奨戦略: ${this.marketAnalysis.recommendedStrategy}`);
    return this.marketAnalysis;
  }
  
  /**
   * 戦略を実行してシグナルを生成
   * @returns 戦略実行結果
   */
  public executeStrategy(): StrategyResult {
    if (!this.marketAnalysis) {
      logger.warn('[TradingEngine] 市場分析が実行されていません');
      return {
        strategy: StrategyType.TREND_FOLLOWING,
        signals: [],
        timestamp: Date.now()
      };
    }
    
    // 日次損失が閾値を超えた場合、トレードを停止
    if (this.account.dailyPnlPercentage < -RISK_PARAMETERS.MAX_DAILY_LOSS * 100) {
      logger.warn(`[TradingEngine] 日次損失が閾値を超えたため、トレードは停止されています: ${this.account.dailyPnlPercentage.toFixed(2)}%`);
      return {
        strategy: this.activeStrategy,
        signals: [],
        timestamp: Date.now()
      };
    }
    
    // 緊急モードでない場合のみ、市場状態に基づいて戦略を選択
    if (this.activeStrategy !== StrategyType.EMERGENCY) {
      this.activeStrategy = this.marketAnalysis.recommendedStrategy;
    }
    
    let strategyResult: StrategyResult;
    
    // 現在のポジションを取得
    const currentPositions = this.oms.getPositions();
    
    // 適切な戦略を実行
    switch (this.activeStrategy) {
      case StrategyType.TREND_FOLLOWING:
        strategyResult = executeTrendStrategy(
          this.latestCandles, 
          this.symbol, 
          currentPositions,
          this.account.balance
        );
        break;
      case StrategyType.RANGE_TRADING:
        strategyResult = executeRangeStrategy(
          this.latestCandles, 
          this.symbol, 
          currentPositions
        );
        break;
      case StrategyType.EMERGENCY:
        strategyResult = this.executeEmergencyStrategy();
        break;
      default:
        // デフォルトはトレンドフォロー
        strategyResult = executeTrendStrategy(
          this.latestCandles, 
          this.symbol, 
          currentPositions,
          this.account.balance
        );
    }
    
    // シグナルを処理（実際の注文を作成）
    this.processSignals(strategyResult.signals);
    
    return strategyResult;
  }
  
  /**
   * 注文シグナルを処理して実際の注文を作成
   * @param signals 注文シグナル
   */
  private processSignals(signals: Order[]): void {
    for (const signal of signals) {
      // OMSを使用して注文を作成
      const orderId = this.oms.createOrder(signal);
      logger.info(`[TradingEngine] 注文シグナルを処理しました: ${orderId}`);
      
      // 実際の実装では、ここで取引所APIを呼び出して注文を送信し、
      // レスポンスに基づいてOMSの注文ステータスを更新する
    }
  }
  
  /**
   * 価格更新イベントを処理
   * @param price 最新価格
   */
  public updatePrice(price: number): void {
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
  private updateAccountInfo(): void {
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
  private calculateMarginUsed(): number {
    // 単純化のため、ポジション合計額の一定割合を証拠金として計算
    const totalPositionValue = this.account.positions.reduce((total, position) => {
      return total + (position.amount * position.currentPrice);
    }, 0);
    
    // 10%を証拠金として使用（実際にはレバレッジによって変わる）
    return totalPositionValue * 0.1;
  }
  
  /**
   * 緊急戦略を実行（急激な価格変動時）
   * @returns 戦略実行結果
   */
  private executeEmergencyStrategy(): StrategyResult {
    logger.warn('[TradingEngine] 緊急戦略を実行します');
    
    // 現在のポジションを取得
    const currentPositions = this.oms.getPositions();
    const signals: Order[] = [];
    
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
      
      logger.warn(`[TradingEngine] 緊急ポジション削減: ${position.symbol} ${position.side} ${closeAmount}`);
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
  private applyRiskFilters(signals: Order[]): Order[] {
    // リスクフィルターを適用したシグナル
    const filteredSignals: Order[] = [];
    
    // 利用可能資金に基づくフィルター
    const maxRiskAmount = this.account.balance * RISK_PARAMETERS.MAX_RISK_PER_TRADE;
    const availableBalance = this.account.available;
    
    for (const signal of signals) {
      // 資金が不足している場合はスキップ
      if (signal.side === OrderSide.BUY && signal.amount > availableBalance) {
        logger.warn(`[TradingEngine] 資金不足のため注文をスキップ: 必要額=${signal.amount}, 利用可能額=${availableBalance}`);
        continue;
      }
      
      // SELLの場合もポジションサイズをチェック
      if (signal.side === OrderSide.SELL) {
        const totalPosition = this.account.positions
          .filter(p => p.symbol === signal.symbol && p.side === OrderSide.BUY)
          .reduce((sum, p) => sum + p.amount, 0);
          
        if (signal.type !== OrderType.STOP && totalPosition < signal.amount) {
          logger.warn(`[TradingEngine] ポジション不足のため注文をスキップ: 必要額=${signal.amount}, 保有ポジション=${totalPosition}`);
          continue;
        }
      }
      
      // 1回の取引で最大リスク以上を取らない
      if (signal.amount > maxRiskAmount) {
        logger.info(`[TradingEngine] リスク管理: 注文サイズを縮小 ${signal.amount} → ${maxRiskAmount}`);
        signal.amount = maxRiskAmount;
      }
      
      filteredSignals.push(signal);
    }
    
    return filteredSignals;
  }
  
  /**
   * エンジンの状態情報を取得
   * @returns エンジンの状態情報
   */
  public getStatus(): {
    symbol: string;
    account: Account;
    marketAnalysis: MarketAnalysisResult | null;
    activeStrategy: StrategyType;
  } {
    return {
      symbol: this.symbol,
      account: this.account,
      marketAnalysis: this.marketAnalysis,
      activeStrategy: this.activeStrategy
    };
  }
} 