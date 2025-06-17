#!/usr/bin/env node
/**
 * fix-progress.js - API-023とDATA-011タスクの進捗率を修正するスクリプト
 *
 * 使い方:
 * node src/scripts/fix-progress.js
 */

const fs = require('fs');
const path = require('path');

// バックログファイルのパス
const BACKLOG_FILE = path.join(__dirname, '../../.todo/backlog.mdc');

// メイン処理
function main() {
  console.log('API-023とDATA-011タスクの進捗率を修正しています...');

  if (!fs.existsSync(BACKLOG_FILE)) {
    console.error(`ファイルが見つかりません: ${BACKLOG_FILE}`);
    process.exit(1);
  }

  // バックアップ作成
  const backupDir = path.join(path.dirname(BACKLOG_FILE), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupPath = path.join(backupDir, `backlog.mdc.${Date.now()}.bak`);
  fs.copyFileSync(BACKLOG_FILE, backupPath);
  console.log(`バックアップを作成しました: ${backupPath}`);

  // ファイル内容を読み込む
  let content = fs.readFileSync(BACKLOG_FILE, 'utf8');

  // 修正前の内容を表示
  console.log('修正前の内容:');
  const api023Match = content.match(/- \[x\] API-023:.*?Progress\s+:\s+([^\n]*)/s);
  const data011Match = content.match(/- \[x\] DATA-011:.*?Progress\s+:\s+([^\n]*)/s);

  if (api023Match) {
    console.log(`API-023 進捗率: ${api023Match[1]}`);
  }
  if (data011Match) {
    console.log(`DATA-011 進捗率: ${data011Match[1]}`);
  }

  // API-023タスクの進捗率を修正
  content = content.replace(/- \[x\] API-023:.*?\n.*?Progress\s+:\s+0%/gs, (match) =>
    match.replace('Progress   : 0%', 'Progress   : 100%')
  );

  // DATA-011タスクの進捗率を修正
  content = content.replace(/- \[x\] DATA-011:.*?\n.*?Progress\s+:\s+0%/gs, (match) =>
    match.replace('Progress   : 0%', 'Progress   : 100%')
  );

  // 変更を保存
  fs.writeFileSync(BACKLOG_FILE, content);
  console.log('ファイルを更新しました');

  // 修正後の内容を表示
  content = fs.readFileSync(BACKLOG_FILE, 'utf8');
  console.log('修正後の内容:');
  const api023MatchAfter = content.match(/- \[x\] API-023:.*?Progress\s+:\s+([^\n]*)/s);
  const data011MatchAfter = content.match(/- \[x\] DATA-011:.*?Progress\s+:\s+([^\n]*)/s);

  if (api023MatchAfter) {
    console.log(`API-023 進捗率: ${api023MatchAfter[1]}`);
  }
  if (data011MatchAfter) {
    console.log(`DATA-011 進捗率: ${data011MatchAfter[1]}`);
  }

  console.log('\n✅ 修正完了');
}

// スクリプト実行
main();
