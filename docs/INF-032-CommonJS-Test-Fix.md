# INF-032 テスト環境のCommonJS変換対応策

## 概要

テストファイル（`__tests__/`内）のCommonJS形式への変換作業中に発生した問題と解決策をまとめた文書です。

## 現状と問題

複数のテストファイルをCommonJS形式（`import`から`require`への変換）に変更しましたが、実行時に以下の問題が発生しています：

1. `ReferenceError: Types is not defined` エラー
   - `src/core/types.ts`ファイルの実装がCommonJS環境とESM環境の両立に対応していない
   - 特に`Types`名前空間が正しくエクスポートされていない

2. モック設定の問題
   - `jest.mock()`の使い方に関するエラー
   - ファイル拡張子の扱いの違い
   - `fs.readFileSync.mockReturnValue`などのモック関数が認識されない

3. 型情報の削除後のコード互換性問題
   - TypeScriptの型情報に依存したコードがある
   - 特に複雑な型定義を使用したテストヘルパー関数の変換が困難

## 解決策

### 1. `types.ts`ファイルの修正

現在の`types.ts`の問題点：
```javascript
const TypesExport = {
  // 型定義を参照可能にするための名前空間
  Types, // <-- これがCommonJSでは未定義
  // 関数
  isNumericTimestamp,
  normalizeTimestamp,
  // 定数
  MarketEnvironment,
  // ...
};
```

修正案：
```javascript
// CommonJS環境で使用できるよう、Types名前空間も実行時オブジェクトとして定義
const Types = {
  // 定数などを含める
  OrderType,
  OrderSide,
  OrderStatus,
  // ...
};

const TypesExport = {
  Types,
  isNumericTimestamp,
  normalizeTimestamp,
  // 他の定数も個別にエクスポート
  MarketEnvironment,
  OrderType,
  OrderSide,
  // ...
};
```

### 2. テストファイルのモック設定修正

- `jest.mock()`の呼び出しを適切な形式に変更
- ファイル拡張子を省略して互換性を向上
- `fs`などのモジュールについては正しいモック関数を設定

例：
```javascript
// 変更前
jest.mock('../../services/exchangeService.js');
fs.readFileSync.mockReturnValue(mockYamlContent);

// 変更後
jest.mock('../../services/exchangeService');
(fs.readFileSync as jest.Mock).mockReturnValue(mockYamlContent);
```

#### モック関数の正しい設定方法（parameterService.test.tsでの事例）

`fs.readFileSync.mockReturnValue`が関数として認識されない問題に対する解決策：

```javascript
// 問題のあるコード
jest.mock('fs');
fs.readFileSync.mockReturnValue(mockYamlContent);

// 修正方法1: jest.fnをモック実装時に設定
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockImplementation(() => mockYamlContent)
}));

// 修正方法2: mockReturnValueの前にJavaScriptキャスト
jest.mock('fs');
const fs = require('fs');
(fs.readFileSync as jest.Mock).mockReturnValue(mockYamlContent); // TypeScriptの場合
// JavaScript変換後は次のように修正
fs.readFileSync.mockReturnValue = jest.fn().mockReturnValue(mockYamlContent);

// 修正方法3: TypeScript固有機能を使わないシンプルな実装
const mockFs = {
  readFileSync: function() { return mockYamlContent; }
};
jest.mock('fs', () => mockFs);
```

#### 実装済みのベストプラクティス（parameterService.test.jsでの成功事例）

parameterService.test.jsファイルでは、以下の方法で正常に動作するようになりました：

```javascript
// @ts-nocheck
// Jest関連のインポート
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

// 依存モジュールの読み込み
const fs = require('fs');
const path = require('path');

// モック設定
jest.mock('fs');
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// beforeEachでモックをリセットして設定
beforeEach(() => {
  // fsモックをリセット
  jest.clearAllMocks();

  // readFileSyncモックを設定
  fs.readFileSync = jest.fn().mockReturnValue(mockYamlContent);
  
  // 必要に応じて他のモックもリセット
  process.env = { ...process.env };
});
```

この方法によって、TypeScriptのキャスト機能を使わなくても、JavaScriptで適切にモック関数を設定できます。

### 3. Jest設定の見直し

- `jest.config.js`の設定を確認し、CommonJSモードとESMモードの両方に対応
- 拡張子マッピングの調整
- モジュール解決方法の設定

## 次のステップ

1. 優先度の高い順に対応：
   - `src/core/types.ts`ファイルの修正（実行時の`Types`オブジェクトを提供）
   - テストファイルのモック設定を修正（特に依存関係の問題）
   - Jest設定を見直し（拡張子マッピングなど）

2. 対応済みファイルの詳細確認：
   - UnifiedOrderManager.test.js
   - symbolInfoService.test.js
   - multiSymbolBacktest.test.js
   - parameterService.test.js

3. 新たに判明した課題と対応方針：
   - テスト簡略化は機能損失のリスクがあるため避ける
   - 元のテスト機能とカバレッジを維持する
   - TypeScript固有機能を適切にJavaScript形式に変換
   - できるだけ同じテストケースとアサーションを維持

4. 残りのファイルの対応：
   - 上記の対応策で解決しない場合は個別に調査

## 副作用と考慮点

- 型定義の変更による型安全性への影響
- CommonJSとESMの混在によるビルド設定の複雑さ
- テストのカバレッジへの影響
- @ts-nocheckディレクティブの適切な配置

## 関連タスク

- INF-032-2: コアモジュールのCommonJS変換
- INF-032-6: TypeScript型定義の整理
- INF-032-7: Jest設定のアップデート
- INF-032-8: モジュール解決設定の見直し
- INF-032-9: 残りのテストファイルのCommonJS変換 