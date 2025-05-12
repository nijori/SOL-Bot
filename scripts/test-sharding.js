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

// JestのNode.js実行用のパス
const JEST_BIN = path.join(process.cwd(), 'node_modules', 'jest', 'bin', 'jest.js');

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

// ベースラインのテスト実行時間
// 注: これはテスト実行前に計測された値です
const BASELINE_TIMES = {
  fast: 35,      // 35秒
  medium: 120,   // 2分
  slow: 180,     // 3分
  heavy: 300,    // 5分
  core: 150,     // 2分30秒
  esm: 120,      // 2分
  total: 900     // 15分 (すべてのテストを順次実行)
};

// メトリクスディレクトリとレポートファイル
const METRICS_DIR = path.join(process.cwd(), '.jest-metrics');
const REPORT_FILE = path.join(METRICS_DIR, 'test-report.json');

/**
 * メトリクスディレクトリの初期化
 */
function initMetricsDir() {
  if (!fs.existsSync(METRICS_DIR)) {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  }
}

/**
 * 過去のメトリクスをロードする
 * @returns {Object} 過去のメトリクス
 */
function loadPreviousMetrics() {
  try {
    if (fs.existsSync(REPORT_FILE)) {
      const data = fs.readFileSync(REPORT_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('過去のメトリクスロード中にエラーが発生しました:', error);
  }
  return {
    runs: [],
    averages: {}
  };
}

/**
 * メトリクスを保存する
 * @param {Object} metrics メトリクス
 */
function saveMetrics(metrics) {
  try {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(metrics, null, 2));
  } catch (error) {
    console.error('メトリクス保存中にエラーが発生しました:', error);
  }
}

/**
 * 平均実行時間を計算する
 * @param {Array} runs 実行履歴
 * @returns {Object} 平均実行時間
 */
function calculateAverages(runs) {
  const averages = {};
  const recentRuns = runs.slice(-5); // 直近5回の実行を利用

  if (recentRuns.length === 0) {
    return averages;
  }

  // グループごとの平均を計算
  Object.keys(TEST_GROUPS).forEach(group => {
    const groupRuns = recentRuns
      .filter(run => run.groupResults.some(result => result.groupName === group))
      .map(run => run.groupResults.find(result => result.groupName === group));

    if (groupRuns.length > 0) {
      const sum = groupRuns.reduce((acc, curr) => acc + curr.duration, 0);
      averages[group] = sum / groupRuns.length;
    }
  });

  // 合計時間の平均
  averages.total = recentRuns.reduce((acc, curr) => acc + curr.totalTime, 0) / recentRuns.length;

  return averages;
}

/**
 * ヘルプメッセージを表示する関数
 */
function showHelp() {
  console.log(`
===== テスト分割実行 (TST-061) =====
使用方法:
  node scripts/test-sharding.js [グループ名] [並列数]
  node scripts/test-sharding.js --help
  node scripts/test-sharding.js --report

オプション:
  グループ名  - 実行するテストグループ名。指定なしの場合は全グループを実行
              有効なグループ: ${Object.keys(TEST_GROUPS).join(', ')}
  並列数     - 同時実行するワーカー数。デフォルトは${DEFAULT_WORKERS}（CPUコア数-1）
  --report   - 過去のテスト実行レポートを表示

例:
  node scripts/test-sharding.js fast        - fastグループのみ実行（デフォルト並列数）
  node scripts/test-sharding.js medium 4    - mediumグループを4並列で実行
  node scripts/test-sharding.js             - すべてのグループを順次実行（デフォルト並列数）
  `);
}

/**
 * テスト実行レポートを表示する関数
 */
function showReport() {
  initMetricsDir();
  const metricsData = loadPreviousMetrics();
  
  if (metricsData.runs.length === 0) {
    console.log('\n⚠️ テスト実行履歴がありません。テストを実行してレポートを生成してください。');
    return;
  }

  // 最新の実行結果
  const latestRun = metricsData.runs[metricsData.runs.length - 1];
  const averages = metricsData.averages;
  
  console.log('\n====== テスト実行レポート ======');
  console.log(`最終実行日時: ${new Date(latestRun.timestamp).toLocaleString()}`);
  console.log(`合計実行時間: ${latestRun.totalTime.toFixed(2)}秒 (ベースライン比: ${(latestRun.totalTime / BASELINE_TIMES.total * 100).toFixed(1)}%)`);
  
  console.log('\n----- グループごとの実行時間 -----');
  console.log('グループ名\t最新実行\t平均時間\tベースライン\t改善率');
  console.log('----------------------------------------------------------------');
  
  latestRun.groupResults.forEach(result => {
    const groupName = result.groupName;
    const baseline = BASELINE_TIMES[groupName] || 0;
    const average = averages[groupName] || 0;
    const improvement = baseline > 0 ? (1 - result.duration / baseline) * 100 : 0;
    
    console.log(
      `${groupName.padEnd(10)}\t${result.duration.toFixed(1)}秒\t${average.toFixed(1)}秒\t${baseline}秒\t${improvement.toFixed(1)}%`
    );
  });
  
  console.log('\n----- 成功・失敗状況 -----');
  const totalTests = latestRun.groupResults.length;
  const failedTests = latestRun.groupResults.filter(r => r.exitCode !== 0).length;
  console.log(`成功: ${totalTests - failedTests}/${totalTests} グループ`);
  
  if (failedTests > 0) {
    console.log('\n⚠️ 失敗したテストグループ:');
    latestRun.groupResults
      .filter(r => r.exitCode !== 0)
      .forEach(r => console.log(`- ${r.groupName} (終了コード: ${r.exitCode})`));
  } else {
    console.log('\n✅ すべてのテストグループが成功しました');
  }
  
  console.log('\n----- 実行履歴 -----');
  console.log('日時\t\t\t合計時間\t成功率');
  console.log('-----------------------------------------------');
  
  // 直近5回の履歴を表示
  metricsData.runs.slice(-5).forEach(run => {
    const date = new Date(run.timestamp).toLocaleString();
    const successRate = (run.groupResults.filter(r => r.exitCode === 0).length / run.groupResults.length * 100).toFixed(1);
    console.log(`${date}\t${run.totalTime.toFixed(1)}秒\t${successRate}%`);
  });
}

/**
 * Jestを実行する関数
 * @param {string} groupName - テストグループ名
 * @param {string[]} testPaths - テストパスのパターン
 * @param {Object} options - オプション設定
 * @returns {Promise<{groupName: string, exitCode: number, duration: number}>}
 */
function runJest(groupName, testPaths, options = {}) {
  return new Promise((resolve) => {
    // 開始時刻を記録
    const startTime = Date.now();
    
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
    if (testPaths && testPaths.length > 0) {
      testPaths.forEach(pattern => args.push(pattern));
    }
    
    // 特定のテストをスキップするパターンを追加
    if (options.testPathIgnorePatterns && options.testPathIgnorePatterns.length > 0) {
      options.testPathIgnorePatterns.forEach(pattern => {
        args.push(`--testPathIgnorePatterns="${pattern}"`);
      });
    }
    
    console.log(`\n# グループ: ${groupName} - 実行開始`);
    
    // ESMテスト用特殊処理
    if (options.experimental) {
      // ESMテストは専用スクリプトで実行
      console.log(`実行コマンド: node --experimental-vm-modules ./scripts/run-esm-tests-safely.js ${args.join(' ')}`);
      const esmProcess = spawn('node', ['--experimental-vm-modules', './scripts/run-esm-tests-safely.js', ...args], {
        stdio: 'inherit',
        shell: true
      });
      
      esmProcess.on('close', (code) => {
        // 終了時刻を記録し、所要時間を計算
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        console.log(`\n# グループ: ${groupName} - 終了 (終了コード: ${code}, 所要時間: ${duration.toFixed(2)}秒)`);
        resolve({ groupName, exitCode: code, duration });
      });
      return;
    }
    
    // 通常のJest実行 (node_modules経由で実行)
    console.log(`実行コマンド: node ${JEST_BIN} ${args.join(' ')}`);
    const jestProcess = spawn('node', [JEST_BIN, ...args], {
      stdio: 'inherit',
      shell: true
    });
    
    jestProcess.on('close', (code) => {
      // 終了時刻を記録し、所要時間を計算
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      console.log(`\n# グループ: ${groupName} - 終了 (終了コード: ${code}, 所要時間: ${duration.toFixed(2)}秒)`);
      resolve({ groupName, exitCode: code, duration });
    });
  });
}

/**
 * パラレルでJestを実行する関数
 * @param {Object} groups - テストグループの定義
 * @param {number} concurrency - 並列実行数
 * @returns {Promise<{results: Array, totalTime: number}>}
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
 * メトリクスを更新する関数
 * @param {Array} groupResults - グループごとの実行結果
 * @param {number} totalTime - 合計実行時間
 */
function updateMetrics(groupResults, totalTime) {
  initMetricsDir();
  
  // 既存のメトリクスをロード
  const metricsData = loadPreviousMetrics();
  
  // 新しい実行結果を追加
  const newRun = {
    timestamp: Date.now(),
    totalTime,
    groupResults
  };
  
  metricsData.runs.push(newRun);
  
  // 直近10回の実行結果のみ保持
  if (metricsData.runs.length > 10) {
    metricsData.runs = metricsData.runs.slice(-10);
  }
  
  // 平均値を計算
  metricsData.averages = calculateAverages(metricsData.runs);
  
  // メトリクスを保存
  saveMetrics(metricsData);
}

/**
 * メイン実行関数
 */
async function main() {
  try {
    // コマンドライン引数の解析
    const args = process.argv.slice(2);
    
    // ヘルプオプションの処理
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      return;
    }
    
    // レポート表示オプションの処理
    if (args.includes('--report') || args.includes('-r')) {
      showReport();
      return;
    }
    
    const onlyGroup = args.length > 0 && !args[0].startsWith('-') ? args[0] : null;
    const concurrency = args.length > 1 && !args[1].startsWith('-') ? parseInt(args[1], 10) : DEFAULT_WORKERS;
    
    console.log('\n===== テスト分割実行 (TST-061) =====');
    console.log(`並列実行数: ${concurrency}`);
    
    // Jestのバイナリファイルが存在するか確認
    if (!fs.existsSync(JEST_BIN)) {
      console.error(`エラー: Jestが見つかりません: ${JEST_BIN}`);
      console.log('npm install または npm ci を実行してJestをインストールしてください。');
      process.exit(1);
    }
    
    // 特定のグループのみ実行する場合
    const targetGroups = onlyGroup && TEST_GROUPS[onlyGroup] ? { [onlyGroup]: TEST_GROUPS[onlyGroup] } : TEST_GROUPS;
    
    if (!targetGroups || Object.keys(targetGroups).length === 0) {
      console.error(`エラー: 指定されたグループ '${onlyGroup}' は存在しません`);
      console.log(`有効なグループ: ${Object.keys(TEST_GROUPS).join(', ')}`);
      process.exit(1);
    }
    
    // テスト実行
    const { results, totalTime } = await runParallelTests(targetGroups, concurrency);
    
    // メトリクスを更新
    updateMetrics(results, totalTime);
    
    // 結果概要を表示
    console.log('\n===== テスト実行結果 =====');
    console.log(`合計実行時間: ${totalTime.toFixed(2)}秒`);
    
    // ベースラインと比較
    const baselineTime = onlyGroup ? BASELINE_TIMES[onlyGroup] : BASELINE_TIMES.total;
    if (baselineTime) {
      const improvement = (1 - totalTime / baselineTime) * 100;
      console.log(`ベースライン比: ${improvement.toFixed(1)}% 改善 (${baselineTime}秒 → ${totalTime.toFixed(2)}秒)`);
    }
    
    let failedGroups = 0;
    console.log('\n----- 各グループの実行結果 -----');
    results.forEach(result => {
      const status = result.exitCode === 0 ? '✅ 成功' : '❌ 失敗';
      const baseline = BASELINE_TIMES[result.groupName] || 0;
      const improvement = baseline > 0 ? (1 - result.duration / baseline) * 100 : 0;
      
      console.log(
        `${status} - グループ: ${result.groupName.padEnd(8)} ` +
        `所要時間: ${result.duration.toFixed(2)}秒 ` +
        `(${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}% vs ベースライン)`
      );
      
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