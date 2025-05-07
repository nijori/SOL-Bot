/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/multiSymbolBacktest.test.ts'],
  // トランスパイル設定
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // 型チェックをスキップ
        isolatedModules: true, 
        // ts-jestがTypeScriptの型エラーを無視する
        diagnostics: false,
      },
    ],
  },
  // トランスパイル対象外のファイル
  transformIgnorePatterns: ['<rootDir>/node_modules/'],
  // モジュールのモック設定
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}; 