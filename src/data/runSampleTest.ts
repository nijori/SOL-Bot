/**
 * サンプルデータ生成とバックテスト検証を行うスクリプト
 * DAT-003タスク用のテストスクリプト
 */

// Node.js関連の型定義
declare const require: any;
declare const process: {
  exit(code: number): void;
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

import { generateAndSaveSampleData } from "./generateSampleData.js";
import { BacktestRunner } from "../core/backtestRunner.js";
import { OptunaOptimizer } from "../optimizer/optunaOptimizer.js";
import { MetricType } from "../types/optimizer.js";
import logger from "../utils/logger.js";

/**
 * サンプルデータ生成、バックテスト、最適化の一連の流れをテスト
 */
async function runSampleTest() {
  try {
    // 1. サンプルデータの生成
    logger.info('===== サンプルデータ生成開始 =====');
    await generateAndSaveSampleData();
    logger.info('サンプルデータ生成完了');

    // 2. 生成したデータでのバックテスト
    logger.info('===== バックテスト実行開始 =====');
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3); // 3ヶ月分のデータでテスト

    const backtestRunner = new BacktestRunner({
      symbol: 'SOLUSDT',
      timeframeHours: 1,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      initialBalance: 10000
    });

    const backtestResult = await backtestRunner.run();

    logger.info(`バックテスト結果:
      トータルリターン: ${backtestResult.metrics.totalReturn.toFixed(2)}%
      シャープレシオ: ${backtestResult.metrics.sharpeRatio.toFixed(2)}
      最大ドローダウン: ${(backtestResult.metrics.maxDrawdown * 100).toFixed(2)}%
      勝率: ${(backtestResult.metrics.winRate * 100).toFixed(2)}%
      取引数: ${backtestResult.trades.length}
    `);

    // 3. 小規模な最適化テスト (5回のトライアル)
    logger.info('===== 最適化テスト開始 =====');
    const optimizer = new OptunaOptimizer({
      numTrials: 5,
      metric: MetricType.SHARPE_RATIO,
      symbol: 'SOLUSDT',
      timeframeHours: 1,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      initialBalance: 10000
    });

    const optimizationResult = await optimizer.optimize();

    logger.info(`最適化テスト結果:
      最良値: ${optimizationResult.bestValue}
      最適パラメータ: ${JSON.stringify(optimizationResult.bestParameters, null, 2)}
    `);

    logger.info('サンプルデータ生成とバックテスト検証が完了しました');
    return true;
  } catch (error) {
    logger.error(
      `テスト実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

// スクリプト実行
if (require.main === module) {
  runSampleTest().then((success) => {
    if (success) {
      logger.info('DAT-003タスク検証完了: サンプルデータ生成と検証が成功しました');
      process.exit(0);
    } else {
      logger.error('DAT-003タスク検証失敗: サンプルデータ生成と検証に問題が発生しました');
      process.exit(1);
    }
  });
}

export { runSampleTest };
