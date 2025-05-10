/**
 * Optuna最適化に関する型定義
 */

/**
 * パラメータのタイプ
 */
export enum ParameterType {
  INTEGER = 'integer',
  FLOAT = 'float',
  CATEGORICAL = 'categorical',
  BOOLEAN = 'boolean'
}

/**
 * パラメータ範囲の基本インターフェース
 */
interface BaseParameterDefinition {
  type: ParameterType;
  description: string;
  default: any;
}

/**
 * 整数パラメータ定義
 */
export interface IntegerParameterDefinition extends BaseParameterDefinition {
  type: ParameterType.INTEGER;
  min: number;
  max: number;
  step?: number;
  default: number;
}

/**
 * 浮動小数点パラメータ定義
 */
export interface FloatParameterDefinition extends BaseParameterDefinition {
  type: ParameterType.FLOAT;
  min: number;
  max: number;
  step?: number;
  default: number;
}

/**
 * カテゴリパラメータ定義
 */
export interface CategoricalParameterDefinition extends BaseParameterDefinition {
  type: ParameterType.CATEGORICAL;
  choices: any[];
  default: any;
}

/**
 * ブール値パラメータ定義
 */
export interface BooleanParameterDefinition extends BaseParameterDefinition {
  type: ParameterType.BOOLEAN;
  default: boolean;
}

/**
 * パラメータ定義の型
 */
export type ParameterDefinition =
  | IntegerParameterDefinition
  | FloatParameterDefinition
  | CategoricalParameterDefinition
  | BooleanParameterDefinition;

/**
 * パラメータ空間のインターフェース
 */
export interface IParameterSpace {
  [key: string]: ParameterDefinition;
}

/**
 * 最適化結果のインターフェース
 */
export interface OptimizationResult {
  bestParameters: Record<string, any>;
  bestValue: number;
  allTrials: {
    parameters: Record<string, any>;
    value: number;
  }[];
}

/**
 * 評価指標タイプ
 */
export enum MetricType {
  SHARPE_RATIO = 'sharpe_ratio',
  TOTAL_RETURN = 'total_return',
  MAX_DRAWDOWN = 'max_drawdown',
  CALMAR_RATIO = 'calmar_ratio',
  SORTINO_RATIO = 'sortino_ratio',
  COMPOSITE = 'composite'
}

/**
 * 最適化設定のインターフェース
 */
export interface OptimizerConfig {
  numTrials: number;
  metric: MetricType;
  parameterSpace: IParameterSpace;
  timeframeHours: number;
  symbol: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
}
