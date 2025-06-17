#!/usr/bin/env node
/**
 * fix-task-duplicates.js - 重複タスクIDの問題を修正するスクリプト
 *
 * アーカイブまたはスプリントに既に存在するタスクをバックログから削除します
 */

const fs = require('fs');
const path = require('path');

// ファイルパス
const BACKLOG_FILE = path.join(__dirname, '../../.todo/backlog.mdc');
const ARCHIVE_FILE = path.join(__dirname, '../../.todo/archive.mdc');
const SPRINT_FILE = path.join(__dirname, '../../.todo/sprint.mdc');
const BACKUP_DIR = path.join(__dirname, '../../.todo/backups');

// バックアップを作成
function createBackup(filePath) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const backupPath = path.join(BACKUP_DIR, `${path.basename(filePath)}.${Date.now()}.bak`);
  fs.copyFileSync(filePath, backupPath);
  console.log(`バックアップを作成しました: ${backupPath}`);
}

// タスクIDを抽出する正規表現
const taskIdRegex = /^- \[[x ]\] ([A-Z]+-\d+):/;

// ファイルからタスクIDを収集
function collectTaskIds(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const taskIds = [];

  lines.forEach((line) => {
    const match = line.match(taskIdRegex);
    if (match) {
      taskIds.push(match[1]);
    }
  });

  return taskIds;
}

// ファイルから重複IDのタスクを削除
function removeTasksWithDuplicateIds(backlogFilePath, taskIdsToRemove) {
  const content = fs.readFileSync(backlogFilePath, 'utf8');
  const lines = content.split(/\r?\n/);

  let updatedContent = [];
  let inTaskToRemove = false;
  let taskIdToSkip = null;

  for (const line of lines) {
    const match = line.match(taskIdRegex);

    if (match) {
      const taskId = match[1];
      if (taskIdsToRemove.includes(taskId)) {
        inTaskToRemove = true;
        taskIdToSkip = taskId;
        updatedContent.push(
          `// ${taskId}タスクはアーカイブまたはスプリントに既に存在するため削除しました`
        );
        continue;
      } else {
        inTaskToRemove = false;
        taskIdToSkip = null;
      }
    }

    // タスク関連の行をスキップ
    if (inTaskToRemove && line.trim().startsWith('-') && !line.match(taskIdRegex)) {
      continue;
    }

    if (!inTaskToRemove) {
      updatedContent.push(line);
    }
  }

  fs.writeFileSync(backlogFilePath, updatedContent.join('\n'), 'utf8');
  console.log(`${backlogFilePath}からの重複タスクを削除しました`);
}

// メイン処理
function main() {
  console.log('重複タスクIDを修正しています...');

  // バックアップ作成
  createBackup(BACKLOG_FILE);

  // アーカイブとスプリントからタスクIDを収集
  const archiveTaskIds = collectTaskIds(ARCHIVE_FILE);
  const sprintTaskIds = collectTaskIds(SPRINT_FILE);

  console.log(`アーカイブで見つかったタスクID: ${archiveTaskIds.length}個`);
  console.log(`スプリントで見つかったタスクID: ${sprintTaskIds.length}個`);

  // バックログからアーカイブ/スプリントに存在するタスクを削除
  const taskIdsToRemove = [...archiveTaskIds, ...sprintTaskIds];
  removeTasksWithDuplicateIds(BACKLOG_FILE, taskIdsToRemove);

  console.log('重複タスクIDの修正が完了しました！');
}

main();
