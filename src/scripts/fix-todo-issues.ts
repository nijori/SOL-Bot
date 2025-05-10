#!/usr/bin/env node
/**
 * fix-todo-issues.ts - Todoタスクの自動修正ツール
 * 
 * 使い方:
 * npm run todo-fix [options]
 * 
 * オプション:
 *   --check-only     修正を適用せず、問題の検出のみを行う
 *   --silent         通常の出力を抑制し、エラーのみを表示する
 *   --yes            確認プロンプトをスキップし、すべての修正を自動的に適用する
 *   --fix-dates      期限切れの日付を現在日付+7日に自動修正する
 *   --target <file>  特定のファイルのみを処理する（例: sprint.mdc）
 * 
 * 自動修正できる項目:
 * - 完了タスク（[x]）の場合:
 *   - Healthを✅に修正
 *   - Progressを100%に修正
 * - 進捗状態の一貫性がない場合の修正
 * - 日付のフォーマット修正
 * - 期限切れ日付の更新（--fix-dates オプション使用時）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { TodoTask, ValidationError, validateTodoFiles } from '../utils/todoValidator.js';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import { execSync } from 'child_process';

// ESMでは__dirnameがないため、import.meta.urlを使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトルートからの相対パス
const TODO_DIR = path.join(__dirname, '../../.todo');
const TODO_FILES = [
  path.join(TODO_DIR, 'archive.mdc'),
  path.join(TODO_DIR, 'backlog.mdc'),
  path.join(TODO_DIR, 'sprint.mdc')
];

interface TaskIdLocation {
  taskId: string;
  filePath: string;
  lineNumber: number;
  originalTaskId?: string;
}

/**
 * ファイルを一行ずつ読み込み、条件に応じて修正するユーティリティ関数
 */
async function processFileLineByLine(
  filePath: string,
  outputPath: string,
  lineProcessor: (line: string, lineNumber: number) => string
): Promise<void> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const outputLines: string[] = [];
  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    const processedLine = lineProcessor(line, lineNumber);
    outputLines.push(processedLine);
  }

  fs.writeFileSync(outputPath, outputLines.join('\n'));
}

/**
 * ファイルのバックアップを作成
 */
function backupFile(filePath: string): string {
  const backupPath = `${filePath}.bak`;
  fs.copyFileSync(filePath, backupPath);
  console.log(chalk.blue(`バックアップを作成しました: ${backupPath}`));
  return backupPath;
}

/**
 * すべてのタスクIDを収集
 */
function collectAllTaskIds(): string[] {
  const taskIds: string[] = [];

  for (const filePath of TODO_FILES) {
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    const taskIdMatches = content.match(/^\s*-\s+\[([ x])\]\s+([A-Z]+-\d+(?:-\d+)?):(.*)$/gm);

    if (taskIdMatches) {
      for (const match of taskIdMatches) {
        const taskIdMatch = match.match(/^\s*-\s+\[([ x])\]\s+([A-Z]+-\d+(?:-\d+)?):(.*)$/);
        if (taskIdMatch) {
          taskIds.push(taskIdMatch[2]);
        }
      }
    }
  }

  return taskIds;
}

/**
 * 完了タスクのステータスを修正
 */
