/**
 * Jest全体のセットアップファイル (CommonJS版)
 * TST-056: テスト実行時のメモリリーク問題の解決
 * TST-057: ESMテスト環境の修正と安定化
 * TST-058: リソーストラッカーの無限ループ問題修正
 * TST-060: Jest実行タイムアウトとクリーンアップ処理の最適化
 */

// jestをインポート
const { jest, beforeAll, afterEach, afterAll } = require('@jest/globals');

// グローバルにモジュール解決をパッチする（TST-056/057対応）
// 拡張子が省略されたモジュールパスの解決を支援
const originalRequire = module.require;
module.require = function patchedRequire(path) {
  let resolvedPath = path;
  
  // 相対パスで拡張子なしのファイルを処理
  if (path.startsWith('.') && !path.endsWith('.js') && !path.endsWith('.mjs') && !path.endsWith('.cjs')) {
    // まず.jsでトライ
    try {
      return originalRequire.call(this, `${path}.js`);
    } catch (e) {
      // 次に.mjsでトライ
      try {
        return originalRequire.call(this, `${path}.mjs`);
      } catch (e2) {
        // 最後に.cjsでトライ
        try {
          return originalRequire.call(this, `${path}.cjs`);
        } catch (e3) {
          // 元のパスにフォールバック
          resolvedPath = path;
        }
      }
    }
  }
  
  // 元のrequireを呼び出し
  return originalRequire.call(this, resolvedPath);
};

// テストのタイムアウトを設定（TST-060で最適化）
jest.setTimeout(180000); // 3分に延長（以前は2分）

// グローバル変数の設定（リソーストラッカーの代替）
global.__TEST_RESOURCES = new Set();

// アクティブなタイマーとインターバルを追跡
const activeTimers = new Set();
const activeIntervals = new Set();

// Node.jsのタイマー関数をオーバーライド
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

// タイマー追跡がアクティブかどうかのフラグ
let isTimerTrackingActive = true;

// setTimeoutとclearTimeoutのオーバーライド
global.setTimeout = function trackedSetTimeout(fn, delay, ...args) {
  const timerId = originalSetTimeout.call(this, fn, delay, ...args);
  // 追跡がアクティブな場合のみタイマーを追加
  if (isTimerTrackingActive) {
    activeTimers.add(timerId);
  }
  return timerId;
};

global.clearTimeout = function trackedClearTimeout(timerId) {
  activeTimers.delete(timerId);
  return originalClearTimeout.call(this, timerId);
};

// setIntervalとclearIntervalのオーバーライド
global.setInterval = function trackedSetInterval(fn, delay, ...args) {
  const intervalId = originalSetInterval.call(this, fn, delay, ...args);
  // 追跡がアクティブな場合のみインターバルを追加
  if (isTimerTrackingActive) {
    activeIntervals.add(intervalId);
  }
  return intervalId;
};

global.clearInterval = function trackedClearInterval(intervalId) {
  activeIntervals.delete(intervalId);
  return originalClearInterval.call(this, intervalId);
};

// リソースクリーンアップヘルパー
async function cleanupAsyncResources() {
  // トラッキングを停止（無限ループを防ぐため）
  isTimerTrackingActive = false;
  
  // タイマー関連のグローバル関数をバックアップ
  const safeSetTimeout = originalSetTimeout;
  const safeSetImmediate = global.setImmediate;

  // タイマー追跡を停止（先にグローバル関数を元に戻す）
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
  global.setInterval = originalSetInterval;
  global.clearInterval = originalClearInterval;
  
  // 未解放のタイマーとインターバルをクリーンアップ
  [...activeTimers].forEach(timer => {
    try {
      originalClearTimeout(timer);
    } catch (err) {
      // エラーは無視
    }
  });
  
  [...activeIntervals].forEach(interval => {
    try {
      originalClearInterval(interval);
    } catch (err) {
      // エラーは無視
    }
  });
  
  activeTimers.clear();
  activeIntervals.clear();
  
  // モックをリセット
  try {
    jest.clearAllMocks();
    jest.resetAllMocks();
  } catch (err) {
    // エラーは無視
  }
  
  // TST-060: 待機時間を延長して非同期タスクの完了を確実に待機
  // 段階的に待機することで、タイミング問題による中断を防止
  await new Promise(resolve => safeSetTimeout(resolve, 25));
  await new Promise(resolve => safeSetImmediate(resolve));
  await new Promise(resolve => safeSetTimeout(resolve, 25));
  
  // プロセスのイベントリスナーをクリア
  try {
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('warning');
  } catch (err) {
    // エラーは無視
  }
  
  // 最終的なイベントループクリア（トラッキングしない安全な関数を使用）
  await new Promise(resolve => safeSetImmediate(resolve));
  
  // タイマー追跡を再開
  isTimerTrackingActive = true;
}

