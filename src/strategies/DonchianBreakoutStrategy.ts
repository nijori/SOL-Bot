/**
 * DonchianBreakoutStrategy
 *
 * ドンチャンチャネルのブレイクアウトを利用した戦略
 * 一定期間の高値/安値をブレイクした際にエントリー
 *
 * 注意: これはTST-012テスト用のテンポラリな実装です
 * 
 * INF-032-2: 戦略ディレクトリのCommonJS変換
 */
// @ts-nocheck

// CommonJS形式のモジュールインポート
const technicalIndicators = require('technicalindicators');
const { ADX, Highest, Lowest } = technicalIndicators;
const Types = require('../core/types');
const { Candle, OrderSide, OrderType, StrategyType } = Types;
const { TREND_PARAMETERS, RISK_PARAMETERS } = require('../config/parameters');
const logger = require('../utils/logger').default;
const { parameterService } = require('../config/parameterService');
const { calculateRiskBasedPositionSize } = require('../utils/positionSizing');
const { calculateATR } = require('../utils/atrUtils');

// ATR==0の場合のフォールバック設定
const MIN_STOP_DISTANCE_PERCENTAGE = parameterService.get(
  'risk.minStopDistancePercentage',
  0.01
);
const DEFAULT_ATR_PERCENTAGE = parameterService.get('risk.defaultAtrPercentage', 0.02);

/**
 * ドンチャンチャネルを計算する関数
 * @param {Array} candles ローソク足データ
 * @param {number} period 期間
 * @returns {Object} ドンチャンチャネルの上限、下限、中央値
 */
function calculateDonchian(candles, period) {
  // 必要なデータがない場合はエラー値を返す
  if (candles.length < period) {
    logger.warn(`[DonchianStrategy] 必要なデータが不足しています: ${candles.length} < ${period}`);
    return { upper: 0, lower: 0, middle: 0 };
  }

  // 期間内の最高値と最低値を計算
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

  // 最新の値を取得
  const upper = highestValues[highestValues.length - 1];
  const lower = lowestValues[lowestValues.length - 1];
  const middle = (upper + lower) / 2;

  return { upper, lower, middle };
}

/**
 * ドンチャンブレイクアウト戦略の実行
 * @param {Array} candles ローソク足データ
 * @param {string} symbol シンボル名
 * @param {Array} currentPositions 現在のポジション情報
 * @param {number} accountBalance 口座残高
 * @returns {Object} 戦略の実行結果
 */
