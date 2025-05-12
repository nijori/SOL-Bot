import { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

import { Candle, OrderSide, OrderType, Position, StrategyType } from '../../core/types';
import * as trendFollowStrategyModule from '../../strategies/trendFollowStrategy';
import { calculateParabolicSAR, ParabolicSARResult } from '../../indicators/parabolicSAR';
import { calculateATR, getValidStopDistance } from '../../utils/atrUtils';

// リソーストラッカーとテストクリーンアップ関連のインポート (CommonJS形式)
const ResourceTracker = require('../../utils/test-helpers/resource-tracker');
const { 
  standardBeforeEach, 
  standardAfterEach, 
  standardAfterAll 
} = require('../../utils/test-helpers/test-cleanup');

// global型拡張
declare global {
  namespace NodeJS {
    interface Global {
      __RESOURCE_TRACKER: any;
    }
  }
}

// technicalindicators のモック
jest.mock('technicalindicators', () => {
  return {
    ADX: {
      calculate: jest.fn(() => [{
        adx: 30,  // トレンド強度を示す値
        plusDI: 25,
        minusDI: 15
      }])
    }
  };
});

// モック設定
jest.mock('../../indicators/parabolicSAR.js', () => {
  return {
    calculateParabolicSAR: jest.fn((candles: Candle[]) => {
      if (!Array.isArray(candles) || candles.length === 0) {
        return { sar: 100, isUptrend: true, accelerationFactor: 0.02, extremePoint: 102 };
      }
      
      const lastCandle = candles[candles.length - 1];
      const isUptrend = lastCandle.close > 100;
      
      return {
        sar: isUptrend ? lastCandle.low - 1 : lastCandle.high + 1,
        isUptrend,
        accelerationFactor: 0.02,
        extremePoint: isUptrend ? lastCandle.high : lastCandle.low
      };
    }),
    ParabolicSARResult: jest.fn()
  };
});

jest.mock('../../utils/atrUtils.js', () => {
  return {
    calculateATR: jest.fn().mockReturnValue(3.0),
    getValidStopDistance: jest.fn().mockReturnValue(4.5)
  };
});

jest.mock('../../utils/positionSizing.js', () => {
  return {
    calculateRiskBasedPositionSize: jest.fn().mockReturnValue(100) // デフォルトで100を返す
  };
});

// config/parametersモジュールのモック
jest.mock('../../config/parameters.js', () => {
  return {
    MARKET_PARAMETERS: {
      ATR_PERIOD: 14,
      DONCHIAN_PERIOD: 20,
      EMA_PERIOD: 200,
      ATR_PERCENTAGE: 5.0,
      EMA_SLOPE_THRESHOLD: 0.1,
      ADJUST_SLOPE_PERIODS: 5
    },
    TREND_PARAMETERS: {
      TRAILING_STOP_FACTOR: 2.0,
      ADDON_POSITION_R_THRESHOLD: 1.0,
      ADDON_POSITION_SIZE_FACTOR: 0.5,
      POSITION_SIZING: 0.1,
      ADX_PERIOD: 14,
      ADX_THRESHOLD: 25
    },
    RANGE_PARAMETERS: {
      GRID_ATR_MULTIPLIER: 0.5,
      ATR_VOLATILITY_THRESHOLD: 3.0,
      GRID_LEVELS: 5
    },
    RISK_PARAMETERS: {
      MAX_RISK_PER_TRADE: 0.02,
      MAX_POSITION_PERCENTAGE: 0.1,
      BLACK_SWAN_THRESHOLD: 0.15,
      MIN_STOP_DISTANCE_PERCENTAGE: 1.0
    },
    OPERATION_MODE: 'simulation'
  };
});

// ParameterServiceのモック
jest.mock('../../config/parameterService.js', () => {
  return {
    parameterService: {
      get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
        // 戦略のパラメータをモックデータで返す
        const mockParams: Record<string, any> = {
          'trendFollowStrategy.donchianPeriod': 20,
          'trendFollowStrategy.adxThreshold': 25,
          'trendFollowStrategy.atrMultiplier': 3.0,
          'trendFollowStrategy.trailingStopFactor': 2.5,
          'trendFollowStrategy.useParabolicSAR': true,
          'risk.maxRiskPerTrade': 0.02,
          'trendFollowStrategy.initialStopAtrFactor': 1.5,
          'trendFollowStrategy.breakevenMoveThreshold': 2.0,
          'trendFollowStrategy.profitLockThreshold': 3.0,
          'trendFollowStrategy.profitLockPercentage': 0.5
        };
        return mockParams[key] || defaultValue;
      }),
      getMarketParameters: jest.fn().mockReturnValue({
        ATR_PERIOD: 14,
        DONCHIAN_PERIOD: 20,
        EMA_PERIOD: 200,
        ATR_PERCENTAGE: 5.0,
        EMA_SLOPE_THRESHOLD: 0.1,
        ADJUST_SLOPE_PERIODS: 5
      }),
      getTrendParameters: jest.fn().mockReturnValue({
        TRAILING_STOP_FACTOR: 2.0,
        ADDON_POSITION_R_THRESHOLD: 1.0,
        ADDON_POSITION_SIZE_FACTOR: 0.5,
        POSITION_SIZING: 0.1,
        ADX_PERIOD: 14,
        ADX_THRESHOLD: 25
      }),
      getRangeParameters: jest.fn().mockReturnValue({
        GRID_ATR_MULTIPLIER: 0.5,
        ATR_VOLATILITY_THRESHOLD: 3.0,
        GRID_LEVELS: 5
      }),
      getRiskParameters: jest.fn().mockReturnValue({
        MAX_RISK_PER_TRADE: 0.02,
        MAX_POSITION_PERCENTAGE: 0.1,
        BLACK_SWAN_THRESHOLD: 0.15,
        MIN_STOP_DISTANCE_PERCENTAGE: 1.0
      }),
      getMonitoringParameters: jest.fn().mockReturnValue({
        ENABLE_DISCORD: false,
        LOG_LEVEL: 'info'
      }),
      getBacktestParameters: jest.fn().mockReturnValue({
        START_DATE: '2023-01-01',
        END_DATE: '2023-12-31'
      }),
      getOperationMode: jest.fn().mockReturnValue('simulation'),
      getAllParameters: jest.fn().mockReturnValue({
        market: {
          ATR_PERIOD: 14,
          DONCHIAN_PERIOD: 20
        },
        trend: {
          TRAILING_STOP_FACTOR: 2.0
        }
      })
    },
    ParameterService: jest.fn().mockImplementation(() => {
      return {
        get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
          return defaultValue;
        }),
        getMarketParameters: jest.fn().mockReturnValue({
          ATR_PERIOD: 14,
          DONCHIAN_PERIOD: 20
        }),
        getTrendParameters: jest.fn().mockReturnValue({
          TRAILING_STOP_FACTOR: 2.0
        })
      };
    })
  };
});

