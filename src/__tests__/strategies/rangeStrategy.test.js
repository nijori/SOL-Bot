// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

// core/typesの明示的なインポートを修正
const { Types, OrderType, OrderSide, OrderStatus } = require('../../core/types');

const rangeStrategyModule = require('../../strategies/rangeStrategy');
const { executeRangeStrategy } = rangeStrategyModule;
const { StrategyType } = Types;

// リソーストラッカーとテストクリーンアップ関連のインポート
const ResourceTracker = require('../../utils/test-helpers/resource-tracker');
const { 
  standardBeforeEach, 
  standardAfterEach, 
  standardAfterAll 
} = require('../../utils/test-helpers/test-cleanup');

// モックの設定はファイルの先頭で行う必要があります
jest.mock('technicalindicators', () => ({
  ATR: {
    calculate: jest.fn().mockReturnValue([15])
  },
  Highest: {
    calculate: jest.fn().mockReturnValue([1050])
  },
  Lowest: {
    calculate: jest.fn().mockReturnValue([950])
  }
}));

// モックロガーを作成して警告を抑制
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// パラメータサービスをモック
jest.mock('../../config/parameterService', () => ({
  parameterService: {
    get: jest.fn().mockImplementation((key, defaultValue) => {
      // テスト用のデフォルト値を返す
      const params = {
        'rangeStrategy.gridAtrMultiplier': 0.6,
        'rangeStrategy.rangeMultiplier': 0.9,
        'rangeStrategy.minSpreadPercentage': 0.3,
        'rangeStrategy.escapeThreshold': 0.02
      };
      return params[key] || defaultValue;
    }),
    getMarketParameters: jest.fn().mockReturnValue({
      ATR_PERIOD: 14,
      SHORT_TERM_EMA: 10,
      LONG_TERM_EMA: 50
    }),
    getTrendParameters: jest.fn().mockReturnValue({
      DONCHIAN_PERIOD: 20,
      ADX_PERIOD: 14,
      ADX_THRESHOLD: 25
    }),
    getRangeParameters: jest.fn().mockReturnValue({
      RANGE_PERIOD: 30,
      GRID_LEVELS_MIN: 3,
      GRID_LEVELS_MAX: 10,
      POSITION_SIZING: 0.1
    }),
    getRiskParameters: jest.fn().mockReturnValue({
      MAX_RISK_PER_TRADE: 0.01,
      MAX_DAILY_LOSS: 0.05
    })
  }
}));

// RANGE_PARAMETERS と MARKET_PARAMETERS のモック
jest.mock('../../config/parameters', () => ({
  RANGE_PARAMETERS: {
    RANGE_PERIOD: 30,
    GRID_LEVELS_MIN: 3,
    GRID_LEVELS_MAX: 10,
    POSITION_SIZING: 0.1
  },
  MARKET_PARAMETERS: {
    ATR_PERIOD: 14,
    SHORT_TERM_EMA: 10,
    LONG_TERM_EMA: 50
  }
}));

