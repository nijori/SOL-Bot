/**
 * 数学関連のユーティリティ関数
 * CORE-005: backtestRunnerとtradingEngineのマルチシンボル対応拡張
 */

/**
 * ピアソン相関係数を計算
 * @param x 時系列データ1
 * @param y 時系列データ2
 * @returns 相関係数 (-1.0〜1.0)
 */
export function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length) {
    throw new Error('配列の長さが一致しません');
  }

  if (x.length === 0) {
    return 0;
  }

  const n = x.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

/**
 * 分散を計算
 * @param values 数値配列
 * @returns 分散
 */
export function calculateVariance(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const mean = calculateMean(values);
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
  return calculateSum(squaredDiffs) / (values.length - 1); // 不偏分散
}

/**
 * 標準偏差を計算
 * @param values 数値配列
 * @returns 標準偏差
 */
export function calculateStandardDeviation(values: number[]): number {
  return Math.sqrt(calculateVariance(values));
}

/**
 * 平均値を計算
 * @param values 数値配列
 * @returns 平均値
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return calculateSum(values) / values.length;
}

/**
 * 数値配列の合計を計算
 * @param values 数値配列
 * @returns 合計値
 */
export function calculateSum(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

/**
 * ポートフォリオの加重平均リターンを計算
 * @param returns 各資産のリターン配列
 * @param weights 各資産のウェイト配列
 * @returns 加重平均リターン
 */
export function calculateWeightedReturn(returns: number[], weights: number[]): number {
  if (returns.length !== weights.length) {
    throw new Error('リターンとウェイトの配列長が一致しません');
  }

  let weightedReturn = 0;
  for (let i = 0; i < returns.length; i++) {
    weightedReturn += returns[i] * weights[i];
  }
  return weightedReturn;
}

/**
 * ポートフォリオの共分散行列を計算
 * @param returnsSeries 各資産のリターン時系列の配列
 * @returns 共分散行列
 */
export function calculateCovarianceMatrix(returnsSeries: number[][]): number[][] {
  const n = returnsSeries.length; // 資産数
  if (n === 0) return [];

  const m = returnsSeries[0].length; // 時系列長
  const covariance: number[][] = [];

  // 平均を計算
  const means: number[] = returnsSeries.map(series => calculateMean(series));

  // 共分散行列を初期化
  for (let i = 0; i < n; i++) {
    covariance[i] = [];
    for (let j = 0; j < n; j++) {
      covariance[i][j] = 0;
    }
  }

  // 共分散を計算
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < m; k++) {
        sum += (returnsSeries[i][k] - means[i]) * (returnsSeries[j][k] - means[j]);
      }
      covariance[i][j] = sum / (m - 1); // 不偏共分散
    }
  }

  return covariance;
}

/**
 * シャープレシオを計算
 * @param returns リターン配列
 * @param riskFreeRate リスクフリーレート（年率）
 * @param isDaily 日次リターンの場合true
 * @returns シャープレシオ
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0,
  isDaily: boolean = true
): number {
  if (returns.length <= 1) return 0;

  const mean = calculateMean(returns);
  const stdDev = calculateStandardDeviation(returns);

  if (stdDev === 0) return 0;

  // 日次→年次への変換（必要な場合）
  const annualizationFactor = isDaily ? Math.sqrt(252) : 1;
  const excessReturn = mean - (riskFreeRate / (isDaily ? 252 : 1));

  return (excessReturn / stdDev) * annualizationFactor;
}

/**
 * ソルティノレシオを計算
 * @param returns リターン配列
 * @param targetReturn 目標リターン（通常はリスクフリーレート）
 * @param isDaily 日次リターンの場合true
 * @returns ソルティノレシオ
 */
export function calculateSortinoRatio(
  returns: number[],
  targetReturn: number = 0,
  isDaily: boolean = true
): number {
  if (returns.length <= 1) return 0;

  const mean = calculateMean(returns);
  
  // 下方偏差を計算
  const negativeReturns = returns.filter(ret => ret < targetReturn);
  if (negativeReturns.length === 0) return Infinity; // 下方変動がない場合
  
  const downDeviation = Math.sqrt(
    negativeReturns.reduce((sum, ret) => sum + Math.pow(ret - targetReturn, 2), 0) / negativeReturns.length
  );
  
  if (downDeviation === 0) return 0;
  
  // 日次→年次への変換（必要な場合）
  const annualizationFactor = isDaily ? Math.sqrt(252) : 1;
  const excessReturn = mean - (targetReturn / (isDaily ? 252 : 1));
  
  return (excessReturn / downDeviation) * annualizationFactor;
}

/**
 * ドローダウンを計算
 * @param equityCurve 資産推移配列
 * @returns {maxDrawdown: number, drawdownPeriods: {start: number, end: number, depth: number}[]}
 */
export function calculateDrawdowns(equityCurve: number[]): { 
  maxDrawdown: number;
  drawdownPeriods: {start: number; end: number; depth: number}[];
} {
  if (equityCurve.length <= 1) {
    return { maxDrawdown: 0, drawdownPeriods: [] };
  }
  
  let peak = equityCurve[0];
  let maxDrawdown = 0;
  let drawdownPeriods: {start: number; end: number; depth: number}[] = [];
  let currentDrawdownStart = 0;
  let inDrawdown = false;
  
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) {
      // 新しいピークを記録
      peak = equityCurve[i];
      
      // ドローダウンから回復した場合
      if (inDrawdown) {
        inDrawdown = false;
      }
    } else if (equityCurve[i] < peak) {
      // ドローダウン開始
      if (!inDrawdown) {
        inDrawdown = true;
        currentDrawdownStart = i - 1; // ピークのインデックス
      }
      
      // ドローダウン深度を計算
      const drawdown = 1 - (equityCurve[i] / peak);
      
      // 最大ドローダウンを更新
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
      
      // 前のドローダウン期間と結合するか、新しい期間を作成
      if (drawdownPeriods.length > 0 && 
          drawdownPeriods[drawdownPeriods.length - 1].end === i - 1) {
        // 既存期間を延長
        drawdownPeriods[drawdownPeriods.length - 1].end = i;
        
        // より深いドローダウンならdepthを更新
        if (drawdown > drawdownPeriods[drawdownPeriods.length - 1].depth) {
          drawdownPeriods[drawdownPeriods.length - 1].depth = drawdown;
        }
      } else {
        // 新しいドローダウン期間を追加
        drawdownPeriods.push({
          start: currentDrawdownStart,
          end: i,
          depth: drawdown
        });
      }
    }
  }
  
  return { maxDrawdown, drawdownPeriods };
} 