/**
 * utilsモジュールのESMエントリポイント
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

// REF-031対応: CommonJS/ESM両環境で使用可能なインデックスファイル

// CommonJS形式で定義されている各ユーティリティをESMで再エクスポート
export { default as logger } from './logger.js';
export { default as metrics } from './metrics.js';
export * from './atrUtils.js';
export * from './mathUtils.js';
export * from './orderTypeUtils.js';
export * from './positionSizing.js';
export * from './killSwitchChecker.js';
export { CliParser } from './cliParser.js';
export * from './importMetaHelper.js';

// memoryMonitorはデフォルトエクスポートのため個別にエクスポート
import memoryMonitor from './memoryMonitor.js';
export { memoryMonitor };

// REF-031対応: ESMからCommonJS向けのヘルパー関数を提供
export * from './esm-compat.mjs';

// ESMのみの特殊なユーティリティを必要に応じてここに追加
export const ESM_UTILITIES = {
  // 例: ESMのみで使用される関数
  isESMEnvironment: true,
  getModuleType: () => 'ESM'
};

// グループ化されたエクスポート（オプション）
export const utils = {
  logger,
  metrics,
  memoryMonitor,
  CliParser,
  ESM_UTILITIES
}; 