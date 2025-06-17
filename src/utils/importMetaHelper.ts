/**
 * import.meta互換ヘルパーユーティリティ (TST-052対応)
 * 
 * CommonJSとESMの両方の環境で動作する互換性レイヤーを提供します。
 * tsconfig.build.jsonのmodule=commonjsでもimport.metaに依存するコードを動作させます。
 * 
 * INF-032: CommonJS形式への変換
 */

import * as path from 'path';
import * as url from 'url';

/**
 * 実行環境がESMかどうかを判定
 * @returns {boolean} ESM環境の場合はtrue、CommonJS環境の場合はfalse
 */
const isEsmEnvironment = () => {
  // 環境変数による強制設定
  if (process.env.FORCE_ESM === 'true') return true;
  if (process.env.FORCE_CJS === 'true') return false;

  // ファイル拡張子による判定
  if (typeof process !== 'undefined' && process.argv[1]) {
    if (process.argv[1].endsWith('.mjs')) return true;
    if (process.argv[1].endsWith('.cjs')) return false;
  }

  // __esModuleフラグによる判定
  if (typeof (global as any).__ESM_ENVIRONMENT !== 'undefined') {
    return !!(global as any).__ESM_ENVIRONMENT;
  }

  // requireの存在チェック
  return typeof require === 'undefined';
};

/**
 * 現在実行中のスクリプトのファイルURLを取得
 * CommonJS環境ではファイルパスから構築、ESM環境ではimport.meta.urlから取得
 * @returns {string} 現在のスクリプトのURL
 */
function getCurrentFileUrl() {
  // ESM環境では直接import.meta.urlを返す 
  if (isEsmEnvironment()) {
    try {
      // Dynamic import.meta access to avoid static parse errors in CommonJS
      // Use Function constructor to avoid direct parsing of import.meta
      return new Function('return import.meta.url')();
    } catch (e) {
      // フォールバック: process.argv[1]からURLを構築
      return url.pathToFileURL(process.argv[1] || '').toString();
    }
  }
  
  // CommonJS環境: __filenameまたはprocess.argv[1]からURLを構築
  let filename = '';
  
  // __filenameがCommonJSで利用可能な場合
  try {
    // TypeScriptではエラーになるためtry-catchで回避
    if (typeof __filename !== 'undefined') {
      filename = __filename;
    }
  } catch (e) {
    // __filenameが存在しない場合は何もしない
  }
  
  // __filenameが取得できなかった場合はprocess.argv[1]を使用
  if (!filename && process.argv[1]) {
    filename = process.argv[1];
  }
  
  return url.pathToFileURL(filename).toString();
}

/**
 * 現在のスクリプトが直接実行されているかどうかを判定
 * node scriptname.js として実行されているか、importされているかを区別
 * @returns {boolean} 直接実行の場合はtrue、importされている場合はfalse
 */
function checkIfMainModule() {
  // CommonJS環境での検出
  try {
    if (typeof require !== 'undefined' && typeof module !== 'undefined') {
      return require.main === module;
    }
  } catch (e) {
    // require/moduleが存在しない場合は何もしない
  }
  
  // ESM環境での検出
  if (isEsmEnvironment()) {
    try {
      const importMetaUrl = getCurrentFileUrl();
      const processArg = process.argv[1]?.replace(/\\/g, '/') || '';
      return importMetaUrl.endsWith(processArg);
    } catch (e) {
      // 取得できない場合はフォールバック
    }
  }
  
  // 環境判定できない場合はプロセス引数からの推測
  const currentPath = process.argv[1]?.replace(/\\/g, '/') || '';
  try {
    const scriptPath = url.fileURLToPath(getCurrentFileUrl()).replace(/\\/g, '/');
    return currentPath.endsWith(scriptPath) || scriptPath.endsWith(currentPath);
  } catch (e) {
    return false;
  }
}

/**
 * 相対パスを現在のファイルからの絶対パスに解決
 * @param {string} relativePath 現在のファイルからの相対パス
 * @returns {string} 絶対パス
 */
function resolvePathFromCurrent(relativePath: any) {
  const currentUrl = getCurrentFileUrl();
  const currentDir = path.dirname(url.fileURLToPath(currentUrl));
  return path.resolve(currentDir, relativePath);
}

/**
 * ファイルURLを絶対パスに変換
 * @param {string} fileUrl ファイルURL
 * @returns {string} 絶対パス
 */
function fileUrlToPath(fileUrl: any) {
  return url.fileURLToPath(fileUrl);
}

/**
 * パスをファイルURLに変換
 * @param {string} filePath ファイルパス
 * @returns {string} ファイルURL
 */
function pathToFileUrl(filePath: any) {
  return url.pathToFileURL(filePath).toString();
}

// Named exports (ESM)
export {
  isEsmEnvironment,
  getCurrentFileUrl,
  checkIfMainModule as isMainModule,
  resolvePathFromCurrent,
  fileUrlToPath,
  pathToFileUrl
};

// CommonJS形式でエクスポート
module.exports = {
  isEsmEnvironment,
  getCurrentFileUrl,
  isMainModule: checkIfMainModule,
  resolvePathFromCurrent,
  fileUrlToPath,
  pathToFileUrl
}; 