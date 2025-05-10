/**
 * Optunaによるパラメータ最適化を実行するためのエントリポイント
 * ALG-023タスク: OptunaによるパラメータAI最適化
 */

// Node.js関連の型定義
declare const require: any;
declare const process: {
  argv: string[];
  exit(code: number): void;
  env: Record<string, string>;
};
declare const module: {
  exports: any;
  require: any;
  id: string;
  filename: string;
  loaded: boolean;
  parent: any;
  children: any[];
  path: string;
};

import * as dotenv from 'dotenv';
import { OptunaOptimizer } from './optunaOptimizer.js';
import { MetricType } from '../types/optimizer.js';
import { parameterSpace } from './parameterSpace.js';
import logger from '../utils/logger.js';

// 環境変数の読み込み
dotenv.config();

/**
 * コマンドライン引数の解析
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, any> = {
    numTrials: 20, // デフォルト20試行
    metric: MetricType.SHARPE_RATIO,
    symbol: 'SOLUSDT',
    timeframeHours: 1,
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    initialBalance: 10000
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--trials' && i + 1 < args.length) {
      options.numTrials = parseInt(args[++i], 10);
    } else if (arg === '--metric' && i + 1 < args.length) {
      const metricValue = args[++i];
      if (Object.values(MetricType).includes(metricValue as MetricType)) {
        options.metric = metricValue as MetricType;
      } else {
        logger.error(`無効な評価指標: ${metricValue}`);
        logger.error(`有効な値: ${Object.values(MetricType).join(', ')}`);
        process.exit(1);
      }
    } else if (arg === '--symbol' && i + 1 < args.length) {
      options.symbol = args[++i];
    } else if (arg === '--timeframe' && i + 1 < args.length) {
      options.timeframeHours = parseInt(args[++i], 10);
    } else if (arg === '--start-date' && i + 1 < args.length) {
      options.startDate = args[++i];
    } else if (arg === '--end-date' && i + 1 < args.length) {
      options.endDate = args[++i];
    } else if (arg === '--initial-balance' && i + 1 < args.length) {
      options.initialBalance = parseFloat(args[++i]);
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * ヘルプメッセージの表示
 */
function printHelp() {
  console.log(`
最適化実行コマンド

使用方法: npm run optimize -- [オプション]

オプション:
  --trials <数値>          試行回数 (デフォルト: 20)
  --metric <指標>          評価指標 (デフォルト: sharpe_ratio)
                          有効な値: ${Object.values(MetricType).join(', ')}
  --symbol <ティッカー>     取引ペア (デフォルト: SOLUSDT)
  --timeframe <時間>       時間枠（時間） (デフォルト: 1)
  --start-date <日付>      開始日 (デフォルト: 2023-01-01)
  --end-date <日付>        終了日 (デフォルト: 2023-12-31)
  --initial-balance <金額> 初期資金 (デフォルト: 10000)
  --help                   このヘルプメッセージを表示

例:
  npm run optimize -- --trials 50 --metric total_return --symbol SOLUSDT --timeframe 4
  `);
}

async function main() {
  try {
    logger.info('======== ALG-023: OptunaによるパラメータAI最適化開始 ========');

    // コマンドライン引数を解析
    const options = parseArgs();

    logger.info(`最適化設定:
    シンボル: ${options.symbol}
    時間枠: ${options.timeframeHours}時間
    期間: ${options.startDate} から ${options.endDate}
    試行回数: ${options.numTrials}
    評価指標: ${options.metric}
    初期資金: ${options.initialBalance}`);

    // 最適化の設定
    const optimizer = new OptunaOptimizer({
      numTrials: options.numTrials,
      metric: options.metric,
      parameterSpace: parameterSpace,
      timeframeHours: options.timeframeHours,
      symbol: options.symbol,
      startDate: options.startDate,
      endDate: options.endDate,
      initialBalance: options.initialBalance
    });

    // 最適化の実行
    const result = await optimizer.optimize();

    logger.info('======== 最適化結果 ========');
    logger.info(`評価指標 (${options.metric}): ${result.bestValue}`);
    logger.info('最適パラメータ:');
    Object.entries(result.bestParameters).forEach(([key, value]) => {
      logger.info(`  ${key}: ${value}`);
    });

    logger.info(`\n全試行数: ${result.allTrials.length}`);
    logger.info('上位3件の結果:');

    // 評価値でソートして上位3件を表示
    const sortedTrials = [...result.allTrials].sort((a, b) => {
      // 最小化指標の場合は昇順、最大化指標の場合は降順
      return options.metric === MetricType.MAX_DRAWDOWN ? a.value - b.value : b.value - a.value;
    });

    sortedTrials.slice(0, 3).forEach((trial, index) => {
      logger.info(`\n${index + 1}位 - 評価値: ${trial.value}`);
      logger.info('パラメータ:');
      Object.entries(trial.parameters).forEach(([key, value]) => {
        logger.info(`  ${key}: ${value}`);
      });
    });

    logger.info('\n======== ALG-023: OptunaによるパラメータAI最適化完了 ========');
    logger.info('最適化された設定値は /data/optimization/ ディレクトリに保存されました');

    // .todo/sprint.mdcを更新して、ALG-023タスクの状態を「完了」に変更するコメント
    logger.info('ALG-023タスク（OptunaによるパラメータAI最適化）を完了しました');
    logger.info('次のステップ：');
    logger.info('1. 最適化されたパラメータをバックテストで検証');
    logger.info('2. DAT-003タスク（サンプルデータ生成と検証）を継続して完了');
    logger.info('3. ウォークフォワード検証システムの実装を開始');

    return true;
  } catch (error) {
    logger.error('最適化中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// メイン処理の実行
if (require.main === module) {
  main().then((success) => {
    if (success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
}
