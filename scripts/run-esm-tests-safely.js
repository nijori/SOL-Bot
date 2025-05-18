#!/usr/bin/env node

/**
 * ESMテスト用実行スクリプト (TST-052, TST-054, TST-056, TST-057, TST-066対応)
 * 
 * 実行時のエラーやメモリリーク問題を防止するための実行ヘルパー
 * このスクリプトは、ESMテスト実行時の問題を回避するために設計されています
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 設定（カスタマイズ可能）
const DEFAULT_MAX_EXECUTION_TIME = 5 * 60 * 1000; // 5分（デフォルト）
const MAX_EXECUTION_TIME = process.env.TEST_TIMEOUT 
  ? parseInt(process.env.TEST_TIMEOUT, 10) * 1000 
  : DEFAULT_MAX_EXECUTION_TIME;

const JEST_BIN = path.resolve(__dirname, '../node_modules/jest/bin/jest.js');
const JEST_CONFIG = path.resolve(__dirname, '../jest.config.esm.js'); // ESM用設定ファイル
const DEFAULT_ARGS = [
  '--config=' + JEST_CONFIG,
  '--detectOpenHandles',
  '--testTimeout=120000',   // 単体テストのタイムアウト（2分）
  '--forceExit',            // テスト終了時に強制終了
  '--no-cache',             // キャッシュの問題を防ぐために無効化
];

// ログディレクトリの確保
const LOG_DIR = path.resolve(__dirname, '../logs/test');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const TEST_LOG_PATH = path.join(LOG_DIR, `esm-test-${Date.now()}.log`);
const logStream = fs.createWriteStream(TEST_LOG_PATH, { flags: 'a' });

// コンソール出力をログファイルにも転送
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = function(...args) {
  originalConsoleLog.apply(console, args);
  logStream.write(args.join(' ') + '\n');
};

console.error = function(...args) {
  originalConsoleError.apply(console, args);
  logStream.write('[ERROR] ' + args.join(' ') + '\n');
};

console.warn = function(...args) {
  originalConsoleWarn.apply(console, args);
  logStream.write('[WARN] ' + args.join(' ') + '\n');
};

// コマンドライン引数を処理
const args = process.argv.slice(2);
let pattern = 'src/__tests__/esm-basic.test.mjs'; // デフォルトテストパターン

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
  pattern
];

// Node.jsオプション設定
const nodeOptions = [
  '--experimental-vm-modules',
  '--experimental-modules',
  '--es-module-specifier-resolution=node',
  '--trace-warnings',
  // '--inspect-brk' // 必要に応じてデバッグ用に有効化
];

console.log(`🚀 ESMテスト実行: ${pattern}`);
console.log(`⏱️ タイムアウト: ${MAX_EXECUTION_TIME / 1000}秒`);
console.log(`📝 ログファイル: ${TEST_LOG_PATH}`);

// 環境変数の設定 (ESM環境フラグを設定)
const env = {
  ...process.env,
  FORCE_ESM: 'true',
  NODE_OPTIONS: nodeOptions.join(' '),
  TEST_LOG_FILE: TEST_LOG_PATH,
  // ESM環境での特別なtraceモードを指定
  NODE_ESM_TRACE: 'true' 
};

// Jestプロセスの起動
const jestProcess = spawn('node', [...nodeOptions, JEST_BIN, ...jestArgs], {
  stdio: 'pipe', // パイプで出力をキャプチャ
  env
});

// 出力処理
jestProcess.stdout.on('data', (data) => {
  process.stdout.write(data);
  logStream.write(data);
});

jestProcess.stderr.on('data', (data) => {
  process.stderr.write(data);
  logStream.write(`[ERROR] ${data}`);
});

// タイムアウトタイマー
const timeoutTimer = setTimeout(() => {
  console.error(`\n⚠️ テスト実行がタイムアウトしました（${MAX_EXECUTION_TIME / 1000}秒）。強制終了します。`);
  logStream.write('\n⚠️ テスト実行がタイムアウトしました。強制終了します。\n');
  
  // プロセスツリーを取得して子プロセスも含めて強制終了
  try {
    jestProcess.kill('SIGKILL'); // 強制終了
  } catch (err) {
    console.error('プロセス終了中にエラーが発生しました:', err);
  }
}, MAX_EXECUTION_TIME);

// プロセス終了処理
jestProcess.on('close', (code) => {
  clearTimeout(timeoutTimer);
  
  // テスト後のクリーンアップ
  console.log('🧹 テストリソースをクリーンアップしています...');
  
  try {
    // クリーンアップスクリプトを実行
    if (fs.existsSync(CLEANUP_SCRIPT)) {
      require(CLEANUP_SCRIPT)();
    } else {
      console.warn(`警告: クリーンアップスクリプト ${CLEANUP_SCRIPT} が見つかりません`);
    }
  } catch (err) {
    console.error('クリーンアップ中にエラーが発生しました:', err);
  }
  
  // 最終結果をログに記録
  logStream.write(`\n---テスト実行完了---\n終了コード: ${code}\n`);
  logStream.end();
  
  // オープンハンドルの警告
  if (code !== 0) {
    console.warn('❌ テスト失敗 - オープンハンドルが残っている可能性があります');
    console.warn(`詳細ログは ${TEST_LOG_PATH} を確認してください`);
  } else {
    console.log(`✅ テスト成功 (終了コード: ${code})`);
  }
  
  // 終了コードを引き継ぐ
  process.exit(code);
});

// エラーハンドリング
jestProcess.on('error', (err) => {
  console.error('テスト実行中にエラーが発生しました:', err);
  logStream.write(`\n---エラー発生---\n${err.stack || err}\n`);
  clearTimeout(timeoutTimer);
  logStream.end();
  process.exit(1);
});

// プロセス終了シグナルの処理
process.on('SIGINT', () => {
  console.log('\n🛑 ユーザーによる中断...');
  jestProcess.kill('SIGINT');
  clearTimeout(timeoutTimer);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 終了シグナルを受信...');
  jestProcess.kill('SIGTERM');
  clearTimeout(timeoutTimer);
});
