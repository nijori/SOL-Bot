import { ADX, Highest, Lowest, ATR } from 'technicalindicators';
import { 
  Candle, 
  Order, 
  OrderSide, 
  OrderType, 
  Position, 
  StrategyResult, 
  StrategyType 
} from '../core/types';
import { TREND_PARAMETERS, MARKET_PARAMETERS, RISK_PARAMETERS } from '../config/parameters';

/**
 * Donchianチャネルを計算する関数
 * @param candles ローソク足データ
 * @param period 期間
 * @returns Donchianチャネルの上限と下限
 */
function calculateDonchian(candles: Candle[], period: number): { upper: number, lower: number } {
  // 計算に必要な期間分のデータを取得
  const highValues = candles.slice(-period).map(c => c.high);
  const lowValues = candles.slice(-period).map(c => c.low);
  
  const highestInput = {
    period: period, // periodをそのまま使用（全期間の最高値を求める）
    values: highValues // すでにperiod分だけスライスされたデータ
  };
  
  const lowestInput = {
    period: period, // periodをそのまま使用（全期間の最低値を求める）
    values: lowValues // すでにperiod分だけスライスされたデータ
  };
  
  const highestValues = Highest.calculate(highestInput);
  const lowestValues = Lowest.calculate(lowestInput);
  
  // 最後の値（直近の期間の最高値/最低値）を返す
  return {
    upper: highestValues[highestValues.length - 1],
    lower: lowestValues[lowestValues.length - 1]
  };
}

/**
 * ATRを計算する関数
 * @param candles ローソク足データ
 * @param period 期間
 * @returns ATR値
 */
function calculateATR(candles: Candle[], period: number): number {
  const atrInput = {
    high: candles.map(c => c.high),
    low: candles.map(c => c.low),
    close: candles.map(c => c.close),
    period
  };
  
  const atrValues = ATR.calculate(atrInput);
  return atrValues[atrValues.length - 1];
}

/**
 * リスクベースのポジションサイズを計算する関数
 * @param accountBalance 口座残高
 * @param entryPrice エントリー価格
 * @param stopPrice ストップ価格
 * @param maxRiskPercentage 1トレードあたりの最大リスク率
 * @returns 適切なポジションサイズ
 */
function calculateRiskBasedPositionSize(
  accountBalance: number, 
  entryPrice: number, 
  stopPrice: number,
  maxRiskPercentage: number = RISK_PARAMETERS.MAX_RISK_PER_TRADE
): number {
  // 口座残高から使用可能なリスク額を計算
  const riskAmount = accountBalance * maxRiskPercentage;
  
  // エントリーからストップまでの距離（リスク距離）を計算
  const stopDistance = Math.abs(entryPrice - stopPrice);
  
  // リスク距離が0の場合（極めて稀）はデフォルトのポジションサイズを返す
  if (stopDistance === 0) {
    return accountBalance * TREND_PARAMETERS.POSITION_SIZING;
  }
  
  // ポジションサイズ = リスク額 / リスク距離
  // これにより、ストップまでの距離に応じてポジションサイズが自動調整される
  const positionSize = riskAmount / stopDistance;
  
  // 結果として得られるポジションサイズを返す
  // ただし、上限（利用可能資金の25%）を超えないようにする
  const maxPositionSize = accountBalance * 0.25;
  return Math.min(positionSize, maxPositionSize);
}

/**
 * トレンド戦略を実行する関数
 * @param candles ローソク足データ
 * @param symbol 銘柄シンボル
 * @param currentPositions 現在のポジション
 * @param accountBalance 口座残高（ポジションサイズ計算用）
 * @returns 戦略の実行結果
 */
