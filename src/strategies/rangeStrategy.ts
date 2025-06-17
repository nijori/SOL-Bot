/**
 * レンジ取引戦略の実装
 * レンジ内でのグリッド取引とブレイクアウト時のエスケープシステム
 * 
 * INF-032-2: 戦略ディレクトリのCommonJS変換
 */
// @ts-nocheck

// CommonJS形式のモジュールインポート
const technicalIndicators = require('technicalindicators');
const { Highest, Lowest, ATR } = technicalIndicators;
const Types = require('../core/types');
const { Candle, Order, OrderSide, OrderType, Position, StrategyResult, StrategyType } = Types;
const { RANGE_PARAMETERS, MARKET_PARAMETERS } = require('../config/parameters');
const { parameterService } = require('../config/parameterService');

// グリッド関連のパラメータをYAML設定から取得
const GRID_ATR_MULTIPLIER = parameterService.get('rangeStrategy.gridAtrMultiplier', 0.6);
const RANGE_MULTIPLIER = parameterService.get('rangeStrategy.rangeMultiplier', 0.9);
const MIN_SPREAD_PERCENTAGE = parameterService.get(
  'rangeStrategy.minSpreadPercentage',
  0.3
);
const ESCAPE_THRESHOLD = parameterService.get('rangeStrategy.escapeThreshold', 0.02);

// ATR==0の場合のフォールバック設定
const DEFAULT_ATR_PERCENTAGE = parameterService.get('risk.defaultAtrPercentage', 0.02);
const MIN_ATR_VALUE = parameterService.get('risk.minAtrValue', 0.0001);

/**
 * 特定期間の高値と安値を計算
 * @param {Array} candles ローソク足データ
 * @param {number} period 期間
 * @returns {Object} 高値と安値
 */
