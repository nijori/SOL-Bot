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

## 6. 実施進捗状況（2026/07/03更新）

### フェーズ1: 設定ファイル更新（INF-031）- 完了 ✅
- `package.json`から`"type": "module"`を削除し、スクリプト設定を修正
- ESM関連設定を削除
- TypeScript設定をCommonJS向けに更新

### フェーズ2: コードベース変換（INF-032）- 進行中 🔄
#### 完了した作業:
- 主要なコアクラスのCommonJS形式への変換:
  - TradingEngine
  - OrderManagementSystem
  - BacktestRunner
- 重要ユーティリティモジュールの変換:
  - logger (循環参照問題解決)
  - importMetaHelper
  - memoryMonitor
  - killSwitchChecker
  - orderUtils
  - metrics
- 循環参照問題解決のためのmoduleHelperシステム実装
- 重複変数宣言問題の一部解決

#### 残りの課題:
- 一部のファイルにまだESM形式のインポート文が残っている
- TypeScriptコンパイルエラーが多数存在（現状は@ts-nocheck指定で回避可能）
- 型定義の互換性問題

### フェーズ3: Docker環境設定の更新（INF-033）- 準備中 🔄
- Dockerfileの修正完了
- docker-compose.ymlの更新完了
- コンテナでの実際の検証はINF-032完了後に実施予定

### 今後の作業計画
1. **残りのESMインポート修正 (優先度: 高)**
   - サービス層とデータ層のインポート文修正
   - 型定義ファイルの参照方法の統一

2. **循環参照問題の完全解決 (優先度: 高)**
   - moduleHelperを活用した依存関係の整理
   - グローバル変数の整理

3. **TypeScript型エラーの解消 (優先度: 中)**
   - 主要コンポーネントから段階的に型定義を修正
   - @ts-nocheck指定の段階的削除

4. **Docker環境でのE2Eテスト (優先度: 高)**
   - ビルドプロセスの検証
   - 実行時のモジュール解決の確認

5. **パフォーマンス検証 (優先度: 低)**
   - CommonJSへの移行によるパフォーマンスへの影響評価
   - 必要に応じた最適化

上記の作業はINF-033タスクと連携して進め、Docker環境での動作確認を重視しながら完了させる計画です。 