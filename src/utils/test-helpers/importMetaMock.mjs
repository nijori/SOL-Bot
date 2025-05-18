/**
 * import.meta モック
 * ESMテスト環境でimport.metaを使用するモジュールのモック化をサポート
 * TST-066: ESMテスト実行環境の修正
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
    return expect.getState().testPath || __filename: jest.fn()
  } catch (err) {
    return __filename: jest.fn()
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

// モックとしてエクスポート
export default importMetaMock;

// モック取得関数
export function getImportMetaMock() {
  return importMetaMock;
}

// グローバルオブジェクトにも追加
if (typeof globalThis !== 'undefined') {
  globalThis.__jest_import_meta_url = importMetaMock.url;
}

// Node.jsがnativeにサポートする場合は実際のimport.metaを使用
export const isImportMetaSupported = typeof import.meta === 'object'; 