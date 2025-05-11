/**
 * Jest インポート修正スクリプト
 *
 * ESMテスト実行時にファイル先頭にjestのインポート文を追加するスクリプト
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// 検索対象のテストファイルパターン
const TEST_FILE_PATTERN = 'src/__tests__/**/*.test.ts';

// jestのインポート文
const JEST_IMPORT = `import { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';\n\n`;

// ファイルを処理する関数
async function processFile(filePath) {
  console.log(`処理中: ${filePath}`);
  
  try {
    // ファイルの内容を読み込む
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // すでにjestのインポートがあるか確認
    if (content.includes('@jest/globals')) {
      console.log(`  すでにインポート済み: ${filePath}`);
      return;
    }
    
    // ファイルの先頭にインポート文を追加
    const updatedContent = JEST_IMPORT + content;
    
    // 変更をファイルに書き込む
    fs.writeFileSync(filePath, updatedContent, 'utf-8');
    console.log(`  インポート文を追加しました: ${filePath}`);
  } catch (error) {
    console.error(`  エラー: ${filePath} - ${error.message}`);
  }
}

// メイン処理
async function main() {
  console.log('Jest インポート修正を開始...');
  
  // テストファイルを検索
  const files = await glob(TEST_FILE_PATTERN);
  console.log(`${files.length}個のテストファイルが見つかりました。`);
  
  // 各ファイルを処理
  for (const file of files) {
    await processFile(file);
  }
  
  console.log('処理が完了しました。');
}

// スクリプト実行
main().catch(err => {
  console.error('エラーが発生しました:', err);
  process.exit(1);
}); 