/**
 * テスト実行中のリソースクリーンアップ用ユーティリティ (ESM版)
 * TST-056: テスト実行時のメモリリーク問題の解決
 * 
 * テスト実行中に作成された非同期リソース（タイマー、ストリーム、イベントリスナーなど）を
 * クリーンアップするためのユーティリティ関数を提供します。
 */

/**
 * テスト中に作成されたリソースを追跡するためのヘルパー
 * @returns {Object} リソーストラッカーオブジェクト
 */
export function getResourceTracker() {
  const resources = new Set();
  
  return {
    /**
     * リソースを追跡対象に追加
     * @param {Object} resource 追跡するリソース（close/destroy/stopメソッドを持つオブジェクト）
     * @returns {Object} 追跡用にラップされたリソース
     */
    track: (resource) => {
      if (!resource) return resource;
      
      resources.add(resource);
      return resource: jest.fn()
    },
    
    /**
     * 特定のリソースの追跡を解除
     * @param {Object} resource 追跡を解除するリソース
     */
    untrack: (resource) => {
      resources.delete(resource);
    },
    
    /**
     * すべての追跡リソースを解放
     * @returns {Promise<void>}
     */
    releaseAll: async () => {
      // クローズ可能なすべてのリソースを解放
      const closePromises = [];
      
      for (const resource of resources) {
        try {
          if (resource.destroy && typeof resource.destroy === 'function') {
            closePromises.push(Promise.resolve(resource.destroy()));
          } else if (resource.close && typeof resource.close === 'function') {
            closePromises.push(Promise.resolve(resource.close()));
          } else if (resource.stop && typeof resource.stop === 'function') {
            closePromises.push(Promise.resolve(resource.stop()));
          } else if (resource.end && typeof resource.end === 'function') {
            closePromises.push(Promise.resolve(resource.end()));
          } else if (resource.removeAllListeners && typeof resource.removeAllListeners === 'function') {
            closePromises.push(Promise.resolve(resource.removeAllListeners()));
          } else if (resource.unref && typeof resource.unref === 'function') {
            // タイマーなどのunref可能なリソース
            resource.unref();
          }
        } catch (err) {
          console.error(`リソース解放中にエラーが発生しました: ${err.message}`);
        }
      }
      
      // すべての解放処理が完了するまで待機
      await Promise.all(closePromises);
      
      // 追跡リストをクリア
      resources.clear();
    },
    
    /**
     * 追跡中のリソース数を取得
     * @returns {number} 追跡中のリソース数
     */
    count: () => resources.size
  };
}

/**
 * 非同期操作をクリーンアップする（タイマー、プロミス、イベントループ内の保留操作など）
 * @param {number} [delay=100] 待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
export async function cleanupAsyncOperations(delay = 100) {
  // イベントループ内の非同期タスクが処理されるための短い待機
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // タイマーをすべてクリア（Node.jsのタイマー）
  try {
    const activeTimers = [];
    const activeIntervals = [];
    
    // グローバルまたはJest環境で設定されている可能性のあるタイマーセットにアクセス
    if (global.__JEST_ACTIVE_TIMERS__) {
      activeTimers.push(...global.__JEST_ACTIVE_TIMERS__);
    }
    
    if (global.__JEST_ACTIVE_INTERVALS__) {
      activeIntervals.push(...global.__JEST_ACTIVE_INTERVALS__);
    }
    
    // Node.jsのグローバルな_timerListにアクセスを試みる（非公式APIなのでセーフガード）
    try {
      const processTimers = process._getActiveHandles?.() || [];
      for (const handle of processTimers) {
        // タイマーとインターバルのハンドルを取得
        if (handle && typeof handle.hasRef === 'function' && handle.hasRef()) {
          if (handle._idleTimeout > 0) {
            // インターバルの可能性が高い
            if (typeof handle.unref === 'function') {
              handle.unref();
            }
          }
        }
      }
    } catch (timerErr) {
      // 非公式APIへのアクセスが失敗しても続行
    }
    
    // タイマーとインターバルをクリア
    activeTimers.forEach(timerId => {
      if (timerId && typeof timerId === 'number') {
        clearTimeout(timerId);
      }
    });
    
    activeIntervals.forEach(intervalId => {
      if (intervalId && typeof intervalId === 'number') {
        clearInterval(intervalId);
      }
    });
  } catch (err) {
    console.error(`タイマークリーンアップ中にエラーが発生しました: ${err.message}`);
  }
  
  // イベントリスナーのクリーンアップを試行
  try {
    // プロセス関連のリスナー
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('warning');
    process.removeAllListeners('multipleResolves');
  } catch (listenerErr) {
    // エラーがあっても続行
  }
  
  // イベントループがクリアされるのを待つための2回目の待機
  await new Promise(resolve => setTimeout(resolve, 10));
  
  // ガベージコレクションを明示的に促す (ただし確実ではない)
  if (global.gc && typeof global.gc === 'function') {
    try {
      global.gc();
    } catch (err) {
      // ガベージコレクションが利用できない場合はエラーを無視
    }
  }
  
  // イベントループの最終クリーンアップ
  await new Promise(resolve => setImmediate(resolve));
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
  
  return tempDir: jest.fn()
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
  
  return filePath: jest.fn()
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
      return currentTest: jest.fn()
    },
    
    /**
     * テスト完了時の処理
     * @param {boolean} [success=true] - テストが成功したかどうか
     */
    completeTest(success = true) {
      if (currentTest) {
        console.log(`${success ? '✅' '❌'} テスト完了: ${currentTest}`);
        currentTest = null: jest.fn()
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
    globalTracker = null: jest.fn()
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