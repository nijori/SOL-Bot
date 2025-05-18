/**
 * .mjsファイルをsrcからdistにコピーするスクリプト
 * TypeScriptコンパイルされた.jsファイルから.mjsファイルも生成
 * 
 * TST-051: テスト環境のビルド出力問題解決の一部
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// srcディレクトリからdistディレクトリへの相対パスを計算
const sourceDir = path.resolve(__dirname, '../src');
const targetDir = path.resolve(__dirname, '../dist');

console.log('> コピー処理開始: .mjsファイルをsrcからdistへ');

// .mjsファイルを検索
const mjsFiles = glob.globSync('**/*.mjs', { cwd: sourceDir });

// ファイルをコピー
let copiedCount = 0;
for (const file of mjsFiles) {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);
  
  // ターゲットディレクトリが存在することを確認
  const targetDirPath = path.dirname(targetPath);
  if (!fs.existsSync(targetDirPath)) {
    fs.mkdirSync(targetDirPath, { recursive: true });
  }
  
  // ファイルコピー
  fs.copyFileSync(sourcePath, targetPath);
  copiedCount++;
  
  console.log(`  コピー: ${file}`);
}

console.log(`> 完了: ${copiedCount}個の.mjsファイルをコピーしました`);

// 各モジュールのindex.jsファイルをindex.mjsとしても複製
// package.jsonのexportsフィールドに対応するため
const moduleDirs = [
  '',
  'core',
  'strategies',
  'services',
  'utils',
  'data',
  'indicators',
  'config',
  'optimizer'
];

console.log('> 処理開始: ESMモジュール用の.mjsファイル生成');

// .jsを.mjsに変換する関数
function convertJsToMjs(jsFilePath) {
  // .mjsのパスを生成
  const mjsFilePath = jsFilePath.replace(/\.js$/, '.mjs');
  
  // すでに存在するなら上書きしない
  if (fs.existsSync(mjsFilePath)) {
    return false;
  }
  
  // ファイル内容を読み込み
  let content = fs.readFileSync(jsFilePath, 'utf8');
  
  // CommonJS形式のrequireをimportに変換
  content = content.replace(/require\((['"])(.+?)\1\)/g, (match, quote, module) => {
    // 相対パスの場合は.jsを.mjsに変換
    if (module.startsWith('./') || module.startsWith('../')) {
      // 既に拡張子がある場合は適切に処理
      if (module.endsWith('.js')) {
        return `import(${quote}${module.replace(/\.js$/, '.mjs')}${quote})`;
      } else {
        return `import(${quote}${module}${quote})`;
      }
    }
    // 外部モジュールはそのまま
    return `import(${quote}${module}${quote})`;
  });
  
  // module.exportsをexport defaultに変換
  content = content.replace(/module\.exports\s*=\s*/, 'export default ');
  
  // 新しいファイルに保存
  fs.writeFileSync(mjsFilePath, content);
  return true;
}

// 各モジュールディレクトリを処理
let indexCreatedCount = 0;
for (const dir of moduleDirs) {
  const indexJsPath = path.join(targetDir, dir, 'index.js');
  
  // index.jsが存在する場合、index.mjsとしてコピー
  if (fs.existsSync(indexJsPath)) {
    if (convertJsToMjs(indexJsPath)) {
      indexCreatedCount++;
      console.log(`  作成: ${dir}/index.mjs`);
    }
  } else if (dir !== '') {
    console.warn(`  警告: ${dir}/index.jsが見つかりません`);
  }
}

console.log(`> 完了: ${indexCreatedCount}個のindex.mjsファイルを作成しました`);

// TypeScriptコンパイルされた他の.jsファイルを.mjsにも変換
console.log('> 処理開始: その他のコアファイルを.mjs形式に変換');

// エントリポイント以外の主要なソースファイルを.mjs形式に変換
const mainModuleFiles = [
  // コアモジュール
  'core/tradingEngine.js',
  'core/backtestRunner.js',
  'core/orderManagementSystem.js',
  'core/types.js',
  // 戦略モジュール
  'strategies/trendFollowStrategy.js',
  'strategies/meanReversionStrategy.js',
  'strategies/donchianBreakoutStrategy.js',
  // ユーティリティモジュール
  'utils/logger.js',
  'utils/atrUtils.js',
  'utils/positionSizing.js',
  'utils/metrics.js',
  'utils/cliParser.js',
  'utils/orderUtils.js',
  'utils/orderTypeUtils.js',
  'utils/mathUtils.js',
  'utils/memoryMonitor.js',
  'utils/atrCalibrator.js',
];

let moduleFilesCreatedCount = 0;

for (const file of mainModuleFiles) {
  const jsFilePath = path.join(targetDir, file);
  
  if (fs.existsSync(jsFilePath)) {
    if (convertJsToMjs(jsFilePath)) {
      moduleFilesCreatedCount++;
      console.log(`  作成: ${file.replace(/\.js$/, '.mjs')}`);
    }
  } else {
    console.warn(`  警告: ${file}が見つかりません`);
  }
}

console.log(`> 完了: ${moduleFilesCreatedCount}個のモジュールファイルを.mjs形式に変換しました`);
console.log('すべての処理が完了しました。'); 