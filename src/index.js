/**
 * index.js
 * SOL-Bot CommonJS エントリポイント
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

// このファイルはCommonJSモジュールとして機能し、ESMモジュールをラップして提供します
const { createESMProxy } = require('./utils/cjs-wrapper');

// コアモジュールのプロキシをエクスポート
const tradingEngine = createESMProxy('./core/tradingEngine.js');
const backtestRunner = createESMProxy('./core/backtestRunner.js');
const orderManagementSystem = createESMProxy('./core/orderManagementSystem.js');
const types = createESMProxy('./core/types.js');

// 戦略モジュールのプロキシをエクスポート
const trendFollowStrategy = createESMProxy('./strategies/trendFollowStrategy.js');
const meanReversionStrategy = createESMProxy('./strategies/meanReversionStrategy.js');
const donchianBreakoutStrategy = createESMProxy('./strategies/DonchianBreakoutStrategy.js');

// ユーティリティモジュールのプロキシをエクスポート
const atrUtils = createESMProxy('./utils/atrUtils.js');
const positionSizing = createESMProxy('./utils/positionSizing.js');
const logger = createESMProxy('./utils/logger.js');

// サービスモジュールのプロキシをエクスポート
const exchangeService = createESMProxy('./services/exchangeService.js');

/**
 * 非同期でモジュールをロードするヘルパー関数
 * @returns {Promise<Object>} ロードされたモジュール
 */
async function initModules() {
  // すべてのモジュールを並列にロード
  await Promise.all([
    tradingEngine(),
    backtestRunner(),
    orderManagementSystem(),
    types(),
    trendFollowStrategy(),
    meanReversionStrategy(),
    donchianBreakoutStrategy(),
    atrUtils(),
    positionSizing(),
    logger(),
    exchangeService()
  ]);
  
  console.log('SOL-Bot modules loaded successfully in CommonJS mode');
  
  return {
    tradingEngine,
    backtestRunner,
    orderManagementSystem,
    types,
    strategies: {
      trendFollowStrategy,
      meanReversionStrategy,
      donchianBreakoutStrategy
    },
    utils: {
      atrUtils,
      positionSizing,
      logger
    },
    services: {
      exchangeService
    }
  };
}

// エクスポート
module.exports = {
  initModules,
  tradingEngine,
  backtestRunner,
  orderManagementSystem,
  types,
  strategies: {
    trendFollowStrategy,
    meanReversionStrategy,
    donchianBreakoutStrategy
  },
  utils: {
    atrUtils,
    positionSizing,
    logger
  },
  services: {
    exchangeService
  }
}; 