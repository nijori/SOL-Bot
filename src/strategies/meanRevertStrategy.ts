/**
 * レンジ/ミーンリバースエンジンの実装
 * DonchianRange基準のグリッド注文、Maker-only Limit注文方式、ポジション上限とエスケープ条件
 */
import { Highest, Lowest, ATR } from 'technicalindicators';
import {
  Candle,
  Order,
  OrderSide,
  OrderType,
  Position,
  StrategyResult,
  StrategyType
} from "../core/types.js";
import { RANGE_PARAMETERS, MARKET_PARAMETERS, RISK_PARAMETERS } from "../config/parameters.js";
import { parameterService } from "../config/parameterService.js";
import { calculateVWAP } from "../indicators/marketState.js";

// 戦略設計書に基づくパラメータをYAML設定から取得
const RANGE_PERIOD = parameterService.get<number>('rangeStrategy.rangePeriod', 30);
const RANGE_MULTIPLIER = parameterService.get<number>('rangeStrategy.rangeMultiplier', 0.9);
const GRID_ATR_MULTIPLIER = parameterService.get<number>('rangeStrategy.gridAtrMultiplier', 0.6);
const MIN_SPREAD_PERCENTAGE = parameterService.get<number>(
  'rangeStrategy.minSpreadPercentage',
  0.3
);
const ESCAPE_THRESHOLD = parameterService.get<number>('rangeStrategy.escapeThreshold', 0.02);
const MAX_POSITION_SIZE = parameterService.get<number>('riskManagement.maxPositionSize', 0.35);
const NET_POSITION_DELTA_MAX = parameterService.get<number>(
  'rangeStrategy.netPositionDeltaMax',
  0.15
);

/**
 * Donchianチャネル（最高値・最安値）を計算
 * @param candles ローソク足データ
 * @param period 期間
 * @returns Donchianの上限と下限
 */
