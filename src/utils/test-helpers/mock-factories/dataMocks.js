/**
 * データ関連モックファクトリー（CommonJS版）
 * TST-055: モジュールモックの一貫性向上
 * 
 * データ関連モジュールのモックを作成するファクトリー関数を提供します。
 * 一貫したモックパターンをプロジェクト全体で使用できるようにします。
 */

// CommonJS環境でjestを取得
const { jest } = require('@jest/globals');

/**
 * DataRepositoryのモックを作成する
 * @param {Object} customImplementation カスタム実装を提供するオブジェクト
 * @returns {Object} モック化されたDataRepositoryオブジェクト
 */
function createDataRepositoryMock(customImplementation = {}) {
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

    // キャンドルデータ関連
    saveCandlesBatch: jest.fn().mockResolvedValue(true),
    loadCandlesByTimeframe: jest.fn().mockResolvedValue([]),
    loadCandlesByTimeRange: jest.fn().mockResolvedValue([]),
    loadLatestCandles: jest.fn().mockResolvedValue([]),
    mergeCandleData: jest.fn().mockImplementation((existingCandles, newCandles) => {
      return [...existingCandles, ...newCandles];
    }),

    // 注文関連
    saveOrderBatch: jest.fn().mockResolvedValue(true),
    loadOrdersBySymbol: jest.fn().mockResolvedValue([]),
    loadOrdersByTimeRange: jest.fn().mockResolvedValue([]),
    loadLatestOrders: jest.fn().mockResolvedValue([]),
    updateOrderStatus: jest.fn().mockResolvedValue(true),

    // パフォーマンス指標
    savePerformanceMetricsBatch: jest.fn().mockResolvedValue(true),
    loadPerformanceMetricsByTimeRange: jest.fn().mockResolvedValue([]),
    loadLatestPerformanceMetrics: jest.fn().mockResolvedValue(null),
    calculateAggregateMetrics: jest.fn().mockResolvedValue({
      totalProfit: 0,
      winRate: 0,
      averageProfit: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      tradesCount: 0
    }),

    // 管理・最適化
    vacuumDatabase: jest.fn().mockResolvedValue(true),
    optimizeStorage: jest.fn().mockResolvedValue(true),
    validateData: jest.fn().mockResolvedValue({ valid: true, errors: [] })
  };

  // カスタム実装とデフォルト実装をマージ
  return {
    ...defaultImplementation,
    ...customImplementation
  };
}

/**
 * ParquetDataStoreのモックを作成する
 * @param {Object} customImplementation カスタム実装を提供するオブジェクト
 * @returns {Object} モック化されたParquetDataStoreオブジェクト
 */
function createParquetDataStoreMock(customImplementation = {}) {
  // デフォルト実装
  const defaultImplementation = {
    // ファイル操作
    writeData: jest.fn().mockResolvedValue(true),
    readData: jest.fn().mockResolvedValue([]),
    appendData: jest.fn().mockResolvedValue(true),
    deleteData: jest.fn().mockResolvedValue(true),
    
    // クエリ操作
    query: jest.fn().mockResolvedValue([]),
    queryByTimeRange: jest.fn().mockResolvedValue([]),
    queryLatest: jest.fn().mockResolvedValue([]),
    
    // メタデータ
    getMetadata: jest.fn().mockResolvedValue({
      rowCount: 0,
      fileSize: 0,
      lastUpdated: Date.now(),
      schema: []
    }),
    
    // ユーティリティ
    optimizeFiles: jest.fn().mockResolvedValue(true),
    validateSchema: jest.fn().mockResolvedValue(true),
    backup: jest.fn().mockResolvedValue('/path/to/backup.parquet'),
    close: jest.fn().mockResolvedValue(true)
  };

  // カスタム実装とデフォルト実装をマージ
  return {
    ...defaultImplementation,
    ...customImplementation
  };
}

/**
 * MultiTimeframeDataFetcherのモックを作成する
 * @param {Object} customImplementation カスタム実装を提供するオブジェクト
 * @returns {Object} モック化されたMultiTimeframeDataFetcherオブジェクト
 */
