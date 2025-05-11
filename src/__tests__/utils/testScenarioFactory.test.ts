import { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

/**
 * REF-029: TestScenarioFactoryのテスト
 *
 * テスト用シナリオを生成するファクトリークラスのテスト
 */

import { TestScenarioFactory } from '../../utils/test-helpers/testsScenarioFactory';
import { MarketStatus } from '../../utils/test-helpers/marketDataFactory';
import { OrderSide, OrderType, StrategyType } from '../../core/types';

describe('TestScenarioFactory Tests', () => {
  describe('createTrendFollowingScenario', () => {
    test('should generate uptrend scenario', () => {
      const scenario = TestScenarioFactory.createTrendFollowingScenario({
        isUptrend: true,
        initialBalance: 10000
      });

      expect(scenario.name).toContain('Uptrend');
      expect(scenario.marketStatus).toBe(MarketStatus.UPTREND);
      expect(scenario.candles.length).toBeGreaterThan(0);
      expect(scenario.expectedStrategy).toBe(StrategyType.TREND_FOLLOWING);
      expect(scenario.shouldSucceed).toBe(true);

      // 期待されるシグナルがトレンド方向に合っていることを確認
      expect(scenario.expectedSignals.length).toBeGreaterThan(0);
      expect(scenario.expectedSignals[0].side).toBe(OrderSide.BUY);
    });

    test('should generate downtrend scenario', () => {
      const scenario = TestScenarioFactory.createTrendFollowingScenario({
        isUptrend: false,
        initialBalance: 10000
      });

      expect(scenario.name).toContain('Downtrend');
      expect(scenario.marketStatus).toBe(MarketStatus.DOWNTREND);
      expect(scenario.candles.length).toBeGreaterThan(0);
      expect(scenario.expectedStrategy).toBe(StrategyType.TREND_FOLLOWING);

      // 期待されるシグナルがトレンド方向に合っていることを確認
      expect(scenario.expectedSignals.length).toBeGreaterThan(0);
      expect(scenario.expectedSignals[0].side).toBe(OrderSide.SELL);
    });
  });

  describe('createRangeTradingScenario', () => {
    test('should generate valid range trading scenario', () => {
      const scenario = TestScenarioFactory.createRangeTradingScenario({
        rangeWidth: 5,
        initialBalance: 10000
      });

      expect(scenario.name).toContain('Range');
      expect(scenario.marketStatus).toBe(MarketStatus.RANGE);
      expect(scenario.candles.length).toBeGreaterThan(0);
      expect(scenario.expectedStrategy).toBe(StrategyType.RANGE_TRADING);
      expect(scenario.shouldSucceed).toBe(true);

      // レンジ相場では現在価格によってシグナルが変わる可能性があるため、
      // シグナルの存在や方向は厳密にテストしない
      expect(scenario.params).toHaveProperty('rangeWidth');
    });
  });

  describe('createBreakoutScenario', () => {
    test('should generate upside breakout scenario', () => {
      const scenario = TestScenarioFactory.createBreakoutScenario({
        isUpside: true,
        breakoutStrength: 10,
        initialBalance: 10000
      });

      expect(scenario.name).toContain('Upside Breakout');
      expect(scenario.marketStatus).toBe(MarketStatus.BREAKOUT);
      expect(scenario.candles.length).toBeGreaterThan(0);
      expect(scenario.expectedStrategy).toBe(StrategyType.DONCHIAN_BREAKOUT);

      // 期待されるシグナルがブレイクアウト方向に合っていることを確認
      expect(scenario.expectedSignals.length).toBeGreaterThan(0);
      expect(scenario.expectedSignals[0].side).toBe(OrderSide.BUY);
    });

    test('should generate downside breakout scenario', () => {
      const scenario = TestScenarioFactory.createBreakoutScenario({
        isUpside: false,
        breakoutStrength: 10,
        initialBalance: 10000
      });

      expect(scenario.name).toContain('Downside Breakout');
      expect(scenario.marketStatus).toBe(MarketStatus.BREAKOUT);
      expect(scenario.candles.length).toBeGreaterThan(0);
      expect(scenario.expectedStrategy).toBe(StrategyType.DONCHIAN_BREAKOUT);

      // 期待されるシグナルがブレイクアウト方向に合っていることを確認
      expect(scenario.expectedSignals.length).toBeGreaterThan(0);
      expect(scenario.expectedSignals[0].side).toBe(OrderSide.SELL);
    });
  });

  describe('createVolatilityScenario', () => {
    test('should generate high volatility scenario', () => {
      const scenario = TestScenarioFactory.createVolatilityScenario({
        spikeStrength: 5,
        includePositions: true,
        initialBalance: 10000
      });

      expect(scenario.name).toContain('Volatility');
      expect(scenario.marketStatus).toBe(MarketStatus.BREAKOUT);
      expect(scenario.candles.length).toBeGreaterThan(0);
      expect(scenario.expectedStrategy).toBe(StrategyType.EMERGENCY);

      // ポジションがある場合はクローズシグナルがあることを確認
      if (scenario.positions.length > 0) {
        expect(scenario.expectedSignals.length).toBeGreaterThan(0);
      }
    });
  });

  describe('createMultiTimeframeScenario', () => {
    test('should generate multi-timeframe scenario', () => {
      const scenario = TestScenarioFactory.createMultiTimeframeScenario({
        basePrice: 100,
        initialBalance: 10000
      });

      expect(scenario.name).toContain('Multi-Timeframe');
      expect(scenario.candles.length).toBeGreaterThan(0);

      // マルチタイムフレーム用のデータが含まれていることを確認
      expect(scenario.params).toBeDefined();
      if (scenario.params) {
        expect(scenario.params).toHaveProperty('candles1m');
        expect(scenario.params).toHaveProperty('candles5m');
        expect(scenario.params).toHaveProperty('candles1h');

        expect(scenario.params.candles1m.length).toBeGreaterThan(0);
        expect(scenario.params.candles5m.length).toBeGreaterThan(0);
        expect(scenario.params.candles1h.length).toBeGreaterThan(0);
      }
    });
  });

  describe('createErrorScenario', () => {
    test('should generate insufficient data error scenario', () => {
      const scenario = TestScenarioFactory.createErrorScenario({
        errorType: 'insufficient_data',
        initialBalance: 10000
      });

      expect(scenario.name).toContain('Error');
      expect(scenario.description).toContain('データ不足');
      expect(scenario.candles.length).toBeLessThan(10); // 少量のデータ
      expect(scenario.shouldSucceed).toBe(false); // 失敗を期待
      expect(scenario.expectedStrategy).toBe(StrategyType.EMERGENCY);
    });

    test('should generate zero price error scenario', () => {
      const scenario = TestScenarioFactory.createErrorScenario({
        errorType: 'zero_price',
        initialBalance: 10000
      });

      expect(scenario.name).toContain('Error');
      expect(scenario.description).toContain('価格ゼロ');
      expect(scenario.candles.length).toBeGreaterThan(0);
      expect(scenario.shouldSucceed).toBe(false); // 失敗を期待
    });

    test('should generate negative price error scenario', () => {
      const scenario = TestScenarioFactory.createErrorScenario({
        errorType: 'negative_price',
        initialBalance: 10000
      });

      expect(scenario.name).toContain('Error');
      expect(scenario.description).toContain('負の価格');
      expect(scenario.candles.length).toBeGreaterThan(0);
      expect(scenario.shouldSucceed).toBe(false); // 失敗を期待

      // 負の価格が含まれていることを確認
      const hasNegativePrice = scenario.candles.some((c) => c.low < 0);
      expect(hasNegativePrice).toBe(true);
    });
  });
});
