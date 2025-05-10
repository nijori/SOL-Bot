/**
 * Optunaのパラメータ空間を定義するファイル
 * 最適化対象のパラメータ範囲とデフォルト値を定義します
 */
import { IParameterSpace, ParameterType } from '../types/optimizer.js';

/**
 * 最適化対象パラメータの探索空間定義
 */
export const parameterSpace: IParameterSpace = {
  // ATR閾値 - レンジ/トレンド判定の基準値
  ATR_PERCENTAGE_THRESHOLD: {
    type: ParameterType.FLOAT,
    min: 4.0,
    max: 8.0,
    step: 0.1,
    default: 6.0,
    description: 'ATR%のレンジ/トレンド判定閾値'
  },

  // トレイリングストップ係数 - トレンド戦略用
  TRAILING_STOP_FACTOR: {
    type: ParameterType.FLOAT,
    min: 0.8,
    max: 1.5,
    step: 0.05,
    default: 1.2,
    description: 'ATRに乗算するトレイリングストップ係数'
  },

  // グリッドATR乗数 - レンジ戦略用
  GRID_ATR_MULTIPLIER: {
    type: ParameterType.FLOAT,
    min: 0.3,
    max: 0.9,
    step: 0.05,
    default: 0.6,
    description: 'レンジ戦略のグリッド間隔計算に使用するATR乗数'
  },

  // EMA傾き判定値 - レンジ判定用
  EMA_SLOPE_THRESHOLD: {
    type: ParameterType.FLOAT,
    min: 0.05,
    max: 0.25,
    step: 0.01,
    default: 0.15,
    description: 'EMA傾きのレンジ判定閾値'
  },

  // ポジション追加判定の利益R値
  ADDON_POSITION_R_THRESHOLD: {
    type: ParameterType.FLOAT,
    min: 0.7,
    max: 1.5,
    step: 0.1,
    default: 1.0,
    description: '追加ポジション判定の利益R値閾値'
  },

  // ポジション追加サイズ係数
  ADDON_POSITION_SIZE_FACTOR: {
    type: ParameterType.FLOAT,
    min: 0.3,
    max: 0.7,
    step: 0.05,
    default: 0.5,
    description: '追加ポジションのサイズ係数（元の何%か）'
  },

  // ブラックスワン判定閾値
  BLACK_SWAN_THRESHOLD: {
    type: ParameterType.FLOAT,
    min: 0.1,
    max: 0.2,
    step: 0.01,
    default: 0.15,
    description: 'ブラックスワン判定の価格変動率閾値'
  },

  // EMA傾き計算の高ボラティリティ閾値
  SLOPE_HIGH_VOL_THRESHOLD: {
    type: ParameterType.FLOAT,
    min: 6.0,
    max: 10.0,
    step: 0.5,
    default: 8.0,
    description: '高ボラティリティ判定のATR%閾値'
  },

  // EMA傾き計算の低ボラティリティ閾値
  SLOPE_LOW_VOL_THRESHOLD: {
    type: ParameterType.FLOAT,
    min: 2.0,
    max: 4.0,
    step: 0.2,
    default: 3.0,
    description: '低ボラティリティ判定のATR%閾値'
  },

  // EMA傾き計算のデフォルト期間
  SLOPE_PERIODS_DEFAULT: {
    type: ParameterType.INTEGER,
    min: 3,
    max: 8,
    step: 1,
    default: 5,
    description: 'EMA傾き計算のデフォルト期間'
  },

  // 高ボラティリティ時の期間値
  SLOPE_HIGH_VOL_VALUE: {
    type: ParameterType.INTEGER,
    min: 2,
    max: 5,
    step: 1,
    default: 3,
    description: '高ボラティリティ時のEMA傾き計算期間'
  },

  // 低ボラティリティ時の期間値
  SLOPE_LOW_VOL_VALUE: {
    type: ParameterType.INTEGER,
    min: 6,
    max: 10,
    step: 1,
    default: 8,
    description: '低ボラティリティ時のEMA傾き計算期間'
  }
};

/**
 * デフォルトパラメータを取得
 */
export function getDefaultParameters(): Record<string, number> {
  return Object.entries(parameterSpace).reduce(
    (acc, [key, def]) => {
      acc[key] = def.default;
      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * 最適化パラメータのYAML形式出力
 */
export function formatParametersAsYaml(params: Record<string, number>): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}
