/**
 * ESMテスト用リソースのクリーンアップスクリプト
 * REF-030: JestのESM関連設定調整
 */

const fs = require('fs');
const path = require('path');

/**
 * テスト用リソースのクリーンアップ
 */
module.exports = async function() {
  // 一時テストディレクトリをクリーンアップ
  try {
    const rootDir = path.resolve(__dirname, '..');
    const tempTestDir = path.join(rootDir, '.temp-test');
    
    if (fs.existsSync(tempTestDir)) {
      // ディレクトリ内のファイルを削除
      const files = fs.readdirSync(tempTestDir);
      for (const file of files) {
        const filePath = path.join(tempTestDir, file);
        
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn(`⚠️ 一時ファイルの削除に失敗しました: ${filePath}`);
        }
      }
      
      // ディレクトリ自体を削除
      try {
        fs.rmdirSync(tempTestDir, { recursive: true });
        console.log(`✅ 一時テストディレクトリを削除しました: ${tempTestDir}`);
      } catch (err) {
        console.warn(`⚠️ 一時テストディレクトリの削除に失敗しました: ${tempTestDir}`);
      }
    }
    
    // 未使用のオープンハンドルの警告
    if (global.__HANDLES_DETECTOR && typeof global.__HANDLES_DETECTOR.report === 'function') {
      global.__HANDLES_DETECTOR.report();
      global.__HANDLES_DETECTOR.reset();
    }
    
    console.log('🧹 テストリソースのクリーンアップが完了しました');
  } catch (err) {
    console.error('❌ テストリソースのクリーンアップ中にエラーが発生しました:', err);
  }
};
