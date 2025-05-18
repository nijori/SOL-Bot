/**
 * レンジ/ミーンリバースエンジンの実装
 * DonchianRange基準のグリッド注文、Maker-only Limit注文方式、ポジション上限とエスケープ条件
 * 
 * INF-032-2: 戦略ディレクトリのCommonJS変換
 */
// @ts-nocheck

// CommonJS形式のモジュールインポート
const technicalIndicators = require('technicalindicators');
const { Highest, Lowest, ATR } = technicalIndicators;
const Types = require('../core/types');
const { Candle, Order, OrderSide, OrderType, Position, StrategyResult, StrategyType } = Types;
const { RANGE_PARAMETERS, MARKET_PARAMETERS, RISK_PARAMETERS } = require('../config/parameters');
const { parameterService } = require('../config/parameterService');
const { calculateVWAP } = require('../indicators/marketState');

// 戦略設計書に基づくパラメータをYAML設定から取得
const RANGE_PERIOD = parameterService.get('rangeStrategy.rangePeriod', 30);
const RANGE_MULTIPLIER = parameterService.get('rangeStrategy.rangeMultiplier', 0.9);
const GRID_ATR_MULTIPLIER = parameterService.get('rangeStrategy.gridAtrMultiplier', 0.6);
const MIN_SPREAD_PERCENTAGE = parameterService.get(
  'rangeStrategy.minSpreadPercentage',
  0.3
);
const ESCAPE_THRESHOLD = parameterService.get('rangeStrategy.escapeThreshold', 0.02);
const MAX_POSITION_SIZE = parameterService.get('riskManagement.maxPositionSize', 0.35);
const NET_POSITION_DELTA_MAX = parameterService.get(
  'rangeStrategy.netPositionDeltaMax',
  0.15
);

/**
 * Donchianチャネル（最高値・最安値）を計算
 * @param {Array} candles ローソク足データ
 * @param {number} period 期間
 * @returns {Object} Donchianの上限と下限
 */
function calculateDonchianChannel(
  candles,
  period
) {
  if (candles.length < period) {
    throw new Error(`Donchianチャネル計算には最低${period}本のローソク足が必要です`);
  }

  const highValues = candles.slice(-period).map((c) => c.high);
  const lowValues = candles.slice(-period).map((c) => c.low);

  const highestInput = { period, values: highValues };
  const lowestInput = { period, values: lowValues };

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
    throw new Error(`ATR計算には最低${period}本のローソク足が必要です`);
  }

  const atrInput = {
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
    period
  };

  const atrValues = ATR.calculate(atrInput);
  return atrValues[atrValues.length - 1];
}

/**
 * ATRパーセンテージを計算（ATR/Close）
 * @param {number} atr ATR値
 * @param {number} closePrice 終値
 * @returns {number} ATRパーセンテージ
 */
function calculateAtrPercentage(atr, closePrice) {
  return (atr / closePrice) * 100;
}

/**
 * グリッドレベル数を動的に計算（戦略設計書の公式を使用）
 * @param {number} range レンジの幅
 * @param {number} atrPercent ATRパーセンテージ
 * @returns {number} グリッドレベル数
 */
