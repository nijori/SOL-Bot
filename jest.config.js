/**
 * Jest設定ファイル
 * CommonJSモードでテスト環境を安定化させるための設定
 * REF-030: JestのESM関連設定調整
 * REF-034: テスト実行環境の最終安定化
 * TST-056: テスト実行時のメモリリーク問題の解決
 * TST-058: リソーストラッカーの無限ループ問題修正
 * TST-060: Jest実行タイムアウトとクリーンアップ処理の最適化
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  globals: { 
    'ts-jest': {
      isolatedModules: true
    }
  },
  transformIgnorePatterns: [
    "node_modules/(?!(ccxt|node-fetch|webdriver|selenium-webdriver)/)"
  ],
  setupFilesAfterEnv: ['./scripts/test-jest-globals.js'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  testMatch: ['**/__tests__/**/*.test.(ts|js)'],
  verbose: true,
  collectCoverage: false,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // ESMモジュール形式のテストファイル（.mjs）は除外する
  testPathIgnorePatterns: [
    "/node_modules/",
    "/__broken_mjs__/",
    "\\.mjs$"
  ],
  
  // モジュールパスマッピング
  moduleNameMapper: {
    // .js拡張子が省略されたインポートを処理
    '^(\\.\\.?/.*)\\.js$': '$1',
    // 相対パスの拡張子省略に対応
    '^(\\.\\.?/.*)$': [
      '$1.js',
      '$1.mjs',
      '$1/index.js',
      '$1'
    ],
    // import.metaを使用するモジュールのモック
    '.*import\\.meta.*': '<rootDir>/src/utils/test-helpers/importMetaMock.js'
  },
  
  // メモリリーク検出を無効化（安定性優先）
  detectLeaks: false,
  
  // テスト実行後にオープンハンドルを検出
  detectOpenHandles: true,
  
  // ワーカー数を制限（並列実行の最適化）
  maxWorkers: 2, // 重いテストが互いに干渉しないようにワーカー数を制限
  
  // テスト環境オプション
  testEnvironmentOptions: {
    // リソース制限
    resourceLimits: {
      maxOldGenerationSizeMb: 2048 // メモリ使用量を最適化（4096→2048）
    }
  },
  
  // 実行タイムアウトの設定
  globalSetup: null,
  globalTeardown: null,
  testRunner: 'jest-circus/runner',
  
  // 各テストの独立性を強化
  injectGlobals: false,  // グローバル変数の注入を最小化
  resetMocks: true,      // 各テスト後にモックをリセット
  restoreMocks: true,    // 各テスト後にモックを復元
  
  // キャッシュ設定の最適化
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  
  // タイマーのモック化を制御（'timers'から'fakeTimers'に更新）
  fakeTimers: {
    enableGlobally: false // リアルタイマーを使用（テスト中にタイマーをモック化しない）
  }
};