/**
 * 平均回帰（Mean Reversion）戦略クラス
 * 過剰に伸びた価格が平均に戻る性質を利用した戦略
 * 
 * INF-032-2: 戦略ディレクトリのCommonJS変換
 */
// @ts-nocheck

// CommonJS形式のモジュールインポート
const Types = require('../core/types');
const { Candle, Order, OrderSide, OrderType, Position, StrategyType } = Types;
const { parameterService } = require('../config/parameterService');
const { calculateATR } = require('../utils/atrUtils');

/**
 * 平均回帰戦略クラス
 */
class MeanReversionStrategy {
  /**
   * コンストラクタ
   * @param {string} symbol 通貨ペアシンボル
   */
  constructor(symbol) {
    this.symbol = symbol;
    
    // パラメータの初期化
    this.rsiPeriod = parameterService.get('meanReversionStrategy.rsiPeriod', 14);
    this.rsiOverbought = parameterService.get('meanReversionStrategy.rsiOverbought', 70);
    this.rsiOversold = parameterService.get('meanReversionStrategy.rsiOversold', 30);
    this.bbPeriod = parameterService.get('meanReversionStrategy.bbPeriod', 20);
    this.bbStdDev = parameterService.get('meanReversionStrategy.bbStdDev', 2);
    this.atrPeriod = parameterService.get('meanReversionStrategy.atrPeriod', 14);
    this.takeProfitFactor = parameterService.get('meanReversionStrategy.takeProfitFactor', 1.5);
    this.stopLossFactor = parameterService.get('meanReversionStrategy.stopLossFactor', 2.0);
    this.maxRiskPerTrade = parameterService.get('risk.maxRiskPerTrade', 0.02);
  }

  /**
   * 戦略を実行する
   * @param {Array} candles ローソク足データ
   * @param {Array} positions 現在のポジション
   * @param {number} accountBalance 口座残高
   * @returns {Array} 注文シグナルの配列
   */
  execute(candles, positions, accountBalance) {
    // 簡略化した実装
    const signals = [];
    
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
   * @param {number} accountBalance 口座残高
   * @param {number} entryPrice エントリー価格
   * @param {number} stopPrice ストップ価格
   * @returns {number} ポジションサイズ
   */
  calculatePositionSize(
    accountBalance,
    entryPrice,
    stopPrice
  ) {
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

// CommonJS形式でのエクスポート
module.exports = MeanReversionStrategy;
