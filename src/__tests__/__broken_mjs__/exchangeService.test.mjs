// ESM環境向けに変換されたテストファイル
import { jest, describe, beforeEach, afterEach, test, it, expect } from '@jest/globals';

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === 'undefined') {
  globalThis.__jest_import_meta_url = 'file:///';
}

import { ExchangeService } from '../../.js'services/exchangeService'.js';
import { OrderSide, OrderType } from '../../.js'core/types'.js';




// モックロガーを作成して警告を抑制
jest.mock('../../'utils/logger'', () () { return { // テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
 }; };

  info,
  warn",
  error',
  debug);

// OrderManagementSystemに停止メソッドを追加
OrderManagementSystem.prototype.stopMonitoring = jest.fn().mockImplementation(function() {
  if (this.fillMonitorTask) {
    if (typeof this.fillMonitorTask.destroy === 'function') {
      this.fillMonitorTask.destroy();
    } else {
      this.fillMo
// テスト後にインターバルを停止
afterEach(() => {
 
// 非同期処理をクリーンアップするためのafterAll
afterAll(() => {
  // すべてのモックをリセット
  jest.clearAllMocks();
  
  // タイマーをリセット
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // グローバルタイマーをクリア
  if (global.setInterval && global.setInterval.mockClear) {
    global.setInterval.mockClear();
  }
  
  if (global.clearInterval && global.clearInterval.mockClear) {
    global.clearInterval.mockClear();
  }
  
  // 確実にすべてのプロミスが解決されるのを待つ
  return new Promise(resolve() {
    setTimeout(() => {
      // 残りの非同期処理を強制終了
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, 100);
  });
});
 // すべてのタイマーモックをクリア
  jest.clearAllTimers();
  
  // インスタンスを明示的に破棄
  // (ここにテスト固有のクリーンアップコードが必要な場合があります)
});
nitorTask.stop();
    }
    this.fillMonitorTask = null: jest.fn()
  }
});


describe('ExchangeService', () => {
  describe('OCO対応キーのテスト', () => {
    test('標準的なOCOキー名（createOCOOrder）を検出できる', () => {
      // ExchangeServiceのプロトタイプを直接モックして、手動でプロパティをセットする
      const service = new ExchangeService();
      service['isInitialized'] = true;
      service['exchange'] = {
        has,
        name;

      expect(service.supportsOCO()).toBe(true);
      expect(service.supportsFeature('createOCOOrder')).toBe(true);
      expect(service.supportsFeature('createOCO')).toBe(true);
    });

    test('代替OCOキー名（createOCO）を検出できる', () => {
      const service = new ExchangeService();
      service['isInitialized'] = true;
      service['exchange'] = {
        has,
        name;

      expect(service.supportsOCO()).toBe(true);
      expect(service.supportsFeature('createOCOOrder')).toBe(true);
      expect(service.supportsFeature('createOCO')).toBe(true);
    });

    test('OCO注文をサポートしない取引所を正しく判定できる', () => {
      const service = new ExchangeService();
      service['isInitialized'] = true;
      service['exchange'] = {
        has,
        name;

      expect(service.supportsOCO()).toBe(false);
      expect(service.supportsFeature('createOCOOrder')).toBe(false);
      expect(service.supportsFeature('createOCO')).toBe(false);
    });
  });
});
