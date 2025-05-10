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
  variableType: /(\w+)\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?!]+\s*=/g,

  // 関数パラメータの型アノテーション (かっこ内の型を完全に除去)
  functionParams: /\(([^)]*)\)\s*=>/g,

  // 関数定義の戻り値型アノテーション
  functionReturn: /function\s+(\w+)\s*\(([^)]*)\)\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?!]+/g,

  // クラスメソッドの型アノテーション
  classMethod: /(\w+)\s*\(([^)]*)\)\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?!]+\s*{/g,

  // asキャスト
  asCast: /\s+as\s+[A-Za-z0-9_<>[\].,|&\s{}()?!]+/g,

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
  inlineCast: /<[A-Za-z0-9_<>[\].,|&\s{}()?!]+>\s*\w+/g,

  // インターフェース実装宣言
  implements: /\s+implements\s+[A-Za-z0-9_<>[\].,|&\s{}()?!]+/g,

  // extendsジェネリック型
  extendsGeneric: /extends\s+[A-Za-z0-9_<>[\].,|&\s{}()?!]+/g,

  // 型宣言
  typeDeclaration: /type\s+[A-Za-z0-9_]+\s*=\s*[A-Za-z0-9_<>[\].,|&\s{}()?!]+;/g,

  // インターフェース宣言
  interfaceDeclaration:
    /interface\s+[A-Za-z0-9_]+(\s+extends\s+[A-Za-z0-9_<>[\].,|&\s{}()?!]+)?\s*{[^}]*}/g,

  // モック型パラメータ（jest.fn<戻り値型, パラメータ型>()）
  mockFnGeneric: /jest\.fn<[^>]+>\(\)/g,

  // jest.Mocked<>型
  jestMocked: /jest\.Mocked<[^>]+>/g,

  // 非nullアサーション演算子 (!)
  nonNullAssertion: /(\w+)!/g,

  // アロー関数のパラメータの型アノテーション
  arrowFunctionParams: /(\w+)\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?!]+\s*=>/g,

  // 関数呼び出しの型パラメータ
  functionCallTypeParams: /(\w+)<[^>]*>\(/g,

  // Union型のパラメータ
  unionTypeParams: /'[^']*'\s*\|\s*'[^']*'(\s*\|\s*'[^']*')*/g,

  // 関数パラメータ後の=演算子の修正
  parameterWithEquals: /\)\s*=\s*\[/g
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
  const filteredLines = lines.filter((line) => {
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

  // アロー関数のパラメータの型アノテーションを削除
  result = result.replace(typePatterns.arrowFunctionParams, '$1 =>');

  // 関数パラメータの型アノテーションを削除
  result = result.replace(typePatterns.functionParams, (match, params) => {
    // パラメータごとに型アノテーションを削除
    // 型アノテーション（: type）を完全に削除
    const cleanedParams = params
      .replace(/(\w+)\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?!]+/g, '$1')
      .replace(/\.\.\.\w+\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?!]+/g, '...$1');
    return `(${cleanedParams}) =>`;
  });

  // mockImplementation内のパラメータの括弧が閉じられていない問題を修正
  result = result.replace(/mockImplementation\(\((\w+)(\s*)=>/g, 'mockImplementation(($1)$2=>');

  // mock.callsの構文エラーを修正
  result = result.replace(/const\s+calls\s+=\s+\(([^;]+);/g, 'const calls = $1.mock.calls;');

  // 関数定義の型アノテーションを削除
  result = result.replace(typePatterns.functionReturn, (match, name, params) => {
    // パラメータごとに型アノテーションを削除
    const cleanedParams = params
      .replace(/(\w+)\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?!]+/g, '$1')
      .replace(/\.\.\.\w+\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?!]+/g, '...$1');
    return `function ${name}(${cleanedParams})`;
  });

  // クラスメソッドの型アノテーションを削除
  result = result.replace(typePatterns.classMethod, (match, name, params) => {
    // パラメータごとに型アノテーションを削除
    const cleanedParams = params
      .replace(/(\w+)\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?!]+/g, '$1')
      .replace(/\.\.\.\w+\s*:\s*[A-Za-z0-9_<>[\].,|&\s{}()?!]+/g, '...$1');
    return `${name}(${cleanedParams}) {`;
  });

  // asキャストを削除
  result = result.replace(typePatterns.asCast, '');

  // 関数呼び出しの型パラメータを削除
  result = result.replace(typePatterns.functionCallTypeParams, '$1(');

  // ジェネリック型のコレクションを修正
  for (const pattern of typePatterns.genericCollections) {
    // ジェネリック部分を削除
    result = result.replace(pattern, (match) => {
      return match.replace(/<[^>]+>/g, '');
    });
  }

  // インラインのキャストを削除
  result = result.replace(typePatterns.inlineCast, (match) => {
    // <型>変数 を 変数 に変換
    return match.replace(/<[^>]+>\s*/, '');
  });

  // implements宣言を削除
  result = result.replace(typePatterns.implements, '');

  // extendsジェネリック型を簡略化
  result = result.replace(typePatterns.extendsGeneric, (match) => {
    // ジェネリック部分を削除して基本クラス名のみ残す
    return match.replace(/<[^>]+>/g, '');
  });

  // jest.fnのモック型パラメータを削除
  result = result.replace(typePatterns.mockFnGeneric, 'jest.fn()');

  // jest.Mocked<> 型を削除
  result = result.replace(typePatterns.jestMocked, '');

  // 非nullアサーション演算子 (!) を削除
  result = result.replace(typePatterns.nonNullAssertion, '$1');

  // Union型のパラメータ修正
  result = result.replace(/'[^']*'\s*\|\s*'[^']*'(\s*\|\s*'[^']*')*/g, (match) => {
    // 最初の値だけを残す
    const firstValue = match.match(/'[^']*'/);
    return firstValue ? firstValue[0] : match;
  });

  // 関数パラメータ後の=演算子の修正
  result = result.replace(typePatterns.parameterWithEquals, ') {return [');

  // 行末のセミコロンが削除されている問題を修正する
  result = result.replace(/}\n/g, '};\n');

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
      const updatedPath =
        mockPath.startsWith('.') && !path.extname(mockPath) ? `${mockPath}.js` : mockPath;

      // モック実装があればそのまま使用、なければ基本的なものを返す
      if (mockImplementation) {
        return `jest.mock('${updatedPath}'${mockImplementation})`;
      } else {
        return `jest.mock('${updatedPath}')`;
      }
    }
  );

  // モック関数内の型キャストを削除
  cleanedMock = cleanedMock.replace(/mockReturnValue\(<[^>]+>([^)]+)\)/g, 'mockReturnValue($1)');

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
        line = line.replace(/from\s+['"]([^'"]+)['"]/g, (match, importPath) => {
          if (
            (importPath.startsWith('.') || importPath.startsWith('/')) &&
            !path.extname(importPath)
          ) {
            return `from '${importPath}.js'`;
          }
          return match;
        });
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
              if (
                (importPath.startsWith('.') || importPath.startsWith('/')) &&
                !path.extname(importPath)
              ) {
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
    if (
      content.includes("import { jest } from '@jest/globals';") &&
      !content.includes('jest.mock(')
    ) {
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

    // 循環参照の問題に対処するためのimportMetaポリフィルを追加
    updatedContent +=
      `// 循環参照対策のポリフィル\n` +
      `if (typeof globalThis.__jest_import_meta_url === 'undefined') {\n` +
      `  globalThis.__jest_import_meta_url = 'file:///';\n` +
      `}\n\n`;

    // インポート行を処理
    const contentWithProcessedImports = processImportStatements(content);
    const contentLines = contentWithProcessedImports.split('\n');

    // インポート行のみを抽出
    const importLines = [];
    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i].trim();
      if (
        line.startsWith('import ') &&
        !line.includes('@jest/globals') &&
        (line.includes(' from ') || !line.includes(';'))
      ) {
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

    // モックオブジェクトのクリーンアップコードを追加
    testCode = addMockCleanupCode(testCode);

    // タイマーとイベントリスナーのクリーンアップコードを追加
    testCode = addCleanupCode(testCode);

    // プロパティ名の修正（テストクラスの実際のプロパティ構造に合わせる）
    testCode = fixPropertyAccess(testCode);

    // テスト変数のスコープ修正
    testCode = fixTestVariableScope(testCode);

    // ESMファイルのファイナライズ（最終的な調整）
    testCode = finalizeESMFile(testCode);

    // 最終的なコンテンツを作成
    updatedContent += testCode;

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
    } else if (extensions.some((ext) => file.endsWith(ext))) {
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

// ESM対応のimport文を追加
function addESMImports(content) {
  // @jest/globalsからのインポートを追加
  if (content.includes('describe(') || content.includes('test(') || content.includes('it(')) {
    // 既存のimport文を検索
    const importRegex = /import\s+{([^}]+)}\s+from\s+['"]@jest\/globals['"];?/;
    const importMatch = content.match(importRegex);

    // 必要なJestの関数
    const requiredImports = [
      'jest',
      'describe',
      'beforeEach',
      'beforeAll',
      'afterEach',
      'afterAll',
      'test',
      'it',
      'expect'
    ];

    if (importMatch) {
      // 既存のimport文がある場合は拡張
      const existingImports = importMatch[1].split(',').map((s) => s.trim());
      const missingImports = requiredImports.filter((imp) => !existingImports.includes(imp));

      if (missingImports.length > 0) {
        const newImports = [...existingImports, ...missingImports].join(', ');
        return content.replace(importRegex, `import { ${newImports} } from '@jest/globals';`);
      }
    } else {
      // import文がない場合は追加
      return `import { ${requiredImports.join(', ')} } from '@jest/globals';\n\n${content}`;
    }
  }

  return content;
}

// タイマーとイベントリスナーのクリーンアップコードを追加
function addCleanupCode(content) {
  // 既にクリーンアップコードが含まれているかチェック
  if (content.includes('afterAll(') && content.includes('clearAllTimers')) {
    return content;
  }

  // beforeAllでタイマーモック化するコードを追加
  const beforeAllCode = `
// テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
});
`;

  // afterAllでクリーンアップするコードを追加
  const afterAllCode = `
// 非同期処理をクリーンアップするためのafterAll
afterAll(() => {
  // すべてのモックをリセット
  jest.clearAllMocks();
  
  // タイマーをリセット
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // グローバルタイマーをクリア
  if (global.setInterval && global.setInterval.mockClear) {
    global.setInterval.mockClear();
  }
  
  if (global.clearInterval && global.clearInterval.mockClear) {
    global.clearInterval.mockClear();
  }
  
  // 確実にすべてのプロミスが解決されるのを待つ
  return new Promise(resolve => {
    setTimeout(() => {
      // 残りの非同期処理を強制終了
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, 100);
  });
});
`;

  // afterEachでインスタンスのクリーンアップコードを追加
  const afterEachCode = `
// テスト後にインターバルを停止
afterEach(() => {
  // すべてのタイマーモックをクリア
  jest.clearAllTimers();
  
  // インスタンスを明示的に破棄
  // (ここにテスト固有のクリーンアップコードが必要な場合があります)
});
`;

  // 既存のbeforeEach, beforeAll, afterEach, afterAll関数を検出
  const hasBeforeAll = content.includes('beforeAll(');
  const hasAfterAll = content.includes('afterAll(');
  const hasAfterEach = content.includes('afterEach(');

  // 挿入場所を検索
  let insertBeforeAllPos = content.indexOf('describe(');
  let insertAfterAllPos = content.lastIndexOf('describe(');
  let insertAfterEachPos = content.indexOf('describe(');

  // モック宣言の後ろに挿入する
  const mockJestPos = content.indexOf('jest.mock(');
  if (mockJestPos > 0) {
    insertBeforeAllPos = content.indexOf('\n', mockJestPos + 10);
  }

  // 既存の挿入場所も探す
  const existingBeforeAllPos = content.indexOf('beforeAll(');
  const existingAfterAllPos = content.indexOf('afterAll(');
  const existingAfterEachPos = content.indexOf('afterEach(');

  let modifiedContent = content;

  // beforeAll の挿入
  if (!hasBeforeAll && insertBeforeAllPos > 0) {
    modifiedContent =
      modifiedContent.slice(0, insertBeforeAllPos) +
      beforeAllCode +
      modifiedContent.slice(insertBeforeAllPos);
  } else if (existingBeforeAllPos > 0) {
    // 既存のbeforeAllがある場合、その中にタイマーモック化のコードを追加
    const beforeAllEndPos = modifiedContent.indexOf('});', existingBeforeAllPos) + 3;
    modifiedContent =
      modifiedContent.slice(0, beforeAllEndPos) + '\n' + modifiedContent.slice(beforeAllEndPos);
  }

  // afterEach の挿入
  if (!hasAfterEach && insertAfterEachPos > 0) {
    modifiedContent =
      modifiedContent.slice(0, insertAfterEachPos) +
      afterEachCode +
      modifiedContent.slice(insertAfterEachPos);
  }

  // afterAll の挿入
  if (!hasAfterAll && insertAfterAllPos > 0) {
    modifiedContent =
      modifiedContent.slice(0, insertAfterAllPos) +
      afterAllCode +
      modifiedContent.slice(insertAfterAllPos);
  }

  return modifiedContent;
}

// プロパティ名の修正（テストクラスの実際のプロパティ構造に合わせる）
function fixPropertyAccess(content) {
  // exchangeMap → exchanges のように変換
  let modifiedContent = content;

  // UnifiedOrderManager のプロパティ変換
  modifiedContent = modifiedContent.replace(
    /unifiedManager\.exchangeMap/g,
    'unifiedManager.exchanges'
  );
  modifiedContent = modifiedContent.replace(
    /unifiedManager\.priorityMap\.get\((['"])([^'"]+)(['"])\)/g,
    'unifiedManager.exchanges.get($1$2$3).priority'
  );
  modifiedContent = modifiedContent.replace(
    /unifiedManager\.omsMap\.get\((['"])([^'"]+)(['"])\)/g,
    'unifiedManager.exchanges.get($1$2$3).oms'
  );

  // クラスの特定のメソッドの呼び出しパターンを修正
  // メソッドがプロパティに変換されるパターンなど

  return modifiedContent;
}

// モックオブジェクトのクリーンアップコードを追加
function addMockCleanupCode(content) {
  // 特定のクラスのモックに停止メソッドを追加するパターン
  const orderManagementSystemStopMock = `
// OrderManagementSystemに停止メソッドを追加
OrderManagementSystem.prototype.stopMonitoring = jest.fn().mockImplementation(function() {
  if (this.fillMonitorTask) {
    if (typeof this.fillMonitorTask.destroy === 'function') {
      this.fillMonitorTask.destroy();
    } else {
      this.fillMonitorTask.stop();
    }
    this.fillMonitorTask = null;
  }
});
`;

  // 既にモックが存在するか確認
  if (content.includes('OrderManagementSystem.prototype.stopMonitoring')) {
    return content;
  }

  // モック宣言の後に挿入
  const mockPos = content.indexOf('jest.mock(');
  if (mockPos > 0) {
    // 最後のjest.mockの後に挿入
    let lastMockEndPos = content.lastIndexOf('jest.mock(');
    lastMockEndPos = content.indexOf(';', lastMockEndPos) + 1;

    return (
      content.slice(0, lastMockEndPos) +
      '\n' +
      orderManagementSystemStopMock +
      content.slice(lastMockEndPos)
    );
  }

  return content;
}

// テスト変数のスコープ修正
function fixTestVariableScope(content) {
  // テスト変数をスコープの外に移動させる
  const result = content.replace(
    /(describe\(.*?\{)\s*let\s+([a-zA-Z0-9_,\s]+);/s,
    '// テストで使用するインスタンス変数をスコープ外に定義\nlet $2;\n\n$1'
  );

  return result;
}

// ESMファイルのファイナライズ（最終的な調整）
function finalizeESMFile(content) {
  // ポリフィルチェックを追加
  if (!content.includes('__jest_import_meta_url')) {
    const polyfill = `
// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === 'undefined') {
  globalThis.__jest_import_meta_url = 'file:///';
}
`;

    // importステートメントの後に挿入
    const importEndPos = content.lastIndexOf('import');
    if (importEndPos > 0) {
      const nextLinePos = content.indexOf('\n', importEndPos);
      if (nextLinePos > 0) {
        content = content.slice(0, nextLinePos + 1) + polyfill + content.slice(nextLinePos + 1);
      }
    }
  }

  // 重複アロー関数表現の修正
  content = content.replace(/\(\(([^)]+)\)\)\s*=>/g, '(($1) =>');

  // 誤った型アサーションの修正
  content = content.replace(/as\s+[A-Za-z0-9_<>[\].,|&\s{}()?!]+/g, '');

  return content;
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
