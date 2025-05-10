#!/usr/bin/env node
/**
 * todo-lint.ts - Todoタスク検証コマンドラインスクリプト
 *
 * 使い方:
 * npm run todo-lint [options]
 *
 * オプション:
 *   --quiet       エラーのみ出力し、成功メッセージを表示しない
 *   --fix         自動修正可能な問題を修正（未実装、将来の拡張のために予約）
 *   --format=json 結果をJSON形式で出力
 *
 * Todoファイルの形式を検証し、問題点を報告します。
 * - タスクIDの重複
 * - 進捗/Health状態の不整合
 * - 期限切れタスク
 * - Depends-on参照の整合性
 * - 必須フィールドの欠落
 * - タスクID形式
 * - 進捗率形式
 * - Health状態
 * - 日付フォーマット
 * - 空フィールド値
 *
 * 特記事項:
 * - Front-matterブロック（---または```で囲まれた部分）はスキップされます
 * - 先頭に「.」が付いたタスクIDはアーカイブ済みとして処理されます
 *
 * 戻り値:
 *   0: 問題なし
 *   1: 問題あり、またはエラー発生
 */

import * as path from 'path';
import chalk from 'chalk';
import { Command } from 'commander';
import { validateTodoFiles, ValidationError, ValidationErrorType } from '../utils/todoValidator.js';
// loggerのインポートを削除し、代わりにconsole.logを使用
// import logger from '../utils/logger.js';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ESMでは__dirnameがないため、import.meta.urlを使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトルートからの相対パス
const TODO_DIR = path.join(__dirname, '../../.todo');

// コマンドラインオプションの設定
const program = new Command();
program
  .description('Todoファイルの形式を検証し、問題点を報告します')
  .option('--quiet', 'エラーのみ出力し、成功メッセージを表示しない')
  .option('--fix', '自動修正可能な問題を修正（未実装、将来の拡張のために予約）')
  .option('--format <type>', '出力形式を指定（text または json）', 'text')
  .parse(process.argv);

const options = program.opts();

/**
 * エラータイプに応じた色を取得
 */
function getColorForErrorType(type: ValidationErrorType): Function {
  switch (type) {
    case ValidationErrorType.DUPLICATE_TASK_ID:
      return chalk.red;
    case ValidationErrorType.INCONSISTENT_PROGRESS_HEALTH:
      return chalk.magenta;
    case ValidationErrorType.PAST_DUE_DATE:
      return chalk.yellow;
    case ValidationErrorType.INVALID_DEPENDS_ON:
      return chalk.cyan;
    case ValidationErrorType.MISSING_REQUIRED_FIELD:
      return chalk.blue;
    case ValidationErrorType.INVALID_DATE_FORMAT:
      return chalk.yellow;
    case ValidationErrorType.EMPTY_FIELD_VALUE:
      return chalk.blue;
    default:
      return chalk.white;
  }
}

/**
 * エラーメッセージを整形して表示
 */
function printValidationErrors(errors: ValidationError[], quiet: boolean): void {
  if (errors.length === 0) {
    if (!quiet) {
      console.log(chalk.green('✓ すべてのTodoタスクは有効です！'));
    }
    return;
  }

  console.log(chalk.yellow(`❌ ${errors.length}件の問題が見つかりました:\n`));

  // エラータイプ別にグループ化
  const errorsByType = errors.reduce(
    (groups, error) => {
      if (!groups[error.type]) {
        groups[error.type] = [];
      }
      groups[error.type].push(error);
      return groups;
    },
    {} as Record<string, ValidationError[]>
  );

  // タイプ別に表示
  for (const [type, typeErrors] of Object.entries(errorsByType)) {
    const colorFn = getColorForErrorType(type as ValidationErrorType);
    const typeName = getErrorTypeName(type as ValidationErrorType);

    console.log(colorFn(`\n【${typeName}】- ${typeErrors.length}件`));

    typeErrors.forEach((error) => {
      console.log(
        colorFn(`  • ${path.basename(error.filePath)}:${error.lineNumber} - ${error.message}`)
      );
    });
  }

  console.log('\n');
}

/**
 * エラーをJSON形式で出力
 */
function printValidationErrorsAsJson(errors: ValidationError[]): void {
  const result = {
    success: errors.length === 0,
    errorCount: errors.length,
    errors: errors.map((error) => ({
      type: error.type,
      typeName: getErrorTypeName(error.type),
      message: error.message,
      taskId: error.taskId,
      file: path.basename(error.filePath),
      lineNumber: error.lineNumber,
      filePath: error.filePath
    })),
    errorsByType: {} as Record<string, number>
  };

  // タイプ別の統計を追加
  errors.forEach((error) => {
    const typeName = getErrorTypeName(error.type);
    if (!result.errorsByType[typeName]) {
      result.errorsByType[typeName] = 0;
    }
    result.errorsByType[typeName]++;
  });

  console.log(JSON.stringify(result, null, 2));
}

