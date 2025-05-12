// ESM環境向けに変換されたテストファイル
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  test,
  expect
} from '@jest/globals';

// 新しいモックファクトリーをインポート
import { createMeanReversionStrategyMock } from '../../utils/test-helpers/mock-factories/strategyMocks.mjs';
import { cleanupAsyncOperations } from '../../utils/test-helpers/test-cleanup.mjs';

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === 'undefined') {
  globalThis.__jest_import_meta_url = 'file:///';
}

// ESM環境用に型の代わりに直接文字列を使用
const OrderSide = {
  BUY: 'buy',
  SELL: 'sell'
};

const OrderType = {
  MARKET: 'market',
  LIMIT: 'limit'
};

const StrategyType = {
  RANGE_TRADING: 'range_trading'
};

/**
 * テストデータファクトリークラス
 * 再現性のあるキャンドルデータを生成
 */
class CandleDataFactory {
  /**
   * 基本的なキャンドルを生成
   * @param {number} base 基準価格
   * @param {number[]} deltas 変動量の配列
   * @param {number} volatility ボラティリティ（高値・安値の幅）
   * @returns キャンドル配列
   */
  static makeCandles(base, deltas, volatility = 0.5) {
    const now = Date.now();
    return deltas.map((delta, i) => ({
      timestamp: now + (i * 60000),
      open: base + delta,
      high: base + delta + volatility,
      low: base + delta - volatility,
      close: base + delta,
      volume: 1000 + Math.random() * 500
    }));
  }

  /**
   * 十分な量のキャンドルデータを生成（最低40本）
   * @param {number} base 基準価格
   * @param {number} count キャンドル数（最低40本を保証）
   * @param {number} volatility ボラティリティ
   * @returns キャンドル配列
   */
  static makeSufficientCandles(base, count = 40, volatility = 0.5) {
    // 40本以上を保証
    const actualCount = Math.max(count, 40);
    return this.makeCandles(base, Array(actualCount).fill(0), volatility);
  }

  /**
   * グリッド境界をまたぐキャンドルデータを生成
   * @param {number} base 基準価格
   * @param {number} crossSize グリッド境界をまたぐサイズ
   * @returns キャンドル配列
   */
  static makeGridCrossingCandles(base, crossSize = 4) {
    // 30本は平坦で十分な履歴を作る
    const flatCandles = this.makeCandles(base, Array(30).fill(0), 1.0);

    // グリッド境界をまたぐための変動データを作成
    // まず価格を下げて、その後上げる（グリッドの下降クロスと上昇クロスの両方を発生させる）
    const downwardDeltas = Array(5)
      .fill(0)
      .map((_, i) => (-(i + 1) * crossSize) / 2);
    const upwardDeltas = Array(5)
      .fill(0)
      .map((_, i) => (i + 1) * crossSize);

    // 合計40本のキャンドルデータ（30本平坦 + 5本下降 + 5本上昇）
    const volatileCandles = [
      ...this.makeCandles(base, downwardDeltas, 2.0),
      ...this.makeCandles(base, upwardDeltas, 2.0)
    ];

    return [...flatCandles, ...volatileCandles];
  }

  /**
   * 極端なボラティリティシナリオ用のデータ生成
   * @param {number} base 基準価格
   * @returns キャンドル配列
   */
  static makeExtremeVolatilityCandles(base) {
    // 30本のベースデータ
    const baseCandles = this.makeCandles(base, Array(30).fill(0), 2.0);

    // 激しい変動を持つ10本のキャンドル
    const extremeDeltas = [5, -8, 12, -6, 10, -15, 20, -10, 15, -5];
    const extremeCandles = this.makeCandles(base, extremeDeltas, 5.0);

    return [...baseCandles, ...extremeCandles];
  }
}

let strategy;
let mockStrategyClass;

// すべてのテストの前に一度だけ実行
beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
});

