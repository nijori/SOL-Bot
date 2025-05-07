/**
 * Todoファイルのパースと検証機能を提供するユーティリティ
 * .todo内のファイルをパースし、以下の検証を行う：
 * - タスクIDの重複検出
 * - 進捗/Health状態の一貫性チェック
 * - 期限切れタスクの検出
 * - Depends-on参照の整合性チェック
 */

import * as fs from 'fs';
import * as path from 'path';
import logger from './logger';

// Todoタスクのフィールド定義
export interface TodoTask {
  id: string;
  title: string;
  dueDate: string | null;
  owner: string | null;
  dependsOn: string[];
  label: string | null;
  health: string | null;
  progress: string | null;
  notes: string | null;
  isCompleted: boolean;
  rawText: string;
  filePath: string;
  lineNumber: number;
}

// 検証エラーの種類
export enum ValidationErrorType {
  DUPLICATE_TASK_ID = 'duplicate_task_id',
  INCONSISTENT_PROGRESS_HEALTH = 'inconsistent_progress_health',
  PAST_DUE_DATE = 'past_due_date',
  INVALID_DEPENDS_ON = 'invalid_depends_on',
  MISSING_REQUIRED_FIELD = 'missing_required_field',
  INVALID_TASK_ID_FORMAT = 'invalid_task_id_format',
  INVALID_PROGRESS_FORMAT = 'invalid_progress_format',
  INVALID_DATE_FORMAT = 'invalid_date_format',
  INVALID_HEALTH_STATUS = 'invalid_health_status',
}

// 検証エラー情報
export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  taskId: string;
  filePath: string;
  lineNumber: number;
}

/**
 * Todo形式のマークダウンファイルからタスクを抽出する
 * @param filePath Todoファイルのパス
 * @returns 解析されたタスクの配列
 */
