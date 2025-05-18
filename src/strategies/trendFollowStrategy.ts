/**
 * 改良版トレンドフォロー戦略
 * Donchianブレイク+ADXによるエントリー、Parabolic SARによる追従、トレイリングストップの実装
 * 
 * INF-032-2: 戦略ディレクトリのCommonJS変換
 */
// @ts-nocheck

// CommonJS形式のモジュールインポート
const technicalIndicators = require('technicalindicators');
const { ADX } = technicalIndicators;
const Types = require('../core/types');
const { Candle, Order, OrderSide, OrderType, Position, StrategyResult, StrategyType } = Types;
const { TREND_PARAMETERS, MARKET_PARAMETERS, RISK_PARAMETERS } = require('../config/parameters');
const { parameterService } = require('../config/parameterService');
const { calculateParabolicSAR, ParabolicSARResult } = require('../indicators/parabolicSAR');
const { calculateATR, getValidStopDistance } = require('../utils/atrUtils');

// 戦略パラメータをYAML設定から取得
const DONCHIAN_PERIOD = parameterService.get('trendFollowStrategy.donchianPeriod', 20);
const ADX_THRESHOLD = parameterService.get('trendFollowStrategy.adxThreshold', 25);
const ATR_MULTIPLIER = parameterService.get('trendFollowStrategy.atrMultiplier', 3.0);
const TRAILING_STOP_FACTOR = parameterService.get(
  'trendFollowStrategy.trailingStopFactor',
  2.5
);
const USE_PARABOLIC_SAR = parameterService.get(
  'trendFollowStrategy.useParabolicSAR',
  true
);
const MAX_RISK_PER_TRADE = parameterService.get('risk.maxRiskPerTrade', 0.02);

// エントリー後のトレイリングストップの調整
const INITIAL_STOP_ATR_FACTOR = parameterService.get(
  'trendFollowStrategy.initialStopAtrFactor',
  1.5
);
const BREAKEVEN_MOVE_THRESHOLD = parameterService.get(
  'trendFollowStrategy.breakevenMoveThreshold',
  2.0
);
const PROFIT_LOCK_THRESHOLD = parameterService.get(
  'trendFollowStrategy.profitLockThreshold',
  3.0
);
// 利益確定の割合（PROFIT_LOCK_THRESHOLDに達した場合に確定する利益の割合）
const PROFIT_LOCK_PERCENTAGE = parameterService.get(
  'trendFollowStrategy.profitLockPercentage',
  0.5
);

/**
 * Donchianチャネルを計算する関数
 * @param {Array} candles ローソク足データ
 * @param {number} period 期間
 * @returns {Object} Donchianチャネルの上限と下限
 */
function calculateDonchian(candles, period) {
  if (candles.length < period) {
    return { upper: 0, lower: 0 };
  }

  const recentCandles = candles.slice(-period);
  const highest = Math.max(...recentCandles.map((c) => c.high));
  const lowest = Math.min(...recentCandles.map((c) => c.low));

  return {
    upper: highest,
    lower: lowest
  };
}

/**
 * Parabolic SARの買いシグナルをチェック
 * @param {Array} candles ローソク足データ
 * @param {Object} currentSAR 現在のSAR計算結果
 * @returns {boolean} 買いシグナルならtrue
 */
function isSARBuySignal(candles, currentSAR) {
  // 最新のローソク足
  const latestCandle = candles[candles.length - 1];

  // SARが価格より下にあり、上昇トレンドである場合は買いシグナル
  return currentSAR.isUptrend && currentSAR.sar < latestCandle.low;
}

/**
 * Parabolic SARの売りシグナルをチェック
 * @param {Array} candles ローソク足データ
 * @param {Object} currentSAR 現在のSAR計算結果
 * @returns {boolean} 売りシグナルならtrue
 */
