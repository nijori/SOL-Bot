#!/usr/bin/env node

/**
 * REF-028: Jestモック関数のESM対応スクリプト
 * 
 * このスクリプトは.mjsテストファイル内のJestモック関数をESM環境に適合させます。
 * 主な処理内容:
 * 1. jest.mockの修正 (requireMockからimportMockへの変換)
 * 2. モック定義の修正 (module.exportsからESM exportへの変換)
 * 3. jest関数呼び出しの修正
 * 4. モック実装の修正
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import glob from 'glob';

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 処理統計
const stats = {
  processedFiles: 0,
  modifiedFiles: 0,
  errorFiles: 0
};

// 検索対象ディレクトリ
const sourceDir = path.resolve(__dirname, '..', 'src', '__tests__');

/**
 * Jestモック関連の問題を修正する
 */
function fixJestMocksInFile(filePath) {
  console.log(`処理中: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    
    // 1. jest.mockの修正パターン
    const mockPattern = /jest\.mock\(['"](.+?)['"]\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*(?:,\s*\{\s*virtual\s*:\s*true\s*\})?\);/g;
    content = content.replace(mockPattern, (match, modulePath, implementation) => {
      // 修正されたESM対応のjest.mock文を作成
      const fixedPath = modulePath.replace(/(['"])\.\.\/\.\.\//, '$1../../')
                                  .replace(/(['"])$/, '.js$1');
      
      // 実装部分の修正
      let fixedImplementation = implementation
        .replace(/__esModule['"]?\s*[:=]\s*['"]?true['"]?/, '__esModule: true')
        .replace(/(['"])([^'"]+?)(['"])\s*:\s*jest\.fn\(\)/, '$1$2$3: jest.fn()');
      
      // モジュールパスの修正
      const fixedMatch = `jest.mock('${fixedPath}', () => {${fixedImplementation}}, { virtual: true });`;
      modified = true;
      return fixedMatch;
    });
    
    // 2. jest.mockImplementationの修正
    const mockImplPattern = /mockImplementation\(\(\)\s*=>\s*\{\s*return\s*\{([\s\S]*?)\}\s*\}\)/g;
    content = content.replace(mockImplPattern, (match, implementation) => {
      // 実装部分の修正
      let fixedImplementation = implementation
        .replace(/execute\)\.mockResolvedValue\(\{\s*signals\)\s*\}\)/, 'execute: jest.fn().mockResolvedValue({ signals: [] })')
        .replace(/\}\s*,\s*\{/, '},\n      {');
      
      const fixedMatch = `mockImplementation(() => {\n    return {${fixedImplementation}}\n  })`;
      modified = true;
      return fixedMatch;
    });
    
    // 3. 壊れたjest.requireMock呼び出しの修正
    content = content.replace(/jest\.requireMock\(['"]([^'"]+?)['"]\)/, 'jest.requireMock(\'$1\')');
    
    // 4. 壊れたコメント付きモック定義の修正
    content = content.replace(/(\/\/.*?\n)jest\.mock/g, '$1\njest.mock');
    
    // 5. その他の構文エラー修正
    content = content.replace(/this\s*=\s*this\.config\.symbol/, 'this.config.symbol')
                    .replace(/\}\s*\);(\s*\n+\s*\}\s*\);)/, '});\n$1');
    
    // ファイルが変更された場合のみ保存
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8');
      stats.modifiedFiles++;
      console.log(`✅ 修正完了: ${filePath}`);
    } else {
      console.log(`⏺️ 変更なし: ${filePath}`);
    }
    
    stats.processedFiles++;
    return true;
  } catch (error) {
    console.error(`❌ エラー(${filePath}):`, error.message);
    stats.errorFiles++;
    return false;
  }
}

/**
 * モックファイルをESM形式に変換
 */
function convertMockFilesToEsm() {
  // モックファイルの検索
  const mockFiles = glob.sync(path.join(sourceDir, '**', 'mocks', '*.js'));
  
  mockFiles.forEach(filePath => {
    console.log(`モックファイル変換: ${filePath}`);
    
    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      
      // CommonJSからESMへの変換
      if (content.includes('module.exports')) {
        // module.exportsをESM exportに変換
        content = content.replace(/module\.exports\s*=\s*\{([\s\S]*?)\};/, (match, exports) => {
          // 名前付きエクスポートに変換
          const esmExports = exports.trim().split('\n').map(line => {
            // 最後のカンマを除去
            const trimmedLine = line.trim().replace(/,$/, '');
            
            // クラス名とモック実装を分離
            const match = trimmedLine.match(/([A-Za-z0-9_]+):\s*(.*)/);
            if (match) {
              const [, name, implementation] = match;
              return `export const ${name} = ${implementation}`;
            }
            return line;
          }).join('\n');
          
          // コメントを保持しながらESM形式に変換
          const headerComment = content.match(/^\/\/.*?\n/);
          const header = headerComment ? headerComment[0] + '\n' : '';
          
          return header + esmExports;
        });
        
        // .mjsファイルとして保存
        const newFilePath = filePath.replace(/\.js$/, '.mjs');
        fs.writeFileSync(newFilePath, content, 'utf-8');
        console.log(`✅ モックファイル変換完了: ${newFilePath}`);
        
        // 元のファイルを削除するかどうかのコメント（必要に応じて有効化）
        // fs.unlinkSync(filePath);
        // console.log(`🗑️ 元ファイル削除: ${filePath}`);
      }
    } catch (error) {
      console.error(`❌ モックファイル変換エラー(${filePath}):`, error.message);
    }
  });
}

/**
 * setupJest.mjsファイルの修正
 */
function fixSetupJestFile() {
  const setupFilePath = path.join(sourceDir, 'core', 'setupJest.mjs');
  
  if (fs.existsSync(setupFilePath)) {
    console.log(`setupJestファイル修正: ${setupFilePath}`);
    
    try {
      let content = fs.readFileSync(setupFilePath, 'utf-8');
      let modified = false;
      
      // 1. 壊れた関数宣言の修正
      content = content.replace(/function\s+\$1\(\)\s*\{([\s\S]*?)\}/, function(match, body) {
        return `function mockModuleHelper() {${body}}`;
      });
      
      // 2. 壊れたオブジェクト構文の修正
      content = content.replace(/\{([\s\S]*?)__esModule\s*,/g, '{$1__esModule: true,');
      
      // 3. 壊れたプロパティ参照の修正
      content = content.replace(/\[(moduleName)\]/g, '[$1]');
      
      // 4. 壊れたjest.mock呼び出しの修正
      content = content.replace(/jest\.mock\(['"]([^'"]+)['"]\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\{\s*virtual\s*:\s*true\s*\}\s*;/g, 
        (match, modulePath, body) => {
          // モジュールパスの.js拡張子を確保
          const fixedPath = modulePath.endsWith('.js') ? modulePath : `${modulePath}.js`;
          
          // 実装部分の修正
          let fixedBody = body.replace(/(\s*return\s*\{[\s\S]*?)__esModule\s*:\s*true\s*,/g, '$1__esModule: true,');
          
          // 修正したjest.mock呼び出し
          return `jest.mock('${fixedPath}', () => {${fixedBody}}, { virtual: true });`;
        }
      );
      
      // 5. モック実装の修正（execute).mockResolvedValue → execute: jest.fn().mockResolvedValue）
      content = content.replace(/execute\)\.mockResolvedValue\(\{\s*signals\s*:\s*\[\]\s*\}\)/g, 
        'execute: jest.fn().mockResolvedValue({ signals: [] })');
      
      // ファイルが変更された場合のみ保存
      if (content !== fs.readFileSync(setupFilePath, 'utf-8')) {
        fs.writeFileSync(setupFilePath, content, 'utf-8');
        console.log(`✅ setupJestファイル修正完了`);
      } else {
        console.log(`⏺️ setupJestファイル変更なし`);
      }
    } catch (error) {
      console.error(`❌ setupJestファイル修正エラー:`, error.message);
    }
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('REF-028: Jestモック関数のESM対応を開始します...');
  
  // 1. ESMモック変換（.mjsファイル内のjest.mock呼び出しを修正）
  const mjsFiles = glob.sync(path.join(sourceDir, '**', '*.mjs'));
  console.log(`${mjsFiles.length}個の.mjsファイルを処理します...`);
  
  // 各ファイルを処理
  for (const filePath of mjsFiles) {
    fixJestMocksInFile(filePath);
  }
  
  // 2. mockファイルをESM形式に変換
  console.log('\nモックファイルのESM変換を実行します...');
  convertMockFilesToEsm();
  
  // 3. setupJest.mjsファイルの特別処理
  console.log('\nsetupJest.mjsファイルの修正を実行します...');
  fixSetupJestFile();
  
  // 4. 処理結果の表示
  console.log('\n=== 処理完了 ===');
  console.log(`処理ファイル数: ${stats.processedFiles}`);
  console.log(`修正ファイル数: ${stats.modifiedFiles}`);
  console.log(`エラーファイル数: ${stats.errorFiles}`);
}

// スクリプト実行
main().catch(err => {
  console.error('致命的なエラー:', err);
  process.exit(1);
}); 