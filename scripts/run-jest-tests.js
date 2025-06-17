#!/usr/bin/env node

/**
 * Jestテスト実行ヘルパースクリプト
 * TST-079: Jest環境設定とテスト実行スクリプトの改善
 * 
 * このスクリプトは、テスト実行前にJestのグローバル関数を設定し、
 * テスト実行後にクリーンアップします。グローバル関数「describe」が
 * 定義されていない問題を解決します。
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// 設定
const JEST_BIN = path.resolve(__dirname, '../node_modules/jest/bin/jest.js');
const JEST_CONFIG = path.resolve(__dirname, '../jest.config.js');
const TEST_GLOBALS_SETUP = path.resolve(__dirname, './test-jest-globals.js');

// コマンドライン引数を処理
const args = process.argv.slice(2);

// ヘルパー関数: Jestのグローバル関数をインジェクト
function injectJestGlobals() {
  // グローバルセットアップヘルパーが存在するか確認
  if (fs.existsSync(TEST_GLOBALS_SETUP)) {
    try {
      // ヘルパースクリプトをrequire
      const globalsHelper = require(TEST_GLOBALS_SETUP);
      const success = globalsHelper.setupJestGlobals();
      
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
function runTests() {
  console.log('🧪 Jestテストを実行します...');
  
  // Jestのグローバル関数を設定
  injectJestGlobals();
  
  // 設定ファイルの存在確認
  ensureSetupFiles();
  
  // デフォルトのJest引数
  const defaultArgs = [
    '--config=' + JEST_CONFIG,
    '--detectOpenHandles'
  ];
  
  // Jestプロセスを起動
  const jestProcess = spawn('node', [JEST_BIN, ...defaultArgs, ...args], {
    stdio: 'inherit',
    env: process.env
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