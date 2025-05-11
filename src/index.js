/**
 * CommonJSモジュールとして機能し、ESMモジュールをラップして提供するエントリポイント
 * 
 * REF-033: ESMとCommonJSの共存基盤構築の一部
 */

const { createESMProxy, convertESMtoCJS } = require('./utils/cjs-wrapper');

// 環境変数のロード (非同期の前に行う)
require('dotenv').config();

// コアモジュールのプロキシをエクスポート
const tradingEngine = createESMProxy('./core/tradingEngine.js');
const backtestRunner = createESMProxy('./core/backtestRunner.js');
const orderManagementSystem = createESMProxy('./core/orderManagementSystem.js');
const exchangeService = createESMProxy('./services/exchangeService.js');
const logger = createESMProxy('./utils/logger.js');

// 設定モジュール
const parameters = createESMProxy('./config/parameters.js');
const parameterService = createESMProxy('./config/parameterService.js');

// 戦略モジュール
const strategies = {
  trendFollowStrategy: createESMProxy('./strategies/trendFollowStrategy.js'),
  meanReversionStrategy: createESMProxy('./strategies/meanReversionStrategy.js'),
  donchianBreakoutStrategy: createESMProxy('./strategies/donchianBreakoutStrategy.js')
};

// ユーティリティモジュール
const utils = {
  logger: logger,
  metrics: createESMProxy('./utils/metrics.js'),
  cliParser: createESMProxy('./utils/cliParser.js')
};

// データ関連モジュール
const data = {
  dataService: createESMProxy('./data/dataService.js'),
  multiTimeframeDataFetcher: createESMProxy('./data/multiTimeframeDataFetcher.js')
};

// インジケーター関連モジュール
const indicators = {
  trendIndicators: createESMProxy('./indicators/trendIndicators.js'),
  volatilityIndicators: createESMProxy('./indicators/volatilityIndicators.js')
};

/**
 * 非同期ロード用のヘルパー関数
 * すべてのモジュールを並列にロードします
 * 
 * @returns {Promise<Object>} ロードされたモジュールを含むオブジェクト
 */
async function initModules() {
  // すべてのモジュールを並列にロード
  const [
    tradingEngineModule,
    backtestRunnerModule,
    omsModule,
    exchangeServiceModule,
    parametersModule,
    parameterServiceModule,
    loggerModule,
    metricsModule,
    trendFollowStrategyModule,
    meanReversionStrategyModule,
    donchianBreakoutStrategyModule
  ] = await Promise.all([
    tradingEngine(),
    backtestRunner(),
    orderManagementSystem(),
    exchangeService(),
    parameters(),
    parameterService(),
    logger(),
    utils.metrics(),
    strategies.trendFollowStrategy(),
    strategies.meanReversionStrategy(),
    strategies.donchianBreakoutStrategy()
  ]);

  return {
    tradingEngine: tradingEngineModule,
    backtestRunner: backtestRunnerModule,
    orderManagementSystem: omsModule,
    exchangeService: exchangeServiceModule,
    parameters: parametersModule,
    parameterService: parameterServiceModule,
    logger: loggerModule,
    metrics: metricsModule,
    strategies: {
      trendFollowStrategy: trendFollowStrategyModule,
      meanReversionStrategy: meanReversionStrategyModule,
      donchianBreakoutStrategy: donchianBreakoutStrategyModule
    }
  };
}

// モジュールをエクスポート
module.exports = {
  initModules,
  tradingEngine,
  backtestRunner,
  orderManagementSystem,
  exchangeService,
  parameterService,
  parameters,
  strategies,
  utils,
  data,
  indicators
}; 