/**
 * strategiesモジュールのCommonJSエントリポイント
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

const { createESMProxy } = require('../utils/cjs-wrapper');

// 戦略モジュールをプロキシでエクスポート
const trendFollowStrategy = createESMProxy('./trendFollowStrategy.js');
const meanReversionStrategy = createESMProxy('./meanReversionStrategy.js');
const donchianBreakoutStrategy = createESMProxy('./donchianBreakoutStrategy.js');

/**
 * 戦略モジュールを初期化する
 * @returns {Promise<Object>} 初期化された戦略モジュール
 */
async function initStrategyModules() {
  const [
    trendFollowStrategyModule,
    meanReversionStrategyModule,
    donchianBreakoutStrategyModule
  ] = await Promise.all([
    trendFollowStrategy(),
    meanReversionStrategy(),
    donchianBreakoutStrategy()
  ]);

  return {
    trendFollowStrategy: trendFollowStrategyModule,
    meanReversionStrategy: meanReversionStrategyModule,
    donchianBreakoutStrategy: donchianBreakoutStrategyModule
  };
}

module.exports = {
  initStrategyModules,
  trendFollowStrategy,
  meanReversionStrategy,
  donchianBreakoutStrategy
}; 