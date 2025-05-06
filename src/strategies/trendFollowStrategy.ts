/**
 * 改良版トレンドフォロー戦略
 * Donchianブレイク+ADXによるエントリー、Parabolic SARによる追従、トレイリングストップの実装
 */
import { ADX, ATR } from 'technicalindicators';
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
import { parameterService } from '../config/parameterService';
import { calculateParabolicSAR, ParabolicSARResult } from '../indicators/parabolicSAR';

// 戦略パラメータをYAML設定から取得
const DONCHIAN_PERIOD = parameterService.get<number>('trendFollowStrategy.donchianPeriod', 20);
const ADX_THRESHOLD = parameterService.get<number>('trendFollowStrategy.adxThreshold', 25);
const ATR_MULTIPLIER = parameterService.get<number>('trendFollowStrategy.atrMultiplier', 3.0);
const TRAILING_STOP_FACTOR = parameterService.get<number>('trendFollowStrategy.trailingStopFactor', 2.5);
const USE_PARABOLIC_SAR = parameterService.get<boolean>('trendFollowStrategy.useParabolicSAR', true);
const MAX_RISK_PER_TRADE = parameterService.get<number>('risk.maxRiskPerTrade', 0.02);

// エントリー後のトレイリングストップの調整
const INITIAL_STOP_ATR_FACTOR = parameterService.get<number>('trendFollowStrategy.initialStopAtrFactor', 1.5);
const BREAKEVEN_MOVE_THRESHOLD = parameterService.get<number>('trendFollowStrategy.breakevenMoveThreshold', 2.0);
const PROFIT_LOCK_THRESHOLD = parameterService.get<number>('trendFollowStrategy.profitLockThreshold', 3.0);
const PROFIT_LOCK_PERCENTAGE = parameterService.get<number>('trendFollowStrategy.profitLockPercentage', 0.5);

/**
 * Donchianチャネルを計算する関数
 * @param candles ローソク足データ
 * @param period 期間
 * @returns Donchianチャネルの上限と下限
 */
function calculateDonchian(candles: Candle[], period: number): { upper: number, lower: number } {
  // 必要なローソク足の数を確認
  if (candles.length < period) {
    throw new Error(`Donchianチャネル計算には最低${period}本のローソク足が必要です`);
  }
  
  // 指定期間内の最高値と最安値を計算
  const lookbackCandles = candles.slice(-period);
  
  let highest = -Infinity;
  let lowest = Infinity;
  
  for (const candle of lookbackCandles) {
    highest = Math.max(highest, candle.high);
    lowest = Math.min(lowest, candle.low);
  }
  
  return {
    upper: highest,
    lower: lowest
  };
}

/**
 * ATRを計算する関数（技術指標ライブラリを使用）
 * @param candles ローソク足データ
 * @param period 期間
 * @returns ATR値
 */
function calculateATR(candles: Candle[], period: number): number {
  if (candles.length < period) {
    throw new Error(`ATR計算には最低${period}本のローソク足が必要です`);
  }
  
  const atrInput = {
    high: candles.map(c => c.high),
    low: candles.map(c => c.low),
    close: candles.map(c => c.close),
    period
  };
  
  try {
    const atrValues = ATR.calculate(atrInput);
    return atrValues[atrValues.length - 1];
  } catch (error) {
    console.error('ATR計算エラー:', error);
    
    // エラーの場合は簡易計算（ローソク足の実体平均）で代用
    const recentCandles = candles.slice(-period);
    let totalRange = 0;
    
    for (const candle of recentCandles) {
      totalRange += (candle.high - candle.low);
    }
    
    return totalRange / period;
  }
}

/**
 * リスクに基づいたポジションサイズを計算
 * @param accountBalance 口座残高
 * @param entryPrice エントリー価格
 * @param stopPrice ストップ価格
 * @param riskPercentage リスク割合（デフォルト2%）
 * @returns 適切なポジションサイズ
 */
