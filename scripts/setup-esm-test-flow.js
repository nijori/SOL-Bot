/**
 * ESMテスト環境セットアップスクリプト
 * REF-025: ESMテスト安定性の向上
 *
 * テスト実行前にESM環境設定と安定性向上のための前処理を行います
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Node.js環境変数の設定
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--experimental-vm-modules';

// 非同期エラーハンドラ設定
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 未処理のPromise拒否が検出されました:', promise);
  console.error('原因:', reason);
  // テスト環境では、警告のみにして処理は停止しない
});

// グローバルユーティリティのロード準備
globalThis.__TEST_RESOURCES = new Set();
globalThis.__REGISTER_TEST_RESOURCE = (resource) => {
  globalThis.__TEST_RESOURCES.add(resource);
  return resource;
};

// テスト環境ディレクトリの初期化
const testDirs = [path.join(rootDir, 'data', 'test-e2e'), path.join(rootDir, 'data', 'test')];

console.log('🔧 テスト環境を準備しています...');

// テストディレクトリの作成
for (const dir of testDirs) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ テストディレクトリを作成しました: ${dir}`);
    } catch (err) {
      console.error(`❌ テストディレクトリの作成中にエラーが発生しました: ${dir}`, err);
    }
  }
}

// test-handles-detector.js - オープンハンドル検出ユーティリティ
const createHandlesDetector = () => {
  let timers = new Set();
  let intervals = new Set();

  // 元のタイマー関数を保存
  const originalSetTimeout = global.setTimeout;
  const originalSetInterval = global.setInterval;
  const originalClearTimeout = global.clearTimeout;
  const originalClearInterval = global.clearInterval;

  // タイマー関数をラップしてトラッキング
  global.setTimeout = function (fn, delay, ...args) {
    const timer = originalSetTimeout(fn, delay, ...args);
    timers.add(timer);
    return timer;
  };

  global.clearTimeout = function (timer) {
    timers.delete(timer);
    return originalClearTimeout(timer);
  };

  global.setInterval = function (fn, delay, ...args) {
    const interval = originalSetInterval(fn, delay, ...args);
    intervals.add(interval);
    return interval;
  };

  global.clearInterval = function (interval) {
    intervals.delete(interval);
    return originalClearInterval(interval);
  };

  // 未クリアのハンドルを報告
  return {
    report: () => {
      const activeTimers = timers.size;
      const activeIntervals = intervals.size;

      if (activeTimers > 0 || activeIntervals > 0) {
        console.warn(`⚠️ 未クリアのタイマーハンドルが検出されました:`);
        console.warn(`  - setTimeout: ${activeTimers}件`);
        console.warn(`  - setInterval: ${activeIntervals}件`);
        return true;
      }
      return false;
    },
    reset: () => {
      // すべてのタイマーをクリア
      for (const timer of timers) {
        originalClearTimeout(timer);
      }
      for (const interval of intervals) {
        originalClearInterval(interval);
      }
      timers.clear();
      intervals.clear();
    },
    restore: () => {
      // 元の関数を復元
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    }
  };
};

// ハンドル検出が有効な場合、検出器を初期化
if (process.argv.includes('--detect-handles')) {
  console.log('🔍 オープンハンドル検出を有効化しています...');
  globalThis.__HANDLES_DETECTOR = createHandlesDetector();

  // プロセス終了時に報告
  process.on('exit', () => {
    const hasOpenHandles = globalThis.__HANDLES_DETECTOR.report();
    if (hasOpenHandles) {
      console.warn('⚠️ 未クリアのハンドルがあるため、Jestが正常に終了しない可能性があります');
    }
    globalThis.__HANDLES_DETECTOR.reset();
    globalThis.__HANDLES_DETECTOR.restore();
  });
}

console.log('✅ テスト環境のセットアップが完了しました');

// 環境変数でNode.jsバージョンとESMサポート状況を表示
console.log(`🔧 Node.jsバージョン: ${process.version}`);
console.log(
  `🔧 ESMサポート: ${process.execArgv.includes('--experimental-vm-modules') ? '有効' : '無効'}`
);
console.log(`🔧 TEST_MODE: ${process.env.TEST_MODE || 'default'}`);

// テスト環境の準備完了
export default {
  rootDir,
  testDirs
};
