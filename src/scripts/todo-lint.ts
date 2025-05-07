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
 * 
 * 戻り値:
 *   0: 問題なし
 *   1: 問題あり、またはエラー発生
 */

import * as path from 'path';
import chalk from 'chalk';
import { Command } from 'commander';
import { validateTodoFiles, ValidationError, ValidationErrorType } from '../utils/todoValidator';
import logger from '../utils/logger';

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
  const errorsByType = errors.reduce((groups, error) => {
    if (!groups[error.type]) {
      groups[error.type] = [];
    }
    groups[error.type].push(error);
    return groups;
  }, {} as Record<string, ValidationError[]>);

  // タイプ別に表示
  for (const [type, typeErrors] of Object.entries(errorsByType)) {
    const colorFn = getColorForErrorType(type as ValidationErrorType);
    const typeName = getErrorTypeName(type as ValidationErrorType);
    
    console.log(colorFn(`\n【${typeName}】- ${typeErrors.length}件`));
    
    typeErrors.forEach(error => {
      console.log(colorFn(`  • ${path.basename(error.filePath)}:${error.lineNumber} - ${error.message}`));
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
    errors: errors.map(error => ({
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
  errors.forEach(error => {
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
    default:
      return 'その他の問題';
  }
}

/**
 * メイン処理
 */
function main() {
  try {
    const { quiet, fix, format } = options;
    
    if (!quiet) {
      console.log(chalk.blue(`🔍 ${TODO_DIR} のTodoタスクを検証中...\n`));
    }
    
    // --fixオプションが指定されている場合の処理（現在は未実装の旨を表示）
    if (fix) {
      console.log(chalk.yellow('注意: --fixオプションは現在実装中です。問題の自動修正は行われません。'));
    }
    
    const errors = validateTodoFiles(TODO_DIR);
    
    // 出力形式に応じた処理
    if (format === 'json') {
      printValidationErrorsAsJson(errors);
    } else {
      printValidationErrors(errors, quiet);
    }
    
    // エラーがあれば終了コード1を返す（CI/CDで失敗として扱われる）
    if (errors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    logger.error(`todo-lintの実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// スクリプト実行
main(); 