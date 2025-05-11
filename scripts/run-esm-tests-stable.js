#!/usr/bin/env node
/**
 * ESMテストを安定して実行するためのスクリプト
 * REF-034: テスト実行環境の最終安定化
 *
 * このスクリプトはESMテストの安定性を向上させ、Jest終了問題を解決するために以下を行います：
 * 1. タイムアウトによる強制終了機能
 * 2. テスト結果のキャプチャと報告
 * 3. 非同期処理のクリーンアップ
 * 4. 一時ファイルの削除
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// スクリプトのルートディレクトリ
const rootDir = path.resolve(__dirname, '..');

// 環境変数設定
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--experimental-vm-modules --max-old-space-size=4096';
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';

// デフォルトタイムアウト: 30秒
const DEFAULT_TIMEOUT = 30000;

// コマンドライン引数の解析
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    timeout: DEFAULT_TIMEOUT,
    testArgs: [],
    configPath: path.join(rootDir, 'jest.config.esm.js'),
    runInBand: false,
    debugMode: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--timeout') {
      options.timeout = parseInt(args[i + 1], 10) || DEFAULT_TIMEOUT;
      i++; // タイムアウト値をスキップ
    } else if (args[i].startsWith('--config=')) {
      options.configPath = path.resolve(rootDir, args[i].split('=')[1]);
    } else if (args[i] === '--runInBand' || args[i] === '-i') {
      options.runInBand = true;
      options.testArgs.push('--runInBand');
    } else if (args[i] === '--debug') {
      options.debugMode = true;
      options.testArgs.push('--runInBand');
    } else if (args[i].startsWith('--')) {
      options.testArgs.push(args[i]);
    } else {
      options.testArgs.push(args[i]);
    }
  }

  return options;
}

// メイン実行関数
function runTests() {
  const { timeout, testArgs, configPath, runInBand, debugMode } = parseArgs();
  console.log(`🧪 実行コマンド: node --experimental-vm-modules ${path.resolve('node_modules/jest/bin/jest.js')} --config=${configPath} --testTimeout=${timeout} --detectOpenHandles ${testArgs.join(' ')}`);

  // 一時的なテスト環境ディレクトリを作成
  const tempTestDir = path.join(os.tmpdir(), `sobot-test-${Date.now()}`);
  fs.mkdirSync(tempTestDir, { recursive: true });

  if (debugMode) {
    console.log(`📁 一時テストディレクトリ: ${tempTestDir}`);
  }

  // Jestプロセスを起動
  const jestProcess = spawn('node', [
    '--experimental-vm-modules',
    path.resolve('node_modules/jest/bin/jest.js'),
    `--config=${configPath}`,
    '--testTimeout=' + timeout,
    '--detectOpenHandles',
    ...testArgs
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      FORCE_COLOR: '1', // 色付き出力を強制
      JEST_TEMP_DIR: tempTestDir, // 一時テストディレクトリを設定
      SOBOT_TEST_RUN_ID: Date.now().toString() // テスト実行IDを設定（追跡用）
    }
  });

  let hasExited = false;

  // プロセス終了時の処理
  jestProcess.on('exit', (code) => {
    hasExited = true;
    console.log(`🏁 テスト実行が終了しました。終了コード: ${code}`);
    if (code !== 0) {
      console.log(`❌ テストが失敗しました。詳細なエラーログを確認してください。`);
    }
    
    // 一時ディレクトリをクリーンアップ
    cleanup(tempTestDir);
    
    // 少し待ってから強制終了
    setTimeout(() => {
      process.exit(code);
    }, 500);
  });

  // エラー発生時の処理
  jestProcess.on('error', (err) => {
    console.error(`⚠️ テスト実行中にエラーが発生しました: ${err}`);
    process.exit(1);
  });

  // タイムアウト監視
  const timeoutTimer = setTimeout(() => {
    if (!hasExited) {
      console.warn(`⚠️ タイムアウト（${timeout}ms）に達しました。プロセスを強制終了します。`);
      jestProcess.kill('SIGTERM');
      
      // SIGTERMを送信後、少し待ってからSIGKILLで確実に終了
      setTimeout(() => {
        if (!hasExited) {
          console.warn('⚠️ 強制終了します（SIGKILL）');
          jestProcess.kill('SIGKILL');
          process.exit(1);
        }
      }, 2000);
    }
  }, timeout + 5000); // テストタイムアウトより少し長く待つ

  // タイムアウトタイマーのクリーンアップ
  timeoutTimer.unref();
}

// スクリプト実行
runTests();

// クリーンアップ関数
const cleanup = (tempTestDir) => {
  try {
    fs.rmSync(tempTestDir, { recursive: true, force: true });
  } catch (err) {
    console.warn(`⚠️ 一時ディレクトリのクリーンアップ失敗: ${err.message}`);
  }
}; 