/**
 * 改良版トレンドフォロー戦略
 * Donchianブレイク+ADXによるエントリー、Parabolic SARによる追従、トレイリングストップの実装
 */
import { ADX } from 'technicalindicators';
import {
  Candle,
  Order,
  OrderSide,
  OrderType,
  Position,
  StrategyResult,
  StrategyType
} from "../core/types.js";
import { TREND_PARAMETERS, MARKET_PARAMETERS, RISK_PARAMETERS } from "../config/parameters.js";
import { parameterService } from "../config/parameterService.js";
import { calculateParabolicSAR, ParabolicSARResult } from "../indicators/parabolicSAR.js";
import { ParameterService } from "../config/parameterService.js";
import { calculateRiskBasedPositionSize } from "../utils/positionSizing.js";
import { calculateATR, getValidStopDistance } from "../utils/atrUtils.js";

// 戦略パラメータをYAML設定から取得
const DONCHIAN_PERIOD = parameterService.get<number>('trendFollowStrategy.donchianPeriod', 20);
const ADX_THRESHOLD = parameterService.get<number>('trendFollowStrategy.adxThreshold', 25);
const ATR_MULTIPLIER = parameterService.get<number>('trendFollowStrategy.atrMultiplier', 3.0);
const TRAILING_STOP_FACTOR = parameterService.get<number>(
  'trendFollowStrategy.trailingStopFactor',
  2.5
);
const USE_PARABOLIC_SAR = parameterService.get<boolean>(
  'trendFollowStrategy.useParabolicSAR',
  true
);
const MAX_RISK_PER_TRADE = parameterService.get<number>('risk.maxRiskPerTrade', 0.02);

// エントリー後のトレイリングストップの調整
const INITIAL_STOP_ATR_FACTOR = parameterService.get<number>(
  'trendFollowStrategy.initialStopAtrFactor',
  1.5
);
const BREAKEVEN_MOVE_THRESHOLD = parameterService.get<number>(
  'trendFollowStrategy.breakevenMoveThreshold',
  2.0
);
const PROFIT_LOCK_THRESHOLD = parameterService.get<number>(
  'trendFollowStrategy.profitLockThreshold',
  3.0
);
const PROFIT_LOCK_PERCENTAGE = parameterService.get<number>(
  'trendFollowStrategy.profitLockPercentage',
  0.5
);

/**
 * Donchianチャネルを計算する関数
 * @param candles ローソク足データ
 * @param period 期間
 * @returns Donchianチャネルの上限と下限
 */
