/**
 * Jest ESMテスト用のグローバルセットアップファイル
 * REF-025: ESMテスト安定性の向上
 */

// ESMモジュール対応のためjestをインポート
import { jest } from '@jest/globals';

// グローバルタイマー追跡
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalClearTimeout = global.clearTimeout;
const originalClearInterval = global.clearInterval;

// 未解放タイマーのリスト
const activeTimers = new Set();
const activeIntervals = new Set();

// タイマー関数をラップして追跡
global.setTimeout = function wrappedSetTimeout(fn, delay, ...args) {
  const timer = originalSetTimeout(fn, delay, ...args);
  activeTimers.add(timer);
  return timer;
};

global.clearTimeout = function wrappedClearTimeout(timer) {
  activeTimers.delete(timer);
  return originalClearTimeout(timer);
};

global.setInterval = function wrappedSetInterval(fn, delay, ...args) {
  const interval = originalSetInterval(fn, delay, ...args);
  activeIntervals.add(interval);
  return interval;
};

global.clearInterval = function wrappedClearInterval(interval) {
  activeIntervals.delete(interval);
  return originalClearInterval(interval);
};

// リソース追跡のグローバルオブジェクト
global.__TEST_RESOURCES = new Set();

// リソース登録ヘルパー
global.__REGISTER_RESOURCE = (resource) => {
  global.__TEST_RESOURCES.add(resource);
  return resource;
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

// beforeAllのグローバルフック
beforeAll(() => {
  // Jest終了時の未クリアハンドル検出用
  process.on('exit', () => {
    const hasActiveTimers = activeTimers.size > 0;
    const hasActiveIntervals = activeIntervals.size > 0;
    
    if (hasActiveTimers || hasActiveIntervals) {
      console.warn(`⚠️ クリーンアップされていないタイマー検出: ${activeTimers.size} タイマー, ${activeIntervals.size} インターバル`);
      
      // タイマー・インターバルの自動クリーンアップ
      [...activeTimers].forEach(timer => originalClearTimeout(timer));
      [...activeIntervals].forEach(interval => originalClearInterval(interval));
      
      activeTimers.clear();
      activeIntervals.clear();
    }
  });
});

// afterAllのグローバルフック
afterAll(async () => {
  // グローバルリソースのクリーンアップ
  global.__CLEANUP_RESOURCES();
  
  // 未解決のプロミスやタイマーを終了させるための遅延
  await new Promise(resolve => {
    setTimeout(() => {
      // イベントリスナーを削除して潜在的なメモリリークを防止
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, 100);
  });
  
  // タイマーのクリア
  jest.clearAllTimers();
  
  // モックのリセット
  jest.clearAllMocks();
  
  // 未解放のタイマーとインターバルをクリーンアップ
  [...activeTimers].forEach(timer => originalClearTimeout(timer));
  [...activeIntervals].forEach(interval => originalClearInterval(interval));
  
  activeTimers.clear();
  activeIntervals.clear();
}, 10000); // タイムアウト時間を10秒に延長

// 各テスト後のクリーンアップ
afterEach(() => {
  // タイマーのクリア
  jest.clearAllTimers();
  
  // モックのリセット
  jest.clearAllMocks();
});

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
  return new Promise(resolve => {
    setTimeout(() => {
      // イベントリスナーを削除
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, 100);
  });
}; 