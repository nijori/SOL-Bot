/**
 * バックテストスモークテスト実行ラッパー (REF-031対応)
 * 
 * ビルド済みのCommonJSバックテストランナーを実行します。
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// package.jsonからデータを読み込み
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('バックテストスモークテストを実行中...');

// 1. まずCJSモードでビルド
try {
  console.log('CommonJSビルド実行中...');
  execSync('npm run build:cjs', { stdio: 'inherit' });
} catch (error) {
  console.error('ビルド失敗:', error);
  process.exit(1);
}

// 2. 絶対パスでモジュールを解決するために登録
try {
  // commonjs用の簡易index.jsを動的に生成
  const indexPath = path.join(__dirname, '../dist/smoke-index.js');
  fs.writeFileSync(indexPath, `
// REF-031用一時ファイル
require('./core/backtestRunner');
  `);
  
  // 実行 - --smoke-test引数を使用
  console.log('スモークテスト実行中...');
  execSync('node dist/smoke-index.js --smoke-test --days 3', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      DEBUG: 'sol-bot:*'
    }
  });
  
  // 一時ファイル削除
  fs.unlinkSync(indexPath);
  
  console.log('スモークテスト完了');
} catch (error) {
  console.error('スモークテスト実行失敗:', error);
  process.exit(1);
} 