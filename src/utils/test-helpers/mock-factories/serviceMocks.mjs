/**
 * サービスモジュール用モックファクトリー関数（ESM版）
 * TST-055: モジュールモックの一貫性向上
 * TST-057: ESMテスト環境の修正と安定化
 * 
 * @jest/globalsからのimportと標準化されたjest.mockパターンを使用した
 * 一貫性のあるサービスモックファクトリー関数を提供します。
 */

// グローバルjestオブジェクトを使用
const jest = global.jest;

/**
 * ロガーモックの作成
 * @returns {object} モック化されたロガーオブジェクト
 */
export function createLoggerMock() {
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
 * @param {Object} [customParameters={}] - カスタムパラメータオブジェクト
 * @returns {Object} モック化されたパラメータサービス
 */
export function createParameterServiceMock(customParameters = {}) {
  const defaultParameters = {
    // 市場パラメータ
    'ATR_PERIOD': 14,
    'SHORT_TERM_EMA': 9,
    'LONG_TERM_EMA': 21,
    'RSI_PERIOD': 14,
    'DONCHIAN_PERIOD': 20,
    
    // 戦略パラメータ
    'trendFollowStrategy.trailingStopFactor': 1.5,
    'trendFollowStrategy.atrMultiplier': 2.0,
    'trendFollowStrategy.breakoutPeriod': 20,
    'trendFollowStrategy.maxPositions': 3,
    
    'meanRevertStrategy.oversoldThreshold': 30,
    'meanRevertStrategy.overboughtThreshold': 70,
    'meanRevertStrategy.meanReversionPeriod': 10,
    'meanRevertStrategy.takeProfitAtr': 2.0,
    
    'rangeStrategy.gridAtrMultiplier': 0.5,
    'rangeStrategy.rangeMultiplier': 1.0,
    'rangeStrategy.minSpreadPercentage': 0.2,
    'rangeStrategy.escapeThreshold': 0.05,
    
    // リスクパラメータ
    'MAX_RISK_PER_TRADE': 0.01,
    'MAX_DAILY_LOSS': 0.05
  };
  
  // デフォルトとカスタムパラメータをマージ
  const parameters = { ...defaultParameters, ...customParameters };
  
  return {
    get: jest.fn().mockImplementation((key, defaultValue) => {
      return parameters[key] !== undefined ? parameters[key] : defaultValue;
    }),
    
    getMarketParameters: jest.fn().mockReturnValue({
      ATR_PERIOD: parameters.ATR_PERIOD,
      SHORT_TERM_EMA: parameters.SHORT_TERM_EMA,
      LONG_TERM_EMA: parameters.LONG_TERM_EMA,
      RSI_PERIOD: parameters.RSI_PERIOD
    }),
    
    getTrendParameters: jest.fn().mockReturnValue({
      DONCHIAN_PERIOD: parameters.DONCHIAN_PERIOD,
      ADX_PERIOD: 14,
      ADX_THRESHOLD: 25
    }),
    
    getRangeParameters: jest.fn().mockReturnValue({
      RANGE_PERIOD: 20,
      GRID_LEVELS_MIN: 3,
      GRID_LEVELS_MAX: 10,
      POSITION_SIZING: 0.1
    }),
    
    getRiskParameters: jest.fn().mockReturnValue({
      MAX_RISK_PER_TRADE: parameters.MAX_RISK_PER_TRADE,
      MAX_DAILY_LOSS: parameters.MAX_DAILY_LOSS
    }),
    
    // パラメータ設定
    set: jest.fn().mockImplementation((key, value) => {
      parameters[key] = value;
      return true;
    }),
    
    // 環境変数からのロード
    loadFromEnv: jest.fn(),
    
    // ファイルからのロード
    loadFromFile: jest.fn()
  };
}

/**
 * データベースサービスモックの作成
 * @returns {Object} モック化されたDBサービス
 */
export function createDbServiceMock() {
  return {
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    query: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue({ insertId: 1 }),
    update: jest.fn().mockResolvedValue({ affectedRows: 1 }),
    delete: jest.fn().mockResolvedValue({ affectedRows: 1 }),
    getConnection: jest.fn().mockReturnValue({
      beginTransaction: jest.fn().mockResolvedValue(true),
      commit: jest.fn().mockResolvedValue(true),
      rollback: jest.fn().mockResolvedValue(true),
      release: jest.fn()
    })
  };
}

/**
 * 取引所APIサービスモックの作成
 * @param {Object} [customImplementation={}] - カスタムメソッド実装
 * @returns {Object} モック化された取引所APIサービス
 */
export function createExchangeApiMock(customImplementation = {}) {
  const defaultImpl = {
    fetchTicker: jest.fn().mockResolvedValue({
      symbol: 'TEST/USDT',
      last: 100,
      bid: 99.5,
      ask: 100.5,
      timestamp: Date.now()
    }),
    
    fetchBalance: jest.fn().mockResolvedValue({
      total: {
        USDT: 10000,
        TEST: 0
      },
      free: {
        USDT: 10000,
        TEST: 0
      },
      used: {
        USDT: 0,
        TEST: 0
      }
    }),
    
    fetchCandles: jest.fn().mockResolvedValue([
      {
        timestamp: Date.now() - 60000 * 60,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000
      },
      {
        timestamp: Date.now() - 60000 * 30,
        open: 102,
        high: 107,
        low: 101,
        close: 105,
        volume: 1500
      },
      {
        timestamp: Date.now(),
        open: 105,
        high: 110,
        low: 103,
        close: 108,
        volume: 2000
      }
    ]),
    
    createOrder: jest.fn().mockResolvedValue({
      id: `order-${Date.now()}`,
      symbol: 'TEST/USDT',
      type: 'market',
      side: 'buy',
      price: 100,
      amount: 1,
      timestamp: Date.now(),
      status: 'open'
    }),
    
    cancelOrder: jest.fn().mockResolvedValue({ id: 'order-123', status: 'canceled' }),
    
    fetchOrder: jest.fn().mockResolvedValue({
      id: 'order-123',
      symbol: 'TEST/USDT',
      type: 'market',
      side: 'buy',
      price: 100,
      amount: 1,
      filled: 1,
      remaining: 0,
      status: 'closed',
      timestamp: Date.now()
    }),
    
    fetchOpenOrders: jest.fn().mockResolvedValue([]),
    
    fetchPositions: jest.fn().mockResolvedValue([])
  };
  
  // デフォルトとカスタム実装をマージ
  return {
    ...defaultImpl,
    ...customImplementation
  };
}

/**
 * すべてのサービスを標準的にモック化するヘルパー関数
 * @param {jest} jestInstance - Jestインスタンス
 */
export function mockAllServices(jestInstance) {
  // ロガーモック
  jestInstance.mock('../../utils/logger.js', () => createLoggerMock());
  
  // パラメータサービスモック
  jestInstance.mock('../../config/parameterService.js', () => ({
    parameterService: createParameterServiceMock()
  }));
  
  // データベースモック
  jestInstance.mock('../../services/dbService.js', () => ({
    dbService: createDbServiceMock()
  }));
}

// デフォルトエクスポート
export default {
  createLoggerMock,
  createParameterServiceMock,
  createDbServiceMock,
  createExchangeApiMock,
  mockAllServices
}; 