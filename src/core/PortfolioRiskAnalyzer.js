/**
 * ポートフォリオリスク分析モジュール
 * multiSymbolTradingEngineから分離
 */

// @ts-nocheck
const { calculatePearsonCorrelation } = require('../utils/mathUtils');
const logger = require('../utils/logger').default;

class PortfolioRiskAnalyzer {
  constructor(options = {}) {
    this.correlationMatrix = {};
    this.lastCorrelationUpdate = 0;
    this.correlationUpdateInterval = 24 * 60 * 60 * 1000; // 24時間
    this.quietMode = options.quiet || false;
  }

  /**
   * ポートフォリオリスク分析
   */
  analyzePortfolioRisk(engines, allocationWeights) {
    // 各シンボルのポジションと価値を取得
    const positionsBySymbol = {};
    let totalPortfolioValue = 0;

    for (const [symbol, engine] of engines) {
      const positions = engine.getPositions();
      const equity = engine.getEquity();
      
      positionsBySymbol[symbol] = {
        long: positions.filter(p => p.side === 'buy').reduce((sum, p) => sum + p.amount, 0),
        short: positions.filter(p => p.side === 'sell').reduce((sum, p) => sum + p.amount, 0),
        value: equity
      };
      
      totalPortfolioValue += equity;
    }

    // VaR計算（簡易版）
    const valueAtRisk = this.calculateVaR(positionsBySymbol, totalPortfolioValue);
    
    // 集中リスク計算
    const concentrationRisk = this.calculateConcentrationRisk(positionsBySymbol, totalPortfolioValue);
    
    // 相関リスク計算
    const correlationRisk = this.calculateCorrelationRisk(allocationWeights);

    return {
      valueAtRisk,
      expectedShortfall: valueAtRisk * 1.3, // 簡易的な期待ショートフォール
      concentrationRisk,
      correlationRisk,
      stressTestResults: [
        { scenario: 'market_crash', impact: valueAtRisk * 2 },
        { scenario: 'liquidity_crisis', impact: valueAtRisk * 1.5 }
      ]
    };
  }

  /**
   * VaR計算（簡易版）
   */
  calculateVaR(positionsBySymbol, totalValue) {
    if (totalValue === 0) return 0;
    
    // 各ポジションのリスクを合計（簡易計算）
    let totalRisk = 0;
    for (const [symbol, position] of Object.entries(positionsBySymbol)) {
      const positionRisk = (Math.abs(position.long) + Math.abs(position.short)) * 0.02; // 2%のリスク想定
      totalRisk += positionRisk;
    }
    
    return Math.min(totalRisk, totalValue * 0.1); // 最大10%のVaR
  }

  /**
   * 集中リスク計算
   */
  calculateConcentrationRisk(positionsBySymbol, totalValue) {
    if (totalValue === 0) return 0;
    
    // 最大ポジションの比率を計算
    let maxPositionRatio = 0;
    for (const position of Object.values(positionsBySymbol)) {
      const positionRatio = position.value / totalValue;
      maxPositionRatio = Math.max(maxPositionRatio, positionRatio);
    }
    
    // 集中度が高いほどリスクが高い
    return maxPositionRatio > 0.5 ? (maxPositionRatio - 0.5) * 2 : 0;
  }

  /**
   * 相関リスク計算
   */
  calculateCorrelationRisk(allocationWeights) {
    const symbols = Object.keys(allocationWeights);
    if (symbols.length < 2) return 0;
    
    let totalCorrelationRisk = 0;
    let pairCount = 0;
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const symbolA = symbols[i];
        const symbolB = symbols[j];
        
        const correlation = this.correlationMatrix[symbolA] && this.correlationMatrix[symbolA][symbolB] || 0;
        const weightProduct = allocationWeights[symbolA] * allocationWeights[symbolB];
        
        // 高い相関と大きな配分の組み合わせはリスクが高い
        totalCorrelationRisk += Math.abs(correlation) * weightProduct;
        pairCount++;
      }
    }
    
    return pairCount > 0 ? totalCorrelationRisk / pairCount : 0;
  }

  /**
   * 高相関ペアを取得
   */
  getHighlyCorrelatedPairs(threshold) {
    const pairs = [];
    const symbols = Object.keys(this.correlationMatrix);
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const symbolA = symbols[i];
        const symbolB = symbols[j];
        const correlation = this.correlationMatrix[symbolA] && this.correlationMatrix[symbolA][symbolB];
        
        if (correlation && Math.abs(correlation) > threshold) {
          pairs.push([symbolA, symbolB]);
        }
      }
    }
    
    return pairs;
  }

  /**
   * 相関行列を更新
   */
  updateCorrelationMatrix(engines) {
    const now = Date.now();
    if (now - this.lastCorrelationUpdate < this.correlationUpdateInterval) {
      return; // 更新間隔に達していない
    }

    const symbols = Array.from(engines.keys());
    const returns = {};

    // 各シンボルのリターンデータを取得
    symbols.forEach((symbol) => {
      const engine = engines.get(symbol);
      // 簡易的にエクイティの変化率を使用
      const equity = engine.getEquity();
      const previousEquity = this.previousEquity && this.previousEquity[symbol] || equity;
      const returnRate = previousEquity !== 0 ? (equity - previousEquity) / previousEquity : 0;
      
      if (!returns[symbol]) returns[symbol] = [];
      returns[symbol].push(returnRate);
      
      // 過去のエクイティを保存
      if (!this.previousEquity) this.previousEquity = {};
      this.previousEquity[symbol] = equity;
    });

    // 相関行列を計算
    for (let i = 0; i < symbols.length; i++) {
      const symbolA = symbols[i];
      if (!this.correlationMatrix[symbolA]) {
        this.correlationMatrix[symbolA] = {};
      }

      for (let j = 0; j < symbols.length; j++) {
        const symbolB = symbols[j];
        
        if (i === j) {
          this.correlationMatrix[symbolA][symbolB] = 1.0;
        } else if (returns[symbolA] && returns[symbolB] && 
                   returns[symbolA].length > 1 && returns[symbolB].length > 1) {
          try {
            const correlation = calculatePearsonCorrelation(returns[symbolA], returns[symbolB]);
            this.correlationMatrix[symbolA][symbolB] = correlation;
          } catch (error) {
            this.correlationMatrix[symbolA][symbolB] = 0;
          }
        } else {
          this.correlationMatrix[symbolA][symbolB] = 0;
        }
      }
    }

    this.lastCorrelationUpdate = now;
    
    if (!this.quietMode) {
      logger.info('[PortfolioRiskAnalyzer] 相関行列を更新しました');
    }
  }

  /**
   * 相関行列を取得
   */
  getCorrelationMatrix() {
    return { ...this.correlationMatrix };
  }
}

module.exports = { PortfolioRiskAnalyzer }; 