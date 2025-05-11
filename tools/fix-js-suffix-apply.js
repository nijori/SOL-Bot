#!/usr/bin/env node

/**
 * ESMの相対パスサフィックス(.js)問題を自動修正するスクリプト
 * 相対パスimport/requireに.jsサフィックスを追加します
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 相対パスの正規表現パターン
const IMPORT_REGEX = /(?:import\s+(?:[^;'"]*\s+from\s+)?['"]|import\(\s*['"]|require\(\s*['"])(\.[^'"]+)['"]\)?/g;

// 除外パターン
const EXCLUDE_DIRS = [
  'node_modules', 
  'dist',
  '.git'
];

const TARGET_EXTENSIONS = ['.js', '.ts', '.tsx', '.mjs'];

/**
 * 指定ディレクトリ配下のファイルを検索
 */
function findFiles(basePath) {
  const globPattern = `${basePath}/**/*@(${TARGET_EXTENSIONS.join('|').replace(/\./g, '')})`;
  
  return glob.sync(globPattern, {
    ignore: EXCLUDE_DIRS.map(dir => `${basePath}/${dir}/**/*`),
    nodir: true
  });
}

/**
 * ファイル内容を修正
 */
function fixFileContent(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  let modifiedCount = 0;
  
  // ヘルパー関数: インポートパスに.jsを追加する処理
  function replaceImportPath(match, importPath, quote) {
    // すでに.jsなら何もしない
    if (importPath.endsWith('.js')) {
      return match;
    }
    
    // 相対パスでなければ何もしない
    if (!importPath.startsWith('.')) {
      return match;
    }
    
    modifiedCount++;
    return match.replace(importPath + quote, importPath + '.js' + quote);
  }
  
  // import/exportステートメントを修正
  content = content.replace(
    /(import|export)[\s\S]*?from\s+(['"])(\.(?:\.)?\/[^'"]+?)(['"])/g,
    (match, statement, openQuote, importPath, closeQuote) => {
      return replaceImportPath(match, importPath, closeQuote);
    }
  );
  
  // 動的importを修正
  content = content.replace(
    /import\(\s*(['"])(\.(?:\.)?\/[^'"]+?)(['"])\s*\)/g,
    (match, openQuote, importPath, closeQuote) => {
      return replaceImportPath(match, importPath, closeQuote);
    }
  );
  
  // requireを修正
  content = content.replace(
    /require\(\s*(['"])(\.(?:\.)?\/[^'"]+?)(['"])\s*\)/g,
    (match, openQuote, importPath, closeQuote) => {
      return replaceImportPath(match, importPath, closeQuote);
    }
  );
  
  // テンプレートリテラル内のimportも修正 (主にテストコード用)
  content = content.replace(
    /import\s+[\s\S]*?from\s+['"]\.(?:\.)?\/[^'"]+?['"]/g,
    (match) => {
      // テンプレートリテラル内にあるかを確認
      const isInTemplateLiteral = (str, pos) => {
        let backtickCount = 0;
        for (let i = 0; i < pos; i++) {
          if (str[i] === '`') {
            backtickCount++;
          }
        }
        return backtickCount % 2 === 1; // 奇数のバッククォートがあればテンプレート内
      };
      
      // コンテンツ内の位置を見つける
      const matchPos = content.indexOf(match);
      if (matchPos !== -1 && isInTemplateLiteral(content, matchPos)) {
        // テンプレート内の場合、同じ正規表現でサフィックスを追加
        return match.replace(
          /(from\s+['"])(\.(?:\.)?\/[^'"]+?)(['"])/g,
          (m, before, path, after) => before + path + '.js' + after
        );
      }
      return match;
    }
  );
  
  // 変更があったら保存
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return modifiedCount;
  }
  
  return 0;
}

/**
 * 実行
 */
async function main() {
  const args = process.argv.slice(2);
  const targetDir = args[0] || '.';
  const dryRun = args.includes('--dry-run');
  
  console.log(`🔍 ${targetDir} 配下のファイルをスキャンしています...`);
  
  const files = findFiles(targetDir);
  console.log(`📁 ${files.length} ファイルを検索します`);
  
  let totalModified = 0;
  let modifiedFiles = 0;
  
  for (const file of files) {
    const modifications = dryRun ? 0 : fixFileContent(file);
    if (modifications > 0) {
      console.log(`✅ ${file}: ${modifications} 箇所修正`);
      totalModified += modifications;
      modifiedFiles++;
    }
  }
  
  if (dryRun) {
    console.log(`🔍 ドライラン実行：実際の変更は行いません`);
  } else if (totalModified === 0) {
    console.log(`✨ 修正が必要なファイルは見つかりませんでした`);
  } else {
    console.log(`🎉 完了！ ${modifiedFiles} ファイルの ${totalModified} 箇所を修正しました`);
  }
}

main().catch(err => {
  console.error('エラーが発生しました:', err);
  process.exit(1);
}); 