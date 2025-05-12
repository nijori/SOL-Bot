/**
 * Jest全体のセットアップファイル (ESM版)
 * REF-034: テスト実行環境の最終安定化
 * TST-056: テスト実行時のメモリリーク問題の解決
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
  jest.setTimeout(120000); // テストタイムアウトを120秒に設定

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

// afterEachのグローバルフック - 非同期処理に変更してより確実なクリーンアップを実施
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
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 残っているリソースの解放を試みる
  await cleanupAsyncOperations(200);
  
  // Event Loopをクリアする最終的な短い待機
  await new Promise(resolve => setImmediate(resolve));
}, 120000); // 120秒のタイムアウト（非同期処理のため長めに設定）

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
  
  // プロセスリスナーをリセット
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('uncaughtException');
  
  // 強制的なメモリー解放のための2段階クリーンアップ
  try {
    // 第1段階：即時クリーンアップ
    await cleanupAllResources();
    
    // 第2段階：さらなるコンテキスト切り替えを待機した上でのクリーンアップ
    await new Promise(resolve => setTimeout(resolve, 1000));
    await cleanupAsyncOperations(500);
    
    // 最終段階：プロセスイベントループをクリア
    await new Promise(resolve => setImmediate(resolve));
  } catch (err) {
    console.error('afterAll クリーンアップ中にエラーが発生しました:', err);
  }
}, 180000); // 3分のタイムアウト（完全なクリーンアップを保証）

// グローバルクリーンアップヘルパー
global.cleanupAsyncResources = cleanupAllResources; 