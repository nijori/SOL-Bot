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

3. 型情報の削除後のコード互換性問題
   - TypeScriptの型情報に依存したコードがある

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

3. 残りのファイルの対応：
   - 上記の対応策で解決しない場合は個別に調査

## 副作用と考慮点

- 型定義の変更による型安全性への影響
- CommonJSとESMの混在によるビルド設定の複雑さ
- テストのカバレッジへの影響

## 関連タスク

- INF-032-2: コアモジュールのCommonJS変換
- INF-032-6: TypeScript型定義の整理
- INF-032-7: Jest設定のアップデート
- INF-032-8: モジュール解決設定の見直し 