function calculateDonchian(candles: Candle[], period: number): { upper: number; lower: number } {
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
 * Parabolic SARを使用したエントリーシグナルを検出する関数
 * @param candles ローソク足データ
 * @param currentSAR 現在のSAR値
 * @returns true: シグナル検出, false: シグナルなし
 */
export function isSARBuySignal(candles: Candle[], currentSAR: ParabolicSARResult): boolean {
  // データ不足チェック
  if (candles.length < 2) return false;

  // 前回のSARステータスを計算
  const previousCandles = candles.slice(0, -1); // 最新のキャンドルを除いた配列
  const previousSAR = calculateParabolicSAR(previousCandles);

  // トレンド転換を検出: 以前はダウントレンドで現在はアップトレンド
  return currentSAR.isUptrend && !previousSAR.isUptrend;
}

/**
 * Parabolic SARを使用した売りシグナルを検出する関数
 * @param candles ローソク足データ
 * @param currentSAR 現在のSAR値
 * @returns true: シグナル検出, false: シグナルなし
 */
export function isSARSellSignal(candles: Candle[], currentSAR: ParabolicSARResult): boolean {
  // データ不足チェック
  if (candles.length < 2) return false;

  // 前回のSARステータスを計算
  const previousCandles = candles.slice(0, -1); // 最新のキャンドルを除いた配列
  const previousSAR = calculateParabolicSAR(previousCandles);

  // トレンド転換を検出: 以前はアップトレンドで現在はダウントレンド
  return !currentSAR.isUptrend && previousSAR.isUptrend;
}

/**
 * ADXの計算
 * @param candles ローソク足データ
 * @param period 期間
 * @returns ADX値
 */
function calculateADX(candles: Candle[], period: number): number {
  if (candles.length < period + 2) {
    return 0; // 十分なデータがない場合は0を返す
  }

  // ADX計算の入力を作成
  const adxInput = {
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
    period
  };

  try {
    // ADXを計算
    const adxResult = ADX.calculate(adxInput);
    return adxResult[adxResult.length - 1].adx;
  } catch (error) {
    console.error('[TrendFollowStrategy] ADX計算エラー:', error);
    return 0;
  }
}

/**
 * リスクベースのポジションサイズを計算する関数
 * @param accountBalance 口座残高
 * @param entryPrice エントリー価格
 * @param stopPrice ストップ価格
 * @param maxRiskPercentage 1トレードあたりの最大リスク率
 * @returns 適切なポジションサイズ
 * 
 * @deprecated 今後はOrderSizingServiceを使用する予定
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

  // ポジション取得（指定シンボルのみ）
  const positions = currentPositions.filter((p) => p.symbol === symbol);

  // 現在値（最新のローソク足）
  const currentPrice = candles[candles.length - 1].close;

  // ドンチャンチャネルの計算
  const donchian = calculateDonchian(candles, DONCHIAN_PERIOD);

  // ATRの計算
  const atr = calculateATR(candles, 14, 'TrendFollowStrategy');

  // ADXの計算
  const adx = calculateADX(candles, 14);

  // Parabolic SARの計算
  const sarResult = calculateParabolicSAR(candles);

  // 生成するシグナルの配列
  const signals: Order[] = [];

  // 現在のポジションがない場合のエントリー条件
  if (positions.length === 0) {
    // ブレイクアウト + ADX > 閾値 でのエントリー
    const isStrongUptrend = currentPrice > donchian.upper && adx > ADX_THRESHOLD;
    const isStrongDowntrend = currentPrice < donchian.lower && adx > ADX_THRESHOLD;

    // 上昇ブレイクアウト（ロングエントリー）
    if (isStrongUptrend || (USE_PARABOLIC_SAR && isSARBuySignal(candles, sarResult))) {
      // ストップロス価格の計算（ATRベース）
      const stopPrice = currentPrice - atr * INITIAL_STOP_ATR_FACTOR;

      // リスクベースのポジションサイズを計算
      const positionSize = calculateRiskBasedPositionSize(
        accountBalance,
        currentPrice,
        stopPrice,
        MAX_RISK_PER_TRADE,
        'TrendFollowStrategy'
      );

      // 買い注文シグナルを生成
      signals.push({
        symbol,
        type: OrderType.MARKET,
        side: OrderSide.BUY,
        amount: positionSize,
        timestamp: Date.now(),
        stopPrice
      });
    }
    // 下降ブレイクアウト（ショートエントリー）
    else if (isStrongDowntrend || (USE_PARABOLIC_SAR && isSARSellSignal(candles, sarResult))) {
      // ストップロス価格の計算（ATRベース）
      const stopPrice = currentPrice + atr * INITIAL_STOP_ATR_FACTOR;

      // リスクベースのポジションサイズを計算
      const positionSize = calculateRiskBasedPositionSize(
        accountBalance,
        currentPrice,
        stopPrice,
        MAX_RISK_PER_TRADE,
        'TrendFollowStrategy'
      );

      // 売り注文シグナルを生成
      signals.push({
        symbol,
        type: OrderType.MARKET,
        side: OrderSide.SELL,
        amount: positionSize,
        timestamp: Date.now(),
        stopPrice
      });
    }
  }
  // 既存ポジションのトレイリングストップ調整
  else {
    for (const position of positions) {
      // 含み損益の計算（R値）
      let unrealizedProfitR = 0;
      let stopPrice = position.stopPrice;

      if (!stopPrice) {
        console.warn(`[TrendFollowStrategy] ポジションにストップ価格が設定されていません`);
        continue;
      }

      // エントリー価格からストップまでの距離（リスク距離）
      const riskDistance = Math.abs(position.entryPrice - stopPrice);

      // 現在の含み損益をR値で表現（何R分の利益/損失か）
      if (position.side === OrderSide.BUY) {
        unrealizedProfitR = (currentPrice - position.entryPrice) / riskDistance;

        // トレイリングストップの調整
        // 1. 損益分岐点移動（2R到達時）
        if (unrealizedProfitR >= BREAKEVEN_MOVE_THRESHOLD && stopPrice < position.entryPrice) {
          stopPrice = position.entryPrice; // 損益分岐点に移動
        }
        // 2. 利益確定（3R到達時、利益の50%を確定）
        else if (unrealizedProfitR >= PROFIT_LOCK_THRESHOLD) {
          const profitToLock = (currentPrice - position.entryPrice) * PROFIT_LOCK_PERCENTAGE;
          const newStopPrice = position.entryPrice + profitToLock;
          if (newStopPrice > stopPrice) {
            stopPrice = newStopPrice;
          }
        }
        // 3. ATRベースのトレイリングストップ
        else {
          const atrStopPrice = currentPrice - atr * TRAILING_STOP_FACTOR;
          if (atrStopPrice > stopPrice) {
            stopPrice = atrStopPrice;
          }
        }

        // 4. Parabolic SARベースのトレイリングストップ（オプション）
        if (USE_PARABOLIC_SAR && !sarResult.isUptrend) {
          const sarStopPrice = sarResult.sar;
          if (sarStopPrice > stopPrice) {
            stopPrice = sarStopPrice;
          }
        }

        // ストップ損切り（現在価格がストップ以下になった場合）
        if (currentPrice <= stopPrice) {
          signals.push({
            symbol,
            type: OrderType.MARKET,
            side: OrderSide.SELL, // 反対売買で決済
            amount: position.amount,
            timestamp: Date.now()
          });
        }
        // ストップ更新
        else if (stopPrice !== position.stopPrice) {
          // ストップ注文を更新（実際の実装ではポジションのストップを更新する処理が必要）
          console.log(
            `[TrendFollowStrategy] トレイリングストップを更新: ${position.stopPrice} -> ${stopPrice}`
          );
          // ここでは単純にログ出力のみ（実際の実装ではOrderManagementSystemでストップ更新処理が必要）
        }
      }
      // ショートポジションの場合
      else if (position.side === OrderSide.SELL) {
        unrealizedProfitR = (position.entryPrice - currentPrice) / riskDistance;

        // トレイリングストップの調整
        // 1. 損益分岐点移動（2R到達時）
        if (unrealizedProfitR >= BREAKEVEN_MOVE_THRESHOLD && stopPrice > position.entryPrice) {
          stopPrice = position.entryPrice; // 損益分岐点に移動
        }
        // 2. 利益確定（3R到達時、利益の50%を確定）
        else if (unrealizedProfitR >= PROFIT_LOCK_THRESHOLD) {
          const profitToLock = (position.entryPrice - currentPrice) * PROFIT_LOCK_PERCENTAGE;
          const newStopPrice = position.entryPrice - profitToLock;
          if (newStopPrice < stopPrice) {
            stopPrice = newStopPrice;
          }
        }
        // 3. ATRベースのトレイリングストップ
        else {
          const atrStopPrice = currentPrice + atr * TRAILING_STOP_FACTOR;
          if (atrStopPrice < stopPrice) {
            stopPrice = atrStopPrice;
          }
        }

        // 4. Parabolic SARベースのトレイリングストップ（オプション）
        if (USE_PARABOLIC_SAR && sarResult.isUptrend) {
          const sarStopPrice = sarResult.sar;
          if (sarStopPrice < stopPrice) {
            stopPrice = sarStopPrice;
          }
        }

        // ストップ損切り（現在価格がストップ以上になった場合）
        if (currentPrice >= stopPrice) {
          signals.push({
            symbol,
            type: OrderType.MARKET,
            side: OrderSide.BUY, // 反対売買で決済
            amount: position.amount,
            timestamp: Date.now()
          });
        }
        // ストップ更新
        else if (stopPrice !== position.stopPrice) {
          // ストップ注文を更新（実際の実装ではポジションのストップを更新する処理が必要）
          console.log(
            `[TrendFollowStrategy] トレイリングストップを更新: ${position.stopPrice} -> ${stopPrice}`
          );
          // ここでは単純にログ出力のみ（実際の実装ではOrderManagementSystemでストップ更新処理が必要）
        }
      }
    }
  }

  return {
    strategy: StrategyType.TREND_FOLLOWING,
    signals,
    timestamp: Date.now()
  };
}
