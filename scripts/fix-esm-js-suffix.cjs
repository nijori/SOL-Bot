#!/usr/bin/env node

/**
 * ESM移行用のスクリプト - .js拡張子対応
 * --------------------------------------
 * 
 * ESMモードでは、相対インポートパスに拡張子(.js)が必要です。
 * このスクリプトは以下の機能を提供します：
 * 
 * 1. 安全チェック: 修正が必要な箇所をリストアップ
 * 2. 自動修正: 対象ファイルを自動的に修正
 * 3. 部分適用: 指定ディレクトリのみを対象に修正
 * 
 * 使用方法:
 *  node scripts/fix-esm-js-suffix.cjs [コマンド] [ディレクトリ]
 * 
 * コマンド:
 *  check      - 修正が必要な箇所をリストアップするだけ
 *  fix        - 修正を自動的に適用する
 *  backup     - 修正前にディレクトリのバックアップを作成
 *  check-fix  - checkとfixを順に実行（推奨）
 * 
 * 例:
 *  node scripts/fix-esm-js-suffix.cjs check src        # src配下の修正候補をリストアップ
 *  node scripts/fix-esm-js-suffix.cjs check-fix src    # src配下を安全に修正
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { execSync } = require('child_process');

// ===== 設定 =====
const TOOLS_DIR = path.join(__dirname, '..', 'tools');
const CHECK_SCRIPT = path.join(TOOLS_DIR, 'fix-js-suffix.cjs');
const FIX_SCRIPT = path.join(TOOLS_DIR, 'fix-js-suffix-apply.cjs');

/**
 * コマンドを実行して完了まで待機
 */
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`実行: ${command} ${args.join(' ')}`);
    
    const proc = spawn(command, args, { stdio: 'inherit' });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`コマンドが失敗しました: ${command} ${args.join(' ')}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 指定ディレクトリのgitバックアップブランチを作成
 */
function createBackupBranch(targetDir) {
  const date = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const branchName = `backup/esm-js-suffix-${date}`;
  
  console.log(`🔄 バックアップブランチを作成します: ${branchName}`);
  
  try {
    // 変更を全てステージング
    execSync('git add -A', { stdio: 'inherit' });
    
    // 現在の変更を一時保存
    execSync('git stash push -m "Temporary save before ESM fixes"', { stdio: 'inherit' });
    
    // バックアップブランチを作成
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
    
    // 変更を復元
    execSync('git stash pop', { stdio: 'inherit' });
    
    // 全ての変更をコミット
    execSync(`git commit -am "Backup before ESM .js suffix fixes for ${targetDir}"`, { stdio: 'inherit' });
    
    console.log(`✅ バックアップブランチ ${branchName} を作成し、変更をコミットしました`);
    return branchName;
  } catch (error) {
    console.error('❌ バックアップブランチの作成に失敗しました:', error.message);
    throw error;
  }
}

/**
 * メイン実行関数
 */
async function main() {
  // コマンドライン引数の解析
  const [command = 'help', targetDir = 'src'] = process.argv.slice(2);
  
  // ヘルプ表示
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`
ESM移行用のスクリプト - .js拡張子対応

使用方法:
  node scripts/fix-esm-js-suffix.cjs [コマンド] [ディレクトリ]

コマンド:
  check      - 修正が必要な箇所をリストアップするだけ
  fix        - 修正を自動的に適用する
  backup     - 修正前にディレクトリのバックアップを作成
  check-fix  - checkとfixを順に実行（推奨）

例:
  node scripts/fix-esm-js-suffix.cjs check src        # src配下の修正候補をリストアップ
  node scripts/fix-esm-js-suffix.cjs check-fix src    # src配下を安全に修正
`);
    return;
  }
  
  try {
    // 各コマンドの処理
    switch (command) {
      case 'check':
        await runCommand('node', [CHECK_SCRIPT, targetDir]);
        break;
        
      case 'fix':
        await runCommand('node', [FIX_SCRIPT, targetDir]);
        break;
        
      case 'backup':
        await createBackupBranch(targetDir);
        break;
        
      case 'check-fix':
        console.log('📋 1. まず修正候補をチェックします...');
        await runCommand('node', [CHECK_SCRIPT, targetDir]);
        
        console.log('\n🔨 2. 修正を適用します...');
        await runCommand('node', [FIX_SCRIPT, targetDir]);
        break;
        
      default:
        console.error(`❌ 不明なコマンド: ${command}`);
        console.log('使用可能なコマンド: check, fix, backup, check-fix');
        process.exit(1);
    }
    
    console.log('✨ 処理が完了しました');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
}

// スクリプト実行
main(); 