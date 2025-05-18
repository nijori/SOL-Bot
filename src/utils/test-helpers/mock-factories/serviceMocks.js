/**
 * サービスモジュール用モックファクトリー関数（CommonJS版）
 * TST-055: モジュールモックの一貫性向上
 * 
 * @jest/globalsからのrequireと標準化されたjest.mockパターンを使用した
 * 一貫性のあるサービスモックファクトリー関数を提供します。
 */

// CommonJS環境でjestを取得
const { jest } = require('@jest/globals');

/**
 * ロガーモックの作成
 * @returns {object} モック化されたロガーオブジェクト
 */
function createLoggerMock() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    metrics: {
      increment: jest.fn(),
      gauge: jest.fn(),
      timing: jest.fn()
    }
  };
}

/**
 * パラメータサービスモックの作成
 * @param {object} customParams カスタムパラメータオブジェクト
 * @returns {object} モック化されたパラメータサービスオブジェクト
 */
function createParameterServiceMock(customParams = {}) {
  const defaultParams = {
    // トレーディングパラメータ
    getTradingParameters: jest.fn().mockReturnValue({
      maxPositions: 3,
      maxPositionValue: 1000,
      riskPerTrade: 0.01,
      ...customParams.tradingParams
    }),
    
    // 戦略パラメータ
    getStrategyParameters: jest.fn().mockReturnValue({
      defaultEma: 20,
      atrPeriod: 14,
      atrMultiplier: 2.0,
      entryThreshold: 0.02,
      ...customParams.strategyParams
    }),

    // 市場環境パラメータ
    getMarketParameters: jest.fn().mockReturnValue({
      volatilityThreshold: 0.05,
      trendStrengthThreshold: 0.6,
      rangeDetectionPeriod: 24,
      ...customParams.marketParams
    }),

    // トレンド戦略パラメータ
    getTrendParameters: jest.fn().mockReturnValue({
      emaPeriod: 50,
      trendConfirmationPeriod: 10,
      profitTarget: 0.05,
      stopLoss: 0.02,
      ...customParams.trendParams
    }),

    // カスタムパラメータ取得  
    getCustomParameter: jest.fn().mockImplementation((name, defaultValue) => {
      return customParams[name] !== undefined ? customParams[name] : defaultValue;
    }),

    // システム設定
    getSystemConfig: jest.fn().mockReturnValue({
      environment: 'test',
      debug: true,
      logLevel: 'info',
      enabledExchanges: ['binance', 'kucoin'],
      ...customParams.systemConfig
    })
  };

  return defaultParams;
}

/**
 * DBサービスモックの作成
 * @returns {object} モック化されたDBサービスオブジェクト
 */
function createDbServiceMock() {
  return {
    query: jest.fn().mockResolvedValue([]),
    execute: jest.fn().mockResolvedValue({ affectedRows: 1 }),
    insertOne: jest.fn().mockResolvedValue({ insertId: 1 }),
    findOne: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    updateOne: jest.fn().mockResolvedValue({ affectedRows: 1 }),
    deleteOne: jest.fn().mockResolvedValue({ affectedRows: 1 }),
    transaction: jest.fn().mockImplementation(async (callback) => {
      try {
        return await callback();
      } catch (error) {
        throw error;
      }
    }),
    close: jest.fn().mockResolvedValue(true)
  };
}

/**
 * 取引所APIサービスモックの作成
 * @param {object} customImplementation カスタム実装
 * @returns {object} モック化された取引所APIオブジェクト
 */
function createExchangeApiMock(customImplementation = {}) {
  // 基本実装
  const defaultImplementation = {
    // 市場データ取得
    fetchTicker: jest.fn().mockResolvedValue({
      symbol: 'TEST/USDT',
      bid: 100,
      ask: 101,
      last: 100.5,
      volume: 1000,
      timestamp: Date.now()
    }),
    
    fetchOrderBook: jest.fn().mockResolvedValue({
      symbol: 'TEST/USDT',
      bids: [[100, 10], [99, 20]],
      asks: [[101, 15], [102, 25]],
      timestamp: Date.now()
    }),
    
    fetchOHLCV: jest.fn().mockResolvedValue([
      [Date.now() - 60000, 100, 101, 99, 100.5, 100],
      [Date.now(), 100.5, 102, 100, 101.5, 200]
    ]),
    
    // 注文管理
    createOrder: jest.fn().mockResolvedValue({
      id: 'order123',
      symbol: 'TEST/USDT',
      type: 'limit',
      side: 'buy',
      price: 100,
      amount: 1,
      status: 'open',
      timestamp: Date.now()
    }),
    
    cancelOrder: jest.fn().mockResolvedValue({
      id: 'order123',
      status: 'canceled'
    }),
    
    fetchOrder: jest.fn().mockResolvedValue({
      id: 'order123',
      symbol: 'TEST/USDT',
      type: 'limit',
      side: 'buy',
      price: 100,
      amount: 1,
      filled: 0,
      status: 'open',
      timestamp: Date.now()
    }),
    
    fetchOrders: jest.fn().mockResolvedValue([]),
    fetchOpenOrders: jest.fn().mockResolvedValue([]),
    
    // アカウント情報
    fetchBalance: jest.fn().mockResolvedValue({
      total: { USDT: 10000, BTC: 0.1 },
      free: { USDT: 5000, BTC: 0.05 },
      used: { USDT: 5000, BTC: 0.05 }
    }),
    
    fetchPositions: jest.fn().mockResolvedValue([])
  };
  
  // ユーザー指定の実装とデフォルト実装をマージ
  return {
    ...defaultImplementation,
    ...customImplementation
  };
}

/**
 * すべてのサービスに対して標準モックを登録するヘルパー関数
 * @param {jest} jestInstance - Jestインスタンス
 */
function mockAllServices(jestInstance) {
  try {
    // ロガー
    jestInstance.mock('../../services/logger.js', () => ({
      logger: createLoggerMock()
    }));
    
    // パラメータサービス
    jestInstance.mock('../../services/parameterService.js', () => ({
      parameterService: createParameterServiceMock()
    }));
    
    // DBサービス
    jestInstance.mock('../../services/dbService.js', () => ({
      dbService: createDbServiceMock()
    }));
    
    // 取引所API
    jestInstance.mock('../../services/exchangeService.js', () => ({
      exchangeService: {
        getExchange: jest.fn().mockReturnValue(createExchangeApiMock())
      }
    }));
  } catch (error) {
    console.error('サービスモックのセットアップに失敗しました:', error);
  }
}

// CommonJSエクスポート
module.exports = {
  createLoggerMock,
  createParameterServiceMock,
  createDbServiceMock,
  createExchangeApiMock,
  mockAllServices
}; 