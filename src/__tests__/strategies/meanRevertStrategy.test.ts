import { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

import { executeMeanRevertStrategy } from '../../strategies/meanRevertStrategy';
import { Candle, OrderSide, OrderType, Position, StrategyType } from '../../core/types';

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

// technicalindicatorsモジュールのモック
jest.mock('technicalindicators', () => {
  return {
    ATR: {
      calculate: jest.fn().mockReturnValue([2.0])
    },
    SMA: {
      calculate: jest.fn().mockReturnValue([100])
    },
    BollingerBands: {
      calculate: jest.fn().mockReturnValue([{
        upper: 105,
        middle: 100,
        lower: 95
      }])
    },
    RSI: {
      calculate: jest.fn().mockReturnValue([50])
    },
    Highest: {
      calculate: jest.fn().mockReturnValue([110])
    },
    Lowest: {
      calculate: jest.fn().mockReturnValue([90])
    }
  };
});

// モックの設定
jest.mock('../../utils/atrUtils', () => ({
  calculateATR: jest.fn().mockReturnValue(2.0),
  getValidStopDistance: jest.fn().mockReturnValue(3.0)
}));

jest.mock('../../utils/positionSizing', () => ({
  calculateRiskBasedPositionSize: jest.fn().mockReturnValue(100)
}));

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
      get: jest.fn((_key: string, defaultValue: any) => {
        // 戦略のパラメータをモックデータで返す
        const mockParams: Record<string, any> = {
          'rangeStrategy.rangePeriod': 30,
          'rangeStrategy.rangeMultiplier': 0.9,
          'rangeStrategy.gridAtrMultiplier': 0.6,
          'rangeStrategy.minSpreadPercentage': 0.3,
          'rangeStrategy.escapeThreshold': 0.02,
          'riskManagement.maxPositionSize': 0.35,
          'rangeStrategy.netPositionDeltaMax': 0.15
        };
        return mockParams[_key] || defaultValue;
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
        range: {
          GRID_ATR_MULTIPLIER: 0.5
        }
      })
    }
  };
});

// マーケット状態計算用モック
jest.mock('../../indicators/marketState.js', () => ({
  calculateVWAP: jest.fn().mockReturnValue(100)
}));

// テスト用のより堅牢なモックデータファクトリ
class CandleFactory {
  /**
   * 十分な量のキャンドルデータを生成
   * @param count キャンドル数
   * @param basePrice 基準価格
   * @param volatility ボラティリティ
   * @param trend 価格トレンド方向
   * @returns 生成されたキャンドル配列
   */
  static generateCandles(
    count: number,
    basePrice: number,
    volatility: number = 1.0,
    trend: 'up' | 'down' | 'range' = 'range'
  ): Candle[] {
    const candles: Candle[] = [];
    let price = basePrice;
    const now = Date.now();

    // 最低40本を確保
    const actualCount = Math.max(count, 40);

    for (let i = 0; i < actualCount; i++) {
      // トレンドに基づいて価格を調整
      if (trend === 'up') {
        price += Math.random() * volatility * 0.2;
      } else if (trend === 'down') {
        price -= Math.random() * volatility * 0.2;
      } else {
        price += Math.random() * volatility * 0.4 - volatility * 0.2;
      }

      const high = price + volatility;
      const low = price - volatility;

      candles.push({
        timestamp: now - (actualCount - i) * 60000, // 1分ごとに
        open: price,
        high,
        low,
        close: price,
        volume: Math.random() * 1000 + 500
      });
    }

    return candles;
  }
}

describe('MeanRevertStrategy Tests', () => {
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

  // データ不足時のテスト
  test('should return empty signals when insufficient data', () => {
    // Arrange
    const candles = CandleFactory.generateCandles(10, 100, 1.0, 'range'); // データ不足
    const positions: Position[] = [];
    
    // console.errorをモック
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    const result = executeMeanRevertStrategy(candles, 'SOL/USDT', positions);

    // Assert
    expect(result.strategy).toBe(StrategyType.RANGE_TRADING);
    expect(result.signals).toHaveLength(0);
  });
});
