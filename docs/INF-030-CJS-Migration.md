# INF-030: CommonJSへの移行計画

## 1. 背景と目的

SOL-botプロジェクトでは、当初ESモジュール（ESM）構文を使用するモダンなアプローチを採用していましたが、以下の問題が継続的に発生しています：

- Docker環境での互換性問題
- TypeScriptコンパイル後の参照整合性の問題
- テスト環境でのESM/CJSの相互運用の複雑さ
- ビルドプロセスの不安定さ

これらの問題を根本的に解決し、安定性を優先するため、CommonJS形式へのコードベース移行を決定しました。

## 2. 移行ステップの詳細

### フェーズ1: 設定ファイルの更新 (INF-031)

#### package.jsonの修正
- `"type": "module"` 設定を削除
- exportsフィールドのパス参照を `.js` に統一
- 不要な `.mjs` 参照と生成スクリプトを削除/無効化

```diff
{
  "name": "sol-bot",
  "version": "1.0.0",
  "description": "Algorithmic trading bot for SOL/USDT and other crypto pairs",
- "type": "module",
  "main": "dist/index.js",
- "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
-     "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    // 他のエクスポート設定も同様に修正
  }
}
```

#### TypeScript設定の更新
- `tsconfig.json` - CommonJS設定を確認・調整
- `tsconfig.esm.json` - 優先度を下げるか無効化

```diff
// tsconfig.json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    // 他の設定は維持
  }
}
```

### フェーズ2: コードベース変換 (INF-032)

#### 自動変換スクリプトの作成/実行
- ESM構文（import/export）をCommonJS（require/module.exports）に変換
- ファイル末尾の拡張子（.js）参照を確認・修正
- グローバル宣言の互換性確保

```diff
- import express from 'express';
- import { Order } from './types.js';
+ const express = require('express');
+ const { Order } = require('./types');

- export class TradingEngine {
+ class TradingEngine {
  // 実装
}
+ module.exports = { TradingEngine };
```

#### 型定義の互換性確保
- TypeScript宣言ファイルの確認・修正
- ES Module相互運用型の削除/修正

### フェーズ3: Docker環境設定の更新 (INF-033)

#### Dockerfile修正
- エントリーポイント変更
- ESM関連オプション削除

```diff
# Command to run the application
- CMD ["node", "--experimental-specifier-resolution=node", "dist/index.js"]
+ CMD ["node", "dist/index.js"]
```

#### docker-compose.yml修正
- 開発環境コマンド修正
- ヘルスチェック設定維持

```diff
command: 
- node --import ts-node/register --experimental-specifier-resolution=node src/index.ts
+ npm run dev
```

## 3. テスト計画

### ローカル環境テスト
1. **基本検証**:
   - ビルドプロセス: `npm run build`
   - サーバー起動: `npm start`
   - API応答確認: `/api/status` エンドポイント

2. **ユニットテスト**:
   - テスト実行: `npm test`
   - カバレッジ確認

### Docker環境テスト
1. **コンテナビルド**:
   - `docker-compose build solbot-dev`
   - `docker-compose build solbot-prod`

2. **コンテナ起動+ヘルスチェック**:
   - `docker-compose up solbot-dev -d`
   - ヘルスステータス確認: `docker ps --format "{{.Names}}\t{{.Status}}"`

## 4. リスクと軽減策

### 予想される問題
1. **TypeScript型定義の互換性**:
   - ESModuleInterop設定の確認
   - 明示的な型インポートの修正

2. **依存関係の互換性**:
   - 一部パッケージがESM専用の可能性
   - 代替パッケージの検討

3. **ハイブリッド参照の残存**:
   - `node_modules`内のESMパッケージとの相互運用
   - dynamic importの活用（必要に応じて）

### 軽減策
1. **段階的テスト**:
   - コアモジュールからの変換と検証
   - エラー発生箇所の個別対応

2. **ロールバック計画**:
   - 元のESM設定を別ブランチで保持
   - 重大な問題発生時の復帰手順整備

## 5. 移行後の方針

### 今後の開発指針
- CommonJS形式を標準とした開発継続
- パッケージの更新時にはCommonJS互換性を確認
- 将来的なESM再導入はNode.jsエコシステムの成熟後に検討

### ドキュメント更新
- `PROJECT_STRUCTURE.md`の更新
- コーディング規約の明確化
- 新規開発者向けガイドライン 