function calculateDynamicGridLevels(range, atrPercent) {
  // 戦略設計書の公式: ceil(Range / (ATR%×0.6))
  const gridLevels = Math.ceil(range / ((atrPercent * GRID_ATR_MULTIPLIER) / 100));

  // 合理的な範囲に制限（3〜10）
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
 * Maker-only Limit注文を生成
 * @param {string} symbol 銘柄シンボル
 * @param {string} side 注文方向
 * @param {number} price 基準価格
 * @param {number} amount 注文量
 * @param {number} spreadPercentage スプレッド（％）
 * @returns {Object} Maker-only Limit注文
 */
function createMakerOnlyLimitOrder(
  symbol,
  side,
  price,
  amount,
  spreadPercentage = MIN_SPREAD_PERCENTAGE
) {
  // 買い注文の場合は指値を下げ、売り注文の場合は指値を上げる
  const adjustedPrice =
    side === OrderSide.BUY
      ? price * (1 - spreadPercentage / 100) // 買い注文は現在価格よりも低く
      : price * (1 + spreadPercentage / 100); // 売り注文は現在価格よりも高く

  return {
    symbol,
    type: OrderType.LIMIT,
    side,
    price: adjustedPrice,
    amount,
    timestamp: Date.now()
  };
}

/**
 * 注文を分割するIceberg（氷山）注文を生成
 * @param {string} symbol 銘柄シンボル
 * @param {string} side 注文方向
 * @param {number} price 基準価格
 * @param {number} totalAmount 総注文量
 * @param {number} chunks 分割数
 * @param {number} spreadPercentage スプレッド（％）
 * @returns {Array} 分割された注文の配列
 */
function createIcebergOrders(
  symbol,
  side,
  price,
  totalAmount,
  chunks = 3,
  spreadPercentage = MIN_SPREAD_PERCENTAGE
) {
  const orders = [];
  const chunkSize = totalAmount / chunks;

  for (let i = 0; i < chunks; i++) {
    // 最後のチャンクは端数を含める
    const amount = i === chunks - 1 ? totalAmount - chunkSize * (chunks - 1) : chunkSize;

    // 各チャンクの価格をわずかにずらす
    const adjustedSpread = spreadPercentage + i * 0.05; // 少しずつスプレッドを広げる

    // Maker-only Limit注文を作成
    orders.push(createMakerOnlyLimitOrder(symbol, side, price, amount, adjustedSpread));
  }

  return orders;
}

/**
 * ポジション偏りをチェックし、ヘッジ注文が必要か判断
 * @param {Array} positions ポジション配列
 * @param {string} symbol 銘柄シンボル
 * @param {number} currentPrice 現在価格
 * @returns {Object|null} ヘッジ注文（必要な場合）またはnull
 */
function checkPositionImbalance(
  positions,
  symbol,
  currentPrice
) {
  // シンボル固有のポジションをフィルタリング
  const symbolPositions = positions.filter(p => p.symbol === symbol);
  
  if (symbolPositions.length === 0) return null;
  
  // 買いポジションと売りポジションを分離
  const buyPositions = symbolPositions.filter(p => p.side === OrderSide.BUY);
  const sellPositions = symbolPositions.filter(p => p.side === OrderSide.SELL);
  
  // 買いと売りのポジションサイズを合計
  const totalBuySize = buyPositions.reduce((sum, p) => sum + p.amount, 0);
  const totalSellSize = sellPositions.reduce((sum, p) => sum + p.amount, 0);
  
  // ネットポジションの計算 (正:買い越し, 負:売り越し)
  const netPosition = totalBuySize - totalSellSize;
  
  // 総ポジションサイズ
  const totalPositionSize = totalBuySize + totalSellSize;
  
  // ポジション偏りのパーセンテージを計算
  const imbalanceRatio = netPosition / totalPositionSize;
  
  // 偏りが閾値を超えた場合、逆方向のヘッジ注文を生成
  if (Math.abs(imbalanceRatio) > NET_POSITION_DELTA_MAX) {
    // ヘッジ量はネットポジションの50%に設定
    const hedgeAmount = Math.abs(netPosition) * 0.5;
    
    // 買い越しの場合は売り、売り越しの場合は買いのヘッジ注文
    const hedgeSide = netPosition > 0 ? OrderSide.SELL : OrderSide.BUY;
    
    return createMakerOnlyLimitOrder(symbol, hedgeSide, currentPrice, hedgeAmount);
  }
  
  return null;
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
  return price <= upperBound && price >= lowerBound;
}

/**
 * ミーンリバート戦略を実行
 * @param {Array} candles ローソク足データ
 * @param {string} symbol 銘柄シンボル
 * @param {Array} currentPositions 現在のポジション
 * @param {number} accountBalance 口座残高
 * @returns {Object} 戦略の実行結果
 */
function executeMeanRevertStrategy(
  candles,
  symbol,
  currentPositions,
  accountBalance = 10000
) {
  const signals = [];
  
  // データが十分にあるか確認
  if (candles.length < RANGE_PERIOD) {
    return {
      strategy: StrategyType.MEAN_REVERSION,
      signals: [],
      timestamp: Date.now()
    };
  }
  
  // 現在の価格
  const currentPrice = candles[candles.length - 1].close;
  
  // Donchianチャネルを計算
  const donchian = calculateDonchianChannel(candles, RANGE_PERIOD);
  const rangeHigh = donchian.high;
  const rangeLow = donchian.low;
  
  // レンジを識別（高値と安値の差の％）
  const rangePercentage = ((rangeHigh - rangeLow) / rangeLow) * 100;
  
  // 指定範囲内かどうかを確認
  const inRange = isWithinRange(currentPrice, rangeHigh, rangeLow);
  
  // VWAPを計算
  const vwap = calculateVWAP(candles.slice(-20));
  
  // ATRを計算
  const atr = calculateATR(candles, 14);
  const atrPercentage = calculateAtrPercentage(atr, currentPrice);
  
  // 動的グリッドレベル数を計算
  const gridLevels = calculateDynamicGridLevels(rangePercentage, atrPercentage);
  
  // グリッドレベルを計算
  const levels = calculateGridLevels(rangeHigh, rangeLow, gridLevels);
  
  // 現在のポジションサイズを確認
  const symbolPositions = currentPositions.filter(p => p.symbol === symbol);
  const totalPositionSize = symbolPositions.reduce((sum, p) => sum + p.amount, 0);
  const positionPercentage = totalPositionSize / accountBalance;
  
  // リスク管理：ポジションサイズ上限チェック
  const underPositionLimit = positionPercentage < MAX_POSITION_SIZE;
  
  // レンジが十分に広く、かつポジション上限に達していない場合
  if (inRange && rangePercentage > MARKET_PARAMETERS.MIN_RANGE_PERCENTAGE && underPositionLimit) {
    // 現在のレベルを特定
    const currentLevel = levels.findIndex(level => currentPrice < level);
    
    // レベルの中間にいる場合（グリッド取引可能）
    if (currentLevel > 0 && currentLevel < levels.length) {
      // 上のレベルに近い場合は売り、下のレベルに近い場合は買い
      const upperLevel = levels[currentLevel];
      const lowerLevel = levels[currentLevel - 1];
      const middlePoint = (upperLevel + lowerLevel) / 2;
      
      // ポジションサイズを計算
      // リスク管理：注文あたりの最大リスク（口座残高の1%）
      const riskAmount = accountBalance * RISK_PARAMETERS.MAX_RISK_PER_TRADE;
      const levelDistance = upperLevel - lowerLevel;
      const positionSize = riskAmount / levelDistance;
      
      if (currentPrice < middlePoint) {
        // 下方レベルに近い：買い注文を生成
        signals.push(
          createMakerOnlyLimitOrder(symbol, OrderSide.BUY, currentPrice, positionSize)
        );
      } else {
        // 上方レベルに近い：売り注文を生成
        signals.push(
          createMakerOnlyLimitOrder(symbol, OrderSide.SELL, currentPrice, positionSize)
        );
      }
    }
  }
  
  // レンジを大きく逸脱した場合（エスケープシナリオ）
  const escapeUpper = rangeHigh * (1 + ESCAPE_THRESHOLD);
  const escapeLower = rangeLow * (1 - ESCAPE_THRESHOLD);
  
  if (currentPrice > escapeUpper || currentPrice < escapeLower) {
    // 全ポジションをクローズするシグナルを生成
    symbolPositions.forEach(position => {
      const closeSide = position.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;
      signals.push({
        symbol,
        type: OrderType.MARKET,
        side: closeSide,
        amount: position.amount,
        timestamp: Date.now(),
        isClosePosition: true,
        relatedPositionId: position.id
      });
    });
  }
  
  // ポジション偏りのチェックとヘッジ
  const hedgeOrder = checkPositionImbalance(currentPositions, symbol, currentPrice);
  if (hedgeOrder) {
    signals.push(hedgeOrder);
  }
  
  return {
    strategy: StrategyType.MEAN_REVERSION,
    signals,
    timestamp: Date.now(),
    metadata: {
      rangeHigh,
      rangeLow,
      rangePercentage,
      inRange,
      gridLevels,
      vwap,
      atr,
      currentPrice
    }
  };
}

// CommonJS形式でのエクスポート
module.exports = {
  executeMeanRevertStrategy,
  calculateDonchianChannel,
  calculateATR,
  calculateGridLevels,
  createMakerOnlyLimitOrder,
  createIcebergOrders
};
