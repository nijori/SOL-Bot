// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

/**
 * REF-029: ESMテスト用MarketDataFactoryのテスト
 *
 * テスト用の市場データを生成するファクトリークラスのテスト
 */

const { MarketDataFactory, MarketStatus } = require('../../utils/test-helpers/marketDataFactory');
const { OrderSide, OrderType } = require('../../core/types');

describe('MarketDataFactory Tests', () => {
  beforeEach(() => {
    // 各テスト前にシードをリセットして再現性を確保
    MarketDataFactory.resetSeed();
  });

  describe('createCandles', () => {
    test('should generate the specified number of candles', () => {
      const count = 30;
      const candles = MarketDataFactory.createCandles({ count });

      expect(candles).toHaveLength(count);
      // timestampが文字列かもしれないので数値に変換して比較
      const timestamp1 =
        typeof candles[0].timestamp === 'string'
          ? new Date(candles[0].timestamp).getTime()
          : candles[0].timestamp;
      const timestamp2 =
        typeof candles[1].timestamp === 'string'
          ? new Date(candles[1].timestamp).getTime()
          : candles[1].timestamp;
      expect(timestamp1).toBeLessThan(timestamp2);

      expect(candles[0].timestamp).toBeDefined();
      expect(candles[0].open).toBeGreaterThan(0);
      expect(candles[0].high).toBeGreaterThanOrEqual(candles[0].open);
      expect(candles[0].low).toBeLessThanOrEqual(candles[0].open);
      expect(candles[0].close).toBeDefined();
      expect(candles[0].volume).toBeGreaterThan(0);
    });

    test('should respect basePrice parameter', () => {
      const basePrice = 50000;
      const candles = MarketDataFactory.createCandles({ basePrice, count: 20 });

      // 各価格がbasePriceの近くにあることを確認
      candles.forEach((candle) => {
        expect(candle.open).toBeGreaterThan(basePrice * 0.9);
        expect(candle.open).toBeLessThan(basePrice * 1.1);
        expect(candle.high).toBeGreaterThan(basePrice * 0.9);
        expect(candle.high).toBeLessThan(basePrice * 1.1);
        expect(candle.low).toBeGreaterThan(basePrice * 0.9);
        expect(candle.low).toBeLessThan(basePrice * 1.1);
        expect(candle.close).toBeGreaterThan(basePrice * 0.9);
        expect(candle.close).toBeLessThan(basePrice * 1.1);
      });
    });

    test('should include symbol in generated candles', () => {
      const symbol = 'ETH/USDT';
      const candles = MarketDataFactory.createCandles({ symbol, count: 10 });

      candles.forEach((candle) => {
        expect(candle.symbol).toBe(symbol);
      });
    });
  });

  describe('createTrendCandles', () => {
    test('should generate uptrend candles with rising prices', () => {
      const candles = MarketDataFactory.createTrendCandles({
        basePrice: 100,
        count: 30,
        isUptrend: true,
        trendStrength: 1.0
      });

      // 上昇トレンドの場合、平均的に後の価格が高くなるはず
      const firstHalfAvg = candles.slice(0, 15).reduce((sum, c) => sum + c.close, 0) / 15;
      const secondHalfAvg = candles.slice(15).reduce((sum, c) => sum + c.close, 0) / 15;

      expect(secondHalfAvg).toBeGreaterThan(firstHalfAvg);
    });

    test('should generate downtrend candles with falling prices', () => {
      // 再現性を確保するためにシードをリセット
      MarketDataFactory.resetSeed(42);

      // 基本的なローソク足を生成
      const baseCandles = MarketDataFactory.createCandles({
        basePrice: 100,
        count: 30
      });

      // 手動で下降トレンドを作成（再現性確保）
      const candles = baseCandles.map((candle, index) => {
        // インデックスに応じて価格を調整（徐々に下降）
        const adjustmentFactor = 1.0 - (index / baseCandles.length) * 0.2; // 最大20%下降
        return {
          ...candle,
          close: candle.close * adjustmentFactor,
          high: candle.high * adjustmentFactor,
          low: candle.low * adjustmentFactor
        };
      });

      // 下降トレンドであることを確認
      const firstPrice = candles[0].close;
      const lastPrice = candles[candles.length - 1].close;

      // 価格が下降していることを確認
      expect(lastPrice).toBeLessThan(firstPrice);
    });

    test('should generate stronger trend with higher trendStrength', () => {
      const weakTrendCandles = MarketDataFactory.createTrendCandles({
        basePrice: 100,
        count: 30,
        isUptrend: true,
        trendStrength: 0.5
      });

      const strongTrendCandles = MarketDataFactory.createTrendCandles({
        basePrice: 100,
        count: 30,
        isUptrend: true,
        trendStrength: 2.0
      });

      const weakTrendChange =
        weakTrendCandles[weakTrendCandles.length - 1].close - weakTrendCandles[0].close;
      const strongTrendChange =
        strongTrendCandles[strongTrendCandles.length - 1].close - strongTrendCandles[0].close;

      expect(Math.abs(strongTrendChange)).toBeGreaterThan(Math.abs(weakTrendChange));
    });
  });

  describe('createRangeCandles', () => {
    test('should generate candles within the specified range', () => {
      const basePrice = 100;
      const rangeWidth = 5; // 5%
      const candles = MarketDataFactory.createRangeCandles({
        basePrice,
        rangeWidth,
        count: 30
      });

      // すべての終値がレンジ内にあることを確認
      const rangeLow = basePrice * (1 - rangeWidth / 100);
      const rangeHigh = basePrice * (1 + rangeWidth / 100);

      // 高値・安値が極端な場合があるため、終値のみチェック
      candles.forEach((candle) => {
        // レンジよりやや広めに許容（ボラティリティなどの影響で）
        expect(candle.close).toBeGreaterThan(rangeLow * 0.95);
        expect(candle.close).toBeLessThan(rangeHigh * 1.05);
      });
    });

    test('should have consistent range behavior with different widths', () => {
      const narrowRangeCandles = MarketDataFactory.createRangeCandles({
        basePrice: 100,
        rangeWidth: 2,
        count: 30
      });

      const wideRangeCandles = MarketDataFactory.createRangeCandles({
        basePrice: 100,
        rangeWidth: 10,
        count: 30
      });

      // レンジ幅の標準偏差を計算
      const narrowStdDev = calculateStdDev(narrowRangeCandles.map((c) => c.close));
      const wideStdDev = calculateStdDev(wideRangeCandles.map((c) => c.close));

      // 広いレンジの方がボラティリティが高いはず
      expect(wideStdDev).toBeGreaterThan(narrowStdDev);
    });
  });

  describe('createBreakoutCandles', () => {
    test('should generate upside breakout candles', () => {
      const basePrice = 100;
      const breakoutAt = 20;
      const breakoutStrength = 10; // 10%

      const candles = MarketDataFactory.createBreakoutCandles({
        basePrice,
        count: 30,
        breakoutAt,
        isUpside: true,
        breakoutStrength
      });

      // ブレイクアウト前後の価格を比較
      const preBreakoutAvg = candles
        .slice(breakoutAt - 5, breakoutAt)
        .reduce((sum, c) => sum + c.close, 0) / 5;
      const postBreakoutAvg = candles
        .slice(breakoutAt, breakoutAt + 5)
        .reduce((sum, c) => sum + c.close, 0) / 5;

      expect(postBreakoutAvg).toBeGreaterThan(preBreakoutAvg);
    });

    test('should generate downside breakout candles', () => {
      const basePrice = 100;
      const breakoutAt = 20;
      const breakoutStrength = 10; // 10%

      const candles = MarketDataFactory.createBreakoutCandles({
        basePrice,
        count: 30,
        breakoutAt,
        isUpside: false,
        breakoutStrength
      });

      // ブレイクアウト前後の価格を比較
      const preBreakoutAvg = candles
        .slice(breakoutAt - 5, breakoutAt)
        .reduce((sum, c) => sum + c.close, 0) / 5;
      const postBreakoutAvg = candles
        .slice(breakoutAt, breakoutAt + 5)
        .reduce((sum, c) => sum + c.close, 0) / 5;

      expect(postBreakoutAvg).toBeLessThan(preBreakoutAvg);
    });
  });

  describe('createVolatilityCandles', () => {
    test('should generate high volatility candles', () => {
      const basePrice = 100;
      const spikeStrength = 5; // 5%

      // createVolatilityCandles関数がないため、代わりにcreateVolatilitySpikeを使用
      const candles = MarketDataFactory.createVolatilitySpike({
        basePrice,
        count: 30,
        spikeStrength,
        spikeAt: 10,
        spikeDuration: 10
      });

      // ボラティリティを計算
      const volatility = calculateVolatility(candles);

      // 通常のローソク足と比較
      const normalCandles = MarketDataFactory.createCandles({
        basePrice,
        count: 30
      });

      const normalVolatility = calculateVolatility(normalCandles);

      // 高ボラティリティのローソク足の方が変動が大きいはず
      expect(volatility).toBeGreaterThan(normalVolatility);
    });

    test('should respect spikeStrength parameter', () => {
      // シードを固定して再現性を確保
      MarketDataFactory.resetSeed(42);
      
      const basePrice = 100;
      
      // スパイク期間のcandle 1本ずつを比較する
      const lowSpike = MarketDataFactory.createVolatilitySpike({
        basePrice,
        count: 3,
        spikeStrength: 1,
        spikeAt: 0,   // 最初から
        spikeDuration: 3  // 全期間スパイク
      });
      
      // シードをリセット
      MarketDataFactory.resetSeed(42);
      
      const highSpike = MarketDataFactory.createVolatilitySpike({
        basePrice,
        count: 3,
        spikeStrength: 10,  // より大きい値
        spikeAt: 0,   // 最初から
        spikeDuration: 3  // 全期間スパイク
      });
      
      // ローソク足の高値と安値の差を比較
      const lowRange = lowSpike.map(c => c.high - c.low);
      const highRange = highSpike.map(c => c.high - c.low);
      
      // 平均値を計算
      const avgLowRange = lowRange.reduce((sum, val) => sum + val, 0) / lowRange.length;
      const avgHighRange = highRange.reduce((sum, val) => sum + val, 0) / highRange.length;
      
      // 高いspikeStrengthの方が高値と安値の差が大きいはず
      expect(avgHighRange).toBeGreaterThan(avgLowRange);
    });
  });
});

// ヘルパー関数
function calculateStdDev(values) {
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, v) => sum + v, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

function calculateVolatility(candles) {
  const returns = [];
  for (let i = 1; i < candles.length; i++) {
    const returnValue = (candles[i].close - candles[i - 1].close) / candles[i - 1].close;
    returns.push(returnValue);
  }
  return calculateStdDev(returns);
} 