#!/usr/bin/env node

/**
 * ESMテスト安全実行スクリプト
 * REF-025: ESMテスト安定性の向上
 * 
 * このスクリプトはESMテストの安定性を向上させるために以下を行います：
 * 1. 環境変数の適切な設定
 * 2. テスト専用のクリーンアップ環境の準備
 * 3. Jest実行時のハングを防止する監視メカニズム
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ESM環境での__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 環境変数設定
process.env.NODE_OPTIONS = '--experimental-vm-modules --max-old-space-size=4096';
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';

// コマンドライン引数の解析
const args = process.argv.slice(2);
let testTimeout = 60000; // デフォルトのタイムアウト（60秒）
let testPaths = [];
let jestArgs = ['--detectOpenHandles']; // Jest追加引数

// 引数のパース
args.forEach(arg => {
  if (arg.startsWith('--timeout=')) {
    testTimeout = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--')) {
    jestArgs.push(arg);
  } else {
    testPaths.push(arg);
  }
});

// デフォルトのテストパス
if (testPaths.length === 0) {
  testPaths = ['./src/__tests__/**/*.test.mjs'];
}

console.log('🚀 ESMテスト安全実行を開始します...');
console.log(`📂 テスト対象: ${testPaths.join(', ')}`);
console.log(`⏱️ タイムアウト: ${testTimeout}ms`);

// Jestコマンドを構築
const jestCommand = 'node';
const jestArgs2 = [
  '--experimental-vm-modules',
  path.join(rootDir, 'node_modules', 'jest', 'bin', 'jest.js'),
  ...jestArgs,
  `--testTimeout=${testTimeout}`,
  ...testPaths
];

const fullCommand = `${jestCommand} ${jestArgs2.join(' ')}`;
console.log(`🧪 実行コマンド: ${fullCommand}`);

// 子プロセスでJestを実行（execSyncを使用）
try {
  execSync(fullCommand, {
    stdio: 'inherit',
    env: {
      ...process.env,
      FORCE_COLOR: '1', // 色付き出力を強制
    }
  });
  console.log('\n✅ テスト実行が正常に完了しました。');
  process.exit(0);
} catch (error) {
  console.error(`\n❌ テスト実行がエラーで失敗しました: ${error.message}`);
  
  // クリーンアップファイルがあれば実行
  const cleanupScript = path.join(rootDir, 'scripts', 'cleanup-test-resources.js');
  if (fs.existsSync(cleanupScript)) {
    console.log('🧹 テストリソースをクリーンアップしています...');
    // クリーンアップスクリプトを実行
    try {
      execSync(`node ${cleanupScript}`, { stdio: 'inherit' });
    } catch (cleanupError) {
      console.error(`クリーンアップ中にエラーが発生しました: ${cleanupError.message}`);
    }
  }
  
  process.exit(1);
} 