/**
 * マーケット状態分析結果の型定義
 */

export interface MarketStateResult {
  trend: string;
  volatility: number;
  volume: number;
  momentum: number;
  atr: number;
  strength: number;
  support?: number;
  resistance?: number;
  isBreakout: boolean;
  marketType: string;
  timestamp: number;
} 