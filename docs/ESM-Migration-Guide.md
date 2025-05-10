# ESM環境でのJestモック対応ガイド

## 概要

このドキュメントは、ESモジュール（ESM）環境でJestのモック機能を適切に使用するためのガイドです。CommonJSからESMへの移行に伴い、Jestのモック関数の使用方法が変わるため、この変更に対応するための手順とベストプラクティスを提供します。

## 目次

1. [ESMとJestの互換性](#esmとjestの互換性)
2. [変換スクリプトの使用方法](#変換スクリプトの使用方法)
3. [モックヘルパーの使用方法](#モックヘルパーの使用方法)
4. [CommonJSからESMへの変換例](#commonjsからesmへの変換例)
5. [よくある問題と解決策](#よくある問題と解決策)
6. [ベストプラクティス](#ベストプラクティス)

## ESMとJestの互換性

ESMとJestの互換性には以下の主な違いがあります：

1. **モジュールの静的解析**: ESMはモジュールを静的に解析するため、動的なモック置き換えが制限されます
2. **jest.mockの配置**: ESMではjest.mock呼び出しはファイルのトップレベルに配置する必要があります
3. **ファイル拡張子**: ESMでは相対インポートに拡張子（.js）が必要です
4. **\_\_esModuleフラグ**: ESMモックには`__esModule: true`を含める必要があります
5. **パス指定**: ESMモックではパスの正規化とスラッシュの扱いに注意が必要です

## 変換スクリプトの使用方法

`fix-jest-mocks-for-esm.js`スクリプトを使用して、既存のテストファイルのモック部分をESM対応に変換できます：

```bash
# 個別のスクリプト実行
npm run fix:jest-mocks

# 他のESM修正と合わせて実行
npm run fix:esm:all
```

このスクリプトは以下の修正を行います：

1. jest.mock呼び出しの修正
2. モック実装の適切な構文への変換
3. モックファイルのESM形式への変換
4. setupJest.mjsファイルの修正

## モックヘルパーの使用方法

`src/__tests__/utils/export-esm-mock.mjs`にあるヘルパー関数を使用することで、ESM環境でのモック作成が簡単になります：

```javascript
import { mockModule, createMockFactory } from '../utils/export-esm-mock.mjs';

// モジュールのモック化
mockModule(
  '../../strategies/trendStrategy',
  () => ({
    TrendStrategy: jest.fn().mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ signals: [] })
    }))
  }),
  { virtual: true }
);

// モックファクトリの使用
const trendStrategyMock = createMockFactory('TrendStrategy', {
  execute: jest.fn().mockResolvedValue({ signals: [] })
});

mockModule('../../strategies/trendStrategy', trendStrategyMock);
```

## CommonJSからESMへの変換例

### 変換前 (CommonJS)

```javascript
// テストファイル内のモック定義
jest.mock('../../strategies/trendStrategy', () => ({
  TrendStrategy: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ signals: [] })
  }))
}));

// モックファイル
module.exports = {
  TrendStrategy: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ signals: [] })
  }))
};

// モックの使用
const mockTrendStrategy = require('../../strategies/trendStrategy');
```

### 変換後 (ESM)

```javascript
// テストファイル内のモック定義
jest.mock('../../strategies/trendStrategy.js', () => ({
  __esModule: true,
  TrendStrategy: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ signals: [] })
  }))
}));

// モックファイル
import { jest } from '@jest/globals';

export const TrendStrategy = jest.fn().mockImplementation(() => ({
  execute: jest.fn().mockResolvedValue({ signals: [] })
}));

// モックの使用
import { TrendStrategy } from '../../strategies/trendStrategy.js';
```

## よくある問題と解決策

### 1. "Error: Jest: SyntaxError: Cannot use import statement outside a module"

**解決策**:

- Node.jsを`--experimental-vm-modules`フラグで実行
- package.jsonに`"type": "module"`を設定

### 2. "ReferenceError: jest is not defined"

**解決策**:

- ファイルの先頭に`import { jest } from '@jest/globals';`を追加

### 3. "Error: Cannot find module"

**解決策**:

- ファイルパスに`.js`拡張子を追加（例: `'../../strategies/trendStrategy.js'`）
- パス内の連続したスラッシュを修正（`'../../'core/types'` → `'../../core/types.js'`）

### 4. "Property/Module 'X' does not exist in type 'Y'"

**解決策**:

- モックオブジェクトに`__esModule: true`フラグを追加

### 5. "Jest did not exit one second after the test run has completed"

**解決策**:

- テスト終了時に非同期処理をクリーンアップ
- `--detectOpenHandles`フラグでオープンハンドルを検出
- afterAll/afterEachでリソースを適切にクリーンアップ

## ベストプラクティス

1. **jestオブジェクトの明示的なインポート**:

   ```javascript
   import { jest, describe, it, expect } from '@jest/globals';
   ```

2. **モックファイルをESM形式で作成**:

   ```javascript
   // module.exports ではなく export const を使用
   export const MyClass = jest.fn().mockImplementation(...);
   ```

3. **ファイルパスに.js拡張子を追加**:

   ```javascript
   jest.mock('../../services/myService.js', ...);
   import { MyService } from '../../services/myService.js';
   ```

4. **関数モックの適切な定義**:

   ```javascript
   // x.mockResolvedValue ではなく
   execute: jest.fn().mockResolvedValue(...)
   ```

5. **リソースの明示的なクリーンアップ**:

   ```javascript
   afterEach(() => {
     jest.clearAllMocks();
   });

   afterAll(async () => {
     await global.cleanupAsyncResources();
   });
   ```

6. **モックヘルパーの活用**:
   ```javascript
   import { mockModule, createMockFactory } from '../utils/export-esm-mock.mjs';
   ```

このガイドに従うことで、ESM環境でのJestテストの安定性と信頼性が向上します。問題が発生した場合は、まず上記の「よくある問題と解決策」セクションを参照し、それでも解決しない場合は開発チームに相談してください。