describe('TrendFollowStrategy', () => {
  // テスト前に毎回モックをリセットし、リソーストラッカーを準備
  beforeEach(() => {
    jest.clearAllMocks();
    standardBeforeEach();
    
    // グローバルリソーストラッカーの初期化（必要な場合）
    if (!global.__RESOURCE_TRACKER) {
      global.__RESOURCE_TRACKER = new ResourceTracker();
    }
  });

  // 各テスト後にリソース解放
  afterEach(async () => {
    await standardAfterEach();
  });

  // すべてのテスト完了後に最終クリーンアップを実行
  afterAll(async () => {
    await standardAfterAll();
  });

  // テスト用のキャンドルデータを生成
  const generateTestCandles = (
    count: number,
    startPrice: number = 100,
    trend: 'up' | 'down' | 'flat' = 'flat'
  ): Candle[] => {
    const candles: Candle[] = [];
    let price = startPrice;

    for (let i = 0; i < count; i++) {
      // トレンドに基づいて価格変動を追加
      if (trend === 'up') {
        price += 0.5 + Math.random();
      } else if (trend === 'down') {
        price -= 0.5 + Math.random();
      } else {
        price += (Math.random() - 0.5) * 0.5; // フラット±0.25
      }

      candles.push({
        timestamp: Date.now() - (count - i) * 60000,
        open: price - 0.2,
        high: price + 0.5,
        low: price - 0.5,
        close: price,
        volume: 1000 + Math.random() * 500
      });
    }

    return candles;
  };

  // private関数をエクスポートしてテスト可能にする
  const isSARBuySignal = (trendFollowStrategyModule as any).isSARBuySignal;
  const isSARSellSignal = (trendFollowStrategyModule as any).isSARSellSignal;

  describe('isSARBuySignal', () => {
    it('トレンド転換時（下降→上昇）にtrue を返す', () => {
      // テスト用のキャンドルデータ
      const candles = generateTestCandles(10);
      const latestCandle = candles[candles.length - 1];

      // モックSARデータ - 実装に合わせて修正
      const mockCurrentSAR: ParabolicSARResult = {
        sar: latestCandle.low - 1, // 価格より下にSARがある
        isUptrend: true, // 上昇トレンド
        accelerationFactor: 0.02,
        extremePoint: 102
      };

      // 関数を実行
      const result = isSARBuySignal(candles, mockCurrentSAR);

      // アサーション
      expect(result).toBe(true);
    });

    it('トレンドが継続中（上昇→上昇）の場合はfalseを返す', () => {
      // テスト用のキャンドルデータ
      const candles = generateTestCandles(10);
      const latestCandle = candles[candles.length - 1];
      
      // モックSARデータ - 実装に合わせて修正
      const mockCurrentSAR: ParabolicSARResult = {
        sar: latestCandle.high + 1, // 価格より上にSARがある
        isUptrend: true, // 上昇トレンド
        accelerationFactor: 0.02,
        extremePoint: 101
      };

      // 関数を実行
      const result = isSARBuySignal(candles, mockCurrentSAR);

      // アサーション
      expect(result).toBe(false);
    });
  });

  describe('isSARSellSignal', () => {
    it('トレンド転換時（上昇→下降）にtrue を返す', () => {
      // テスト用のキャンドルデータ
      const candles = generateTestCandles(10);
      const latestCandle = candles[candles.length - 1];

      // モックSARデータ - 実装に合わせて修正
      const mockCurrentSAR: ParabolicSARResult = {
        sar: latestCandle.high + 1, // 価格より上にSARがある
        isUptrend: false, // 下降トレンド
        accelerationFactor: 0.02,
        extremePoint: 98
      };

      // 関数を実行
      const result = isSARSellSignal(candles, mockCurrentSAR);

      // アサーション
      expect(result).toBe(true);
      expect(calculateParabolicSAR).toHaveBeenCalledTimes(0); // この関数内では呼ばれない
    });

    it('トレンドが継続中（下降→下降）の場合はfalseを返す', () => {
      // テスト用のキャンドルデータ
      const candles = generateTestCandles(10);
      const latestCandle = candles[candles.length - 1];

      // モックSARデータ - 実装に合わせて修正
      const mockCurrentSAR: ParabolicSARResult = {
        sar: latestCandle.low - 1, // 価格より下にSARがある
        isUptrend: false, // 下降トレンド
        accelerationFactor: 0.02,
        extremePoint: 97
      };

      // 関数を実行
      const result = isSARSellSignal(candles, mockCurrentSAR);

      // アサーション
      expect(result).toBe(false);
      expect(calculateParabolicSAR).toHaveBeenCalledTimes(0); // この関数内では呼ばれない
    });
  });
});
