/**
 * Jest全体のセットアップファイル (ESM版)
 * REF-034: テスト実行環境の最終安定化
 * TST-056: テスト実行時のメモリリーク問題の解決
 * TST-066: ESMテスト実行環境の修正
 */

import { jest } from '@jest/globals';

// アクティブなタイマーとインターバルを追跡
const activeTimers = new Set();
const activeIntervals = new Set();

// グローバルテストリソース追跡用
global.__TEST_RESOURCES = new Set();

// Node.jsのタイマー関数をオーバーライド（リソーストラッカーと連携）
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

// setTimeoutのオーバーライド
global.setTimeout = function trackedSetTimeout(fn, delay, ...args) {
  const timerId = originalSetTimeout.call(this, fn, delay, ...args);
  activeTimers.add(timerId);
  return timerId;
};

// clearTimeoutのオーバーライド
global.clearTimeout = function trackedClearTimeout(timerId) {
  activeTimers.delete(timerId);
  return originalClearTimeout.call(this, timerId);
};

// setIntervalのオーバーライド
global.setInterval = function trackedSetInterval(fn, delay, ...args) {
  const intervalId = originalSetInterval.call(this, fn, delay, ...args);
  activeIntervals.add(intervalId);
  return intervalId;
};

// clearIntervalのオーバーライド
global.clearInterval = function trackedClearInterval(intervalId) {
  activeIntervals.delete(intervalId);
  return originalClearInterval.call(this, intervalId);
};

// リソースクリーンアップヘルパー
global.__CLEANUP_RESOURCES = () => {
  for (const resource of global.__TEST_RESOURCES) {
    if (resource.destroy && typeof resource.destroy === 'function') {
      resource.destroy();
    } else if (resource.close && typeof resource.close === 'function') {
      resource.close();
    } else if (resource.stop && typeof resource.stop === 'function') {
      resource.stop();
    }
  }
  global.__TEST_RESOURCES.clear();
};

// 非同期操作のクリーンアップ
global.cleanupAsyncOperations = async (waitTime = 100) => {
  // 未解放のタイマーとインターバルをクリーンアップ
  [...activeTimers].forEach((timer) => originalClearTimeout(timer));
  [...activeIntervals].forEach((interval) => originalClearInterval(interval));
  
  activeTimers.clear();
  activeIntervals.clear();
  
  // リソースのクリーンアップ
  global.__CLEANUP_RESOURCES();
  
  // タイマー関連リセット
  jest.clearAllTimers();
  
  // 非同期処理の完了を待機
  await new Promise(resolve => setTimeout(resolve, waitTime));
  
  // イベントループをクリア
  await new Promise(resolve => setImmediate(resolve));
  
  return true;
};

// ESM環境用のモックヘルパー
global.mockESMModule = (modulePath, mockImplementation = {}) => {
  return jest.mock(modulePath, () => {
    return {
      __esModule: true,
      ...mockImplementation
    };
  });
};

// モッククラス作成ヘルパー
global.createMockClass = (className, methods = {}) => {
  return jest.fn().mockImplementation(() => {
    const instance = {};
    Object.entries(methods).forEach(([method, implementation]) => {
      instance[method] = jest.fn(implementation);
    });
    return instance;
  });
};

// beforeAllのグローバルフック
beforeAll(() => {
  // テスト環境のセットアップ
  jest.setTimeout(60000); // テストタイムアウトを60秒に設定
});

// afterEachのグローバルフック
afterEach(async () => {
  // モックリセットと同期的なクリーンアップを即時実行
  jest.clearAllMocks();
  jest.resetAllMocks();
  
  // 即座にタイマーとインターバルを解放
  [...activeTimers].forEach(timer => originalClearTimeout(timer));
  [...activeIntervals].forEach(interval => originalClearInterval(interval));
  
  activeTimers.clear();
  activeIntervals.clear();
  
  // jestタイマーリセット
  jest.clearAllTimers();
  
  // 非同期処理の完全なクリーンアップのための待機
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Event Loopをクリアする最終的な短い待機
  await new Promise(resolve => setImmediate(resolve));
});

// afterAllのグローバルフック
afterAll(async () => {
  // モックをリセット
  jest.clearAllMocks();
  jest.resetAllMocks();
  
  // タイマーとイベントリスナーをクリア
  [...activeTimers].forEach(timer => originalClearTimeout(timer));
  [...activeIntervals].forEach(interval => originalClearInterval(interval));
  activeTimers.clear();
  activeIntervals.clear();
  
  // 非同期処理のクリーンアップ
  await global.cleanupAsyncOperations(200);
}); 