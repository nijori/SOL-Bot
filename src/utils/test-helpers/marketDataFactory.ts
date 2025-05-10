/**
 * REF-029: ESMテスト用市場データ生成ユーティリティ
 *
 * このファイルはテスト用の市場データ（ローソク足、注文、ポジションなど）を
 * 生成するための関数とクラスを提供します。
 * 固定シード値に基づく再現性のあるデータ生成と、様々な市場シナリオに対応した
 * データ生成機能を持ちます。
 */

import { Candle, Order, Position, OrderSide, OrderType, OrderStatus } from '../../core/types.js';

// マーケットステータスの列挙型
export enum MarketStatus {
  UNKNOWN = 'unknown',
  UPTREND = 'uptrend',
  DOWNTREND = 'downtrend',
  RANGE = 'range',
  BREAKOUT = 'breakout'
}

// テスト用に拡張したローソク足の型（シンボル情報を含む）
interface TestCandle extends Candle {
  symbol: string;
}

/**
 * マーケットデータファクトリークラス
 * テスト用の市場データを生成するクラス
 */
export class MarketDataFactory {
  // 固定シード値によるランダム生成の実装
  private static seed = 42;

  /**
   * 乱数生成器（シード値に基づく再現性のある乱数を生成）
   * @returns 0-1の乱数
   */
  private static random(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  /**
   * シード値をリセット
   * @param seed 新しいシード値（デフォルト: 42）
   */
  public static resetSeed(seed: number = 42): void {
    this.seed = seed;
  }

  /**
   * 指定範囲の乱数を生成
   * @param min 最小値
   * @param max 最大値
   * @returns min-maxの範囲の乱数
   */
  private static randomRange(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  /**
   * ノイズを生成（正規分布風）
   * @param amplitude ノイズの振幅
   * @returns -amplitude〜amplitudeの範囲のノイズ
   */
  private static generateNoise(amplitude: number): number {
    // 複数の乱数を合計して近似的に正規分布に近づける
    const sum = this.random() + this.random() + this.random() + this.random();
    // -amplitude〜amplitudeの範囲にスケーリング
    return (sum / 2 - 1) * amplitude;
  }

  /**
   * 基本的なローソク足配列を生成
   * @param params 生成パラメータ
   * @returns 生成されたローソク足配列
   */
  public static createCandles({
    symbol = 'BTC/USDT',
    basePrice = 100,
    count = 30,
    volatility = 1.0,
    timeframe = 60000, // 1分足をデフォルトに
    startTime = Date.now() - 60000 * count // count本分の時間をさかのぼる
  }: {
    symbol?: string;
    basePrice?: number;
    count?: number;
    volatility?: number;
    timeframe?: number;
    startTime?: number;
  } = {}): TestCandle[] {
    const candles: TestCandle[] = [];
    let currentPrice = basePrice;

    for (let i = 0; i < count; i++) {
      const timestamp = startTime + i * timeframe;

      // ボラティリティに基づいた価格変動を生成
      const priceChange = this.generateNoise(basePrice * (volatility / 100));
      currentPrice += priceChange;

      // 高値・安値の決定（ランダム要素を加える）
      const highLowRange = basePrice * (volatility / 200);
      const high = currentPrice + this.randomRange(0, highLowRange);
      const low = currentPrice - this.randomRange(0, highLowRange);

      // 始値・終値の決定（高値と安値の間に収める）
      const open = this.randomRange(low, high);
      const close = this.randomRange(low, high);

      // 出来高の生成（ボラティリティに比例）
      const volume = basePrice * 10 * (1 + Math.abs(priceChange) / basePrice);

      candles.push({
        symbol,
        timestamp,
        open,
        high,
        low,
        close,
        volume
      });
    }

    return candles;
  }

  /**
   * トレンド相場のローソク足データを生成
   * @param params 生成パラメータ
   * @returns トレンド相場のローソク足配列
   */
  public static createTrendCandles({
    symbol = 'BTC/USDT',
    basePrice = 100,
    count = 60,
    trendStrength = 0.5, // トレンドの強さ（1日あたりの変化率%）
    volatility = 1.0,
    isUptrend = true, // 上昇トレンドの場合true
    timeframe = 60000
  }: {
    symbol?: string;
    basePrice?: number;
    count?: number;
    trendStrength?: number;
    volatility?: number;
    isUptrend?: boolean;
    timeframe?: number;
  } = {}): TestCandle[] {
    const candles: TestCandle[] = [];
    let currentPrice = basePrice;
    const startTime = Date.now() - timeframe * count;

    // 1日あたりのトレンド変化率をタイムフレームあたりに変換
    const timeframesPerDay = 86400000 / timeframe;
    const trendPerTimeframe = (basePrice * trendStrength) / 100 / timeframesPerDay;

    for (let i = 0; i < count; i++) {
      const timestamp = startTime + i * timeframe;

      // トレンドによる価格変化
      const trendChange = isUptrend ? trendPerTimeframe : -trendPerTimeframe;

      // ボラティリティによるランダム変動
      const randomChange = this.generateNoise(basePrice * (volatility / 100));

      // 価格の更新（トレンド + ランダム変動）
      currentPrice += trendChange + randomChange;

      // 高値・安値の生成
      const highLowRange = basePrice * (volatility / 200);
      let high = currentPrice + this.randomRange(0, highLowRange);
      let low = currentPrice - this.randomRange(0, highLowRange);

      // トレンド方向に高値・安値をバイアス
      if (isUptrend) {
        high += highLowRange * 0.5;
        low += highLowRange * 0.2;
      } else {
        high -= highLowRange * 0.2;
        low -= highLowRange * 0.5;
      }

      // 始値・終値の決定（トレンド方向にバイアス）
      let open, close;
      if (isUptrend) {
        open = this.randomRange(low, currentPrice);
        close = this.randomRange(currentPrice, high);
      } else {
        open = this.randomRange(currentPrice, high);
        close = this.randomRange(low, currentPrice);
      }

      // ボラティリティに比例した出来高
      const volume = basePrice * 10 * (1 + Math.abs(trendChange + randomChange) / basePrice);

      candles.push({
        symbol,
        timestamp,
        open,
        high,
        low,
        close,
        volume
      });
    }

    return candles;
  }

  /**
   * レンジ相場のローソク足データを生成
   * @param params 生成パラメータ
   * @returns レンジ相場のローソク足配列
   */
  public static createRangeCandles({
    symbol = 'BTC/USDT',
    basePrice = 100,
    count = 60,
    rangeWidth = 5, // レンジの幅（%）
    volatility = 1.0,
    timeframe = 60000
  }: {
    symbol?: string;
    basePrice?: number;
    count?: number;
    rangeWidth?: number;
    volatility?: number;
    timeframe?: number;
  } = {}): TestCandle[] {
    const candles: TestCandle[] = [];
    const startTime = Date.now() - timeframe * count;

    // レンジの上限と下限を計算
    const rangeLow = basePrice * (1 - rangeWidth / 100);
    const rangeHigh = basePrice * (1 + rangeWidth / 100);
    const rangeMiddle = (rangeLow + rangeHigh) / 2;

    // サイン波を使ってレンジ内での価格変動をシミュレート
    for (let i = 0; i < count; i++) {
      const timestamp = startTime + i * timeframe;

      // サイン波での位置（0-1の範囲）
      const phase = (i % 20) / 20;
      const sineValue = Math.sin(phase * Math.PI * 2);

      // サイン波をレンジに変換
      const rangePosition = rangeMiddle + (sineValue * (rangeHigh - rangeLow)) / 2;

      // ボラティリティによるノイズを加える
      const noise = this.generateNoise(basePrice * (volatility / 200));
      const currentPrice = rangePosition + noise;

      // レンジ内に収める（万が一範囲を超えた場合）
      const clampedPrice = Math.max(rangeLow, Math.min(rangeHigh, currentPrice));

      // 高値・安値の生成
      const highLowRange = basePrice * (volatility / 100);
      let high = clampedPrice + this.randomRange(0, highLowRange);
      let low = clampedPrice - this.randomRange(0, highLowRange);

      // レンジ内に収める
      high = Math.min(high, rangeHigh + highLowRange * 0.3);
      low = Math.max(low, rangeLow - highLowRange * 0.3);

      // 始値・終値（高値と安値の間）
      const open = this.randomRange(low, high);
      const close = this.randomRange(low, high);

      // ボラティリティに応じた出来高（レンジ相場では全体的に低め）
      const volume = basePrice * 5 * (1 + Math.abs(noise) / basePrice);

      candles.push({
        symbol,
        timestamp,
        open,
        high,
        low,
        close,
        volume
      });
    }

    return candles;
  }

  /**
   * ブレイクアウト/ブレイクダウン相場のローソク足データを生成
   * @param params 生成パラメータ
   * @returns ブレイクアウト/ダウン相場のローソク足配列
   */
  public static createBreakoutCandles({
    symbol = 'BTC/USDT',
    basePrice = 100,
    count = 60,
    rangeWidth = 5, // ブレイク前のレンジ幅（%）
    breakoutAt = 40, // 何本目でブレイクするか
    breakoutStrength = 15, // ブレイク後の価格変化（%）
    isUpside = true, // 上方ブレイクの場合true
    volatility = 1.0,
    timeframe = 60000
  }: {
    symbol?: string;
    basePrice?: number;
    count?: number;
    rangeWidth?: number;
    breakoutAt?: number;
    breakoutStrength?: number;
    isUpside?: boolean;
    volatility?: number;
    timeframe?: number;
  } = {}): TestCandle[] {
    // パラメータの確認
    if (breakoutAt >= count) {
      breakoutAt = Math.floor(count * 0.7); // 本数を超える場合は70%の位置に設定
    }

    const candles: TestCandle[] = [];
    const startTime = Date.now() - timeframe * count;

    // レンジの上限と下限を計算
    const rangeLow = basePrice * (1 - rangeWidth / 100);
    const rangeHigh = basePrice * (1 + rangeWidth / 100);
    const rangeMiddle = (rangeLow + rangeHigh) / 2;

    // ブレイク後の目標価格
    const breakoutTarget = isUpside
      ? basePrice * (1 + breakoutStrength / 100)
      : basePrice * (1 - breakoutStrength / 100);

    for (let i = 0; i < count; i++) {
      const timestamp = startTime + i * timeframe;
      let currentPrice;

      if (i < breakoutAt) {
        // ブレイク前はレンジ相場
        const phase = (i % 20) / 20;
        const sineValue = Math.sin(phase * Math.PI * 2);
        currentPrice = rangeMiddle + (sineValue * (rangeHigh - rangeLow)) / 2;

        // レンジ上限/下限に近づくほど確率的に増加
        if (isUpside && i >= breakoutAt - 5) {
          currentPrice = Math.min(rangeHigh, currentPrice * (1 + 0.005 * (i - (breakoutAt - 5))));
        } else if (!isUpside && i >= breakoutAt - 5) {
          currentPrice = Math.max(rangeLow, currentPrice * (1 - 0.005 * (i - (breakoutAt - 5))));
        }
      } else {
        // ブレイク後は目標価格に向けて変化
        const progressToTarget = Math.min(1, (i - breakoutAt) / 10); // 10本かけて目標に到達

        if (isUpside) {
          currentPrice = rangeHigh + progressToTarget * (breakoutTarget - rangeHigh);
        } else {
          currentPrice = rangeLow - progressToTarget * (rangeLow - breakoutTarget);
        }
      }

      // ボラティリティによるノイズ
      const noise = this.generateNoise(basePrice * (volatility / 100));
      currentPrice += noise;

      // 高値・安値の生成
      const highLowRange = basePrice * (volatility / 100);

      // ブレイク時はボラティリティを高める
      const volBoost = i >= breakoutAt && i <= breakoutAt + 5 ? 2.0 : 1.0;

      let high = currentPrice + this.randomRange(0, highLowRange * volBoost);
      let low = currentPrice - this.randomRange(0, highLowRange * volBoost);

      // ブレイク時は方向に沿った高値/安値
      if (i === breakoutAt) {
        if (isUpside) {
          high = Math.max(high, rangeHigh * 1.02);
          low = Math.max(low, rangeLow);
        } else {
          high = Math.min(high, rangeHigh);
          low = Math.min(low, rangeLow * 0.98);
        }
      }

      // 始値・終値（ブレイク時は方向に合わせる）
      let open, close;

      if (i === breakoutAt) {
        if (isUpside) {
          open = this.randomRange(currentPrice * 0.99, currentPrice);
          close = this.randomRange(currentPrice, high);
        } else {
          open = this.randomRange(currentPrice, currentPrice * 1.01);
          close = this.randomRange(low, currentPrice);
        }
      } else {
        open = this.randomRange(low * 1.02, high * 0.98);
        close = this.randomRange(low * 1.02, high * 0.98);
      }

      // 出来高（ブレイク時は増加）
      let volume = basePrice * 10;
      if (i >= breakoutAt && i <= breakoutAt + 5) {
        volume *= 2 + (5 - Math.abs(i - breakoutAt)) * 0.5;
      }

      candles.push({
        symbol,
        timestamp,
        open,
        high,
        low,
        close,
        volume
      });
    }

    return candles;
  }

  /**
   * ボラティリティ急増相場のローソク足データを生成
   * @param params 生成パラメータ
   * @returns 高ボラティリティ相場のローソク足配列
   */
  public static createVolatilitySpike({
    symbol = 'BTC/USDT',
    basePrice = 100,
    count = 60,
    spikeAt = 30, // 何本目でボラティリティが急増するか
    spikeDuration = 10, // ボラティリティ急増の継続期間
    spikeStrength = 5, // ボラティリティ急増の強さ（通常の何倍か）
    baseVolatility = 1.0,
    timeframe = 60000
  }: {
    symbol?: string;
    basePrice?: number;
    count?: number;
    spikeAt?: number;
    spikeDuration?: number;
    spikeStrength?: number;
    baseVolatility?: number;
    timeframe?: number;
  } = {}): TestCandle[] {
    const candles: TestCandle[] = [];
    const startTime = Date.now() - timeframe * count;
    let currentPrice = basePrice;

    for (let i = 0; i < count; i++) {
      const timestamp = startTime + i * timeframe;

      // 現在のボラティリティを計算
      let currentVolatility = baseVolatility;
      if (i >= spikeAt && i < spikeAt + spikeDuration) {
        // スパイク中はボラティリティを増加
        const spikeProgress = (i - spikeAt) / spikeDuration;
        const spikeFactor = spikeStrength * Math.sin(spikeProgress * Math.PI); // 山型のスパイク
        currentVolatility *= 1 + spikeFactor;
      }

      // ボラティリティに基づく価格変動
      const priceChange = this.generateNoise(basePrice * (currentVolatility / 100));
      currentPrice += priceChange;

      // 高値・安値（ボラティリティに比例）
      const highLowRange = basePrice * (currentVolatility / 100);
      const high = currentPrice + this.randomRange(0, highLowRange);
      const low = currentPrice - this.randomRange(0, highLowRange);

      // 始値・終値
      const open = this.randomRange(low * 1.05, high * 0.95);
      const close = this.randomRange(low * 1.05, high * 0.95);

      // 出来高（ボラティリティに比例）
      const volume = basePrice * 10 * (1 + currentVolatility / baseVolatility);

      candles.push({
        symbol,
        timestamp,
        open,
        high,
        low,
        close,
        volume
      });
    }

    return candles;
  }

  /**
   * 市場状態（トレンド/レンジ/ブレイクアウト）を検出する
   * @param candles ローソク足データ
   * @returns 検出された市場状態
   */
  public static detectMarketStatus(candles: TestCandle[]): MarketStatus {
    if (candles.length < 20) {
      return MarketStatus.UNKNOWN; // データ不足
    }

    // 価格変動の傾向を分析
    const prices = candles.map((c) => c.close);
    const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
    const secondHalf = prices.slice(Math.floor(prices.length / 2));

    const firstAvg = firstHalf.reduce((sum, price) => sum + price, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, price) => sum + price, 0) / secondHalf.length;

    // 価格変動の範囲
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const rangePercent = (range / avgPrice) * 100;

    // ボラティリティ（標準偏差）
    const variance =
      prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    const volatilityPercent = (stdDev / avgPrice) * 100;

    // 最新5本のボラティリティ
    const recentPrices = prices.slice(-5);
    const recentAvg = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length;
    const recentVariance =
      recentPrices.reduce((sum, price) => sum + Math.pow(price - recentAvg, 2), 0) /
      recentPrices.length;
    const recentStdDev = Math.sqrt(recentVariance);
    const recentVolatilityPercent = (recentStdDev / recentAvg) * 100;

    // ブレイクアウト検出（直近のボラティリティが急増）
    if (recentVolatilityPercent > volatilityPercent * 2) {
      return MarketStatus.BREAKOUT;
    }

    // トレンド検出（前半と後半の平均価格の差）
    const trendStrength = (Math.abs(secondAvg - firstAvg) / firstAvg) * 100;
    if (trendStrength > 3) {
      return secondAvg > firstAvg ? MarketStatus.UPTREND : MarketStatus.DOWNTREND;
    }

    // レンジ検出（全体の価格変動が小さい）
    if (rangePercent < 5) {
      return MarketStatus.RANGE;
    }

    return MarketStatus.UNKNOWN;
  }

  /**
   * ポジションデータの生成
   * @param params 生成パラメータ
   * @returns 生成されたポジション配列
   */
  public static createPositions({
    symbol = 'BTC/USDT',
    count = 3,
    avgPrice = 100,
    priceRange = 5, // 価格範囲（%）
    longRatio = 0.5, // ロングポジションの割合
    totalSize = 10000 // 全ポジションの合計サイズ
  }: {
    symbol?: string;
    count?: number;
    avgPrice?: number;
    priceRange?: number;
    longRatio?: number;
    totalSize?: number;
  } = {}): Position[] {
    const positions: Position[] = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      // 約定価格（指定範囲内でランダム）
      const priceVariation = avgPrice * (priceRange / 100);
      const entryPrice = avgPrice + this.generateNoise(priceVariation);

      // 約定時刻（過去1週間以内でランダム）
      const timestamp = now - this.randomRange(0, 7 * 86400000);

      // 売買方向（longRatioの確率でロング）
      const side = this.random() < longRatio ? OrderSide.BUY : OrderSide.SELL;

      // ポジションサイズ（合計サイズの中でランダムに分配）
      const sizeRatio = this.randomRange(0.1, 0.5); // 合計の10%〜50%
      const amount = (totalSize * sizeRatio) / entryPrice;

      // 現在価格（約定価格から少し変動）
      const currentPrice = entryPrice * (1 + this.generateNoise(priceRange / 200));

      // 未実現損益
      const priceDiff =
        side === OrderSide.BUY ? currentPrice - entryPrice : entryPrice - currentPrice;
      const unrealizedPnl = priceDiff * amount;

      positions.push({
        symbol,
        side,
        amount,
        entryPrice,
        timestamp,
        currentPrice,
        unrealizedPnl
      });
    }

    return positions;
  }

