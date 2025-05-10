#!/usr/bin/env node

/**
 * ESMテスト実行CI環境セットアップスクリプト
 * REF-026: ESMテスト用CI/CD最適化
 *
 * このスクリプトはCI環境でESMテストを安定して実行するための
 * ディレクトリ構造の準備とパーミッション設定を行います。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { execSync } from 'child_process';

// ESM環境での__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// GitHub ActionsのCI環境かどうかを検出
const isGithubCI = process.env.GITHUB_ACTIONS === 'true';

/**
 * ディレクトリが存在しない場合は作成
 * @param {string} dir - 作成するディレクトリパス
 */
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`ディレクトリを作成します: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 環境設定ファイルの読み込み
 * @returns {Object} - 環境設定オブジェクト
 */
function loadEnvironmentConfig() {
  const configPath = path.join(rootDir, '.github', 'actions-env.yml');

  try {
    if (fs.existsSync(configPath)) {
      const fileContents = fs.readFileSync(configPath, 'utf8');
      return yaml.load(fileContents);
    }
  } catch (error) {
    console.error('環境設定ファイルの読み込みに失敗しました:', error);
  }

  // デフォルト設定
  return {
    test: {
      directories: ['data/test', 'data/test-e2e', '.jest-cache']
    }
  };
}

/**
 * テスト環境ディレクトリを準備
 * @param {Object} config - 環境設定オブジェクト
 */
function setupTestDirectories(config) {
  // 必須ディレクトリの作成
  const requiredDirs = ['data/test', 'data/test-e2e', '.jest-cache'];

  // 設定ファイルに指定されたディレクトリを追加
  if (config.test && config.test.directories) {
    requiredDirs.push(...config.test.directories);
  }

  // 重複を除去して各ディレクトリを作成
  [...new Set(requiredDirs)].forEach((dir) => {
    ensureDirectoryExists(path.join(rootDir, dir));
  });
}

/**
 * CI環境向けの追加設定
 */
function setupCIEnvironment() {
  if (isGithubCI) {
    console.log('GitHub Actions CI環境を検出しました。CI固有の設定を適用します。');

    // タイムアウト設定などの環境変数設定
    process.env.JEST_TIMEOUT = process.env.JEST_TIMEOUT || '30000';

    // CI環境でのパーミッション設定
    try {
      console.log('テストスクリプトの実行権限を設定します');
      execSync('chmod +x ./scripts/run-esm-tests-safely.js');
    } catch (error) {
      console.warn('パーミッション設定に失敗しました:', error.message);
    }
  }
}

// メイン実行
function main() {
  console.log('ESMテスト実行環境のセットアップを開始します...');

  // 環境設定の読み込み
  const config = loadEnvironmentConfig();

  // テストディレクトリの準備
  setupTestDirectories(config);

  // CI環境の追加設定
  setupCIEnvironment();

  console.log('ESMテスト実行環境のセットアップが完了しました。');
}

main();
