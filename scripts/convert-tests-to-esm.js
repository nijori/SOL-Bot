/**
 * テストファイルをCommonJSからESMに一括変換するスクリプト
 * REF-021: テスト変換スクリプト改良
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// テストディレクトリへのパス
const testDir = path.resolve(__dirname, '../src/__tests__');

// 変換対象の拡張子
const extensions = ['.test.ts'];

// 変換成功・失敗をカウント
let successCount = 0;
let failureCount = 0;
let skippedCount = 0;

/**
 * 型アノテーションを削除する正規表現パターン
 */
const typePatterns = {
  // 変数宣言の型アノテーション
  variableType: /(\w+)\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?]+\s*=/g,
  
  // 関数パラメータの型アノテーション
  functionParams: /\(([^)]*)\)\s*=>/g,
  
  // 関数定義の戻り値型アノテーション
  functionReturn: /function\s+(\w+)\s*\(([^)]*)\)\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?]+/g,
  
  // クラスメソッドの型アノテーション
  classMethod: /(\w+)\s*\(([^)]*)\)\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?]+\s*{/g,
  
  // asキャスト
  asCast: /\s+as\s+[A-Za-z0-9_<>[\].,|&\s{}()?]+/g,
  
  // ジェネリック型のコレクション
  genericCollections: [
    /new Map<[^>]+>/g,
    /new Set<[^>]+>/g,
    /new Array<[^>]+>/g,
    /Map<[^>]+>/g,
    /Set<[^>]+>/g,
    /Array<[^>]+>/g,
    /Record<[^>]+>/g,
    /Promise<[^>]+>/g
  ],
  
  // インラインのキャスト (例: <number>var や <string[]>array)
  inlineCast: /<[A-Za-z0-9_<>[\].,|&\s{}()?]+>\s*\w+/g,
  
  // インターフェース実装宣言
  implements: /\s+implements\s+[A-Za-z0-9_<>[\].,|&\s{}()?]+/g,
  
  // extendsジェネリック型
  extendsGeneric: /extends\s+[A-Za-z0-9_<>[\].,|&\s{}()?]+/g,
  
  // 型宣言
  typeDeclaration: /type\s+[A-Za-z0-9_]+\s*=\s*[A-Za-z0-9_<>[\].,|&\s{}()?]+;/g,
  
  // インターフェース宣言
  interfaceDeclaration: /interface\s+[A-Za-z0-9_]+(\s+extends\s+[A-Za-z0-9_<>[\].,|&\s{}()?]+)?\s*{[^}]*}/g,
  
  // モック型パラメータ（jest.fn<戻り値型, パラメータ型>()）
  mockFnGeneric: /jest\.fn<[^>]+>\(\)/g,
  
  // jest.Mocked<>型
  jestMocked: /jest\.Mocked<[^>]+>/g
};

/**
 * ファイル内の型アノテーションとTypeScript構文を削除する関数
 * @param {string} content ファイルの内容
 * @returns {string} 型アノテーションが削除された内容
 */
function removeTypeAnnotations(content) {
  let result = content;
  
  // インターフェースとタイプ宣言の削除（これは行レベルで行う必要がある）
  const lines = result.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    // インターフェース定義やタイプ定義の行全体を削除
    return !(
      trimmed.startsWith('interface ') || 
      trimmed.startsWith('type ') ||
      // エクスポートされたインターフェースやタイプ定義も削除
      trimmed.startsWith('export interface ') || 
      trimmed.startsWith('export type ')
    );
  });
  result = filteredLines.join('\n');
  
  // 変数宣言の型アノテーションを削除
  result = result.replace(typePatterns.variableType, '$1 =');
  
  // 関数パラメータの型アノテーションを削除
  result = result.replace(typePatterns.functionParams, (match, params) => {
    // パラメータごとに型アノテーションを削除
    const cleanedParams = params.replace(/(\w+)\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?]+/g, '$1')
                                .replace(/\.\.\.\w+\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?]+/g, '...$1');
    return `(${cleanedParams}) =>`;
  });
  
  // 関数定義の型アノテーションを削除
  result = result.replace(typePatterns.functionReturn, (match, name, params) => {
    // パラメータごとに型アノテーションを削除
    const cleanedParams = params.replace(/(\w+)\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?]+/g, '$1')
                                .replace(/\.\.\.\w+\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?]+/g, '...$1');
    return `function ${name}(${cleanedParams})`;
  });
  
  // クラスメソッドの型アノテーションを削除
  result = result.replace(typePatterns.classMethod, (match, name, params) => {
    // パラメータごとに型アノテーションを削除
    const cleanedParams = params.replace(/(\w+)\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?]+/g, '$1')
                                .replace(/\.\.\.\w+\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?]+/g, '...$1');
    return `${name}(${cleanedParams}) {`;
  });
  
  // asキャストを削除
  result = result.replace(typePatterns.asCast, '');
  
  // ジェネリック型のコレクションを修正
  for (const pattern of typePatterns.genericCollections) {
    // ジェネリック部分を削除
    result = result.replace(pattern, (match) => {
      return match.replace(/<[^>]+>/g, '()');
    });
  }
  
  // インラインのキャストを削除
  result = result.replace(typePatterns.inlineCast, match => {
    // <型>変数 を 変数 に変換
    return match.replace(/<[^>]+>\s*/, '');
  });
  
  // implememts宣言を削除
  result = result.replace(typePatterns.implements, '');
  
  // extendsジェネリック型を簡略化
  result = result.replace(typePatterns.extendsGeneric, match => {
    // ジェネリック部分を削除して基本クラス名のみ残す
    return match.replace(/<[^>]+>/g, '');
  });
  
  // jest.fnのモック型パラメータを削除
  result = result.replace(typePatterns.mockFnGeneric, 'jest.fn()');
  
  // jest.Mocked<> 型を削除
  result = result.replace(typePatterns.jestMocked, '');
  
  return result;
}

