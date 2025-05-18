/**
 * ESM用Jest設定ファイル
 * ESMモードでテスト環境を安定化させるための設定
 * REF-034: テスト実行環境の最終安定化
 * TST-057: ESMテスト環境の修正と安定化
 * TST-060: Jest実行タイムアウトとクリーンアップ処理の最適化
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  // テストのルートディレクトリ
  rootDir: '.',

  // テスト環境
  testEnvironment: 'node',
  
  // ESMモードを有効化
  extensionsToTreatAsEsm: ['.ts'],
  
  // .mjsファイルのみをテスト対象とする
  testMatch: [
    '**/src/__tests__/**/*.test.mjs'
  ],
  
  // テスト環境のセットアップファイル
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup-jest.mjs'
  ],
  
  // TypeScriptファイルの変換
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true,
      useESM: true
    }],
    '^.+\\.mjs$': ['ts-jest', {
      isolatedModules: true,
      useESM: true
    }]
  },
  
  // モジュール解決の設定
  moduleNameMapper: {
    // .js拡張子が含まれるインポートを処理（例：import from './math.js'）
    '^(\\.\\.?/.*)\\.js$': '$1',
    // 相対パスの拡張子省略に対応
    '^(\\.\\.?/.*)$': [
      '$1.js',
      '$1.mjs',
      '$1/index.js',
      '$1'
    ],
    // import.metaを含むコードのモック
    '.*import\\.meta.*': '<rootDir>/src/utils/test-helpers/importMetaMock.mjs'
  },
  
  // モジュールファイル拡張子
  moduleFileExtensions: ['ts', 'js', 'json', 'mjs'],
  
  // テストから除外するパターン
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__broken_mjs__/' // 破損したテストファイルを一時的に除外
  ],
  
  // テストのタイムアウト
  testTimeout: 180000,
  
  // 詳細なログ
  verbose: true,
  
  // 変換を無視するパターン - ESMモジュールをサポート
  transformIgnorePatterns: [
    'node_modules/(?!(source-map|duckdb|ccxt|technicalindicators)/)'
  ],
  
  // テスト環境オプション
  testEnvironmentOptions: {
    // リソース制限
    resourceLimits: {
      maxOldGenerationSizeMb: 4096
    }
  },
  
  // テスト実行後にオープンハンドルを検出する
  detectOpenHandles: true,
  
  // メモリリーク検出を無効化（安定性優先）
  detectLeaks: false,
  
  // テスト終了時の強制終了を有効化（ハングを防止）
  forceExit: true,
  
  // ESM環境でのJest設定
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
}; 