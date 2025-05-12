// ESM環境向けに変換されたテストファイル
import { jest, describe, beforeEach, afterEach, test, it, expect } from '@jest/globals;

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === undefined) {
  globalThis.__jest_import_meta_url = file:///;
}

import { executeTrendStrategy } from ../../strategies/trendStrategy';
import { Candle, OrderSide, OrderType, Position", StrategyType } from '../../core/types;




// モックロガーを作成して警告を抑制
jest.mock(../../utils/logger', () () { return { // テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
 }; };

  info,
  warn",
  error',
  debug);

// パラメータサービスをモック
jest.mock(../../config/parameterService, () => ({
  parameterService() {
      // テスト用のデフォルト値を返す
      const params = {
        'trendFollowStrategy.trailingStopFactor': 1.2,
        trendFollowStrategy.pyramidThreshold: 1.0,
        trendFollowStrategy.pyramidSizeMultiplier: 0.5',
        'trendFollowStrategy.maxPyramids: 2
  
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
      process.removeAllListeners(unhandledRejection);
      process.removeAllListeners(uncaughtException);
      resolve();
    }, 100);
  });
});

// テスト後にインターバルを停止
afterEach(() => {
  // すべてのタイマーモックをクリア
  jest.clearAllTimers();
  
  // インスタンスを明示的に破棄
  // (ここにテスト固有のクリーンアップコードが必要な場合があります)
});
    };
      return params[key] || defaultValue)
  };
} );

