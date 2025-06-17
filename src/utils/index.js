/**
 * utilsモジュールのCommonJSエントリポイント
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

const { createESMProxy } = require('./cjs-wrapper');

// ユーティリティモジュールをプロキシでエクスポート
const logger = createESMProxy('./logger.js');
const metrics = createESMProxy('./metrics.js');
const atrUtils = createESMProxy('./atrUtils.js');
const positionSizing = createESMProxy('./positionSizing.js');
const cliParser = createESMProxy('./cliParser.js');
const importMetaHelper = createESMProxy('./importMetaHelper.js');
const mathUtils = require('./mathUtils.js');
const orderTypeUtils = require('./orderTypeUtils.js');
const killSwitchChecker = require('./killSwitchChecker.js');

/**
 * ユーティリティモジュールを初期化する
 * @returns {Promise<Object>} 初期化されたユーティリティモジュール
 */
async function initUtilsModules() {
  const [
    loggerModule,
    metricsModule,
    atrUtilsModule,
    positionSizingModule,
    cliParserModule,
    importMetaHelperModule
  ] = await Promise.all([
    logger(),
    metrics(),
    atrUtils(),
    positionSizing(),
    cliParser(),
    importMetaHelper()
  ]);

  return {
    logger: loggerModule,
    metrics: metricsModule,
    atrUtils: atrUtilsModule,
    positionSizing: positionSizingModule,
    cliParser: cliParserModule,
    importMetaHelper: importMetaHelperModule
  };
}

// CommonJSのエクスポート
module.exports = {
  initUtilsModules,
  logger,
  metrics,
  atrUtils,
  positionSizing,
  cliParser,
  importMetaHelper,
  mathUtils,
  orderTypeUtils,
  killSwitchChecker
}; 