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
import { TREND_PARAMETERS, RISK_PARAMETERS } from '../config/parameters';
import logger from '../utils/logger';

/**
 * ドンチャンチャネルを計算する関数
 * @param candles ローソク足データ
 * @param period 期間
 * @returns ドンチャンチャネルの上限、下限、中央値
 */
export function calculateDonchian(candles: Candle[], period: number): { upper: number, lower: number, middle: number } {
  // 必要なデータがない場合はエラー値を返す
  if (candles.length < period) {
    logger.warn(`[DonchianStrategy] 必要なデータが不足しています: ${candles.length} < ${period}`);
    return { upper: 0, lower: 0, middle: 0 };
  }
  
  // 期間内の最高値と最低値を計算
  const highValues = candles.slice(-period).map(c => c.high);
  const lowValues = candles.slice(-period).map(c => c.low);
  
  const highestInput = {
    period,
    values: highValues
  };
  
  const lowestInput = {
    period,
    values: lowValues
  };
  
  const highestValues = Highest.calculate(highestInput);
  const lowestValues = Lowest.calculate(lowestInput);
  
  // 最新の値を取得
  const upper = highestValues[highestValues.length - 1];
  const lower = lowestValues[lowestValues.length - 1];
  const middle = (upper + lower) / 2;
  
  return { upper, lower, middle };
}

/**
 * ATRを計算する関数
 * @param candles ローソク足データ
 * @param period 期間
 * @returns ATR値
 */
