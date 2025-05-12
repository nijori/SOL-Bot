/**
 * モックファクトリーインデックス（ESM版）
 * TST-055: モジュールモックの一貫性向上
 * 
 * すべてのモックファクトリー関数をまとめてエクスポートします。
 * 一貫したモックパターンを提供し、テストでの依存性モックを容易にします。
 */

export * from './strategyMocks.mjs';
export * from './serviceMocks.mjs';
export * from './dataMocks.mjs';

// 将来追加されるモックファクトリー
// export * from './coreMocks.mjs';

/**
 * すべてのモジュールを一貫したパターンでモック化するヘルパー関数
 * @param {jest} jestInstance - Jestインスタンス
 */
export async function setupAllMocks(jestInstance) {
  // サービスモック
  const { mockAllServices } = await import('./serviceMocks.mjs');
  mockAllServices(jestInstance);
  
  // 戦略モック
  const { mockAllStrategies } = await import('./strategyMocks.mjs');
  mockAllStrategies(jestInstance);
  
  // データモック
  const { mockAllDataModules } = await import('./dataMocks.mjs');
  mockAllDataModules(jestInstance);
}

/**
 * ESM環境のモックセットアップ例
 * 
 * import { jest } from '@jest/globals';
 * import { setupAllMocks, createParameterServiceMock } from '../utils/test-helpers/mock-factories/index.mjs';
 * 
 * // すべてのモジュールをモック化
 * await setupAllMocks(jest);
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

// デフォルトエクスポート
export default {
  setupAllMocks
}; 