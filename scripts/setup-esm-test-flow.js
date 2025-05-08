/**
 * テスト実行フローのESM対応設定スクリプト
 * REF-023: テスト実行フローのESM対応
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 設定ファイルのパス
const packageJsonPath = path.join(rootDir, 'package.json');
const jestConfigPath = path.join(rootDir, 'jest.config.js');

/**
 * package.jsonのテストスクリプトを最適化
 */
function updatePackageJson() {
  console.log('🔍 package.jsonのテストスクリプトを更新中...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // テスト関連のスクリプトを更新
    packageJson.scripts.test = 'node --experimental-vm-modules node_modules/jest/bin/jest.js';
    packageJson.scripts['test:coverage'] = 'node --experimental-vm-modules node_modules/jest/bin/jest.js --coverage';
    packageJson.scripts['test:watch'] = 'node --experimental-vm-modules node_modules/jest/bin/jest.js --watch';
    packageJson.scripts['test:detect-handles'] = 'node --experimental-vm-modules node_modules/jest/bin/jest.js --detectOpenHandles';
    packageJson.scripts['test:debug'] = 'node --experimental-vm-modules --inspect-brk node_modules/jest/bin/jest.js --runInBand';
    packageJson.scripts['test:verbose'] = 'node --experimental-vm-modules node_modules/jest/bin/jest.js --verbose';
    packageJson.scripts['test:one'] = 'node --experimental-vm-modules node_modules/jest/bin/jest.js --testNamePattern';
    packageJson.scripts['test:esm'] = 'node --experimental-vm-modules node_modules/jest/bin/jest.js ".*\\.test\\.mjs$"';
    packageJson.scripts['test:cleanup'] = 'node scripts/cleanup-test-resources.js';
    
    // 最適化したJSONを書き戻す
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ package.jsonの更新が完了しました');
  } catch (err) {
    console.error('❌ package.jsonの更新に失敗しました:', err);
    process.exit(1);
  }
}

/**
 * jest.config.jsファイルの最適化
 */
function validateJestConfig() {
  console.log('🔍 jest.config.jsの検証中...');
  
  try {
    // jest.config.jsの内容を読み込み
    const jestConfigContent = fs.readFileSync(jestConfigPath, 'utf8');
    
    // 必要な設定が含まれているか確認
    const requiredSettings = [
      'preset: \'ts-jest/presets/js-with-ts-esm\'',
      'extensionsToTreatAsEsm: [\'.ts\']',
      'testMatch: [\'**/__tests__/**/*.test.ts\', \'**/__tests__/**/*.test.mjs\']',
      'moduleFileExtensions: [\'ts\', \'mjs\', \'js\', \'json\']',
      'useESM: true'
    ];
    
    const missingSettings = [];
    for (const setting of requiredSettings) {
      if (!jestConfigContent.includes(setting)) {
        missingSettings.push(setting);
      }
    }
    
    if (missingSettings.length > 0) {
      console.warn('⚠️ jest.config.jsに以下の設定が不足しています:');
      missingSettings.forEach(setting => console.warn(`  - ${setting}`));
      console.warn('設定ファイルを手動で確認してください');
    } else {
      console.log('✅ jest.config.jsの内容は正常です');
    }
  } catch (err) {
    console.error('❌ jest.config.jsの検証に失敗しました:', err);
  }
}

/**
 * テスト実行前にクリーンアップするスクリプトを作成
 */
function createCleanupScript() {
  console.log('🔍 テストクリーンアップスクリプトを作成中...');
  
  const cleanupScriptPath = path.join(rootDir, 'scripts', 'cleanup-test-resources.js');
  const cleanupScript = `/**
 * テスト実行後のクリーンアップスクリプト
 * REF-023: テスト実行フローのESM対応
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// テスト用の一時ディレクトリをクリーンアップ
const testDirs = [
  path.join(rootDir, 'data', 'test-e2e'),
  path.join(rootDir, 'data', 'test')
];

console.log('🧹 テスト用一時ディレクトリをクリーンアップしています...');

for (const dir of testDirs) {
  if (fs.existsSync(dir)) {
    try {
      // ディレクトリ内のすべてのファイルを削除
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          // サブディレクトリを再帰的に処理（必要に応じて実装）
          // 現在はトップレベルのファイルのみ削除
        } else {
          fs.unlinkSync(filePath);
          console.log(\`  削除: \${filePath}\`);
        }
      }
      console.log(\`✅ \${dir} をクリーンアップしました\`);
    } catch (err) {
      console.error(\`❌ \${dir} のクリーンアップ中にエラーが発生しました:\`, err);
    }
  }
}

// テスト時に作成される可能性のある一時ファイルのパターン
const tempFilesPattern = [
  path.join(rootDir, 'temp-*'),
  path.join(rootDir, '*.lock'),
  path.join(rootDir, 'test-*.json')
];

// 将来的に特定の一時ファイルを削除する必要がある場合はここに実装

console.log('✅ クリーンアップが完了しました');
`;

  try {
    fs.writeFileSync(cleanupScriptPath, cleanupScript);
    console.log(`✅ クリーンアップスクリプトを作成しました: ${cleanupScriptPath}`);
  } catch (err) {
    console.error('❌ クリーンアップスクリプトの作成に失敗しました:', err);
  }
}