function calculateRiskBasedPositionSize(
  accountBalance: number,
  entryPrice: number,
  stopPrice: number,
  riskPercentage: number = MAX_RISK_PER_TRADE
): number {
  // ストップ距離を計算
  const stopDistance = Math.abs(entryPrice - stopPrice);
  
  // 停止距離が0に近い場合（ほぼ同じ価格）は最小ポジションを返す
  if (stopDistance < entryPrice * 0.0001) {
    return 0.01; // 最小ポジションサイズ
  }
  
  // リスク許容額を計算
  const riskAmount = accountBalance * riskPercentage;
  
  // ポジションサイズを計算 = リスク許容額 / ストップ距離
  const positionSize = riskAmount / stopDistance;
  
  // 過度に大きいポジションを制限（口座の10%以上は取らない）
  const maxPositionValue = accountBalance * 0.5;
  const positionValue = positionSize * entryPrice;
  
  if (positionValue > maxPositionValue) {
    return maxPositionValue / entryPrice;
  }
  
  return positionSize;
}

/**
 * 改良版トレンドフォロー戦略を実行する関数
 * @param candles ローソク足データ
 * @param symbol 銘柄シンボル
 * @param currentPositions 現在のポジション
 * @param accountBalance 口座残高
 * @returns 戦略の実行結果
 */
