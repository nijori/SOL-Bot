// ESMに対応したJest設定
export default {
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.mjs'],
  moduleFileExtensions: ['ts', 'mjs', 'js', 'json'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true
      }
    ]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  // REF-025: ESMテスト安定性の向上 - グローバルセットアップファイルを追加
  setupFilesAfterEnv: ['./scripts/jest-setup-esm.js'],
  // テストのタイムアウト時間を延長（ms）
  testTimeout: 30000,
  // オープンハンドル検出のデフォルト有効化
  detectOpenHandles: false,
  // forceExit設定はfalseを推奨（Jest did not exit問題の回避のため）
  forceExit: false,
  // コードカバレッジ設定
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.mjs',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.test.mjs',
    '!src/scripts/**/*.ts',
    '!src/types/**/*.ts',
    '!**/node_modules/**'
  ],
  coverageReporters: ['text', 'lcov', 'clover', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 90,
      statements: 90
    }
  }
};
