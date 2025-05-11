/**
 * import.meta モック (ESM版)
 * REF-034: テスト実行環境の最終安定化
 * 
 * ESM環境での import.meta をモックするためのヘルパー
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { expect } from '@jest/globals';

// 現在のファイルの__dirnameを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * テスト実行時のファイルパスを取得
 * @returns {string} テストファイルのパス
 */
function getTestFilePath() {
  try {
    return expect.getState().testPath || __filename;
  } catch (err) {
    return __filename;
  }
}

/**
 * import.meta オブジェクトのモック
 */
const importMetaMock = {
  // import.meta.url のモック
  get url() {
    // テスト呼び出し元の位置を取得しファイルURLを生成
    const testFile = getTestFilePath();
    return `file://${path.resolve(testFile).replace(/\\/g, '/')}`;
  },
  
  // import.meta.resolve のモック
  resolve(specifier) {
    // 相対パスをファイルURLに変換
    const testDir = path.dirname(getTestFilePath());
    return `file://${path.resolve(testDir, specifier).replace(/\\/g, '/')}`;
  }
};

export default importMetaMock; 