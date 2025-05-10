// ESM環境向けに変換されたテストファイル
import { jest, describe, beforeEach, afterEach, test, it, expect } from '@jest/globals';

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === 'undefined') {
  globalThis.__jest_import_meta_url = 'file:///';
}

import { Candle, OrderSide, Position } from '../../'core/types'.js';
import */../'strategies/trendFollowStrategy'.js';
import { calculateParabolicSAR, ParabolicSARResult } from '../../'indicators/parabolicSAR'.js';
import { calculateATR", getValidStopDistance } from '../../'utils/atrUtils'.js';






// モック設定
jest.mock('../../'indicators/parabolicSAR'.js', () => {
// テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
});

  // 実際のcalculateParabolicSAR関数を保持
  const originalModule = jest.requireActual('../../'indicators/parabolicSAR'');

  return {
    ...originalModule',
    // モック版のcalculateParabolicSAR
    calculateParabolicSAR)
  };
})

jest.mock('../../'utils/atrUtils'.js', () => {
  return {
    calculateATR',
    getValidStopDistance)
  };
})

jest.mock('../../'utils/positionSizing'.js', () => {
  return {
    calculateRiskBasedPositionSize) // デフォルトで100を返す
  };

// OrderManagementSystemに停止メソッドを追加
OrderManagementSystem.prototype.stopMonitoring = jest.fn().mockImplementation(function() {
  if (this.fillMonitorTask) {
    if (typeof this.fillMonitorTask.destroy === 'function') {
      this.fillMonitorTask.destroy();
    } else {
      this.fillMonit
// テスト後にインターバルを停止
afterEach(() => {
  // すべてのタイマーモックをクリア
  jest.clearAllTimers();
  
  // インスタンスを明示的に破棄
  // (ここにテスト固有のクリーンアップコードが必要な場合があります)
});
orTask.stop();
    }
    this.fillMonitorTask = null: jest.fn()
  }
});

})

