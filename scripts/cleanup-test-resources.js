/**
 * ESMテスト用リソースのクリーンアップスクリプト
 * REF-030: JestのESM関連設定調整
 * TST-054: テスト安定性強化対応
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * テスト用リソースのクリーンアップ
 * @returns {Promise<void>} クリーンアップ完了を示すPromise
 */
module.exports = async function cleanupTestResources() {
  console.log('🧹 テストリソースのクリーンアップを開始します...');
  const startTime = Date.now();
  
  // クリーンアップログの保存先
  const logFile = process.env.TEST_LOG_FILE || path.join('logs', 'test', `cleanup-${Date.now()}.log`);
  const logDir = path.dirname(logFile);
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // ログ関数
  const log = (message) => {
    console.log(message);
    try {
      fs.appendFileSync(logFile, message + '\n', 'utf8');
    } catch (err) {
      // ログ書き込みエラーは無視
    }
  };
  
  try {
    const rootDir = path.resolve(__dirname, '..');
    const tempDirs = [
      path.join(rootDir, '.temp-test'),     // 一時テストディレクトリ
      path.join(rootDir, '.jest-cache'),    // Jestキャッシュ
      path.join(rootDir, 'data', 'test'),   // テストデータ
      path.join(os.tmpdir(), 'sol-bot-test') // システム一時ディレクトリ内のテスト用ファイル
    ];
    
    // データベースハンドルのクリーンアップ
    log('💾 データベースハンドルのクリーンアップ中...');
    try {
      if (global.__DB_CLEANUP__ && typeof global.__DB_CLEANUP__ === 'function') {
        await global.__DB_CLEANUP__();
        log('✅ データベースハンドルをクローズしました');
      }
    } catch (err) {
      log(`⚠️ データベースクリーンアップエラー: ${err.message}`);
    }
    
    // 一時ファイルの削除
    log('🗑️ 一時ファイルのクリーンアップ中...');
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        try {
          // ディレクトリ内のファイルを削除
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            
            try {
              const stat = fs.statSync(filePath);
              if (stat.isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(filePath);
              }
            } catch (err) {
              log(`⚠️ ファイル削除エラー: ${filePath} - ${err.message}`);
            }
          }
          
          // ディレクトリが空になったら削除
          try {
            fs.rmdirSync(dir, { recursive: false });
            log(`✅ ディレクトリを削除しました: ${dir}`);
          } catch (err) {
            log(`ℹ️ ディレクトリは削除せず保持します: ${dir}`);
          }
        } catch (err) {
          log(`⚠️ ディレクトリクリーンアップエラー: ${dir} - ${err.message}`);
        }
      }
    }
    
    // タイマーのクリーンアップ
    log('⏱️ タイマーのクリーンアップ中...');
    if (global.__TEST_TIMERS__ && Array.isArray(global.__TEST_TIMERS__)) {
      global.__TEST_TIMERS__.forEach(timerId => {
        try {
          clearTimeout(timerId);
          clearInterval(timerId);
        } catch (err) {
          // タイマーIDが無効の場合はエラーを無視
        }
      });
      log(`✅ ${global.__TEST_TIMERS__.length}個のタイマーをクリーンアップしました`);
      global.__TEST_TIMERS__ = [];
    }
    
    // イベントリスナーのクリーンアップ
    log('📡 イベントリスナーのクリーンアップ中...');
    if (global.__TEST_EVENT_EMITTERS__ && Array.isArray(global.__TEST_EVENT_EMITTERS__)) {
      global.__TEST_EVENT_EMITTERS__.forEach(emitter => {
        try {
          emitter.removeAllListeners();
        } catch (err) {
          log(`⚠️ イベントエミッタークリーンアップエラー: ${err.message}`);
        }
      });
      log(`✅ ${global.__TEST_EVENT_EMITTERS__.length}個のイベントエミッターをクリーンアップしました`);
      global.__TEST_EVENT_EMITTERS__ = [];
    }
    
    // 未使用のオープンハンドルの警告
    if (global.__HANDLES_DETECTOR && typeof global.__HANDLES_DETECTOR.report === 'function') {
      log('🔍 未使用のオープンハンドル検出中...');
      global.__HANDLES_DETECTOR.report();
      global.__HANDLES_DETECTOR.reset();
    }
    
    // リソーストラッカーのクリーンアップ
    if (global.__RESOURCE_TRACKER && typeof global.__RESOURCE_TRACKER.cleanup === 'function') {
      log('🧹 リソーストラッカーによるクリーンアップ中...');
      await global.__RESOURCE_TRACKER.cleanup();
      log('✅ リソーストラッカーによるクリーンアップ完了');
    }
    
    const elapsedTime = Date.now() - startTime;
    log(`✅ テストリソースのクリーンアップが完了しました (${elapsedTime}ms)`);
    return true;
  } catch (err) {
    log(`❌ テストリソースのクリーンアップ中にエラーが発生しました: ${err.stack || err}`);
    return false;
  }
};