export function executeTrendStrategy(
  candles: Candle[], 
  symbol: string, 
  currentPositions: Position[],
  accountBalance: number = 1000 // デフォルト値（実際の実装では呼び出し側から渡す）
): StrategyResult {
  // データが不足している場合は空のシグナルを返す
  if (candles.length < Math.max(TREND_PARAMETERS.DONCHIAN_PERIOD, TREND_PARAMETERS.ADX_PERIOD, MARKET_PARAMETERS.ATR_PERIOD) + 10) {
    return {
      strategy: StrategyType.TREND_FOLLOWING,
      signals: [],
      timestamp: Date.now()
    };
  }
  
  // Donchianチャネルを計算
  const donchian = calculateDonchian(candles, TREND_PARAMETERS.DONCHIAN_PERIOD);
  
  // ATRを計算
  const currentATR = calculateATR(candles, MARKET_PARAMETERS.ATR_PERIOD);
  
  // ADXを計算
  const adxInput = {
    high: candles.map(c => c.high),
    low: candles.map(c => c.low),
    close: candles.map(c => c.close),
    period: TREND_PARAMETERS.ADX_PERIOD
  };
  
  const adxValues = ADX.calculate(adxInput);
  const currentAdx = adxValues[adxValues.length - 1].adx;
  
  // 現在の価格
  const currentPrice = candles[candles.length - 1].close;
  const previousPrice = candles[candles.length - 2].close;
  
  // シグナルを格納する配列
  const signals: Order[] = [];
  
  // 現在のポジションを確認
  const longPositions = currentPositions.filter(p => p.symbol === symbol && p.side === OrderSide.BUY);
  const shortPositions = currentPositions.filter(p => p.symbol === symbol && p.side === OrderSide.SELL);
  const hasLongPosition = longPositions.length > 0;
  const hasShortPosition = shortPositions.length > 0;
  
  // 追加ポジションのカウント（既存のポジション数に基づく）
  const longAddOnCount = longPositions.length - 1; // 初期ポジションを除外
  const shortAddOnCount = shortPositions.length - 1; // 初期ポジションを除外
  
  // ADXが閾値より高いかどうか（トレンドの強さの指標）
  const isStrongTrend = currentAdx > TREND_PARAMETERS.ADX_THRESHOLD;
  
  // トレンドの方向とブレイクアウトの条件を確認
  const isBreakingUp = currentPrice > donchian.upper && previousPrice <= donchian.upper;
  const isBreakingDown = currentPrice < donchian.lower && previousPrice >= donchian.lower;
  
  // リスク単位（R）を計算
  // 1R = エントリーからストップまでの距離
  const riskUnit = currentATR;
  
  // 上昇ブレイクアウトでかつ強いトレンドの場合、買いシグナル
  if (isBreakingUp && isStrongTrend && !hasLongPosition) {
    // ATRベースのストップロス価格
    const stopPrice = currentPrice - (currentATR * TREND_PARAMETERS.ATR_TRAILING_STOP_MULTIPLIER);
    
    // リスクベースのポジションサイズを計算
    const positionSize = calculateRiskBasedPositionSize(
      accountBalance,
      currentPrice,
      stopPrice
    );
    
    // 新規エントリー
    signals.push({
      symbol,
      type: OrderType.MARKET,
      side: OrderSide.BUY,
      amount: positionSize,
      timestamp: Date.now()
    });
    
    // ストップロス注文
    signals.push({
      symbol,
      type: OrderType.STOP,
      side: OrderSide.SELL,
      amount: positionSize,
      stopPrice,
      timestamp: Date.now()
    });
  }
  
  // 下降ブレイクアウトでかつ強いトレンドの場合、売りシグナル
  if (isBreakingDown && isStrongTrend && !hasShortPosition) {
    // ATRベースのストップロス価格
    const stopPrice = currentPrice + (currentATR * TREND_PARAMETERS.ATR_TRAILING_STOP_MULTIPLIER);
    
    // リスクベースのポジションサイズを計算
    const positionSize = calculateRiskBasedPositionSize(
      accountBalance,
      currentPrice,
      stopPrice
    );
    
    // 新規エントリー
    signals.push({
      symbol,
      type: OrderType.MARKET,
      side: OrderSide.SELL,
      amount: positionSize,
      timestamp: Date.now()
    });
    
    // ストップロス注文
    signals.push({
      symbol,
      type: OrderType.STOP,
      side: OrderSide.BUY,
      amount: positionSize,
      stopPrice,
      timestamp: Date.now()
    });
  }
  
  // 既存のロングポジションがある場合の処理
  if (hasLongPosition) {
    const firstLongPosition = longPositions[0]; // 最初の買いポジション
    
    // 新しいトレイリングストップ価格（ATRベース）
    const newStopPrice = currentPrice - (currentATR * TREND_PARAMETERS.ATR_TRAILING_STOP_MULTIPLIER);
    
    // 既存のストップよりも高い水準に更新する場合のみ
    if (firstLongPosition.entryPrice - (currentATR * TREND_PARAMETERS.ATR_TRAILING_STOP_MULTIPLIER) < newStopPrice) {
      // すべての買いポジションの総量
      const totalLongAmount = longPositions.reduce((sum, pos) => sum + pos.amount, 0);
      
      signals.push({
        symbol,
        type: OrderType.STOP,
        side: OrderSide.SELL,
        amount: totalLongAmount,
        stopPrice: newStopPrice,
        timestamp: Date.now()
      });
    }
    
    // 追加ポジション（add-on）のロジック
    // 価格が1R以上上昇し、かつ追加ポジションが2回未満の場合
    if (longAddOnCount < 2 && currentPrice > firstLongPosition.entryPrice + riskUnit) {
      // 新しいストップ価格
      const addOnStopPrice = currentPrice - (currentATR * TREND_PARAMETERS.ATR_TRAILING_STOP_MULTIPLIER);
      
      // 追加ポジションのサイズをリスクベースで計算
      const addOnPositionSize = calculateRiskBasedPositionSize(
        accountBalance,
        currentPrice,
        addOnStopPrice,
        RISK_PARAMETERS.MAX_RISK_PER_TRADE * TREND_PARAMETERS.ADD_ON_POSITION_MULTIPLIER // 追加ポジションは通常の半分のリスク
      );
      
      signals.push({
        symbol,
        type: OrderType.MARKET,
        side: OrderSide.BUY,
        amount: addOnPositionSize,
        timestamp: Date.now()
      });
    }
  }
  
  // 既存のショートポジションがある場合の処理
  if (hasShortPosition) {
    const firstShortPosition = shortPositions[0]; // 最初の売りポジション
    
    // 新しいトレイリングストップ価格（ATRベース）
    const newStopPrice = currentPrice + (currentATR * TREND_PARAMETERS.ATR_TRAILING_STOP_MULTIPLIER);
    
    // 既存のストップよりも低い水準に更新する場合のみ
    if (firstShortPosition.entryPrice + (currentATR * TREND_PARAMETERS.ATR_TRAILING_STOP_MULTIPLIER) > newStopPrice) {
      // すべての売りポジションの総量
      const totalShortAmount = shortPositions.reduce((sum, pos) => sum + pos.amount, 0);
      
      signals.push({
        symbol,
        type: OrderType.STOP,
        side: OrderSide.BUY,
        amount: totalShortAmount,
        stopPrice: newStopPrice,
        timestamp: Date.now()
      });
    }
    
    // 追加ポジション（add-on）のロジック
    // 価格が1R以上下落し、かつ追加ポジションが2回未満の場合
    if (shortAddOnCount < 2 && currentPrice < firstShortPosition.entryPrice - riskUnit) {
      // 新しいストップ価格
      const addOnStopPrice = currentPrice + (currentATR * TREND_PARAMETERS.ATR_TRAILING_STOP_MULTIPLIER);
      
      // 追加ポジションのサイズをリスクベースで計算
      const addOnPositionSize = calculateRiskBasedPositionSize(
        accountBalance,
        currentPrice,
        addOnStopPrice,
        RISK_PARAMETERS.MAX_RISK_PER_TRADE * TREND_PARAMETERS.ADD_ON_POSITION_MULTIPLIER // 追加ポジションは通常の半分のリスク
      );
      
      signals.push({
        symbol,
        type: OrderType.MARKET,
        side: OrderSide.SELL,
        amount: addOnPositionSize,
        timestamp: Date.now()
      });
    }
  }
  
  return {
    strategy: StrategyType.TREND_FOLLOWING,
    signals,
    timestamp: Date.now()
  };
}