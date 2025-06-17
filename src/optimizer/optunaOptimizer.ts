/**
 * Optunaを使用したパラメータ最適化エンジン
 */
import * as optuna from 'optuna';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import {
  IParameterSpace,
  ParameterType,
  OptimizationResult,
  OptimizerConfig,
  MetricType
} from '../types/optimizer.js';
import { parameterSpace } from './parameterSpace.js';
import type { BacktestRunner } from '../core/backtestRunner.js';

export class OptunaOptimizer {
  private config: OptimizerConfig;
  private study: optuna.Study | null = null;

  constructor(config: Partial<OptimizerConfig> = {}) {
    this.config = {
      numTrials: config.numTrials || 20,
      metric: config.metric || MetricType.SHARPE_RATIO,
      parameterSpace: config.parameterSpace || parameterSpace,
      timeframeHours: config.timeframeHours || 1,
      symbol: config.symbol || 'SOLUSDT',
      startDate: config.startDate || '2023-01-01',
      endDate: config.endDate || '2023-12-31',
      initialBalance: config.initialBalance || 10000
    };
  }

  /**
   * 最適化を実行する
   */
  async optimize(): Promise<OptimizationResult> {
    console.log(`[OptunaOptimizer] 最適化開始: ${this.config.numTrials}試行`);
    console.log(`[OptunaOptimizer] 期間: ${this.config.startDate} から ${this.config.endDate}`);
    console.log(`[OptunaOptimizer] 評価指標: ${this.config.metric}`);

    // Optunaの学習を作成
    this.study = optuna.Study.create({
      direction: this.isMinimizationMetric() ? 'minimize' : 'maximize',
      study_name: `${this.config.symbol}_${this.config.metric}`
    });

    // 最適化を実行
    await this.study.optimize(this.objectiveFunction.bind(this), {
      n_trials: this.config.numTrials
    });

    // 最高のトライアルを取得
    const bestTrial = this.study.best_params;
    const bestValue = this.study.best_value;

    // 全トライアルの結果を取得
    const allTrials = this.study.trials.map((trial) => ({
      parameters: trial.params,
      value: trial.value || 0 // 値が未定義の場合は0をデフォルト値とする
    }));

    const result: OptimizationResult = {
      bestParameters: bestTrial,
      bestValue: bestValue,
      allTrials
    };

    // 結果をYAMLファイルに保存
    this.saveResultsToYaml(result);

    console.log(`[OptunaOptimizer] 最適化完了: 最良値 = ${bestValue}`);
    console.log(`[OptunaOptimizer] 最適パラメータ:`, bestTrial);

    return result;
  }

  /**
   * Optunaの目的関数
   * 各トライアルでパラメータセットを評価する
   */
  private async objectiveFunction(trial: optuna.Trial): Promise<number> {
    // トライアルからパラメータを生成
    const params = this.createTrialParameters(trial);
    
    try {
      // バックテストを実行して評価指標を取得
      const { BacktestRunner: BacktestRunnerClass } = require('../core/backtestRunner.js');
      const backtestRunner = new BacktestRunnerClass({
        symbol: this.config.symbol,
        timeframeHours: this.config.timeframeHours,
        startDate: this.config.startDate,
        endDate: this.config.endDate,
        initialBalance: this.config.initialBalance,
        parameters: params
      });

      const results = await backtestRunner.run();

      // 指定された評価指標を取得
      let metricValue: number;

      switch (this.config.metric) {
        case MetricType.SHARPE_RATIO:
          metricValue = results.metrics.sharpeRatio;
          break;
        case MetricType.TOTAL_RETURN:
          metricValue = results.metrics.totalReturn;
          break;
        case MetricType.MAX_DRAWDOWN:
          // 最大ドローダウンは小さい方が良いが、正の値で表現されているので負にする
          metricValue = results.metrics.maxDrawdown;
          break;
        case MetricType.CALMAR_RATIO:
          metricValue = results.metrics.calmarRatio;
          break;
        case MetricType.SORTINO_RATIO:
          metricValue = results.metrics.sortinoRatio;
          break;
        case MetricType.COMPOSITE:
          // 複合指標: シャープレシオ + リターン/10 - ドローダウン*5
          metricValue =
            results.metrics.sharpeRatio +
            results.metrics.totalReturn / 10 -
            results.metrics.maxDrawdown * 5;
          break;
        default:
          metricValue = results.metrics.sharpeRatio;
      }

      return metricValue;
    } catch (error) {
      console.error(`[OptunaOptimizer] エラー:`, error);
      // エラー時は不適な値を返す
      return this.isMinimizationMetric() ? 9999 : -9999;
    }
  }

  /**
   * トライアルからパラメータを生成
   */
  private createTrialParameters(trial: optuna.Trial): Record<string, any> {
    const params: Record<string, any> = {};

    // パラメータ空間の定義を使用してトライアルパラメータを生成
    Object.entries(this.config.parameterSpace).forEach(([key, def]) => {
      switch (def.type) {
        case ParameterType.FLOAT:
          if (def.step) {
            params[key] = trial.suggest_float(key, def.min, def.max, def.step);
          } else {
            params[key] = trial.suggest_float(key, def.min, def.max);
          }
          break;
        case ParameterType.INTEGER:
          params[key] = trial.suggest_int(key, def.min, def.max);
          break;
        case ParameterType.CATEGORICAL:
          params[key] = trial.suggest_categorical(key, def.choices);
          break;
        case ParameterType.BOOLEAN:
          params[key] = trial.suggest_categorical(key, [true, false]);
          break;
      }
    });

    return params;
  }

  /**
   * 最適化結果をYAMLファイルに保存
   */
  private saveResultsToYaml(result: OptimizationResult): void {
    const outputDir = path.resolve(process.cwd(), 'data', 'optimization');

    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.config.symbol}_${this.config.metric}_${timestamp}.yaml`;
    const outputPath = path.join(outputDir, filename);

    // 最適化結果をYAML形式で保存
    const yamlContent = yaml.dump({
      optimization_config: this.config,
      best_parameters: result.bestParameters,
      best_value: result.bestValue,
      all_trials: result.allTrials.map((trial, index) => ({
        trial_number: index,
        parameters: trial.parameters,
        value: trial.value
      }))
    });

    fs.writeFileSync(outputPath, yamlContent, 'utf8');
    console.log(`[OptunaOptimizer] 結果を保存: ${outputPath}`);
  }

  /**
   * 指定した評価指標が最小化すべきものかを判定
   */
  private isMinimizationMetric(): boolean {
    return this.config.metric === MetricType.MAX_DRAWDOWN;
  }
}
