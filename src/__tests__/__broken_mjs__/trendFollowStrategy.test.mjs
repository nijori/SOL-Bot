// ESM環境向けに変換されたテストファイル
import { jest, describe, beforeEach, afterEach, test, it, expect } from '@jest/globals';

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === 'undefined') {
  globalThis.__jest_import_meta_url = 'file:///';
}

import { Candle, OrderSide, Position } from '../../core/types.js';
import { executeTrendFollowStrategy } from '../../strategies/trendFollowStrategy.js';
import { calculateParabolicSAR, ParabolicSARResult } from '../../indicators/parabolicSAR.js';
import { calculateATR, getValidStopDistance } from '../../utils/atrUtils.js';

// テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
});

// モック設定
jest.mock('../../indicators/parabolicSAR.js', () => {
  // 実際のcalculateParabolicSAR関数を保持
  const originalModule = jest.requireActual('../../indicators/parabolicSAR.js');

  return {
    ...originalModule,
    // モック版のcalculateParabolicSAR
    calculateParabolicSAR: jest.fn().mockImplementation((candles, step, max, start) => {
      return {
        sar: 1000,
        isUptrend: true,
        accelerationFactor: 0.02,
        extremePoint: 1010
      };
    })
  };
});

jest.mock('../../utils/atrUtils.js', () => {
  return {
    calculateATR: jest.fn().mockReturnValue(10),
    getValidStopDistance: jest.fn().mockReturnValue(10)
  };
});

jest.mock('../../utils/positionSizing.js', () => {
  return {
    calculateRiskBasedPositionSize: jest.fn().mockReturnValue(100) // デフォルトで100を返す
  };
});

// OrderManagementSystemに停止メソッドを追加
const OrderManagementSystem = {
  prototype: {
    stopMonitoring: jest.fn().mockImplementation(function() {
      if (this.fillMonitorTask) {
        if (typeof this.fillMonitorTask.destroy === 'function') {
          this.fillMonitorTask.destroy();
        } else {
          this.fillMonitorTask.stop();
        }
        this.fillMonitorTask = null;
      }
    })
  }
};

// テスト後にインターバルを停止
afterEach(() => {
  // すべてのタイマーモックをクリア
  jest.clearAllTimers();
  
  // インスタンスを明示的に破棄
  // (ここにテスト固有のクリーンアップコードが必要な場合があります)
});