function createMultiTimeframeDataFetcherMock(customImplementation = {}) {
  // デフォルト実装
  const defaultImplementation = {
    // データ取得
    fetchDataForAllTimeframes: jest.fn().mockResolvedValue(true),
    fetchDataForTimeframe: jest.fn().mockResolvedValue(true),
    fetchHistoricalData: jest.fn().mockResolvedValue(true),
    
    // スケジュール管理
    scheduleAllTimeframes: jest.fn().mockReturnValue(true),
    scheduleTimeframe: jest.fn().mockReturnValue(true),
    stopAllSchedules: jest.fn().mockReturnValue(true),

    // ユーティリティ
    getRegisteredTimeframes: jest.fn().mockReturnValue(['1m', '5m', '15m', '1h', '4h', '1d']),
    getDataAvailability: jest.fn().mockReturnValue({
      '1m': { from: Date.now() - 86400000, to: Date.now() },
      '1h': { from: Date.now() - 86400000 * 30, to: Date.now() }
    }),
    
    // イベント
    on: jest.fn(),
    off: jest.fn()
  };

  // カスタム実装とデフォルト実装をマージ
  return {
    ...defaultImplementation,
    ...customImplementation
  };
}

/**
 * RealTimeDataProcessorのモックを作成する
 * @param {Object} customImplementation カスタム実装を提供するオブジェクト
 * @returns {Object} モック化されたRealTimeDataProcessorオブジェクト
 */
function createRealTimeDataProcessorMock(customImplementation = {}) {
  // デフォルト実装
  const defaultImplementation = {
    // データ処理
    processData: jest.fn().mockResolvedValue(true),
    processTickData: jest.fn().mockResolvedValue(true),
    processTradeData: jest.fn().mockResolvedValue(true),
    processOrderBookData: jest.fn().mockResolvedValue(true),
    
    // ストリーム管理
    startStream: jest.fn().mockResolvedValue(true),
    stopStream: jest.fn().mockResolvedValue(true),
    restartStream: jest.fn().mockResolvedValue(true),
    
    // ユーティリティ
    getActiveStreams: jest.fn().mockReturnValue(['BTC/USDT', 'ETH/USDT']),
    getStreamStats: jest.fn().mockReturnValue({
      messagesReceived: 100,
      messagesProcessed: 100,
      errorCount: 0,
      lastMessageTime: Date.now()
    }),
    
    // イベント
    on: jest.fn(),
    off: jest.fn()
  };

  // カスタム実装とデフォルト実装をマージ
  return {
    ...defaultImplementation,
    ...customImplementation
  };
}

/**
 * すべてのデータモジュールに対して標準モックを登録するヘルパー関数
 * @param {jest} jestInstance - Jestインスタンス
 */
function mockAllDataModules(jestInstance) {
  try {
    // データリポジトリ
    jestInstance.mock('../../data/dataRepository.js', () => ({
      DataRepository: jest.fn().mockImplementation(() => createDataRepositoryMock())
    }));
    
    // Parquetデータストア
    jestInstance.mock('../../data/parquetDataStore.js', () => ({
      ParquetDataStore: jest.fn().mockImplementation(() => createParquetDataStoreMock())
    }));
    
    // マルチタイムフレームデータフェッチャー
    jestInstance.mock('../../data/multiTimeframeDataFetcher.js', () => ({
      MultiTimeframeDataFetcher: jest.fn().mockImplementation(() => createMultiTimeframeDataFetcherMock())
    }));
    
    // リアルタイムデータプロセッサー
    jestInstance.mock('../../data/realTimeDataProcessor.js', () => ({
      RealTimeDataProcessor: jest.fn().mockImplementation(() => createRealTimeDataProcessorMock())
    }));
  } catch (error) {
    console.error('データモジュールモックのセットアップに失敗しました:', error);
  }
}

// CommonJSエクスポート
module.exports = {
  createDataRepositoryMock,
  createParquetDataStoreMock,
  createMultiTimeframeDataFetcherMock,
  createRealTimeDataProcessorMock,
  mockAllDataModules
}; 