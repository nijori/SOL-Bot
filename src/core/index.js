/**
 * core/index.js
 * SOL-Bot コアモジュール CommonJS エントリポイント
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

const { createESMProxy } = require('../utils/cjs-wrapper');

// コアモジュールのプロキシを作成
const tradingEngine = createESMProxy('../core/tradingEngine.js');
const backtestRunner = createESMProxy('../core/backtestRunner.js');
const orderManagementSystem = createESMProxy('../core/orderManagementSystem.js');
const types = createESMProxy('../core/types.js');
const multiSymbolTradingEngine = createESMProxy('../core/multiSymbolTradingEngine.js');
const multiSymbolBacktestRunner = createESMProxy('../core/multiSymbolBacktestRunner.js');

/**
 * 非同期でモジュールをロードするヘルパー関数
 * @returns {Promise<Object>} ロードされたモジュール
 */
async function initCoreModules() {
  // すべてのモジュールを並列にロード
  await Promise.all([
    tradingEngine(),
    backtestRunner(),
    orderManagementSystem(),
    types(),
    multiSymbolTradingEngine(),
    multiSymbolBacktestRunner()
  ]);
  
  console.log('SOL-Bot core modules loaded successfully in CommonJS mode');
  
  return {
    tradingEngine,
    backtestRunner,
    orderManagementSystem,
    types,
    multiSymbolTradingEngine,
    multiSymbolBacktestRunner
  };
}

// エクスポート
module.exports = {
  initCoreModules,
  tradingEngine,
  backtestRunner,
  orderManagementSystem,
  types,
  multiSymbolTradingEngine,
  multiSymbolBacktestRunner
}; 