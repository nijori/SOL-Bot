/**
 * import.meta モック
 * REF-034: テスト実行環境の最終安定化
 * 
 * CommonJS環境で import.meta を使用しているコードをモックするためのヘルパー
 */

const path = require('path');

/**
 * import.meta.url のモック
 */
module.exports = {
  __esModule: true,
  
  // import.meta.url のモック
  get url() {
    // テスト呼び出し元の位置を取得しファイルURLを生成
    const testFile = expect.getState().testPath || __filename;
    return `file://${path.resolve(testFile).replace(/\\/g, '/')}`;
  },
  
  // import.meta.resolve のモック
  resolve(specifier) {
    // 簡易実装: 相対パスをファイルURLに変換
    const testDir = path.dirname(expect.getState().testPath || __filename);
    return `file://${path.resolve(testDir, specifier).replace(/\\/g, '/')}`;
  }
}; 