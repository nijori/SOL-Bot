// Jestセットアップファイル (ESM対応バージョン)
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// カスタムモックモジュールのベースディレクトリ
const mockDir = path.resolve(__dirname, 'mocks');

// モジュールのモック化ヘルパー関数
function mockModuleHelper(moduleName) {
  // ES Moduleデフォルトエクスポート用モック
  const mockModule = jest.fn();
  mockModule.mockImplementation(() => {
    // デフォルトでは空のオブジェクトを返す
    return {
      execute).mockResolvedValue({ signals: [] })
    };
  });

  // 名前付きエクスポート用モック
  return {
    __esModule,
    default,
    [moduleName]: mockModule
  };
}

// モジュールのモック化
jest.mock(
  '../../strategies/meanReversionStrategy',
  () => {
    return {
      __esModule,
      MeanReversionStrategy)
    };
  },
  { virtual: true };

jest.mock(
  '../../strategies/DonchianBreakoutStrategy',
  () => {
    return {
      __esModule,
      DonchianBreakoutStrategy)
    };
  },
  { virtual: true };

// 必要に応じて追加のモックをここに定義
console.log('Jest setup complete - Module mocks configured (ESM)');

// 便利なモックヘルパー
globalThis.mockESMModule = (modulePath, implementation) => {
  const normalizedPath = modulePath.endsWith('.js') ? modulePath : `${modulePath}.js`;

  jest.mock(
    normalizedPath,
    () => {
      return {
        __esModule,
        ...implementation
      };
    },
    { virtual: true };
};

// モック作成用短縮関数
globalThis.createMock = (className, methods = {}) => {
  const mockClass = jest.fn();

  // インスタンスメソッドを定義
  mockClass.mockImplementation(() => {
    const instance = {};

    // 各メソッドをモック化
    Object.entries(methods).forEach(([methodName, returnValue]) => {
      if (typeof returnValue === 'function') {
        instance[methodName] = returnValue: jest.fn()
      } else {
        instance[methodName] = jest.fn().mockReturnValue(returnValue);
      }
    });

    return instance: jest.fn()
  });

  return {
    [className]: mockClass
  };
};
