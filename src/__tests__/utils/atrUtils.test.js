// @ts-nocheck
/**
 * ATRユーティリティのテスト (CommonJS)
 * 
 * モックは最初に実行される必要があります。
 */

const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

// パラメーターサービスのモック
jest.mock('../../config/parameterService', () => ({
  parameterService: {
    get: jest.fn((key, defaultValue) => {
      const params = {
        'risk.defaultAtrPercentage': 0.02,
        'risk.minAtrValue': 0.0001,
        'risk.minStopDistancePercentage': 0.01
      };
      return params[key] !== undefined ? params[key] : defaultValue;
    })
  }
}));

const atrUtils = require('../../utils/atrUtils');
const { calculateATR, getFallbackATR, isATRTooSmall, getValidStopDistance } = atrUtils;

// テスト用のダミーローソク足データ生成
function generateDummyCandles(count, basePrice = 100) {
  const candles = [];

  for (let i = 0; i < count; i++) {
    candles.push({
      timestamp: Date.now() - (count - i) * 60000,
      open: basePrice + i * 0.1,
      high: basePrice + i * 0.1 + 0.5,
      low: basePrice + i * 0.1 - 0.5,
      close: basePrice + i * 0.1 + 0.2,
      volume: 1000 + i * 100
    });
  }

  return candles;
}

// ゼロボラティリティのローソク足データ生成
function generateZeroVolatilityCandles(count, price = 100) {
  return Array(count)
    .fill(0)
    .map((_, i) => ({
      timestamp: Date.now() - (count - i) * 60000,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 1000
    }));
}

describe('ATRユーティリティ', () => {
  // 各テスト前にモックをリセット
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateATR関数', () => {
    test('正常なATR計算', () => {
      const candles = generateDummyCandles(20, 100);
      const atr = calculateATR(candles, 14, 'TestStrategy');

      // ATRが0より大きいことを確認
      expect(atr).toBeGreaterThan(0);
      // ATRが極端に大きすぎないことを確認
      expect(atr).toBeLessThan(candles[candles.length - 1].close * 0.1);
    });

    test('データ不足時のフォールバック', () => {
      const candles = generateDummyCandles(5, 100);
      const atr = calculateATR(candles, 14, 'TestStrategy');

      // フォールバック値（currentPrice * 0.02）になっていることを確認
      const expectedFallback = candles[candles.length - 1].close * 0.02;
      expect(atr).toBeCloseTo(expectedFallback);
    });

    test('ゼロボラティリティ時のフォールバック', () => {
      const candles = generateZeroVolatilityCandles(20, 100);
      const atr = calculateATR(candles, 14, 'TestStrategy');

      // フォールバック値（currentPrice * 0.02）になっていることを確認
      const expectedFallback = 100 * 0.02;
      expect(atr).toBeCloseTo(expectedFallback);
    });

    test('キャンドル配列が空の場合', () => {
      const atr = calculateATR([], 14, 'TestStrategy');

      // 空配列の場合は0を返す
      expect(atr).toBe(0);
    });
  });

  describe('getFallbackATR関数', () => {
    test('正常なフォールバック計算', () => {
      const candles = generateDummyCandles(5, 200);
      const fallbackAtr = getFallbackATR(candles, 'TestStrategy');

      // フォールバック値（currentPrice * 0.02）を確認
      const expectedFallback = candles[candles.length - 1].close * 0.02;
      expect(fallbackAtr).toBeCloseTo(expectedFallback);
    });

    test('キャンドル配列が空の場合', () => {
      const fallbackAtr = getFallbackATR([], 'TestStrategy');

      // 空配列の場合は0を返す
      expect(fallbackAtr).toBe(0);
    });
  });

  describe('isATRTooSmall関数', () => {
    test('ATRが0の場合', () => {
      const candles = generateDummyCandles(5, 100);
      const result = isATRTooSmall(0, candles);

      expect(result).toBe(true);
    });

    test('ATRが極小値の場合', () => {
      const candles = generateDummyCandles(5, 100);
      const tinyAtr = candles[candles.length - 1].close * 0.00005; // MIN_ATR_VALUE(0.0001)未満
      const result = isATRTooSmall(tinyAtr, candles);

      expect(result).toBe(true);
    });

    test('ATRが正常値の場合', () => {
      const candles = generateDummyCandles(5, 100);
      const normalAtr = candles[candles.length - 1].close * 0.01; // 適正値
      const result = isATRTooSmall(normalAtr, candles);

      expect(result).toBe(false);
    });

    test('キャンドル配列が空の場合', () => {
      const result = isATRTooSmall(1.0, []);

      expect(result).toBe(true);
    });
  });

  describe('getValidStopDistance関数', () => {
    test('正常なストップ距離の場合', () => {
      const price = 100;
      const stopDistance = 2.0; // 2%
      const result = getValidStopDistance(price, stopDistance, 'TestStrategy');

      expect(result).toBe(stopDistance);
    });

    test('ストップ距離が極小の場合のフォールバック', () => {
      const price = 100;
      const tinyStopDistance = 0.005; // 0.005% < 最小ストップ距離1%
      const result = getValidStopDistance(price, tinyStopDistance, 'TestStrategy');

      // フォールバック値（price * 0.01）を確認
      const expectedFallback = price * 0.01;
      expect(result).toBeCloseTo(expectedFallback);
    });

    test('ストップ距離が0の場合のフォールバック', () => {
      const price = 100;
      const result = getValidStopDistance(price, 0, 'TestStrategy');

      // フォールバック値（price * 0.01）を確認
      const expectedFallback = price * 0.01;
      expect(result).toBeCloseTo(expectedFallback);
    });
  });
});
