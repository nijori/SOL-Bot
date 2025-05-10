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
        // 必要最小限の型チェック
        isolatedModules: true, 
        // エラーメッセージのカスタマイズ
        diagnostics: {
          warnOnly: true
        }
      },
    ],
  },
  // トランスパイル対象外のファイル
  transformIgnorePatterns: ['<rootDir>/node_modules/'],
  
  // 自動モック機能を有効化（すべてのモジュールを自動的にモック化）
  automock: false,
  
  // テスト環境でのモジュールの動作を改善
  moduleDirectories: ['node_modules', 'src'],
  
  // モジュール解決のためのモックファイルパス
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // 不足しているモジュールを自動的にモック化
  setupFiles: ['<rootDir>/src/__tests__/core/setupJest.js'],
  rootDir: '../../..',
  
  // テスト結果の詳細レポート
  verbose: true,
}; 