function calculateDonchianChannel(
  candles: Candle[],
  period: number
): { high: number; low: number } {
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
 * @param candles ローソク足データ
 * @param period 期間
 * @returns ATR値
 */
function calculateATR(candles: Candle[], period: number): number {
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
 * @param atr ATR値
 * @param closePrice 終値
 * @returns ATRパーセンテージ
 */
function calculateAtrPercentage(atr: number, closePrice: number): number {
  return (atr / closePrice) * 100;
}

/**
 * グリッドレベル数を動的に計算（戦略設計書の公式を使用）
 * @param range レンジの幅
 * @param atrPercent ATRパーセンテージ
 * @returns グリッドレベル数
 */
function calculateDynamicGridLevels(range: number, atrPercent: number): number {
  // 戦略設計書の公式: ceil(Range / (ATR%×0.6))
  const gridLevels = Math.ceil(range / ((atrPercent * GRID_ATR_MULTIPLIER) / 100));

  // 合理的な範囲に制限（3〜10）
  return Math.max(3, Math.min(10, gridLevels));
}

/**
 * グリッドレベルを計算
 * @param high レンジ上限
 * @param low レンジ下限
 * @param levels グリッドレベル数
 * @returns グリッドレベルの配列
 */
function calculateGridLevels(high: number, low: number, levels: number): number[] {
  const step = (high - low) / (levels + 1);
  const gridLevels = [];

  for (let i = 1; i <= levels; i++) {
    gridLevels.push(low + step * i);
  }

  return gridLevels;
}

/**
 * Maker-only Limit注文を生成
 * @param symbol 銘柄シンボル
 * @param side 注文方向
 * @param price 基準価格
 * @param amount 注文量
 * @param spreadPercentage スプレッド（％）
 * @returns Maker-only Limit注文
 */
function createMakerOnlyLimitOrder(
  symbol: string,
  side: OrderSide,
  price: number,
  amount: number,
  spreadPercentage: number = MIN_SPREAD_PERCENTAGE
): Order {
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
 * @param symbol 銘柄シンボル
 * @param side 注文方向
 * @param price 基準価格
 * @param totalAmount 総注文量
 * @param chunks 分割数
 * @param spreadPercentage スプレッド（％）
 * @returns 分割された注文の配列
 */
function createIcebergOrders(
  symbol: string,
  side: OrderSide,
  price: number,
  totalAmount: number,
  chunks: number = 3,
  spreadPercentage: number = MIN_SPREAD_PERCENTAGE
): Order[] {
  const orders: Order[] = [];
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
 * @param positions ポジション配列
 * @param symbol 銘柄シンボル
 * @param currentPrice 現在価格
 * @returns ヘッジ注文（必要な場合）またはnull
 */
function checkPositionImbalance(
  positions: Position[],
  symbol: string,
  currentPrice: number
): Order | null {
  // シンボルに関連するポジションのみをフィルタリング
  const symbolPositions = positions.filter((p) => p.symbol === symbol);

  if (symbolPositions.length === 0) {
    return null;
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

  if (totalPositionSize === 0) {
    return null;
  }

  // ネットポジションデルタを計算（-1.0〜+1.0の範囲）
  const netPositionDelta = (longAmount - shortAmount) / totalPositionSize;

  // 戦略設計書に基づき、15%以上の偏りでヘッジ
  if (Math.abs(netPositionDelta) < NET_POSITION_DELTA_MAX) {
    return null;
  }

  // ヘッジするサイド（ロング偏りならショート、ショート偏りならロング）
  const hedgeSide = netPositionDelta > 0 ? OrderSide.SELL : OrderSide.BUY;

  // ヘッジする量（偏りの半分をヘッジ）
  const imbalanceAmount = Math.abs(longAmount - shortAmount);
  const hedgeAmount = imbalanceAmount * 0.5;

  console.log(
    `[MeanRevertStrategy] ポジション偏り検出: ${(netPositionDelta * 100).toFixed(2)}%, ヘッジ実行: ${hedgeSide} ${hedgeAmount.toFixed(4)} @ ${currentPrice.toFixed(2)}`
  );

  // Maker-only Limit注文でヘッジ
  return createMakerOnlyLimitOrder(
    symbol,
    hedgeSide,
    currentPrice,
    hedgeAmount,
    0.2 // より小さいスプレッド（0.2%）で注文
  );
}

/**
 * レンジ/ミーンリバース戦略を実行する関数
 * @param candles ローソク足データ
 * @param symbol 銘柄シンボル
 * @param currentPositions 現在のポジション
 * @param accountBalance 口座残高
 * @returns 戦略の実行結果
 */
export function executeMeanRevertStrategy(
  candles: Candle[],
  symbol: string,
  currentPositions: Position[],
  accountBalance: number = 10000
): StrategyResult {
  // データが不足している場合は空のシグナルを返す
  if (candles.length < Math.max(RANGE_PERIOD, MARKET_PARAMETERS.ATR_PERIOD) + 10) {
    console.warn(`[MeanRevertStrategy] 必要なデータが不足しています: ${candles.length}本`);
    return {
      strategy: StrategyType.RANGE_TRADING,
      signals: [],
      timestamp: Date.now()
    };
  }

  try {
    // Donchianチャネルを計算（30日間の高値・安値）
    const donchian = calculateDonchianChannel(candles, RANGE_PERIOD);

    // レンジを計算（Donchian × 0.9）- 戦略設計書の要件
    const rangeHigh = donchian.high * RANGE_MULTIPLIER;
    const rangeLow = donchian.low / RANGE_MULTIPLIER;
    const rangeWidth = rangeHigh - rangeLow;

    // ATRを計算
    const currentATR = calculateATR(candles, MARKET_PARAMETERS.ATR_PERIOD);

    // 現在の価格情報
    const currentCandle = candles[candles.length - 1];
    const previousCandle = candles[candles.length - 2];
    const currentPrice = currentCandle.close;
    const previousPrice = previousCandle.close;

    // ATR%を計算
    const atrPercent = calculateAtrPercentage(currentATR, currentPrice);

    // VWAPを計算（直近20本のローソク足）
    const vwap = calculateVWAP(candles.slice(-20));

    // 動的にグリッドレベル数を計算（戦略設計書の公式を使用）
    const gridLevelCount = calculateDynamicGridLevels(rangeWidth, atrPercent);

    // グリッドレベルを計算
    const gridLevels = calculateGridLevels(rangeHigh, rangeLow, gridLevelCount);

    console.log(
      `[MeanRevertStrategy] 市場分析: レンジ=${rangeLow.toFixed(2)}〜${rangeHigh.toFixed(2)}, ATR=${currentATR.toFixed(2)}, ATR%=${atrPercent.toFixed(2)}%, グリッド数=${gridLevelCount}`
    );

    // シグナルを格納する配列
    const signals: Order[] = [];

    // ポジション管理
    const longPositions = currentPositions.filter(
      (p) => p.symbol === symbol && p.side === OrderSide.BUY
    );
    const shortPositions = currentPositions.filter(
      (p) => p.symbol === symbol && p.side === OrderSide.SELL
    );
    const totalLongAmount = longPositions.reduce((sum, p) => sum + p.amount, 0);
    const totalShortAmount = shortPositions.reduce((sum, p) => sum + p.amount, 0);

    // 総ポジション価値を計算
    const totalPositionValue = (totalLongAmount + totalShortAmount) * currentPrice;
    const positionRatio = totalPositionValue / accountBalance;

    // ポジション偏りチェックとヘッジ
    const hedgeOrder = checkPositionImbalance(currentPositions, symbol, currentPrice);
    if (hedgeOrder) {
      signals.push(hedgeOrder);
    }

    // エスケープ条件：レンジ上限/下限±2%で全決済（戦略設計書の要件）
    if (currentPrice > rangeHigh * (1 + ESCAPE_THRESHOLD) && shortPositions.length > 0) {
      console.log(
        `[MeanRevertStrategy] レンジ上限エスケープ条件発動: ${currentPrice.toFixed(2)} > ${rangeHigh.toFixed(2)} * ${1 + ESCAPE_THRESHOLD}`
      );

      // すべての売りポジションを決済
      signals.push({
        symbol,
        type: OrderType.MARKET,
        side: OrderSide.BUY,
        amount: totalShortAmount,
        timestamp: Date.now()
      });
    } else if (currentPrice < rangeLow * (1 - ESCAPE_THRESHOLD) && longPositions.length > 0) {
      console.log(
        `[MeanRevertStrategy] レンジ下限エスケープ条件発動: ${currentPrice.toFixed(2)} < ${rangeLow.toFixed(2)} * ${1 - ESCAPE_THRESHOLD}`
      );

      // すべての買いポジションを決済
      signals.push({
        symbol,
        type: OrderType.MARKET,
        side: OrderSide.SELL,
        amount: totalLongAmount,
        timestamp: Date.now()
      });
    }

    // ポジション上限チェック（口座残高の35%以上のポジションは持たない）
    if (positionRatio >= MAX_POSITION_SIZE) {
      console.log(
        `[MeanRevertStrategy] ポジション上限到達: ${(positionRatio * 100).toFixed(2)}% > ${(MAX_POSITION_SIZE * 100).toFixed(2)}%, 新規注文を生成しません`
      );
      return {
        strategy: StrategyType.RANGE_TRADING,
        signals,
        timestamp: Date.now()
      };
    }

    // 残りの利用可能枠を計算
    const availablePositionRatio = MAX_POSITION_SIZE - positionRatio;
    const availablePositionValue = accountBalance * availablePositionRatio;
    const baseOrderSize = availablePositionValue / gridLevelCount / currentPrice;

    // グリッドレベルごとにシグナルを生成（Maker-only Limit注文）
    for (let i = 0; i < gridLevels.length; i++) {
      const level = gridLevels[i];

      // レベルの位置（0=レンジ下限、1=レンジ上限）
      const levelPosition = (level - rangeLow) / rangeWidth;

      // 下から上に価格が上昇してレベルを超えた場合（上昇クロス）
      if (previousPrice < level && currentPrice >= level) {
        // レンジの上半分では売り
        if (levelPosition > 0.5) {
          const sellAmount = baseOrderSize * (levelPosition * 1.5); // 上に行くほど売り量を増やす

          console.log(
            `[MeanRevertStrategy] 上昇クロス検出 レベル${i + 1}/${gridLevelCount}: ${level.toFixed(2)}, 売り注文生成`
          );

          // Maker-only Limit注文を生成（Icebergオプション付き）
          const icebergOrders = createIcebergOrders(symbol, OrderSide.SELL, level, sellAmount, 3);

          signals.push(...icebergOrders);
        }
      }

      // 上から下に価格が下降してレベルを下回った場合（下降クロス）
      if (previousPrice > level && currentPrice <= level) {
        // レンジの下半分では買い
        if (levelPosition < 0.5) {
          const buyAmount = baseOrderSize * ((1 - levelPosition) * 1.5); // 下に行くほど買い量を増やす

          console.log(
            `[MeanRevertStrategy] 下降クロス検出 レベル${i + 1}/${gridLevelCount}: ${level.toFixed(2)}, 買い注文生成`
          );

          // Maker-only Limit注文を生成（Icebergオプション付き）
          const icebergOrders = createIcebergOrders(symbol, OrderSide.BUY, level, buyAmount, 3);

          signals.push(...icebergOrders);
        }
      }
    }

    // レンジ上限・下限での反転取引
    if (currentPrice >= rangeHigh * 0.98 && currentPrice <= rangeHigh) {
      // レンジ上限付近：売り注文
      const sellAmount = baseOrderSize * 1.5; // 通常の1.5倍のサイズ

      console.log(
        `[MeanRevertStrategy] レンジ上限付近: ${currentPrice.toFixed(2)} / ${rangeHigh.toFixed(2)}, 売り注文生成`
      );

      signals.push(
        createMakerOnlyLimitOrder(
          symbol,
          OrderSide.SELL,
          rangeHigh,
          sellAmount,
          0.2 // より小さいスプレッド
        )
      );
    } else if (currentPrice <= rangeLow * 1.02 && currentPrice >= rangeLow) {
      // レンジ下限付近：買い注文
      const buyAmount = baseOrderSize * 1.5; // 通常の1.5倍のサイズ

      console.log(
        `[MeanRevertStrategy] レンジ下限付近: ${currentPrice.toFixed(2)} / ${rangeLow.toFixed(2)}, 買い注文生成`
      );

      signals.push(
        createMakerOnlyLimitOrder(
          symbol,
          OrderSide.BUY,
          rangeLow,
          buyAmount,
          0.2 // より小さいスプレッド
        )
      );
    }

    return {
      strategy: StrategyType.RANGE_TRADING,
      signals,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error(
      `[MeanRevertStrategy] エラー: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      strategy: StrategyType.RANGE_TRADING,
      signals: [],
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
