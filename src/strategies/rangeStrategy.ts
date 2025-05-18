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
      timestamp: Date.now(),
      metadata: {
        strategy: 'RangeGrid',
        icebergChunk: i + 1,
        totalChunks: chunks
      }
    });
  }

  return orders;
}

/**
 * レンジ内かどうかを判定
 * @param {number} price 価格
 * @param {number} high レンジ上限
 * @param {number} low レンジ下限
 * @param {number} buffer バッファ(%)
 * @returns {boolean} レンジ内であればtrue
 */
function isWithinRange(price, high, low, buffer = 0.01) {
  const upperBound = high * (1 + buffer);
  const lowerBound = low * (1 - buffer);
  return price <= upperBound && price >= lowerBound;
}

/**
 * 動的なグリッドレベル数を計算
 * @param {number} range レンジ幅
 * @param {number} atrPercent ATRパーセンテージ
 * @param {number} currentPrice 現在価格
 * @returns {number} グリッドレベル数
 */
function calculateDynamicGridLevels(
  range,
  atrPercent,
  currentPrice
) {
  // グリッドレベルの計算式: レンジ幅 / (ATR% × 係数)
  // ATR%が大きいほど変動が大きいため、グリッドレベルを少なくする
  const gridStep = (atrPercent * GRID_ATR_MULTIPLIER) / 100;

  // 0除算防止
  if (gridStep === 0) {
    console.warn('[RangeStrategy] グリッドステップが0になりました。デフォルト値を使用します。');
    return 5; // デフォルト値
  }

  const rangePercent = (range / currentPrice) * 100;
  const gridLevels = Math.ceil(rangePercent / gridStep);

  // 合理的な範囲に制限（最小3、最大10）
  return Math.max(3, Math.min(10, gridLevels));
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
 * レンジ取引戦略を実行
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
  // 必要なデータがない場合は空のシグナルを返す
  if (candles.length < RANGE_PARAMETERS.RANGE_PERIOD) {
    console.warn(
      `[RangeStrategy] 必要なデータが不足しています: ${candles.length} < ${RANGE_PARAMETERS.RANGE_PERIOD}`
    );
    return {
      strategy: StrategyType.RANGE_TRADING,
      signals: [],
      timestamp: Date.now()
    };
  }

  try {
    // シグナルを格納する配列
    const signals = [];

    // 現在の価格
    const currentPrice = candles[candles.length - 1].close;
    const previousPrice = candles[candles.length - 2].close;

    // レンジ境界の計算
    const rangeBoundaries = calculateRangeBoundaries(candles, RANGE_PARAMETERS.RANGE_PERIOD);
    const rangeHigh = rangeBoundaries.high * RANGE_MULTIPLIER; // 少し狭くする
    const rangeLow = rangeBoundaries.low / RANGE_MULTIPLIER;
    const rangeMid = (rangeHigh + rangeLow) / 2;

    // レンジの幅（パーセンテージ）
    const rangeWidth = rangeHigh - rangeLow;
    const rangePercentage = (rangeWidth / rangeLow) * 100;

    // ATRの計算
    const atr = calculateATR(candles, MARKET_PARAMETERS.ATR_PERIOD);
    const atrPercentage = calculateAtrPercentage(atr, currentPrice);

    // VWAPの計算
    const vwap = calculateVWAP(candles, MARKET_PARAMETERS.VWAP_PERIOD);

    // 現在価格がレンジ内かどうかを判定
    const inRange = isWithinRange(currentPrice, rangeHigh, rangeLow);

    // レンジが十分に広いかどうかをチェック
    const isRangeWideEnough = rangePercentage >= MARKET_PARAMETERS.MIN_RANGE_PERCENTAGE;

    // エスケープ条件（レンジを大きく逸脱した場合）
    const escapeLowerThreshold = rangeLow * (1 - ESCAPE_THRESHOLD);
    const escapeUpperThreshold = rangeHigh * (1 + ESCAPE_THRESHOLD);
    const isEscapeCondition =
      currentPrice < escapeLowerThreshold || currentPrice > escapeUpperThreshold;

    // 現在のポジションを取得
    const positions = currentPositions.filter((p) => p.symbol === symbol);
    const longPositions = positions.filter((p) => p.side === OrderSide.BUY);
    const shortPositions = positions.filter((p) => p.side === OrderSide.SELL);

    // 現在のポジション量
    const longAmount = longPositions.reduce((sum, p) => sum + p.amount, 0);
    const shortAmount = shortPositions.reduce((sum, p) => sum + p.amount, 0);
    const netPosition = longAmount - shortAmount;

    console.log(
      `[RangeStrategy] 状態: 価格=${currentPrice.toFixed(2)}, レンジ=${rangeLow.toFixed(
        2
      )}〜${rangeHigh.toFixed(2)}, ATR=${atr.toFixed(2)}(${atrPercentage.toFixed(2)}%), VWAP=${vwap.toFixed(2)}`
    );
    console.log(
      `[RangeStrategy] ポジション: ${symbol} ロング=${longAmount.toFixed(4)}, ショート=${shortAmount.toFixed(4)}, ネット=${netPosition.toFixed(4)}`
    );

    // エスケープ条件の場合、すべてのポジションを決済
    if (isEscapeCondition && positions.length > 0) {
      console.log(
        `[RangeStrategy] エスケープ条件発動: 現在価格=${currentPrice.toFixed(2)}, 範囲=${escapeLowerThreshold.toFixed(2)}〜${escapeUpperThreshold.toFixed(2)}`
      );

      // ロングポジションがある場合は売り決済
      if (longAmount > 0) {
        signals.push({
          symbol,
          type: OrderType.MARKET,
          side: OrderSide.SELL,
          amount: longAmount,
          timestamp: Date.now(),
          metadata: {
            strategy: 'RangeEscape',
            reason: 'RangeBreakout'
          }
        });
      }

      // ショートポジションがある場合は買い決済
      if (shortAmount > 0) {
        signals.push({
          symbol,
          type: OrderType.MARKET,
          side: OrderSide.BUY,
          amount: shortAmount,
          timestamp: Date.now(),
          metadata: {
            strategy: 'RangeEscape',
            reason: 'RangeBreakout'
          }
        });
      }

      return {
        strategy: StrategyType.RANGE_TRADING,
        signals,
        timestamp: Date.now(),
        metadata: {
          currentPrice,
          rangeHigh,
          rangeLow,
          atr,
          atrPercentage,
          vwap,
          inRange,
          isEscapeCondition
        }
      };
    }

    // レンジ条件を満たさない場合は終了
    if (!inRange || !isRangeWideEnough) {
      console.log('[RangeStrategy] レンジ条件を満たしません。新規注文はありません。');
      return {
        strategy: StrategyType.RANGE_TRADING,
        signals: [],
        timestamp: Date.now(),
        metadata: {
          currentPrice,
          rangeHigh,
          rangeLow,
          atr,
          atrPercentage,
          vwap,
          inRange,
          isRangeWideEnough
        }
      };
    }

    // 動的なグリッドレベル数を計算
    const gridLevelCount = calculateDynamicGridLevels(rangeWidth, atrPercentage, currentPrice);
    console.log(`[RangeStrategy] 計算されたグリッドレベル数: ${gridLevelCount}`);

    // グリッドレベルを計算
    const gridLevels = calculateGridLevels(rangeHigh, rangeLow, gridLevelCount);

    // グリッドレベルごとにシグナルを生成
    for (let i = 0; i < gridLevels.length; i++) {
      const level = gridLevels[i];
      const levelRatio = i / (gridLevels.length - 1); // 0〜1の値（0=最下位、1=最上位）

      // 上昇クロス（価格が下からレベルを上抜けた）
      const isUpwardCross = previousPrice < level && currentPrice >= level;

      // 下降クロス（価格が上からレベルを下抜けた）
      const isDownwardCross = previousPrice > level && currentPrice <= level;

      // グリッドレベルのクロスがあった場合
      if (isUpwardCross || isDownwardCross) {
        // 注文量の調整（上方レベルほど売りを大きく、下方レベルほど買いを大きく）
        const positionSize = RANGE_PARAMETERS.BASE_POSITION_SIZE * (isUpwardCross ? 1 - levelRatio : levelRatio) * 1.5;

        // 上昇クロスで上方レベル（売り）または下降クロスで下方レベル（買い）
        const orderSide = isUpwardCross && levelRatio > 0.5 ? OrderSide.SELL : isDownwardCross && levelRatio < 0.5 ? OrderSide.BUY : null;

        if (orderSide) {
          console.log(
            `[RangeStrategy] ${isUpwardCross ? '上昇' : '下降'}クロス: レベル${i + 1}/${
              gridLevels.length
            } (${level.toFixed(2)}), ${orderSide === OrderSide.BUY ? '買い' : '売り'}注文生成`
          );

          // 氷山注文を生成
          const icebergOrders = createIcebergOrders(symbol, orderSide, level, positionSize);
          signals.push(...icebergOrders);
        }
      }
    }

    // レンジ端での逆張り注文
    if (currentPrice >= rangeHigh * 0.98 && currentPrice <= rangeHigh) {
      // レンジ上限に近い場合は売り
      console.log(`[RangeStrategy] レンジ上限付近: ${currentPrice.toFixed(2)}/${rangeHigh.toFixed(2)}, 売り`);
      const positionSize = RANGE_PARAMETERS.BASE_POSITION_SIZE * 1.2; // 少し大きめの注文
      signals.push({
        symbol,
        type: OrderType.LIMIT,
        side: OrderSide.SELL,
        price: rangeHigh,
        amount: positionSize,
        timestamp: Date.now(),
        metadata: {
          strategy: 'RangeBoundary',
          level: 'UpperBound'
        }
      });
    } else if (currentPrice <= rangeLow * 1.02 && currentPrice >= rangeLow) {
      // レンジ下限に近い場合は買い
      console.log(`[RangeStrategy] レンジ下限付近: ${currentPrice.toFixed(2)}/${rangeLow.toFixed(2)}, 買い`);
      const positionSize = RANGE_PARAMETERS.BASE_POSITION_SIZE * 1.2; // 少し大きめの注文
      signals.push({
        symbol,
        type: OrderType.LIMIT,
        side: OrderSide.BUY,
        price: rangeLow,
        amount: positionSize,
        timestamp: Date.now(),
        metadata: {
          strategy: 'RangeBoundary',
          level: 'LowerBound'
        }
      });
    }

    return {
      strategy: StrategyType.RANGE_TRADING,
      signals,
      timestamp: Date.now(),
      metadata: {
        currentPrice,
        rangeHigh,
        rangeLow,
        atr,
        atrPercentage,
        vwap,
        gridLevels,
        inRange,
        netPosition
      }
    };
  } catch (error) {
    console.error(`[RangeStrategy] エラー: ${error}`);
    return {
      strategy: StrategyType.RANGE_TRADING,
      signals: [],
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// CommonJS形式でのエクスポート
module.exports = {
  executeRangeStrategy,
  calculateRangeBoundaries,
  calculateATR,
  calculateVWAP,
  calculateGridLevels,
  isWithinRange,
  calculateDynamicGridLevels,
  createIcebergOrders
};