function isSARSellSignal(candles, currentSAR) {
  // 最新のローソク足
  const latestCandle = candles[candles.length - 1];

  // SARが価格より上にあり、下降トレンドである場合は売りシグナル
  return !currentSAR.isUptrend && currentSAR.sar > latestCandle.high;
}

/**
 * ADXを計算する関数
 * @param {Array} candles ローソク足データ
 * @param {number} period 期間
 * @returns {number} ADX値
 */
function calculateADX(candles, period) {
  if (candles.length < period * 2) {
    return 0;
  }

  const adxInput = {
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
    period
  };

  try {
    const result = ADX.calculate(adxInput);
    if (result.length === 0) {
      return 0;
    }
    return result[result.length - 1].adx;
  } catch (error) {
    console.error(`[TrendFollowStrategy] ADX計算エラー: ${error}`);
    return 0;
  }
}

/**
 * リスクベースのポジションサイズを計算する関数
 * @param {number} accountBalance 口座残高
 * @param {number} entryPrice エントリー価格
 * @param {number} stopPrice ストップ価格
 * @param {number} maxRiskPercentage 1トレードあたりの最大リスク率
 * @param {string} strategyName 戦略名（ログ用）
 * @returns {number} 適切なポジションサイズ
 *
 * @deprecated 今後はOrderSizingServiceを使用する予定
 */
