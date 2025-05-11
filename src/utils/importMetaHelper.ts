/**
 * import.meta互換ヘルパーユーティリティ (REF-031対応)
 * 
 * CommonJSとESMの両方の環境で動作する互換性レイヤーを提供します。
 * tsconfig.build.jsonのmodule=commonjsでもimport.metaに依存するコードを動作させます。
 */

import * as path from 'path';
import * as url from 'url';

/**
 * 現在実行中のスクリプトのファイルURLを取得
 * CommonJS環境ではファイルパスから構築、ESM環境ではimport.meta.urlから取得
 * @returns {string} 現在のスクリプトのURL
 */
export function getCurrentFileUrl(): string {
  // ESM環境では直接import.meta.urlを返す
  if (typeof (global as any).__ESM_ENVIRONMENT !== 'undefined' || 
      (typeof process !== 'undefined' && process.argv[1]?.endsWith('.mjs'))) {
    try {
      // @ts-ignore: ESM環境でのみ有効
      return import.meta.url;
    } catch (e) {
      // フォールバック: process.argv[1]からURLを構築
      return url.pathToFileURL(process.argv[1]).toString();
    }
  }
  
  // CommonJS環境: __filenameまたはprocess.argv[1]からURLを構築
  // TSC Hack: __filenameは型定義上存在しないため、anyで回避
  const filename = 
    typeof (global as any).__filename !== 'undefined' 
      ? (global as any).__filename 
      : process.argv[1] || '';
  
  return url.pathToFileURL(filename).toString();
}

/**
 * 現在のスクリプトが直接実行されているかどうかを判定
 * node scriptname.js として実行されているか、importされているかを区別
 * @returns {boolean} 直接実行の場合はtrue、importされている場合はfalse
 */
export function isMainModule(): boolean {
  try {
    // CommonJS環境での検出 (優先してチェック)
    if (typeof require !== 'undefined' && typeof module !== 'undefined') {
      return require.main === module;
    }
    
    // ESM環境での検出
    if (typeof (global as any).__ESM_ENVIRONMENT !== 'undefined') {
      try {
        // @ts-ignore: ESM環境でのみ有効
        const importMetaUrl = import.meta.url;
        const processArg = process.argv[1]?.replace(/\\/g, '/') || '';
        return importMetaUrl.endsWith(processArg);
      } catch (e) {
        // import.meta利用不可の場合はフォールバック
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
  } catch (e) {
    return false;
  }
}

/**
 * 相対パスを現在のファイルからの絶対パスに解決
 * @param {string} relativePath 現在のファイルからの相対パス
 * @returns {string} 絶対パス
 */
export function resolvePathFromCurrent(relativePath: string): string {
  const currentUrl = getCurrentFileUrl();
  const currentDir = path.dirname(url.fileURLToPath(currentUrl));
  return path.resolve(currentDir, relativePath);
}

/**
 * ファイルURLを絶対パスに変換
 * @param {string} fileUrl ファイルURL
 * @returns {string} 絶対パス
 */
export function fileUrlToPath(fileUrl: string): string {
  return url.fileURLToPath(fileUrl);
}

/**
 * パスをファイルURLに変換
 * @param {string} filePath ファイルパス
 * @returns {string} ファイルURL
 */
export function pathToFileUrl(filePath: string): string {
  return url.pathToFileURL(filePath).toString();
} 