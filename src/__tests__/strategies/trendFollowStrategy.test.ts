import { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

import { Candle, OrderSide, OrderType, Position, StrategyType } from '../../core/types';
import * as trendFollowStrategyModule from '../../strategies/trendFollowStrategy';
import { calculateParabolicSAR, ParabolicSARResult } from '../../indicators/parabolicSAR';
import { calculateATR, getValidStopDistance } from '../../utils/atrUtils';

// モック設定を最上部に移動
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

// technicalindicators のモックも上部に移動
jest.mock('technicalindicators', () => {
  return {
    ADX: {
      calculate: jest.fn(() => [{
        adx: 30,  // トレンド強度を示す値
        plusDI: 25,
        minusDI: 15
      }])
    },
    Highest: {
      calculate: jest.fn((input: { values?: number[] }) => {
        if (input && Array.isArray(input.values)) {
          return [Math.max(...input.values)];
        }
        return [0];
      })
    },
    Lowest: {
      calculate: jest.fn((input: { values?: number[] }) => {
        if (input && Array.isArray(input.values)) {
          return [Math.min(...input.values)];
        }
        return [0];
      })
    },
    ATR: {
      calculate: jest.fn(() => [3.0])
    }
  };
});

// その他のモックも上部に移動
jest.mock('../../indicators/parabolicSAR.js', () => {
  return {
    calculateParabolicSAR: jest.fn((candles) => {
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

jest.mock('../../config/parameterService.js', () => {
  return {
    parameterService: {
      get: jest.fn((key, defaultValue) => {
        const mockParams = {
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
        return mockParams[key as string] ?? defaultValue;
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
      getOperationMode: jest.fn().mockReturnValue('simulation'),
      getAllParameters: jest.fn().mockReturnValue({
        market: {
          ATR_PERIOD: 14,
          DONCHIAN_PERIOD: 20,
          EMA_PERIOD: 200,
          ATR_PERCENTAGE: 5.0,
          EMA_SLOPE_THRESHOLD: 0.1,
          ADJUST_SLOPE_PERIODS: 5
        },
        trend: {
          TRAILING_STOP_FACTOR: 2.0,
          ADDON_POSITION_R_THRESHOLD: 1.0,
          ADDON_POSITION_SIZE_FACTOR: 0.5,
          POSITION_SIZING: 0.1,
          ADX_PERIOD: 14,
          ADX_THRESHOLD: 25
        },
        range: {
          GRID_ATR_MULTIPLIER: 0.5,
          ATR_VOLATILITY_THRESHOLD: 3.0,
          GRID_LEVELS: 5
        },
        risk: {
          MAX_RISK_PER_TRADE: 0.02,
          MAX_POSITION_PERCENTAGE: 0.1,
          BLACK_SWAN_THRESHOLD: 0.15,
          MIN_STOP_DISTANCE_PERCENTAGE: 1.0
        }
      })
    },
    ParameterService: jest.fn().mockImplementation(() => {
      return {
        get: jest.fn((key, defaultValue) => {
          const mockParams = {
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
          return mockParams[key as string] ?? defaultValue;
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
        getOperationMode: jest.fn().mockReturnValue('simulation'),
        getAllParameters: jest.fn().mockReturnValue({
          market: {
            ATR_PERIOD: 14,
            DONCHIAN_PERIOD: 20,
            EMA_PERIOD: 200,
            ATR_PERCENTAGE: 5.0,
            EMA_SLOPE_THRESHOLD: 0.1,
            ADJUST_SLOPE_PERIODS: 5
          },
          trend: {
            TRAILING_STOP_FACTOR: 2.0,
            ADDON_POSITION_R_THRESHOLD: 1.0,
            ADDON_POSITION_SIZE_FACTOR: 0.5,
            POSITION_SIZING: 0.1,
            ADX_PERIOD: 14,
            ADX_THRESHOLD: 25
          },
          range: {
            GRID_ATR_MULTIPLIER: 0.5,
            ATR_VOLATILITY_THRESHOLD: 3.0,
            GRID_LEVELS: 5
          },
          risk: {
            MAX_RISK_PER_TRADE: 0.02,
            MAX_POSITION_PERCENTAGE: 0.1,
            BLACK_SWAN_THRESHOLD: 0.15,
            MIN_STOP_DISTANCE_PERCENTAGE: 1.0
          }
        })
      };
    })
  };
});

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
      // テスト用のキャンドルデータ（価格100のclose、low=99.5）
      const candles = generateTestCandles(10);
      
      // モックSAR結果 - SARがlowより下であることを確実にする
      const latestCandle = candles[candles.length - 1];
      const sarResult: ParabolicSARResult = {
        sar: latestCandle.low - 1, // lowより確実に1ポイント下
        isUptrend: true,
        accelerationFactor: 0.02,
        extremePoint: 102
      };
      
      // テスト実行
      const result = isSARBuySignal(candles, sarResult);
      
      // 検証
      expect(result).toBe(true);
    });
    
    it('下降中はfalseを返す', () => {
      // テスト用のキャンドルデータ
      const candles = generateTestCandles(10);
      
      // モックSAR結果
      const sarResult: ParabolicSARResult = {
        sar: 105, // 価格（100）より上
        isUptrend: false, // 下降中
        accelerationFactor: 0.02,
        extremePoint: 98
      };
      
      // テスト実行
      const result = isSARBuySignal(candles, sarResult);
      
      // 検証
      expect(result).toBe(false);
    });
  });
  
  describe('isSARSellSignal', () => {
    it('トレンド転換時（上昇→下降）にtrue を返す', () => {
      // テスト用のキャンドルデータ
      const candles = generateTestCandles(10);
      
      // モックSAR結果
      const sarResult: ParabolicSARResult = {
        sar: 105, // 価格（100）より上
        isUptrend: false, // 下降中
        accelerationFactor: 0.02,
        extremePoint: 98
      };
      
      // テスト実行
      const result = isSARSellSignal(candles, sarResult);
      
      // 検証
      expect(result).toBe(true);
    });
    
    it('上昇中はfalseを返す', () => {
      // テスト用のキャンドルデータ
      const candles = generateTestCandles(10);
      
      // モックSAR結果
      const sarResult: ParabolicSARResult = {
        sar: 98, // 価格（100）より下
        isUptrend: true, // 上昇中
        accelerationFactor: 0.02,
        extremePoint: 102
      };
      
      // テスト実行
      const result = isSARSellSignal(candles, sarResult);
      
      // 検証
      expect(result).toBe(false);
    });
  });
  
  describe('executeTrendFollowStrategy', () => {
    it('必要なデータが不足している場合は空のシグナルが返される', () => {
      // 必要なデータ量より少ないキャンドル
      const candles = generateTestCandles(5);
      const positions: Position[] = [];
      
      // 戦略実行
      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
        candles,
        'BTCUSDT',
        positions,
        10000
      );
      
      // 検証
      expect(result.signals).toHaveLength(0);
      expect(result.strategy).toBe(StrategyType.TREND_FOLLOWING);
    });
    
    it('上昇トレンドで買いシグナルが生成される', () => {
      // 上昇トレンド環境のキャンドル
      const candles = generateTestCandles(50, 100, 'up');
      const positions: Position[] = [];
      
      // SARモックの戻り値を上昇トレンドに設定
      (calculateParabolicSAR as jest.Mock).mockReturnValue({
        sar: 95, // 価格より下
        isUptrend: true,
        accelerationFactor: 0.02,
        extremePoint: 110
      });
      
      // 戦略実行
      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
        candles,
        'BTCUSDT',
        positions,
        10000
      );
      
      // 検証
      expect(result.signals.length).toBeGreaterThan(0);
      
      // 最低1つのシグナルが存在する場合のみ検証
      if (result.signals.length > 0) {
        const signal = result.signals[0];
        expect(signal.side).toBe(OrderSide.BUY);
        expect(signal.type).toBe(OrderType.MARKET);
      }
    });
    
    it('既存ポジションがある場合は新規シグナルを生成しない', () => {
      // 上昇トレンド環境のキャンドル
      const candles = generateTestCandles(50, 100, 'up');
      
      // 既存のBUYポジション
      const positions: Position[] = [
        {
          symbol: 'BTCUSDT',
          side: OrderSide.BUY,
          amount: 1.0,
          entryPrice: 100,
          currentPrice: 110,
          unrealizedPnl: 10,
          timestamp: Date.now() - 3600000 // 1時間前
        }
      ];
      
      // 戦略実行
      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
        candles,
        'BTCUSDT',
        positions,
        10000
      );
      
      // 検証 - 既存ポジションがあるので新規シグナルはないはず
      expect(result.signals).toHaveLength(0);
    });
  });
});
