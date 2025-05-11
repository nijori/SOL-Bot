/**
 * ESM対応テスト実行スクリプト
 * REF-023: テスト実行フローのESM対応
 * REF-030: JestのESM関連設定調整
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// コマンドライン引数の解析
const args = process.argv.slice(2);
const detectOpenHandles = args.includes('--detect-handles');
const debug = args.includes('--debug');
const coverage = args.includes('--coverage');
const testPattern = args.find((arg) => arg.startsWith('--pattern='))?.split('=')[1];
const config = args.find((arg) => arg.startsWith('--config='))?.split('=')[1] || 'jest.config.js';

// 環境変数の設定
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--experimental-vm-modules --max-old-space-size=4096';
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';

// 実行するJestコマンドの構築
let jestArgs = [
  '--experimental-vm-modules', 
  'node_modules/jest/bin/jest.js',
  `--config=${path.resolve(rootDir, config)}`
];

// 引数に基づいてオプションを追加
if (detectOpenHandles) {
  jestArgs.push('--detectOpenHandles');
}

if (debug) {
  // Nodeのインスペクタを有効化
  process.argv = ['--inspect-brk', ...process.argv.slice(1)];
  jestArgs.push('--runInBand');
}

if (coverage) {
  jestArgs.push('--coverage');
}

if (testPattern) {
  jestArgs.push('--testNamePattern', testPattern);
}

// .mjsテストファイルに限定
jestArgs.push('.*\\.test\\.mjs$');

// Node.jsの環境オプションをログ出力
console.log(`📋 NODE_OPTIONS: ${process.env.NODE_OPTIONS || '(未設定)'}`);
console.log(`📋 実行コマンド: node ${jestArgs.join(' ')}`);

// テスト実行前のメッセージ
console.log('🧪 ESMテストを実行します...');

// テストプロセスの実行
const testProcess = spawn('node', jestArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env
});

// プロセスの終了を処理
testProcess.on('close', (code) => {
  console.log(`🏁 テスト実行が終了しました。終了コード: ${code}`);
  
  // 非ゼロの終了コードの場合はエラーメッセージを表示
  if (code !== 0) {
    console.error(`❌ テストが失敗しました。詳細なエラーログを確認してください。`);
  }
  
  process.exit(code);
});

// エラーハンドリング
testProcess.on('error', (err) => {
  console.error('❌ テスト実行中にエラーが発生しました:', err);
  process.exit(1);
});

// Ctrl+C などの割り込み信号を適切に処理
process.on('SIGINT', () => {
  console.log('⛔ テスト実行を中断します...');
  testProcess.kill('SIGINT');
  process.exit(130); // SIGINT標準終了コード
});