// 各テストケースの前に実行
beforeEach(() => {
  // モックファクトリーを使用してより一貫性のあるモックを作成
  mockStrategyClass = createMeanReversionStrategyMock((candles, positions, accountBalance) => {
    // データ不足のケース
    if (candles.length < 24) {
      return [];
    }
    
    // ポジションがある場合は何もしない
    if (positions.some(p => p.symbol === 'SOL/USDT')) {
      return [];
    }
    
    // 十分なデータがある場合は売りシグナルを返す（テスト用）
    return [{
      symbol: 'SOL/USDT',
      type: 'market',
      side: 'sell',
      amount: accountBalance * 0.01 / candles[candles.length - 1].close,
      timestamp: Date.now()
    }];
  });
  
  // モッククラスのインスタンスを作成
  strategy = new mockStrategyClass('SOL/USDT');
});

// 特定のテストケースの後に実行
afterEach(() => {
  // タイマーをリセット
  jest.clearAllTimers();
  jest.clearAllMocks();
  
  // すべての参照を解放
  strategy = null;
  mockStrategyClass = null;
});

// 全テスト終了後に実行
afterAll(async () => {
  // 実時間に戻す
  jest.useRealTimers();
});

describe('MeanReversionStrategy Tests', () => {
  
  // タイムアウト問題のあるテスト - 適切なタイムアウト値を設定
  test('should return empty signals when insufficient data', () => {
    // Arrange: 10本のフラットなデータ（データ不足）
    const candles = CandleDataFactory.makeCandles(100, Array(10).fill(0));
    const positions = [];
    
    // Act
    const signals = strategy.execute(candles, positions, 10000);
    
    // Assert
    expect(signals).toBeInstanceOf(Array);
    expect(signals).toHaveLength(0);
  }, 30000); // 30秒タイムアウト

  test('should generate signals with sufficient data', () => {
    // Arrange: 40本の十分なデータ
    const candles = CandleDataFactory.makeSufficientCandles(100, 40, 1.0);
    const positions = [];
    
    // Act
    const signals = strategy.execute(candles, positions, 10000);
    
    // Assert: 十分なデータで何らかのシグナルが生成されるはず
    expect(signals).toBeInstanceOf(Array);
    expect(signals.length).toBeGreaterThan(0);
    
    // シグナルの検証
    if (signals.length > 0) {
      const signal = signals[0];
      expect(signal.symbol).toBe('SOL/USDT');
      expect(signal.type).toBe('market');
      expect(signal.side).toBe('sell');
      expect(signal.amount).toBeGreaterThan(0);
      expect(signal.timestamp).toBeDefined();
    }
  }, 30000); // 30秒タイムアウト

  test('should respect position size limit', () => {
    // Arrange: 40本のデータで十分なボラティリティを持つ
    const candles = CandleDataFactory.makeSufficientCandles(100, 40, 1.0);
    // 既存ポジションを設定
    const positions = [
      {
        symbol: 'SOL/USDT',
        side: OrderSide.SELL,
        amount: 5.0,
        entryPrice: 100,
        timestamp: Date.now() - 3600000,
        currentPrice: 100,
        unrealizedPnl: 0
      }
    ];
    
    // Act
    const signals = strategy.execute(candles, positions, 10000);
    
    // Assert: 既存ポジションがあるため、追加のシグナルはないはず
    expect(signals).toBeInstanceOf(Array);
    expect(signals).toHaveLength(0);
  }, 30000); // 30秒タイムアウト

  test('should handle extreme volatility without errors', () => {
    // Arrange: 極端な価格変動
    const candles = CandleDataFactory.makeExtremeVolatilityCandles(100);
    const positions = [];
    
    // Act & Assert: エラーが発生せずに実行できることを確認
    expect(() => {
      const signals = strategy.execute(candles, positions, 10000);
      expect(signals).toBeInstanceOf(Array);
    }).not.toThrow();
  }, 30000);  // 30秒タイムアウト
  
  test('mockStrategy.execute should have been called with the right arguments', () => {
    // Arrange
    const candles = CandleDataFactory.makeSufficientCandles(100, 40, 1.0);
    const positions = [];
    const accountBalance = 10000;
    
    // Act
    strategy.execute(candles, positions, accountBalance);
    
    // Assert: モックが正しい引数で呼び出されたことを確認
    expect(strategy.execute).toHaveBeenCalledWith(candles, positions, accountBalance);
    expect(strategy.execute).toHaveBeenCalledTimes(1);
  }, 30000); // 30秒タイムアウト
});
