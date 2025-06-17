/**
 * import.meta ポリフィル
 * CommonJS環境で import.meta.url を使用可能にするためのポリフィル
 * ESM移行中の互換性維持のために使用
 * @module utils/import-meta-polyfill
 */

// CommonJS環境の場合のみポリフィルを適用
if (typeof import.meta === 'undefined') {
  const path = require('path');
  
  // グローバルにimportオブジェクトを定義
  global.import = {
    meta: {
      // 現在のファイルへのURLスタイルパス
      url: `file://${__filename}`,
      
      // パス解決ヘルパー
      resolve: (specifier) => path.resolve(__dirname, specifier)
    }
  };
  
  console.debug('import.meta polyfill has been applied');
}

// 現在の実行環境がCommonJSかESMかを検出
const isESM = typeof import.meta !== 'undefined';

/**
 * 現在の実行環境がESMかどうかを返す
 * @returns {boolean} ESM環境ならtrue、CommonJS環境ならfalse
 */
function isESMEnvironment() {
  return isESM;
}

/**
 * 現在のファイルパスを取得
 * ESM環境とCommonJS環境の両方で動作
 * @returns {string} 現在のファイルの絶対パス
 */
function getCurrentFilePath() {
  if (isESM) {
    // ESM環境での実装
    const { fileURLToPath } = require('url');
    return fileURLToPath(import.meta.url);
  } else {
    // CommonJS環境での実装
    return __filename;
  }
}

/**
 * 現在のディレクトリパスを取得
 * ESM環境とCommonJS環境の両方で動作
 * @returns {string} 現在のディレクトリの絶対パス
 */
function getCurrentDirPath() {
  if (isESM) {
    // ESM環境での実装
    const { fileURLToPath } = require('url');
    const { dirname } = require('path');
    return dirname(fileURLToPath(import.meta.url));
  } else {
    // CommonJS環境での実装
    return __dirname;
  }
}

// CommonJS環境で使用するためにエクスポート
module.exports = {
  isESMEnvironment,
  getCurrentFilePath,
  getCurrentDirPath
}; 