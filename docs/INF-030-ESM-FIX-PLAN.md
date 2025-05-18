# INF-030: ESモジュール設定修正 - アクションプラン

## 1. 現状の問題

### 確認された問題
- TypeScriptのコードがESモジュール構文（import/export）を使用しており、package.jsonに`"type": "module"`を追加したが、Docker環境で実行時にエラーが発生している
- コンテナ内での実行時に、グローバル変数の宣言とTypeScriptのトランスパイルに関連した互換性問題が発生
- ビルドプロセスで`.js`と`.mjs`ファイルの両方が生成されるが、Docker実行時の参照が一貫していない

### 試した対策とその結果
1. グローバル宣言の修正 ✓
2. ccxtのインポート方法の修正 ✓ 
3. `node --import ts-node/register`へのdevスクリプト変更 ✓
4. DockerfileのCMD修正 ✓

しかし、まだコンテナの起動に問題がある。

## 2. 詳細アクションプラン

以下の順序で問題解決を進める必要があります：

### A. 徹底調査
1. ESMミスマッチ箇所の特定
   - `scripts/fix-esm-imports.js`の詳細分析
   - `node --experimental-specifier-resolution=node src/index.ts`のネイティブ実行テスト
   - TypeScriptのビルド設定（tsconfig.esm.json）の修正検討

2. ビルド生成物の構造確認
   - dist/index.js と dist/index.mjs の差異の確認
   - 拡張子の一貫性確認：すべてのインポート先が正しい拡張子を参照しているか

### B. 解決策実装
1. TypeScriptコンパイラ設定の修正
   - `tsconfig.esm.json`の`moduleResolution`を`NodeNext`に変更
   - `verbatimModuleSyntax: true`設定の追加検討

2. 拡張子解決問題対策
   - Node.jsの`--experimental-specifier-resolution=node`オプションの効果検証
   - ファイル参照時の拡張子明示化スクリプトの実装

3. Docker設定の整合性確保
   - `copy-mjs-files.cjs`スクリプトの強化
   - Dockerfileのコマンド実行に`--experimental-specifier-resolution=node`オプション追加
   - 開発環境と本番環境のNode.js起動オプションの統一

### C. テストと確認
1. ローカル環境テスト
   - `npm run dev`でのローカル起動テスト
   - ビルド後の`npm start`で起動テスト

2. Docker環境テスト
   - `docker-compose up solbot-dev`でのヘルスチェック確認
   - 本番用設定`docker-compose up solbot-prod`の検証
   - ビルドプロセス完了後のコンテナ起動確認

## 3. 完了条件
- Docker環境でのヘルスチェックが成功（`/api/status`エンドポイントにアクセス可能）
- development/productionの両モードでコンテナが正常に起動
- ESMインポート構文と拡張子参照の整合性確保
- `package.json`の`"type": "module"`設定での安定動作

## 4. 注記
この問題は、Node.jsのESM実装とTypeScriptの設定、さらにDockerコンテナ化された環境での相互作用に関連しています。一部のパッケージはESMとCJSの互換性に問題がある可能性があり、それらを特定して対応する必要があります。 