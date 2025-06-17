/**
 * メモリ使用量を最適化したバックテスト実行スクリプト
 * Node.jsの最大メモリ使用量を設定し、より効率的に大量のデータを処理するためのスクリプト
 */

// 環境変数DRY_RUNが設定されている場合は実際にコマンドを実行せず、コマンドのみを表示
const isDryRun = process.env.DRY_RUN === 'true';

// 引数の解析
const args = process.argv.slice(2);

// デフォルト設定
const DEFAULT_MEMORY_LIMIT = 4096; // MB単位
const DEFAULT_BATCH_SIZE = 5000;
const DEFAULT_GC_INTERVAL = 10000;

// quietモードの解析
const isQuiet = args.includes('--quiet');
// quietモードの場合は引数からquiet引数を削除せず、子プロセスにも伝播させる

// メモリ制限の解析
let memoryLimit = DEFAULT_MEMORY_LIMIT;
const memoryArgIndex = args.findIndex((arg) => arg === '--memory' || arg === '-m');
if (memoryArgIndex !== -1 && args.length > memoryArgIndex + 1) {
  const memoryValue = parseInt(args[memoryArgIndex + 1], 10);
  if (!isNaN(memoryValue) && memoryValue > 0) {
    memoryLimit = memoryValue;
    // 引数を削除
    args.splice(memoryArgIndex, 2);
  }
}

// バッチサイズの解析
let batchSize = DEFAULT_BATCH_SIZE;
const batchArgIndex = args.findIndex((arg) => arg === '--batch-size' || arg === '-b');
if (batchArgIndex !== -1 && args.length > batchArgIndex + 1) {
  const batchValue = parseInt(args[batchArgIndex + 1], 10);
  if (!isNaN(batchValue) && batchValue > 0) {
    batchSize = batchValue;
    // 引数を削除
    args.splice(batchArgIndex, 2);
  }
}

// GC間隔の解析
let gcInterval = DEFAULT_GC_INTERVAL;
const gcArgIndex = args.findIndex((arg) => arg === '--gc-interval' || arg === '-g');
if (gcArgIndex !== -1 && args.length > gcArgIndex + 1) {
  const gcValue = parseInt(args[gcArgIndex + 1], 10);
  if (!isNaN(gcValue) && gcValue > 0) {
    gcInterval = gcValue;
    // 引数を削除
    args.splice(gcArgIndex, 2);
  }
}

// メモリモニタリングフラグの解析
let memoryMonitoring = true;
const monitorArgIndex = args.findIndex((arg) => arg === '--no-memory-monitor' || arg === '--nm');
if (monitorArgIndex !== -1) {
  memoryMonitoring = false;
  // 引数を削除
  args.splice(monitorArgIndex, 1);
}

// バックテストコマンドの引数に最適化オプションを追加
if (!args.includes('--batch-size')) {
  args.push('--batch-size', batchSize.toString());
}

if (!args.includes('--gc-interval')) {
  args.push('--gc-interval', gcInterval.toString());
}

// メモリモニタリング設定
if (!memoryMonitoring && !args.includes('--no-memory-monitor')) {
  args.push('--no-memory-monitor');
}

// Node.jsのコマンドを構築
const { spawn } = require('child_process');
const path = require('path');

// スクリプトの実行パス
const scriptPath = path.resolve(__dirname, '../dist/index.js');

// 最終的なコマンド引数の配列
const nodeArgs = [
  `--max-old-space-size=${memoryLimit}`,
  '--expose-gc', // ガベージコレクションへのアクセスを有効化
  scriptPath,
  'backtest',
  ...args
];

// quietモードでない場合のみログを出力
if (!isQuiet) {
  console.log(`\n実行コマンド:`);
  console.log(`node ${nodeArgs.join(' ')}`);
  console.log(`\n設定情報:`);
  console.log(`- メモリ制限: ${memoryLimit}MB`);
  console.log(`- バッチサイズ: ${batchSize}キャンドル`);
  console.log(`- GC間隔: ${gcInterval}キャンドルごと`);
  console.log(`- メモリモニタリング: ${memoryMonitoring ? '有効' : '無効'}`);
  console.log(
    `\n${isDryRun ? '[DRY RUN] 実行はスキップします' : '最適化バックテストを開始します...'}\n`
  );
}

// DRY_RUNモードでなければ実際にコマンドを実行
if (!isDryRun) {
  const child = spawn('node', nodeArgs, { stdio: 'inherit' });

  child.on('error', (error) => {
    console.error(`エラーが発生しました: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (!isQuiet) {
      console.log(`\nプロセスが終了しました（終了コード: ${code}）`);
    }
    process.exit(code);
  });
}
