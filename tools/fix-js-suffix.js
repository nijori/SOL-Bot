#!/usr/bin/env node

/**
 * ESMの相対パスサフィックス(.js)問題を修正するスクリプト
 * 相対パスimport/requireで.jsが付いていないものを特定し、手動確認用にリストを生成
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
 * ファイル内の相対パスimportを検索
 */
function findRelativeImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const matches = [];
  let match;

  while ((match = IMPORT_REGEX.exec(content)) !== null) {
    const importPath = match[1];
    
    // 相対パスかつ.jsで終わっていないもの
    if (importPath.startsWith('.') && !importPath.endsWith('.js')) {
      matches.push({
        path: importPath,
        position: match.index,
        line: content.substring(0, match.index).split('\n').length
      });
    }
  }

  return matches.length > 0 ? { file: filePath, matches } : null;
}

/**
 * ファイルの修正候補を生成
 */
function generateFixSuggestion(fileInfo) {
  const content = fs.readFileSync(fileInfo.file, 'utf-8');
  const lines = content.split('\n');
  
  return fileInfo.matches.map(match => {
    const lineContent = lines[match.line - 1];
    const newLineContent = lineContent.replace(
      new RegExp(`(['"])${match.path.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(['"])`, 'g'),
      `$1${match.path}.js$2`
    );
    
    return {
      file: fileInfo.file,
      line: match.line,
      original: lineContent,
      suggested: newLineContent
    };
  });
}

/**
 * 実行
 */
async function main() {
  const args = process.argv.slice(2);
  const targetDir = args[0] || '.';
  
  console.log(`🔍 ${targetDir} 配下のJavaScriptおよびTypeScriptファイルをスキャンしています...`);
  
  const files = findFiles(targetDir);
  console.log(`📁 ${files.length} ファイルを検索します`);
  
  const importsToFix = [];
  
  for (const file of files) {
    const fileImports = findRelativeImports(file);
    if (fileImports) {
      importsToFix.push(fileImports);
    }
  }
  
  if (importsToFix.length === 0) {
    console.log('✅ 修正が必要なimport/requireは見つかりませんでした！');
    return;
  }
  
  console.log(`⚠️ ${importsToFix.length} ファイルに修正が必要なimport/requireが見つかりました`);
  
  const totalMatches = importsToFix.reduce((sum, info) => sum + info.matches.length, 0);
  console.log(`🔧 合計 ${totalMatches} 箇所の修正候補があります`);
  
  const fixes = importsToFix.flatMap(generateFixSuggestion);
  
  // 候補リストをファイルに出力
  const outputFile = 'esm-fix-suggestions.txt';
  const output = fixes.map(fix => 
    `📝 ${fix.file}:${fix.line}\n- ${fix.original}\n+ ${fix.suggested}\n`
  ).join('\n');
  
  fs.writeFileSync(outputFile, output);
  console.log(`📋 修正候補を ${outputFile} に保存しました`);
  
  // CSVも出力
  const csvOutputFile = 'esm-fix-suggestions.csv';
  const csvHeader = 'file,line,original,suggested\n';
  const csvContent = fixes.map(fix => 
    `"${fix.file}","${fix.line}","${fix.original.replace(/"/g, '""')}","${fix.suggested.replace(/"/g, '""')}"`
  ).join('\n');
  
  fs.writeFileSync(csvOutputFile, csvHeader + csvContent);
  console.log(`📊 修正候補CSVを ${csvOutputFile} に保存しました`);
}

main().catch(err => {
  console.error('エラーが発生しました:', err);
  process.exit(1);
}); 