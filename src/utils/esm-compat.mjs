/**
 * esm-compat.mjs
 * ESM環境でCommonJSモジュールを使用するための互換性ヘルパー
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// CommonJS互換のrequire関数
export const require = createRequire(import.meta.url);

// __filename, __dirnameの互換実装
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

/**
 * CommonJSモジュールのデフォルトエクスポートを取得
 * @param {Object} module モジュールオブジェクト
 * @returns {any} デフォルトエクスポート
 */
export const getDefaultExport = (module) => {
  return module.default || module;
};

/**
 * ESMからCommonJSモジュールをロードする
 * @param {string} modulePath モジュールパス
 * @returns {Promise<any>} ロードされたモジュール
 */
export async function importCJS(modulePath) {
  const module = require(modulePath);
  return module;
}

/**
 * ディレクトリパスを正規化する
 * @param {string} importMetaUrl import.meta.url
 * @param {string} relativePath 相対パス
 * @returns {string} 正規化されたパス
 */
export function resolveDir(importMetaUrl, relativePath = '.') {
  return path.dirname(fileURLToPath(importMetaUrl)) + '/' + relativePath;
} 