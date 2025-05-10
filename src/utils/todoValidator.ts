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
// loggerの代わりにconsoleを使用
// import logger from './logger.js';

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
  EMPTY_FIELD_VALUE = 'empty_field_value'
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
    let inFrontMatter = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      lineNumber = i + 1;

      // front-matterブロックのスキップ処理 (--- または ``` で囲まれたブロック)
      if (line.trim() === '---' || line.trim() === '```') {
        inFrontMatter = !inFrontMatter;
        continue;
      }

      if (inFrontMatter) {
        continue;
      }

      // タスク行の検出 (- [ ] TASK-ID: タイトル または - [x] TASK-ID: タイトル)
      // 改善: より柔軟なスペース処理と、積極的なマッチングのための正規表現改善
      const taskMatch = line.match(/^-\s*\[([ xX])\]\s*([A-Z]+-\d{3}):\s*(.+)$/);

      if (taskMatch) {
        // 前のタスクがあれば追加
        if (currentTask && currentTask.id) {
          tasks.push(currentTask as TodoTask);
        }

        // 新しいタスクを開始
        currentTask = {
          id: taskMatch[2],
          title: taskMatch[3].trim(),
          isCompleted: taskMatch[1].toLowerCase() === 'x', // 大文字Xも許容
          dependsOn: [],
          rawText: line,
          filePath,
          lineNumber
        };

        continue;
      }

      // タスクのフィールド行の解析（より柔軟なマッチング）
      if (currentTask && line.trim().startsWith('-')) {
        // 改善: より柔軟なフィールドマッチングパターン
        const fieldMatch = line.match(/^\s*-\s+([^:]+?)\s*:\s*(.*)$/);

        if (fieldMatch) {
          const [, fieldIcon, value] = fieldMatch;
          const trimmedValue = value.trim();

          // フィールドタイプを判断して適切なプロパティに設定
          if (fieldIcon.includes('📅') || fieldIcon.toLowerCase().includes('due')) {
            currentTask.dueDate = trimmedValue;
          } else if (fieldIcon.includes('👤') || fieldIcon.toLowerCase().includes('owner')) {
            currentTask.owner = trimmedValue;
          } else if (fieldIcon.includes('🔗') || fieldIcon.toLowerCase().includes('depends-on')) {
            currentTask.dependsOn = trimmedValue
              ? trimmedValue.split(',').map((id) => id.trim())
              : [];
          } else if (fieldIcon.includes('🏷️') || fieldIcon.toLowerCase().includes('label')) {
            currentTask.label = trimmedValue;
          } else if (fieldIcon.includes('🩺') || fieldIcon.toLowerCase().includes('health')) {
            currentTask.health = trimmedValue;
          } else if (fieldIcon.includes('📊') || fieldIcon.toLowerCase().includes('progress')) {
            currentTask.progress = trimmedValue;
          } else if (fieldIcon.includes('✎') || fieldIcon.toLowerCase().includes('notes')) {
            currentTask.notes = trimmedValue;
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
    console.error(
      `Todoファイルの解析エラー (${filePath}): ${error instanceof Error ? error.message : String(error)}`
    );
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
    const mdcFiles = files.filter((file) => file.endsWith('.mdc'));

    for (const file of mdcFiles) {
      const filePath = path.join(todoDir, file);
      const fileTasks = parseTodoFile(filePath);
      tasks.push(...fileTasks);
    }

    return tasks;
  } catch (error) {
    console.error(
      `Todoファイルのスキャンエラー: ${error instanceof Error ? error.message : String(error)}`
    );
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

  // 先頭に「.」があるタスクIDはコメントアウトされたものとして無視
  const activeTaskIds = tasks.filter((task) => !task.id.startsWith('.'));

  for (const task of activeTaskIds) {
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
 * 日付文字列が有効なフォーマットかチェックする
 * YYYY-MM-DD形式かを検証する
 * @param dateStr 日付文字列
 * @returns 有効な場合はtrue、無効な場合はfalse
 */
export function isValidDateFormat(dateStr: string): boolean {
  // YYYY-MM-DD形式の正規表現（より厳密なバリデーション）
  const datePattern = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

  if (!datePattern.test(dateStr)) {
    return false;
  }

  // 日付として有効かチェック（例：2月30日などの無効な日付を検出）
  const date = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(date.getTime())) {
    return false;
  }

  // 月と日が元の入力と一致するか確認（例：2023-02-31 → 2023-03-03 になる問題の検出）
  const parts = dateStr.split('-').map(Number);
  const month = date.getUTCMonth() + 1; // getUTCMonth()は0-11を返す
  const day = date.getUTCDate();

  return parts[1] === month && parts[2] === day;
}

/**
 * 期限切れタスクをチェックする
 * @param tasks タスクのリスト
 * @returns 検証エラーの配列
 */
export function checkPastDueDates(tasks: TodoTask[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const task of tasks) {
    // 完了タスクまたは期限日なしの場合はスキップ
    if (task.isCompleted || !task.dueDate) {
      continue;
    }

    // 日付フォーマットが不正な場合はフォーマットエラーを追加
    if (!isValidDateFormat(task.dueDate)) {
      errors.push({
        type: ValidationErrorType.INVALID_DATE_FORMAT,
        message: `タスク ${task.id} の期限日フォーマットが不正です: ${task.dueDate}、正しい形式: YYYY-MM-DD`,
        taskId: task.id,
        filePath: task.filePath,
        lineNumber: task.lineNumber
      });
      continue;
    }

    try {
      // タイムゾーン統一のため、日付をUTC正規化して比較
      const dueDate = new Date(task.dueDate + 'T00:00:00Z');

      if (dueDate < today) {
        errors.push({
          type: ValidationErrorType.PAST_DUE_DATE,
          message: `タスク ${task.id} の期限が過ぎています: ${task.dueDate}`,
          taskId: task.id,
          filePath: task.filePath,
          lineNumber: task.lineNumber
        });
      }
    } catch (error) {
      // 無効な日付フォーマットはisValidDateFormat()で既にキャッチされているはず
      continue;
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
  const taskIdSet = new Set(tasks.map((task) => task.id));

  for (const task of tasks) {
    if (!task.dependsOn || task.dependsOn.length === 0) continue;

    for (const dependsOnId of task.dependsOn) {
      // 空白や無効な値はスキップ
      if (!dependsOnId || dependsOnId === '') continue;

      // 先頭に「.」があるIDは参照が有効か確認しない（アーカイブされたタスク）
      if (dependsOnId.startsWith('.')) continue;

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
 * 必須フィールドをチェックする
 * @param tasks タスクのリスト
 * @returns 検証エラーの配列
 */
export function checkRequiredFields(tasks: TodoTask[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const requiredFields: Array<keyof TodoTask> = ['dueDate', 'owner', 'label', 'health', 'progress'];

  for (const task of tasks) {
    for (const field of requiredFields) {
      // 未設定または空文字の場合はエラー
      if (!task[field] || task[field] === '') {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          message: `タスク ${task.id} の必須フィールド ${field} が設定されていません`,
          taskId: task.id,
          filePath: task.filePath,
          lineNumber: task.lineNumber
        });
      }
    }

    // 空文字値のチェック (特に設定されているが空の場合)
    for (const field of Object.keys(task) as Array<keyof TodoTask>) {
      if (
        ['dueDate', 'owner', 'label', 'health', 'progress', 'notes'].includes(field as string) &&
        task[field] === ''
      ) {
        errors.push({
          type: ValidationErrorType.EMPTY_FIELD_VALUE,
          message: `タスク ${task.id} のフィールド ${field} が空です`,
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
  const archivedPattern = /^\.[A-Z]+-\d{3}$/; // アーカイブタスク用のパターン

  for (const task of tasks) {
    // アーカイブされたタスク（先頭に「.」があるもの）は別パターンで検証
    if (task.id.startsWith('.')) {
      if (!archivedPattern.test(task.id)) {
        errors.push({
          type: ValidationErrorType.INVALID_TASK_ID_FORMAT,
          message: `アーカイブタスク ${task.id} のID形式が不正です。正しい形式: .XXX-000`,
          taskId: task.id,
          filePath: task.filePath,
          lineNumber: task.lineNumber
        });
      }
    } else if (!validPattern.test(task.id)) {
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
    if (
      task.progress &&
      !strictPattern.test(task.progress) &&
      !flexiblePattern.test(task.progress)
    ) {
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
 * 日付フォーマットをチェックする
 * @param tasks タスクのリスト
 * @returns 検証エラーの配列
 */
export function checkDateFormat(tasks: TodoTask[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const task of tasks) {
    if (task.dueDate && !isValidDateFormat(task.dueDate)) {
      errors.push({
        type: ValidationErrorType.INVALID_DATE_FORMAT,
        message: `タスク ${task.id} の期限日付フォーマットが無効です: ${task.dueDate}`,
        taskId: task.id,
        filePath: task.filePath,
        lineNumber: task.lineNumber
      });
    }
  }

  return errors;
}

/**
 * フィールド値が空でないことをチェックする
 * @param tasks タスクのリスト
 * @returns 検証エラーの配列
 */
export function checkEmptyFieldValues(tasks: TodoTask[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const task of tasks) {
    // 必須フィールドに値が設定されていて、かつ空白だけではないことをチェック
    if (task.dueDate !== null && task.dueDate.trim() === '') {
      errors.push({
        type: ValidationErrorType.EMPTY_FIELD_VALUE,
        message: `タスク ${task.id} の期限日付が空です`,
        taskId: task.id,
        filePath: task.filePath,
        lineNumber: task.lineNumber
      });
    }

    if (task.owner !== null && task.owner.trim() === '') {
      errors.push({
        type: ValidationErrorType.EMPTY_FIELD_VALUE,
        message: `タスク ${task.id} の担当者が空です`,
        taskId: task.id,
        filePath: task.filePath,
        lineNumber: task.lineNumber
      });
    }

    if (task.label !== null && task.label.trim() === '') {
      errors.push({
        type: ValidationErrorType.EMPTY_FIELD_VALUE,
        message: `タスク ${task.id} のラベルが空です`,
        taskId: task.id,
        filePath: task.filePath,
        lineNumber: task.lineNumber
      });
    }

    if (task.health !== null && task.health.trim() === '') {
      errors.push({
        type: ValidationErrorType.EMPTY_FIELD_VALUE,
        message: `タスク ${task.id} のHealth状態が空です`,
        taskId: task.id,
        filePath: task.filePath,
        lineNumber: task.lineNumber
      });
    }

    if (task.progress !== null && task.progress.trim() === '') {
      errors.push({
        type: ValidationErrorType.EMPTY_FIELD_VALUE,
        message: `タスク ${task.id} の進捗率が空です`,
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
  try {
    // Todoディレクトリの存在確認
    if (!fs.existsSync(todoDir)) {
      throw new Error(`Todoディレクトリが存在しません: ${todoDir}`);
    }

    // すべてのタスクを取得
    const tasks = getAllTasks(todoDir);

    // タスクが取得できなかった場合のエラーハンドリング
    if (tasks.length === 0) {
      console.warn(
        `警告: ${todoDir} ディレクトリにタスクが見つかりませんでした。ファイル形式や内容を確認してください。`
      );
    }

    // 各種検証を実行
    const errors: ValidationError[] = [
      ...checkDuplicateTaskIds(tasks),
      ...checkProgressHealthConsistency(tasks),
      ...checkPastDueDates(tasks),
      ...checkDependsOnReferences(tasks),
      ...checkRequiredFields(tasks),
      ...checkTaskIdFormat(tasks),
      ...checkProgressFormat(tasks),
      ...checkHealthStatus(tasks),
      ...checkDateFormat(tasks),
      ...checkEmptyFieldValues(tasks)
    ];

    return errors;
  } catch (error) {
    console.error(
      `Todoファイルの検証中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
    );
    // エラーを再スローして呼び出し元で処理できるようにする
    throw error;
  }
}
