/**
 * 資金配分管理モジュール
 * multiSymbolTradingEngineから分離
 */

// @ts-nocheck
const { volBasedAllocationWeights } = require('../indicators/marketState');
const { AllocationStrategy } = require('../types/multiSymbolTypes.js');
const logger = require('../utils/logger').default;

class AllocationManager {
  constructor(config, options = {}) {
    this.config = config;
    this.allocationWeights = {};
    this.quietMode = options.quiet || false;
    this.previousCandles = {};
    
    // 初期配分を計算
    this.calculateAllocationWeights();
  }

  /**
   * 資金配分比率を計算
   */
  calculateAllocationWeights() {
    const strategy = this.config.allocationStrategy || AllocationStrategy.EQUAL;
    const symbols = this.config.symbols;

    switch (strategy) {
      case AllocationStrategy.EQUAL:
        this.calculateEqualWeights(symbols);
        break;

      case AllocationStrategy.CUSTOM:
        this.calculateCustomWeights(symbols);
        break;

      case AllocationStrategy.VOLATILITY:
        this.calculateVolatilityWeights(symbols);
        break;

      case AllocationStrategy.MARKET_CAP:
        this.calculateMarketCapWeights(symbols);
        break;

      default:
        this.calculateEqualWeights(symbols);
    }

    this.logAllocationWeights();
  }

  /**
   * 均等配分
   */
  calculateEqualWeights(symbols) {
    const equalWeight = 1 / symbols.length;
    symbols.forEach((symbol) => {
      this.allocationWeights[symbol] = equalWeight;
    });
  }

  /**
   * カスタム配分
   */
  calculateCustomWeights(symbols) {
    const customWeights = {};
    let totalWeight = 0;

    symbols.forEach((symbol) => {
      const symbolParams = this.config.symbolParams && this.config.symbolParams[symbol];
      const weight = (symbolParams && symbolParams.weight) || 1;
      customWeights[symbol] = weight;
      totalWeight += weight;
    });

    // 合計が1になるように正規化
    symbols.forEach((symbol) => {
      this.allocationWeights[symbol] = customWeights[symbol] / totalWeight;
    });
  }

  /**
   * ボラティリティベース配分
   */
  calculateVolatilityWeights(symbols) {
    if (this.previousCandles && Object.keys(this.previousCandles).length > 0) {
      try {
        // 十分なデータがある場合はボラティリティベースの配分を計算
        this.allocationWeights = volBasedAllocationWeights(this.previousCandles);
      } catch (error) {
        // エラー時は均等配分にフォールバック
        this.calculateEqualWeights(symbols);
        if (!this.quietMode) {
          logger.error(
            `[AllocationManager] ボラティリティ配分計算エラー: ${error instanceof Error ? error.message : String(error)}`
          );
          logger.warn(
            `[AllocationManager] ボラティリティ配分計算に失敗したため均等配分を使用します`
          );
        }
      }
    } else {
      // データ不足の場合は均等配分を使用
      this.calculateEqualWeights(symbols);
      if (!this.quietMode) {
        logger.warn(
          `[AllocationManager] キャンドルデータ不足のため均等配分を使用します`
        );
      }
    }
  }

  /**
   * 時価総額ベース配分（未実装）
   */
  calculateMarketCapWeights(symbols) {
    // 実装時は時価総額データを使用
    // 現時点では簡易的に均等配分
    this.calculateEqualWeights(symbols);
    if (!this.quietMode) {
      logger.warn(`[AllocationManager] 時価総額配分は未実装のため均等配分を使用します`);
    }
  }

  /**
   * 配分比率をログ出力
   */
  logAllocationWeights() {
    if (!this.quietMode) {
      logger.info(`[AllocationManager] 資金配分比率:`);
      Object.entries(this.allocationWeights).forEach(([symbol, weight]) => {
        logger.info(`  ${symbol}: ${(weight * 100).toFixed(2)}%`);
      });
    }
  }

  /**
   * 配分比率を取得
   */
  getAllocationWeights() {
    return { ...this.allocationWeights };
  }

  /**
   * 特定シンボルの配分比率を取得
   */
  getSymbolWeight(symbol) {
    return this.allocationWeights[symbol] || 0;
  }

  /**
   * 配分比率を更新（キャンドルデータ更新時）
   */
  updateAllocationWeights(candles) {
    this.previousCandles = candles;
    
    // ボラティリティベース配分の場合のみ再計算
    if (this.config.allocationStrategy === AllocationStrategy.VOLATILITY) {
      this.calculateAllocationWeights();
    }
  }

  /**
   * シンボル用の初期残高を計算
   */
  calculateInitialBalance(symbol, baseBalance) {
    const weight = this.getSymbolWeight(symbol);
    return baseBalance * weight;
  }
}

module.exports = { AllocationManager }; 