/**
 * エラータイプの日本語名を取得
 */
function getErrorTypeName(type: ValidationErrorType): string {
  switch (type) {
    case ValidationErrorType.DUPLICATE_TASK_ID:
      return 'タスクID重複';
    case ValidationErrorType.INCONSISTENT_PROGRESS_HEALTH:
      return '進捗/Health不整合';
    case ValidationErrorType.PAST_DUE_DATE:
      return '期限切れ';
    case ValidationErrorType.INVALID_DEPENDS_ON:
      return '無効な依存参照';
    case ValidationErrorType.MISSING_REQUIRED_FIELD:
      return '必須フィールド欠落';
    case ValidationErrorType.INVALID_TASK_ID_FORMAT:
      return 'タスクID形式不正';
    case ValidationErrorType.INVALID_PROGRESS_FORMAT:
      return '進捗率形式不正';
    case ValidationErrorType.INVALID_DATE_FORMAT:
      return '日付形式不正';
    case ValidationErrorType.INVALID_HEALTH_STATUS:
      return 'Health状態不正';
    case ValidationErrorType.EMPTY_FIELD_VALUE:
      return 'フィールド値が空';
    default:
      return 'その他の問題';
  }
}

/**
 * 統計情報を出力
 */
function printStatistics(errors: ValidationError[], quiet: boolean): void {
  if (errors.length === 0 || quiet) return;

  // エラータイプ別にグループ化
  const errorsByType = errors.reduce(
    (groups, error) => {
      if (!groups[error.type]) {
        groups[error.type] = [];
      }
      groups[error.type].push(error);
      return groups;
    },
    {} as Record<string, ValidationError[]>
  );

  // 統計情報のヘッダー
  console.log(chalk.blue('\n📊 エラー分布:'));

  // タイプ別の統計情報を出力
  const errorTypes = Object.entries(errorsByType).sort((a, b) => b[1].length - a[1].length);
  const maxCount = Math.max(...errorTypes.map(([_, errors]) => errors.length));
  const maxBarLength = 30; // バーの最大長

  errorTypes.forEach(([type, typeErrors]) => {
    const typeName = getErrorTypeName(type as ValidationErrorType);
    const colorFn = getColorForErrorType(type as ValidationErrorType);
    const count = typeErrors.length;
    const percentage = Math.round((count / errors.length) * 100);

    // 視覚的なバーを作成
    const barLength = Math.max(1, Math.round((count / maxCount) * maxBarLength));
    const bar = '█'.repeat(barLength);

    console.log(
      colorFn(`  ${typeName.padEnd(20)} ${count.toString().padStart(3)} (${percentage}%) ${bar}`)
    );
  });

  console.log('\n');
}

/**
 * メイン処理
 */
export function runTodoLint(customTodoDir?: string, opts?: any): number {
  try {
    const todoDir = customTodoDir || TODO_DIR;
    // オプションの設定
    const options = opts || program.opts();
    const { quiet, fix, format } = options;

    if (!quiet) {
      console.log(chalk.blue(`🔍 ${todoDir} のTodoタスクを検証中...\n`));
    }

    // --fixオプションが指定されている場合の処理（現在は未実装の旨を表示）
    if (fix) {
      console.log(
        chalk.yellow('注意: --fixオプションは現在実装中です。問題の自動修正は行われません。')
      );
    }

    // Todoディレクトリの存在チェック
    if (!fs.existsSync(todoDir)) {
      console.error(chalk.red(`エラー: Todoディレクトリが見つかりません: ${todoDir}`));
      return 1;
    }

    // 検証実行
    try {
      const errors = validateTodoFiles(todoDir);

      // 出力形式に応じた処理
      if (format === 'json') {
        printValidationErrorsAsJson(errors);
      } else {
        printValidationErrors(errors, quiet);
        printStatistics(errors, quiet);
      }

      // エラーがある場合は終了コード1で終了
      return errors.length > 0 ? 1 : 0;
    } catch (validationError) {
      console.error(chalk.red(`検証処理中にエラーが発生しました: ${validationError}`));
      return 1;
    }
  } catch (error) {
    console.error(chalk.red(`予期せぬエラーが発生しました: ${error}`));
    return 1;
  }
}

// ファイルが直接実行された場合のみmain関数を実行
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runTodoLint());
}
