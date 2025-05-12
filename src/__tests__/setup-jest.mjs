/**
 * Jest全体のセットアップファイル (ESM版)
 * REF-034: テスト実行環境の最終安定化
 */

import { jest } from '@jest/globals';
import { getResourceTracker, cleanupAsyncOperations } from '../utils/test-helpers/test-cleanup.mjs';

// グローバルにリソーストラッカーを設定
global.__TEST_RESOURCES = new Set();
global.__RESOURCE_TRACKER = getResourceTracker();

// アクティブなタイマーとインターバルを追跡
const activeTimers = new Set();
const activeIntervals = new Set();

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

// モックモジュールヘルパー
global.mockESMModule = (modulePath, mockImplementation = {}) => {
  return jest.mock(modulePath, () => {
    return {
      __esModule: true,
      ...mockImplementation
    };
  });
};

// モッククラス作成ヘルパー
global.createMock = (className, methods = {}) => {
  const mockClass = jest.fn().mockImplementation(() => {
    const instance = {};
    Object.entries(methods).forEach(([method, implementation]) => {
      instance[method] = jest.fn(implementation);
    });
    return instance;
  });
  
  return mockClass;
};

// すべてのリソースをクリーンアップする関数
const cleanupAllResources = async () => {
  // モックをリセット
  jest.clearAllMocks();
  jest.resetAllMocks();
  
  // 未解放のタイマーとインターバルをクリーンアップ
  [...activeTimers].forEach((timer) => originalClearTimeout(timer));
  [...activeIntervals].forEach((interval) => originalClearInterval(interval));
  
  activeTimers.clear();
  activeIntervals.clear();
  
  // グローバルリソースのクリーンアップ
  global.__CLEANUP_RESOURCES();
  
  // タイマー関連リセット
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // メモリリークを防ぐための短い待機
  await new Promise(resolve => setTimeout(resolve, 10));
  
  // プロセスのイベントリスナーをクリア
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('uncaughtException');
  
  // 非同期リソースを最終クリーンアップ
  return cleanupAsyncOperations(100);
};

// beforeAllのグローバルフック
beforeAll(() => {
  // テスト環境のセットアップ
  jest.setTimeout(60000); // テストタイムアウトを60秒に設定

  // Jest終了時の未クリアハンドル検出用
  process.on('exit', () => {
    const hasActiveTimers = activeTimers.size > 0;
    const hasActiveIntervals = activeIntervals.size > 0;

    if (hasActiveTimers || hasActiveIntervals) {
      console.warn(
        `⚠️ クリーンアップされていないタイマー検出: ${activeTimers.size} タイマー, ${activeIntervals.size} インターバル`
      );

      // タイマー・インターバルの自動クリーンアップ
      [...activeTimers].forEach((timer) => originalClearTimeout(timer));
      [...activeIntervals].forEach((interval) => originalClearInterval(interval));

      activeTimers.clear();
      activeIntervals.clear();
    }
  });
});

// afterEachのグローバルフック - 同期処理にして高速化
afterEach(() => {
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
}, 30000); // 30秒のタイムアウト（同期処理なので短くする）

// afterAllのグローバルフック
afterAll(async () => {
  // 完全なクリーンアップを実行
  await cleanupAllResources();
}, 60000); // タイムアウト60秒

// グローバルクリーンアップヘルパー
global.cleanupAsyncResources = cleanupAllResources; 