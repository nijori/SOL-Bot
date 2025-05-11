/**
 * 平均回帰（Mean Reversion）戦略クラス
 * 過剰に伸びた価格が平均に戻る性質を利用した戦略
 */

import {
  Candle,
  Order,
  OrderSide,
  OrderType,
  Position,
  StrategyType
} from '../core/types.js';
import { parameterService } from '../config/parameterService.js';
import { calculateATR } from '../utils/atrUtils.js';

/**
 * 平均回帰戦略クラス
 */
export class MeanReversionStrategy {
  private symbol: string;
  private rsiPeriod: number;
  private rsiOverbought: number;
  private rsiOversold: number;
  private bbPeriod: number;
  private bbStdDev: number;
  private atrPeriod: number;
  private takeProfitFactor: number;
  private stopLossFactor: number;
  private maxRiskPerTrade: number;

  /**
   * コンストラクタ
   * @param symbol 通貨ペアシンボル
   */
  constructor(symbol: string) {
    this.symbol = symbol;
    
    // パラメータの初期化
    this.rsiPeriod = parameterService.get<number>('meanReversionStrategy.rsiPeriod', 14);
    this.rsiOverbought = parameterService.get<number>('meanReversionStrategy.rsiOverbought', 70);
    this.rsiOversold = parameterService.get<number>('meanReversionStrategy.rsiOversold', 30);
    this.bbPeriod = parameterService.get<number>('meanReversionStrategy.bbPeriod', 20);
    this.bbStdDev = parameterService.get<number>('meanReversionStrategy.bbStdDev', 2);
    this.atrPeriod = parameterService.get<number>('meanReversionStrategy.atrPeriod', 14);
    this.takeProfitFactor = parameterService.get<number>('meanReversionStrategy.takeProfitFactor', 1.5);
    this.stopLossFactor = parameterService.get<number>('meanReversionStrategy.stopLossFactor', 2.0);
    this.maxRiskPerTrade = parameterService.get<number>('risk.maxRiskPerTrade', 0.02);
  }

  /**
   * 戦略を実行する
   * @param candles ローソク足データ
   * @param positions 現在のポジション
   * @param accountBalance 口座残高
   * @returns 注文シグナルの配列
   */
  public execute(candles: Candle[], positions: Position[], accountBalance: number): Order[] {
    // 簡略化した実装
    const signals: Order[] = [];
    
    if (candles.length < Math.max(this.rsiPeriod, this.bbPeriod, this.atrPeriod) + 10) {
      return signals;
    }
    
    // 現在のポジションが既に存在するか確認
    const hasPosition = positions.some(p => p.symbol === this.symbol);
    
    if (!hasPosition) {
      // 新規ポジションのシグナル生成
      const currentPrice = candles[candles.length - 1].close;
      const atr = calculateATR(candles, this.atrPeriod);
      
      // ストップロス計算（ATRベース）
      const stopPrice = currentPrice + atr * this.stopLossFactor; // 上に配置（売り戦略なので）
      
      // リスク計算用の簡易関数
      const positionSize = this.calculatePositionSize(accountBalance, currentPrice, stopPrice);
      
      // 売りシグナル（簡略化のためデモとして売りシグナルを生成）
      signals.push({
        symbol: this.symbol,
        type: OrderType.MARKET,
        side: OrderSide.SELL,
        amount: positionSize,
        timestamp: Date.now()
      });
    }
    
    return signals;
  }
  
  /**
   * リスクベースのポジションサイズを計算する
   * @param accountBalance 口座残高
   * @param entryPrice エントリー価格
   * @param stopPrice ストップ価格
   * @returns ポジションサイズ
   */
  private calculatePositionSize(
    accountBalance: number,
    entryPrice: number,
    stopPrice: number
  ): number {
    // リスク額を計算
    const riskAmount = accountBalance * this.maxRiskPerTrade;
    
    // ストップまでの距離
    const stopDistance = Math.abs(entryPrice - stopPrice);
    
    if (stopDistance === 0) {
      return accountBalance * 0.01; // デフォルト1%
    }
    
    // リスクベースのサイズ計算
    const positionSize = riskAmount / stopDistance;
    
    // 最大ポジションサイズ制限（口座の25%まで）
    const maxPositionSize = accountBalance * 0.25;
    
    return Math.min(positionSize, maxPositionSize);
  }
}