function calculateRangeBoundaries(
  candles,
  period
) {
  const highValues = candles.slice(-period).map((c) => c.high);
  const lowValues = candles.slice(-period).map((c) => c.low);

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
 * @param {Array} candles ローソク足データ
 * @param {number} period 期間
 * @returns {number} ATR値
 */
function calculateATR(candles, period) {
  if (candles.length < period) {
    console.warn('[RangeStrategy] ATR計算に必要なローソク足データが不足しています');
    // デフォルト値として現在価格の2%を返す
    return candles[candles.length - 1].close * DEFAULT_ATR_PERCENTAGE;
  }

  const atrInput = {
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
    period
  };

  try {
    const atrValues = ATR.calculate(atrInput);
    const currentAtr = atrValues[atrValues.length - 1];

    // ATRが0または非常に小さい値の場合のフォールバック
    if (currentAtr === 0 || currentAtr < candles[candles.length - 1].close * MIN_ATR_VALUE) {
      console.warn('[RangeStrategy] ATR値が0または非常に小さいため、フォールバック値を使用');
      // 現在価格のデフォルトパーセンテージをATRとして使用
      const fallbackAtr = candles[candles.length - 1].close * DEFAULT_ATR_PERCENTAGE;
      console.log(
        `[RangeStrategy] フォールバックATR: ${fallbackAtr} (${DEFAULT_ATR_PERCENTAGE * 100}%)`
      );
      return fallbackAtr;
    }

    return currentAtr;
  } catch (error) {
    console.error('[RangeStrategy] ATR計算エラー:', error);

    // エラーの場合は簡易計算（ローソク足の実体平均）で代用
    const recentCandles = candles.slice(-period);
    let totalRange = 0;

    for (const candle of recentCandles) {
      totalRange += candle.high - candle.low;
    }

    const calculatedAtr = totalRange / period;

    // 計算されたATRが0または非常に小さい場合もフォールバックを使用
    if (calculatedAtr === 0 || calculatedAtr < candles[candles.length - 1].close * MIN_ATR_VALUE) {
      // 現在価格のデフォルトパーセンテージをATRとして使用
      const fallbackAtr = candles[candles.length - 1].close * DEFAULT_ATR_PERCENTAGE;
      console.log(
        `[RangeStrategy] 計算されたATRが小さすぎるため、フォールバック使用: ${fallbackAtr}`
      );
      return fallbackAtr;
    }

    return calculatedAtr;
  }
}

/**
 * ATRパーセンテージを計算（ATR/Close）
 * @param {number} atr ATR値
 * @param {number} closePrice 終値
 * @returns {number} ATRパーセンテージ
 */
function calculateAtrPercentage(atr, closePrice) {
  // 0除算防止
  if (closePrice === 0 || isNaN(closePrice)) {
    console.warn('[RangeStrategy] ATR%計算の分母（closePrice）が0またはNaNです');
    return DEFAULT_ATR_PERCENTAGE * 100; // デフォルト値として2%を返す
  }

  return (atr / closePrice) * 100;
}

/**
 * VWAP（Volume Weighted Average Price）を計算
 * @param {Array} candles ローソク足データ
 * @param {number} period 期間
 * @returns {number} VWAP値
 */
function calculateVWAP(candles, period) {
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
 * @param {string} symbol 銘柄シンボル
 * @param {string} side 売買方向
 * @param {number} price 価格
 * @param {number} totalAmount 総注文量
 * @param {number} chunks 分割数
 * @returns {Array} 分割された注文の配列
 */
function createIcebergOrders(
  symbol,
  side,
  price,
  totalAmount,
  chunks = 3
) {
  const orders = [];
  const chunkSize = totalAmount / chunks;

  for (let i = 0; i < chunks; i++) {
    // 最後のチャンクは端数を含める
    const amount = i === chunks - 1 ? totalAmount - chunkSize * (chunks - 1) : chunkSize;

    // 各チャンクのLIMIT注文を作成
    // 価格をわずかにずらして、順番に約定するようにする
    const chunkPrice =
      side === OrderSide.BUY
        ? price * (1 - 0.0005 * i) // 買いの場合は少しずつ安く
        : price * (1 + 0.0005 * i); // 売りの場合は少しずつ高く

    orders.push({
      symbol,
      type: OrderType.LIMIT,
      side,
      price: chunkPrice,
      amount,
      timestamp: Date.now()
    });
  }

  return orders;
}

/**
 * レンジ内かどうか判定
 * @param {number} price 判定する価格
 * @param {number} high レンジ上限
 * @param {number} low レンジ下限
 * @param {number} buffer バッファ（%）
 * @returns {boolean} レンジ内かどうか
 */
function isWithinRange(price, high, low, buffer = 0.01) {
  const upperBound = high * (1 + buffer);
  const lowerBound = low * (1 - buffer);

  return price >= lowerBound && price <= upperBound;
}

/**
 * グリッドレベル数を動的に計算
 * @param {number} range レンジの幅
 * @param {number} atrPercent ATRパーセンテージ
 * @param {number} currentPrice 現在価格
 * @returns {number} グリッドレベル数
 */
function calculateDynamicGridLevels(
  range,
  atrPercent,
  currentPrice
) {
  // 安全対策：ATRがゼロまたは非常に小さい場合のフォールバック
  const safeAtrPercent = atrPercent > 0.1 ? atrPercent : 2.0;

  // レンジ内に配置するグリッド数の計算
  // ATR%が大きいほど少ないグリッド数に（ボラティリティが高い時は少なめに）
  const baseGrids = Math.ceil(range / (safeAtrPercent * GRID_ATR_MULTIPLIER * currentPrice / 100));

  // 合理的な範囲に制限（3〜10）
  const gridLevels = Math.max(3, Math.min(10, baseGrids));

  console.log(
    `[RangeStrategy] 動的グリッドレベル計算: range=${range}, ATR%=${safeAtrPercent}, グリッド数=${gridLevels}`
  );

  return gridLevels;
}

/**
 * グリッドレベルを計算
 * @param {number} high レンジ上限
 * @param {number} low レンジ下限
 * @param {number} levels グリッドレベル数
 * @returns {Array} グリッドレベルの配列
 */
function calculateGridLevels(high, low, levels) {
  const step = (high - low) / (levels + 1);
  const gridLevels = [];

  for (let i = 1; i <= levels; i++) {
    gridLevels.push(low + step * i);
  }

  return gridLevels;
}

/**
 * レンジ戦略を実行する関数
 * @param {Array} candles ローソク足データ
 * @param {string} symbol 銘柄シンボル
 * @param {Array} currentPositions 現在のポジション
 * @returns {Object} 戦略の実行結果
 */
function executeRangeStrategy(
  candles,
  symbol,
  currentPositions
) {
  // データが十分にあるか確認
  if (candles.length < RANGE_PARAMETERS.PERIOD + 10) {
    console.warn(
      `[RangeStrategy] 十分なローソク足データがありません: ${candles.length}/${
        RANGE_PARAMETERS.PERIOD + 10
      }`
    );
    return {
      strategy: StrategyType.RANGE,
      signals: [],
      timestamp: Date.now()
    };
  }

  try {
    // シグナル配列の初期化
    const signals = [];

    // 現在の価格
    const currentPrice = candles[candles.length - 1].close;

    // レンジの境界を計算
    const rangeBoundaries = calculateRangeBoundaries(candles, RANGE_PARAMETERS.PERIOD);
    const rangeHigh = rangeBoundaries.high;
    const rangeLow = rangeBoundaries.low;

    // レンジの大きさ（％）を計算
    const rangeSize = (rangeHigh - rangeLow) / rangeLow * 100;

    // ATRを計算
    const atr = calculateATR(candles, MARKET_PARAMETERS.ATR_PERIOD);
    const atrPercent = calculateAtrPercentage(atr, currentPrice);

    // レンジが十分に確立されているか確認
    const isRangeValid = rangeSize >= RANGE_PARAMETERS.MIN_RANGE_SIZE;

    // 現在の価格がレンジ内かどうか確認
    const inRange = isWithinRange(currentPrice, rangeHigh, rangeLow);

    // VWAPを計算
    const vwap = calculateVWAP(candles, 20);
    const isAboveVWAP = currentPrice > vwap;

    // レンジが有効で、かつ価格がレンジ内にある場合
    if (isRangeValid && inRange) {
      // 動的にグリッドレベル数を計算
      const gridLevels = calculateDynamicGridLevels(rangeHigh - rangeLow, atrPercent, currentPrice);

      // グリッドレベルを計算
      const levels = calculateGridLevels(rangeHigh, rangeLow, gridLevels);

      // 各レベルを回り、現在の価格に対して注文を生成
      levels.forEach((level) => {
        // 価格レベルと現在価格の距離を計算
        const distance = Math.abs(level - currentPrice);
        const distancePercent = (distance / currentPrice) * 100;

        // 十分に離れたレベルのみ注文を生成
        if (distancePercent >= MIN_SPREAD_PERCENTAGE) {
          // 距離に応じた注文量を計算（距離が大きいほど大きなサイズ）
          // ベースサイズを設定（例: 口座残高の2%）
          const baseSize = 0.02;
          // 距離に応じた係数（距離が大きいほど注文量を増やす）
          const distanceFactor = 1 + distancePercent / 5; // 例: 5%離れたら1.01倍、10%離れたら1.02倍...
          const orderSize = baseSize * distanceFactor;

          // 現在価格よりも高いレベルには売り注文、低いレベルには買い注文
          const side = level > currentPrice ? OrderSide.SELL : OrderSide.BUY;

          // Iceberg注文を生成（大きなサイズを複数の小さな注文に分割）
          const orders = createIcebergOrders(symbol, side, level, orderSize);
          signals.push(...orders);
        }
      });

      // レンジの中央付近では、VWAPを基準に追加の注文を生成
      const rangeMiddle = (rangeHigh + rangeLow) / 2;
      const isNearMiddle = Math.abs(currentPrice - rangeMiddle) / rangeMiddle < 0.02; // 中央から2%以内

      if (isNearMiddle) {
        if (isAboveVWAP) {
          // VWAP以上なら売り注文を追加
          signals.push({
            symbol,
            type: OrderType.LIMIT,
            side: OrderSide.SELL,
            price: currentPrice * 1.005, // 現在価格+0.5%
            amount: 0.02,
            timestamp: Date.now(),
            metadata: {
              reason: 'Above VWAP, Near Middle'
            }
          });
        } else {
          // VWAP未満なら買い注文を追加
          signals.push({
            symbol,
            type: OrderType.LIMIT,
            side: OrderSide.BUY,
            price: currentPrice * 0.995, // 現在価格-0.5%
            amount: 0.02,
            timestamp: Date.now(),
            metadata: {
              reason: 'Below VWAP, Near Middle'
            }
          });
        }
      }
    }
    // レンジ外にある場合（ブレイクアウト）
    else if (isRangeValid && !inRange) {
      // ブレイクアウトの方向を判定
      const isBreakingUp = currentPrice > rangeHigh;
      const isBreakingDown = currentPrice < rangeLow;

      if (isBreakingUp) {
        // 上方ブレイクアウト - レンジの上限より上に移動した場合
        // 既存の買いポジションを維持し、売りポジションを決済する
        // さらに、上昇トレンドに乗るための買い注文を追加
        signals.push({
          symbol,
          type: OrderType.MARKET,
          side: OrderSide.BUY,
          amount: 0.02, // 小さいサイズで様子見（1%〜2%程度）
          timestamp: Date.now(),
          metadata: {
            reason: 'Upper Breakout'
          }
        });

        // ブレイクアウトを追いかけるトレーリングストップ注文を設定
        signals.push({
          symbol,
          type: OrderType.STOP,
          side: OrderSide.SELL,
          price: rangeHigh * 0.99, // ブレイクアウトレベルの少し下
          amount: 0.02,
          timestamp: Date.now(),
          metadata: {
            reason: 'Breakout Trailing Stop'
          }
        });
      } else if (isBreakingDown) {
        // 下方ブレイクアウト - レンジの下限より下に移動した場合
        // 既存の売りポジションを維持し、買いポジションを決済する
        // さらに、下降トレンドに乗るための売り注文を追加
        signals.push({
          symbol,
          type: OrderType.MARKET,
          side: OrderSide.SELL,
          amount: 0.02, // 小さいサイズで様子見（1%〜2%程度）
          timestamp: Date.now(),
          metadata: {
            reason: 'Lower Breakout'
          }
        });

        // ブレイクアウトを追いかけるトレーリングストップ注文を設定
        signals.push({
          symbol,
          type: OrderType.STOP,
          side: OrderSide.BUY,
          price: rangeLow * 1.01, // ブレイクアウトレベルの少し上
          amount: 0.02,
          timestamp: Date.now(),
          metadata: {
            reason: 'Breakout Trailing Stop'
          }
        });
      }
    }

    // 保有ポジションに応じたヘッジ注文を生成
    // 現在のポジションを確認
    const symbolPositions = currentPositions.filter((p) => p.symbol === symbol);
    
    if (symbolPositions.length > 0) {
      // 買いポジションと売りポジションに分類
      const buyPositions = symbolPositions.filter((p) => p.side === OrderSide.BUY);
      const sellPositions = symbolPositions.filter((p) => p.side === OrderSide.SELL);
      
      // 合計量を計算
      const totalBuyAmount = buyPositions.reduce((sum, p) => sum + p.amount, 0);
      const totalSellAmount = sellPositions.reduce((sum, p) => sum + p.amount, 0);
      
      // 偏りがあるか確認（買い越しまたは売り越し）
      const netAmount = totalBuyAmount - totalSellAmount;
      const netRatio = Math.abs(netAmount) / (totalBuyAmount + totalSellAmount);
      
      // 偏りが大きい場合（30%以上）、反対方向のヘッジ注文を発行
      if (netRatio > 0.3) {
        const hedgeSide = netAmount > 0 ? OrderSide.SELL : OrderSide.BUY;
        const hedgeAmount = Math.abs(netAmount) * 0.5; // 偏りの半分をヘッジ
        
        signals.push({
          symbol,
          type: OrderType.LIMIT,
          side: hedgeSide,
          price: hedgeSide === OrderSide.BUY ? currentPrice * 0.99 : currentPrice * 1.01,
          amount: hedgeAmount,
          timestamp: Date.now(),
          metadata: {
            reason: 'Position Imbalance Hedge'
          }
        });
      }
    }

    return {
      strategy: StrategyType.RANGE,
      signals,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error(`[RangeStrategy] エラー発生: ${error.message}`);
    return {
      strategy: StrategyType.RANGE,
      signals: [],
      timestamp: Date.now(),
      error: error.message
    };
  }
}

// CommonJS形式でエクスポート
module.exports = {
  executeRangeStrategy,
  calculateRangeBoundaries,
  calculateATR,
  calculateAtrPercentage,
  calculateVWAP,
  calculateDynamicGridLevels,
  calculateGridLevels,
  isWithinRange,
  createIcebergOrders
};