export function parseTodoFile(filePath: string): TodoTask[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const tasks: TodoTask[] = [];
    
    let currentTask: Partial<TodoTask> | null = null;
    let lineNumber = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      lineNumber = i + 1;
      
      // タスク行の検出 (- [ ] TASK-ID: タイトル または - [x] TASK-ID: タイトル)
      const taskMatch = line.match(/^-\s+\[([ x])\]\s+([A-Z]+-\d{3}):\s+(.+)$/);
      
      if (taskMatch) {
        // 前のタスクがあれば追加
        if (currentTask && currentTask.id) {
          tasks.push(currentTask as TodoTask);
        }
        
        // 新しいタスクを開始
        currentTask = {
          id: taskMatch[2],
          title: taskMatch[3].trim(),
          isCompleted: taskMatch[1] === 'x',
          dependsOn: [],
          rawText: line,
          filePath,
          lineNumber
        };
        
        continue;
      }
      
      // タスクのフィールド行の解析
      if (currentTask && line.trim().startsWith('-')) {
        const fieldMatch = line.match(/^\s+-\s+(.+?)\s+:\s+(.+)$/);
        
        if (fieldMatch) {
          const [, fieldIcon, value] = fieldMatch;
          
          // フィールドタイプを判断して適切なプロパティに設定
          if (fieldIcon.includes('📅') || fieldIcon.includes('Due')) {
            currentTask.dueDate = value.trim();
          } else if (fieldIcon.includes('👤') || fieldIcon.includes('Owner')) {
            currentTask.owner = value.trim();
          } else if (fieldIcon.includes('🔗') || fieldIcon.includes('Depends-on')) {
            currentTask.dependsOn = value.split(',').map(id => id.trim());
          } else if (fieldIcon.includes('🏷️') || fieldIcon.includes('Label')) {
            currentTask.label = value.trim();
          } else if (fieldIcon.includes('🩺') || fieldIcon.includes('Health')) {
            currentTask.health = value.trim();
          } else if (fieldIcon.includes('📊') || fieldIcon.includes('Progress')) {
            currentTask.progress = value.trim();
          } else if (fieldIcon.includes('✎') || fieldIcon.includes('Notes')) {
            currentTask.notes = value.trim();
          }
        }
      }
    }
    
    // 最後のタスクを追加
    if (currentTask && currentTask.id) {
      tasks.push(currentTask as TodoTask);
    }
    
    return tasks;
    
  } catch (error) {
    logger.error(`Todoファイルの解析エラー (${filePath}): ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * 複数のTodoファイルからすべてのタスクを取得する
 * @param todoDir Todoファイルを含むディレクトリ
 * @param filePattern 取得するファイルパターン (例: *.mdc)
 * @returns すべてのTodoタスク
 */
export function getAllTasks(todoDir: string, filePattern: string = '*.mdc'): TodoTask[] {
  try {
    const tasks: TodoTask[] = [];
    const files = fs.readdirSync(todoDir);
    
    // .mdcファイルのみ処理
    const mdcFiles = files.filter(file => file.endsWith('.mdc'));
    
    for (const file of mdcFiles) {
      const filePath = path.join(todoDir, file);
      const fileTasks = parseTodoFile(filePath);
      tasks.push(...fileTasks);
    }
    
    return tasks;
  } catch (error) {
    logger.error(`Todoファイルのスキャンエラー: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * タスクIDの重複をチェックする
 * @param tasks タスクのリスト
 * @returns 検証エラーの配列
 */
export function checkDuplicateTaskIds(tasks: TodoTask[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const idMap = new Map<string, TodoTask>();
  
  for (const task of tasks) {
    if (idMap.has(task.id)) {
      const originalTask = idMap.get(task.id)!;
      
      errors.push({
        type: ValidationErrorType.DUPLICATE_TASK_ID,
        message: `タスクID ${task.id} が重複しています。別の場所: ${originalTask.filePath}:${originalTask.lineNumber}`,
        taskId: task.id,
        filePath: task.filePath,
        lineNumber: task.lineNumber
      });
    } else {
      idMap.set(task.id, task);
    }
  }
  
  return errors;
}

/**
 * 進捗とHealth状態の一貫性をチェックする
 * @param tasks タスクのリスト
 * @returns 検証エラーの配列
 */
export function checkProgressHealthConsistency(tasks: TodoTask[]): ValidationError[] {
  const errors: ValidationError[] = [];
  
  for (const task of tasks) {
    // 完了マークされたタスクのHealthとProgressをチェック
    if (task.isCompleted) {
      // 完了マークされたのにHealth未完了
      if (task.health !== '✅') {
        errors.push({
          type: ValidationErrorType.INCONSISTENT_PROGRESS_HEALTH,
          message: `完了マークされたタスク ${task.id} のHealthが完了(✅)になっていません: ${task.health}`,
          taskId: task.id,
          filePath: task.filePath,
          lineNumber: task.lineNumber
        });
      }
      
      // 完了マークされたのにProgress 100%でない
      if (task.progress !== '100%') {
        errors.push({
          type: ValidationErrorType.INCONSISTENT_PROGRESS_HEALTH,
          message: `完了マークされたタスク ${task.id} の進捗率が100%ではありません: ${task.progress}`,
          taskId: task.id,
          filePath: task.filePath,
          lineNumber: task.lineNumber
        });
      }
    } else {
      // 未完了だがHealthが完了
      if (task.health === '✅' && task.progress !== '100%') {
        errors.push({
          type: ValidationErrorType.INCONSISTENT_PROGRESS_HEALTH,
          message: `タスク ${task.id} のHealthは完了(✅)ですが、進捗率が100%ではありません: ${task.progress}`,
          taskId: task.id,
          filePath: task.filePath,
          lineNumber: task.lineNumber
        });
      }
      
      // 未完了だが進捗率100%
      if (task.progress === '100%' && task.health !== '✅') {
        errors.push({
          type: ValidationErrorType.INCONSISTENT_PROGRESS_HEALTH,
          message: `タスク ${task.id} の進捗率は100%ですが、Healthが完了(✅)ではありません: ${task.health}`,
          taskId: task.id,
          filePath: task.filePath,
          lineNumber: task.lineNumber
        });
      }
    }
  }
  
  return errors;
}

/**
 * 期限切れタスクをチェックする
 * @param tasks タスクのリスト
 * @returns 検証エラーの配列
 */
export function checkPastDueDates(tasks: TodoTask[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const now = new Date();
  
  // yyyy-MM-ddの日付を比較
  now.setHours(0, 0, 0, 0);
  
  for (const task of tasks) {
    // 完了したタスクはスキップ
    if (task.isCompleted) continue;
    
    // 期限がないタスクはスキップ
    if (!task.dueDate) continue;
    
    // 日付形式チェック (YYYY-MM-DD)
    const dateFormatMatch = task.dueDate.match(/^\d{4}-\d{2}-\d{2}$/);
    if (!dateFormatMatch) {
      errors.push({
        type: ValidationErrorType.INVALID_DATE_FORMAT,
        message: `タスク ${task.id} の期限日の形式が不正です。YYYY-MM-DD形式が必要: ${task.dueDate}`,
        taskId: task.id,
        filePath: task.filePath,
        lineNumber: task.lineNumber
      });
      continue;
    }
    
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    // 期限切れチェック
    if (dueDate < now) {
      errors.push({
        type: ValidationErrorType.PAST_DUE_DATE,
        message: `タスク ${task.id} の期限が過ぎています: ${task.dueDate}`,
        taskId: task.id,
        filePath: task.filePath,
        lineNumber: task.lineNumber
      });
    }
  }
  
  return errors;
}

/**
 * Depends-on参照の整合性をチェックする
 * @param tasks タスクのリスト
 * @returns 検証エラーの配列
 */
export function checkDependsOnReferences(tasks: TodoTask[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const taskIdSet = new Set(tasks.map(task => task.id));
  
  for (const task of tasks) {
    if (!task.dependsOn || task.dependsOn.length === 0) continue;
    
    for (const dependsOnId of task.dependsOn) {
      // 空白や無効な値はスキップ
      if (!dependsOnId || dependsOnId === '') continue;
      
      if (!taskIdSet.has(dependsOnId)) {
        errors.push({
          type: ValidationErrorType.INVALID_DEPENDS_ON,
          message: `タスク ${task.id} が存在しないタスク ${dependsOnId} に依存しています`,
          taskId: task.id,
          filePath: task.filePath,
          lineNumber: task.lineNumber
        });
      }
    }
  }
  
  return errors;
}

/**
 * 必須フィールドが揃っているかチェックする
 * @param tasks タスクのリスト
 * @returns 検証エラーの配列
 */
export function checkRequiredFields(tasks: TodoTask[]): ValidationError[] {
  const errors: ValidationError[] = [];
  
  for (const task of tasks) {
    // 必須フィールドリスト
    const requiredFields: {field: keyof TodoTask, name: string}[] = [
      {field: 'dueDate', name: '期限日(Due)'},
      {field: 'owner', name: '担当者(Owner)'},
      {field: 'label', name: 'ラベル(Label)'},
      {field: 'health', name: '状態(Health)'},
      {field: 'progress', name: '進捗率(Progress)'}
    ];
    
    for (const {field, name} of requiredFields) {
      if (!task[field]) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          message: `タスク ${task.id} に必須の ${name} が指定されていません`,
          taskId: task.id,
          filePath: task.filePath,
          lineNumber: task.lineNumber
        });
      }
    }
  }
  
  return errors;
}

/**
 * タスクID形式が正しいかチェックする
 * @param tasks タスクのリスト
 * @returns 検証エラーの配列
 */
export function checkTaskIdFormat(tasks: TodoTask[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const validPattern = /^[A-Z]+-\d{3}$/;
  
  for (const task of tasks) {
    if (!validPattern.test(task.id)) {
      errors.push({
        type: ValidationErrorType.INVALID_TASK_ID_FORMAT,
        message: `タスク ${task.id} のID形式が不正です。正しい形式: XXX-000`,
        taskId: task.id,
        filePath: task.filePath,
        lineNumber: task.lineNumber
      });
    }
  }
  
  return errors;
}

/**
 * 進捗率の形式が正しいかチェックする
 * @param tasks タスクのリスト
 * @returns 検証エラーの配列
 */
export function checkProgressFormat(tasks: TodoTask[]): ValidationError[] {
  const errors: ValidationError[] = [];
  // 修正: 旧形式を維持するが、0-100%の範囲の値も許容する
  const strictPattern = /^(0%|25%|50%|75%|100%)$/;
  const flexiblePattern = /^(\d{1,2}|100)%$/;
  
  for (const task of tasks) {
    if (task.progress && !strictPattern.test(task.progress) && !flexiblePattern.test(task.progress)) {
      errors.push({
        type: ValidationErrorType.INVALID_PROGRESS_FORMAT,
        message: `タスク ${task.id} の進捗率形式が不正です: ${task.progress}、有効値: 0-100%`,
        taskId: task.id,
        filePath: task.filePath,
        lineNumber: task.lineNumber
      });
    }
  }
  
  return errors;
}

/**
 * Health状態の形式が正しいかチェックする
 * @param tasks タスクのリスト
 * @returns 検証エラーの配列
 */
export function checkHealthStatus(tasks: TodoTask[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const validValues = ['⏳', '⚠️', '🚑', '✅'];
  
  for (const task of tasks) {
    if (task.health && !validValues.includes(task.health)) {
      errors.push({
        type: ValidationErrorType.INVALID_HEALTH_STATUS,
        message: `タスク ${task.id} のHealth状態が不正です: ${task.health}、有効値: ⏳, ⚠️, 🚑, ✅`,
        taskId: task.id,
        filePath: task.filePath,
        lineNumber: task.lineNumber
      });
    }
  }
  
  return errors;
}

/**
 * すべての検証を実行する
 * @param todoDir Todoファイルを含むディレクトリ
 * @returns 検証エラーの配列
 */
export function validateTodoFiles(todoDir: string): ValidationError[] {
  // すべてのタスクを取得
  const tasks = getAllTasks(todoDir);
  
  // 各種検証を実施
  const errors = [
    ...checkDuplicateTaskIds(tasks),
    ...checkProgressHealthConsistency(tasks),
    ...checkPastDueDates(tasks),
    ...checkDependsOnReferences(tasks),
    ...checkRequiredFields(tasks),
    ...checkTaskIdFormat(tasks),
    ...checkProgressFormat(tasks),
    ...checkHealthStatus(tasks)
  ];
  
  return errors;
} 