/**
 * ParquetDataStoreのモック
 */

const mockParquetDataStore = {
  saveCandles: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(undefined)
};

class ParquetDataStore {
  constructor() {
    return mockParquetDataStore;
  }
}

// モックオブジェクトのエクスポート
module.exports = {
  ParquetDataStore,
  mockParquetDataStore
}; 