function calculateATR(candles: Candle[], period: number): number {
  if (candles.length < period) {
    return 0;
  }
  
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
 * @returns ポジションサイズ
 */
function calculateRiskBasedPositionSize(
  accountBalance: number, 
  entryPrice: number, 
  stopPrice: number
): number {
  // リスク距離（エントリーからストップまでの距離）
  const riskDistance = Math.abs(entryPrice - stopPrice);
  
  // 距離がゼロの場合はデフォルト値を返す
  if (riskDistance === 0) {
    return 0;
  }
  
  // 許容リスク額（口座残高の一定割合）
  const riskAmount = accountBalance * RISK_PARAMETERS.MAX_RISK_PER_TRADE;
  
  // ポジションサイズ = リスク額 / リスク距離
  const positionSize = riskAmount / riskDistance;
  
  return positionSize;
}

/**
 * Donchianブレイクアウト戦略を実行する関数
 * @param candles ローソク足データ
 * @param symbol 銘柄シンボル
 * @param currentPositions 現在のポジション
 * @param accountBalance 口座残高
 * @returns 戦略の実行結果
 */
export function executeDonchianBreakoutStrategy(
  candles: Candle[], 
  symbol: string, 
  currentPositions: Position[],
  accountBalance: number
): StrategyResult {
  // 必要なデータが不足している場合は空の結果を返す
  const requiredPeriod = Math.max(
    TREND_PARAMETERS.DONCHIAN_PERIOD,
    TREND_PARAMETERS.ADX_PERIOD
  ) + 10;
  
  if (candles.length < requiredPeriod) {
    logger.warn(`[DonchianStrategy] 必要なデータが不足しています: ${candles.length} < ${requiredPeriod}`);
    return {
      strategy: StrategyType.TREND_FOLLOWING,
      signals: [],
      timestamp: Date.now()
    };
  }
  
  // Donchianチャネルを計算
  const donchian = calculateDonchian(candles, TREND_PARAMETERS.DONCHIAN_PERIOD);
  
  // ATRを計算（ストップロス、ポジションサイズの計算に使用）
  const currentATR = calculateATR(candles, TREND_PARAMETERS.ADX_PERIOD);
  
  // ADXを計算（トレンドの強さを確認）
  const adxInput = {
    high: candles.map(c => c.high),
    low: candles.map(c => c.low),
    close: candles.map(c => c.close),
    period: TREND_PARAMETERS.ADX_PERIOD
  };
  
  const adxValues = ADX.calculate(adxInput);
  const currentADX = adxValues[adxValues.length - 1].adx;
  
  // 現在と前回の価格
  const currentPrice = candles[candles.length - 1].close;
  const previousPrice = candles[candles.length - 2].close;
  
  // シグナルを格納する配列
  const signals: Order[] = [];
  
  // 現在のポジションを確認
  const longPosition = currentPositions.find(p => p.symbol === symbol && p.side === OrderSide.BUY);
  const shortPosition = currentPositions.find(p => p.symbol === symbol && p.side === OrderSide.SELL);
  
  // トレンドの強さが十分かチェック
  const isStrongTrend = currentADX > TREND_PARAMETERS.ADX_THRESHOLD;
  
  // 上昇ブレイクアウトを検出（前回の価格がチャネル上限以下、現在の価格がチャネル上限より上）
  const isBreakingUp = previousPrice <= donchian.upper && currentPrice > donchian.upper;
  
  // 下降ブレイクアウトを検出（前回の価格がチャネル下限以上、現在の価格がチャネル下限より下）
  const isBreakingDown = previousPrice >= donchian.lower && currentPrice < donchian.lower;
  
  // 上昇ブレイクアウトで強いトレンドがあり、ロングポジションがない場合
  if (isBreakingUp && isStrongTrend && !longPosition) {
    // ATRベースのストップロス価格
    const stopPrice = currentPrice - (currentATR * TREND_PARAMETERS.ATR_TRAILING_STOP_MULTIPLIER);
    
    // リスクベースのポジションサイズを計算
    const positionSize = calculateRiskBasedPositionSize(
      accountBalance,
      currentPrice,
      stopPrice
    );
    
    // 買いシグナル（エントリー注文）
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
    
    logger.info(`[DonchianStrategy] 上昇ブレイクアウト検出: ${symbol} @ ${currentPrice}, ストップ: ${stopPrice}`);
  }
  
  // 下降ブレイクアウトで強いトレンドがあり、ショートポジションがない場合
  if (isBreakingDown && isStrongTrend && !shortPosition) {
    // ATRベースのストップロス価格
    const stopPrice = currentPrice + (currentATR * TREND_PARAMETERS.ATR_TRAILING_STOP_MULTIPLIER);
    
    // リスクベースのポジションサイズを計算
    const positionSize = calculateRiskBasedPositionSize(
      accountBalance,
      currentPrice,
      stopPrice
    );
    
    // 売りシグナル（エントリー注文）
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
    
    logger.info(`[DonchianStrategy] 下降ブレイクアウト検出: ${symbol} @ ${currentPrice}, ストップ: ${stopPrice}`);
  }
  
  // 既存のポジションがある場合のトレーリングストップ更新
  if (longPosition) {
    // 利益が1R以上になった場合、トレーリングストップを更新
    const profitR = (currentPrice - longPosition.entryPrice) / currentATR;
    
    if (profitR >= 1) {
      const newStopPrice = currentPrice - (currentATR * TREND_PARAMETERS.ATR_TRAILING_STOP_MULTIPLIER);
      
      signals.push({
        symbol,
        type: OrderType.STOP,
        side: OrderSide.SELL,
        amount: longPosition.amount,
        stopPrice: newStopPrice,
        timestamp: Date.now()
      });
      
      logger.info(`[DonchianStrategy] ロングポジションのトレーリングストップ更新: ${symbol} @ ${newStopPrice}`);
    }
  }
  
  if (shortPosition) {
    // 利益が1R以上になった場合、トレーリングストップを更新
    const profitR = (shortPosition.entryPrice - currentPrice) / currentATR;
    
    if (profitR >= 1) {
      const newStopPrice = currentPrice + (currentATR * TREND_PARAMETERS.ATR_TRAILING_STOP_MULTIPLIER);
      
      signals.push({
        symbol,
        type: OrderType.STOP,
        side: OrderSide.BUY,
        amount: shortPosition.amount,
        stopPrice: newStopPrice,
        timestamp: Date.now()
      });
      
      logger.info(`[DonchianStrategy] ショートポジションのトレーリングストップ更新: ${symbol} @ ${newStopPrice}`);
    }
  }
  
  return {
    strategy: StrategyType.TREND_FOLLOWING,
    signals,
    timestamp: Date.now()
  };
} 