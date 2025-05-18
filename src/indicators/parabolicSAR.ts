/**
 * Parabolic SAR (Stop and Reverse) 指標の実装
 * トレンドの転換点を検出し、ストップロスの設定・更新に使用
 * INF-032-6: インジケーターディレクトリのCommonJS変換
 */
// @ts-nocheck

// CommonJS形式でのモジュールインポート
const Types = require('../core/types');
const { Candle } = Types;
const { parameterService } = require('../config/parameterService');

// Parabolic SARのデフォルトパラメータ
const DEFAULT_ACCELERATION_FACTOR_START = 0.02;
const DEFAULT_ACCELERATION_FACTOR_INCREMENT = 0.02;
const DEFAULT_ACCELERATION_FACTOR_MAX = 0.2;

// YAML設定からパラメータを取得
const ACCELERATION_FACTOR_START = parameterService.get(
  'parabolicSAR.accelerationFactorStart',
  DEFAULT_ACCELERATION_FACTOR_START
);
const ACCELERATION_FACTOR_INCREMENT = parameterService.get(
  'parabolicSAR.accelerationFactorIncrement',
  DEFAULT_ACCELERATION_FACTOR_INCREMENT
);
const ACCELERATION_FACTOR_MAX = parameterService.get(
  'parabolicSAR.accelerationFactorMax',
  DEFAULT_ACCELERATION_FACTOR_MAX
);

/**
 * Parabolic SAR指標の計算結果
 * @typedef {Object} ParabolicSARResult
 * @property {number} sar 現在のSAR値
 * @property {boolean} isUptrend 上昇トレンドの場合true、下降トレンドの場合false
 * @property {number} accelerationFactor 現在の加速係数
 * @property {number} extremePoint 極値（上昇トレンドの場合は最高値、下降トレンドの場合は最安値）
 */

/**
 * インクリメンタルParabolicSAR計算クラス
 * 全履歴の再計算をせず、増分計算でSARを更新
 */
class IncrementalParabolicSAR {
  /**
   * @param {number} accelerationFactorStart 開始時の加速係数
   * @param {number} accelerationFactorIncrement 加速係数の増分
   * @param {number} accelerationFactorMax 加速係数の最大値
   */
  constructor(
    accelerationFactorStart = ACCELERATION_FACTOR_START,
    accelerationFactorIncrement = ACCELERATION_FACTOR_INCREMENT,
    accelerationFactorMax = ACCELERATION_FACTOR_MAX
  ) {
    this.accelerationFactorStart = accelerationFactorStart;
    this.accelerationFactorIncrement = accelerationFactorIncrement;
    this.accelerationFactorMax = accelerationFactorMax;
    this.isUptrend = true; // 上昇トレンドフラグ
    this.sar = 0; // 現在のSAR値
    this.extremePoint = 0; // 極値
    this.accelerationFactor = ACCELERATION_FACTOR_START; // 加速係数
    this.prevSAR = 0; // 前回のSAR値（反転時に使用）
    this.prevHigh = 0; // 前回の高値
    this.prevLow = 0; // 前回の安値
    this.isInitialized = false; // 初期化フラグ
  }

  /**
   * SARの初期化
   * @param {Candle[]} candles ローソク足データ（最低2本以上必要）
   * @returns {ParabolicSARResult} 初期化されたSAR値
   */
  initialize(candles) {
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
   * @param {Candle} candle 新しいローソク足
   * @returns {ParabolicSARResult} 更新されたSARの結果
   */
  update(candle) {
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
let globalParabolicSARInstance = null;

/**
 * インクリメンタル計算用インスタンスをリセット
 */
function resetParabolicSARCalculator() {
  globalParabolicSARInstance = null;
}

/**
 * Parabolic SARを計算する関数
 * @param {Candle[]} candles ローソク足データ
 * @returns {ParabolicSARResult} Parabolic SARの結果
 */
function calculateParabolicSAR(candles) {
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

// CommonJS形式でエクスポート
module.exports = {
  IncrementalParabolicSAR,
  resetParabolicSARCalculator,
  calculateParabolicSAR
};
