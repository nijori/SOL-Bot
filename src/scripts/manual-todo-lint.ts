#!/usr/bin/env node
/**
 * manual-todo-lint.ts - Todoタスク検証の簡易実装
 * 
 * このスクリプトはtodo-lintのNode.js依存部分を最小限にした簡易版です。
 * todo-lintが動作しない場合の代替手段として使用します。
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESMでは__dirnameがないため、import.meta.urlを使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトルートからの相対パス
const TODO_DIR = path.join(__dirname, '../../.todo');

// タスクの正規表現
const TASK_REGEX = /^-\s*\[([ xX])\]\s*([A-Z]+-\d{3}):\s*(.+)$/;
const FIELD_REGEX = /^\s*-\s+([^:]+?)\s*:\s*(.*)$/;

// 日付の正規表現
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Health状態の有効値
const VALID_HEALTH_VALUES = ['⏳', '⚠️', '🚑', '✅'];

// 問題点を格納する配列
const errors: any[] = [];

// タスクIDをキーとするマップ
const taskIdMap = new Map<string, { file: string, line: number }>();

/**
 * タスクの解析
 */
function parseTodoFile(filePath: string): void {
  console.log(`ファイルを解析中: ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let currentTaskId: string | null = null;
    let currentTaskCompleted = false;
    let lineNumber = 0;
    let inFrontMatter = false;
    
    // タスクのフィールド
    let dueDate: string | null = null;
    let owner: string | null = null;
    let label: string | null = null;
    let health: string | null = null;
    let progress: string | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      lineNumber = i + 1;
      
      // front-matterブロックのスキップ処理
      if (line.trim() === '---' || line.trim() === '```') {
        inFrontMatter = !inFrontMatter;
        continue;
      }
      
      if (inFrontMatter) {
        continue;
      }
      
      // タスク行の検出
      const taskMatch = line.match(TASK_REGEX);
      
      if (taskMatch) {
        // 前のタスクが存在する場合は検証
        if (currentTaskId) {
          validateTask(currentTaskId, currentTaskCompleted, dueDate, owner, label, health, progress, filePath, lineNumber - 1);
        }
        
        // 新しいタスクを開始
        currentTaskId = taskMatch[2];
        currentTaskCompleted = taskMatch[1].toLowerCase() === 'x';
        
        // タスクIDの重複チェック
        if (!currentTaskId.startsWith('.') && taskIdMap.has(currentTaskId)) {
          const existing = taskIdMap.get(currentTaskId)!;
          errors.push({
            type: 'タスクID重複',
            message: `タスクID ${currentTaskId} が重複しています。別の場所: ${existing.file}:${existing.line}`,
            file: filePath,
            line: lineNumber
          });
        } else {
          taskIdMap.set(currentTaskId, { file: filePath, line: lineNumber });
        }
        
        // フィールドをリセット
        dueDate = null;
        owner = null;
        label = null;
        health = null;
        progress = null;
        
        continue;
      }
      
      // タスクのフィールド行の解析
      if (currentTaskId && line.trim().startsWith('-')) {
        const fieldMatch = line.match(FIELD_REGEX);
        
        if (fieldMatch) {
          const [, fieldIcon, value] = fieldMatch;
          const trimmedValue = value.trim();
          
          // フィールドタイプを判断して設定
          if (fieldIcon.includes('📅') || fieldIcon.toLowerCase().includes('due')) {
            dueDate = trimmedValue;
          } else if (fieldIcon.includes('👤') || fieldIcon.toLowerCase().includes('owner')) {
            owner = trimmedValue;
          } else if (fieldIcon.includes('🏷️') || fieldIcon.toLowerCase().includes('label')) {
            label = trimmedValue;
          } else if (fieldIcon.includes('🩺') || fieldIcon.toLowerCase().includes('health')) {
            health = trimmedValue;
          } else if (fieldIcon.includes('📊') || fieldIcon.toLowerCase().includes('progress')) {
            progress = trimmedValue;
          }
        }
      }
    }
    
    // 最後のタスクを検証
    if (currentTaskId) {
      validateTask(currentTaskId, currentTaskCompleted, dueDate, owner, label, health, progress, filePath, lineNumber);
    }
  } catch (error) {
    console.error(`ファイル解析エラー (${filePath}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * タスクの検証
 */
function validateTask(
  taskId: string, 
  isCompleted: boolean, 
  dueDate: string | null, 
  owner: string | null, 
  label: string | null, 
  health: string | null, 
  progress: string | null, 
  filePath: string, 
  lineNumber: number
): void {
  // 必須フィールドの確認
  if (!dueDate) {
    errors.push({
      type: '必須フィールド欠落',
      message: `タスク ${taskId} に期限日付(Due)が設定されていません`,
      file: filePath,
      line: lineNumber
    });
  } else if (!DATE_REGEX.test(dueDate)) {
    errors.push({
      type: '日付形式不正',
      message: `タスク ${taskId} の期限日付フォーマットが無効です: ${dueDate}`,
      file: filePath,
      line: lineNumber
    });
  }
  
  if (!owner) {
    errors.push({
      type: '必須フィールド欠落',
      message: `タスク ${taskId} に担当者(Owner)が設定されていません`,
      file: filePath,
      line: lineNumber
    });
  }
  
  if (!label) {
    errors.push({
      type: '必須フィールド欠落',
      message: `タスク ${taskId} にラベル(Label)が設定されていません`,
      file: filePath,
      line: lineNumber
    });
  }
  
  if (!health) {
    errors.push({
      type: '必須フィールド欠落',
      message: `タスク ${taskId} にHealth状態が設定されていません`,
      file: filePath,
      line: lineNumber
    });
  } else if (!VALID_HEALTH_VALUES.includes(health)) {
    errors.push({
      type: 'Health状態不正',
      message: `タスク ${taskId} のHealth状態が無効です: ${health}`,
      file: filePath,
      line: lineNumber
    });
  }
  
  if (!progress) {
    errors.push({
      type: '必須フィールド欠落',
      message: `タスク ${taskId} に進捗率(Progress)が設定されていません`,
      file: filePath,
      line: lineNumber
    });
  } else if (!progress.endsWith('%')) {
    errors.push({
      type: '進捗率形式不正',
      message: `タスク ${taskId} の進捗率形式が不正です: ${progress}`,
      file: filePath,
      line: lineNumber
    });
  }
  
  // 完了マークされたタスクの整合性チェック
  if (isCompleted) {
    // 完了マークされたのにHealth未完了
    if (health !== '✅') {
      errors.push({
        type: '進捗/Health不整合',
        message: `完了マークされたタスク ${taskId} のHealthが完了(✅)になっていません: ${health}`,
        file: filePath,
        line: lineNumber
      });
    }
    
    // 完了マークされたのにProgress 100%でない
    if (progress !== '100%') {
      errors.push({
        type: '進捗/Health不整合',
        message: `完了マークされたタスク ${taskId} の進捗率が100%ではありません: ${progress}`,
        file: filePath,
        line: lineNumber
      });
    }
  } else {
    // 未完了だがHealthが完了
    if (health === '✅' && progress !== '100%') {
      errors.push({
        type: '進捗/Health不整合',
        message: `タスク ${taskId} のHealthは完了(✅)ですが、進捗率が100%ではありません: ${progress}`,
        file: filePath,
        line: lineNumber
      });
    }
  }
}

/**
 * メイン処理
 */
function main() {
  try {
    console.log(`🔍 ${TODO_DIR} のTodoタスクを検証中...\n`);
    
    if (!fs.existsSync(TODO_DIR)) {
      console.error(`エラー: Todoディレクトリが見つかりません: ${TODO_DIR}`);
      process.exit(1);
    }
    
    const files = fs.readdirSync(TODO_DIR);
    const mdcFiles = files.filter(file => file.endsWith('.mdc'));
    
    if (mdcFiles.length === 0) {
      console.warn(`警告: ${TODO_DIR} ディレクトリに .mdc ファイルが見つかりませんでした。`);
      process.exit(0);
    }
    
    // 各ファイルを解析
    for (const file of mdcFiles) {
      parseTodoFile(path.join(TODO_DIR, file));
    }
    
    // 結果の表示
    if (errors.length === 0) {
      console.log('✓ すべてのTodoタスクは有効です！');
      process.exit(0);
    } else {
      console.log(`❌ ${errors.length}件の問題が見つかりました:\n`);
      
      // エラータイプ別にグループ化
      const errorsByType = errors.reduce((groups, error) => {
        if (!groups[error.type]) {
          groups[error.type] = [];
        }
        groups[error.type].push(error);
        return groups;
      }, {} as Record<string, any[]>);
      
      // タイプ別に表示
      for (const [type, typeErrors] of Object.entries(errorsByType)) {
        console.log(`\n【${type}】- ${typeErrors.length}件`);
        
        typeErrors.forEach((error) => {
          console.log(`  • ${path.basename(error.file)}:${error.line} - ${error.message}`);
        });
      }
      
      console.log('\n');
      process.exit(1);
    }
  } catch (error) {
    console.error(`予期せぬエラーが発生しました: ${error}`);
    process.exit(1);
  }
}

// メイン処理を実行
main(); 