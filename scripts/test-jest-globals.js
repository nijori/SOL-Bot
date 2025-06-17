/**
 * Jestのグローバル関数をセットアップするヘルパースクリプト
 * TST-079: Jest環境設定とテスト実行スクリプトの改善
 * 
 * このスクリプトは、テスト実行前にJestのグローバル関数をグローバルスコープに設定し、
 * テスト実行後にクリーンアップします。CommonJSとESMの両方のテスト環境で使用できます。
 */

// CommonJS環境またはESM環境に応じて適切なロジックを実行
const isCommonJS = typeof require === 'function';

function setupJestGlobals() {
  try {
    // CommonJS環境の場合
    if (isCommonJS) {
      const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } = require('@jest/globals');
      
      // グローバルにJest関数を追加
      if (!global.describe) global.describe = describe;
      if (!global.test) global.test = test;
      if (!global.expect) global.expect = expect;
      if (!global.beforeAll) global.beforeAll = beforeAll;
      if (!global.afterAll) global.afterAll = afterAll;
      if (!global.beforeEach) global.beforeEach = beforeEach;
      if (!global.afterEach) global.afterEach = afterEach;
      if (!global.jest) global.jest = jest;
      
      console.log('✅ Jest関数をCommonJS環境のグローバルスコープに設定しました');
      return true;
    } 
    // ESM環境の場合（動的インポートを使用）
    else {
      console.log('⚠️ ESM環境ではscripts/test-jest-globals.mjsを使用してください');
      return false;
    }
  } catch (error) {
    console.error('❌ Jest関数の設定中にエラーが発生しました:', error);
    return false;
  }
}

function cleanupJestGlobals() {
  try {
    // グローバルからJest関数を削除
    if (isCommonJS) {
      delete global.describe;
      delete global.test;
      delete global.expect;
      delete global.beforeAll;
      delete global.afterAll;
      delete global.beforeEach;
      delete global.afterEach;
      delete global.jest;
      
      console.log('✅ Jest関数をグローバルスコープから削除しました');
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('❌ Jest関数のクリーンアップ中にエラーが発生しました:', error);
    return false;
  }
}

// モジュールがrequireされた場合はセットアップを実行
if (require.main !== module) {
  setupJestGlobals();
} else {
  // スクリプトが直接実行された場合はメッセージを表示
  console.log('このスクリプトはJestのセットアップファイルから require() で使用してください');
}

module.exports = {
  setupJestGlobals,
  cleanupJestGlobals
}; 