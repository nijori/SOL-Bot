// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

// core/typesの明示的なインポートを追加
const { Types, OrderType, OrderSide, OrderStatus } = require('../../core/types');

// モック設定を最上部に移動
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
      calculate: jest.fn((input) => {
        if (input && Array.isArray(input.values)) {
          return [Math.max(...input.values)];
        }
        return [0];
      })
    },
    Lowest: {
      calculate: jest.fn((input) => {
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
jest.mock('../../indicators/parabolicSAR', () => {
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

jest.mock('../../utils/atrUtils', () => {
  return {
    calculateATR: jest.fn().mockReturnValue(3.0),
    getValidStopDistance: jest.fn().mockReturnValue(4.5)
  };
});

jest.mock('../../utils/positionSizing', () => {
  return {
    calculateRiskBasedPositionSize: jest.fn().mockReturnValue(100) // デフォルトで100を返す
  };
});

jest.mock('../../config/parameterService', () => {
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
        return mockParams[key] ?? defaultValue;
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
          return mockParams[key] ?? defaultValue;
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

// 型定義の代わりにモジュールを直接参照
const trendFollowStrategyModule = require('../../strategies/trendFollowStrategy');
const parabolicSARModule = require('../../indicators/parabolicSAR');
const atrUtilsModule = require('../../utils/atrUtils');

// テスト用ヘルパー関数
const generateTestCandles = (
  count,
  startPrice = 100,
  trend = 'flat'
) => {
  const candles = [];
  let currentPrice = startPrice;
  const trendFactor = trend === 'up' ? 1 : trend === 'down' ? -1 : 0;
  
  for (let i = 0; i < count; i++) {
    const baseTime = new Date('2023-01-01T00:00:00Z').getTime();
    const time = baseTime + i * 60000; // 1分ごと
    
    // トレンドに基づいて価格を調整
    currentPrice += trendFactor * (0.5 + Math.random() * 0.5);
    const deviation = trend === 'flat' ? (Math.random() - 0.5) * 2 : 0;
    
    const open = currentPrice;
    const close = currentPrice + deviation;
    const high = Math.max(open, close) + Math.random() * 0.5;
    const low = Math.min(open, close) - Math.random() * 0.5;
    const volume = 1000 + Math.random() * 1000;
    
    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume
    });
  }
  
  return candles;
};

describe('trendFollowStrategy', () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    jest.clearAllMocks();
  });
  
  describe('analyzeMarket', () => {
    it('正しくマーケット状態を分析する', () => {
      // テスト用のキャンドルデータを生成
      const candles = generateTestCandles(30, 100, 'up');
      
      // analyzeMarket関数を実行
      const result = trendFollowStrategyModule.analyzeMarket('BTCUSDT', candles);
      
      // 結果の構造を検証
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.adx).toBeDefined();
      expect(result.donchianHigh).toBeDefined();
      expect(result.donchianLow).toBeDefined();
      expect(result.parabolicSAR).toBeDefined();
      expect(result.atr).toBeDefined();
    });
    
    it('ADXモジュールが適切に呼び出される', () => {
      const candles = generateTestCandles(30);
      trendFollowStrategyModule.analyzeMarket('BTCUSDT', candles);
      
      // technicalindicatorsのADX.calculateが呼ばれたか確認
      const technicalIndicators = require('technicalindicators');
      expect(technicalIndicators.ADX.calculate).toHaveBeenCalled();
    });
    
    it('パラボリックSARが適切に計算される', () => {
      const candles = generateTestCandles(30);
      trendFollowStrategyModule.analyzeMarket('BTCUSDT', candles);
      
      // calculateParabolicSARが呼ばれたか確認
      expect(parabolicSARModule.calculateParabolicSAR).toHaveBeenCalledWith(candles);
    });
    
    it('ATR値が適切に計算される', () => {
      const candles = generateTestCandles(30);
      trendFollowStrategyModule.analyzeMarket('BTCUSDT', candles);
      
      // calculateATRが呼ばれたか確認
      expect(atrUtilsModule.calculateATR).toHaveBeenCalled();
    });
  });
  
  describe('getEntrySignal', () => {
    it('上昇トレンドで買いシグナルを返す', () => {
      // 上昇トレンドのテストデータ
      const candles = generateTestCandles(30, 100, 'up');
      const marketState = trendFollowStrategyModule.analyzeMarket('BTCUSDT', candles);
      
      // フォローすべき強い上昇トレンドの状況を作成
      const technicalIndicators = require('technicalindicators');
      technicalIndicators.ADX.calculate.mockReturnValueOnce([{ adx: 35, plusDI: 30, minusDI: 10 }]);
      
      // パラボリックSARを上昇トレンドに設定
      parabolicSARModule.calculateParabolicSAR.mockReturnValueOnce({
        sar: 95, // 価格より下にSAR値があるため上昇トレンド
        isUptrend: true,
        accelerationFactor: 0.02,
        extremePoint: 105
      });
      
      // 高値/安値を設定してブレイクアウト条件を満たす
      technicalIndicators.Highest.calculate.mockReturnValueOnce([110]);
      const lastCandle = candles[candles.length - 1];
      lastCandle.close = 111; // 高値をブレイク
      
      // シグナルを取得
      const { signal, entryPrice, stopLoss } = trendFollowStrategyModule.getEntrySignal(
        'BTCUSDT', 
        candles,
        marketState,
        null // 現在のポジションなし
      );
      
      // 買いシグナルが返されることを確認
      expect(signal).toBe(OrderSide.BUY);
      expect(entryPrice).toBeGreaterThan(0);
      expect(stopLoss).toBeLessThan(entryPrice);
    });
    
    it('下降トレンドで売りシグナルを返す', () => {
      // 下降トレンドのテストデータ
      const candles = generateTestCandles(30, 100, 'down');
      const marketState = trendFollowStrategyModule.analyzeMarket('BTCUSDT', candles);
      
      // フォローすべき強い下降トレンドの状況を作成
      const technicalIndicators = require('technicalindicators');
      technicalIndicators.ADX.calculate.mockReturnValueOnce([{ adx: 35, plusDI: 10, minusDI: 30 }]);
      
      // パラボリックSARを下降トレンドに設定
      parabolicSARModule.calculateParabolicSAR.mockReturnValueOnce({
        sar: 105, // 価格より上にSAR値があるため下降トレンド
        isUptrend: false,
        accelerationFactor: 0.02,
        extremePoint: 95
      });
      
      // 安値を設定してブレイクアウト条件を満たす
      technicalIndicators.Lowest.calculate.mockReturnValueOnce([90]);
      const lastCandle = candles[candles.length - 1];
      lastCandle.close = 89; // 安値をブレイク
      
      // シグナルを取得
      const { signal, entryPrice, stopLoss } = trendFollowStrategyModule.getEntrySignal(
        'BTCUSDT', 
        candles,
        marketState,
        null // 現在のポジションなし
      );
      
      // 売りシグナルが返されることを確認
      expect(signal).toBe(OrderSide.SELL);
      expect(entryPrice).toBeGreaterThan(0);
      expect(stopLoss).toBeGreaterThan(entryPrice);
    });
    
    it('トレンドが弱い場合はシグナルなし', () => {
      // 弱いトレンドのテストデータ
      const candles = generateTestCandles(30, 100, 'flat');
      const marketState = trendFollowStrategyModule.analyzeMarket('BTCUSDT', candles);
      
      // 弱いトレンドのADX値を設定
      const technicalIndicators = require('technicalindicators');
      technicalIndicators.ADX.calculate.mockReturnValueOnce([{ adx: 15, plusDI: 18, minusDI: 16 }]);
      
      // シグナルを取得
      const { signal } = trendFollowStrategyModule.getEntrySignal(
        'BTCUSDT', 
        candles,
        marketState,
        null // 現在のポジションなし
      );
      
      // シグナルなしを確認
      expect(signal).toBeNull();
    });
  });
  
  describe('getExitSignal', () => {
    it('利益確定条件でのポジションクローズ', () => {
      // テストデータ
      const candles = generateTestCandles(30, 100, 'up');
      const lastPrice = candles[candles.length - 1].close;
      
      // 保有中のポジション（利益が出ている状態）
      const position = {
        symbol: 'BTCUSDT',
        side: OrderSide.BUY,
        entryPrice: 90, // 現在価格より低いエントリー価格で利益あり
        stopLoss: 85,
        quantity: 1,
        unrealizedPnl: lastPrice - 90, // 利益計算
        status: 'OPEN'
      };
      
      // パラボリックSARがクロスして売りシグナルを出す状況
      parabolicSARModule.calculateParabolicSAR.mockReturnValueOnce({
        sar: 105, // 価格より上にSAR値がある
        isUptrend: false, // 下降トレンドに転換
        accelerationFactor: 0.02,
        extremePoint: 95
      });
      
      // マーケット状態を分析
      const marketState = trendFollowStrategyModule.analyzeMarket('BTCUSDT', candles);
      
      // EXIT判断を取得
      const result = trendFollowStrategyModule.getExitSignal(
        'BTCUSDT',
        candles,
        position,
        marketState
      );
      
      // ポジションクローズが推奨されることを確認
      expect(result.shouldExit).toBe(true);
      expect(result.reason).toBeDefined();
    });
    
    it('損切りラインに達した場合のポジションクローズ', () => {
      // テストデータ（下降トレンド）
      const candles = generateTestCandles(30, 100, 'down');
      const lastPrice = candles[candles.length - 1].close;
      
      // 保有中のポジション（損失が出ている状態）
      const position = {
        symbol: 'BTCUSDT',
        side: OrderSide.BUY,
        entryPrice: 105, // 現在価格より高いエントリー価格で損失あり
        stopLoss: lastPrice + 1, // 現在価格より少し上のストップロス（もうすぐ発動）
        quantity: 1,
        unrealizedPnl: lastPrice - 105, // 損失計算
        status: 'OPEN'
      };
      
      // 最新のローソク足の価格を損切りライン以下に設定
      candles[candles.length - 1].close = position.stopLoss - 2;
      
      // マーケット状態を分析
      const marketState = trendFollowStrategyModule.analyzeMarket('BTCUSDT', candles);
      
      // EXIT判断を取得
      const result = trendFollowStrategyModule.getExitSignal(
        'BTCUSDT',
        candles,
        position,
        marketState
      );
      
      // 損切りによるポジションクローズが推奨されることを確認
      expect(result.shouldExit).toBe(true);
      expect(result.reason).toContain('Stop loss');
    });
  });
  
  describe('calculatePositionSize', () => {
    it('リスクに基づいたポジションサイズを計算する', () => {
      const symbol = 'BTCUSDT';
      const entryPrice = 100;
      const stopLoss = 95;
      const candles = generateTestCandles(30);
      
      // ポジションサイズ計算
      const size = trendFollowStrategyModule.calculatePositionSize(
        symbol,
        entryPrice,
        stopLoss,
        candles
      );
      
      // モック関数が呼ばれたことを確認
      const positionSizing = require('../../utils/positionSizing');
      expect(positionSizing.calculateRiskBasedPositionSize).toHaveBeenCalled();
      
      // 結果が正の値であることを確認
      expect(size).toBeGreaterThan(0);
    });
  });
}); 