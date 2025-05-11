/**
 * strategiesモジュールのESMエントリポイント
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

// 戦略モジュールのエクスポート
export { TrendFollowStrategy } from './trendFollowStrategy.js';
export { MeanReversionStrategy } from './meanReversionStrategy.js';
export { DonchianBreakoutStrategy } from './donchianBreakoutStrategy.js';

// ESMからCommonJSモジュールをロードするヘルパー
export { require, __filename, __dirname } from '../utils/esm-compat.mjs';

// デフォルトエクスポート
export default {
  TrendFollowStrategy: './trendFollowStrategy.js',
  MeanReversionStrategy: './meanReversionStrategy.js',
  DonchianBreakoutStrategy: './donchianBreakoutStrategy.js'
}; 