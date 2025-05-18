# INF-030: ESモジュール設定の修正

## 1. 問題の背景と原因

SOL-botプロジェクトでは、ES Modules（ESM）構文を使用しているにもかかわらず、`package.json`に`"type": "module"`設定が含まれていません。このため、Node.jsはデフォルトでファイルをCommonJS（CJS）形式として解釈しようとしています。

### 具体的な症状

- Dockerコンテナ起動時に次のエラーが発生：
  ```
  SyntaxError: Cannot use import statement outside a module
  ```

- この問題により、特にINF-025タスク（docker-compose Healthcheck整備）でのヘルスチェックテストが失敗しています。

### 根本原因

1. **設定の不一致**: ソースコードはESM構文（`import/export`）を使用していますが、`package.json`には`"type": "module"`が設定されていません

2. **デュアルフォーマット対応**: プロジェクトはESMとCJSの両方をサポートしようとしていますが、ビルド設定と実行環境に不整合があります

3. **Dockerコンテナ環境**: 開発環境ではTS-Nodeのローダーを使用しているため問題が顕在化していませんでしたが、ビルド後のJSファイルをDocker環境で実行すると失敗します

## 2. 提案される解決策

### アプローチA: package.jsonに"type": "module"を追加（推奨）

1. `package.json`に`"type": "module"`を追加
2. ビルド設定とスクリプトを更新して、ESMに完全に適合させる
3. 起動スクリプトと依存ライブラリの互換性を確認・修正

#### メリット
- モダンなJavaScriptプラクティスに準拠
- 将来的な保守性の向上
- ECMAScript機能の完全サポート

#### デメリット
- 広範囲の変更が必要
- 依存ライブラリとの互換性問題の可能性

### アプローチB: CJS形式に戻す

1. コードベースからESM構文を削除し、CJSに統一
2. `require()`と`module.exports`を使用するように変換

#### メリット
- 単純な変更で済む
- 依存ライブラリとの互換性問題が少ない

#### デメリット
- 古いJS形式への回帰
- コードベースの大幅な書き換えが必要
- 将来的な保守性の低下

## 3. 実装計画（アプローチA）

### フェーズ1: 準備と検証

1. **ブランチ作成**: `fix/esm-configuration`
2. **テスト環境の準備**: 
   - 小さなサブセットでESM設定のテスト
   - 互換性チェックスクリプトの実行

### フェーズ2: 基本設定の変更

1. **package.json の修正**:
   ```json
   {
     "type": "module",
     ...
   }
   ```

2. **ビルドスクリプトの更新**:
   - `tsconfig.json`の`module`を`NodeNext`または`ESNext`に設定
   - ビルド出力が`.mjs`または適切な拡張子になることを確認

3. **エントリーポイントの調整**:
   - `dist/index.js` → `dist/index.mjs` への参照更新

### フェーズ3: 依存関係とスクリプトの更新

1. **CJS依存の特定と対応**:
   - `import x from 'cjs-only-lib'` → `import x from 'cjs-only-lib' assert { type: 'commonjs' }`
   - または `createRequire` を使用して特定のライブラリをロード

2. **スクリプトの更新**:
   ```json
   "scripts": {
     "start": "node --experimental-specifier-resolution=node dist/index.js",
     "dev": "node --loader ts-node/esm src/index.ts",
     ...
   }
   ```

3. **Dockerfileの更新**:
   - `CMD` 命令に適切なNode.jsフラグを追加

### フェーズ4: テストとデバッグ

1. **ユニットテスト**: 既存のテストが新しい設定で動作することを確認
2. **統合テスト**: Docker環境でのヘルスチェックテスト
3. **リグレッションテスト**: 重要な機能が引き続き動作することを確認

## 4. 注意事項とリスク

### 互換性の問題

- **CJSのみのライブラリ**: 一部のライブラリはESMと完全互換ではない
- **動的インポート**: `import()`式の使用が必要な場面が増える
- **ファイルパス**: 拡張子の明示的な指定が必要（`import './utils.js'`）

### 緩和策

- **段階的アプローチ**: 一度に全てを変更せず、コンポーネントごとに移行
- **デュアルパッケージ**: 必要に応じてESM/CJS両方のエントリーポイントを維持
- **バックアップ計画**: 問題が発生した場合のロールバック手順を用意

## 5. テスト計画

1. **ローカルテスト**: 
   - `npm run dev` と `npm start` の両方で起動テスト
   - 主要機能のマニュアルテスト

2. **Docker環境テスト**:
   - `docker-compose up solbot-dev` 
   - ヘルスチェックの確認: `docker ps --format "table {{.Names}}\t{{.Status}}"`

3. **CI環境テスト**:
   - GitHub Actionsでのビルドとテスト
   - Dockerイメージのビルドと基本機能テスト

## 6. 参考資料

- [Node.js: ECMAScript Modules](https://nodejs.org/api/esm.html)
- [TypeScript: ESM/CommonJS Interop](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [Migrating from CommonJS to ESM](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c) 