  /**
   * 注文データの生成
   * @param params 生成パラメータ
   * @returns 生成された注文配列
   */
  public static createOrders({
    symbol = 'BTC/USDT',
    count = 5,
    marketPrice = 100,
    limitRatio = 0.7, // 指値注文の割合
    buyRatio = 0.5, // 買い注文の割合
    priceRange = 5, // 価格範囲（%）
    totalSize = 10000 // 全注文の合計サイズ
  }: {
    symbol?: string;
    count?: number;
    marketPrice?: number;
    limitRatio?: number;
    buyRatio?: number;
    priceRange?: number;
    totalSize?: number;
  } = {}): Order[] {
    const orders: Order[] = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      // 注文タイプ（limitRatioの確率で指値）
      const type = this.random() < limitRatio ? OrderType.LIMIT : OrderType.MARKET;

      // 売買方向（buyRatioの確率で買い）
      const side = this.random() < buyRatio ? OrderSide.BUY : OrderSide.SELL;

      // 注文価格（指値の場合は現在価格から乖離、成行の場合は現在価格）
      let price: number | undefined;
      if (type === OrderType.LIMIT) {
        const priceVariation = marketPrice * (priceRange / 100);
        price =
          side === OrderSide.BUY
            ? marketPrice * (1 - this.randomRange(0.001, 0.02)) // 買いは現在より少し安く
            : marketPrice * (1 + this.randomRange(0.001, 0.02)); // 売りは現在より少し高く
      } else {
        // 成行注文の場合は価格を指定しない
        price = undefined;
      }

      // 注文サイズ（合計サイズの中でランダムに分配）
      const sizeRatio = this.randomRange(0.05, 0.3); // 合計の5%〜30%
      const amount = (totalSize * sizeRatio) / (price || marketPrice);

      // 注文ID
      const id = `order_${Date.now()}_${i}_${this.random().toString(36).substring(2, 8)}`;

      // 注文作成時刻（過去1日以内でランダム）
      const timestamp = now - this.randomRange(0, 86400000);

      orders.push({
        id,
        symbol,
        side,
        type,
        price,
        amount,
        timestamp,
        status: OrderStatus.OPEN
      });
    }

    return orders;
  }
}
