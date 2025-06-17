/**
 * fix-test-imports-dry-run.js
 * テストファイルのインポートパス修正スクリプト (Dry Run版)
 * 
 * REF-032タスク用スクリプト - テストファイルのインポートパス問題を修正します
 * ※このバージョンは実際にファイルを変更せず、変更内容のプレビューを表示します。
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 処理状況の追跡
const stats = {
  totalFiles: 0,
  wouldModifyFiles: 0,
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
 * ファイルの変更内容をプレビューする
 * @param {string} original 元のコンテンツ
 * @param {string} modified 修正後のコンテンツ
 * @returns {string} 差分表示
 */
function getDiff(original, modified) {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const diff = [];

  for (let i = 0; i < Math.max(originalLines.length, modifiedLines.length); i++) {
    const origLine = originalLines[i] || '';
    const modLine = modifiedLines[i] || '';

    if (origLine !== modLine) {
      diff.push(`- ${origLine}`);
      diff.push(`+ ${modLine}`);
    }
  }

  return diff.join('\n');
}

/**
 * ファイルのインポートパスを修正する (Dry Run)
 * @param {string} filePath 修正するファイルのパス
 * @returns {boolean} 修正が行われるかどうか
 */
function processFile(filePath) {
  try {
    stats.totalFiles++;
    const content = fs.readFileSync(filePath, 'utf8');
    const modified = fixImportPaths(content);

    // 変更がある場合は差分を表示
    if (content !== modified) {
      console.log(`\nWould modify: ${filePath}`);
      // コンパクトな差分表示
      const changes = content.split('\n').reduce((acc, line, i) => {
        const modLine = modified.split('\n')[i];
        if (line !== modLine) {
          acc.push(`Line ${i+1}:\n- ${line}\n+ ${modLine || ''}`);
        }
        return acc;
      }, []);
      
      // 変更箇所が多すぎる場合は制限
      if (changes.length > 5) {
        console.log(`${changes.slice(0, 5).join('\n\n')}\n... and ${changes.length - 5} more changes`);
      } else {
        console.log(changes.join('\n\n'));
      }
      
      stats.wouldModifyFiles++;
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

  console.log(`Found ${testFiles.length} test files to process (DRY RUN MODE - no files will be changed)`);

  // 各ファイルを処理
  for (const filePath of testFiles) {
    processFile(filePath);
  }

  // 結果を表示
  console.log('\n--- Import Path Fix Results (DRY RUN) ---');
  console.log(`Total files processed: ${stats.totalFiles}`);
  console.log(`Files that would be modified: ${stats.wouldModifyFiles}`);
  console.log(`Files that would be skipped (no changes needed): ${stats.skippedFiles}`);
  console.log(`Files with errors: ${stats.errorFiles}`);

  // 修正されるファイルのリストを表示
  if (stats.wouldModifyFiles > 0) {
    console.log('\nFiles that would be modified:');
    stats.modifiedFilesList.forEach(file => console.log(`  - ${file}`));
  }
  
  console.log('\nThis was a DRY RUN. No files were actually modified.');
  console.log('To apply these changes, run the fix-test-imports.js script instead.');
}

// メイン処理の実行
console.log('Starting test file import path fixes (DRY RUN MODE)...');
processTestFiles();
console.log('Test file import path dry run completed!'); 