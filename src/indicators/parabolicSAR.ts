/**
 * Parabolic SAR (Stop and Reverse) 指標の実装
 * トレンドの転換点を検出し、ストップロスの設定・更新に使用
 */
import { Candle } from '../core/types.js';
import { parameterService } from '../config/parameterService.js';

// Parabolic SARのデフォルトパラメータ
const DEFAULT_ACCELERATION_FACTOR_START = 0.02;
const DEFAULT_ACCELERATION_FACTOR_INCREMENT = 0.02;
const DEFAULT_ACCELERATION_FACTOR_MAX = 0.2;

// YAML設定からパラメータを取得
const ACCELERATION_FACTOR_START = parameterService.get<number>(
  'parabolicSAR.accelerationFactorStart',
  DEFAULT_ACCELERATION_FACTOR_START
);
const ACCELERATION_FACTOR_INCREMENT = parameterService.get<number>(
  'parabolicSAR.accelerationFactorIncrement',
  DEFAULT_ACCELERATION_FACTOR_INCREMENT
);
const ACCELERATION_FACTOR_MAX = parameterService.get<number>(
  'parabolicSAR.accelerationFactorMax',
  DEFAULT_ACCELERATION_FACTOR_MAX
);

/**
 * Parabolic SAR指標の計算結果
 */
export interface ParabolicSARResult {
  sar: number; // 現在のSAR値
  isUptrend: boolean; // 上昇トレンドの場合true、下降トレンドの場合false
  accelerationFactor: number; // 現在の加速係数
  extremePoint: number; // 極値（上昇トレンドの場合は最高値、下降トレンドの場合は最安値）
}

/**
 * インクリメンタルParabolicSAR計算クラス
 * 全履歴の再計算をせず、増分計算でSARを更新
 */
export class IncrementalParabolicSAR {
  private isUptrend: boolean = true; // 上昇トレンドフラグ
  private sar: number = 0; // 現在のSAR値
  private extremePoint: number = 0; // 極値
  private accelerationFactor: number = ACCELERATION_FACTOR_START; // 加速係数
  private prevSAR: number = 0; // 前回のSAR値（反転時に使用）
  private prevHigh: number = 0; // 前回の高値
  private prevLow: number = 0; // 前回の安値
  private isInitialized: boolean = false; // 初期化フラグ

  constructor(
    private accelerationFactorStart: number = ACCELERATION_FACTOR_START,
    private accelerationFactorIncrement: number = ACCELERATION_FACTOR_INCREMENT,
    private accelerationFactorMax: number = ACCELERATION_FACTOR_MAX
  ) {}

  /**
   * SARの初期化
   * @param candles ローソク足データ（最低2本以上必要）
   * @returns 初期化されたSAR値
   */
  initialize(candles: Candle[]): ParabolicSARResult {
    if (!candles || candles.length < 2) {
      throw new Error('Parabolic SAR計算には最低2本のローソク足が必要です');
    }

    // 最初の2本のローソク足で初期化
    const candle1 = candles[0];
    const candle2 = candles[1];

    // 初期トレンド方向を決定（2本目の終値が1本目より高いなら上昇トレンド）
    this.isUptrend = candle2.close > candle1.close;

    // 極値ポイントを設定
    if (this.isUptrend) {
      this.extremePoint = Math.max(candle1.high, candle2.high);
      this.sar = candle1.low; // 上昇トレンドの場合、SARは最初のローソク足の安値
    } else {
      this.extremePoint = Math.min(candle1.low, candle2.low);
      this.sar = candle1.high; // 下降トレンドの場合、SARは最初のローソク足の高値
    }

    // 加速係数を初期値に設定
    this.accelerationFactor = this.accelerationFactorStart;

    // 前回の値を保存
    this.prevHigh = candle2.high;
    this.prevLow = candle2.low;
    this.prevSAR = this.sar;

    this.isInitialized = true;

    // 3本目以降のローソク足でSARを更新
    for (let i = 2; i < candles.length; i++) {
      this.update(candles[i]);
    }

    return {
      sar: this.sar,
      isUptrend: this.isUptrend,
      accelerationFactor: this.accelerationFactor,
      extremePoint: this.extremePoint
    };
  }

