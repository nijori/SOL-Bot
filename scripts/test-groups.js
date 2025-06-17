/**
 * テストグループ分類設定
 * TST-084: テスト実行スクリプト統合
 * 
 * このファイルはテストファイルをグループに分類し、
 * テスト実行の効率化と結果の可視化を支援します。
 */

// テストグループの定義
const TEST_GROUPS = {
  // 高速グループ (< 3秒/テスト)
  fast: [
    'src/__tests__/utils',
    'src/__tests__/config',
    'src/__tests__/indicators'
  ],
  
  // 中速グループ (3-10秒/テスト)
  medium: [
    'src/__tests__/strategies',
    'src/__tests__/services/!(symbolInfoService|MultiTimeframeDataFetcher).test.ts'
  ],
  
  // 低速グループ (10-30秒/テスト)
  slow: [
    'src/__tests__/services/symbolInfoService.test.ts',
    'src/__tests__/services/MultiTimeframeDataFetcher.test.ts'
  ],
  
  // 特に重いテスト (30秒以上/テスト)
  heavy: [
    'src/__tests__/data/RealTimeDataProcessor.test.ts'
  ],
  
  // コア機能テスト
  core: [
    'src/__tests__/core'
  ],
  
  // ESMテスト用
  esm: [
    'src/__tests__/**/*.test.mjs',
    'src/__tests__/esm-*.test.mjs'
  ]
};

// テストグループごとの設定
const GROUP_CONFIG = {
  fast: {
    timeout: 10000,  // 10秒
    detectOpenHandles: true
  },
  medium: {
    timeout: 30000,  // 30秒
    detectOpenHandles: true
  },
  slow: {
    timeout: 60000,  // 1分
    detectOpenHandles: true
  },
  heavy: {
    timeout: 300000, // 5分
    detectOpenHandles: true,
    runInBand: true, // 直列実行
    testPathIgnorePatterns: [
      'イベント通知' // 特定のテストをスキップ
    ]
  },
  core: {
    timeout: 120000, // 2分
    detectOpenHandles: true
  },
  esm: {
    timeout: 180000, // 3分
    forceExit: true,
    experimental: true
  }
};

// グループ別のベースライン実行時間（秒）
const BASELINE_TIMES = {
  fast: 35,      // 35秒
  medium: 120,   // 2分
  slow: 180,     // 3分
  heavy: 300,    // 5分
  core: 150,     // 2分30秒
  esm: 120,      // 2分
  total: 900     // 15分 (すべてのテストを順次実行)
};

module.exports = {
  TEST_GROUPS,
  GROUP_CONFIG,
  BASELINE_TIMES
}; 