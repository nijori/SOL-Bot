/**
 * coreモジュールのCommonJSエントリポイント
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

const { createESMProxy } = require('../utils/cjs-wrapper');

// coreモジュールをプロキシでエクスポート
const tradingEngine = createESMProxy('./tradingEngine.js');
const backtestRunner = createESMProxy('./backtestRunner.js');
const orderManagementSystem = createESMProxy('./orderManagementSystem.js');
const types = createESMProxy('./types.js');

/**
 * コアモジュールを初期化する
 * @returns {Promise<Object>} 初期化されたコアモジュール
 */
async function initCoreModules() {
  const [
    tradingEngineModule,
    backtestRunnerModule,
    omsModule,
    typesModule
  ] = await Promise.all([
    tradingEngine(),
    backtestRunner(),
    orderManagementSystem(),
    types()
  ]);

  return {
    tradingEngine: tradingEngineModule,
    backtestRunner: backtestRunnerModule,
    orderManagementSystem: omsModule,
    types: typesModule
  };
}

module.exports = {
  initCoreModules,
  tradingEngine,
  backtestRunner,
  orderManagementSystem,
  types
}; 