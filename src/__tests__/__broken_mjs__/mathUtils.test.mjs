// ESM環境向けに変換されたテストファイル
/**
 * 数学ユーティリティ関数のテスト
 * 
 * CORE-005とtradingEngineのマルチシンボル対応拡張
 */

import { jest, describe, beforeEach, afterEach, test, it, expect, beforeAll, afterAll } from '@jest/globals';

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === 'undefined') {
  globalThis.__jest_import_meta_url = 'file:///';
}

import {
 calculatePearsonCorrelation, calculateVariance, calculateStandardDeviation, calculateMean, calculateSum, calculateWeightedReturn, calculateCovarianceMatrix, calculateSharpeRatio, calculateSortinoRatio, calculateDrawdowns } from '../../utils/mathUtils.js';

/**
 * 数学ユーティリティ関数のテスト
 * 
 * CORE-005とtradingEngineのマルチシンボル対応拡張
 */

// テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
});

// テスト後にインターバルを停止
afterEach(() => {
  // すべてのタイマーモックをクリア
  jest.clearAllTimers();
  
  // インスタンスを明示的に破棄
  // (ここにテスト固有のクリーンアップコードが必要な場合があります)
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
  return new Promise((resolve) => {
    setTimeout(() => {
      // 残りの非同期処理を強制終了
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, 100);
  });
});

describe('mathUtils', () => {
  test('ピアソン相関係数が正しく計算される', () => {
    // 完全な正の相関
    const x1 = [1, 2, 3, 4, 5];
    const y1 = [2, 4, 6, 8, 10];
    expect(calculatePearsonCorrelation(x1, y1)).toBeCloseTo(1.0);
    
    // 完全な負の相関
    const x2 = [1, 2, 3, 4, 5];
    const y2 = [10, 8, 6, 4, 2];
    expect(calculatePearsonCorrelation(x2, y2)).toBeCloseTo(-1.0);
    
    // 無相関
    const x3 = [1, 2, 3, 4, 5];
    const y3 = [5, 4, 5, 4, 5];
    expect(calculatePearsonCorrelation(x3, y3)).toBeCloseTo(0, 1);
    
    // 実際のデータに近い例
    const returns1 = [0.01, -0.02, 0.03, -0.01, 0.02];
    const returns2 = [0.015, -0.018, 0.025, -0.012, 0.022];
    expect(calculatePearsonCorrelation(returns1, returns2)).toBeGreaterThan(0.9);
  });
  
  test('配列長さが異なる場合にエラーを投げる', () => {
    const x = [1, 2, 3];
    const y = [4, 5];
    expect(() => calculatePearsonCorrelation(x, y)).toThrow();
  });
  
  test('空の配列の場合は0を返す', () => {
    expect(calculatePearsonCorrelation([], [])).toBe(0);
  });
  
  test('分散と標準偏差が正しく計算される', () => {
    const values = [2, 4, 6, 8, 10];
    
    // 分散: 10
    expect(calculateVariance(values)).toBeCloseTo(10);
    
    // 標準偏差: √10 ≈ 3.16
    expect(calculateStandardDeviation(values)).toBeCloseTo(3.16, 1);
    
    // 空配列の場合は0を返す
    expect(calculateVariance([])).toBe(0);
    expect(calculateStandardDeviation([])).toBe(0);
    
    // 要素が1つだけの場合も0を返す
    expect(calculateVariance([5])).toBe(0);
    expect(calculateStandardDeviation([5])).toBe(0);
  });
  
  test('平均値と合計が正しく計算される', () => {
    const values = [2, 4, 6, 8, 10];
    
    // 合計: 30
    expect(calculateSum(values)).toBe(30);
    
    // 平均: 6
    expect(calculateMean(values)).toBe(6);
    
    // 空配列の場合は0を返す
    expect(calculateSum([])).toBe(0);
    expect(calculateMean([])).toBe(0);
  });
  
  test('加重平均リターンが正しく計算される', () => {
    const returns = [0.05, 0.03, -0.02, 0.04];
    const weights = [0.3, 0.3, 0.2, 0.2];
    
    // 加重平均: 0.05 * 0.3 + 0.03 * 0.3 + (-0.02)*0.2 + 0.04 * 0.2 = 0.029
    expect(calculateWeightedReturn(returns, weights)).toBeCloseTo(0.029);
    
    // 配列長さが異なる場合にエラーを投げる
    expect(() => calculateWeightedReturn(returns, [0.5, 0.5])).toThrow();
  });
  
  test('共分散行列が正しく計算される', () => {
    const returns1 = [0.01, -0.02, 0.03, -0.01, 0.02];
    const returns2 = [0.015, -0.018, 0.025, -0.012, 0.022];
    const returnsSeries = [returns1, returns2];
    
    const covMatrix = calculateCovarianceMatrix(returnsSeries);
    
    // 行列の次元が正しい
    expect(covMatrix.length).toBe(2);
    expect(covMatrix[0].length).toBe(2);
    
    // 対角成分は分散
    expect(covMatrix[0][0]).toBeCloseTo(calculateVariance(returns1));
    expect(covMatrix[1][1]).toBeCloseTo(calculateVariance(returns2));
    
    // 非対角成分は共分散（対称行列）
    expect(covMatrix[0][1]).toBeCloseTo(covMatrix[1][0]);
    
    // 空配列の場合は空の配列を返す
    expect(calculateCovarianceMatrix([])).toEqual([]);
  });
  
  test('シャープレシオとソルティノレシオが正しく計算される', () => {
    // リターン配列
    const returns = [0.01, -0.005, 0.02, -0.01, 0.015, 0.01, -0.002];
    
    // シャープレシオ: 日次リターン
    const sharpeDaily = calculateSharpeRatio(returns, 0, true);
    expect(sharpeDaily).toBeGreaterThan(0);
    
    // シャープレシオ: 既に年率化されたリターン
    const sharpeAnnual = calculateSharpeRatio(returns, 0, false);
    expect(sharpeAnnual).toBeLessThan(sharpeDaily); // 年率化因子の影響で小さくなる
    
    // リスクフリーレートを考慮
    const sharpeWithRf = calculateSharpeRatio(returns, 0.02, true);
    expect(sharpeWithRf).toBeLessThan(sharpeDaily); // リスクフリーレートが引かれるので小さくなる
    
    // ソルティノレシオ: 日次リターン
    const sortinoDaily = calculateSortinoRatio(returns, 0, true);
    expect(sortinoDaily).toBeGreaterThan(0);
    
    // ソルティノレシオ: ターゲットリターンを考慮
    const sortinoWithTarget = calculateSortinoRatio(returns, 0.01, true);
    expect(sortinoWithTarget).toBeLessThan(sortinoDaily); // ターゲットが高いので小さくなる
    
    // 下方偏差がない場合（すべて正のリターン）
    const allPositive = [0.01, 0.02, 0.03, 0.01, 0.02];
    expect(calculateSortinoRatio(allPositive, 0, true)).toBe(Infinity);
  });
  
  test('ドローダウン計算が正しく行われる', () => {
    // エクイティの推移
    const equity = [10000, 10500, 10200, 9800, 9600, 9900, 10100, 10400, 10300, 10600];
    
    const result = calculateDrawdowns(equity);
    
    // 最大ドローダウン: 10500 -> 9600 = 8.57%
    expect(result.maxDrawdown).toBeCloseTo(0.0857, 3);
    
    // ドローダウン期間の検出
    expect(result.drawdownPeriods.length).toBeGreaterThan(0);
    
    // 最初のドローダウン期間: インデックス1から4 (10500 -> 9600)
    const firstPeriod = result.drawdownPeriods.find(d => d.start === 1);
    expect(firstPeriod).toBeDefined();
    expect(firstPeriod?.depth).toBeCloseTo(0.0857, 3);
    
    // 空の配列と1要素の配列では計算できない
    expect(calculateDrawdowns([]).maxDrawdown).toBe(0);
    expect(calculateDrawdowns([10000]).maxDrawdown).toBe(0);
  });
}); 