export function executeTrendFollowStrategy(
  candles: Candle[], 
  symbol: string, 
  currentPositions: Position[],
  accountBalance: number = 10000
): StrategyResult {
  // 必要なローソク足の数をチェック
  const requiredCandles = Math.max(
    DONCHIAN_PERIOD,
    MARKET_PARAMETERS.ATR_PERIOD,
    TREND_PARAMETERS.ADX_PERIOD
  ) + 10;
  
  if (candles.length < requiredCandles) {
    console.warn(`[TrendFollowStrategy] 必要なローソク足データが不足しています: ${candles.length}/${requiredCandles}`);
    return {
      strategy: StrategyType.TREND_FOLLOWING,
      signals: [],
      timestamp: Date.now()
    };
  }
  
  // 指標計算
  // 1. Donchianチャネル
  const donchian = calculateDonchian(candles, DONCHIAN_PERIOD);
  
  // 2. ADX (トレンド強度)
  const adxInput = {
    high: candles.map(c => c.high),
    low: candles.map(c => c.low),
    close: candles.map(c => c.close),
    period: TREND_PARAMETERS.ADX_PERIOD
  };
  
  const adxValues = ADX.calculate(adxInput);
  const currentAdx = adxValues[adxValues.length - 1].adx;
  
  // 3. ATR (ボラティリティ)
  const currentATR = calculateATR(candles, MARKET_PARAMETERS.ATR_PERIOD);
  
  // 4. Parabolic SAR
  let parabolicSAR: ParabolicSARResult | null = null;
  try {
    parabolicSAR = calculateParabolicSAR(candles);
  } catch (error) {
    console.warn('[TrendFollowStrategy] Parabolic SAR計算エラー:', error);
  }
  
  // 現在と前回の価格
  const currentCandle = candles[candles.length - 1];
  const previousCandle = candles[candles.length - 2];
  const currentPrice = currentCandle.close;
  const previousPrice = previousCandle.close;
  
  // 現在のポジションを確認
  const longPositions = currentPositions.filter(p => p.symbol === symbol && p.side === OrderSide.BUY);
  const shortPositions = currentPositions.filter(p => p.symbol === symbol && p.side === OrderSide.SELL);
  const hasLongPosition = longPositions.length > 0;
  const hasShortPosition = shortPositions.length > 0;
  
  // シグナルを格納する配列
  const signals: Order[] = [];
  
  // トレンドの強さ判定
  const isStrongTrend = currentAdx > ADX_THRESHOLD;
  
  // Donchianブレイクアウト判定
  const isBreakingUp = currentPrice > donchian.upper && previousPrice <= donchian.upper;
  const isBreakingDown = currentPrice < donchian.lower && previousPrice >= donchian.lower;
  
  // Parabolic SARシグナル
  const isSARBuySignal = parabolicSAR && parabolicSAR.isUptrend && !parabolicSAR.isUptrend;
  const isSARSellSignal = parabolicSAR && !parabolicSAR.isUptrend && parabolicSAR.isUptrend;
  
  // === エントリー条件 ===
  
  // 上昇ブレイクアウト + 強いトレンド => 買いエントリー
  if ((isBreakingUp && isStrongTrend) || (USE_PARABOLIC_SAR && isSARBuySignal && isStrongTrend)) {
    if (!hasLongPosition && !hasShortPosition) {
      // ATRベースのストップロス距離を計算
      const stopDistance = currentATR * INITIAL_STOP_ATR_FACTOR;
      const stopPrice = currentPrice - stopDistance;
      
      // リスクベースのポジションサイズを計算
      const positionSize = calculateRiskBasedPositionSize(
        accountBalance,
        currentPrice,
        stopPrice
      );
      
      // 市場価格での買いエントリー
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
      
      console.log(`[TrendFollowStrategy] 上昇ブレイクアウト買いシグナル: ${positionSize} @ ${currentPrice}, ストップ: ${stopPrice}`);
    }
  }
  
  // 下降ブレイクアウト + 強いトレンド => 売りエントリー
  if ((isBreakingDown && isStrongTrend) || (USE_PARABOLIC_SAR && isSARSellSignal && isStrongTrend)) {
    if (!hasShortPosition && !hasLongPosition) {
      // ATRベースのストップロス距離を計算
      const stopDistance = currentATR * INITIAL_STOP_ATR_FACTOR;
      const stopPrice = currentPrice + stopDistance;
      
      // リスクベースのポジションサイズを計算
      const positionSize = calculateRiskBasedPositionSize(
        accountBalance,
        currentPrice,
        stopPrice
      );
      
      // 市場価格での売りエントリー
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
      
      console.log(`[TrendFollowStrategy] 下降ブレイクアウト売りシグナル: ${positionSize} @ ${currentPrice}, ストップ: ${stopPrice}`);
    }
  }
  
  // === ポジション管理 ===
  
  // 既存のロングポジションの管理
  if (hasLongPosition) {
    const longPosition = longPositions[0]; // 最初のロングポジション
    
    // 現在の利益幅を計算（リスク単位R換算）
    const currentProfit = currentPrice - longPosition.entryPrice;
    const riskUnit = longPosition.entryPrice - (longPosition.stopPrice ?? (longPosition.entryPrice - currentATR * INITIAL_STOP_ATR_FACTOR));
    const profitInR = currentProfit / riskUnit;
    
    // 損益分岐点への移動条件: 2R以上の利益
    if (profitInR >= BREAKEVEN_MOVE_THRESHOLD && (longPosition.stopPrice ?? 0) < longPosition.entryPrice) {
      // ストップを損益分岐点に移動（少し余裕を持たせる）
      const newStopPrice = longPosition.entryPrice * 1.001; // エントリー価格より少し上
      
      signals.push({
        symbol,
        type: OrderType.STOP,
        side: OrderSide.SELL,
        amount: longPosition.amount,
        stopPrice: newStopPrice,
        timestamp: Date.now()
      });
      
      console.log(`[TrendFollowStrategy] ロングポジションのストップを損益分岐点に移動: ${newStopPrice}`);
    }
    // 利益確定の移動条件: 3R以上の利益
    else if (profitInR >= PROFIT_LOCK_THRESHOLD) {
      // 利益をロックするためのトレイリングストップ
      // 利益の50%をロック（パラメータで調整可能）
      const profitToLock = currentProfit * PROFIT_LOCK_PERCENTAGE;
      const newStopPrice = Math.max(
        longPosition.stopPrice ?? 0,
        currentPrice - profitToLock
      );
      
      signals.push({
        symbol,
        type: OrderType.STOP,
        side: OrderSide.SELL,
        amount: longPosition.amount,
        stopPrice: newStopPrice,
        timestamp: Date.now()
      });
      
      console.log(`[TrendFollowStrategy] ロングポジションの利益確保ストップを更新: ${newStopPrice}`);
    }
    // Parabolic SARに基づくトレイリングストップ（有効な場合）
    else if (USE_PARABOLIC_SAR && parabolicSAR && !parabolicSAR.isUptrend) {
      // SARが下降トレンドに変わったら、SARをストップとして使用
      const sarStopPrice = parabolicSAR.sar;
      
      // 既存のストップより高い場合のみ更新
      if (sarStopPrice > (longPosition.stopPrice || 0)) {
        signals.push({
          symbol,
          type: OrderType.STOP,
          side: OrderSide.SELL,
          amount: longPosition.amount,
          stopPrice: sarStopPrice,
          timestamp: Date.now()
        });
        
        console.log(`[TrendFollowStrategy] Parabolic SARベースでロングストップを更新: ${sarStopPrice}`);
      }
    }
    // ATRベースのトレイリングストップ
    else {
      // ATRベースのトレイリングストップ価格
      const atrTrailingStop = currentPrice - (currentATR * TRAILING_STOP_FACTOR);
      
      // 既存のストップより高い場合のみ更新
      if (atrTrailingStop > (longPosition.stopPrice || 0)) {
        signals.push({
          symbol,
          type: OrderType.STOP,
          side: OrderSide.SELL,
          amount: longPosition.amount,
          stopPrice: atrTrailingStop,
          timestamp: Date.now()
        });
        
        console.log(`[TrendFollowStrategy] ATRベースでロングストップを更新: ${atrTrailingStop}`);
      }
    }
  }
  
  // 既存のショートポジションの管理
  if (hasShortPosition) {
    const shortPosition = shortPositions[0]; // 最初のショートポジション
    
    // 現在の利益幅を計算（リスク単位R換算）
    const currentProfit = shortPosition.entryPrice - currentPrice;
    const riskUnit = (shortPosition.stopPrice ?? (shortPosition.entryPrice + currentATR * INITIAL_STOP_ATR_FACTOR)) - shortPosition.entryPrice;
    const profitInR = currentProfit / riskUnit;
    
    // 損益分岐点への移動条件: 2R以上の利益
    if (profitInR >= BREAKEVEN_MOVE_THRESHOLD && (shortPosition.stopPrice ?? Infinity) > shortPosition.entryPrice) {
      // ストップを損益分岐点に移動（少し余裕を持たせる）
      const newStopPrice = shortPosition.entryPrice * 0.999; // エントリー価格より少し下
      
      signals.push({
        symbol,
        type: OrderType.STOP,
        side: OrderSide.BUY,
        amount: shortPosition.amount,
        stopPrice: newStopPrice,
        timestamp: Date.now()
      });
      
      console.log(`[TrendFollowStrategy] ショートポジションのストップを損益分岐点に移動: ${newStopPrice}`);
    }
    // 利益確定の移動条件: 3R以上の利益
    else if (profitInR >= PROFIT_LOCK_THRESHOLD) {
      // 利益をロックするためのトレイリングストップ
      // 利益の50%をロック（パラメータで調整可能）
      const profitToLock = currentProfit * PROFIT_LOCK_PERCENTAGE;
      const newStopPrice = Math.min(
        shortPosition.stopPrice ?? Infinity,
        currentPrice + profitToLock
      );
      
      signals.push({
        symbol,
        type: OrderType.STOP,
        side: OrderSide.BUY,
        amount: shortPosition.amount,
        stopPrice: newStopPrice,
        timestamp: Date.now()
      });
      
      console.log(`[TrendFollowStrategy] ショートポジションの利益確保ストップを更新: ${newStopPrice}`);
    }
    // Parabolic SARに基づくトレイリングストップ（有効な場合）
    else if (USE_PARABOLIC_SAR && parabolicSAR && parabolicSAR.isUptrend) {
      // SARが上昇トレンドに変わったら、SARをストップとして使用
      const sarStopPrice = parabolicSAR.sar;
      
      // 既存のストップより低い場合のみ更新
      if (sarStopPrice < (shortPosition.stopPrice || Infinity)) {
        signals.push({
          symbol,
          type: OrderType.STOP,
          side: OrderSide.BUY,
          amount: shortPosition.amount,
          stopPrice: sarStopPrice,
          timestamp: Date.now()
        });
        
        console.log(`[TrendFollowStrategy] Parabolic SARベースでショートストップを更新: ${sarStopPrice}`);
      }
    }
    // ATRベースのトレイリングストップ
    else {
      // ATRベースのトレイリングストップ価格
      const atrTrailingStop = currentPrice + (currentATR * TRAILING_STOP_FACTOR);
      
      // 既存のストップより低い場合のみ更新
      if (atrTrailingStop < (shortPosition.stopPrice || Infinity)) {
        signals.push({
          symbol,
          type: OrderType.STOP,
          side: OrderSide.BUY,
          amount: shortPosition.amount,
          stopPrice: atrTrailingStop,
          timestamp: Date.now()
        });
        
        console.log(`[TrendFollowStrategy] ATRベースでショートストップを更新: ${atrTrailingStop}`);
      }
    }
  }
  
  return {
    strategy: StrategyType.TREND_FOLLOWING,
    signals,
    timestamp: Date.now()
  };
} 