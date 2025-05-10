#!/usr/bin/env node

/**
 * ESMインポートパス問題修正スクリプト
 * REF-027: ESMインポートパス問題修正
 * 
 * 変換後の.mjsファイルに残っている壊れたインポートパスを修正します：
 * - 'path: ' → 'path'
 * - 'url: ' → 'url'
 * - __dirname" → __dirname
 * - 'mocks: ' → 'mocks'
 * - '../../'strategies/meanReversionStrategy'' → '../../strategies/meanReversionStrategy.js'
 * - '@'jest/globals'' → '@jest/globals'
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 統計情報
const stats = {
  processedFiles: 0,
  modifiedFiles: 0,
  errors: 0,
  skippedFiles: 0
};

// 処理済みファイル一覧
const processedFilePaths = [];

/**
 * インポートパスの問題を修正する関数
 * @param {string} filePath ファイルパス
 * @returns {Promise<boolean>} 修正が行われたかどうか
 */
async function fixImportPaths(filePath) {
  try {
    console.log(`Processing: ${filePath}`);
    stats.processedFiles++;
    
    // ファイルの内容を読み込む
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 修正パターンを定義
    const replacements = [
      // 'path: ' → 'path'のような修正
      { pattern: /'([^']+): '/g, replace: (match, p1) => `'${p1}'` },
      
      // __dirname" → __dirname のような修正
      { pattern: /(__dirname|__filename)"(?=[,)])/g, replace: '$1' },
      
      // '../../'path/to/module'' → '../../path/to/module.js'のような修正
      { 
        pattern: /'([.]{1,2}\/[^']*)'([^']*)'(?=[,);])/g, 
        replace: (match, p1, p2) => {
          // p1とp2の間のクォートを除去
          const cleanPath = p1 + p2.replace(/^'|'$/g, '');
          // .jsがなければ追加
          return `'${cleanPath}${cleanPath.endsWith('.js') ? '' : '.js'}'`;
        }
      },
      
      // '@'jest/globals'' → '@jest/globals'のような修正
      { 
        pattern: /'@'([^']+)''/g, 
        replace: (match, p1) => `'@${p1}'` 
      },
      
      // execute).mockResolvedValue({ signals) のような壊れたコードの修正
      { 
        pattern: /([a-zA-Z0-9_]+)\).mockResolvedValue\(\s*{\s*([a-zA-Z0-9_]+)\)/g, 
        replace: '$1).mockResolvedValue({ $2: [] })' 
      },
      
      // __esModule, のような壊れたプロパティの修正
      {
        pattern: /__esModule(?:[:=])?\s*[',](?=[,}])/g,
        replace: '__esModule: true'
      },
      
      // default', のような壊れたプロパティの修正
      {
        pattern: /default'(?=[,}])/g,
        replace: 'default: mockModule'
      },
      
      // MeanReversionStrategy; のような壊れた構文の修正
      {
        pattern: /([A-Za-z0-9_]+);(?=\s*[}])/g,
        replace: '$1: jest.fn()'
      },
      
      // { virtual) のような壊れた構文の修正
      {
        pattern: /{\s*virtual\)/g,
        replace: '{ virtual: true }'
      },
      
      // よくあるパターンを直接修正
      {
        pattern: /'\.\.\/\.\.\/'strategies\/meanReversionStrategy''(?=[,);])/g,
        replace: "'../../strategies/meanReversionStrategy.js'"
      },
      {
        pattern: /'\.\.\/\.\.\/'strategies\/DonchianBreakoutStrategy''(?=[,);])/g,
        replace: "'../../strategies/DonchianBreakoutStrategy.js'"
      },
      
      // jest.mockの第1引数と第2引数の間に現れる問題パターン
      {
        pattern: /jest\.mock\(\s*['"]([^'"]+)['"]\s*,\s*\(\s*\)\s*=>\s*{\s*return\s*{\s*__esModule'(?=[,}])/g,
        replace: (match, modulePath) => `jest.mock('${modulePath}', () => {\n  return {\n    __esModule: true`
      },
      
      // 閉じ括弧の問題修正
      {
        pattern: /}\s*,\s*{\s*virtual'\s*}\s*\);/g,
        replace: '}\n}, { virtual: true });'
      }
    ];
    
    // 置換を適用
    let modifiedContent = content;
    let modified = false;
    
    for (const { pattern, replace } of replacements) {
      const newContent = modifiedContent.replace(pattern, replace);
      if (newContent !== modifiedContent) {
        modifiedContent = newContent;
        modified = true;
      }
    }
    
    // ファイルが修正された場合のみ保存
    if (modified) {
      console.log(`✅ Fixed import paths in: ${filePath}`);
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
      stats.modifiedFiles++;
      processedFilePaths.push(filePath);
      return true;
    } else {
      console.log(`✓ No issues found in: ${filePath}`);
      stats.skippedFiles++;
      return false;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    stats.errors++;
    return false;
  }
}

/**
 * 指定ディレクトリ内の.mjsファイルを再帰的に処理
 * @param {string} dir 処理対象ディレクトリ
 */
async function processDirectory() {
  try {
    // .mjsファイルを再帰的に検索
    const files = await glob('src/**/*.mjs', { cwd: rootDir });
    
    console.log(`Found ${files.length} .mjs files to process`);
    
    // 各ファイルを処理
    for (const relativeFilePath of files) {
      const filePath = path.join(rootDir, relativeFilePath);
      await fixImportPaths(filePath);
    }
    
    // 処理結果を表示
    console.log('\n====== 処理完了 ======');
    console.log(`処理ファイル数: ${stats.processedFiles}`);
    console.log(`修正ファイル数: ${stats.modifiedFiles}`);
    console.log(`問題なしファイル数: ${stats.skippedFiles}`);
    console.log(`エラー数: ${stats.errors}`);
    
    if (stats.modifiedFiles > 0) {
      console.log('\n修正したファイル:');
      processedFilePaths.forEach(filePath => {
        console.log(`- ${path.relative(rootDir, filePath)}`);
      });
    }
    
  } catch (error) {
    console.error('ディレクトリ処理中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// メイン処理を実行
console.log('🛠️ ESMインポートパス修正スクリプトを実行中...');
processDirectory()
  .then(() => {
    console.log('🎉 ESMインポートパス修正が完了しました!');
    if (stats.errors > 0) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('スクリプト実行中にエラーが発生しました:', error);
    process.exit(1);
  }); 