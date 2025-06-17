/**
 * .mjsファイル内の残りの型アノテーションを削除するスクリプト
 * REF-024: ESM型アノテーション削除の最終処理
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// テストディレクトリへのパス
const testsDir = path.resolve(__dirname, '../src/__tests__');

// 変換対象の拡張子
const targetExtension = '.mjs';

// 変換統計
let processedCount = 0;
let modifiedCount = 0;
let errorCount = 0;
let skippedCount = 0;

/**
 * コードをTS構文からJavaScript構文に変換する関数
 * @param {string} content ファイルの内容
 * @returns {string} 変換された内容
 */
function cleanupTypeScriptSyntax(content) {
  let result = content;

  // TypeScript固有のモディファイア（private, readonly, protected）を削除
  result = result.replace(/\b(private|readonly|protected|public)\s+/g, '');

  // インターフェース、型宣言を行単位で削除
  result = result.replace(/^\s*interface\s+\w+\s*\{[\s\S]*?\}\s*$/gm, '');
  result = result.replace(/^\s*type\s+\w+\s*=[\s\S]*?;\s*$/gm, '');

  // 型アノテーションを削除
  result = result.replace(/(\w+)\s*:\s*[A-Za-z0-9_<>\[\].,|&\s{}()?!'\\-]+(?=\s*[=,)])/g, '$1');
  result = result.replace(
    /(\([\w\s,]*)\s*:\s*[A-Za-z0-9_<>\[\].,|&\s{}()?!'\\-]+(?=\s*[,)])/g,
    '$1'
  );

  // 関数パラメータの型アノテーション削除
  result = result.replace(/function\s+(\w+)\s*\(([\s\S]*?)\)/g, (match, funcName, params) => {
    // パラメータの型アノテーションを削除
    const cleanedParams = params.replace(/(\w+)\s*:\s*[A-Za-z0-9_<>\[\].,|&\s{}()?!'\\-]+/g, '$1');
    return `function ${funcName}(${cleanedParams})`;
  });

  // アロー関数の戻り値型アノテーションを削除
  result = result.replace(/\)\s*:\s*[A-Za-z0-9_<>\[\].,|&\s{}()?!'\\-]+\s*=>/g, ') =>');

  // オブジェクト定義内での型アノテーション削除
  result = result.replace(/(\w+)\s*:\s*[A-Za-z0-9_<>\[\].,|&\s{}()?!'\\-]+\s*(?=,|$)/g, '$1');

  // メソッド戻り値の型アノテーションを削除
  result = result.replace(/(\w+\([^)]*\))\s*:\s*[A-Za-z0-9_<>\[\].,|&\s{}()?!'\\-]+\s*\{/g, '$1 {');

  // ジェネリクス型パラメータを削除
  result = result.replace(/\w+<[^>]+>/g, (match) => match.split('<')[0]);

  // as キーワードによるキャストを削除
  result = result.replace(/\bas\s+[A-Za-z0-9_<>\[\].,|&\s{}()?!'\\-]+/g, '');

  // 改行されている型アノテーションを削除
  result = result.replace(
    /(\w+)\s*:\s*[\r\n\s]*[A-Za-z0-9_<>\[\].,|&\s{}()?!'\\-]+(?=\s*[=,)])/g,
    '$1'
  );

  // "Position""のような壊れた文字列リテラルを修正（間に型名が入っている）
  result = result.replace(/(["\'])([A-Za-z0-9_]+)(?:["\'])([A-Za-z0-9_]+)/g, '$1$2$3$1');

  // symbol/USDTのような壊れた文字列リテラルを修正
  result = result.replace(/(\w+)\/(\w+)/g, "'$1/$2'");

  // 数値*演算子のスペース修正
  result = result.replace(/(\w+)\*\s*([0-9.]+)/g, '$1 * $2');

  // symbol'BTC/USDT'のような壊れた構文を修正
  result = result.replace(/(\w+)'([^']+)'/g, "$1: '$2'");

  // 'market.atr_period': 28'のような壊れた文字列リテラルを修正
  result = result.replace(/'([^']+)':\s*(\d+)'/g, "'$1': $2");

  // bool'${TEST_BOOLEAN}''のような壊れたテンプレートリテラルを修正
  result = result.replace(/(\w+)'(\${[^}]+})'/g, "$1: '$2'");

  // 壊れた三項演算子の修正 (=== '1h' ? 3600000 === '4h' ? 14400000のようなパターン)
  result = result.replace(/(===\s*'[^']+'\s*\?\s*\d+)\s+===\s*/g, '$1 : (');
  result = result.replace(
    /(\?\s*\d+\s*===\s*'[^']+'\s*\?\s*\d+\s*===\s*'[^']+'\s*\?\s*\d+);/g,
    '$1);'
  );

  // setTimeout(resolve", this.latency)のような壊れた構文を修正
  result = result.replace(/setTimeout\(resolve"(.*?)\)/g, 'setTimeout(resolve$1)');

  // typeof this.fillMonitorTask.destroy'function'のような壊れた構文を修正
  result = result.replace(
    /typeof\s+(\w+(?:\.\w+)*?)\.(\w+)'function'/g,
    "typeof $1.$2 === 'function'"
  );

  // ket.atr_period')).toBe(14)のような壊れた構文を修正
  result = result.replace(/(\w+)'(\)\)\.toBe\(\d+\))/g, '$1$2');

  return result;
}

/**
 * 指定したディレクトリ内のファイルを再帰的に検索する
 * @param {string} dir 検索対象ディレクトリ
 * @param {Array<string>} files 見つかったファイルを格納する配列
 * @returns {Array<string>} 見つかったファイルのパス配列
 */
function findMjsFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findMjsFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith(targetExtension)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * ファイル内の型アノテーションを削除する
 * @param {string} filePath 処理対象ファイルのパス
 * @returns {Promise<void>}
 */
async function cleanupTypeAnnotations(filePath) {
  try {
    processedCount++;
    console.log(`処理中: ${filePath}`);

    const content = fs.readFileSync(filePath, 'utf8');
    const modifiedContent = cleanupTypeScriptSyntax(content);

    if (content !== modifiedContent) {
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
      console.log(`  修正: ${filePath}`);
      modifiedCount++;
    } else {
      console.log(`  変更なし: ${filePath}`);
      skippedCount++;
    }
  } catch (error) {
    console.error(`エラー (${filePath}): ${error.message}`);
    errorCount++;
  }
}

/**
 * メイン処理
 */
async function main() {
  try {
    const files = findMjsFiles(testsDir);

    console.log(`${files.length}個の.mjsファイルが見つかりました。`);

    for (const file of files) {
      await cleanupTypeAnnotations(file);
    }

    console.log('\n処理結果:');
    console.log(`処理ファイル数: ${processedCount}`);
    console.log(`修正ファイル数: ${modifiedCount}`);
    console.log(`変更なしファイル数: ${skippedCount}`);
    console.log(`エラーファイル数: ${errorCount}`);
  } catch (error) {
    console.error(`実行エラー: ${error.message}`);
  }
}

// スクリプト実行
main();
