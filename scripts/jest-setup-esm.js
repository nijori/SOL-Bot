/**
 * Jest ESMテスト用のグローバルセットアップファイル
 * REF-025: ESMテスト安定性の向上
 */

// ESMモジュール対応のためjestをインポート
import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// ESMモードでrequireを使えるようにする
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
global.require = createRequire(import.meta.url);

// ESMモード用のmoduleポリフィル
global.module = { exports: {} };
global.module.id = __filename;
global.module.path = __dirname;
global.module.filename = __filename;
global.module.parent = null;
// main moduleチェック用のフラグ
global.__isMainModule = true;

// jest.mock用のモジュール解決パスを設定
process.env.JEST_ROOT_DIR = path.resolve(__dirname, '..');

// グローバルスコープにjestを公開
globalThis.jest = jest;

// duckdbのモック設定
// 並列テスト実行用に、テスト環境でduckdbをダミー実装に置き換える
jest.unstable_mockModule('duckdb', () => ({
  Database: class {
    constructor() {
      // モック実装
    }
    connect() {
      return {
        exec: () => {
          // モック実装の戻り値
          return {
            all: () => []
          };
        },
        prepare: () => ({
          run: () => {},
          all: () => []
        }),
        all: () => []
      };
    }
    close() {}
  }
}));

// モック用ヘルパー関数 - 拡張子を自動で補完
const addJsExtension = (path) => {
  if (!path.endsWith('.js') && !path.endsWith('.mjs')) {
    return `${path}.js`;
  }
  return path;
};

// ESM用モック関数（拡張子を自動補完）
global.jestMockESM = (path) => {
  jest.mock(addJsExtension(path));
}

// ダイナミックモック関数（拡張子を自動補完）
global.jestMockESMFn = (path, factory) => {
  jest.mock(addJsExtension(path), factory);
}

// ESMテスト用のモック置換をサポートするヘルパー（テストファイルで使用可能）
global.mockESM = (modulePath, mockContent) => {
  const mod = { ...mockContent };
  if (!mockContent.__esModule) {
    mod.__esModule = true;
  }
  return mod;
};

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

// afterAllのグローバルフック - タイムアウトを30秒に延長
afterAll(async () => {
  // グローバルリソースのクリーンアップ
  global.__CLEANUP_RESOURCES();

  // 未解決のプロミスやタイマーを終了させるための遅延
  await new Promise((resolve) => {
    setTimeout(() => {
      // イベントリスナーを削除して潜在的なメモリリークを防止
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, 1000);
  });

  // タイマーのクリア
  jest.clearAllTimers();

  // モックのリセット
  jest.clearAllMocks();

  // 未解放のタイマーとインターバルをクリーンアップ
  [...activeTimers].forEach((timer) => originalClearTimeout(timer));
  [...activeIntervals].forEach((interval) => originalClearInterval(interval));

  activeTimers.clear();
  activeIntervals.clear();
}, 30000); // タイムアウト時間を30秒に延長

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
  return new Promise((resolve) => {
    setTimeout(() => {
      // イベントリスナーを削除
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, 100);
  });
};
