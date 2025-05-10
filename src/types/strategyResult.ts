/**
 * 戦略実行結果の型定義
 * 戦略からの返り値の標準形式
 */

import { Signal } from '../core/types.js';

export interface StrategyResult {
  signals: Signal[];
  metadata: {
    strategy: string;
    timeframe: string;
    version: string;
    [key: string]: any;
  };
}