/**
 * モックブロックを強化して変換する関数
 * @param {string} mockBlock モックブロックの内容
 * @returns {string} 変換されたモックブロック
 */
function enhanceMockBlock(mockBlock) {
  // モック内の型アノテーションを削除
  let cleanedMock = removeTypeAnnotations(mockBlock);
  
  // クラスのモックを強化
  cleanedMock = cleanedMock.replace(
    /jest\.mock\(['"]([^'"]+)['"](,\s*\(\)\s*=>\s*{[\s\S]*?}\s*)?\);/g,
    (match, mockPath, mockImplementation) => {
      // 相対パスに.js拡張子を追加
      const updatedPath = mockPath.startsWith('.') && !path.extname(mockPath) 
        ? `${mockPath}.js`
        : mockPath;
      
      // モック実装があればそのまま使用、なければ基本的なものを返す
      if (mockImplementation) {
        return `jest.mock('${updatedPath}'${mockImplementation})`;
      } else {
        return `jest.mock('${updatedPath}')`;
      }
    }
  );
  
  // モック関数内の型キャストを削除
  cleanedMock = cleanedMock.replace(
    /mockReturnValue\(<[^>]+>([^)]+)\)/g,
    'mockReturnValue($1)'
  );
  
  return cleanedMock;
}

/**
 * インポート文を解析・修正して.js拡張子を追加する関数
 * @param {string} content ファイルの内容
 * @returns {string} インポート文が修正された内容
 */
function processImportStatements(content) {
  const lines = content.split('\n');
  const processedLines = [];
  let insideBlockComment = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // ブロックコメントのスキップ処理
    if (line.includes('/*') && !line.includes('*/')) {
      insideBlockComment = true;
      processedLines.push(line);
      continue;
    }
    
    if (insideBlockComment) {
      if (line.includes('*/')) {
        insideBlockComment = false;
      }
      processedLines.push(line);
      continue;
    }
    
    // 行がインポート文を含むか確認
    if (line.trim().startsWith('import ')) {
      // 1行完結のインポート文をチェック
      if (line.includes(' from ')) {
        // 相対パスのインポートには.js拡張子を追加
        line = line.replace(
          /from\s+['"]([^'"]+)['"]/g,
          (match, importPath) => {
            if ((importPath.startsWith('.') || importPath.startsWith('/')) && !path.extname(importPath)) {
              return `from '${importPath}.js'`;
            }
            return match;
          }
        );
        processedLines.push(line);
      } else {
        // 複数行のインポート文を処理
        let multilineImport = line;
        let j = i;
        
        while (j < lines.length && !lines[j].includes(' from ')) {
          j++;
          if (j < lines.length) {
            multilineImport += ' ' + lines[j].trim();
          }
        }
        
        if (j < lines.length) {
          // 相対パスのインポートには.js拡張子を追加
          multilineImport = multilineImport.replace(
            /from\s+['"]([^'"]+)['"]/g,
            (match, importPath) => {
              if ((importPath.startsWith('.') || importPath.startsWith('/')) && !path.extname(importPath)) {
                return `from '${importPath}.js'`;
              }
              return match;
            }
          );
          
          processedLines.push(multilineImport);
          i = j; // インデックスを複数行インポートの最後に更新
        } else {
          // fromが見つからない場合は元の行を追加
          processedLines.push(line);
        }
      }
    } else {
      // インポート文でない場合はそのまま追加
      processedLines.push(line);
    }
  }
  
  return processedLines.join('\n');
}

/**
 * TSファイルをESM形式に変換する
 * @param {string} filePath ファイルパス
 */
