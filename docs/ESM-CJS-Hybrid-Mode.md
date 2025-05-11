# ESM/CommonJS ハイブリッドモード開発ガイド

## 概要

SOL_botプロジェクトは現在、ESM（ECMAScript Modules）とCommonJSの混在環境で開発を進めています。この文書では、両方の環境で動作する安定したコードを書くためのガイドラインを提供します。

## 現状のアーキテクチャ

- **ソースコード**: ESMスタイルで記述（import/export構文）
- **テスト環境**: CommonJSモードで実行（Jest）
- **実行環境**: ESMモードで実行（Node.js + `--loader ts-node/esm`）

## ESM固有機能の代替方法

### 1. `import.meta.url`の代替

ESMでは`import.meta.url`によるファイルパス取得が可能ですが、CommonJSでは使えません。代わりに：

```typescript
// 元のコード（ESMのみ）
const __dirname = new URL('.', import.meta.url).pathname;

// 代替コード（ハイブリッド対応）
const __dirname = (() => {
  if (typeof import.meta !== 'undefined') {
    // ESM環境
    return new URL('.', import.meta.url).pathname;
  } else {
    // CommonJS環境
    return require('path').dirname(require.main?.filename || '');
  }
})();
```

### 2. 動的インポートの代替

```typescript
// 元のコード（ESMのみ）
const module = await import('./dynamicModule.js');

// 代替コード（ハイブリッド対応）
const loadModule = async (path) => {
  if (typeof require !== 'undefined') {
    // CommonJS環境
    return require(path);
  } else {
    // ESM環境
    return await import(path);
  }
};

const module = await loadModule('./dynamicModule.js');
```

### 3. トップレベルawaitの代替

```typescript
// 元のコード（ESMのみ）
const result = await fetchData();
console.log(result);

// 代替コード（ハイブリッド対応）
async function main() {
  const result = await fetchData();
  console.log(result);
}

if (typeof require !== 'undefined') {
  // CommonJS環境
  main();
} else {
  // ESM環境 - トップレベルawaitが使える
  await main();
}
```

## テストファイルの注意点

1. **モジュールモック**

```typescript
// 元のコード（ESMのみ）
vi.mock('./module.js', () => {
  return { default: jest.fn() };
});

// 代替コード（ハイブリッド対応）
jest.mock('../../module', () => {
  return { default: jest.fn() };
});
```

2. **パス指定**

```typescript
// ESM環境では拡張子必須
import { func } from './module.js';

// ハイブリッド対応では拡張子を省略
import { func } from './module';
```

## 開発ワークフロー

1. **新機能開発**:
   - ESMスタイルで記述
   - ハイブリッド対応のユーティリティを使用
   - テストはCommonJSスタイルで記述

2. **テスト実行**:
   - `npm test` - CommonJSモードでテスト実行
   - `npm test:esm` - ESMモードでテスト実行（一部のみ）

3. **本番実行**:
   - `npm start` - ESMモードで実行

## 将来計画

プロジェクトは段階的にESMに完全移行する予定です：

1. **フェーズ1**: 現状のハイブリッドモード（現在）
2. **フェーズ2**: テスト環境の部分的ESM対応（1月〜）
3. **フェーズ3**: 完全ESM環境（2月〜）

## よくある問題と解決策

### import.meta.urlエラー

エラー:
```
SyntaxError: Cannot use 'import.meta' outside a module
```

解決策:
- 上記のハイブリッド対応コードパターンを使用
- 該当ファイルにESM固有コードを分離し、適切に条件分岐

### Jest実行時のモジュール解決エラー

エラー:
```
Could not locate module ... mapped as: $1.ts
```

解決策:
- jest.config.jsのmoduleNameMapperを確認
- テストファイル内のimportパスから`.js`拡張子を削除

### CommonJSからESMモジュールへのインポートエラー

エラー:
```
Error [ERR_REQUIRE_ESM]: require() of ES Module not supported
```

解決策:
- 該当のESMモジュールをCommonJS互換にする
- 動的インポート`import()`を使用する

## 参考リソース

- [Node.js ESM/CommonJS 相互運用ガイド](https://nodejs.org/api/esm.html#interoperability-with-commonjs)
- [Jest ESM サポート](https://jestjs.io/docs/ecmascript-modules)
- [TypeScript ESM サポート](https://www.typescriptlang.org/docs/handbook/esm-node.html) 