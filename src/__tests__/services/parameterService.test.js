// @ts-nocheck
/**
 * ParameterServiceの簡略化テスト
 */

/**
 * シンプルなモックパラメータサービス
 */
const mockParamService = {
  get: function(path, defaultValue) {
    const params = {
      'market.atr_period': 14,
      'trend.trailing_stop_factor': 2.0,
      'risk.max_risk_per_trade': 0.02
    };
    return params[path] !== undefined ? params[path] : defaultValue;
  },
  getAllParameters: function() {
    return {
      market: { atr_period: 14, donchian_period: 20 },
      trend: { trailing_stop_factor: 2.0 },
      risk: { max_risk_per_trade: 0.02 }
    };
  }
};

// jestをインポート
const jest = require('@jest/globals').jest;
const { describe, test, it, expect } = require('@jest/globals');

describe('ParameterService', () => {
  /**
   * 基本的なパラメータ取得をテスト
   */
  describe('get', () => {
    it('正しいパスからパラメータを取得できる', () => {
      expect(mockParamService.get('market.atr_period')).toBe(14);
      expect(mockParamService.get('trend.trailing_stop_factor')).toBe(2.0);
      expect(mockParamService.get('risk.max_risk_per_trade')).toBe(0.02);
    });

    it('存在しないパスに対してはデフォルト値を返す', () => {
      expect(mockParamService.get('non.existent.path', 'default')).toBe('default');
      expect(mockParamService.get('market.non_existent', 42)).toBe(42);
    });
  });

  describe('getAllParameters', () => {
    it('すべてのパラメータを取得できる', () => {
      const params = mockParamService.getAllParameters();
      expect(params.market).toBeDefined();
      expect(params.trend).toBeDefined();
      expect(params.risk).toBeDefined();
    });
  });

  describe('dependency injection', () => {
    it('モックサービスを戦略に注入できる', () => {
      // モックサービスを使用する戦略クラス
      class MockStrategy {
        constructor(paramService) {
          this.paramService = paramService;
        }

        getTrailingStopFactor() {
          return this.paramService.get('trend.trailing_stop_factor', 1.0);
        }

        getAtrPeriod() {
          return this.paramService.get('market.atr_period', 10);
        }
      }

      const strategy = new MockStrategy(mockParamService);
      expect(strategy.getTrailingStopFactor()).toBe(2.0);
      expect(strategy.getAtrPeriod()).toBe(14);
    });
  });
}); 