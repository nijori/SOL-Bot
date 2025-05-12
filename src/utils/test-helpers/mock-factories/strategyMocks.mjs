/**
 * 戦略モジュール用モックファクトリー関数（ESM版）
 * TST-055: モジュールモックの一貫性向上
 * TST-057: ESMテスト環境の修正と安定化
 * 
 * ESM環境で動作する戦略モジュールのモックを作成するファクトリー関数を提供します
 */

// ESM環境ではグローバルjestの代わりに@jest/globalsから直接インポート
import { jest } from '@jest/globals';

/**
 * 基本戦略モックを作成するファクトリー関数
 * @param {string} strategy - モックする戦略名
 * @param {function} [executeImpl] - executeメソッドの実装
 * @returns {jest.Mock} - 設定済みのjest.mockオブジェクト
 */
export function createStrategyMock(strategy, executeImpl = null) {
  // デフォルト実装
  const defaultImpl = (candles, positions) => {
    // デフォルトでは空のシグナル配列を返す
    return [];
  };

  // 実際に使用する実装
  const mockImpl = executeImpl || defaultImpl;

  // モックオブジェクトを作成
  const strategyMock = jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockImplementation(mockImpl)
  }));
  
  // モック情報を追加
  strategyMock.mockStrategyName = strategy;
  
  return strategyMock;
}

/**
 * 平均回帰戦略のモックを作成
 * @param {function} [executeImpl] - executeメソッドの実装
 * @returns {jest.Mock} - 設定済みのjest.mockオブジェクト
 */
export function createMeanReversionStrategyMock(executeImpl = null) {
  return createStrategyMock('MeanReversionStrategy', executeImpl);
}

/**
 * グリッド戦略のモックを作成
 * @param {function} [executeImpl] - executeメソッドの実装
 * @returns {jest.Mock} - 設定済みのjest.mockオブジェクト
 */
export function createGridStrategyMock(executeImpl = null) {
  return createStrategyMock('GridStrategy', executeImpl);
}

/**
 * トレンドフォロー戦略のモックを作成
 * @param {function} [executeImpl] - executeメソッドの実装
 * @returns {jest.Mock} - 設定済みのjest.mockオブジェクト
 */
export function createTrendFollowingStrategyMock(executeImpl = null) {
  return createStrategyMock('TrendFollowingStrategy', executeImpl);
}

/**
 * すべての戦略に対して標準モックを登録するヘルパー関数
 * @param {jest} jestInstance - Jestインスタンス
 */
export function mockAllStrategies(jestInstance) {
  jestInstance.mock('../../strategies/meanReversionStrategy.js', () => ({
    MeanReversionStrategy: createMeanReversionStrategyMock()
  }));
  
  jestInstance.mock('../../strategies/trendFollowStrategy.js', () => ({
    TrendFollowStrategy: createTrendFollowingStrategyMock()
  }));
  
  jestInstance.mock('../../strategies/rangeStrategy.js', () => ({
    RangeStrategy: createGridStrategyMock()
  }));
}

// デフォルトエクスポート
export default {
  createStrategyMock,
  createMeanReversionStrategyMock,
  createGridStrategyMock,
  createTrendFollowingStrategyMock,
  mockAllStrategies
}; 