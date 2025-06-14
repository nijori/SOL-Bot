/**
 * モジュールヘルパー
 * INF-032: CommonJS形式への変換における循環参照問題を解決するためのヘルパーモジュール
 * 
 * 複数のモジュール間で共有される変数や関数を集約し、循環参照を解消する
 * グローバル状態管理としても機能する
 */

// 循環参照を避けるためのシングルトンインスタンス管理
const moduleRegistry = new Map();

/**
 * モジュールを登録
 * @param {string} name モジュール名
 * @param {any} instance モジュールインスタンス
 */
function registerModule(name: any, instance: any) {
  moduleRegistry.set(name, instance);
}

/**
 * モジュールを取得
 * @param {string} name モジュール名
 * @returns {any} モジュールインスタンス
 */
function getModule(name: any) {
  return moduleRegistry.get(name);
}

/**
 * モジュールが登録されているかチェック
 * @param {string} name モジュール名
 * @returns {boolean} 登録されている場合はtrue
 */
function hasModule(name: any) {
  return moduleRegistry.has(name);
}

/**
 * 循環参照を回避するための遅延初期化関数
 * @param {string} name モジュール名
 * @param {Function} factory モジュール生成関数
 * @returns {any} モジュールインスタンス
 */
function getOrCreateModule(name: any, factory: any) {
  if (!moduleRegistry.has(name)) {
    moduleRegistry.set(name, factory());
  }
  return moduleRegistry.get(name);
}

// グローバル設定
let isTestEnvironment = false;

/**
 * テスト環境かどうかを設定
 * @param {boolean} isTest テスト環境の場合はtrue
 */
function setTestEnvironment(isTest: any) {
  isTestEnvironment = isTest;
}

/**
 * テスト環境かどうかを取得
 * @returns {boolean} テスト環境の場合はtrue
 */
function isInTestEnvironment() {
  return isTestEnvironment;
}

// CommonJS形式でエクスポート
module.exports = {
  registerModule,
  getModule,
  hasModule,
  getOrCreateModule,
  setTestEnvironment,
  isInTestEnvironment
}; 