/**
 * esm-compat.mjs
 * ESM環境でCommonJSモジュールを使用するための互換性ヘルパー
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * ESM環境でCommonJSの機能を使用するためのヘルパーユーティリティ
 * 
 * このモジュールを使用することで、ESM環境でCommonJSの機能（require, __dirname, __filename）を
 * 利用できるようになります。
 */

/**
 * CommonJS互換のrequire関数
 * ESMモジュール内でrequireを使用する必要がある場合に利用します。
 */
export const require = createRequire(import.meta.url);

/**
 * 現在のファイルの絶対パス（CommonJSの__filenameに相当）
 */
export const __filename = fileURLToPath(import.meta.url);

/**
 * 現在のディレクトリの絶対パス（CommonJSの__dirnameに相当）
 */
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

/**
 * import.meta.urlから特定のファイルへのパスを解決するヘルパー関数
 * 
 * @param {string} importMetaUrl - import.meta.urlの値
 * @param {string} relativeFilePath - 相対ファイルパス
 * @return {string} 解決されたファイルパス
 */
export function resolveFilePath(importMetaUrl, relativeFilePath) {
  return path.join(path.dirname(fileURLToPath(importMetaUrl)), relativeFilePath);
}

/**
 * ESM環境かCommonJS環境かを判定する関数
 * 
 * @return {boolean} ESM環境の場合はtrue、そうでない場合はfalse
 */
export function isESMEnvironment() {
  return typeof require === 'function' && typeof module === 'undefined';
}

/**
 * 現在の実行環境がモジュールのメインコンテキスト（直接実行）かどうかを判定
 * CommonJSの(require.main === module)に相当する機能
 * 
 * @param {string} importMetaUrl - import.meta.urlの値
 * @return {boolean} メインモジュールとして実行されている場合はtrue
 */
export function isMainModule(importMetaUrl) {
  if (!importMetaUrl) return false;
  
  const modulePath = fileURLToPath(importMetaUrl);
  // Node.jsのプロセス引数からメインモジュールのパスを取得
  const mainModulePath = process.argv[1];
  
  return modulePath === mainModulePath;
} 