function executeDonchianBreakoutStrategy(
  candles,
  symbol,
  currentPositions,
  accountBalance = 10000
) {
  // シグナルを格納する配列
  const signals = [];

  // ドンチャン期間とADX期間
  const donchianPeriod = TREND_PARAMETERS.DONCHIAN_PERIOD;
  const adxPeriod = TREND_PARAMETERS.ADX_PERIOD;
  const atrPeriod = TREND_PARAMETERS.ATR_PERIOD;

  // データが十分にあるか確認
  if (candles.length < donchianPeriod) {
    logger.warn(
      `[DonchianStrategy] 十分なデータがありません: ${candles.length} < ${donchianPeriod}`
    );
    return {
      strategy: StrategyType.DONCHIAN_BREAKOUT,
      signals: [],
      timestamp: Date.now()
    };
  }

  // 現在の価格
  const currentPrice = candles[candles.length - 1].close;

  // 前回の価格
  const previousPrice = candles.length > 1 ? candles[candles.length - 2].close : currentPrice;

  // ドンチャンチャネルの計算
  const donchian = calculateDonchian(candles, donchianPeriod);

  // ADXの計算
  const adxResult = calculateADX(candles, adxPeriod);

  // ATRの計算
  const atr = calculateATR(candles, atrPeriod, 'DonchianStrategy');

  // ブレイクアウトかどうかの判定
  const isUpperBreakout = currentPrice > donchian.upper && previousPrice <= donchian.upper;
  const isLowerBreakout = currentPrice < donchian.lower && previousPrice >= donchian.lower;

  // ADXが高いかどうかの判定
  const isStrongTrend = adxResult > TREND_PARAMETERS.ADX_THRESHOLD;

  // 現在のポジションを確認
  const hasPosition = currentPositions.some((p) => p.symbol === symbol);

  // ポジションがなく、上方ブレイクアウトが発生した場合（強いトレンドがあれば優先）
  if (!hasPosition && isUpperBreakout && isStrongTrend) {
    // ATRベースのストップロス
    const stopLossPrice = currentPrice - atr * TREND_PARAMETERS.ATR_MULTIPLIER;

    // リスクに基づいたポジションサイズの計算
    const riskAmount = accountBalance * RISK_PARAMETERS.MAX_RISK_PER_TRADE;
    const riskDistance = currentPrice - stopLossPrice;

    // ポジションサイズの計算
    const positionSize = calculateRiskBasedPositionSize(
      accountBalance,
      currentPrice,
      stopLossPrice,
      RISK_PARAMETERS.MAX_RISK_PER_TRADE,
      'DonchianStrategy'
    );

    // 買い注文を生成
    signals.push({
      symbol,
      type: OrderType.MARKET,
      side: OrderSide.BUY,
      amount: positionSize,
      timestamp: Date.now(),
      stopPrice: stopLossPrice // ストップロス価格を設定
    });

    logger.info(
      `[DonchianStrategy] 上方ブレイクアウト検出: 買い注文生成 ${positionSize} @ ${currentPrice}, ストップロス: ${stopLossPrice}`
    );
  }

  // ポジションがなく、下方ブレイクアウトが発生した場合（強いトレンドがあれば優先）
  else if (!hasPosition && isLowerBreakout && isStrongTrend) {
    // ATRベースのストップロス
    const stopLossPrice = currentPrice + atr * TREND_PARAMETERS.ATR_MULTIPLIER;

    // リスクに基づいたポジションサイズの計算
    const riskAmount = accountBalance * RISK_PARAMETERS.MAX_RISK_PER_TRADE;
    const riskDistance = stopLossPrice - currentPrice;

    // ポジションサイズの計算
    const positionSize = calculateRiskBasedPositionSize(
      accountBalance,
      currentPrice,
      stopLossPrice,
      RISK_PARAMETERS.MAX_RISK_PER_TRADE,
      'DonchianStrategy'
    );

    // 売り注文を生成
    signals.push({
      symbol,
      type: OrderType.MARKET,
      side: OrderSide.SELL,
      amount: positionSize,
      timestamp: Date.now(),
      stopPrice: stopLossPrice // ストップロス価格を設定
    });

    logger.info(
      `[DonchianStrategy] 下方ブレイクアウト検出: 売り注文生成 ${positionSize} @ ${currentPrice}, ストップロス: ${stopLossPrice}`
    );
  }

  // トレイリングストップの更新
  currentPositions.forEach((position) => {
    if (position.symbol !== symbol || !position.stopPrice) return;

    // ロングポジションの場合
    if (position.side === OrderSide.BUY) {
      // ATRベースの新しいストップ価格を計算
      const newStopPrice = currentPrice - atr * TREND_PARAMETERS.TRAILING_STOP_FACTOR;

      // 現在のストップより高い場合のみ更新
      if (newStopPrice > position.stopPrice) {
        // 実際のシステムではここでストップ注文を更新する
        logger.info(
          `[DonchianStrategy] ロングポジションのトレイリングストップを更新: ${position.stopPrice} -> ${newStopPrice}`
        );
      }
    }
    // ショートポジションの場合
    else if (position.side === OrderSide.SELL) {
      // ATRベースの新しいストップ価格を計算
      const newStopPrice = currentPrice + atr * TREND_PARAMETERS.TRAILING_STOP_FACTOR;

      // 現在のストップより低い場合のみ更新
      if (newStopPrice < position.stopPrice) {
        // 実際のシステムではここでストップ注文を更新する
        logger.info(
          `[DonchianStrategy] ショートポジションのトレイリングストップを更新: ${position.stopPrice} -> ${newStopPrice}`
        );
      }
    }
  });

  return {
    strategy: StrategyType.DONCHIAN_BREAKOUT,
    signals,
    timestamp: Date.now()
  };
}

/**
 * ADXの計算
 * @param {Array} candles ローソク足データ
 * @param {number} period 期間
 * @returns {number} ADX値
 */
function calculateADX(candles, period) {
  if (candles.length < period * 2) {
    logger.warn(
      `[DonchianStrategy] ADX計算のためのデータが不足しています: ${candles.length} < ${period * 2}`
    );
    return 0;
  }

  const adxInput = {
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
    period
  };

  const adxValues = ADX.calculate(adxInput);
  return adxValues[adxValues.length - 1].adx;
}

/**
 * ドンチャンブレイクアウト戦略クラス
 */
class DonchianBreakoutStrategy {
  symbol;
  config;

  /**
   * コンストラクタ
   * @param {string} symbol シンボル名
   * @param {Object} config 設定オブジェクト
   */
  constructor(symbol, config = {}) {
    this.symbol = symbol;
    this.config = config;
  }

  /**
   * 戦略の実行
   * @param {Array} candles ローソク足データ
   * @returns {Object} 戦略の実行結果
   */
  execute(candles) {
    // 設定のフォールバック
    const accountBalance = 10000; // 実際のシステムでは口座残高を渡す
    const currentPositions = []; // 実際のシステムではポジション情報を渡す

    return executeDonchianBreakoutStrategy(candles, this.symbol, currentPositions, accountBalance);
  }
}

// CommonJS形式でエクスポート
module.exports = {
  calculateDonchian,
  executeDonchianBreakoutStrategy,
  DonchianBreakoutStrategy
};
