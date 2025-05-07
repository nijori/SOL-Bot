#!/usr/bin/env node
/**
 * fix-todo-issues.ts - Todoタスクの問題を自動修正するスクリプト
 * 
 * 使い方:
 * ts-node src/scripts/fix-todo-issues.ts
 * 
 * 以下の問題を自動修正します:
 * 1. 完了済みタスクの進捗率(Progress)フィールドがない場合、100%を追加
 * 2. 完了済みタスクのHealth状態が✅以外の場合、✅に修正
 * 3. タスクIDの重複を検出し、番号を変更して修正（古いものにサフィックスを追加）
 * 4. 存在しないタスクIDへの依存参照を削除
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { TodoTask, ValidationError, validateTodoFiles } from '../utils/todoValidator';
import chalk from 'chalk';

// プロジェクトルートからの相対パス
const TODO_DIR = path.join(__dirname, '../../.todo');
const ARCHIVE_FILE = path.join(TODO_DIR, 'archive.mdc');
const BACKUP_FILE = path.join(TODO_DIR, 'archive.mdc.bak');

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
 * 完了済みタスクの進捗率とHealth状態を修正
 */
async function fixCompletedTasksProgress(): Promise<void> {
  console.log(chalk.blue('完了済みタスクの進捗率とHealth状態を修正しています...'));

  let inTask = false;
  let isCompletedTask = false;
  let hasProgressField = false;
  let hasHealthField = false;
  let taskIndentation = '';
  let taskId = '';

  await processFileLineByLine(
    ARCHIVE_FILE,
    ARCHIVE_FILE,
    (line, lineNumber) => {
      // タスク行を検出
      const taskMatch = line.match(/^(-\s+\[)([ x])(\].+)$/);
      if (taskMatch) {
        inTask = true;
        isCompletedTask = taskMatch[2] === 'x';
        hasProgressField = false;
        hasHealthField = false;
        taskIndentation = line.match(/^(\s*)-/)?.[1] || '';
        
        // タスクIDを取得
        const idMatch = line.match(/^-\s+\[[ x]\]\s+([A-Z]+-\d{3}[a-z]?(?:-\d+)?):/);
        if (idMatch) {
          taskId = idMatch[1];
        }
      } 
      // タスク内のフィールド行を処理
      else if (inTask && line.trim().startsWith('-')) {
        if (line.includes('📊 Progress')) {
          hasProgressField = true;
          // 完了済みタスクなのに進捗率が100%でない場合、修正
          if (isCompletedTask && !line.includes('100%')) {
            return line.replace(/Progress\s+:\s+.*/, 'Progress   : 100%');
          }
        } else if (line.includes('🩺 Health')) {
          hasHealthField = true;
          // 完了済みタスクなのにHealthが✅でない場合、修正
          if (isCompletedTask && !line.includes('✅')) {
            return line.replace(/Health\s+:\s+.*/, 'Health     : ✅');
          }
        } else if (line.includes('🔗 Depends-on')) {
          // 無効な依存参照を削除
          if (line.includes('INF-011') || line.includes('DAT-002') || line.includes('ALG-015-1') || line.includes('ALG-016-1')) {
            const updatedDeps = line.replace(/INF-011,?\s*/g, '')
                                    .replace(/DAT-002,?\s*/g, '')
                                    .replace(/ALG-015-1,?\s*/g, '')
                                    .replace(/ALG-016-1,?\s*/g, '')
                                    .replace(/Depends-on\s+:\s+,/g, 'Depends-on : ')
                                    .replace(/,\s*$/g, ''); // 末尾のカンマを削除
            
            // すべての依存関係が削除された場合、空の依存関係リストにする
            if (updatedDeps.match(/Depends-on\s+:\s*$/)) {
              return updatedDeps.trim();
            }
            return updatedDeps;
          }
        }
      }
      // タスク終了の検出（空行または新しいタスク）
      else if (inTask && (line.trim() === '' || line.match(/^-\s+\[/))) {
        // 完了済みタスクで進捗率が設定されていない場合、追加する
        if (isCompletedTask && !hasProgressField) {
          const progressLine = `${taskIndentation}      - 📊 Progress   : 100%`;
          const result = `${progressLine}\n${line}`;
          
          inTask = line.match(/^-\s+\[/) !== null;
          isCompletedTask = inTask && line.match(/^-\s+\[x\]/) !== null;
          hasProgressField = false;
          hasHealthField = false;
          
          // 新しいタスク行の場合、タスクIDを更新
          if (inTask) {
            const idMatch = line.match(/^-\s+\[[ x]\]\s+([A-Z]+-\d{3}[a-z]?(?:-\d+)?):/);
            if (idMatch) {
              taskId = idMatch[1];
            }
          }
          
          return result;
        }
        
        // 完了済みタスクでHealth状態が設定されていない場合、追加する
        if (isCompletedTask && !hasHealthField) {
          const healthLine = `${taskIndentation}      - 🩺 Health     : ✅`;
          const result = `${healthLine}\n${line}`;
          
          inTask = line.match(/^-\s+\[/) !== null;
          isCompletedTask = inTask && line.match(/^-\s+\[x\]/) !== null;
          hasProgressField = false;
          hasHealthField = false;
          
          // 新しいタスク行の場合、タスクIDを更新
          if (inTask) {
            const idMatch = line.match(/^-\s+\[[ x]\]\s+([A-Z]+-\d{3}[a-z]?(?:-\d+)?):/);
            if (idMatch) {
              taskId = idMatch[1];
            }
          }
          
          return result;
        }
        
        inTask = line.match(/^-\s+\[/) !== null;
        isCompletedTask = inTask && line.match(/^-\s+\[x\]/) !== null;
        hasProgressField = false;
        hasHealthField = false;
        
        // 新しいタスク行の場合、タスクIDを更新
        if (inTask) {
          const idMatch = line.match(/^-\s+\[[ x]\]\s+([A-Z]+-\d{3}[a-z]?(?:-\d+)?):/);
          if (idMatch) {
            taskId = idMatch[1];
          }
        }
      }
      
      return line;
    }
  );

  console.log(chalk.green('✓ 完了済みタスクの進捗率とHealth状態を修正しました'));
}

/**
 * タスクIDの重複を修正
 */
async function fixDuplicateTaskIds(): Promise<void> {
  console.log(chalk.blue('タスクIDの重複を修正しています...'));
  
  // バックアップ作成
  fs.copyFileSync(ARCHIVE_FILE, BACKUP_FILE);
  
  // タスクIDの出現位置をマップ
  const taskIdMap = new Map<string, TaskIdLocation[]>();
  
  // ファイルを一行ずつ読み込み、タスクIDを収集
  const fileStream = fs.createReadStream(ARCHIVE_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  let lineNumber = 0;
  
  for await (const line of rl) {
    lineNumber++;
    const taskMatch = line.match(/^-\s+\[[ x]\]\s+([A-Z]+-\d{3}[a-z]?):/);
    
    if (taskMatch) {
      const taskId = taskMatch[1];
      
      if (!taskIdMap.has(taskId)) {
        taskIdMap.set(taskId, []);
      }
      
      taskIdMap.get(taskId)!.push({
        taskId,
        filePath: ARCHIVE_FILE,
        lineNumber
      });
    }
  }
  
  // 重複するタスクIDを検出
  const duplicateTaskIds = Array.from(taskIdMap.entries())
    .filter(([, locations]) => locations.length > 1)
    .map(([taskId, locations]) => {
      // 古い出現位置にサフィックスを追加
      const sortedLocations = [...locations].sort((a, b) => a.lineNumber - b.lineNumber);
      
      for (let i = 1; i < sortedLocations.length; i++) {
        const baseId = taskId.replace(/[a-z]$/, '');
        const newTaskId = `${baseId}-${i}`;
        sortedLocations[i].originalTaskId = taskId;
        sortedLocations[i].taskId = newTaskId;
      }
      
      return sortedLocations;
    })
    .flat();
  
  if (duplicateTaskIds.length === 0) {
    console.log(chalk.green('✓ タスクIDの重複はありません'));
    return;
  }
  
  // 重複するタスクIDを修正
  const fileContent = fs.readFileSync(ARCHIVE_FILE, 'utf-8');
  const lines = fileContent.split('\n');
  
  for (const location of duplicateTaskIds) {
    const { lineNumber, originalTaskId, taskId } = location;
    if (!originalTaskId || !taskId) continue;
    
    // 行番号は1始まりなので、配列のインデックスは0始まり
    const lineIndex = lineNumber - 1;
    lines[lineIndex] = lines[lineIndex].replace(originalTaskId, taskId);
    
    // 依存関係の参照も更新
    for (let i = 0; i < lines.length; i++) {
      if (i === lineIndex) continue;
      
      if (lines[i].includes('🔗 Depends-on') && lines[i].includes(originalTaskId)) {
        lines[i] = lines[i].replace(
          new RegExp(`${originalTaskId}(,|\\s|$)`, 'g'), 
          `${taskId}$1`
        );
      }
    }
  }
  
  fs.writeFileSync(ARCHIVE_FILE, lines.join('\n'));
  console.log(chalk.green(`✓ ${duplicateTaskIds.length}件のタスクID重複を修正しました`));
}

/**
 * 無効な依存参照を修正
 */
async function fixInvalidDependencies(): Promise<void> {
  console.log(chalk.blue('無効な依存参照を修正しています...'));
  
  // 全タスクIDのリストを収集
  const fileContent = fs.readFileSync(ARCHIVE_FILE, 'utf-8');
  const lines = fileContent.split('\n');
  
  const validTaskIds = new Set<string>();
  
  for (const line of lines) {
    const taskMatch = line.match(/^-\s+\[[ x]\]\s+([A-Z]+-\d{3}[a-z]?(?:-\d+)?):/);
    if (taskMatch) {
      validTaskIds.add(taskMatch[1]);
    }
  }
  
  // 無効な依存参照を検出して修正
  let result = '';
  let inDependency = false;
  
  for (const line of lines) {
    if (line.includes('🔗 Depends-on')) {
      inDependency = true;
      const dependsMatch = line.match(/Depends-on\s+:\s+(.*)/);
      
      if (dependsMatch) {
        const dependencies = dependsMatch[1].split(',').map(dep => dep.trim());
        const validDependencies = dependencies.filter(dep => validTaskIds.has(dep));
        
        if (validDependencies.length === 0) {
          // 有効な依存関係がない場合は空の依存関係を設定
          result += line.replace(/Depends-on\s+:.*/, 'Depends-on : ') + '\n';
        } else {
          // 有効な依存関係のみに更新
          result += line.replace(/Depends-on\s+:.*/, `Depends-on : ${validDependencies.join(', ')}`) + '\n';
        }
        continue;
      }
    }
    
    result += line + '\n';
  }
  
  // 最後の改行を削除
  result = result.replace(/\n$/, '');
  
  // ファイルに書き戻す
  fs.writeFileSync(ARCHIVE_FILE, result);
  
  console.log(chalk.green('✓ 無効な依存参照を修正しました'));
}

/**
 * メイン処理
 */
async function main() {
  try {
    console.log(chalk.blue(`🔧 ${TODO_DIR} のTodoタスクの問題を修正しています...\n`));
    
    // バックアップを作成
    fs.copyFileSync(ARCHIVE_FILE, BACKUP_FILE);
    console.log(chalk.gray(`バックアップを作成しました: ${BACKUP_FILE}`));
    
    // 問題を修正
    await fixCompletedTasksProgress();
    await fixDuplicateTaskIds();
    await fixInvalidDependencies();
    
    // 検証を実行して残りの問題を確認
    const errors = validateTodoFiles(TODO_DIR);
    
    if (errors.length === 0) {
      console.log(chalk.green('\n✓ すべての問題が修正されました！'));
    } else {
      console.log(chalk.yellow(`\n⚠️ ${errors.length}件の問題が残っています。\n`));
      console.log(chalk.yellow('残りの問題を確認するには次のコマンドを実行してください:'));
      console.log(chalk.cyan('npm run todo-lint'));
    }
    
  } catch (error) {
    console.error(chalk.red(`エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`));
    
    // バックアップから復元
    if (fs.existsSync(BACKUP_FILE)) {
      fs.copyFileSync(BACKUP_FILE, ARCHIVE_FILE);
      console.log(chalk.yellow(`バックアップから復元しました: ${ARCHIVE_FILE}`));
    }
    
    process.exit(1);
  }
}

// スクリプト実行
main(); 