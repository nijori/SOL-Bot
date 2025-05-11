/**
 * Jest設定ファイル
 * CommonJSモードでテスト環境を安定化させるための設定
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // テストのルートディレクトリ
  rootDir: 'src',

  // テスト環境
  testEnvironment: 'node',
  
  // テストファイルの検索パターン
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.mjs'
  ],
  
  // TypeScriptファイルの変換
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.mjs$': 'ts-jest'
  },
  
  // モジュール解決の設定
  moduleNameMapper: {
    // プロジェクト内ソースコード参照
    '^(\\.\\.?/.*)\\.js$': '$1'
  },
  
  // モジュールファイル拡張子
  moduleFileExtensions: ['ts', 'js', 'json', 'mjs'],
  
  // テストから除外するパターン
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__broken_mjs__/'
  ],
  
  // テストのタイムアウト
  testTimeout: 30000,
  
  // 詳細なログ
  verbose: true,
  
  // rootsの明示的な設定
  roots: ['<rootDir>'],
  
  // 変換を無視するパターン（npmモジュール）
  transformIgnorePatterns: [
    '/node_modules/(?!source-map)'
  ]
};