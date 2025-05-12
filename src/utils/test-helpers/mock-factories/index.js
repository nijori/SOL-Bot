/**
 * モックファクトリーインデックス（CommonJS版）
 * TST-055: モジュールモックの一貫性向上
 * 
 * すべてのモックファクトリー関数をまとめてエクスポートします。
 * 一貫したモックパターンを提供し、テストでの依存性モックを容易にします。
 */

const strategyMocks = require('./strategyMocks');
const serviceMocks = require('./serviceMocks');
const dataMocks = require('./dataMocks');

// 将来追加されるモックファクトリー
// const coreMocks = require('./coreMocks');

// 各モジュールからのエクスポートをマージ
const allMocks = {
  ...strategyMocks,
  ...serviceMocks,
  ...dataMocks,
  // ...coreMocks (将来追加予定)
};

/**
 * すべてのモジュールを一貫したパターンでモック化するヘルパー関数
 * @param {jest} jestInstance - Jestインスタンス
 */
function setupAllMocks(jestInstance) {
  // サービスモック
  serviceMocks.mockAllServices(jestInstance);
  
  // 戦略モック
  strategyMocks.mockAllStrategies(jestInstance);
  
  // データモック
  dataMocks.mockAllDataModules(jestInstance);
}

/**
 * CommonJS環境のモックセットアップ例
 * 
 * const { setupAllMocks, createParameterServiceMock } = require('../utils/test-helpers/mock-factories');
 * 
 * // すべてのモジュールをモック化
 * setupAllMocks(jest);
 * 
 * // または個別にモックを作成
 * const mockParameterService = createParameterServiceMock({
 *   'customParameter': 'customValue'
 * });
 * 
 * jest.mock('../../config/parameterService.js', () => ({
 *   parameterService: mockParameterService
 * }));
 */

// マージしたオブジェクトと追加関数をエクスポート
module.exports = {
  ...allMocks,
  setupAllMocks
}; 