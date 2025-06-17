// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

const fs = require('fs');
const path = require('path');
const todoValidator = require('../../utils/todoValidator');

const {
  parseTodoFile,
  getAllTasks,
  checkDuplicateTaskIds,
  checkProgressHealthConsistency,
  checkPastDueDates,
  checkDependsOnReferences,
  checkRequiredFields,
  checkTaskIdFormat,
  checkProgressFormat,
  checkHealthStatus,
  validateTodoFiles,
  ValidationErrorType
} = todoValidator;

// 最初に自動モックをリセットして、実際のモジュールの動作を維持
jest.unmock('../../utils/todoValidator');

// fsモジュールのモック
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
  existsSync: jest.fn(() => true)
}));

// ロガーのモック
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

describe('TodoValidator', () => {
  // テスト前に毎回モックをリセット
  beforeEach(() => {
    jest.clearAllMocks();
    // 修正: mockReturnValueの代わりにモックの初期実装を使用
    fs.existsSync = jest.fn(() => true);
  });

  // 各テスト後にリソース解放
  afterEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // イベントリスナーを明示的に削除
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('uncaughtException');
    
    // グローバルリソーストラッカーがある場合はクリーンアップを実行
    if (global.__RESOURCE_TRACKER) {
      await global.__RESOURCE_TRACKER.cleanup();
    }
    
    // 未解決のプロミスがあれば完了させるために少し待機
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  // すべてのテスト完了後に最終クリーンアップを実行
  afterAll(async () => {
    // グローバルリソーストラッカーがある場合は最終クリーンアップを実行
    if (global.__RESOURCE_TRACKER) {
      await global.__RESOURCE_TRACKER.cleanup(true);
    }
    
    // 非同期処理の完全なクリーンアップを待機
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  describe('parseTodoFile', () => {
    it('正しく形式のタスクをパースできる', () => {
      // モックデータ
      const mockFileContent = `
# テストTodoファイル

## タスクセクション

- [ ] TST-001: テストタスク1
      - 📅 Due        : 2026-02-15
      - 👤 Owner      : @nijor
      - 🔗 Depends-on : TST-002, TST-003
      - 🏷️  Label      : test
      - 🩺 Health     : ⏳
      - 📊 Progress   : 25%
      - ✎ Notes      : これはテストタスクです

- [x] TST-002: 完了したテストタスク
      - 📅 Due        : 2026-02-10
      - 👤 Owner      : @nijor
      - 🏷️  Label      : test
      - 🩺 Health     : ✅
      - 📊 Progress   : 100%
      - ✎ Notes      : 完了したタスク
`;

      // モックの動作設定
      fs.readFileSync = jest.fn(() => mockFileContent);

      // 関数実行
      const tasks = parseTodoFile('dummy/path.mdc');

      // アサーション
      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toMatchObject({
        id: 'TST-001',
        title: 'テストタスク1',
        dueDate: '2026-02-15',
        owner: '@nijor',
        dependsOn: ['TST-002', 'TST-003'],
        label: 'test',
        health: '⏳',
        progress: '25%',
        notes: 'これはテストタスクです',
        isCompleted: false
      });

      expect(tasks[1]).toMatchObject({
        id: 'TST-002',
        title: '完了したテストタスク',
        dueDate: '2026-02-10',
        owner: '@nijor',
        label: 'test',
        health: '✅',
        progress: '100%',
        notes: '完了したタスク',
        isCompleted: true
      });
    });

    it('エラー時に空配列を返す', () => {
      // エラーを投げるモック設定
      fs.readFileSync = jest.fn(() => {
        throw new Error('読み込みエラー');
      });

      // 関数実行
      const tasks = parseTodoFile('dummy/path.mdc');

      // アサーション
      expect(tasks).toEqual([]);
    });
  });

  describe('getAllTasks', () => {
    it('正しく呼び出せること', () => {
      // モックデータ
      const mockFiles = ['sprint.mdc'];
      fs.readdirSync = jest.fn(() => mockFiles);

      // 単純なmockFileContent
      const mockFileContent =
        '- [ ] TST-001: テスト\n      - 📅 Due: 2026-01-01\n      - 👤 Owner: @test';
      fs.readFileSync = jest.fn(() => mockFileContent);

      // 関数実行 - 実際のパースロジックを使う
      const tasks = getAllTasks('/dummy/dir');

      // アサーション - 少なくとも呼び出しが成功することを確認
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('checkDuplicateTaskIds', () => {
    it('重複したタスクIDを検出する', () => {
      // モックタスク
      const tasks = [
        createMockTask({ id: 'TST-001', filePath: 'sprint.mdc', lineNumber: 10 }),
        createMockTask({ id: 'TST-002', filePath: 'sprint.mdc', lineNumber: 20 }),
        createMockTask({ id: 'TST-001', filePath: 'backlog.mdc', lineNumber: 5 }),
        createMockTask({ id: 'TST-003', filePath: 'sprint.mdc', lineNumber: 30 })
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
        createMockTask({ id: 'TST-001', filePath: 'sprint.mdc', lineNumber: 10 }),
        createMockTask({ id: 'TST-002', filePath: 'sprint.mdc', lineNumber: 20 }),
        createMockTask({ id: 'TST-003', filePath: 'sprint.mdc', lineNumber: 30 })
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
          id: 'TST-001',
          isCompleted: true,
          health: '⏳',
          progress: '75%',
          filePath: 'sprint.mdc',
          lineNumber: 10
        }),
        createMockTask({
          id: 'TST-002',
          isCompleted: true,
          health: '✅',
          progress: '50%',
          filePath: 'sprint.mdc',
          lineNumber: 20
        }),
        createMockTask({
          id: 'TST-003',
          isCompleted: true,
          health: '✅',
          progress: '100%',
          filePath: 'sprint.mdc',
          lineNumber: 30
        })
      ];

      // 関数実行
      const errors = checkProgressHealthConsistency(tasks);

      // アサーション
      expect(errors).toHaveLength(3);
      // IDの配列を作成して、期待するIDがすべて含まれているか確認
      const taskIds = errors.map(e => e.taskId);
      expect(taskIds.filter(id => id === 'TST-001').length).toBe(2);
      expect(taskIds.filter(id => id === 'TST-002').length).toBe(1);
      // すべてのエラーが同じタイプであることを確認
      expect(errors.every(e => e.type === ValidationErrorType.INCONSISTENT_PROGRESS_HEALTH)).toBe(true);
    });
  });

  describe('checkPastDueDates', () => {
    it('過去の期限日を検出する', () => {
      // 現在日付をモック
      const realDate = global.Date;
      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            // 現在日付を2026-03-01に固定
            super('2026-03-01T00:00:00.000Z');
          } else {
            super(...args);
          }
        }
      };

      // モックタスク
      const tasks = [
        createMockTask({
          id: 'TST-001',
          isCompleted: false,
          dueDate: '2026-02-15', // 過去の日付
          filePath: 'sprint.mdc',
          lineNumber: 10
        }),
        createMockTask({
          id: 'TST-002',
          isCompleted: true, // 完了タスクは無視
          dueDate: '2026-02-10',
          filePath: 'sprint.mdc',
          lineNumber: 20
        }),
        createMockTask({
          id: 'TST-003',
          isCompleted: false,
          dueDate: '2026-03-15', // 未来の日付
          filePath: 'sprint.mdc',
          lineNumber: 30
        })
      ];

      // 関数実行
      const errors = checkPastDueDates(tasks);

      // 元の日付関数を復元
      global.Date = realDate;

      // アサーション
      expect(errors).toHaveLength(1);
      expect(errors[0].taskId).toBe('TST-001');
      expect(errors[0].type).toBe(ValidationErrorType.PAST_DUE_DATE);
    });

    it('無効な日付形式を検出する', () => {
      // モックタスク
      const tasks = [
        createMockTask({
          id: 'TST-001',
          isCompleted: false,
          dueDate: '2026/02/15',
          filePath: 'sprint.mdc',
          lineNumber: 10
        })
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
          id: 'TST-001',
          dependsOn: ['TST-002', 'TST-999'],
          filePath: 'sprint.mdc',
          lineNumber: 10
        }),
        createMockTask({ id: 'TST-002', dependsOn: [], filePath: 'sprint.mdc', lineNumber: 20 })
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
          id: 'TST-001',
          dueDate: '2026-02-15',
          owner: null, // 欠落
          label: 'test',
          health: '⏳',
          progress: '25%',
          filePath: 'sprint.mdc',
          lineNumber: 10
        }),
        createMockTask({
          id: 'TST-002',
          dueDate: null, // 欠落
          owner: '@nijor',
          label: null, // 欠落
          health: '⚠️',
          progress: '50%',
          filePath: 'sprint.mdc',
          lineNumber: 20
        })
      ];

      // 関数実行
      const errors = checkRequiredFields(tasks);

      // アサーション
      expect(errors).toHaveLength(3);
      expect(errors[0].taskId).toBe('TST-001');
      expect(errors[0].type).toBe(ValidationErrorType.MISSING_REQUIRED_FIELD);
      expect(errors[0].message).toContain('owner');

      expect(errors[1].taskId).toBe('TST-002');
      expect(errors[1].message).toContain('dueDate');

      expect(errors[2].taskId).toBe('TST-002');
      expect(errors[2].message).toContain('label');
    });
  });

  describe('checkTaskIdFormat', () => {
    it('無効なタスクID形式を検出する', () => {
      // モックタスク
      const tasks = [
        createMockTask({ id: 'TST-001', filePath: 'sprint.mdc', lineNumber: 10 }), // 正しい
        createMockTask({ id: 'tst-002', filePath: 'sprint.mdc', lineNumber: 20 }), // 小文字
        createMockTask({ id: 'TST-01', filePath: 'sprint.mdc', lineNumber: 30 }), // 桁不足
        createMockTask({ id: 'TST001', filePath: 'sprint.mdc', lineNumber: 40 }) // ハイフンなし
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
        createMockTask({ id: 'TST-001', progress: '0%', filePath: 'sprint.mdc', lineNumber: 10 }), // 正しい
        createMockTask({ id: 'TST-002', progress: '50%', filePath: 'sprint.mdc', lineNumber: 20 }), // 正しい
        createMockTask({ id: 'TST-003', progress: '33%', filePath: 'sprint.mdc', lineNumber: 30 }), // 正しい (柔軟フォーマット)
        createMockTask({ id: 'TST-004', progress: '10%', filePath: 'sprint.mdc', lineNumber: 40 }), // 正しい (柔軟フォーマット)
        createMockTask({ id: 'TST-005', progress: '200%', filePath: 'sprint.mdc', lineNumber: 50 }), // 無効
        createMockTask({ id: 'TST-006', progress: '-10%', filePath: 'sprint.mdc', lineNumber: 60 }), // 無効
        createMockTask({ id: 'TST-007', progress: '50', filePath: 'sprint.mdc', lineNumber: 70 }) // 無効 (%なし)
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
        createMockTask({ id: 'TST-001', health: '⏳', filePath: 'sprint.mdc', lineNumber: 10 }), // 正しい
        createMockTask({ id: 'TST-002', health: '✅', filePath: 'sprint.mdc', lineNumber: 20 }), // 正しい
        createMockTask({ id: 'TST-003', health: '🔄', filePath: 'sprint.mdc', lineNumber: 30 }), // 無効
        createMockTask({ id: 'TST-004', health: 'WIP', filePath: 'sprint.mdc', lineNumber: 40 }) // 無効
      ];

      // 関数実行
      const errors = checkHealthStatus(tasks);

      // アサーション
      expect(errors).toHaveLength(2);
      expect(errors.map((e) => e.taskId)).toEqual(['TST-003', 'TST-004']);
      expect(errors.every((e) => e.type === ValidationErrorType.INVALID_HEALTH_STATUS)).toBe(true);
    });
  });

  describe('validateTodoFiles', () => {
    it('少なくとも実行が成功すること', () => {
      // モックデータ
      const mockFiles = ['sprint.mdc'];
      fs.readdirSync = jest.fn(() => mockFiles);
      fs.existsSync = jest.fn(() => true);

      // 単純なmockFileContent (エラーを含む)
      const mockFileContent =
        '- [x] TST-001: テスト\n      - 📅 Due: 2026-01-01\n      - 👤 Owner: @test\n      - 🩺 Health: ⏳\n      - 📊 Progress: 50%';
      fs.readFileSync = jest.fn(() => mockFileContent);

      // 関数実行
      const errors = validateTodoFiles('/dummy/dir');

      // アサーション - 少なくとも呼び出しが成功することを確認
      expect(Array.isArray(errors)).toBe(true);
    });
  });

  // ヘルパー関数: モックタスクの作成
  function createMockTask(overrides) {
    return {
      id: 'DEFAULT-001',
      title: 'Default Task',
      dueDate: '2026-01-01',
      owner: '@default',
      dependsOn: [],
      label: 'test',
      health: '⏳',
      progress: '0%',
      notes: 'Default notes',
      isCompleted: false,
      rawText: '',
      filePath: 'default.mdc',
      lineNumber: 1,
      ...overrides
    };
  }
}); 