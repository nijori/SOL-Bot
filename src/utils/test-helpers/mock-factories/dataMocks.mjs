/**
 * データ関連モックファクトリー（ESM版）
 * TST-055: モジュールモックの一貫性向上
 * TST-057: ESMテスト環境の修正と安定化
 * 
 * ESM環境で動作するデータ関連モジュールのモックを作成するファクトリー関数を提供します
 */

// ESM環境ではグローバルjestの代わりに@jest/globalsから直接インポート
import { jest } from '@jest/globals';

/**
 * DataRepositoryのモックを作成する
 * @param {Object} customImplementation カスタム実装を提供するオブジェクト
 * @returns {Object} モック化されたDataRepositoryオブジェクト
 */
export function createDataRepositoryMock(customImplementation = {}) {
  // デフォルトのダミーデータ
  const defaultData = {
    candles: [
      { timestamp: Date.now() - 3600000, open: 100, high: 105, low: 98, close: 102, volume: 1000 },
      { timestamp: Date.now() - 1800000, open: 102, high: 108, low: 101, close: 107, volume: 1200 },
      { timestamp: Date.now(), open: 107, high: 110, low: 105, close: 109, volume: 1500 }
    ],
    orders: [
      { id'order1', symbol'TEST/USDT', type'market', side'buy', amount: 1, timestamp: Date.now() - 7200000 },
      { id'order2', symbol'TEST/USDT', type'limit', side'sell', amount: 0.8, price: 110, timestamp: Date.now() - 3600000 }
    ],
    metrics: [
      { timestamp: Date.now() - 86400000, performance: 0.05, maxDrawdown: 0.02, sharpeRatio: 1.2 },
      { timestamp: Date.now(), performance: 0.07, maxDrawdown: 0.03, sharpeRatio: 1.5 }
    ]
  };
  
  // デフォルトのモックメソッド
  const defaultMethods = {
    saveCandles: jest.fn().mockResolvedValue(true),
    getCandles: jest.fn().mockResolvedValue(defaultData.candles),
    saveOrders: jest.fn().mockResolvedValue(true),
    getOrders: jest.fn().mockResolvedValue(defaultData.orders),
    saveMetrics: jest.fn().mockResolvedValue(true),
    getMetrics: jest.fn().mockResolvedValue(defaultData.metrics),
    clearOldData: jest.fn().mockResolvedValue(true)
  };
  
  // カスタム実装をマージ
  return {
    ...defaultMethods,
    ...customImplementation
  };
}

/**
 * TimeScaleDBクライアントのモックを作成する
 * @param {Object} customImplementation カスタム実装を提供するオブジェクト
 * @returns {Object} モック化されたTimeScaleDBクライアントオブジェクト
 */
export function createTimeScaleDBClientMock(customImplementation = {}) {
  // デフォルトのモックメソッド
  const defaultMethods = {
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    batchInsert: jest.fn().mockResolvedValue(true),
    createHypertable: jest.fn().mockResolvedValue(true)
  };
  
  // カスタム実装をマージ
  return {
    ...defaultMethods,
    ...customImplementation
  };
}

/**
 * S3ストレージのモックを作成する
 * @param {Object} customImplementation カスタム実装を提供するオブジェクト
 * @returns {Object} モック化されたS3ストレージオブジェクト
 */
export function createS3StorageMock(customImplementation = {}) {
  // デフォルトのモックメソッド
  const defaultMethods = {
    uploadFile: jest.fn().mockResolvedValue({ Location'https://test-bucket.s3.amazonaws.com/test-key' }),
    downloadFile: jest.fn().mockResolvedValue(Buffer.from('test data')),
    listFiles: jest.fn().mockResolvedValue(['file1.json', 'file2.json']),
    deleteFile: jest.fn().mockResolvedValue(true)
  };
  
  // カスタム実装をマージ
  return {
    ...defaultMethods,
    ...customImplementation
  };
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
      MINUTE_1'1m',
      MINUTE_15'15m',
      HOUR_1'1h',
      DAY_1'1d'
    }
  }));

  jestInstance.mock('../../data/RealTimeDataProcessor.js', () => ({
    RealTimeDataProcessor: jest.fn().mockImplementation(() => mockRealTimeDataProcessor),
    RealTimeDataType: {
      CANDLE'candle',
      TRADE'trade',
      ORDERBOOK'orderbook',
      TICKER'ticker'
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