# TypeScriptビルド設定ガイド

## 1. ビルド設定ファイルの概要

プロジェクトには2つの主要なTypeScript設定ファイルがあります：

- **tsconfig.json** - 開発時の設定（エディタのIntelliSense、型チェック用）
- **tsconfig.build.json** - 本番ビルド用の設定（`npm run build`で使用）

## 2. 現在のモジュール設定状況

### 現在の状態（暫定）
現在のプロジェクトでは、ソースコード内で`import.meta.url`を使用しているファイルがあるため、一時的に以下の設定を使用しています：

```json
{
  "compilerOptions": {
    "outDir": "dist",
    "module": "es2022",    // import.metaを使用可能にするため
    "moduleResolution": "Node", // Node.jsの標準モジュール解決
    // その他の設定
  }
}
```

### 目標（CommonJS出力への移行）
将来的には**CommonJS**出力を基本とし、Node.jsの標準環境での安定した動作を確保する予定です：

```json
{
  "compilerOptions": {
    "outDir": "dist",
    "module": "commonjs",    // CommonJS形式での出力
    "moduleResolution": "Node", // Node.jsの標準モジュール解決
    // その他の設定
  }
}
```

この移行のためには、import.meta.urlの使用箇所を`src/utils/import-meta-polyfill.js`で提供されるポリフィルに置き換える作業が必要です。

## 3. outDirの役割

`outDir: "dist"` 設定により、コンパイル後のJavaScriptファイルは以下のディレクトリ構造で出力されます：

```
dist/
├── config/         <- src/config/ のコンパイル結果
├── core/           <- src/core/ のコンパイル結果
├── data/           <- src/data/ のコンパイル結果
...など
```

## 4. moduleとmoduleResolution設定の違い

- **module**: 出力されるJavaScriptのモジュール形式を定義
  - `"commonjs"` - `require()`/`module.exports`形式（Node.js標準）
  - `"es2022"` - `import`/`export`形式（ESモジュール）
  - `"NodeNext"` - Node.jsの最新モジュール解決規則に従う

- **moduleResolution**: モジュールのインポートパスをどのように解決するか
  - `"Node"` - Node.jsの従来の解決アルゴリズム（CommonJS向け）
  - `"NodeNext"` - package.jsonの"exports"フィールドなど最新機能サポート
  - `"Bundler"` - バンドラー向けの高度な解決方式

## 5. import.meta対応

現在のソースコードでは、以下のようなESM固有機能を使用している箇所があります：

- `src/core/backtestRunner.ts`
- `src/core/smokeTest.ts`
- `src/data/MultiTimeframeDataFetcher.ts`
- `src/scripts/cli.ts`
- `src/scripts/todo-lint.ts`

これらのファイルでは、CommonJS環境でも動作するようにポリフィルか条件分岐を使用する必要があります。そのために`src/utils/import-meta-polyfill.js`を提供しています：

```javascript
// 使用例
import { getCurrentFilePath, getCurrentDirPath } from '../utils/import-meta-polyfill';

// 元のコード
const filePath = import.meta.url;

// 代替コード
const filePath = getCurrentFilePath();
```

## 6. ESMとCommonJSの互換性維持

ESM固有の機能の代替方法：

1. **import.meta.url → getCurrentFilePath()**
   ```javascript
   import { getCurrentFilePath } from '../utils/import-meta-polyfill';
   const filePath = getCurrentFilePath();
   ```

2. **__dirname → getCurrentDirPath()**
   ```javascript
   import { getCurrentDirPath } from '../utils/import-meta-polyfill';
   const dirPath = getCurrentDirPath();
   ```

3. **環境検出**
   ```javascript
   import { isESMEnvironment } from '../utils/import-meta-polyfill';
   if (isESMEnvironment()) {
     // ESM固有の処理
   } else {
     // CommonJS向けの処理
   }
   ```

## 7. 将来のESM移行計画

将来的には以下の段階的アプローチを取る予定です：

1. **フェーズ1（現在）**: すべてのimport.metaの使用箇所をポリフィルで置き換え、module: "commonjs"に移行
2. **フェーズ2（将来）**: デュアルパッケージ対応（CommonJS/ESMの両方をサポート）
3. **フェーズ3（最終）**: ESM完全移行

フェーズ2では以下の設定ファイルを追加予定：

```json
// tsconfig.esm.json (将来実装予定)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist-esm",
    "module": "es2022",
    "moduleResolution": "NodeNext",
    "target": "es2022"
  }
}
```

## 8. Jest実行時の注意点

Jestテスト環境では、`moduleNameMapper`設定により相対パスを解決しています。ビルド出力を変更した場合は、Jest設定も合わせて調整が必要です：

```javascript
// jest.config.js
moduleNameMapper: {
  '^(\\.\\./.*)\\.js$': '$1', // .js拡張子の自動解決
}
```

## 9. ビルドスクリプト

現在は`npm run build`コマンドでESM形式のビルドが実行されます：

```bash
tsc -p tsconfig.build.json  # 現在はmodule: "es2022"を使用
```

将来的には、CommonJS形式のビルドに切り替える予定です：

```bash
# package.json (将来実装予定)
"scripts": {
  "build:cjs": "tsc -p tsconfig.build.json", // module: "commonjs"
  "build:esm": "tsc -p tsconfig.esm.json",   // module: "es2022"
  "build": "npm run build:cjs"
}
```

## 10. チェックリスト

ビルド設定変更時には以下を確認してください：

- [ ] `npm run build` でエラーなくビルドできる
- [ ] `dist/` ディレクトリに正しくファイルが出力される
- [ ] `npm test` でテストが正常に実行できる
- [ ] `import.meta.url` 使用箇所がポリフィルで適切に処理されている
- [ ] 外部依存パッケージのCommonJS/ESM互換性確認 