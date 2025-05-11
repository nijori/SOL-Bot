/**
 * utilsモジュールのESMエントリポイント
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

// ユーティリティモジュールのエクスポート
export { default as logger } from './logger.js';
export { default as metrics } from './metrics.js';
export * from './atrUtils.js';
export * from './positionSizing.js';
export { CliParser } from './cliParser.js';
export * from './importMetaHelper.js';

// ESM/CJS互換ヘルパーをエクスポート
export { 
  require, 
  __filename, 
  __dirname, 
  resolveDir, 
  resolveFilePath, 
  isESMEnvironment, 
  isMainModule 
} from './esm-compat.mjs';

// デフォルトエクスポート
export default {
  logger: './logger.js',
  metrics: './metrics.js',
  atrUtils: './atrUtils.js',
  positionSizing: './positionSizing.js',
  cliParser: './cliParser.js',
  importMetaHelper: './importMetaHelper.js',
  esmCompat: './esm-compat.mjs',
  cjsWrapper: './cjs-wrapper.js'
}; 