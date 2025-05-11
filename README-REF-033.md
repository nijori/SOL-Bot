# REF-033: ESMとCommonJSの共存基盤構築

## 概要

このタスクでは、ESMとCommonJSが混在する環境での効率的な共存方法を確立しました。アダプターパターンを導入し、両方のモジュールシステムからのアクセスを可能にする基盤を構築しました。

## 実装内容

1. **互換性レイヤーの実装**
   - `src/utils/esm-compat.mjs`: ESM環境でCommonJSモジュールを使用するためのヘルパー
     - `createRequire`による`require`関数の提供
     - `__filename`と`__dirname`の互換実装
     - ディレクトリパス解決ヘルパー関数
   - `src/utils/cjs-wrapper.js`: CommonJSからESMモジュールを使用するためのラッパー
     - `createESMWrapper`: ESMモジュールのダイナミックインポート用ラッパー
     - `createESMProxy`: ESMモジュールへのプロキシアクセス
     - `convertESMtoCJS`: ESMからCommonJS形式への変換

2. **Dual-Format エントリポイントの実装**
   - `src/index.js`: CommonJSエントリポイント
   - `src/index.mjs`: ESMエントリポイント
   - 主要モジュールグループごとの個別エントリポイント
     - `src/core/index.js` と `src/core/index.mjs`
     - その他モジュールグループも同様の構造

3. **package.json の設定**
   - Conditional Exports設定:
     ```json
     "exports": {
       ".": {
         "import": "./dist/index.mjs",
         "require": "./dist/index.js",
         "types": "./dist/index.d.ts"
       },
       "./core": { ... },
       "./strategies": { ... },
       ...
     }
     ```
   - TypeScript型定義対応:
     ```json
     "types": "dist/index.d.ts"
     ```
   - デュアルフォーマットビルド:
     ```json
     "scripts": {
       "build": "npm run build:cjs && npm run build:esm",
       "build:cjs": "tsc -p tsconfig.cjs.json",
       "build:esm": "tsc -p tsconfig.esm.json"
     }
     ```

4. **ビルド設定の分離**
   - `tsconfig.cjs.json`: CommonJSビルド用設定
     - `"module": "commonjs"`
     - `.js`ファイルを含み、`.mjs`ファイルを除外
   - `tsconfig.esm.json`: ESMビルド用設定
     - `"module": "es2022"`
     - `.mjs`ファイルを含み、`.js`ファイルを除外

## 使用方法

### ESM環境での利用方法

```javascript
// ECMAScript Modules (ESM) として使用
import { TradingEngine, BacktestRunner } from 'sol-bot';
// または特定のモジュールグループを直接インポート
import { TradingEngine } from 'sol-bot/core';
```

### CommonJS環境での利用方法

```javascript
// CommonJS として使用
const solBot = require('sol-bot');
// モジュールは非同期ロードが必要
await solBot.initModules();
const { tradingEngine } = solBot;

// または特定のモジュールグループを直接ロード
const core = require('sol-bot/core');
await core.initCoreModules();
```

### ESMからCommonJSモジュールへのアクセス

```javascript
// ESMからCommonJSモジュールを使用
import { require, __dirname } from 'sol-bot/utils/esm-compat.mjs';
const legacyModule = require('legacy-module');
console.log('現在の作業ディレクトリ:', __dirname);
```

### CommonJSからESMモジュールへのアクセス

```javascript
// CommonJSからESMモジュールを使用
const { createESMProxy } = require('./utils/cjs-wrapper');
const esmModule = createESMProxy('./path/to/esm-module.js');
// 最初に非同期ロードが必要
await esmModule();
// その後、通常のオブジェクトとして使用可能
const result = esmModule.someFunction();
```

## 推奨ベストプラクティス

1. **新規モジュールはESMで作成**: 新しく作成するモジュールはESM形式（`.mjs`拡張子）で作成することを推奨
2. **拡張子を明示**: インポート時は常に拡張子を明示（`.js`または`.mjs`）
3. **タイプ情報の維持**: TypeScript型定義（`.d.ts`）を適切に生成・管理
4. **バージョン管理**: package.jsonのenginesフィールドでNode.jsバージョン要件を明示
5. **明示的なインポート**: 名前付きインポートを使用し、ワイルドカードインポート（`import * as`）は避ける

## 注意点

- CommonJS環境からESMモジュールを使用する場合は、常に非同期ロードが必要
- TypeScriptのソースコード内でのimport文は拡張子なしで記述し、コンパイラがビルド時に適切に処理
- デュアルフォーマットパッケージのテストは両方の環境で行う必要がある 