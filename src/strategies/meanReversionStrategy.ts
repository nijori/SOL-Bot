/**
 * MeanReversionStrategy
 * 
 * 価格の平均回帰性を利用した戦略
 * 平均値から乖離した価格が再び平均に回帰する性質を利用
 * 
 * 注意: これはTST-012テスト用のテンポラリな実装です
 */

import { Candle } from "../core/types.js";
import { StrategyResult } from "../types/strategyResult.js";

export class MeanReversionStrategy {
  // コンストラクタ
  constructor(symbol: string, config: any = {}) {
    // 実際の実装では設定値が入ります
  }

  // 戦略実行
  async execute(candles: Candle[]): Promise<StrategyResult> {
    // テスト用にダミーの結果を返す
    return {
      signals: [],
      metadata: {
        strategy: 'MeanReversion',
        timeframe: '1h',
        version: '0.1.0'
      }
    };
  }
} 