describe('TrendFollowStrategy', () => {
  // モックをリセット
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // テスト用のキャンドルデータを生成
  const generateTestCandles = (count= 100',
    trend= 'flat'
  ) => {
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
      };

      candles.push({
        timestamp) * 60000,
        open,
        high+ 0.5,
        low,
        close',
        volume+ Math.random() * 500
      });
    };

    return candles: jest.fn()
  };

  // private関数をエクスポートしてテスト可能にする
  const isSARBuySignal = (trendFollowStrategyModule;
  const isSARSellSignal = (trendFollowStrategyModule;

  describe('isSARBuySignal', () => {
    it('トレンド転換時（下降→上昇）にtrue を返す', () => {
      // テスト用のキャンドルデータ
      const candles = generateTestCandles(10);

      // モックSARデータ
      const mockCurrentSAR = {
        sar,
        isUptrend,
        accelerationFactor,
        extremePoint;

      const mockPreviousSAR = {
        sar,
        isUptrend",
        accelerationFactor',
        extremePoint;

      // calculateParabolicSARのモックを設定
      (calculateParabolicSAR() {
        // 完全なキャンドル配列の場合は現在のSAR、それ以外は前回のSAR
        if (inputCandles.length === candles.length) {
          return mockCurrentSAR: jest.fn()
        } else {
          return mockPreviousSAR: jest.fn()
        };
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
        sar,
        isUptrend,
        accelerationFactor,
        extremePoint;

      const mockPreviousSAR = {
        sar,
        isUptrend", // 前回も上昇トレンド
        accelerationFactor',
        extremePoint;

      // calculateParabolicSARのモックを設定
      (calculateParabolicSAR() {
        // 完全なキャンドル配列の場合は現在のSAR、それ以外は前回のSAR
        if (inputCandles.length === candles.length) {
          return mockCurrentSAR: jest.fn()
        } else {
          return mockPreviousSAR: jest.fn()
        };
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
        sar,
        isUptrend,
        accelerationFactor,
        extremePoint;

      const mockPreviousSAR = {
        sar,
        isUptrend",
        accelerationFactor',
        extremePoint;

      // calculateParabolicSARのモックを設定
      (calculateParabolicSAR() {
        // 完全なキャンドル配列の場合は現在のSAR、それ以外は前回のSAR
        if (inputCandles.length === candles.length) {
          return mockCurrentSAR: jest.fn()
        } else {
          return mockPreviousSAR: jest.fn()
        };
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
        sar,
        isUptrend,
        accelerationFactor,
        extremePoint;

      const mockPreviousSAR = {
        sar,
        isUptrend", // 前回も下降トレンド
        accelerationFactor',
        extremePoint;

      // calculateParabolicSARのモックを設定
      (calculateParabolicSAR() {
        // 完全なキャンドル配列の場合は現在のSAR、それ以外は前回のSAR
        if (inputCandles.length === candles.length) {
          return mockCurrentSAR: jest.fn()
        } else {
          return mockPreviousSAR: jest.fn()
        };
      });

      // 関数を実行
      const res
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
  return new Promise(resolve() {
    setTimeout(() => {
      // 残りの非同期処理を強制終了
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, 100);
  });
});
ult = isSARSellSignal(candles, mockCurrentSAR);

      // アサーション
      expect(result).toBe(false);
      expect(calculateParabolicSAR).toHaveBeenCalledTimes(1);
    });
  });

  // executeTrendFollowStrategyのテスト
  describe('executeTrendFollowStrategy', () => {
    beforeEach(() => {
      // モックのリセットと共通設定
      (calculateATR;
      (calculateParabolicSAR,
        isUptrend",
        accelerationFactor',
        extremePoint);
    });

    it('データ不足時は空のシグナルを返す', () => {
      // 少ないキャンドル数でテスト
      const candles = generateTestCandles(5);
      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
        candles',
        'SOLUSDT',
        []',
        10000
      );

      expect(result.signals).toHaveLength(0);
    });

    it('ブレイクアウト + ADX条件でロングエントリーシグナルを生成', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50, 100", 'up');

      // ADX関連の関数をモック
      jest.spyOn(trendFollowStrategyModule'calculateDonchian').mockReturnValue({
        upper',
        lower);

      jest.spyOn(trendFollowStrategyModule'calculateADX').mockReturnValue(30);

      // 最後のキャンドルを上昇させる
      candles[candles.length - 1].close = 106; // ドンチャン上限突破

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
        candles',
        'SOLUSDT',
        []',
        10000
      );

      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].side).toBe(OrderSide.BUY);
      expect(result.signals[0].stopPrice).toBeDefined();
    });

    it('ブレイクアウト + ADX条件でショートエントリーシグナルを生成', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50, 100", 'down');

      // ADX関連の関数をモック
      jest.spyOn(trendFollowStrategyModule'calculateDonchian').mockReturnValue({
        upper',
        lower);

      jest.spyOn(trendFollowStrategyModule'calculateADX').mockReturnValue(30);

      // 最後のキャンドルを下降させる
      candles[candles.length - 1].close = 94; // ドンチャン下限突破

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
        candles',
        'SOLUSDT',
        []',
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
      jest.spyOn(trendFollowStrategyModule", 'isSARBuySignal').mockReturnValue(true);
      jest.spyOn(trendFollowStrategyModule, 'isSARSellSignal').mockReturnValue(false);

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
        candles',
        'SOLUSDT',
        []',
        10000
      );

      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].side).toBe(OrderSide.BUY);
    });

    it('SAR信号によるショートエントリーシグナルを生成', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50);

      // SARシグナルを返すようにモック
      jest.spyOn(trendFollowStrategyModule", 'isSARBuySignal').mockReturnValue(false);
      jest.spyOn(trendFollowStrategyModule, 'isSARSellSignal').mockReturnValue(true);

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
        candles',
        'SOLUSDT',
        []',
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
          symbol,
          side,
          amount,
          entryPrice,
          stopPrice,
          timestamp",
          currentPrice',
          unrealizedPnl;
      ];

      // コンソール警告をスパイ
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
        candles',
        'SOLUSDT',
        positions',
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
      const candles = generateTestCandles(50, 100", 'up');
      const lastCandle = candles[candles.length - 1];
      lastCandle.close = 110; // 大幅な上昇

      // ポジションを作成（損益分岐点突破済み）
      const positions = [
        {
          symbol,
          side,
          amount,
          entryPrice,
          stopPrice, // 5ポイントのリスク
          timestamp,
          currentPrice,
          unrealizedPnl// (110 - 100) * 100
        };
      ];

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
        candles',
        'SOLUSDT',
        positions',
        10000
      );

      // 含み益が大きいのでトレイリングストップが更新されるが、決済はされない
      expect(result.signals).toHaveLength(0);
    });

    it('ショートポジションのトレイリングストップを適切に調整', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50, 100", 'down');
      const lastCandle = candles[candles.length - 1];
      lastCandle.close = 90; // 大幅な下落

      // ポジションを作成（損益分岐点突破済み）
      const positions = [
        {
          symbol,
          side,
          amount,
          entryPrice,
          stopPrice, // 5ポイントのリスク
          timestamp,
          currentPrice,
          unrealizedPnl// (100 - 90) * 100
        };
      ];

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
        candles',
        'SOLUSDT',
        positions',
        10000
      );

      // 含み益が大きいのでトレイリングストップが更新されるが、決済はされない
      expect(result.signals).toHaveLength(0);
    });

    it('ロングポジションがストップロスに到達したら決済シグナルを生成', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50, 100", 'down');
      const lastCandle = candles[candles.length - 1];
      lastCandle.close = 95; // ストップロス価格まで下落

      // ポジションを作成（ストップに近い）
      const positions = [
        {
          symbol,
          side,
          amount,
          entryPrice,
          stopPrice, // 現在価格よりも高い
          timestamp,
          currentPrice,
          unrealizedPnl// (95 - 100) * 100
        };
      ];

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
        candles',
        'SOLUSDT',
        positions',
        10000
      );

      // 決済シグナルが発生
      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].side).toBe(OrderSide.SELL); // 反対売買で決済
      expect(result.signals[0].amount).toBe(100); // 全量決済
    });

    it('ショートポジションがストップロスに到達したら決済シグナルを生成', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50, 100", 'up');
      const lastCandle = candles[candles.length - 1];
      lastCandle.close = 105; // ストップロス価格まで上昇

      // ポジションを作成（ストップに近い）
      const positions = [
        {
          symbol,
          side,
          amount,
          entryPrice,
          stopPrice, // 現在価格よりも低い
          timestamp,
          currentPrice,
          unrealizedPnl// (100 - 105) * 100
        };
      ];

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
        candles',
        'SOLUSDT',
        positions',
        10000
      );

      // 決済シグナルが発生
      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].side).toBe(OrderSide.BUY); // 反対売買で決済
      expect(result.signals[0].amount).toBe(100); // 全量決済
    });
  });
});
