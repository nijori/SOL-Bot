#!/usr/bin/env node

/**
 * ESMテスト用実行スクリプト (TST-052対応)
 * 
 * 実行時のエラーやメモリリーク問題を防止するための実行ヘルパー
 * このスクリプトは、ESMテスト実行時の問題を回避するために設計されています
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 設定
const MAX_EXECUTION_TIME = 60 * 1000; // 60秒
const JEST_BIN = path.resolve(__dirname, '../node_modules/jest/bin/jest.js');
const JEST_CONFIG = path.resolve(__dirname, '../jest.config.js');
const DEFAULT_ARGS = [
  '--config=' + JEST_CONFIG,
  '--detectOpenHandles',
  '--testTimeout=60000'
];

// コマンドライン引数を処理
const args = process.argv.slice(2);
let pattern = 'src/__tests__/**/*.test.mjs'; // バックスラッシュではなく、フォワードスラッシュを使用

// 特定のファイルパターンの指定
const patternIndex = args.findIndex(arg => 
  !arg.startsWith('-') && !arg.startsWith('--')
);

if (patternIndex !== -1) {
  pattern = args[patternIndex];
  args.splice(patternIndex, 1);
}

// クリーンアップスクリプト
const CLEANUP_SCRIPT = path.resolve(__dirname, './cleanup-test-resources.js');

// コマンドラインにオプションを追加
const jestArgs = [
  ...DEFAULT_ARGS,
  ...args,
  // メモリリーク検出を無効化
  '--no-detectLeaks',
  // 必ず終了させるために
  '--forceExit',
  pattern
];

console.log('ESMテスト実行: node --experimental-vm-modules', JEST_BIN, jestArgs.join(' '));

// 環境変数の設定 (ESM環境フラグを設定)
const env = {
  ...process.env,
  FORCE_ESM: 'true',
  NODE_OPTIONS: '--experimental-vm-modules'
};

// Jestプロセスの起動
const jestProcess = spawn('node', ['--experimental-vm-modules', JEST_BIN, ...jestArgs], {
  stdio: 'inherit',
  env
});

// タイムアウトタイマー
const timeoutTimer = setTimeout(() => {
  console.error('\n⚠️ テスト実行がタイムアウトしました。強制終了します。');
  jestProcess.kill();
}, MAX_EXECUTION_TIME);

// プロセス終了処理
jestProcess.on('close', (code) => {
  clearTimeout(timeoutTimer);
  
  // テスト後のクリーンアップ
  console.log('🧹 テストリソースをクリーンアップしています...');
  
  try {
    // クリーンアップスクリプトを実行
    require(CLEANUP_SCRIPT);
  } catch (err) {
    console.error('クリーンアップ中にエラーが発生しました:', err);
  }
  
  // 終了コードを引き継ぐ
  process.exit(code);
});

// エラーハンドリング
jestProcess.on('error', (err) => {
  console.error('テスト実行中にエラーが発生しました:', err);
  clearTimeout(timeoutTimer);
  process.exit(1);
});
