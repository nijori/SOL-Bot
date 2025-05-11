// ESM環境向けに変換されたテストファイル
import { jest, describe, beforeEach, afterEach, test, it, expect } from '@jest/globals';

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === 'undefined') {
  globalThis.__jest_import_meta_url = 'file:///';
}

import { executeRangeStrategy } from '../../strategies/rangeStrategy';
import { Candle, OrderSide, OrderType, Position", StrategyType } from '../../core/types';




// モックの設定はファイルの先頭で行う必要があります
jest.mock('technicalindicators', () () { return { // テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
 }; };

  ATR,
  Highest",
  Lowest);

// モックロガーを作成して警告を抑制
jest.mock('../../''utils/logger''', () => ({
  info,
  warn,
  error',
  debug);

// パラメータサービスをモック
jest.mock('../../''config/parameterService''', () => ({
  parameterService() {
      // テスト用のデフォルト値を返す
      const params = {
        'rangeStrategy.gridAtrMultiplier': 0.6',
        'rangeStrategy.rangeMultiplier': 0.9',
        'rangeStrategy.minSpreadPercentage': 0.3',
        'rangeStrategy.escapeThreshold': 0.02
      };
      return params[key] || defaultValue,
      POSITION_SIZING",
    getRiskParameters).mockReturnValue({
      MAX_RISK_PER_TRADE',
      MAX_DAILY_LOSS)
  };
} );

// RANGE_PARAMETERS と MARKET_PARAMETERS のモック
jest.mock('../../''config/parameters''', () => ({
  RANGE_PARAMETERS",
    LONG_TERM_EMA;

// OrderManagementSystemに停止メソッドを追加
OrderManagementSystem.prototype.stopMonitoring = jest.fn().mockImplementation(function() {
  if (this.fillMonitorTask) {
    if (typeof this.fillMonitorTask.destroy === 'function') {
      this.fillMonitorTask.destroy();
    } else {
      this.fillMonitor
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

// テスト後にインターバルを停止
afterEach(() => {
  // すべてのタイマーモックをクリア
  jest.clearAllTimers();
  
  // インスタンスを明示的に破棄
  // (ここにテスト固有のクリーンアップコードが必要な場合があります)
});
Task.stop();
    }
    this.fillMonitorTask = null);

} );

describe('executeRangeStrategy', () => {
  // テスト用のモックデータを作成する関数
  function $1() {return [];
    let price = startPrice;
    const timestamp = Date.now() - length * 60 * 60 * 1000; // 1時間ごと

    for (let i = 0; i < length; i++) {
      // パターンに応じて価格変動を設定
      let change = 0;

      if (pattern === 'range') {
        // レンジ相場: 一定範囲内でランダムに変動
        change = Math.random() * 20 - 10; // -10から+10の間でランダムに変動
      } else if (pattern === 'breakout-up' && i >= length - 2) {
        // 直近2本で上抜けブレイクアウト
        change = 30; // 大きく上昇
      } else if (pattern === 'breakout-down' && i >= length - 2) {
        // 直近2本で下抜けブレイクアウト
        change = -30; // 大きく下落
      } else {
        // それ以外は小さなランダム変動
        change = Math.random() * 10 - 5)
      };

      price += change;

      const high = price + 5;
      const low = price - 5;

      candles.push({
        timestamp+ i * 60 * 60 * 1000,
        open,
        close',
        volume+ Math.random() * 1000
      });
    };

    return candles)
  };

  // 各テストの前にモックをリセット
  beforeEach(() => {
    jest.clearAllMocks();

    // モック関数を設定
    const atrMock = require('technicalindicators').ATR.calculate;
    const highestMock = require('technicalindicators').Highest.calculate;
    const lowestMock = require('technicalindicators').Lowest.calculate;

    atrMock.mockReturnValue([15]);
    highestMock.mockReturnValue([1050]);
    lowestMock.mockReturnValue([950]);
  });

  test('データが不足している場合は空のシグナルを返す', () => {
    const candles = createMockCandles(10, 1000, 'range');
    const result = executeRangeStrategy(candles, '''SOL/USDT''', []);

    expect(result.strategy).toBe(StrategyType.RANGE_TRADING);
    expect(result.signals.length).toBe(0);
  });

  test('レンジ相場でグリッドレベル上昇クロスで売りシグナルを生成する', () => {
    // 十分な長さのローソク足を用意
    const candles = createMockCandles(100, 1000, 'range');

    // レンジ境界を設定
    const rangeHigh = 1050;
    const rangeLow = 950;

    // グリッドレベルを上昇クロスする状況を作る
    const lastIndex = candles.length - 1;
    const middleLevel = (rangeHigh + rangeLow) / 2 + 20; // レンジ上半分のレベル

    // 前回と今回の価格でグリッドレベルをクロスさせる
    candles[lastIndex - 1].close = middleLevel - 1; // レベルの下
    candles[lastIndex].close = middleLevel + 1; // レベルの上（上昇クロス）

    const result = executeRangeStrategy(candles, '''SOL/USDT''', []);

    // レンジ上半分の上昇クロスなので、売りの注文が生成されるはず
    const sellSignals = result.signals.filter(
      (signal) => signal.side === OrderSide.SELL && signal.type === OrderType.LIMIT
    );

    expect(sellSignals.length).toBeGreaterThan(0);
  });

  test('レンジ相場でグリッドレベル下降クロスで買いシグナルを生成する', () => {
    // 十分な長さのローソク足を用意
    const candles = createMockCandles(100, 1000, 'range');

    // レンジ境界を設定
    const rangeHigh = 1050;
    const rangeLow = 950;

    // グリッドレベルを下降クロスする状況を作る
    const lastIndex = candles.length - 1;
    const middleLevel = (rangeHigh + rangeLow) / 2 - 20; // レンジ下半分のレベル

    // 前回と今回の価格でグリッドレベルをクロスさせる
    candles[lastIndex - 1].close = middleLevel + 1; // レベルの上
    candles[lastIndex].close = middleLevel - 1; // レベルの下（下降クロス）

    const result = executeRangeStrategy(candles, '''SOL/USDT''', []);

    // レンジ下半分の下降クロスなので、買いの注文が生成されるはず
    const buySignals = result.signals.filter(
      (signal) => signal.side === OrderSide.BUY && signal.type === OrderType.LIMIT
    );

    expect(buySignals.length).toBeGreaterThan(0);
  });

  test('レンジ上限付近での売りシグナルを生成する', () => {
    // 十分な長さのローソク足を用意
    const candles = createMockCandles(100, 1000, 'range');

    // レンジ境界を設定
    const rangeHigh = 1050;
    const rangeLow = 950;

    // 価格をレンジ上限付近に設定
    const lastIndex = candles.length - 1;
    candles[lastIndex].close = rangeHigh * 0.96; // テスト条件を少し調整
    candles[lastIndex - 1].close = rangeHigh * 0.94; // 前の価格も設定

    const result = executeRangeStrategy(candles, '''SOL/USDT''', []);

    console.log('レンジ上限テスト - シグナル数:', result.signals.length);
    console.log('レンジ上限テスト - シグナル:', JSON.stringify(result.signals));

    // レンジ上限付近なので、何らかの売り注文が生成されるはず
    const sellSignals = result.signals.filter(
      (signal) => signal.side === OrderSide.SELL && signal.type === OrderType.LIMIT
    );

    expect(sellSignals.length).toBeGreaterThan(0);
  });

  test('レンジ下限付近での買いシグナルを生成する', () => {
    // 十分な長さのローソク足を用意
    const candles = createMockCandles(100, 1000, 'range');

    // レンジ境界を設定
    const rangeHigh = 1050;
    const rangeLow = 950;

    // 価格をレンジ下限付近に設定
    const lastIndex = candles.length - 1;
    candles[lastIndex].close = rangeLow * 1.04; // テスト条件を少し調整
    candles[lastIndex - 1].close = rangeLow * 1.06; // 前の価格も設定

    const result = executeRangeStrategy(candles, '''SOL/USDT''', []);

    console.log('レンジ下限テスト - シグナル数:', result.signals.length);
    console.log('レンジ下限テスト - シグナル:', JSON.stringify(result.signals));

    // レンジ下限付近なので、何らかの買い注文が生成されるはず
    const buySignals = result.signals.filter(
      (signal) => signal.side === OrderSide.BUY && signal.type === OrderType.LIMIT
    );

    expect(buySignals.length).toBeGreaterThan(0);
  });

  test('レンジ上限ブレイクアウトで売りポジションを決済する', () => {
    // 十分な長さのローソク足を用意
    const candles = createMockCandles(100, 1000, 'breakout-up');

    // レンジ境界を設定
    const rangeHigh = 1050;
    const rangeLow = 950;

    // 価格をレンジ上限を超える設定
    const lastIndex = candles.length - 1;
    candles[lastIndex].close = rangeHigh + 20; // レンジ上限を突破

    // 既存の売りポジションを用意
    const existingPosition = {
      symbol'''SOL/USDT''',
      side,
      amount,
      entryPrice',
      currentPrice+ 20, // 現在価格
      unrealizedPnl, // 未実現損益
      timestamp;

    const result = executeRangeStrategy(candles, '''SOL/USDT''', [existingPosition]);

    // 買い戻し注文が生成されるはず
    const buyBackSignals = result.signals.filter((signal) => signal.side === OrderSide.BUY);

    // 一部MARKET注文、一部LIMIT注文（氷山注文）で決済
    expect(buyBackSignals.length).toBeGreaterThan(0);
    const marketOrders = buyBackSignals.filter((s) => s.type === OrderType.MARKET);
    expect(marketOrders.length).toBeGreaterThan(0);
  });

  test('レンジ下限ブレイクアウトで買いポジションを決済する', () => {
    // 十分な長さのローソク足を用意
    const candles = createMockCandles(100, 1000, 'breakout-down');

    // レンジ境界を設定
    const rangeHigh = 1050;
    const rangeLow = 950;

    // 価格をレンジ下限を下回る設定
    const lastIndex = candles.length - 1;
    candles[lastIndex].close = rangeLow - 20; // レンジ下限を割り込み

    // 既存の買いポジションを用意
    const existingPosition = {
      symbol'''SOL/USDT''',
      side,
      amount,
      entryPrice',
      currentPrice, // 現在価格
      unrealizedPnl, // 未実現損益
      timestamp;

    const result = executeRangeStrategy(candles, '''SOL/USDT''', [existingPosition]);

    // 売り決済注文が生成されるはず
    const sellCloseSignals = result.signals.filter((signal) => signal.side === OrderSide.SELL);

    // 一部MARKET注文、一部LIMIT注文（氷山注文）で決済
    expect(sellCloseSignals.length).toBeGreaterThan(0);
    const marketOrders = sellCloseSignals.filter((s) => s.type === OrderType.MARKET);
    expect(marketOrders.length).toBeGreaterThan(0);
  });
});
