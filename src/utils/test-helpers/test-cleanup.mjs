/**
 * テストクリーンアップユーティリティ (ESM版)
 * REF-034: テスト実行環境の最終安定化
 *
 * テスト実行中のリソースを適切にクリーンアップするためのユーティリティ関数群。
 * beforeEach/afterEach/afterAllフックで使用することで、テスト完了後に「Jest did not exit」
 * エラーが発生することを防止します。
 */

import { jest } from '@jest/globals';
import ResourceTracker from './resource-tracker.mjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * グローバルリソーストラッカーインスタンス
 * @private
 */
let globalTracker = null;

/**
 * リソーストラッカーインスタンスを取得または作成
 * @returns {ResourceTracker} リソーストラッカーインスタンス
 */
export function getResourceTracker() {
  if (!globalTracker) {
    globalTracker = new ResourceTracker();
  }
  return globalTracker;
}

/**
 * 非同期処理のクリーンアップを実行
 * @param {number} [timeout=200] - クリーンアップ後の待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
export async function cleanupAsyncOperations(timeout = 200) {
  // すべてのモックをリセット
  jest.clearAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();

  // グローバルタイマーをクリア
  if (global.setInterval && global.setInterval.mockClear) {
    global.setInterval.mockClear();
  }

  if (global.clearInterval && global.clearInterval.mockClear) {
    global.clearInterval.mockClear();
  }

  // イベントリスナーを削除して潜在的なメモリリークを防止
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('uncaughtException');

  // リソーストラッカーのクリーンアップ
  if (globalTracker) {
    await globalTracker.cleanup();
  }

  // 未解決のプロミスやタイマーを終了させるための遅延
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

/**
 * 一時テストディレクトリを作成
 * @param {string} [prefix='test-'] - ディレクトリ名のプレフィックス
 * @returns {string} 作成した一時ディレクトリのパス
 */
export function createTempDirectory(prefix = 'test-') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const dirName = `${prefix}${timestamp}-${random}`;
  const tempDir = path.join(os.tmpdir(), dirName);
  
  fs.mkdirSync(tempDir, { recursive: true });
  
  // リソーストラッカーに登録して自動クリーンアップ
  getResourceTracker().trackTempDir(tempDir);
  
  return tempDir;
}

/**
 * テスト用の一時ファイルを作成
 * @param {string} [content=''] - ファイルの内容
 * @param {string} [extension='.txt'] - ファイル拡張子
 * @param {string} [directory] - 保存先ディレクトリ（指定なしの場合は一時ディレクトリを作成）
 * @returns {string} 作成した一時ファイルのパス
 */
export function createTempFile(content = '', extension = '.txt', directory) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const fileName = `tempfile-${timestamp}-${random}${extension}`;
  
  const dir = directory || createTempDirectory();
  const filePath = path.join(dir, fileName);
  
  fs.writeFileSync(filePath, content, 'utf8');
  
  // リソーストラッカーに登録して自動クリーンアップ
  getResourceTracker().trackTempFile(filePath);
  
  return filePath;
}

/**
 * テストのステータスを格納するクロージャ
 */
const testStatusImpl = (() => {
  let currentTest = null;
  
  return {
    /**
     * 現在実行中のテスト名を設定
     * @param {string} name - テスト名
     */
    setCurrentTest(name) {
      currentTest = name;
      console.log(`🧪 テスト実行開始: ${name}`);
    },
    
    /**
     * 現在実行中のテスト名を取得
     * @returns {string|null} テスト名
     */
    getCurrentTest() {
      return currentTest;
    },
    
    /**
     * テスト完了時の処理
     * @param {boolean} [success=true] - テストが成功したかどうか
     */
    completeTest(success = true) {
      if (currentTest) {
        console.log(`${success ? '✅' : '❌'} テスト完了: ${currentTest}`);
        currentTest = null;
      }
    }
  };
})();

export const testStatus = testStatusImpl;

/**
 * 標準的なbeforeEach関数
 * Jestのbeforeachで使用する
 */
export function standardBeforeEach() {
  // テスト名を設定
  testStatus.setCurrentTest(expect.getState().currentTestName);
  
  // 前のテストの残存リソースをクリーンアップ
  if (globalTracker) {
    const stats = globalTracker.getStats();
    const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
    
    if (total > 0) {
      console.warn(`⚠️ 前のテストで残存したリソースを検出: ${JSON.stringify(stats)}`);
      globalTracker.cleanup(true);
    }
  }
}

/**
 * 標準的なafterEach関数
 * Jestのaftereachで使用する
 */
export async function standardAfterEach() {
  // モックをクリア
  jest.clearAllMocks();
  jest.resetAllMocks();
  jest.restoreAllMocks();
  
  // テスト完了を記録
  testStatus.completeTest(true);
  
  // 非同期処理をクリーンアップ
  await cleanupAsyncOperations();
}

/**
 * 標準的なafterAll関数
 * JestのafterAllで使用する
 */
export async function standardAfterAll() {
  // リソーストラッカーのクリーンアップ
  if (globalTracker) {
    await globalTracker.cleanup(true);
    globalTracker = null;
  }
  
  // 非同期処理の完全クリーンアップ
  await cleanupAsyncOperations(500);
}

// デフォルトエクスポートもサポート
export default {
  getResourceTracker,
  cleanupAsyncOperations,
  createTempDirectory,
  createTempFile,
  testStatus,
  standardBeforeEach,
  standardAfterEach,
  standardAfterAll
}; 