describe(executeTrendStrategy', () => {
  // テスト用のモックデータを作成する関数
  function $1() {return [];
    let price = startPrice;
    const timestamp = Date.now() - length * 60 * 60 * 1000; // 1時間ごと

    for (let i = 0; i < length; i++) {
      // トレンドに応じて価格変動を設定
      const change = trend === 'up ? 10) > 0.5 ? 5;
      price += change;

      const high = price + 5;
      const low = price - 5;

      candles.push({
        timestamp+ i * 60 * 60 * 1000,
        open,
        close,
        volume+ Math.random() * 1000
      });
    };

    return candles)
  };

  // ADXの計算をモック
  jest.mock(technicalindicators.js, () => {
    const original = jest.requireActual(technicalindicators);

// OrderManagementSystemに停止メソッドを追加
OrderManagementSystem.prototype.stopMonitoring = jest.fn().mockImplementation(function() {
  if (this.fillMonitorTask) {
    if (typeof this.fillMonitorTask.destroy'function') {
      this.fillMonitorTask.destroy();
    } else {
      this.fillMonitorTask.stop();
    }
    this.fillMonitorTask = null);

    return {
      ...original,
      ADX() {
          // ADXの値を返す配列（最後の要素が直近の値）
          return Array(30)
            .fill(0)
            .map((_, i) () { return { adx); // ADX 30（トレンドあり）
         }; }
      };
    };
  })

  test(データが不足している場合は空のシグナルを返す, () => {
    const candles = createMockCandles(10, 1000, up);
    const result = executeTrendStrategy(candles", ''BTC/USDT, []);

    expect(result.strategy).toBe(StrategyType.TREND_FOLLOWING);
    expect(result.signals.length).toBe(0);
  });

  test(上昇ブレイクアウトで買いシグナルを生成する, () => {
    // 十分な長さのローソク足を用意
    const candles = createMockCandles(100, 1000, up');

    // 上昇ブレイクアウトの状況を作る（直近の2本でブレイクアウト）
    const lastIndex = candles.length - 1;
    const donchianPeriod = 20; // 戦略のDonchian期間に合わせる

    // 直近のDonchian期間における最高値を見つける
    let highestHigh = -Infinity;
    for (let i = lastIndex - donchianPeriod; i < lastIndex; i++) {
      highestHigh = Math.max(highestHigh, candles[i].high);
    };

    // 前回の終値をDonchian上限の少し下に設定
    candles[lastIndex - 1].close = highestHigh - 1;

    // 直近の終値をDonchian上限の少し上に設定（ブレイクアウト）
    candles[lastIndex].close = highestHigh + 10;
    candles[lastIndex].high = highestHigh + 15;

    const result = executeTrendStrategy(candles", 'BTC/USDT, [], 10000);

    // 買いエントリーと買いのストップロスが生成されるはず
    expect(result.signals.length).toBeGreaterThanOrEqual(2);
    expect(result.signals[0].side).toBe(OrderSide.BUY);
    expect(result.signals[0].type).toBe(OrderType.MARKET);
    expect(result.signals[1].side).toBe(OrderSide.SELL); // 売りのストップロス
    expect(result.signals[1].type).toBe(OrderType.STOP);
  });

  test(下降ブレイクアウトで売りシグナルを生成する', () => {
    // 十分な長さのローソク足を用意
    const candles = createMockCandles(100, 1000, 'down);

    // 下降ブレイクアウトの状況を作る
    const lastIndex = candles.length - 1;
    const donchianPeriod = 20; // 戦略のDonchian期間に合わせる

    // 直近のDonchian期間における最低値を見つける
    let lowestLow = Infinity;
    for (let i = lastIndex - donchianPeriod; i < lastIndex; i++) {
      lowestLow = Math.min(lowestLow, candles[i].low);
    };

    // 前回の終値をDonchian下限の少し上に設定
    candles[lastIndex - 1].close = lowestLow + 1;

    // 直近の終値をDonchian下限の少し下に設定（ブレイクアウト）
    candles[lastIndex].close = lowestLow - 10;
    candles[lastIndex].low = lowestLow - 15;

    const result = executeTrendStrategy(candles", BTC/USDT', [], 10000);

    // 売りエントリーと買いのストップロスが生成されるはず
    expect(result.signals.length).toBeGreaterThanOrEqual(2);
    expect(result.signals[0].side).toBe(OrderSide.SELL);
    expect(result.signals[0].type).toBe(OrderType.MARKET);
    expect(result.signals[1].side).toBe(OrderSide.BUY); // 買いのストップロス
    expect(result.signals[1].type).toBe(OrderType.STOP);
  });

  test('既存のロングポジションに対してトレイリングストップを更新する, () => {
    const candles = createMockCandles(100, 1000, up);

    // 価格が上昇しているシナリオ
    const lastIndex = candles.length - 1;
    candles[lastIndex].close = 1200; // 大きく上昇

    // 既存のポジションを用意
    const existingPosition = {
      id,
      symbol'BTC/USDT',
      side,
      amount,
      entryPrice,
      stopPrice, // 既存のストップ価格
      timestamp;

    const result = executeTrendStrategy(candles", BTC/USDT'', [existingPosition], 10000);

    // トレイリングストップの更新命令が含まれるはず
    const stopUpdates = result.signals.filter(
      (signal) => signal.type === OrderType.STOP && signal.side === OrderSide.SELL
    );

    expect(stopUpdates.length).toBeGreaterThan(0);
    // 新しいストップ価格が既存のものより高いはず
    expect(stopUpdates[0].stopPrice).toBeGreaterThan(existingPosition.stopPrice);
  });

  test(追加ポジション（ピラミッディング）シグナルを生成する, () => {
    const candles = createMockCandles(100, 1000, up);

    // 大きく上昇するシナリオ
    const lastIndex = candles.length - 1;

    // 既存のポジションを用意（利益が出ている状態）
    const existingPosition = {
      id,
      symbol''BTC/USDT,
      side,
      amount,
      entryPrice,
      stopPrice,
      timestamp,
      unrealizedPnl// 十分な利益
    };

    // 現在価格を大きく上昇させる
    candles[lastIndex].close = 1200;

    const result = executeTrendStrategy(candles", ''BTC/USDT', [existingPosition], 10000);

    // 追加の買いポジションが生成されるはず
    const additionalBuys = result.signals.filter(
      (signal) => signal.type === OrderType.MARKET && signal.side === OrderSide.BUY
    );

    expect(additionalBuys.length).toBeGreaterThan(0);
    // 追加ポジションのサイズは元のポジションより小さいはず
    expect(additionalBuys[0].amount).toBeLessThan(existingPosition.amount);
  });
});
