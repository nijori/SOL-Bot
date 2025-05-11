/**
 * Jest ESM設定
 * ESMモジュールとしてTypeScriptテストを実行するための設定
 */

export default {
  // ESM＋TypeScript対応のプリセット
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  // どの拡張子のテストを拾うか
  testMatch: ['**/__tests__/**/*.test.ts'],
  
  // モジュール拡張子
  moduleFileExtensions: ['ts', 'js', 'json'],

  // TS を ts-jest で ESM モードに変換
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.build.json',
    }],
  },

  // モジュールパスマッピング
  moduleNameMapper: {
    // 相対パスで末尾 .js を strip
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // さらに、テスト中に .ts ファイルを .js とみなしたい場合は .ts→.js も
    '^(\\.{1,2}/.*)\\.ts$': '$1.js',
  },

  // ESM のままパス解決させる
  resolver: null,

  // グローバルセットアップ
  setupFilesAfterEnv: ['./scripts/jest-setup-esm.js'],
  
  // テスト実行設定
  testTimeout: 30000,
  verbose: true,

  // テスト検出を最適化
  roots: ['<rootDir>/src'],
  
  // テスト除外パターン
  testPathIgnorePatterns: [
    '/node_modules/', 
    '/__broken_mjs__/'
  ],
};