describe('TrendFollowStrategy', () => {
  // モックをリセット
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // テスト用のキャンドルデータを生成
  const generateTestCandles = (count = 100, startPrice = 1000, trend = 'flat') => {
    const candles = [];
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
        volume: 100 + Math.random() * 500
      });
    }

    return candles;
  };

  // private関数をエクスポートしてテスト可能にする
  const isSARBuySignal = jest.fn();
  const isSARSellSignal = jest.fn();

  describe('isSARBuySignal', () => {
    it('トレンド転換時（下降→上昇）にtrue を返す', () => {
      // テスト用のキャンドルデータ
      const candles = generateTestCandles(10);

      // モックSARデータ
      const mockCurrentSAR = {
        sar: 990,
        isUptrend: true,
        accelerationFactor: 0.02,
        extremePoint: 1010
      };

      const mockPreviousSAR = {
        sar: 1010,
        isUptrend: false,
        accelerationFactor: 0.02,
        extremePoint: 990
      };

      // calculateParabolicSARのモックを設定
      calculateParabolicSAR.mockImplementation((inputCandles) => {
        // 完全なキャンドル配列の場合は現在のSAR、それ以外は前回のSAR
        if (inputCandles.length === candles.length) {
          return mockCurrentSAR;
        } else {
          return mockPreviousSAR;
        }
      });

      // 関数を実行
      const result = isSARBuySignal(candles, mockCurrentSAR);

      // アサーション
      expect(result).toBe(true);
      expect(calculateParabolicSAR).toHaveBeenCalledTimes(1);
    });

    it('トレンドが継続中（上昇→上昇）の場合はfalseを返す', () => {
      // テスト用のキャンドルデータ
      const candles = generateTestCandles(10);

      // モックSARデータ
      const mockCurrentSAR = {
        sar: 990,
        isUptrend: true,
        accelerationFactor: 0.02,
        extremePoint: 1010
      };

      const mockPreviousSAR = {
        sar: 985,
        isUptrend: true, // 前回も上昇トレンド
        accelerationFactor: 0.02,
        extremePoint: 1005
      };

      // calculateParabolicSARのモックを設定
      calculateParabolicSAR.mockImplementation((inputCandles) => {
        // 完全なキャンドル配列の場合は現在のSAR、それ以外は前回のSAR
        if (inputCandles.length === candles.length) {
          return mockCurrentSAR;
        } else {
          return mockPreviousSAR;
        }
      });

      // 関数を実行
      const result = isSARBuySignal(candles, mockCurrentSAR);

      // アサーション
      expect(result).toBe(false);
      expect(calculateParabolicSAR).toHaveBeenCalledTimes(1);
    });
  });

  describe('isSARSellSignal', () => {
    it('トレンド転換時（上昇→下降）にtrue を返す', () => {
      // テスト用のキャンドルデータ
      const candles = generateTestCandles(10);

      // モックSARデータ
      const mockCurrentSAR = {
        sar: 1010,
        isUptrend: false,
        accelerationFactor: 0.02,
        extremePoint: 990
      };

      const mockPreviousSAR = {
        sar: 990,
        isUptrend: true,
        accelerationFactor: 0.02,
        extremePoint: 1010
      };

      // calculateParabolicSARのモックを設定
      calculateParabolicSAR.mockImplementation((inputCandles) => {
        // 完全なキャンドル配列の場合は現在のSAR、それ以外は前回のSAR
        if (inputCandles.length === candles.length) {
          return mockCurrentSAR;
        } else {
          return mockPreviousSAR;
        }
      });

      // 関数を実行
      const result = isSARSellSignal(candles, mockCurrentSAR);

      // アサーション
      expect(result).toBe(true);
      expect(calculateParabolicSAR).toHaveBeenCalledTimes(1);
    });

    it('トレンドが継続中（下降→下降）の場合はfalseを返す', () => {
      // テスト用のキャンドルデータ
      const candles = generateTestCandles(10);

      // モックSARデータ
      const mockCurrentSAR = {
        sar: 1010,
        isUptrend: false,
        accelerationFactor: 0.02,
        extremePoint: 990
      };

      const mockPreviousSAR = {
        sar: 1015,
        isUptrend: false, // 前回も下降トレンド
        accelerationFactor: 0.02,
        extremePoint: 985
      };

      // calculateParabolicSARのモックを設定
      calculateParabolicSAR.mockImplementation((inputCandles) => {
        // 完全なキャンドル配列の場合は現在のSAR、それ以外は前回のSAR
        if (inputCandles.length === candles.length) {
          return mockCurrentSAR;
        } else {
          return mockPreviousSAR;
        }
      });

      // 関数を実行
      const result = isSARSellSignal(candles, mockCurrentSAR);

      // アサーション
      expect(result).toBe(false);
      expect(calculateParabolicSAR).toHaveBeenCalledTimes(1);
    });
  });

  // executeTrendFollowStrategyのテスト
  describe('executeTrendFollowStrategy', () => {
    beforeEach(() => {
      // モックのリセットと共通設定
      calculateATR.mockReset();
      calculateParabolicSAR.mockReset().mockReturnValue({
        sar: 100,
        isUptrend: true,
        accelerationFactor: 0.02,
        extremePoint: 105
      });
    });

    it('データ不足時は空のシグナルを返す', () => {
      // 少ないキャンドル数でテスト
      const candles = generateTestCandles(5);
      const result = executeTrendFollowStrategy(
        candles,
        'SOLUSDT',
        [],
        10000
      );

      expect(result.signals).toHaveLength(0);
    });

    it('ブレイクアウト + ADX条件でロングエントリーシグナルを生成', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50, 100, 'up');

      // ADX関連の関数をモック
      const calculateDonchian = jest.fn().mockReturnValue({
        upper: 105,
        lower: 95
      });

      const calculateADX = jest.fn().mockReturnValue(30);

      // モック関数を注入
      executeTrendFollowStrategy.__calculateDonchian = calculateDonchian;
      executeTrendFollowStrategy.__calculateADX = calculateADX;

      // 最後のキャンドルを上昇させる
      candles[candles.length - 1].close = 106; // ドンチャン上限突破

      const result = executeTrendFollowStrategy(
        candles,
        'SOLUSDT',
        [],
        10000
      );

      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].side).toBe(OrderSide.BUY);
      expect(result.signals[0].stopPrice).toBeDefined();
    });

    it('ブレイクアウト + ADX条件でショートエントリーシグナルを生成', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50, 100, 'down');

      // ADX関連の関数をモック
      const calculateDonchian = jest.fn().mockReturnValue({
        upper: 105,
        lower: 95
      });

      const calculateADX = jest.fn().mockReturnValue(30);

      // モック関数を注入
      executeTrendFollowStrategy.__calculateDonchian = calculateDonchian;
      executeTrendFollowStrategy.__calculateADX = calculateADX;

      // 最後のキャンドルを下降させる
      candles[candles.length - 1].close = 94; // ドンチャン下限突破

      const result = executeTrendFollowStrategy(
        candles,
        'SOLUSDT',
        [],
        10000
      );

      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].side).toBe(OrderSide.SELL);
      expect(result.signals[0].stopPrice).toBeDefined();
    });

    it('SAR信号によるロングエントリーシグナルを生成', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50);

      // SARシグナルを返すようにモック
      executeTrendFollowStrategy.__isSARBuySignal = jest.fn().mockReturnValue(true);
      executeTrendFollowStrategy.__isSARSellSignal = jest.fn().mockReturnValue(false);

      const result = executeTrendFollowStrategy(
        candles,
        'SOLUSDT',
        [],
        10000
      );

      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].side).toBe(OrderSide.BUY);
    });

    it('SAR信号によるショートエントリーシグナルを生成', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50);

      // SARシグナルを返すようにモック
      executeTrendFollowStrategy.__isSARBuySignal = jest.fn().mockReturnValue(false);
      executeTrendFollowStrategy.__isSARSellSignal = jest.fn().mockReturnValue(true);

      const result = executeTrendFollowStrategy(
        candles,
        'SOLUSDT',
        [],
        10000
      );

      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].side).toBe(OrderSide.SELL);
    });

    it('stopPrice==undefinedの場合に適切にスキップ', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50);

      // ポジションを作成（stopPriceなし）
      const positions = [
        {
          symbol: 'SOLUSDT',
          side: OrderSide.BUY,
          amount: 100,
          entryPrice: 100,
          stopPrice: undefined,
          timestamp: Date.now(),
          currentPrice: 100,
          unrealizedPnl: 0
        }
      ];

      // コンソール警告をスパイ
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = executeTrendFollowStrategy(
        candles,
        'SOLUSDT',
        positions,
        10000
      );

      // stopPriceがundefinedなので警告が出るはず
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('ストップ価格が設定されていません')
      );

      // 既存ポジションがあるのにシグナルはない（stopPriceがundefinedなので）
      expect(result.signals).toHaveLength(0);

      // スパイをリセット
      consoleWarnSpy.mockRestore();
    });

    it('ロングポジションのトレイリングストップを適切に調整', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50, 100, 'up');
      const lastCandle = candles[candles.length - 1];
      lastCandle.close = 110; // 大幅な上昇

      // ポジションを作成（損益分岐点突破済み）
      const positions = [
        {
          symbol: 'SOLUSDT',
          side: OrderSide.BUY,
          amount: 100,
          entryPrice: 100,
          stopPrice: 105, // 5ポイントのリスク
          timestamp: Date.now(),
          currentPrice: 100,
          unrealizedPnl: 0
        }
      ];

      const result = executeTrendFollowStrategy(
        candles,
        'SOLUSDT',
        positions,
        10000
      );

      // 含み益が大きいのでトレイリングストップが更新されるが、決済はされない
      expect(result.signals).toHaveLength(0);
    });

    it('ショートポジションのトレイリングストップを適切に調整', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50, 100, 'down');
      const lastCandle = candles[candles.length - 1];
      lastCandle.close = 90; // 大幅な下落

      // ポジションを作成（損益分岐点突破済み）
      const positions = [
        {
          symbol: 'SOLUSDT',
          side: OrderSide.SELL,
          amount: 100,
          entryPrice: 100,
          stopPrice: 105, // 5ポイントのリスク
          timestamp: Date.now(),
          currentPrice: 100,
          unrealizedPnl: 0
        }
      ];

      const result = executeTrendFollowStrategy(
        candles,
        'SOLUSDT',
        positions,
        10000
      );

      // 含み益が大きいのでトレイリングストップが更新されるが、決済はされない
      expect(result.signals).toHaveLength(0);
    });

    it('ロングポジションがストップロスに到達したら決済シグナルを生成', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50, 100, 'down');
      const lastCandle = candles[candles.length - 1];
      lastCandle.close = 95; // ストップロス価格まで下落

      // ポジションを作成（ストップに近い）
      const positions = [
        {
          symbol: 'SOLUSDT',
          side: OrderSide.SELL,
          amount: 100,
          entryPrice: 100,
          stopPrice: 105, // 現在価格よりも高い
          timestamp: Date.now(),
          currentPrice: 100,
          unrealizedPnl: 0
        }
      ];

      const result = executeTrendFollowStrategy(
        candles,
        'SOLUSDT',
        positions,
        10000
      );

      // 決済シグナルが発生
      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].side).toBe(OrderSide.BUY); // 反対売買で決済
      expect(result.signals[0].amount).toBe(100); // 全量決済
    });

    it('ショートポジションがストップロスに到達したら決済シグナルを生成', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50, 100, 'up');
      const lastCandle = candles[candles.length - 1];
      lastCandle.close = 105; // ストップロス価格まで上昇

      // ポジションを作成（ストップに近い）
      const positions = [
        {
          symbol: 'SOLUSDT',
          side: OrderSide.BUY,
          amount: 100,
          entryPrice: 100,
          stopPrice: 105, // 現在価格よりも低い
          timestamp: Date.now(),
          currentPrice: 100,
          unrealizedPnl: 0
        }
      ];

      const result = executeTrendFollowStrategy(
        candles,
        'SOLUSDT',
        positions,
        10000
      );

      // 決済シグナルが発生
      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].side).toBe(OrderSide.SELL); // 反対売買で決済
      expect(result.signals[0].amount).toBe(100); // 全量決済
    });
  });
});

// 非同期処理をクリーンアップするためのafterAll
afterAll(() => {
  // すべてのモックをリセット
  jest.clearAllMocks();
  
  // タイマーをリセット
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // グローバルタイマーをクリア
  if (global.setInterval && global.setInterval.mockClear) {
    global.setInterval.mockClear();
  }
  
  if (global.clearInterval && global.clearInterval.mockClear) {
    global.clearInterval.mockClear();
  }
  
  // 確実にすべてのプロミスが解決されるのを待つ
  return new Promise(resolve => {
    setTimeout(() => {
      // 残りの非同期処理を強制終了
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, 100);
  });
});
