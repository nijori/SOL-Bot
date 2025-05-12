/**
 * データ関連モックファクトリー（ESM版）
 * TST-055: モジュールモックの一貫性向上
 * 
 * データ関連モジュールのモックを作成するファクトリー関数を提供します。
 * 一貫したモックパターンをプロジェクト全体で使用できるようにします。
 */

/**
 * DataRepositoryのモックを作成する
 * @param {Object} customImplementation カスタム実装を提供するオブジェクト
 * @returns {Object} モック化されたDataRepositoryオブジェクト
 */
export function createDataRepositoryMock(customImplementation = {}) {
  // デフォルト実装
  const defaultImplementation = {
    // 基本的なメソッド
    saveCandles: jest.fn().mockResolvedValue(true),
    loadCandles: jest.fn().mockResolvedValue([]),
    saveOrder: jest.fn().mockResolvedValue(true),
    loadOrders: jest.fn().mockResolvedValue([]),
    savePerformanceMetrics: jest.fn().mockResolvedValue(true),
    loadPerformanceMetrics: jest.fn().mockResolvedValue(null),
    deleteOldData: jest.fn().mockResolvedValue(true),

    // 補助メソッド
    getDataDirectories: jest.fn().mockReturnValue({
      dataDir: 'data',
      candlesDir: 'data/candles',
      ordersDir: 'data/orders',
      metricsDir: 'data/metrics'
    }),

    // クリーンアップ
    close: jest.fn()
  };

  // カスタム実装とデフォルト実装をマージ
  const mockImplementation = { ...defaultImplementation, ...customImplementation };

  // シングルトンインスタンスのモック
  const mockInstance = {
    ...mockImplementation,
    getInstance: jest.fn().mockReturnValue(mockInstance)
  };

  return mockInstance;
}

/**
 * ParquetDataStoreのモックを作成する
 * @param {Object} customImplementation カスタム実装を提供するオブジェクト
 * @returns {Object} モック化されたParquetDataStoreオブジェクト
 */
export function createParquetDataStoreMock(customImplementation = {}) {
  // デフォルト実装
  const defaultImplementation = {
    saveCandles: jest.fn().mockResolvedValue(true),
    loadCandles: jest.fn().mockResolvedValue([]),
    queryCandles: jest.fn().mockResolvedValue([]),
    saveMetrics: jest.fn().mockResolvedValue(true),
    loadMetrics: jest.fn().mockResolvedValue(null),
    deleteOldData: jest.fn().mockResolvedValue(true),
    ensureDirectoriesExist: jest.fn(),
    close: jest.fn()
  };

  // カスタム実装とデフォルト実装をマージ
  return { ...defaultImplementation, ...customImplementation };
}

/**
 * MultiTimeframeDataFetcherのモックを作成する
 * @param {Object} customImplementation カスタム実装を提供するオブジェクト
 * @returns {Object} モック化されたMultiTimeframeDataFetcherオブジェクト
 */
export function createMultiTimeframeDataFetcherMock(customImplementation = {}) {
  // デフォルト実装
  const defaultImplementation = {
    fetchAndSaveTimeframe: jest.fn().mockResolvedValue(true),
    fetchAllTimeframes: jest.fn().mockResolvedValue({
      '1m': true,
      '15m': true,
      '1h': true,
      '1d': true
    }),
    startAllScheduledJobs: jest.fn(),
    startScheduledJob: jest.fn(), 
    stopScheduledJob: jest.fn(),
    stopAllScheduledJobs: jest.fn(),
    close: jest.fn()
  };

  // カスタム実装とデフォルト実装をマージ
  return { ...defaultImplementation, ...customImplementation };
}

/**
 * RealTimeDataProcessorのモックを作成する
 * @param {Object} customImplementation カスタム実装を提供するオブジェクト
 * @returns {Object} モック化されたRealTimeDataProcessorオブジェクト
 */
export function createRealTimeDataProcessorMock(customImplementation = {}) {
  // デフォルト実装
  const defaultImplementation = {
    processData: jest.fn(),
    getBuffer: jest.fn().mockReturnValue([]),
    clearBuffer: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    removeAllListeners: jest.fn()
  };

  // カスタム実装とデフォルト実装をマージ
  return { ...defaultImplementation, ...customImplementation };
}

/**
 * すべてのデータ関連モジュールをモック化する
 * @param {jest} jestInstance - Jestインスタンス
 */
export function mockAllDataModules(jestInstance) {
  const mockDataRepository = createDataRepositoryMock();
  const mockParquetDataStore = createParquetDataStoreMock();
  const mockMultiTimeframeDataFetcher = createMultiTimeframeDataFetcherMock();
  const mockRealTimeDataProcessor = createRealTimeDataProcessorMock();

  // シングルトンモック
  jestInstance.mock('../../data/dataRepository.js', () => ({
    DataRepository: jest.fn().mockImplementation(() => mockDataRepository),
    dataRepository: mockDataRepository
  }));

  jestInstance.mock('../../data/parquetDataStore.js', () => ({
    ParquetDataStore: jest.fn().mockImplementation(() => mockParquetDataStore)
  }));

  jestInstance.mock('../../data/MultiTimeframeDataFetcher.js', () => ({
    MultiTimeframeDataFetcher: jest.fn().mockImplementation(() => mockMultiTimeframeDataFetcher),
    Timeframe: {
      MINUTE_1: '1m',
      MINUTE_15: '15m',
      HOUR_1: '1h',
      DAY_1: '1d'
    }
  }));

  jestInstance.mock('../../data/RealTimeDataProcessor.js', () => ({
    RealTimeDataProcessor: jest.fn().mockImplementation(() => mockRealTimeDataProcessor),
    RealTimeDataType: {
      CANDLE: 'candle',
      TRADE: 'trade',
      ORDERBOOK: 'orderbook',
      TICKER: 'ticker'
    }
  }));
}

// デフォルトエクスポート
export default {
  createDataRepositoryMock,
  createParquetDataStoreMock,
  createMultiTimeframeDataFetcherMock,
  createRealTimeDataProcessorMock,
  mockAllDataModules
}; 