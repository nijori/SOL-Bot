// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

// core/typesの明示的なインポートを修正
const { Types, OrderType, OrderSide, OrderStatus } = require('../../core/types');

const meanRevertStrategyModule = require('../../strategies/meanRevertStrategy');

// リソーストラッカーとテストクリーンアップ関連のインポート
const ResourceTracker = require('../../utils/test-helpers/resource-tracker');
const { 
  standardBeforeEach, 
  standardAfterEach, 
  standardAfterAll 
} = require('../../utils/test-helpers/test-cleanup');

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
jest.mock('../../config/parameters', () => {
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
jest.mock('../../config/parameterService', () => {
  return {
    parameterService: {
      get: jest.fn((_key, defaultValue) => {
        // 戦略のパラメータをモックデータで返す
        const mockParams = {
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
jest.mock('../../indicators/marketState', () => ({
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
    count,
    basePrice,
    volatility = 1.0,
    trend = 'range'
  ) {
    const candles = [];
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
    const positions = [];
    
    // console.errorをモック
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    const result = meanRevertStrategyModule.executeMeanRevertStrategy(candles, 'SOL/USDT', positions);

    // Assert
    expect(result).toBeDefined();
    expect(result.entrySignals).toEqual([]);
    expect(result.exitSignals).toEqual([]);
  });

  // 通常のエントリーシグナルテスト
  test('should generate entry signals based on overbought/oversold conditions', () => {
    // テスト用データを準備
    const candles = CandleFactory.generateCandles(50, 100, 2.0, 'range');
    const positions = [];
    
    // モックを設定して極端な価格でのRSI値を返すようにする
    const technicalIndicators = require('technicalindicators');
    technicalIndicators.RSI.calculate.mockReturnValueOnce([20]); // 買いシグナル（オーバーソールド）
    
    // BollingerBandsをオーバーソールドに設定
    technicalIndicators.BollingerBands.calculate.mockReturnValueOnce([{
      upper: 110,
      middle: 100,
      lower: 95
    }]);
    
    // 最新価格をロワーバンド付近に設定
    candles[candles.length - 1].close = 94;
    
    // Act
    const result = meanRevertStrategyModule.executeMeanRevertStrategy(candles, 'SOL/USDT', positions);
    
    // Assert
    expect(result.entrySignals.length).toBeGreaterThan(0);
    expect(result.entrySignals[0].side).toBe(OrderSide.BUY);
  });
  
  // 保有ポジションの処理
  test('should generate exit signals for existing positions', () => {
    // テスト用データ準備
    const candles = CandleFactory.generateCandles(50, 100, 2.0, 'range');
    
    // 既存ポジション
    const positions = [
      {
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        entryPrice: 95,
        quantity: 10,
        unrealizedPnl: 50, // 利益が出ている
        status: 'OPEN'
      }
    ];
    
    // 反転条件を設定
    const technicalIndicators = require('technicalindicators');
    technicalIndicators.RSI.calculate.mockReturnValueOnce([70]); // 売りシグナル（オーバーボート）
    technicalIndicators.BollingerBands.calculate.mockReturnValueOnce([{
      upper: 105,
      middle: 100,
      lower: 90
    }]);
    
    // 最新価格を上限付近に設定
    candles[candles.length - 1].close = 104;
    
    // Act
    const result = meanRevertStrategyModule.executeMeanRevertStrategy(candles, 'SOL/USDT', positions);
    
    // Assert
    expect(result.exitSignals.length).toBeGreaterThan(0);
    expect(result.exitSignals[0].positionIndex).toBe(0);
  });
}); 