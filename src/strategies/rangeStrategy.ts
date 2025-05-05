import { Highest, Lowest, ATR } from 'technicalindicators';
import { 
  Candle, 
  Order, 
  OrderSide, 
  OrderType, 
  Position, 
  StrategyResult, 
  StrategyType 
} from '../core/types';
import { RANGE_PARAMETERS, MARKET_PARAMETERS } from '../config/parameters';

/**
 * 特定期間の高値と安値を計算
 * @param candles ローソク足データ
 * @param period 期間
 * @returns 高値と安値
 */
function calculateRangeBoundaries(candles: Candle[], period: number): { high: number, low: number } {
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
  
  return {
    high: highestValues[highestValues.length - 1],
    low: lowestValues[lowestValues.length - 1]
  };
}

/**
 * ATR（Average True Range）を計算
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
 * ATRパーセンテージを計算（ATR/Close）
 * @param atr ATR値
 * @param closePrice 終値
 * @returns ATRパーセンテージ
 */
function calculateAtrPercentage(atr: number, closePrice: number): number {
  return (atr / closePrice) * 100;
}

/**
 * VWAP（Volume Weighted Average Price）を計算
 * @param candles ローソク足データ
 * @param period 期間
 * @returns VWAP値
 */
function calculateVWAP(candles: Candle[], period: number): number {
  // 計算に使用する期間分のデータを取得
  const recentCandles = candles.slice(-period);
  
  // 累積の（価格×ボリューム）と累積ボリュームを計算
  let cumulativePV = 0;
  let cumulativeVolume = 0;
  
  for (const candle of recentCandles) {
    // 各ローソク足の典型的な価格（(high + low + close) / 3）
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volumePrice = typicalPrice * candle.volume;
    
    cumulativePV += volumePrice;
    cumulativeVolume += candle.volume;
  }
  
  // ボリュームが0の場合は現在の価格を返す
  if (cumulativeVolume === 0) {
    return candles[candles.length - 1].close;
  }
  
  // VWAP = 累積(価格×ボリューム) / 累積ボリューム
  return cumulativePV / cumulativeVolume;
}

/**
 * 注文を分割するIceberg（氷山）注文を生成
 * @param symbol 銘柄シンボル
 * @param side 売買方向
 * @param price 価格
 * @param totalAmount 総注文量
 * @param chunks 分割数
 * @returns 分割された注文の配列
 */
function createIcebergOrders(
  symbol: string,
  side: OrderSide,
  price: number,
  totalAmount: number,
  chunks: number = 3
): Order[] {
  const orders: Order[] = [];
  const chunkSize = totalAmount / chunks;
  
  for (let i = 0; i < chunks; i++) {
    // 最後のチャンクは端数を含める
    const amount = i === chunks - 1 
      ? totalAmount - (chunkSize * (chunks - 1)) 
      : chunkSize;
    
    // 各チャンクのLIMIT注文を作成
    // 価格をわずかにずらして、順番に約定するようにする
    const chunkPrice = side === OrderSide.BUY 
      ? price * (1 - (0.0005 * i)) // 買いの場合は少しずつ安く
      : price * (1 + (0.0005 * i)); // 売りの場合は少しずつ高く
    
    orders.push({
      symbol,
      type: OrderType.LIMIT,
      side,
      price: chunkPrice,
      amount,
      timestamp: Date.now() + (i * 100) // タイムスタンプを少しずつずらす
    });
  }
  
  return orders;
}

/**
 * グリッドレベル数を動的に計算
 * @param range レンジの幅
 * @param atrPercent ATRパーセンテージ
 * @returns グリッドレベル数
 */
function calculateDynamicGridLevels(range: number, atrPercent: number): number {
  // ATR%が小さいほど（ボラティリティが低いほど）グリッドレベルを増やす
  // ATR%に設定値を掛けてレンジをどれだけの粒度に分割するかを決定
  const multiplier = RANGE_PARAMETERS.GRID_WIDTH_MULTIPLIER / 100; // 0.6/100 = 0.006
  const levelWidth = range * (atrPercent * multiplier);
  
  // 最小レベル数と最大レベル数の間の値を返す
  const levels = Math.ceil(range / levelWidth);
  return Math.max(RANGE_PARAMETERS.GRID_LEVELS_MIN, Math.min(RANGE_PARAMETERS.GRID_LEVELS_MAX, levels));
}

/**
 * グリッドレベルを計算
 * @param high 上限
 * @param low 下限
 * @param levels レベル数
 * @returns グリッドレベルの配列
 */
function calculateGridLevels(high: number, low: number, levels: number): number[] {
  const step = (high - low) / (levels + 1);
  const gridLevels = [];
  
  for (let i = 1; i <= levels; i++) {
    gridLevels.push(low + (step * i));
  }
  
  return gridLevels;
}

/**
 * レンジ戦略を実行する関数
 * @param candles ローソク足データ
 * @param symbol 銘柄シンボル
 * @param currentPositions 現在のポジション
 * @returns 戦略の実行結果
 */