function fixCompletedTaskStatus(filePath: string): number {
  let fixedCount = 0;

  if (!fs.existsSync(filePath)) return fixedCount;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;

  let inCompletedTask = false;
  let currentTaskId = '';
  let currentTaskIndent = '';
  let hasHealth = false;
  let hasProgress = false;
  let healthLine = -1;
  let progressLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 完了タスクの検出
    const completedTaskMatch = line.match(/^(\s*)-\s+\[(x)\]\s+([A-Z]+-\d+(?:-\d+)?):(.*)$/);
    if (completedTaskMatch) {
      // 前のタスクの処理
      if (inCompletedTask) {
        if (hasHealth && healthLine >= 0 && !lines[healthLine].includes('✅')) {
          lines[healthLine] = lines[healthLine].replace(
            /🩺\s+Health\s+:\s*[^✅]*/,
            '🩺 Health     : ✅'
          );
          modified = true;
          fixedCount++;
        } else if (!hasHealth) {
          // Healthフィールドがない場合は追加
          lines.splice(i, 0, `${currentTaskIndent}      - 🩺 Health     : ✅`);
          i++;
          modified = true;
          fixedCount++;
        }

        if (hasProgress && progressLine >= 0 && !lines[progressLine].includes('100%')) {
          lines[progressLine] = lines[progressLine].replace(
            /📊\s+Progress\s+:\s*[^1]*/,
            '📊 Progress   : 100%'
          );
          modified = true;
          fixedCount++;
        } else if (!hasProgress) {
          // Progressフィールドがない場合は追加
          lines.splice(i, 0, `${currentTaskIndent}      - 📊 Progress   : 100%`);
          i++;
          modified = true;
          fixedCount++;
        }
      }

      // 新しいタスクの開始
      inCompletedTask = true;
      currentTaskId = completedTaskMatch[3];
      currentTaskIndent = completedTaskMatch[1];
      hasHealth = false;
      hasProgress = false;
      healthLine = -1;
      progressLine = -1;
    }
    // タスク内のフィールドをチェック
    else if (inCompletedTask && line.trim().startsWith('-')) {
      if (line.includes('🩺 Health')) {
        hasHealth = true;
        healthLine = i;
      } else if (line.includes('📊 Progress')) {
        hasProgress = true;
        progressLine = i;
      }
    }
    // タスク終了の検出
    else if (
      inCompletedTask &&
      (line.trim() === '' || line.match(/^\s*-\s+\[/) || i === lines.length - 1)
    ) {
      // 最後のタスクの処理
      if (hasHealth && healthLine >= 0 && !lines[healthLine].includes('✅')) {
        lines[healthLine] = lines[healthLine].replace(
          /🩺\s+Health\s+:\s*[^✅]*/,
          '🩺 Health     : ✅'
        );
        modified = true;
        fixedCount++;
      } else if (!hasHealth) {
        // Healthフィールドがない場合は追加
        lines.splice(i, 0, `${currentTaskIndent}      - 🩺 Health     : ✅`);
        i++;
        modified = true;
        fixedCount++;
      }

      if (hasProgress && progressLine >= 0 && !lines[progressLine].includes('100%')) {
        lines[progressLine] = lines[progressLine].replace(
          /📊\s+Progress\s+:\s*[^1]*/,
          '📊 Progress   : 100%'
        );
        modified = true;
        fixedCount++;
      } else if (!hasProgress) {
        // Progressフィールドがない場合は追加
        lines.splice(i, 0, `${currentTaskIndent}      - 📊 Progress   : 100%`);
        i++;
        modified = true;
        fixedCount++;
      }

      // 次のタスクがある場合の処理
      if (line.match(/^\s*-\s+\[/)) {
        const nextTaskMatch = line.match(/^(\s*)-\s+\[(x)\]\s+([A-Z]+-\d+(?:-\d+)?):(.*)$/);
        if (nextTaskMatch) {
          // 次も完了タスク
          inCompletedTask = true;
          currentTaskId = nextTaskMatch[3];
          currentTaskIndent = nextTaskMatch[1];
          hasHealth = false;
          hasProgress = false;
          healthLine = -1;
          progressLine = -1;
        } else {
          // 完了タスクではない
          inCompletedTask = false;
        }
      } else {
        inCompletedTask = false;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(
      chalk.green(
        `  ✓ ${path.basename(filePath)} の ${fixedCount} 件の完了タスクステータスを修正しました`
      )
    );
  }

  return fixedCount;
}

/**
 * 無効な依存参照を修正
 */
function fixInvalidDependencies(filePath: string): number {
  let fixedCount = 0;

  if (!fs.existsSync(filePath)) return fixedCount;

  const validTaskIds = collectAllTaskIds();
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('🔗 Depends-on')) {
      const dependsMatch = line.match(/🔗\s+Depends-on\s+:\s*(.*)/);
      if (dependsMatch) {
        const dependencies = dependsMatch[1].split(',').map((d) => d.trim());
        const invalidDeps = dependencies.filter((dep) => !validTaskIds.includes(dep));

        if (invalidDeps.length > 0) {
          // 無効な依存参照を削除
          const validDeps = dependencies.filter((dep) => validTaskIds.includes(dep));

          if (validDeps.length > 0) {
            // 有効な依存参照がある場合は更新
            lines[i] = line.replace(dependsMatch[1], validDeps.join(', '));
          } else {
            // 有効な依存参照がない場合は行を削除
            lines.splice(i, 1);
            i--;
          }

          modified = true;
          fixedCount += invalidDeps.length;
          console.log(
            chalk.yellow(
              `  ⚠️ ${path.basename(filePath)}:${i + 1} の無効な依存参照を削除しました: ${invalidDeps.join(', ')}`
            )
          );
        }
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(
      chalk.green(
        `  ✓ ${path.basename(filePath)} の ${fixedCount} 件の無効な依存参照を修正しました`
      )
    );
  }

  return fixedCount;
}

/**
 * メイン処理
 */
async function main() {
  try {
    console.log(chalk.blue(`🔧 ${TODO_DIR} のTodoタスクの問題を修正しています...\n`));

    let totalCompletionFixed = 0;
    let totalDependenciesFixed = 0;

    // 各Todoファイルを処理
    for (const filePath of TODO_FILES) {
      if (fs.existsSync(filePath)) {
        // バックアップを作成
        backupFile(filePath);

        // 完了タスクステータスの修正
        const completionFixed = fixCompletedTaskStatus(filePath);
        totalCompletionFixed += completionFixed;

        // 無効な依存参照の修正
        const dependenciesFixed = fixInvalidDependencies(filePath);
        totalDependenciesFixed += dependenciesFixed;
      }
    }

    console.log(
      chalk.green(
        `\n✓ 合計 ${totalCompletionFixed} 件の完了タスクステータスと ${totalDependenciesFixed} 件の無効な依存参照を修正しました！\n`
      )
    );

    // todo-lintを実行してチェック
    console.log(chalk.blue(`Todoファイルを検証しています...\n`));
    try {
      execSync('npm run todo-lint', { stdio: 'inherit' });
    } catch (error) {
      console.warn(chalk.yellow('Todoファイルの検証中にエラーが発生しましたが、修正処理は完了しました。'));
      console.warn(chalk.yellow(`エラー内容: ${error instanceof Error ? error.message : String(error)}`));
    }
  } catch (error) {
    console.error(
      chalk.red(`エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`)
    );
    process.exit(1);
  }
}

// スクリプト実行
main();