function calculateRiskBasedPositionSize(
  accountBalance,
  entryPrice,
  stopPrice,
  maxRiskPercentage = RISK_PARAMETERS.MAX_RISK_PER_TRADE,
  strategyName = 'Strategy'
) {
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
 * 改良版トレンドフォロー戦略を実行する関数
 * @param {Array} candles ローソク足データ
 * @param {string} symbol 銘柄シンボル
 * @param {Array} currentPositions 現在のポジション
 * @param {number} accountBalance 口座残高
 * @returns {Object} 戦略の実行結果
 */
function executeTrendFollowStrategy(
  candles,
  symbol,
  currentPositions,
  accountBalance = 10000
) {
  // 必要なローソク足の数をチェック
  const requiredCandles =
    Math.max(DONCHIAN_PERIOD, MARKET_PARAMETERS.ATR_PERIOD, TREND_PARAMETERS.ADX_PERIOD) + 10;

  if (candles.length < requiredCandles) {
    console.warn(
      `[TrendFollowStrategy] 必要なローソク足データが不足しています: ${candles.length}/${requiredCandles}`
    );
    return {
      strategy: StrategyType.TREND_FOLLOWING,
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

    // ATRを計算
    const atr = calculateATR(candles, MARKET_PARAMETERS.ATR_PERIOD, 'TrendFollowStrategy');

    // ATRが0の場合の安全対策
    const validAtr = atr > 0 ? atr : currentPrice * 0.01;

    // Donchianチャネルを計算
    const donchian = calculateDonchian(candles, DONCHIAN_PERIOD);

    // ADXを計算
    const adxValue = calculateADX(candles, TREND_PARAMETERS.ADX_PERIOD);

    // Parabolic SARを計算
    const sarResult = calculateParabolicSAR(candles);

    // 現在のポジションを確認
    const hasPosition = currentPositions.some((p) => p.symbol === symbol);
    const position = currentPositions.find((p) => p.symbol === symbol);

    // ポジションの有無によって分岐
    if (!hasPosition) {
      // ===== ポジションがない場合: 新規エントリー条件をチェック =====

      // 上昇ブレイク: 前回の終値がDonchian上限以下で、今回の終値がDonchian上限を超えた
      const isBullishBreakout =
        previousPrice <= donchian.upper && currentPrice > donchian.upper && adxValue > ADX_THRESHOLD;

      // 下落ブレイク: 前回の終値がDonchian下限以上で、今回の終値がDonchian下限を下回った
      const isBearishBreakout =
        previousPrice >= donchian.lower && currentPrice < donchian.lower && adxValue > ADX_THRESHOLD;

      // Parabolic SARの買いシグナル/売りシグナル
      const isSarBuy = USE_PARABOLIC_SAR && isSARBuySignal(candles, sarResult);
      const isSarSell = USE_PARABOLIC_SAR && isSARSellSignal(candles, sarResult);

      // 上昇ブレイクまたはSAR買いシグナルで買いエントリー
      if (isBullishBreakout || isSarBuy) {
        // ATRベースのストップロス価格を計算
        const stopPrice = currentPrice - validAtr * INITIAL_STOP_ATR_FACTOR;

        // リスクベースのポジションサイズを計算
        const positionSize = calculateRiskBasedPositionSize(
          accountBalance,
          currentPrice,
          stopPrice,
          MAX_RISK_PER_TRADE,
          'TrendFollowStrategy'
        );

        // 買い注文を生成
        signals.push({
          symbol,
          type: OrderType.MARKET,
          side: OrderSide.BUY,
          amount: positionSize,
          timestamp: Date.now(),
          stopPrice: stopPrice, // ストップロス価格を設定
          metadata: {
            strategy: 'TrendFollow',
            entryReason: isBullishBreakout ? 'DonchianBreakout' : 'ParabolicSAR',
            atr: validAtr,
            adx: adxValue
          }
        });

        console.log(
          `[TrendFollowStrategy] 買いシグナル: ${
            isBullishBreakout ? 'Donchianブレイク' : 'ParabolicSAR'
          }, 価格=${currentPrice}, ATR=${validAtr}, ADX=${adxValue}`
        );
      }
      // 下落ブレイクまたはSAR売りシグナルで売りエントリー
      else if (isBearishBreakout || isSarSell) {
        // ATRベースのストップロス価格を計算
        const stopPrice = currentPrice + validAtr * INITIAL_STOP_ATR_FACTOR;

        // リスクベースのポジションサイズを計算
        const positionSize = calculateRiskBasedPositionSize(
          accountBalance,
          currentPrice,
          stopPrice,
          MAX_RISK_PER_TRADE,
          'TrendFollowStrategy'
        );

        // 売り注文を生成
        signals.push({
          symbol,
          type: OrderType.MARKET,
          side: OrderSide.SELL,
          amount: positionSize,
          timestamp: Date.now(),
          stopPrice: stopPrice, // ストップロス価格を設定
          metadata: {
            strategy: 'TrendFollow',
            entryReason: isBearishBreakout ? 'DonchianBreakout' : 'ParabolicSAR',
            atr: validAtr,
            adx: adxValue
          }
        });

        console.log(
          `[TrendFollowStrategy] 売りシグナル: ${
            isBearishBreakout ? 'Donchianブレイク' : 'ParabolicSAR'
          }, 価格=${currentPrice}, ATR=${validAtr}, ADX=${adxValue}`
        );
      }
    } else if (position) {
      // ===== ポジションがある場合: トレイリングストップや利益確定をチェック =====

      // 現在のポジション方向と入口価格を取得
      const entryPrice = position.entryPrice;
      const isBuyPosition = position.side === OrderSide.BUY;
      const isHedgeOrder = position.metadata && position.metadata.isHedgeOrder === true;

      // 現在のP/L計算
      const unrealizedPL = isBuyPosition
        ? (currentPrice - entryPrice) / entryPrice
        : (entryPrice - currentPrice) / entryPrice;

      // 現在のストップ価格を取得
      const currentStop = position.stopPrice || (isBuyPosition ? entryPrice * 0.95 : entryPrice * 1.05);
      
      // Parabolic SARによる反転シグナル
      const isReversalSignal = isBuyPosition
        ? isSARSellSignal(candles, sarResult)
        : isSARBuySignal(candles, sarResult);

      // 反対方向のSARシグナルが発生した場合、ポジションをクローズ
      if (USE_PARABOLIC_SAR && isReversalSignal && !isHedgeOrder) {
        signals.push({
          symbol,
          type: OrderType.MARKET,
          side: isBuyPosition ? OrderSide.SELL : OrderSide.BUY,
          amount: position.amount,
          timestamp: Date.now(),
          isClosePosition: true,
          relatedPositionId: position.id,
          metadata: {
            closeReason: 'ParabolicSARReversal',
            unrealizedPL: unrealizedPL
          }
        });

        console.log(
          `[TrendFollowStrategy] ${
            isBuyPosition ? '買い' : '売り'
          }ポジションをParabolic SAR反転でクローズ: PL=${(unrealizedPL * 100).toFixed(2)}%`
        );

        return {
          strategy: StrategyType.TREND_FOLLOWING,
          signals,
          timestamp: Date.now()
        };
      }

      // トレイリングストップの更新ロジック
      if (!isHedgeOrder) {
        let newStopPrice = currentStop;

        // 利益が出ている場合
        if (unrealizedPL > 0) {
          // 利益がATRの2倍以上: ブレイクイーブンに移動
          if (unrealizedPL > (validAtr / currentPrice) * BREAKEVEN_MOVE_THRESHOLD && 
              (isBuyPosition ? currentStop < entryPrice : currentStop > entryPrice)) {
            newStopPrice = entryPrice;
            console.log(`[TrendFollowStrategy] ストップをブレイクイーブンに移動: ${newStopPrice}`);
          }
          
          // 利益がATRの3倍以上: 利益を確定したトレイリングストップに移動
          else if (unrealizedPL > (validAtr / currentPrice) * PROFIT_LOCK_THRESHOLD) {
            // 利益の50%を確保するストップ
            const profitLockLevel = entryPrice + (isBuyPosition ? 1 : -1) * 
                                   (currentPrice - entryPrice) * PROFIT_LOCK_PERCENTAGE;
            
            // 現在のストップよりも有利な場合のみ更新
            if (isBuyPosition ? profitLockLevel > currentStop : profitLockLevel < currentStop) {
              newStopPrice = profitLockLevel;
              console.log(`[TrendFollowStrategy] 利益確定ストップに移動: ${newStopPrice}, 確保利益=${PROFIT_LOCK_PERCENTAGE * 100}%`);
            }
          }
          
          // ATRベースのトレイリングストップ更新
          const atrBasedStop = isBuyPosition
            ? currentPrice - validAtr * TRAILING_STOP_FACTOR
            : currentPrice + validAtr * TRAILING_STOP_FACTOR;
          
          // 現在のストップよりもトレイリングストップが有利な場合のみ更新
          if (isBuyPosition ? atrBasedStop > newStopPrice : atrBasedStop < newStopPrice) {
            newStopPrice = atrBasedStop;
            console.log(`[TrendFollowStrategy] ATRベースのトレイリングストップに更新: ${newStopPrice}`);
          }
        }

        // ストップ価格が変更された場合、更新シグナルを生成
        if (newStopPrice !== currentStop) {
          signals.push({
            symbol,
            type: OrderType.UPDATE_STOP,
            positionId: position.id,
            newStopPrice: newStopPrice,
            timestamp: Date.now()
          });
        }
      }
    }

    return {
      strategy: StrategyType.TREND_FOLLOWING,
      signals,
      timestamp: Date.now(),
      metadata: {
        donchianUpper: donchian.upper,
        donchianLower: donchian.lower,
        atr: atr,
        adx: adxValue,
        parabolicSAR: sarResult ? sarResult.sar : null,
        isUptrend: sarResult ? sarResult.isUptrend : null
      }
    };
  } catch (error) {
    console.error(`[TrendFollowStrategy] エラー: ${error}`);
    return {
      strategy: StrategyType.TREND_FOLLOWING,
      signals: [],
      timestamp: Date.now(),
      error: error.message || String(error)
    };
  }
}

// CommonJS形式でのエクスポート
module.exports = {
  executeTrendFollowStrategy,
  isSARBuySignal,
  isSARSellSignal,
  calculateDonchian,
  calculateADX,
  calculateRiskBasedPositionSize
};
