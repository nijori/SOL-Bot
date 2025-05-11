#!/usr/bin/env node

/**
 * ESMテスト用モック修正スクリプト
 * REF-030: JestのESM関連設定調整
 * 
 * このスクリプトはESMモジュールでのJestモックの問題を修正します
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// ルートディレクトリの取得
const rootDir = path.resolve(__dirname, '..');

// テストディレクトリ
const testDir = path.join(rootDir, 'src', '__tests__');

// ファイル内のモックパターン
const mockPatterns = [
  {
    search: /jest\.mock\(['"]([^'"]+)['"]\)/g,
    replace: (match, p1) => `jest.mock('${p1}', () => ({ __esModule: true, ...jest.requireActual('${p1}') }))`
  },
  {
    search: /jest\.spyOn\(([^,]+), ['"]([^'"]+)['"]\)/g,
    replace: (match, module, method) => {
      // すでに修正済みの場合はスキップ
      if (match.includes('__esModule')) return match;
      return `jest.spyOn(${module}, '${method}')`;
    }
  },
  {
    search: /import\.meta/g,
    replace: 'globalThis.__importMeta'
  }
];

// __mocks__ディレクトリのESM関連ファイルを処理
function processMockFiles() {
  const mockDir = path.join(rootDir, 'src', '__mocks__');
  
  // __mocks__ディレクトリがない場合は作成
  if (!fs.existsSync(mockDir)) {
    fs.mkdirSync(mockDir, { recursive: true });
    console.log(`✅ __mocks__ディレクトリを作成しました: ${mockDir}`);
  }
  
  // モックファイルのESM対応
  const mockFiles = glob.sync(path.join(mockDir, '*.js'));
  for (const file of mockFiles) {
    try {
      let content = fs.readFileSync(file, 'utf8');
      let modified = false;
      
      // CommonJSのモジュールエクスポートをESM互換に変更
      if (content.includes('module.exports = ') && !content.includes('__esModule')) {
        content = content.replace('module.exports = ', 'module.exports = { __esModule: true, default: ');
        content += ' };';
        modified = true;
      }
      
      if (modified) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`✅ モックファイルを修正しました: ${file}`);
      }
    } catch (err) {
      console.error(`❌ モックファイルの処理中にエラーが発生しました: ${file}`, err);
    }
  }
}

// テストファイルのモック関連修正
function processTestFiles() {
  // テストファイルを検索
  const testFiles = [
    ...glob.sync(path.join(testDir, '**/*.test.ts')),
    ...glob.sync(path.join(testDir, '**/*.test.mjs'))
  ];
  
  console.log(`🔍 ${testFiles.length}個のテストファイルを処理します...`);
  
  let totalModified = 0;
  
  // 各テストファイルを処理
  for (const file of testFiles) {
    try {
      let content = fs.readFileSync(file, 'utf8');
      let originalContent = content;
      
      // パターンに基づいて置換
      for (const pattern of mockPatterns) {
        content = content.replace(pattern.search, pattern.replace);
      }
      
      // 変更があれば保存
      if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`✅ テストファイルを修正しました: ${file}`);
        totalModified++;
      }
    } catch (err) {
      console.error(`❌ テストファイルの処理中にエラーが発生しました: ${file}`, err);
    }
  }
  
  console.log(`✅ ${totalModified}個のテストファイルを修正しました`);
}

// メイン処理
function main() {
  console.log('🚀 JestモックのESM互換性を修正しています...');
  
  // モックファイルを処理
  processMockFiles();
  
  // テストファイルを処理
  processTestFiles();
  
  console.log('✅ 修正が完了しました');
}

main();
