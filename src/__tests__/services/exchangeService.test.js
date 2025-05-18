// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

const { ExchangeService } = require('../../services/exchangeService');
const { Types, OrderSide, OrderType } = require('../../core/types');

// モックロガーを作成して警告を抑制
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('ExchangeService', () => {
  describe('OCO対応キーのテスト', () => {
    test('標準的なOCOキー名（createOCOOrder）を検出できる', () => {
      // ExchangeServiceのプロトタイプを直接モックして、手動でプロパティをセットする
      const service = new ExchangeService();
      service['isInitialized'] = true;
      service['exchange'] = {
        has: {
          createOCOOrder: true,
          fetchOHLCV: true
        },
        name: 'BinanceMock'
      };

      expect(service.supportsOCO()).toBe(true);
      expect(service.supportsFeature('createOCOOrder')).toBe(true);
      expect(service.supportsFeature('createOCO')).toBe(true);
    });

    test('代替OCOキー名（createOCO）を検出できる', () => {
      const service = new ExchangeService();
      service['isInitialized'] = true;
      service['exchange'] = {
        has: {
          createOCO: true,
          fetchOHLCV: true
        },
        name: 'KuCoinMock'
      };

      expect(service.supportsOCO()).toBe(true);
      expect(service.supportsFeature('createOCOOrder')).toBe(true);
      expect(service.supportsFeature('createOCO')).toBe(true);
    });

    test('OCO注文をサポートしない取引所を正しく判定できる', () => {
      const service = new ExchangeService();
      service['isInitialized'] = true;
      service['exchange'] = {
        has: {
          fetchOHLCV: true
        },
        name: 'BitfinexMock'
      };

      expect(service.supportsOCO()).toBe(false);
      expect(service.supportsFeature('createOCOOrder')).toBe(false);
      expect(service.supportsFeature('createOCO')).toBe(false);
    });
  });
}); 