async function convertFileToEsm(filePath) {
  try {
    console.log(`Converting ${filePath}...`);
    
    // ファイルの内容を読み込む
    const content = fs.readFileSync(filePath, 'utf8');
    
    // ファイルが既にESMっぽい構造なら変換をスキップ
    if (content.includes('import { jest } from \'@jest/globals\';') && 
        !content.includes('jest.mock(')) {
      console.log(`📦 Skipping ${filePath} - already seems to be ESM compatible`);
      skippedCount++;
      return;
    }
    
    // 元のコンテンツのコメントを見つける
    let fileComment = '';
    if (content.trim().startsWith('/**')) {
      const commentEnd = content.indexOf('*/') + 2;
      fileComment = content.substring(0, commentEnd) + '\n\n';
    }
    
    // ESM互換のためにjestインポートを追加
    let updatedContent = 
      `// ESM環境向けに変換されたテストファイル\n${fileComment}` +
      `import { jest, describe, beforeEach, afterEach, test, it, expect } from '@jest/globals';\n\n`;
    
    // インポート行を処理
    const contentWithProcessedImports = processImportStatements(content);
    const contentLines = contentWithProcessedImports.split('\n');
    
    // インポート行のみを抽出
    const importLines = [];
    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i].trim();
      if (line.startsWith('import ') && 
          !line.includes('@jest/globals') && 
          (line.includes(' from ') || !line.includes(';'))) {
        
        // インポート行が終わるまで追加
        let fullImport = contentLines[i];
        let j = i;
        
        while (!fullImport.includes(';') && j < contentLines.length - 1) {
          j++;
          fullImport += '\n' + contentLines[j];
        }
        
        importLines.push(fullImport);
        i = j; // インデックスを更新
      }
    }
    
    // インポート行を追加
    updatedContent += importLines.join('\n') + '\n\n';
    
    // モックとテストコードを抽出して処理
    let testCode = '';
    let contentAfterImports = contentWithProcessedImports;
    
    // インポート行をすべて削除
    for (const importLine of importLines) {
      contentAfterImports = contentAfterImports.replace(importLine, '');
    }
    
    // コンテンツの先頭にあるコメント部分も削除
    if (fileComment) {
      contentAfterImports = contentAfterImports.replace(fileComment, '');
    }
    
    // jest.mockブロックを探して強化処理
    const mockBlocks = [];
    const mockRegex = /jest\.mock\(['"][^'"]+['"](\s*,\s*\(\)\s*=>\s*{[\s\S]*?}\s*)?\);/g;
    let mockMatch;
    
    while ((mockMatch = mockRegex.exec(contentAfterImports)) !== null) {
      mockBlocks.push({
        fullMatch: mockMatch[0],
        enhancedBlock: enhanceMockBlock(mockMatch[0])
      });
    }
    
    // jest.mockブロックを置換
    let processedContent = contentAfterImports;
    for (const mockBlock of mockBlocks) {
      processedContent = processedContent.replace(mockBlock.fullMatch, mockBlock.enhancedBlock);
    }
    
    // 型アノテーションを削除
    testCode = removeTypeAnnotations(processedContent);
    
    // 最終的なコンテンツを作成
    updatedContent += testCode;
    
    // 循環参照の問題に対処するためのimportMetapolyfillを追加
    if (updatedContent.includes('TypeError: Cannot read') || 
        updatedContent.includes('ReferenceError: Cannot access')) {
      updatedContent = 
        `// 循環参照対策のポリフィル\n` +
        `if (typeof globalThis.__jest_import_meta_url === 'undefined') {\n` +
        `  globalThis.__jest_import_meta_url = 'file:///';\n` +
        `}\n\n` +
        updatedContent;
    }
    
    // .mjsファイルに書き込む
    const newFilePath = filePath.replace(/\.test\.ts$/, '.test.mjs');
    fs.writeFileSync(newFilePath, updatedContent);
    
    console.log(`✅ Created ${newFilePath}`);
    successCount++;
  } catch (err) {
    console.error(`❌ Error converting ${filePath}:`, err);
    failureCount++;
  }
}

/**
 * ディレクトリを再帰的に処理
 * @param {string} dir ディレクトリパス
 */
async function processDirectory(dir) {
  // ディレクトリ内のファイルを取得
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // サブディレクトリを再帰的に処理
      await processDirectory(filePath);
    } else if (extensions.some(ext => file.endsWith(ext))) {
      // 対象の拡張子のファイルを変換
      await convertFileToEsm(filePath);
    }
  }
}

/**
 * 既存の.mjsファイルを削除
 * @param {string} dir ディレクトリパス
 */
async function cleanMjsFiles(dir) {
  // ディレクトリ内のファイルを取得
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // サブディレクトリを再帰的に処理
      await cleanMjsFiles(filePath);
    } else if (file.endsWith('.test.mjs')) {
      // 既存の.mjsファイルを削除
      fs.unlinkSync(filePath);
      console.log(`🗑️ Deleted ${filePath}`);
    }
  }
}

/**
 * 結果の要約を表示
 */
function printSummary() {
  console.log('\n===== 変換結果 =====');
  console.log(`✅ 成功: ${successCount} ファイル`);
  console.log(`❌ 失敗: ${failureCount} ファイル`);
  console.log(`📦 スキップ: ${skippedCount} ファイル`);
  console.log('====================\n');
}

// メイン処理
async function main() {
  try {
    console.log('Cleaning up existing MJS files...');
    await cleanMjsFiles(testDir);
    
    console.log('Starting conversion of test files to ESM...');
    await processDirectory(testDir);
    
    printSummary();
    
    if (failureCount === 0) {
      console.log('Conversion complete! All files successfully converted.');
    } else {
      console.warn(`Conversion completed with ${failureCount} failures.`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error during conversion:', err);
    process.exit(1);
  }
}

main(); 