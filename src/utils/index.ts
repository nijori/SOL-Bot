/**
 * utilsモジュールのTypeScriptエントリポイント
 * 
 * TST-051: テスト環境のビルド出力問題解決の一部
 */

const loggerModule = require('./logger').default;
const atrUtilsModule = require('./atrUtils');
const positionSizingModule = require('./positionSizing');
const orderUtilsModule = require('./orderUtils');
const orderTypeUtilsModule = require('./orderTypeUtils');
const mathUtilsModule = require('./mathUtils');
const { CliParser: CliParserClass } = require('./cliParser');
const metricsModule = require('./metrics').default;
const { MemoryMonitor: MemoryMonitorClass } = require('./memoryMonitor');
const atrCalibratorModule = require('./atrCalibrator');

// CommonJSエクスポート
module.exports = {
  logger: loggerModule,
  atrUtils: atrUtilsModule,
  positionSizing: positionSizingModule,
  orderUtils: orderUtilsModule,
  orderTypeUtils: orderTypeUtilsModule,
  mathUtils: mathUtilsModule,
  CliParser: CliParserClass,
  metrics: metricsModule,
  MemoryMonitor: MemoryMonitorClass,
  atrCalibrator: atrCalibratorModule
};

// デフォルトエクスポート（CommonJS互換）
module.exports.default = module.exports; 