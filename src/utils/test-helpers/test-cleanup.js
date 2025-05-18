/**
 * テストクリーンアップユーティリティ
 * REF-034: テスト実行環境の最終安定化
 * TST-058: リソーストラッカーの無限ループ問題修正
 * TST-060: Jest実行タイムアウトとクリーンアップ処理の最適化
 *
 * テスト実行中のリソースを適切にクリーンアップするためのユーティリティ関数群。
 * beforeEach/afterEach/afterAllフックで使用することで、テスト完了後に「Jest did not exit」
 * エラーが発生することを防止します。
 */

const ResourceTracker = require('./resource-tracker');
const fs = require('fs');
const path = require('path');
const os = require('os');

// TST-060: expectエラー修正のためにjestグローバルを直接参照
let globalExpect;
try {
  // @jest/globalsからexpectを取得する試み
  const jestGlobals = require('@jest/globals');
  globalExpect = jestGlobals.expect;
} catch (err) {
  // フォールバック: グローバルスコープからexpectを使用
  globalExpect = global.expect;
}

/**
 * グローバルリソーストラッカーインスタンス
 * @private
 */
let globalTracker = null;

/**
 * リソーストラッカーインスタンスを取得または作成
 * @returns {ResourceTracker} リソーストラッカーインスタンス
 */
function getResourceTracker() {
  if (!globalTracker) {
    globalTracker = new ResourceTracker();
  }
  return globalTracker;
}

/**
 * 非同期処理のクリーンアップを実行
 * @param {number} [timeout=100] - クリーンアップ後の待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
async function cleanupAsyncOperations(timeout = 100) {
  // オリジナルのsetTimeoutを保持（トラッキングされないタイマー用）
  const originalSetTimeout = globalTracker ? 
    globalTracker.originalSetTimeout : 
    global.setTimeout;

  // すべてのモックをリセット
  if (global.jest) {
    try {
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.useRealTimers();
    } catch (err) {
      console.warn('Jest関数実行中にエラーが発生しました:', err.message);
    }
  }

  // イベントリスナーを削除して潜在的なメモリリークを防止
  try {
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('uncaughtException');
  } catch (err) {
    console.warn('イベントリスナー削除中にエラーが発生しました:', err.message);
  }

  // リソーストラッカーのクリーンアップ（グローバル関数を元に戻す）
  if (globalTracker) {
    try {
      await globalTracker.cleanup(true);
    } catch (err) {
      console.warn('リソーストラッカーのクリーンアップ中にエラーが発生しました:', err.message);
    }
  }

  // 未解決のプロミスやタイマーを終了させるための遅延
  // より短い待機時間を使用
  if (timeout > 0) {
    return new Promise((resolve) => {
      originalSetTimeout(resolve, timeout);
    });
  }
}

/**
 * 一時テストディレクトリを作成
 * @param {string} [prefix='test-'] - ディレクトリ名のプレフィックス
 * @returns {string} 作成した一時ディレクトリのパス
 */
function createTempDirectory(prefix = 'test-') {
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
function createTempFile(content = '', extension = '.txt', directory) {
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
const testStatus = (() => {
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

/**
 * 標準的なbeforeEach関数
 * Jestのbeforeachで使用する
 */
function standardBeforeEach() {
  // テスト名を設定
  // TST-060: expectへの参照を安全に取得
  try {
    if (globalExpect && typeof globalExpect.getState === 'function') {
      testStatus.setCurrentTest(globalExpect.getState().currentTestName);
    } else if (global.expect && typeof global.expect.getState === 'function') {
      testStatus.setCurrentTest(global.expect.getState().currentTestName);
    } else {
      // フォールバック: テスト名が取得できない場合
      testStatus.setCurrentTest('Unknown Test');
    }
  } catch (err) {
    console.warn('テスト名の取得に失敗しました:', err.message);
    testStatus.setCurrentTest('Unknown Test');
  }
  
  // 前のテストの残存リソースをクリーンアップ
  if (globalTracker) {
    const stats = globalTracker.getStats();
    const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
    
    if (total > 0) {
      console.warn(`⚠️ 前のテストで残存したリソースを検出: ${JSON.stringify(stats)}`);
      globalTracker.cleanup(true).catch(err => {
        console.warn('クリーンアップ中にエラーが発生しました:', err.message);
      });
    }
  }
}

/**
 * 標準的なafterEach関数
 * Jestのaftereachで使用する
 */
async function standardAfterEach() {
  // モックをクリア
  if (global.jest) {
    try {
      jest.clearAllMocks();
      jest.resetAllMocks();
      jest.restoreAllMocks();
    } catch (err) {
      console.warn('Jestモッククリア中にエラーが発生しました:', err.message);
    }
  }
  
  // テスト完了を記録
  testStatus.completeTest(true);
  
  // 非同期処理をクリーンアップ（短めのタイムアウト）
  await cleanupAsyncOperations(50);
}

/**
 * 標準的なafterAll関数
 * JestのafterAllで使用する
 */
async function standardAfterAll() {
  // リソーストラッカーのクリーンアップ
  if (globalTracker) {
    try {
      await globalTracker.cleanup(true);
      globalTracker = null;
    } catch (err) {
      console.warn('最終クリーンアップ中にエラーが発生しました:', err.message);
    }
  }
  
  // 非同期処理の完全クリーンアップ（短めのタイムアウト）
  await cleanupAsyncOperations(100);
}

/**
 * すべてのテストヘルパー関数をエクスポート
 */
module.exports = {
  getResourceTracker,
  cleanupAsyncOperations,
  createTempDirectory,
  createTempFile,
  testStatus,
  standardBeforeEach,
  standardAfterEach,
  standardAfterAll
}; 