// グローバルクリーンアップヘルパー
global.__CLEANUP_RESOURCES = () => {
  const resources = [...global.__TEST_RESOURCES];
  
  // TST-060: リソース破棄をtry-catchで個別に行い、一つの失敗が全体を中断しないようにする
  for (const resource of resources) {
    try {
      if (resource.destroy && typeof resource.destroy === 'function') {
        resource.destroy();
        global.__TEST_RESOURCES.delete(resource);
      } else if (resource.close && typeof resource.close === 'function') {
        resource.close();
        global.__TEST_RESOURCES.delete(resource);
      } else if (resource.stop && typeof resource.stop === 'function') {
        resource.stop();
        global.__TEST_RESOURCES.delete(resource);
      }
    } catch (err) {
      console.error('リソースクリーンアップエラー:', err);
    }
  }
};

// モックヘルパーグローバル関数
global.createMockWithImplementation = (implementation = {}) => {
  const mock = jest.fn();
  Object.entries(implementation).forEach(([key, value]) => {
    mock[key] = jest.fn(value);
  });
  return mock;
};

// beforeAllのグローバルフック
beforeAll(() => {
  // テストタイムアウトを設定（TST-060対応で最適化）
  jest.setTimeout(180000); // 3分に延長
  
  // 終了時の未クリアタイマー検出
  process.on('exit', () => {
    const hasActiveTimers = activeTimers.size > 0;
    const hasActiveIntervals = activeIntervals.size > 0;
    
    if (hasActiveTimers || hasActiveIntervals) {
      console.warn(`⚠️ 未解放タイマー: ${activeTimers.size} タイマー, ${activeIntervals.size} インターバル`);
      
      // 自動クリーンアップ
      [...activeTimers].forEach(timer => originalClearTimeout(timer));
      [...activeIntervals].forEach(interval => originalClearInterval(interval));
    }
  });
});

// afterEachのグローバルフック
afterEach(async () => {
  // TST-060: タイムアウトを延長し、テストクリーンアップに十分な時間を与える
  jest.setTimeout(180000);

  // タイマーリセット
  jest.clearAllTimers();
  
  // モックリセット
  jest.clearAllMocks();
  jest.resetAllMocks();
  
  // TST-060: タイマーとインターバルの解放を段階的に行い、エラーハンドリングを強化
  try {
    [...activeTimers].forEach(timer => {
      try {
        originalClearTimeout(timer);
      } catch (err) {
        // 個別エラーを無視
      }
    });
    
    [...activeIntervals].forEach(interval => {
      try {
        originalClearInterval(interval);
      } catch (err) {
        // 個別エラーを無視
      }
    });
  } catch (err) {
    console.error('タイマークリーンアップでエラー:', err);
  }
  
  activeTimers.clear();
  activeIntervals.clear();
  
  // グローバルリソースの解放
  global.__CLEANUP_RESOURCES();
  
  // TST-060: イベントループクリア待機を段階的に行い、すべての非同期処理が確実に完了するように
  // 待機間隔を調整（2段階に分け、間に setImmediate を挟む）
  await new Promise(resolve => originalSetTimeout(resolve, 50));
  await new Promise(resolve => global.setImmediate(resolve));
  await new Promise(resolve => originalSetTimeout(resolve, 50));
  await new Promise(resolve => global.setImmediate(resolve));
});

// afterAllのグローバルフック
afterAll(async () => {
  // TST-060: タイムアウトを延長
  jest.setTimeout(180000);

  // TST-060: 完全なクリーンアップを3段階で実行（より確実に）
  await cleanupAsyncResources();
  
  // イベントループをクリア
  await new Promise(resolve => global.setImmediate(resolve));
  
  // 2段階目のクリーンアップ
  await new Promise(resolve => originalSetTimeout(resolve, 50));
  await cleanupAsyncResources();
  
  // イベントループをクリア
  await new Promise(resolve => global.setImmediate(resolve));
  
  // 3段階目のクリーンアップ
  await new Promise(resolve => originalSetTimeout(resolve, 50));
  await cleanupAsyncResources();
  
  // 最終的なイベントループクリア
  await new Promise(resolve => global.setImmediate(resolve));
});

// グローバルヘルパー
global.cleanupAsyncResources = cleanupAsyncResources; 