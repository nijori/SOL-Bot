/**
 * fix-test-imports.js
 * テストファイルのインポートパス修正スクリプト
 * 
 * REF-032タスク用スクリプト - テストファイルのインポートパス問題を修正します
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 処理状況の追跡
const stats = {
  totalFiles: 0,
  modifiedFiles: 0,
  skippedFiles: 0,
  errorFiles: 0,
  modifiedFilesList: []
};

/**
 * インポートパスを修正する
 * @param {string} content ファイルの内容
 * @returns {string} 修正されたファイルの内容
 */
function fixImportPaths(content) {
  let modified = content;

  // 壊れたインポートパスの修正パターン - インポートパスに集中する
  const replacements = [
    // '../../.js''core/types''.js' → '../../core/types'
    [/'\.\.\/\.\.\/\.js''([^']+)''\.js'/g, '\'../../$1\''],
    
    // '../../'core/types'.js' → '../../core/types'
    [/'\.\.\/\.\.\/\'([^']+)\'\.js'/g, '\'../../$1\''],
    
    // */../'strategies/trendFollowStrategy'.js' → '../../strategies/trendFollowStrategy'
    [/\*\/\.\.\/'([^']+)'\.js'/g, '\'../../$1\''],
    
    // import { X } from '../../strategies/meanRevertStrategy.js' → import { X } from '../../strategies/meanRevertStrategy'
    [/from '([^']+)\.js'/g, 'from \'$1\''],
    
    // jest.mock('../../'data/parquetDataStore'.js') → jest.mock('../../data/parquetDataStore')
    [/jest\.mock\('\.\.\/\.\.\/\'([^']+)\'\.js'\)/g, 'jest.mock(\'../../$1\')'],
    
    // jest.mock('../../''data/parquetDataStore''.js') → jest.mock('../../data/parquetDataStore')
    [/jest\.mock\('\.\.\/\.\.\/''([^']+)''\.js'\)/g, 'jest.mock(\'../../$1\')'],
    
    // import型の修正
    [/import \{ ([^}]+)"\s+\} from/g, 'import { $1 } from'],
    
    // const { describe, it, expect, jest } = require('@jest/globals') → import { describe, it, expect, jest } from '@jest/globals'
    [/const \{([^}]+)\} = require\('@jest\/globals'\)/g, 'import {$1} from \'@jest/globals\'']
  ];

  // すべての置換パターンを適用
  for (const [pattern, replacement] of replacements) {
    modified = modified.replace(pattern, replacement);
  }

  return modified;
}

/**
 * ファイルのインポートパスを修正する
 * @param {string} filePath 修正するファイルのパス
 * @returns {boolean} 修正が行われたかどうか
 */
function processFile(filePath) {
  try {
    stats.totalFiles++;
    const content = fs.readFileSync(filePath, 'utf8');
    const modified = fixImportPaths(content);

    // 変更があった場合のみファイルを更新
    if (content !== modified) {
      fs.writeFileSync(filePath, modified, 'utf8');
      stats.modifiedFiles++;
      stats.modifiedFilesList.push(filePath);
      return true;
    } else {
      stats.skippedFiles++;
      return false;
    }
  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err);
    stats.errorFiles++;
    return false;
  }
}

/**
 * テストファイルを検索して処理する
 */
function processTestFiles() {
  // __tests__ディレクトリ内のすべてのテストファイルを検索
  const testFiles = [
    ...glob.sync('src/__tests__/**/*.test.ts'),
    ...glob.sync('src/__tests__/**/*.test.mjs'),
    ...glob.sync('src/__tests__/**/*.e2e.test.ts'),
    ...glob.sync('src/__tests__/**/*.e2e.test.mjs'),
    ...glob.sync('src/__tests__/__broken_mjs__/**/*.mjs')
  ];

  console.log(`Found ${testFiles.length} test files to process`);

  // 各ファイルを処理
  for (const filePath of testFiles) {
    processFile(filePath);
  }

  // 結果を表示
  console.log('\n--- Import Path Fix Results ---');
  console.log(`Total files processed: ${stats.totalFiles}`);
  console.log(`Files modified: ${stats.modifiedFiles}`);
  console.log(`Files skipped (no changes needed): ${stats.skippedFiles}`);
  console.log(`Files with errors: ${stats.errorFiles}`);

  // 修正されたファイルのリストを表示
  if (stats.modifiedFiles > 0) {
    console.log('\nModified files:');
    stats.modifiedFilesList.forEach(file => console.log(`  - ${file}`));
  }
}

// メイン処理の実行
console.log('Starting test file import path fixes...');
processTestFiles();
console.log('Test file import path fixes completed!'); 