  /**
   * 新しいローソク足でSARを更新
   * @param candle 新しいローソク足
   * @returns 更新されたSARの結果
   */
  update(candle: Candle): ParabolicSARResult {
    if (!this.isInitialized) {
      throw new Error(
        'Parabolic SARが初期化されていません。初期化は最低2本のローソク足が必要です。'
      );
    }

    const { high, low } = candle;

    // 前回のSARを保存（次のSAR計算用）
    this.prevSAR = this.sar;

    // SARの計算
    this.sar = this.prevSAR + this.accelerationFactor * (this.extremePoint - this.prevSAR);

    // トレンド反転の判定
    let isReversed = false;

    if (this.isUptrend) {
      // 上昇トレンドの場合、SARは下にプロットされる
      // SARが現在の安値を上回ったらトレンド反転
      if (this.sar > low) {
        this.isUptrend = false;
        isReversed = true;

        // SARを極値（前の期間の高値）に設定
        this.sar = this.extremePoint;

        // 極値を現在の安値に設定
        this.extremePoint = low;

        // 加速係数をリセット
        this.accelerationFactor = this.accelerationFactorStart;
      } else {
        // 通常の更新処理
        // 過去2本の高値をもとにSARの値を制限（下降の場合は2本の安値）
        this.sar = Math.min(this.sar, this.prevLow, low);

        // 新しい高値が更新されたら極値と加速係数を更新
        if (high > this.extremePoint) {
          this.extremePoint = high;
          this.accelerationFactor = Math.min(
            this.accelerationFactor + this.accelerationFactorIncrement,
            this.accelerationFactorMax
          );
        }
      }
    } else {
      // 下降トレンドの場合、SARは上にプロットされる
      // SARが現在の高値を下回ったらトレンド反転
      if (this.sar < high) {
        this.isUptrend = true;
        isReversed = true;

        // SARを極値（前の期間の安値）に設定
        this.sar = this.extremePoint;

        // 極値を現在の高値に設定
        this.extremePoint = high;

        // 加速係数をリセット
        this.accelerationFactor = this.accelerationFactorStart;
      } else {
        // 通常の更新処理
        // 過去2本の安値をもとにSARの値を制限（上昇の場合は2本の高値）
        this.sar = Math.max(this.sar, this.prevHigh, high);

        // 新しい安値が更新されたら極値と加速係数を更新
        if (low < this.extremePoint) {
          this.extremePoint = low;
          this.accelerationFactor = Math.min(
            this.accelerationFactor + this.accelerationFactorIncrement,
            this.accelerationFactorMax
          );
        }
      }
    }

    // 前回の高値と安値を更新
    this.prevHigh = high;
    this.prevLow = low;

    return {
      sar: this.sar,
      isUptrend: this.isUptrend,
      accelerationFactor: this.accelerationFactor,
      extremePoint: this.extremePoint
    };
  }
}

// グローバルインスタンスを保持（インクリメンタル計算用）
let globalParabolicSARInstance: IncrementalParabolicSAR | null = null;

/**
 * インクリメンタル計算用インスタンスをリセット
 */
export function resetParabolicSARCalculator(): void {
  globalParabolicSARInstance = null;
}

/**
 * Parabolic SARを計算する関数
 * @param candles ローソク足データ
 * @returns Parabolic SARの結果
 */
export function calculateParabolicSAR(candles: Candle[]): ParabolicSARResult {
  if (!candles || candles.length < 2) {
    throw new Error('Parabolic SAR計算には最低2本のローソク足が必要です');
  }

  // グローバルインスタンスがない場合は新規作成
  if (!globalParabolicSARInstance) {
    globalParabolicSARInstance = new IncrementalParabolicSAR();
    return globalParabolicSARInstance.initialize(candles);
  }

  // 最新のローソク足でSARを更新
  return globalParabolicSARInstance.update(candles[candles.length - 1]);
}
