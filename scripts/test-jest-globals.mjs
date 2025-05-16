/**
 * Jestのグローバル関数をセットアップするヘルパースクリプト (ESM版)
 * TST-079: Jest環境設定とテスト実行スクリプトの改善
 * 
 * このスクリプトは、ESMテスト環境でJestのグローバル関数をグローバルスコープに設定します。
 */

// 動的インポートを使用してJestのグローバル関数を取得
async function setupJestGlobals() {
  try {
    // ESMダイナミックインポート
    const jestGlobals = await import('@jest/globals');
    
    // グローバルにJest関数を追加
    if (!globalThis.describe) globalThis.describe = jestGlobals.describe;
    if (!globalThis.test) globalThis.test = jestGlobals.test;
    if (!globalThis.expect) globalThis.expect = jestGlobals.expect;
    if (!globalThis.beforeAll) globalThis.beforeAll = jestGlobals.beforeAll;
    if (!globalThis.afterAll) globalThis.afterAll = jestGlobals.afterAll;
    if (!globalThis.beforeEach) globalThis.beforeEach = jestGlobals.beforeEach;
    if (!globalThis.afterEach) globalThis.afterEach = jestGlobals.afterEach;
    if (!globalThis.jest) globalThis.jest = jestGlobals.jest;
    
    console.log('✅ Jest関数をESM環境のグローバルスコープに設定しました');
    return true;
  } catch (error) {
    console.error('❌ Jest関数の設定中にエラーが発生しました:', error);
    return false;
  }
}

// グローバル関数のクリーンアップ
function cleanupJestGlobals() {
  try {
    // グローバルからJest関数を削除
    delete globalThis.describe;
    delete globalThis.test;
    delete globalThis.expect;
    delete globalThis.beforeAll;
    delete globalThis.afterAll;
    delete globalThis.beforeEach;
    delete globalThis.afterEach;
    delete globalThis.jest;
    
    console.log('✅ Jest関数をグローバルスコープから削除しました');
    return true;
  } catch (error) {
    console.error('❌ Jest関数のクリーンアップ中にエラーが発生しました:', error);
    return false;
  }
}

// ファイル実行時に自動的にセットアップを実行
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (!isMainModule) {
  await setupJestGlobals();
}

export {
  setupJestGlobals,
  cleanupJestGlobals
}; 