/**
 * ESMテストファイルのインポートパス修正スクリプト
 * TST-066: ESMテスト実行環境の修正
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 壊れたインポートパスパターンの修正定義
const fixPatterns = [
  // 壊れたインポートパス: 単一引用符問題
  { 
    pattern: /from\s+'(.+)'/g, 
    replacement: (_, p1) => {
      // 引用符内に引用符がある場合
      if (p1.includes("'")) {
        // 整形したパスを作成
        const cleanPath = p1.replace(/'/g, '');
        // .jsの拡張子がなければ追加
        const withExtension = cleanPath.endsWith('.js') ? cleanPath : `${cleanPath}.js`;
        return `from '${withExtension}'`;
      }
      // 通常のパスは変更なし
      return `from '${p1}'`;
    }
  },
  
  // 壊れたインポートパス: ダブル引用符問題
  { 
    pattern: /from\s+"(.+)"/g, 
    replacement: (_, p1) => {
      // 引用符内に引用符がある場合
      if (p1.includes('"')) {
        // 整形したパスを作成
        const cleanPath = p1.replace(/"/g, '');
        // .jsの拡張子がなければ追加
        const withExtension = cleanPath.endsWith('.js') ? cleanPath : `${cleanPath}.js`;
        return `from "${withExtension}"`;
      }
      // 通常のパスは変更なし
      return `from "${p1}"`;
    }
  },
  
  // 壊れたパスの修正: '../../'path/to/module'.js' → '../../path/to/module.js'
  {
    pattern: /'([^']*)'([^']*)'([^']*)'/g,
    replacement: (match, p1, p2, p3) => {
      // パスを結合して整形
      return `'${p1}${p2}${p3}'`;
    }
  },
  
  // 拡張子の追加: from '../../path/to/module' → from '../../path/to/module.js'
  {
    pattern: /from\s+'([^']+)'\s*;/g,
    replacement: (match, p1) => {
      // 既に.jsで終わっている場合は変更なし
      if (p1.endsWith('.js') || p1.endsWith('.mjs') || p1.startsWith('@')) {
        return match;
      }
      // 拡張子を追加
      return `from '${p1}.js';`;
    }
  },
  
  // jest.mock修正: jest.mock('../../path/to/module') → jest.mock('../../path/to/module.js')
  {
    pattern: /jest\.mock\('([^']+)'/g,
    replacement: (match, p1) => {
      // 既に.jsで終わっている場合は変更なし
      if (p1.endsWith('.js') || p1.endsWith('.mjs') || p1.startsWith('@')) {
        return match;
      }
      // 拡張子を追加
      return `jest.mock('${p1}.js'`;
    }
  }
];

// ファイル処理関数
function processFile(filePath) {
  console.log(`処理中: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // 各パターンを適用
  for (const { pattern, replacement } of fixPatterns) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  }
  
  // 変更があった場合のみファイルを上書き
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 修正完了: ${filePath}`);
    return true;
  } else {
    console.log(`⏩ 変更なし: ${filePath}`);
    return false;
  }
}

// メイン処理
function main() {
  console.log('🔍 ESMテストファイルのインポートパス修正を開始...');
  
  // 処理対象のファイルパスパターン
  const patterns = [
    'src/__tests__/**/*.mjs',
    'src/__tests__/**/*.test.mjs'
  ];
  
  // 統計情報
  let totalFiles = 0;
  let modifiedFiles = 0;
  
  // 各パターンに一致するファイルを処理
  patterns.forEach(pattern => {
    const files = glob.sync(pattern, { ignore: 'node_modules/**' });
    files.forEach(file => {
      totalFiles++;
      if (processFile(file)) {
        modifiedFiles++;
      }
    });
  });
  
  // 結果レポート
  console.log('\n📊 処理結果:');
  console.log(`- 処理ファイル数: ${totalFiles}`);
  console.log(`- 修正ファイル数: ${modifiedFiles}`);
}

// スクリプト実行
main(); 