import { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

import { Candle, OrderSide, Position } from '../../core/types';
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

// モック設定
jest.mock('../../indicators/parabolicSAR.js', () => {
  // 実際のcalculateParabolicSAR関数を保持
  const originalModule = jest.requireActual('../../indicators/parabolicSAR');

  return {
    ...originalModule,
    // モック版のcalculateParabolicSAR
    calculateParabolicSAR: jest.fn()
  };
});

jest.mock('../../utils/atrUtils.js', () => {
  return {
    calculateATR: jest.fn(),
    getValidStopDistance: jest.fn()
  };
});

jest.mock('../../utils/positionSizing.js', () => {
  return {
    calculateRiskBasedPositionSize: jest.fn().mockReturnValue(100) // デフォルトで100を返す
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

      // モックSARデータ
      const mockCurrentSAR: ParabolicSARResult = {
        sar: 99.5,
        isUptrend: true,
        accelerationFactor: 0.02,
        extremePoint: 102
      };

      const mockPreviousSAR: ParabolicSARResult = {
        sar: 101.5,
        isUptrend: false,
        accelerationFactor: 0.02,
        extremePoint: 98
      };

      // calculateParabolicSARのモックを設定
      (calculateParabolicSAR as jest.Mock).mockImplementation((inputCandles: Candle[]) => {
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
      const mockCurrentSAR: ParabolicSARResult = {
        sar: 99.5,
        isUptrend: true,
        accelerationFactor: 0.02,
        extremePoint: 102
      };

      const mockPreviousSAR: ParabolicSARResult = {
        sar: 99.0,
        isUptrend: true, // 前回も上昇トレンド
        accelerationFactor: 0.02,
        extremePoint: 101
      };

      // calculateParabolicSARのモックを設定
      (calculateParabolicSAR as jest.Mock).mockImplementation((inputCandles: Candle[]) => {
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
      const mockCurrentSAR: ParabolicSARResult = {
        sar: 101.5,
        isUptrend: false,
        accelerationFactor: 0.02,
        extremePoint: 98
      };

      const mockPreviousSAR: ParabolicSARResult = {
        sar: 99.0,
        isUptrend: true,
        accelerationFactor: 0.02,
        extremePoint: 102
      };

      // calculateParabolicSARのモックを設定
      (calculateParabolicSAR as jest.Mock).mockImplementation((inputCandles: Candle[]) => {
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
      const mockCurrentSAR: ParabolicSARResult = {
        sar: 101.5,
        isUptrend: false,
        accelerationFactor: 0.02,
        extremePoint: 98
      };

      const mockPreviousSAR: ParabolicSARResult = {
        sar: 102.0,
        isUptrend: false, // 前回も下降トレンド
        accelerationFactor: 0.02,
        extremePoint: 98.5
      };

      // calculateParabolicSARのモックを設定
      (calculateParabolicSAR as jest.Mock).mockImplementation((inputCandles: Candle[]) => {
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
      (calculateATR as jest.Mock).mockReturnValue(2.0);
      (calculateParabolicSAR as jest.Mock).mockReturnValue({
        sar: 99.0,
        isUptrend: true,
        accelerationFactor: 0.02,
        extremePoint: 102
      });
    });

    it('データ不足時は空のシグナルを返す', () => {
      // 少ないキャンドル数でテスト
      const candles = generateTestCandles(5);
      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
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
      jest.spyOn(trendFollowStrategyModule as any, 'calculateDonchian').mockReturnValue({
        upper: 105,
        lower: 95
      });

      jest.spyOn(trendFollowStrategyModule as any, 'calculateADX').mockReturnValue(30);

      // 最後のキャンドルを上昇させる
      candles[candles.length - 1].close = 106; // ドンチャン上限突破

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
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
      jest.spyOn(trendFollowStrategyModule as any, 'calculateDonchian').mockReturnValue({
        upper: 105,
        lower: 95
      });

      jest.spyOn(trendFollowStrategyModule as any, 'calculateADX').mockReturnValue(30);

      // 最後のキャンドルを下降させる
      candles[candles.length - 1].close = 94; // ドンチャン下限突破

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
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
      jest.spyOn(trendFollowStrategyModule, 'isSARBuySignal').mockReturnValue(true);
      jest.spyOn(trendFollowStrategyModule, 'isSARSellSignal').mockReturnValue(false);

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
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
      jest.spyOn(trendFollowStrategyModule, 'isSARBuySignal').mockReturnValue(false);
      jest.spyOn(trendFollowStrategyModule, 'isSARSellSignal').mockReturnValue(true);

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
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
      const positions: Position[] = [
        {
          symbol: 'SOLUSDT',
          side: OrderSide.BUY,
          amount: 100,
          entryPrice: 100,
          stopPrice: undefined,
          timestamp: Date.now() - 3600000,
          currentPrice: 100,
          unrealizedPnl: 0
        }
      ];

      // コンソール警告をスパイ
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
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
      const positions: Position[] = [
        {
          symbol: 'SOLUSDT',
          side: OrderSide.BUY,
          amount: 100,
          entryPrice: 100,
          stopPrice: 95, // 5ポイントのリスク
          timestamp: Date.now() - 3600000,
          currentPrice: 110,
          unrealizedPnl: 1000 // (110 - 100) * 100
        }
      ];

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
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
      const positions: Position[] = [
        {
          symbol: 'SOLUSDT',
          side: OrderSide.SELL,
          amount: 100,
          entryPrice: 100,
          stopPrice: 105, // 5ポイントのリスク
          timestamp: Date.now() - 3600000,
          currentPrice: 90,
          unrealizedPnl: 1000 // (100 - 90) * 100
        }
      ];

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
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
      const positions: Position[] = [
        {
          symbol: 'SOLUSDT',
          side: OrderSide.BUY,
          amount: 100,
          entryPrice: 100,
          stopPrice: 96, // 現在価格よりも高い
          timestamp: Date.now() - 3600000,
          currentPrice: 95,
          unrealizedPnl: -500 // (95 - 100) * 100
        }
      ];

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
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

    it('ショートポジションがストップロスに到達したら決済シグナルを生成', () => {
      // 十分なキャンドル数
      const candles = generateTestCandles(50, 100, 'up');
      const lastCandle = candles[candles.length - 1];
      lastCandle.close = 105; // ストップロス価格まで上昇

      // ポジションを作成（ストップに近い）
      const positions: Position[] = [
        {
          symbol: 'SOLUSDT',
          side: OrderSide.SELL,
          amount: 100,
          entryPrice: 100,
          stopPrice: 104, // 現在価格よりも低い
          timestamp: Date.now() - 3600000,
          currentPrice: 105,
          unrealizedPnl: -500 // (100 - 105) * 100
        }
      ];

      const result = trendFollowStrategyModule.executeTrendFollowStrategy(
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
  });
});
