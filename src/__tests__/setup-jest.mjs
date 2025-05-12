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

// beforeAllのグローバルフック
beforeAll(() => {
  // テスト環境のセットアップ
  jest.setTimeout(30000); // テストタイムアウトを30秒に設定

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

// afterEachのグローバルフック
afterEach(async () => {
  // モックをリセット
  jest.clearAllMocks();
  jest.resetAllMocks();
  
  // 未解決のプロミスやタイマーを終了させるための遅延
  return new Promise((resolve) => {
    setTimeout(() => {
      // 未クリアのタイマー/インターバルをクリア
      [...activeTimers].forEach((timer) => originalClearTimeout(timer));
      [...activeIntervals].forEach((interval) => originalClearInterval(interval));
      
      activeTimers.clear();
      activeIntervals.clear();
      
      resolve();
    }, 500); // 100msから500msに延長
  });
}, 60000); // タイムアウト値を明示的に60秒に設定

// afterAllのグローバルフック - タイムアウトを30秒に延長
afterAll(async () => {
  // グローバルリソースのクリーンアップ
  global.__CLEANUP_RESOURCES();

  // 非同期処理の完全クリーンアップ
  await cleanupAsyncOperations(1000);

  // タイマーのクリア
  jest.clearAllTimers();

  // モックのリセット
  jest.clearAllMocks();

  // 未解放のタイマーとインターバルをクリーンアップ
  [...activeTimers].forEach((timer) => originalClearTimeout(timer));
  [...activeIntervals].forEach((interval) => originalClearInterval(interval));

  activeTimers.clear();
  activeIntervals.clear();
}, 30000);

// グローバルクリーンアップヘルパー
global.cleanupAsyncResources = async () => {
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

  // 未解決のプロミスやタイマーを終了させるための遅延
  return new Promise((resolve) => {
    setTimeout(() => {
      // イベントリスナーを削除
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, 100);
  });
}; 