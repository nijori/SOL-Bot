/**
 * ESMテスト環境セットアップスクリプト
 * REF-030: JestのESM関連設定調整
 */

const fs = require('fs');
const path = require('path');

/**
 * ESMテスト環境のセットアップ
 */
module.exports = async function() {
  // テスト実行用の環境変数を設定
  process.env.NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';
  
  // テスト用の一時ディレクトリを作成
  const rootDir = path.resolve(__dirname, '..');
  const tempTestDir = path.join(rootDir, '.temp-test');
  
  if (!fs.existsSync(tempTestDir)) {
    fs.mkdirSync(tempTestDir, { recursive: true });
  }
  
  // テスト環境情報をコンソールに出力
  console.log('\n🧪 テスト環境をセットアップしています...');
  console.log(`📂 一時ディレクトリ: ${tempTestDir}`);
  console.log(`🔧 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🔧 NODE_OPTIONS: ${process.env.NODE_OPTIONS || '(未設定)'}`);
  
  // import.metaモックファイルの存在確認
  const importMetaMockPath = path.join(rootDir, 'src', 'utils', 'test-helpers', 'importMetaMock.js');
  if (fs.existsSync(importMetaMockPath)) {
    console.log('✅ import.metaモックファイルが見つかりました');
  } else {
    console.warn('⚠️ import.metaモックファイルが見つかりません');
  }
  
  // グローバル変数をセットアップ
  global.__TEST_ROOT__ = rootDir;
  global.__TEMP_TEST_DIR__ = tempTestDir;
  
  return {
    tempTestDir
  };
};
