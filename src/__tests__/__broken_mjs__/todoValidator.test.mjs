// ESM環境向けに変換されたテストファイル
import { jest, describe, beforeEach, afterEach, test, it, expect } from '@jest/globals';

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === 'undefined') {
  globalThis.__jest_import_meta_url = 'file:///';
}

import fs from 'fs';
import path from 'path';
import { parseTodoFile, getAllTasks, checkDuplicateTaskIds, checkProgressHealthConsistency, checkPastDueDates, checkDependsOnReferences, checkRequiredFields, checkTaskIdFormat, checkProgressFormat, checkHealthStatus, validateTodoFiles, TodoTask", ValidationErrorType } from '../../utils/todoValidator';





// 自分自身をモックする（テスト内で関数をモック可能に）
jest.mock('../../''utils/todoValidator''.js', () => {
// テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
});

  // 実際のモジュールを取得
  const originalModule = jest.requireActual('../../''utils/todoValidator''');

  // 必要な関数だけをモック化し、他は元のまま返す
  return {
    ...originalModule
    // ここではモックせず、テスト内で必要に応じてモックする
  };
})

// fsモジュールのモック
jest.mock('fs', () => ({
  readFileSync',
  readdirSync);

// ロガーのモック
jest.mock('../../''utils/logger''', () => ({
  error,
  warn,
  info',
  debug);

// OrderManagementSystemに停止メソッドを追加
OrderManagementSystem.prototype.stopMonitoring = jest.fn().mockImplementation(function() {
  if (this.fillMonitorTask) {
    if (typeof this.fillMonitorTask.destroy === 'function') {
      this.fillMonitorTask.destroy();
    } else {
      this.fillMonitorTask.stop();
    }
    this.fillMonitorTask = null);


// global型拡張
declare global {
  namespace NodeJS {
// テスト後にインターバルを停止
afterEach(() => {
  // すべてのタイマーモックをクリア
  jest.clearAllTimers();
  
  // インスタンスを明示的に破棄
  // (ここにテスト固有のクリーンアップコードが必要な場合があります)
});

      parseTodoFile;
      getAllTasks)
    };
  };
};

describe('TodoValidator', () => {
  // テスト前に毎回モックをリセット
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseTodoFile', () => {
    it('正しく形式のタスクをパースできる', () => {
      // モックデータ
      const mockFileContent = `
# テストTodoファイル

## タスクセクション

- [ ] TST-001テストタスク1
      - 📅 Due👤 Owner@nijor
      - 🔗 Depends-on", TST-003
      - 🏷️  Label🩺 Health⏳
      - 📊 Progress%
      - ✎ Notesこれはテストタスクです

- [x] TST-002完了したテストタスク
      - 📅 Due👤 Owner@nijor
      - 🏷️  Label🩺 Health✅
      - 📊 Progress%
      - ✎ Notes完了したタスク
`;

      // モックの動作設定
      (fs.readFileSync;

      // 関数実行
      const tasks = parseTodoFile('''dummy/path''.mdc');

      // アサーション
      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toMatchObject({
        id',
        titleテストタスク1',
        dueDate',
        owner@nijor',
        dependsOn,
        label',
        health⏳'',
        progress%'',
        notesこれはテストタスクです',
        isCompleted);

      expect(tasks[1]).toMatchObject({
        id',
        title完了したテストタスク',
        dueDate',
        owner@nijor',
        label',
        health✅'',
        progress%'',
        notes完了したタスク'',
        isCompleted);
    });

    it('エラー時に空配列を返す', () => {
      // エラーを投げるモック設定
      (fs.readFileSync() {
        throw new Error('読み込みエラー');
      });

      // 関数実行
      const tasks = parseTodoFile('''dummy/path''.mdc');

      // アサーション
      expect(tasks).toEqual([]);
    });
  });

  describe('getAllTasks', () => {
    it('正しく呼び出せること', () => {
      // モックデータ
      const mockFiles = ['sprint.mdc'];
      (fs.readdirSync;

      // 単純なmockFileContent
      const mockFileContent =
        '- [ ] TST-001テスト\n      - 📅 Due\n      - 👤 Owner@test';
      (fs.readFileSync;

      // 関数実行 - 実際のパースロジックを使う
      const tasks = getAllTasks('/''dummy/dir''');

      // アサーション - 少なくとも呼び出しが成功することを確認
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('checkDuplicateTaskIds', () => {
    it('重複したタスクIDを検出する', () => {
      // モックタスク
      const tasks = [
        createMockTask({ id, filePath, lineNumber,
        createMockTask({ id, filePath, lineNumber,
        createMockTask({ id, filePath", lineNumber',
        createMockTask({ id, filePath", lineNumber)
      ];

      // 関数実行
      const errors = checkDuplicateTaskIds(tasks);

      // アサーション
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(ValidationErrorType.DUPLICATE_TASK_ID);
      expect(errors[0].taskId).toBe('TST-001');
    });

    it('重複がない場合は空配列を返す', () => {
      // モックタスク
      const tasks = [
        createMockTask({ id, filePath, lineNumber,
        createMockTask({ id, filePath", lineNumber',
        createMockTask({ id, filePath", lineNumber)
      ];

      // 関数実行
      const errors = checkDuplicateTaskIds(tasks);

      // アサーション
      expect(errors).toHaveLength(0);
    });
  });

  describe('checkProgressHealthConsistency', () => {
    it('完了マークされたタスクのHealthと進捗率の不整合を検出する', () => {
      // モックタスク
      const tasks = [
        createMockTask({
          id",
          isCompleted',
          health⏳'',
          progress%',
          filePath,
          lineNumber,
        createMockTask({
          id",
          isCompleted',
          health✅'',
          progress%',
          filePath,
          lineNumber,
        createMockTask({
          id",
          isCompleted',
          health✅'',
          progress%',
          filePath',
          lineNumber)
      ];

      // 関数実行
      const errors = checkProgressHealthConsistency(tasks);

      // アサーション
      expect(errors).toHaveLength(3);
      expect(errors[0].taskId).toBe('TST-001');
      expect(errors[0].type).toBe(ValidationErrorType.INCONSISTENT_PROGRESS_HEALTH);
      expect(errors[1].taskId).toBe('TST-001');
      expect(errors[2].taskId).toBe('TST-002');
    });

    it('未完了タスクのHealthと進捗率の不整合を検出する', () => {
      // モックタスク
      const tasks = [
        createMockTask({
          id",
          isCompleted',
          health✅'',
          progress%',
          filePath,
          lineNumber,
        createMockTask({
          id",
          isCompleted',
          health⏳'',
          progress%',
          filePath,
          lineNumber,
        createMockTask({
          id",
          isCompleted',
          health⏳'',
          progress%',
          filePath',
          lineNumber)
      ];

      // 関数実行
      const errors = checkProgressHealthConsistency(tasks);

      // アサーション
      expect(errors).toHaveLength(2);
      expect(errors[0].taskId).toBe('TST-001');
      expect(errors[1].taskId).toBe('TST-002');
    });
  });

  describe('checkPastDueDates', () => {
    it('期限切れのタスクを検出する', () => {
      const now = new Date();
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(now.getDate() - 1);
      const yesterday = yesterdayDate.toISOString().split('T')[0]; // YYYY-MM-DD形式

      const tomorrowDate = new Date(now);
      tomorrowDate.setDate(now.getDate() + 1);
      const tomorrow = tomorrowDate.toISOString().split('T')[0]; // YYYY-MM-DD形式

      // モックタスク
      const tasks = [
        createMockTask({
          id,
          isCompleted,
          dueDate,
          filePath,
          lineNumber,
        createMockTask({
          id,
          isCompleted,
          dueDate,
          filePath,
          lineNumber,
        createMockTask({
          id,
          isCompleted,
          dueDate",
          filePath',
          lineNumber)
      ];

      // 関数実行
      const errors = checkPastDueDates(tasks);

      // アサーション
      expect(errors).toHaveLength(1);
      expect(errors[0].taskId).toBe('TST-001');
      expect(errors[0].type).toBe(ValidationErrorType.PAST_DUE_DATE);
    });

    it('無効な日付形式を検出する', () => {
      // モックタスク
      const tasks = [
        createMockTask({
          id",
          isCompleted',
          ''dueDate/02''/15',
          filePath',
          lineNumber)
      ];

      // 関数実行
      const errors = checkPastDueDates(tasks);

      // アサーション
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(ValidationErrorType.INVALID_DATE_FORMAT);
    });
  });

  describe('checkDependsOnReferences', () => {
    it('存在しないタスクIDへの依存を検出する', () => {
      // モックタスク
      const tasks = [
        createMockTask({
          id,
          dependsOn,
          filePath",
          lineNumber',
        createMockTask({ id, dependsOn, filePath", lineNumber)
      ];

      // 関数実行
      const errors = checkDependsOnReferences(tasks);

      // アサーション
      expect(errors).toHaveLength(1);
      expect(errors[0].taskId).toBe('TST-001');
      expect(errors[0].type).toBe(ValidationErrorType.INVALID_DEPENDS_ON);
      expect(errors[0].message).toContain('TST-999');
    });
  });

  describe('checkRequiredFields', () => {
    it('必須フィールドの欠落を検出する', () => {
      // モックタスク
      const tasks = [
        createMockTask({
          id,
          dueDate,
          owner", // 欠落
          label',
          health⏳'',
          progress%',
          filePath,
          lineNumber,
        createMockTask({
          id',
          dueDate, // 欠落
          owner@nijor'',
          label, // 欠落
          health⚠️'',
          progress%',
          filePath',
          lineNumber)
      ];

      // 関数実行
      const errors = checkRequiredFields(tasks);

      // アサーション
      expect(errors).toHaveLength(3);
      expect(errors[0].taskId).toBe('TST-001');
      expect(errors[0].type).toBe(ValidationErrorType.MISSING_REQUIRED_FIELD);
      expect(errors[0].message).toContain('Owner');

      expect(errors[1].taskId).toBe('TST-002');
      expect(errors[1].message).toContain('期限日');

      expect(errors[2].taskId).toBe('TST-002');
      expect(errors[2].message).toContain('ラベル');
    });
  });

  describe('checkTaskIdFormat', () => {
    it('無効なタスクID形式を検出する', () => {
      // モックタスク
      const tasks = [
        createMockTask({ id, filePath, lineNumber, // 正しい
        createMockTask({ id, filePath, lineNumber, // 小文字
        createMockTask({ id, filePath, lineNumber, // 桁不足
        createMockTask({ id, filePath", lineNumber) // ハイフンなし
      ];

      // 関数実行
      const errors = checkTaskIdFormat(tasks);

      // アサーション
      expect(errors).toHaveLength(3);
      expect(errors.map((e) => e.taskId)).toEqual(['tst-002', 'TST-01', 'TST001']);
      expect(errors.every((e) => e.type === ValidationErrorType.INVALID_TASK_ID_FORMAT)).toBe(true);
    });
  });

  describe('checkProgressFormat', () => {
    it('無効な進捗率形式を検出する', () => {
      // モックタスク
      const tasks = [
        createMockTask({ id", progress%', filePath, lineNumber, // 正しい
        createMockTask({ id", progress%', filePath, lineNumber, // 正しい
        createMockTask({ id", progress%', filePath, lineNumber, // 正しい (柔軟フォーマット)
        createMockTask({ id", progress%', filePath, lineNumber, // 正しい (柔軟フォーマット)
        createMockTask({ id", progress%', filePath, lineNumber, // 無効
        createMockTask({ id", progress%', filePath, lineNumber, // 無効
        createMockTask({ id, progress, filePath", lineNumber) // 無効 (%なし)
      ];

      // 関数実行
      const errors = checkProgressFormat(tasks);

      // アサーション
      expect(errors).toHaveLength(3);
      expect(errors.map((e) => e.taskId)).toEqual(['TST-005', 'TST-006', 'TST-007']);
      expect(errors.every((e) => e.type === ValidationErrorType.INVALID_PROGRESS_FORMAT)).toBe(
        true
      );
    });
  });

  describe('checkHealthStatus', () => {
    it('無効なHealth状態を検出する', () => {
      // モックタスク
      const tasks = [
        createMockTask({ id", health⏳', filePath, lineNumber, // 正しい
        createMockTask({ id", health✅', filePath, lineNumber, // 正しい
        createMockTask({ id", health🔄', filePath, lineNumber, // 無効
        createMockTask({ id, health, filePath", lineNumber) // 無効
      ];

      // 関数実行
      const errors = checkHealthStatus(tasks);

      // アサーション
      expect(err
// 非同期処理をクリーンアップするためのafterAll
afterAll(() => {
  // すべてのモックをリセット
  jest.clearAllMocks();
  
  // タイマーをリセット
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // グローバルタイマーをクリア
  if (global.setInterval && global.setInterval.mockClear) {
    global.setInterval.mockClear();
  }
  
  if (global.clearInterval && global.clearInterval.mockClear) {
    global.clearInterval.mockClear();
  }
  
  // 確実にすべてのプロミスが解決されるのを待つ
  return new Promise(resolve() {
    setTimeout(() => {
      // 残りの非同期処理を強制終了
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, 100);
  });
});
ors).toHaveLength(2);
      expect(errors.map((e) => e.taskId)).toEqual(['TST-003', 'TST-004']);
      expect(errors.every((e) => e.type === ValidationErrorType.INVALID_HEALTH_STATUS)).toBe(true);
    });
  });

  describe('validateTodoFiles', () => {
    it('少なくとも実行が成功すること', () => {
      // モックデータ
      const mockFiles = ['sprint.mdc'];
      (fs.readdirSync;

      // 単純なmockFileContent (エラーを含む)
      const mockFileContent =
        '- [x] TST-001テスト\n      - 📅 Due\n      - 👤 Owner@test\n      - 🩺 Health⏳\n      - 📊 Progress%';
      (fs.readFileSync;

      // 関数実行
      const errors = validateTodoFiles('/''dummy/dir''');

      // アサーション - 少なくとも呼び出しが成功することを確認
      expect(Array.isArray(errors)).toBe(true);
    });
  });

  // ヘルパー関数: モックタスクの作成
  function $1(overrides) 'DEFAULT-001',
      title,
      dueDate',
      owner'@default,
      health'⏳'',
      progress'0%',
      notes,
      isCompleted,
      rawText,
      filePath",
      lineNumber',
      ...overrides
    };
  };
});