/**
 * テストランナースクリプトを作成
 */
function createTestRunnerScript() {
  console.log('🔍 テストランナースクリプトを作成中...');
  
  const testRunnerPath = path.join(rootDir, 'scripts', 'run-esm-tests.js');
  const testRunnerScript = `/**
 * ESM対応テスト実行スクリプト
 * REF-023: テスト実行フローのESM対応
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// コマンドライン引数の解析
const args = process.argv.slice(2);
const detectOpenHandles = args.includes('--detect-handles');
const debug = args.includes('--debug');
const coverage = args.includes('--coverage');
const testPattern = args.find(arg => arg.startsWith('--pattern='))?.split('=')[1];

// 実行するJestコマンドの構築
let jestArgs = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js'];

// 引数に基づいてオプションを追加
if (detectOpenHandles) {
  jestArgs.push('--detectOpenHandles');
}

if (debug) {
  // Nodeのインスペクタを有効化
  process.argv = ['--inspect-brk', ...process.argv.slice(1)];
  jestArgs.push('--runInBand');
}

if (coverage) {
  jestArgs.push('--coverage');
}

if (testPattern) {
  jestArgs.push('--testNamePattern', testPattern);
}

// .mjsテストファイルに限定
jestArgs.push('.*\\\\.test\\\\.mjs$');

console.log(\`📋 実行コマンド: node \${jestArgs.join(' ')}\`);

// テストプロセスの実行
const testProcess = spawn('node', jestArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

// プロセスの終了を処理
testProcess.on('close', (code) => {
  console.log(\`🏁 テスト実行が終了しました。終了コード: \${code}\`);
  process.exit(code);
});

// エラーハンドリング
testProcess.on('error', (err) => {
  console.error('❌ テスト実行中にエラーが発生しました:', err);
  process.exit(1);
});

// Ctrl+C などの割り込み信号を適切に処理
process.on('SIGINT', () => {
  console.log('⛔ テスト実行を中断します...');
  testProcess.kill('SIGINT');
});
`;

  try {
    fs.writeFileSync(testRunnerPath, testRunnerScript);
    console.log(`✅ テストランナースクリプトを作成しました: ${testRunnerPath}`);
  } catch (err) {
    console.error('❌ テストランナースクリプトの作成に失敗しました:', err);
  }
}

/**
 * package.jsonの"scripts"セクションにテストランナーコマンドを追加
 */
function addTestRunnerToPackageJson() {
  console.log('🔍 package.jsonにテストランナーを追加中...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // テストランナースクリプトを追加
    packageJson.scripts['test:runner'] = 'node scripts/run-esm-tests.js';
    packageJson.scripts['test:runner:detect'] = 'node scripts/run-esm-tests.js --detect-handles';
    packageJson.scripts['test:runner:debug'] = 'node scripts/run-esm-tests.js --debug';
    packageJson.scripts['test:runner:coverage'] = 'node scripts/run-esm-tests.js --coverage';
    
    // 最適化したJSONを書き戻す
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ package.jsonへのテストランナー追加が完了しました');
  } catch (err) {
    console.error('❌ package.jsonへのテストランナー追加に失敗しました:', err);
  }
}

/**
 * テストファイル変換状況の確認
 */
function checkConversionStatus() {
  console.log('🔍 テストファイル変換状況を確認中...');
  
  const testDir = path.join(rootDir, 'src', '__tests__');
  const tsTestFiles = findFiles(testDir, '.test.ts');
  const mjsTestFiles = findFiles(testDir, '.test.mjs');
  
  console.log(`📊 変換状況:`);
  console.log(`  - .test.ts ファイル数: ${tsTestFiles.length}`);
  console.log(`  - .test.mjs ファイル数: ${mjsTestFiles.length}`);
  
  if (tsTestFiles.length > 0 && mjsTestFiles.length === 0) {
    console.warn('⚠️ .test.mjsファイルが見つかりません。変換スクリプトを実行してください:');
    console.warn('  npm run convert:tests');
  } else if (mjsTestFiles.length > 0) {
    console.log('✅ .test.mjsファイルが見つかりました。以下のコマンドでテスト実行できます:');
    console.log('  npm run test:esm');
    console.log('  npm run test:runner');
  }
}

