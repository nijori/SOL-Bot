/**
 * Jest ESM設定
 * ESMモジュールとしてTypeScriptテストを実行するための設定
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  // → projectRoot/src がテストのルートになります
  rootDir: 'src',

  // ESM＋TypeScript対応のプリセット
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',

  // 拡張子 .ts/.tsx を ESM 扱いに
  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  // src/__tests__/**/*.test.ts を拾う
  testMatch: ['**/__tests__/**/*.test.ts'],

  // 実装側は .ts、テスト内で .js を書いても .ts にリライト
  moduleFileExtensions: ['ts', 'js', 'json'],

  moduleNameMapper: {
    // 「../.../*.js」だけを → 「../.../*.ts」に置き換え
    '^(\.{2,}\/.*)\.js$': '$1.ts'
  },

  // ts-jest で ESM モード変換
  transform: {
    '^.+\.(t|j)sx?$': [
      'ts-jest',
      { useESM: true, tsconfig: 'tsconfig.build.json' },
    ],
  },

  // デフォルトの resolver をそのまま使う
  // resolver: undefined,

  // setupFilesAfterEnv は rootDir (=src) からの相対
  setupFilesAfterEnv: ['<rootDir>/../scripts/jest-setup-esm.js'],

  // これ以降はお好みで
  testTimeout: 30000,
  verbose: true,

  testPathIgnorePatterns: [
    '/node_modules/',
    '/__broken_mjs__/',
  ],
};