describe('executeRangeStrategy', () => {
  // テスト前に毎回モックをリセットし、リソーストラッカーを準備
  beforeEach(() => {
    jest.clearAllMocks();
    standardBeforeEach();
    
    // グローバルリソーストラッカーの初期化（必要な場合）
    if (!global.__RESOURCE_TRACKER) {
      global.__RESOURCE_TRACKER = new ResourceTracker();
    }

    // モック関数を設定
    const atrMock = require('technicalindicators').ATR.calculate;
    const highestMock = require('technicalindicators').Highest.calculate;
    const lowestMock = require('technicalindicators').Lowest.calculate;

    atrMock.mockReturnValue([15]);
    highestMock.mockReturnValue([1050]);
    lowestMock.mockReturnValue([950]);
  });

  // 各テスト後にリソース解放
  afterEach(async () => {
    await standardAfterEach();
  });

  // すべてのテスト完了後に最終クリーンアップを実行
  afterAll(async () => {
    await standardAfterAll();
  });

  // テスト用のモックデータを作成する関数
  function createMockCandles(
    length,
    startPrice,
    pattern
  ) {
    const candles = [];
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
        change = Math.random() * 10 - 5;
      }

      price += change;

      const high = price + 5;
      const low = price - 5;

      candles.push({
        timestamp: timestamp + i * 60 * 60 * 1000,
        open: price - change,
        high,
        low,
        close: price,
        volume: 1000 + Math.random() * 1000
      });
    }

    return candles;
  }

  test('データが不足している場合は空のシグナルを返す', () => {
    const candles = createMockCandles(10, 1000, 'range');
    const result = executeRangeStrategy(candles, 'SOL/USDT', []);

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

    const result = executeRangeStrategy(candles, 'SOL/USDT', []);

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

    const result = executeRangeStrategy(candles, 'SOL/USDT', []);

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

    const result = executeRangeStrategy(candles, 'SOL/USDT', []);

    console.log('レンジ上限テスト - シグナル数:', result.signals.length);
    console.log('レンジ上限テスト - シグナル:', JSON.stringify(result.signals));

    // 売りシグナルが生成されていることを確認
    const sellSignals = result.signals.filter(signal => signal.side === OrderSide.SELL);
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

    const result = executeRangeStrategy(candles, 'SOL/USDT', []);

    // 買いシグナルが生成されていることを確認
    const buySignals = result.signals.filter(signal => signal.side === OrderSide.BUY);
    expect(buySignals.length).toBeGreaterThan(0);
  });

  test('レンジブレイクアウト時に既存ポジションのクローズシグナルを生成する', () => {
    // 上昇ブレイクアウトのキャンドルを生成
    const candles = createMockCandles(100, 1000, 'breakout-up');
    const lastIndex = candles.length - 1;
    candles[lastIndex].close = 1100; // レンジ上限を大きく超える

    // 既存のポジションを設定
    const positions = [
      {
        id: 'pos1',
        symbol: 'SOL/USDT',
        side: OrderSide.SELL, // 売りポジション
        entryPrice: 1030,
        quantity: 10,
        status: 'OPEN'
      }
    ];

    const result = executeRangeStrategy(candles, 'SOL/USDT', positions);

    // ブレイクアウトによる既存ポジションのクローズシグナルが生成されていることを確認
    const closeSignals = result.signals.filter(
      signal => signal.type === OrderType.MARKET && signal.positionId === 'pos1'
    );
    expect(closeSignals.length).toBeGreaterThan(0);
  });

  test('グリッドレベルが適切に計算されることを確認', () => {
    // モック関数を使って内部実装をテスト
    const candles = createMockCandles(100, 1000, 'range');
    
    // 内部関数へのアクセスを確保
    const generateGridSignals = rangeStrategyModule.generateGridSignals;
    const marketState = {
      rangeHigh: 1050,
      rangeLow: 950,
      currentPrice: 1000,
      previousPrice: 995,
      atr: 15
    };
    
    // テスト対象となる関数が存在する場合のみテスト
    if (typeof generateGridSignals === 'function') {
      const gridSignals = generateGridSignals('SOL/USDT', marketState);
      
      // グリッドレベルの数と間隔を確認
      expect(gridSignals.length).toBeGreaterThan(0);
      
      // 上半分のレベルは売り、下半分のレベルは買いであることを確認
      const midPrice = (marketState.rangeHigh + marketState.rangeLow) / 2;
      const sellSignals = gridSignals.filter(s => s.side === OrderSide.SELL);
      const buySignals = gridSignals.filter(s => s.side === OrderSide.BUY);
      
      expect(sellSignals.every(s => s.price > midPrice)).toBe(true);
      expect(buySignals.every(s => s.price < midPrice)).toBe(true);
    }
  });
}); 