/**
 * 指定したディレクトリから特定の拡張子を持つファイルを再帰的に検索
 */
function findFiles(dir, extension) {
  const files = [];
  
  function searchFiles(directory) {
    const entries = fs.readdirSync(directory);
    
    for (const entry of entries) {
      const entryPath = path.join(directory, entry);
      const stat = fs.statSync(entryPath);
      
      if (stat.isDirectory()) {
        searchFiles(entryPath);
      } else if (entry.endsWith(extension)) {
        files.push(entryPath);
      }
    }
  }
  
  searchFiles(dir);
  return files;
}

/**
 * プロジェクトのNode.jsバージョンを確認
 */
function checkNodeVersion() {
  console.log('🔍 Node.jsバージョンを確認中...');
  
  try {
    // Node.jsのバージョンを取得
    const nodeVersion = process.version;
    console.log(`📌 現在のNode.jsバージョン: ${nodeVersion}`);
    
    // Node.js v18以上を推奨
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    if (majorVersion < 18) {
      console.warn('⚠️ ESMサポートには Node.js v18以上が推奨されます');
      console.warn('  現在のバージョン: ' + nodeVersion);
    } else {
      console.log('✅ Node.jsバージョンは適合しています');
    }
  } catch (err) {
    console.error('❌ Node.jsバージョンの確認に失敗しました:', err);
  }
}

/**
 * CI/CD環境のESMテスト実行設定を確認
 */
function checkCIConfiguration() {
  console.log('🔍 CI/CD設定を確認中...');
  
  const githubWorkflowsDir = path.join(rootDir, '.github', 'workflows');
  
  try {
    if (!fs.existsSync(githubWorkflowsDir)) {
      console.warn('⚠️ GitHub Actionsワークフロー設定ディレクトリが見つかりません');
      return;
    }
    
    const workflowFiles = fs.readdirSync(githubWorkflowsDir)
      .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
    
    let foundTestConfig = false;
    let foundESMTestCommand = false;
    
    for (const file of workflowFiles) {
      const content = fs.readFileSync(path.join(githubWorkflowsDir, file), 'utf8');
      
      if (content.includes('npm test') || content.includes('npm run test')) {
        foundTestConfig = true;
        
        if (content.includes('--experimental-vm-modules') || 
            content.includes('npm run test:esm') ||
            content.includes('npm run test:runner')) {
          foundESMTestCommand = true;
        }
      }
    }
    
    if (foundTestConfig && !foundESMTestCommand) {
      console.warn('⚠️ CI/CD設定でESMテスト実行コマンドが見つかりません');
      console.warn('  GitHub Actionsワークフローに適切なESMテストコマンドを追加してください');
    } else if (foundESMTestCommand) {
      console.log('✅ CI/CD設定にESMテストコマンドが含まれています');
    } else {
      console.warn('⚠️ CI/CD設定にテスト実行が含まれていないか見つかりません');
    }
  } catch (err) {
    console.error('❌ CI/CD設定の確認に失敗しました:', err);
  }
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('🚀 REF-023: テスト実行フローのESM対応を開始します');
  
  // Node.jsバージョンの確認
  checkNodeVersion();
  
  // CI/CD設定の確認
  checkCIConfiguration();
  
  // テストファイル変換状況の確認
  checkConversionStatus();
  
  // package.jsonの更新
  updatePackageJson();
  
  // jest.config.jsの検証
  validateJestConfig();
  
  // テスト実行前後のクリーンアップスクリプトを作成
  createCleanupScript();
  
  // テストランナースクリプトを作成
  createTestRunnerScript();
  
  // package.jsonにテストランナーコマンドを追加
  addTestRunnerToPackageJson();
  
  // 完了メッセージ
  console.log('\n✅ REF-023: テスト実行フローのESM対応設定が完了しました');
  console.log('\n📋 利用可能なテストコマンド:');
  console.log('  - npm run test:esm         - ESMテストファイルのみ実行');
  console.log('  - npm run test:runner      - カスタムランナーでESMテスト実行');
  console.log('  - npm run test:runner:detect - 開いたハンドル検出付きで実行');
  console.log('  - npm run test:runner:debug  - デバッグモードで実行');
  console.log('  - npm run test:runner:coverage - カバレッジ計測付きで実行');
  console.log('  - npm run test:cleanup     - テスト用リソースのクリーンアップ');
  console.log('\n🔍 "Jest did not exit"問題の解決策:');
  console.log('  1. 非同期処理のクリーンアップを忘れずに実装してください');
  console.log('  2. afterAll()フックでタイマーやイベントリスナーを解放してください');
  console.log('  3. --detectOpenHandlesフラグを使用して問題を特定できます');
}

// スクリプトの実行
main().catch(err => {
  console.error('❌ スクリプト実行中にエラーが発生しました:', err);
  process.exit(1);
}); 