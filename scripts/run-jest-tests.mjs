#!/usr/bin/env node

/**
 * Jestテスト実行ヘルパースクリプト (ESM版)
 * TST-079: Jest環境設定とテスト実行スクリプトの改善
 * 
 * このスクリプトは、ESMテスト実行前にJestのグローバル関数を設定し、
 * テスト実行後にクリーンアップします。グローバル関数「describe」が
 * 定義されていない問題を解決します。
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 設定
const JEST_BIN = path.resolve(__dirname, '../node_modules/jest/bin/jest.js');
const JEST_CONFIG = path.resolve(__dirname, '../jest.config.esm.js');
const TEST_GLOBALS_SETUP = path.resolve(__dirname, './test-jest-globals.mjs');

// コマンドライン引数を処理
const args = process.argv.slice(2);

// ヘルパー関数: Jestのグローバル関数をインジェクト
async function injectJestGlobals() {
  // グローバルセットアップヘルパーが存在するか確認
  if (fs.existsSync(TEST_GLOBALS_SETUP)) {
    try {
      // ヘルパースクリプトを動的インポート
      const globalsHelper = await import(TEST_GLOBALS_SETUP);
      const success = await globalsHelper.setupJestGlobals();
      
      if (success) {
        console.log('✅ Jestのグローバル関数を正常に設定しました');
      } else {
        console.warn('⚠️ Jestのグローバル関数の設定に失敗しました');
      }
    } catch (error) {
      console.error('❌ Jestのグローバル関数設定中にエラー:', error);
    }
  } else {
    console.warn(`⚠️ グローバルセットアップヘルパーが見つかりません: ${TEST_GLOBALS_SETUP}`);
  }
}

// Jestセットアップファイルを確認
function ensureSetupFiles() {
  // 設定ファイルの存在確認
  if (!fs.existsSync(JEST_CONFIG)) {
    console.error(`❌ Jest設定ファイルが見つかりません: ${JEST_CONFIG}`);
    process.exit(1);
  }
}

// メイン実行関数
async function runTests() {
  console.log('🧪 ESM環境でJestテストを実行します...');
  
  // Jestのグローバル関数を設定
  await injectJestGlobals();
  
  // 設定ファイルの存在確認
  ensureSetupFiles();
  
  // Node.jsオプション
  const nodeOptions = [
    '--experimental-vm-modules',
    '--experimental-modules',
    '--es-module-specifier-resolution=node'
  ];
  
  // 環境変数の設定
  const env = {
    ...process.env,
    NODE_OPTIONS: nodeOptions.join(' '),
    FORCE_ESM: 'true'
  };
  
  // デフォルトのJest引数
  const defaultArgs = [
    '--config=' + JEST_CONFIG,
    '--detectOpenHandles'
  ];
  
  // Jestプロセスを起動
  const jestProcess = spawn('node', [...nodeOptions, JEST_BIN, ...defaultArgs, ...args], {
    stdio: 'inherit',
    env
  });
  
  // 終了処理
  jestProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ テスト実行が失敗しました (終了コード: ${code})`);
    } else {
      console.log('✅ テスト実行が成功しました');
    }
    
    // 終了コードを引き継ぐ
    process.exit(code);
  });
  
  // エラーハンドリング
  jestProcess.on('error', (err) => {
    console.error('❌ テスト実行中にエラーが発生しました:', err);
    process.exit(1);
  });
}

// メイン実行
runTests(); 