export function executeRangeStrategy(
  candles: Candle[], 
  symbol: string, 
  currentPositions: Position[]
): StrategyResult {
  // データが不足している場合は空のシグナルを返す
  if (candles.length < Math.max(RANGE_PARAMETERS.RANGE_PERIOD, MARKET_PARAMETERS.ATR_PERIOD) + 10) {
    return {
      strategy: StrategyType.RANGE_TRADING,
      signals: [],
      timestamp: Date.now()
    };
  }
  
  // レンジの上限と下限を計算
  const range = calculateRangeBoundaries(candles, RANGE_PARAMETERS.RANGE_PERIOD);
  
  // レンジの幅を計算
  const rangeWidth = range.high - range.low;
  
  // ATRを計算
  const currentATR = calculateATR(candles, MARKET_PARAMETERS.ATR_PERIOD);
  
  // 現在の終値
  const currentPrice = candles[candles.length - 1].close;
  
  // ATR%を計算
  const atrPercent = calculateAtrPercentage(currentATR, currentPrice);
  
  // VWAPを計算（直近20本のローソク足を使用）
  const vwap = calculateVWAP(candles, 20);
  
  // 動的にグリッドレベル数を計算
  const gridLevelCount = calculateDynamicGridLevels(rangeWidth, atrPercent);
  
  // グリッドレベルを計算
  const gridLevels = calculateGridLevels(range.high, range.low, gridLevelCount);
  
  const previousPrice = candles[candles.length - 2].close;
  
  // シグナルを格納する配列
  const signals: Order[] = [];
  
  // 現在のポジションを確認
  const longPositions = currentPositions.filter(p => p.symbol === symbol && p.side === OrderSide.BUY);
  const shortPositions = currentPositions.filter(p => p.symbol === symbol && p.side === OrderSide.SELL);
  
  // レンジから外れた場合のポジションクローズ（改善版）
  if (currentPrice > range.high && shortPositions.length > 0) {
    // レンジ上限を超えた場合、すべての売りポジションを決済
    const totalShortAmount = shortPositions.reduce((total, pos) => total + pos.amount, 0);
    
    // VWAP + 0.1%の価格でLIMIT注文を出す（氷山注文）
    const limitPrice = vwap * 1.001; // VWAP + 0.1%
    
    // 氷山注文（分割注文）を生成して追加
    const icebergOrders = createIcebergOrders(
      symbol, 
      OrderSide.BUY, 
      limitPrice, 
      totalShortAmount,
      3 // 3分割
    );
    
    signals.push(...icebergOrders);
    
    // 一部はMARKET注文で即時決済（ポジションの30%）
    signals.push({
      symbol,
      type: OrderType.MARKET,
      side: OrderSide.BUY,
      amount: totalShortAmount * 0.3,
      timestamp: Date.now()
    });
  } else if (currentPrice < range.low && longPositions.length > 0) {
    // レンジ下限を下回った場合、すべての買いポジションを決済
    const totalLongAmount = longPositions.reduce((total, pos) => total + pos.amount, 0);
    
    // VWAP - 0.1%の価格でLIMIT注文を出す（氷山注文）
    const limitPrice = vwap * 0.999; // VWAP - 0.1%
    
    // 氷山注文（分割注文）を生成して追加
    const icebergOrders = createIcebergOrders(
      symbol, 
      OrderSide.SELL, 
      limitPrice, 
      totalLongAmount,
      3 // 3分割
    );
    
    signals.push(...icebergOrders);
    
    // 一部はMARKET注文で即時決済（ポジションの30%）
    signals.push({
      symbol,
      type: OrderType.MARKET,
      side: OrderSide.SELL,
      amount: totalLongAmount * 0.3,
      timestamp: Date.now()
    });
  }
  
  // レンジ内での取引
  // グリッドレベルごとにシグナルを生成
  for (let i = 0; i < gridLevels.length; i++) {
    const level = gridLevels[i];
    
    // ポジションサイズを動的に調整 (レベル数に応じて分割)
    const levelPositionSize = RANGE_PARAMETERS.POSITION_SIZING / gridLevelCount;
    
    // 下から上に価格が上昇してレベルを超えた場合（上昇クロス）
    if (previousPrice < level && currentPrice >= level) {
      // レンジの上半分では売り
      if (level > (range.high + range.low) / 2) {
        signals.push({
          symbol,
          type: OrderType.LIMIT,
          side: OrderSide.SELL,
          price: level,
          amount: levelPositionSize,
          timestamp: Date.now()
        });
      }
    }
    
    // 上から下に価格が下降してレベルを下回った場合（下降クロス）
    if (previousPrice > level && currentPrice <= level) {
      // レンジの下半分では買い
      if (level < (range.high + range.low) / 2) {
        signals.push({
          symbol,
          type: OrderType.LIMIT,
          side: OrderSide.BUY,
          price: level,
          amount: levelPositionSize,
          timestamp: Date.now()
        });
      }
    }
  }
  
  // レンジの上限付近での売り注文
  if (currentPrice > range.high * 0.95) {
    signals.push({
      symbol,
      type: OrderType.LIMIT,
      side: OrderSide.SELL,
      price: range.high,
      amount: RANGE_PARAMETERS.POSITION_SIZING / 2,
      timestamp: Date.now()
    });
  }
  
  // レンジの下限付近での買い注文
  if (currentPrice < range.low * 1.05) {
    signals.push({
      symbol,
      type: OrderType.LIMIT,
      side: OrderSide.BUY,
      price: range.low,
      amount: RANGE_PARAMETERS.POSITION_SIZING / 2,
      timestamp: Date.now()
    });
  }
  
  return {
    strategy: StrategyType.RANGE_TRADING,
    signals,
    timestamp: Date.now()
  };
} 