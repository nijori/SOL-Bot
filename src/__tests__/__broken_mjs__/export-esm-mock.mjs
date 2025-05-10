/**
 * REF-028: ESM環境用Jestモックヘルパー
 *
 * このファイルはESM環境でJestモックを適切に動作させるためのヘルパー関数を提供します。
 * CommonJSとESMの違いを吸収し、テストコードのモック定義を簡素化します。
 */

import { jest } from '@jest/globals';

/**
 * ESM環境でモジュールをモック化するヘルパー関数
 *
 * @param {string} modulePath モック対象のモジュールパス
 * @param {Function} factory モック実装を返す関数
 * @param {Object} options オプション設定（virtual: trueなど）
 */
export function mockModule(modulePath, factory, options = {}) {
  // モジュールパスに.js拡張子を追加（ESM要件）
  const normalizedPath = modulePath.endsWith('.js') ? modulePath : `${modulePath}.js`;

  // ESM環境でのjest.mock呼び出し
  jest.mock(
    normalizedPath,
    () => {
      // factory関数から実装を取得
      const implementation = factory();

      // ESMフラグを追加
      return {
        __esModule: true,
        ...implementation
      };
    },
    options
  );
}

/**
 * モック実装を返すファクトリ関数を作成
 *
 * @param {string} className モック化するクラス名
 * @param {Object} methodMocks メソッドのモック実装
 * @returns {Object} モック実装を含むオブジェクト
 */
export function createMockFactory(className, methodMocks = {}) {
  return () => {
    // クラスのモック実装
    const mockClass = jest.fn().mockImplementation(() => {
      // インスタンスメソッドのモック
      const instance = {};

      // 指定されたメソッドのモック実装を設定
      Object.entries(methodMocks).forEach(([methodName, implementation]) => {
        if (typeof implementation === 'function') {
          // 関数の場合はそのまま使用
          instance[methodName] = implementation;
        } else {
          // 関数以外の場合はjest.fnでラップ
          instance[methodName] = jest.fn().mockImplementation(implementation);
        }
      });

      return instance;
    });

    // 名前付きエクスポートとデフォルトエクスポートの両方に対応
    return {
      [className]: mockClass,
      default: mockClass
    };
  };
}

/**
 * シンプルなモック実装を作成（メソッドの返り値を指定）
 *
 * @param {string} className モック化するクラス名
 * @param {Object} methodReturns メソッドの返り値マップ
 * @returns {Object} モック実装
 */
export function createSimpleMock(className, methodReturns = {}) {
  // メソッドの返り値をモック関数に変換
  const methodMocks = Object.entries(methodReturns).reduce((acc, [methodName, returnValue]) => {
    acc[methodName] = jest.fn().mockReturnValue(returnValue);
    return acc;
  }, {});

  return createMockFactory(className, methodMocks)();
}

/**
 * モジュール内の複数のクラスをモック化
 *
 * @param {Object} classFactories クラス名とファクトリ関数のマップ
 * @returns {Object} 複数クラスのモック実装
 */
export function createMultiMock(classFactories) {
  return () => {
    const mocks = {};

    // 各クラスのモック実装を生成して統合
    Object.entries(classFactories).forEach(([className, factory]) => {
      if (typeof factory === 'function') {
        // ファクトリ関数の場合はそのまま使用
        const mockImpl = factory();
        mocks[className] = mockImpl[className] || mockImpl.default;
      } else {
        // ファクトリでない場合は単純なモックを作成
        mocks[className] = jest.fn();
      }
    });

    return mocks;
  };
}
