/**
 * strategiesモジュールのCommonJSエントリポイント
 * 
 * INF-032-2: 戦略ディレクトリのCommonJS変換
 */

// 戦略モジュールを直接インポート
const TrendStrategy = require('./trendStrategy');
const TrendFollowStrategy = require('./trendFollowStrategy');
const MeanReversionStrategy = require('./meanReversionStrategy');
const MeanRevertStrategy = require('./meanRevertStrategy');
const RangeStrategy = require('./rangeStrategy');
const DonchianBreakoutStrategy = require('./DonchianBreakoutStrategy');

/**
 * すべての戦略モジュールをエクスポート
 */
module.exports = {
  TrendStrategy,
  TrendFollowStrategy,
  MeanReversionStrategy,
  MeanRevertStrategy,
  RangeStrategy,
  DonchianBreakoutStrategy,
  
  // 後方互換性のために従来の命名も維持
  trendFollowStrategy: TrendFollowStrategy,
  meanReversionStrategy: MeanReversionStrategy,
  donchianBreakoutStrategy: DonchianBreakoutStrategy
}; 