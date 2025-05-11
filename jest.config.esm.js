/**
 * ESM用Jest設定ファイル
 * ESMモードでテスト環境を安定化させるための設定
 * REF-034: テスト実行環境の最終安定化
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // テストのルートディレクトリ
  rootDir: 'src',

  // テスト環境
  testEnvironment: 'node',
  
  // ESMモードを有効化 - .mjsは常にESMとして扱われるため含めない
  extensionsToTreatAsEsm: ['.ts'],
  
  // .mjsファイルのみをテスト対象とする
  testMatch: [
    '**/__tests__/**/*.test.mjs'
  ],
  
  // テスト環境のセットアップファイル
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/setup-jest.mjs'
  ],
  
  // TypeScriptファイルの変換
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true,
      useESM: true,
      transformerConfig: {
        hoistJestRequire: false,
        supportStaticESM: true,
        allowArbitraryExports: true
      }
    }],
    '^.+\\.mjs$': ['ts-jest', {
      isolatedModules: true,
      useESM: true
    }]
  },
  
  // モジュール解決の設定
  moduleNameMapper: {
    // .js拡張子の解決をサポート
    '^(\\.\\.?/.*)\\.js$': '$1',
    // import.metaを含むコードのモック
    '.*import\\.meta.*': '<rootDir>/utils/test-helpers/importMetaMock.mjs'
  },
  
  // モジュールファイル拡張子
  moduleFileExtensions: ['ts', 'js', 'json', 'mjs'],
  
  // テストから除外するパターン
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__broken_mjs__/', // 破損したテストファイルを一時的に除外
    '\\.spec\\.' // .spec.tsファイルはCommonJSモードのみでテスト
  ],
  
  // テストのタイムアウト
  testTimeout: 30000,
  
  // 詳細なログ
  verbose: true,
  
  // rootsの明示的な設定
  roots: ['<rootDir>'],
  
  // 変換を無視するパターン - ESMモジュールをサポート
  transformIgnorePatterns: [
    'node_modules/(?!(source-map|duckdb|ccxt|technicalindicators)/)'
  ],
  
  // テスト環境オプション
  testEnvironmentOptions: {
    // Node.jsオプション
    NODE_OPTIONS: '--experimental-vm-modules'
  },
  
  // モックのパス
  moduleDirectories: ['node_modules', '<rootDir>'],
  
  // モック自動リセット
  resetMocks: false,
  
  // Jest実行時の最大ワーカー数
  maxWorkers: '50%',
  
  // テストの実行順序をランダム化して依存関係を検出しやすくする
  randomize: true,
  
  // テスト実行後にオープンハンドルを検出する
  detectOpenHandles: true,
  
  // メモリリーク検出を無効化（安定性優先）
  detectLeaks: false,
  
  // ファイル変更監視の設定
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/'
  ],
  
  // コンソール出力をキャプチャする
  silent: false,
  
  // ワーカープロセスのタイムアウト（ms）
  workerIdleMemoryLimit: '1GB',

  // ESM環境でのJest設定
  globals: {
    // ts-jestの設定は個別transformセクションで定義済み
  },

  // テスト終了時の強制終了を有効化（ハングを防止）
  forceExit: true
}; 