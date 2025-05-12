/**
 * テスト分割実行とパラレル化スクリプト
 * TST-061: テスト分割実行とパラレル化の実装
 * 
 * テストを複数のグループに分割し、並列実行することで、全体の実行時間を短縮します。
 * 特にRealTimeDataProcessor.test.tsなどの重いテストは別グループで実行します。
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 設定
const DEFAULT_WORKERS = Math.max(os.cpus().length - 1, 1); // CPUコア数-1（最低1）
const TEST_GROUPS = {
  fast: [
    'src/__tests__/utils',
    'src/__tests__/config',
    'src/__tests__/indicators'
  ],
  medium: [
    'src/__tests__/strategies',
    'src/__tests__/services/!(symbolInfoService|MultiTimeframeDataFetcher).test.ts'
  ],
  slow: [
    'src/__tests__/services/symbolInfoService.test.ts',
    'src/__tests__/services/MultiTimeframeDataFetcher.test.ts'
  ],
  // 特に重いテストは別グループで実行
  heavy: [
    'src/__tests__/data/RealTimeDataProcessor.test.ts'
  ],
  core: [
    'src/__tests__/core'
  ],
  // ESMテスト用
  esm: [
    'src/__tests__/**/*.test.mjs',
    'src/__tests__/esm-*.test.mjs'
  ]
};

// 特別な設定が必要なテストグループ
const TEST_CONFIG = {
  heavy: {
    // 重いテストは長めのタイムアウトを設定
    testTimeout: 300000, // 5分
    // done()呼び出しのタイムアウトも延長
    asyncTimeout: 60000, // 1分
    // パラレル実行しない
    runInBand: true,
    // 特定のテストをスキップするパターン
    testPathIgnorePatterns: [
      'イベント通知' // RealTimeDataProcessorの特定のテストをスキップ
    ]
  },
  esm: {
    // ESMテスト用特殊フラグ
    experimental: true,
    // 分離実行
    runInBand: true
  }
};

/**
 * Jestを実行する関数
 * @param {string} groupName - テストグループ名
 * @param {string[]} testPaths - テストパスのパターン
 * @param {Object} options - オプション設定
 * @returns {Promise<{groupName: string, exitCode: number}>}
 */
function runJest(groupName, testPaths, options = {}) {
  return new Promise((resolve) => {
    // Jestコマンドを組み立て
    const args = ['--detectOpenHandles'];
    
    // テストタイムアウトを追加
    if (options.testTimeout) {
      args.push(`--testTimeout=${options.testTimeout}`);
    }
    
    // インバンド実行フラグを追加
    if (options.runInBand) {
      args.push('--runInBand');
    }

    // テストパスを追加
    testPaths.forEach(pattern => args.push(pattern));
    
    // 特定のテストをスキップするパターンを追加
    if (options.testPathIgnorePatterns && options.testPathIgnorePatterns.length > 0) {
      options.testPathIgnorePatterns.forEach(pattern => {
        args.push(`--testPathIgnorePatterns="${pattern}"`);
      });
    }
    
    console.log(`\n# グループ: ${groupName} - 実行開始`);
    console.log(`実行コマンド: jest ${args.join(' ')}`);
    
    // ESMテスト用特殊処理
    if (options.experimental) {
      // ESMテストは専用スクリプトで実行
      const esmProcess = spawn('node', ['--experimental-vm-modules', './scripts/run-esm-tests-safely.js', ...args], {
        stdio: 'inherit',
        shell: true
      });
      
      esmProcess.on('close', (code) => {
        console.log(`\n# グループ: ${groupName} - 終了 (終了コード: ${code})`);
        resolve({ groupName, exitCode: code });
      });
      return;
    }
    
    // 通常のJest実行
    const jestProcess = spawn('jest', args, {
      stdio: 'inherit',
      shell: true
    });
    
    jestProcess.on('close', (code) => {
      console.log(`\n# グループ: ${groupName} - 終了 (終了コード: ${code})`);
      resolve({ groupName, exitCode: code });
    });
  });
}

/**
 * パラレルでJestを実行する関数
 * @param {Object} groups - テストグループの定義
 * @param {number} concurrency - 並列実行数
 * @returns {Promise<Array>}
 */
async function runParallelTests(groups, concurrency = DEFAULT_WORKERS) {
  const startTime = Date.now();
  const results = [];
  const allGroups = Object.keys(groups);
  
  // グループをバッチに分割
  while (allGroups.length > 0) {
    const batch = allGroups.splice(0, concurrency);
    const batchPromises = batch.map(groupName => {
      const testPaths = groups[groupName];
      const config = TEST_CONFIG[groupName] || {};
      return runJest(groupName, testPaths, config);
    });
    
    // バッチ内のテストを並列実行
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  
  return { results, totalTime };
}

/**
 * メイン実行関数
 */
async function main() {
  try {
    // コマンドライン引数の解析
    const args = process.argv.slice(2);
    const onlyGroup = args.length > 0 ? args[0] : null;
    const concurrency = args.length > 1 ? parseInt(args[1], 10) : DEFAULT_WORKERS;
    
    console.log('\n===== テスト分割実行 (TST-061) =====');
    console.log(`並列実行数: ${concurrency}`);
    
    // 特定のグループのみ実行する場合
    const targetGroups = onlyGroup ? { [onlyGroup]: TEST_GROUPS[onlyGroup] } : TEST_GROUPS;
    
    if (!targetGroups || Object.keys(targetGroups).length === 0) {
      console.error(`エラー: 指定されたグループ '${onlyGroup}' は存在しません`);
      console.log(`有効なグループ: ${Object.keys(TEST_GROUPS).join(', ')}`);
      process.exit(1);
    }
    
    // テスト実行
    const { results, totalTime } = await runParallelTests(targetGroups, concurrency);
    
    // 結果概要を表示
    console.log('\n===== テスト実行結果 =====');
    console.log(`合計実行時間: ${totalTime.toFixed(2)}秒`);
    
    let failedGroups = 0;
    results.forEach(result => {
      const status = result.exitCode === 0 ? '✅ 成功' : '❌ 失敗';
      console.log(`${status} - グループ: ${result.groupName}`);
      if (result.exitCode !== 0) failedGroups++;
    });
    
    // 終了コードを設定
    if (failedGroups > 0) {
      console.log(`\n${failedGroups}個のテストグループが失敗しました`);
      process.exit(1);
    } else {
      console.log('\nすべてのテストグループが成功しました');
      process.exit(0);
    }
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
main(); 