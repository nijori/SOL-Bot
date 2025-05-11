/**
 * Jest モックのパス修正スクリプト
 * 
 * テストファイル内の jest.mock() 呼び出しを探し、
 * モジュールパスに .js 拡張子がない場合は追加します。
 * これにより ESM モードでのモックパス解決の問題を修正します。
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// 検索対象のディレクトリとパターン
const TEST_DIRS = [
  'src/__tests__/**/*.test.ts',
  'src/__tests__/**/*.test.mjs'
];

// jest.mock呼び出しを探す正規表現
const MOCK_REGEX = /jest\.mock\(\s*['"]([^'"]+)['"]\s*(?:,|\))/g;

// モックパスを修正する関数
function fixMockPath(filePath) {
  console.log(`処理中: ${filePath}`);

  // ファイルの内容を読み込む
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // すべてのjest.mock呼び出しを見つけて処理
  const modifiedContent = content.replace(MOCK_REGEX, (match, modulePath) => {
    // すでに.jsまたは.mjsで終わっている場合はそのまま返す
    if (modulePath.endsWith('.js') || modulePath.endsWith('.mjs')) {
      return match;
    }

    // 内部モジュールパスのみ処理（node_modulesなどは除外）
    if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
      modified = true;
      const newPath = `${modulePath}.js`;
      // マッチ部分全体を置換
      return match.replace(modulePath, newPath);
    }

    return match;
  });

  // 変更がある場合のみファイルを上書き
  if (modified) {
    fs.writeFileSync(filePath, modifiedContent, 'utf8');
    console.log(`  ✅ モックパスを修正しました: ${filePath}`);
    return true;
  } else {
    console.log(`  ⏭️ 変更なし: ${filePath}`);
    return false;
  }
}

// ディレクトリからファイルを再帰的に検索して処理
async function processDirectory() {
  let totalFixed = 0;
  let totalFiles = 0;

  // テストファイルを検索
  for (const pattern of TEST_DIRS) {
    const files = await glob(pattern);
    
    for (const file of files) {
      totalFiles++;
      if (fixMockPath(file)) {
        totalFixed++;
      }
    }
  }

  console.log(`\n処理完了: ${totalFixed}/${totalFiles} ファイルを修正しました`);
}

// スクリプトの実行
try {
  await processDirectory();
} catch (error) {
  console.error('エラーが発生しました:', error);
  process.exit(1);
} 