# SOL-Bot: クリプト自動取引アルゴリズム

[![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.18.2-green.svg)](https://expressjs.com/)
[![CCXT](https://img.shields.io/badge/CCXT-4.0.0-orange.svg)](https://github.com/ccxt/ccxt)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/yourusername/SOL-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/SOL-bot/actions)
[![codecov](https://codecov.io/gh/yourusername/SOL-bot/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/SOL-bot)
[![Code Style: ESLint](https://img.shields.io/badge/code_style-ESLint-5ed9c7.svg)](https://eslint.org/)
[![ESM Ready](https://img.shields.io/badge/ESM-Ready-brightgreen.svg)](https://nodejs.org/api/esm.html)

複数の暗号資産ペア（SOL/USDT, BTC/USDT, ETH/USDTなど）のトレンドとレンジを自動検出し、適切な売買戦略を適用するアルゴリズムトレーディングシステムです。

![SOL-Bot概要](https://via.placeholder.com/800x400?text=SOL-Bot+Overview)

## 📊 主要サービス

### OrderSizingService

マルチアセット対応のリスクベースポジションサイズ計算サービス：

- **マルチアセット対応**: SOL/USDT、BTC/USDT、ETH/USDTなど様々な通貨ペアに対応
- **取引所の制約に対応**: 各取引所の最小ロットサイズ、数量精度、最小注文金額などに自動対応
- **リスク計算の統一**: シンボル、口座残高、ストップ距離から適切な注文サイズを算出

```typescript
// 使用例
const orderSizingService = new OrderSizingService(exchangeService);
const orderSize = await orderSizingService.calculateOrderSize(
  'BTC/USDT', // シンボル
  5000, // 利用可能残高
  1000, // ストップ距離
  50000, // 現在価格
  0.01 // リスク率 (1%)
);
```

### ExchangeService

複数取引所APIとの統合サービス：

- **複数取引所対応**: Binance、Bybit、KuCoinなど主要取引所に対応
- **マーケット情報取得**: 最小ロットサイズ、精度、ティッカー価格などの自動取得
- **高度な注文タイプ**: Post-Only、Hidden、OCOなど複雑な注文タイプをサポート

### UnifiedOrderManager

マルチエクスチェンジ注文管理システム：

- **注文配分戦略**: PRIORITY、ROUND_ROBIN、SPLIT_EQUAL、CUSTOMなど複数の配分アルゴリズム
- **一元的な注文管理**: 複数取引所にまたがる注文の作成・追跡・キャンセルを統合管理
- **エラー耐性**: 特定取引所の障害時に自動的に代替取引所を使用

## 🌟 特徴

- **マルチアセット対応**: SOL/USDT、BTC/USDT、ETH/USDTなど様々な通貨ペアでのトレーディング
- **マルチレジーム対応**: トレンド/レンジを自動検出し最適な戦略を選択
- **リスク管理**: ATRベースのポジションサイジングと動的ストップロス
- **ブラックスワン対策**: 急激な価格変動時の緊急対応戦略
- **REST API**: 監視・制御用のAPIエンドポイント
- **高速計算**: EMA/ATR計算のインクリメンタル化により最大10倍のパフォーマンス向上
- **動的パラメータ調整**: 市場状態に応じて自動的に戦略パラメータを最適化
- **リソース最適化**: LRUキャッシュ実装によるメモリ使用量の最適化

## 🚀 主要技術

- **TypeScript**: 型安全なコードベース
- **ECMAScript Modules**: 近代的なJavaScriptモジュールシステム
- **CCXT**: 複数取引所との互換性
- **Node.js**: サーバーサイド実行環境
- **Express**: REST API提供
- **Prometheus & Grafana**: システム監視とアラート
- **DuckDB & Parquet**: 高効率なデータ永続化と分析
- **GitHub Actions CI/CD**: 自動テスト・デプロイ・セキュリティスキャン
- **Jest (ESM対応)**: テストフレームワーク

## 📊 戦略概要

### トレンドフォロー戦略

- **Donchianブレイクアウト**: ADX > 25の強いトレンド環境で使用
- **Parabolic SAR**: トレンド転換点検出とストップロス調整
- **動的トレイリングストップ**: ATRの1.2倍に基づくトレイリングストップ
- **加速ポジション**: 1R（リスク単位）毎に0.5R追加

### レンジ戦略

- **グリッドトレード**: ATRに基づく動的グリッドレベル設定
- **VWAP指値注文**: 約定率向上のための指値注文戦略
- **レンジブレイク検知**: レンジを超えた場合の自動決済

### ミーンリバージョン戦略

- **Donchian Range**: レンジ相場でDonchianチャネル内での反発を狙う
- **グリッド注文**: ATR%に基づく動的グリッドレベル計算
- **Maker-only注文**: 手数料削減と約定確率向上のためのLimit注文活用
- **ポジション上限**: 口座残高の35%を上限とする保守的ポジション管理
- **ポジション偏りヘッジ**: 15%以上偏ったポジションを自動調整
- **エスケープ条件**: レンジ上限＋2%または下限－2%で全決済

### 市場環境判定ロジック

MarketStateモジュールは以下の環境を識別します：

- **STRONG_UPTREND/STRONG_DOWNTREND**: 強いトレンド環境（傾き高、長短EMA同方向、ADX>25）
- **UPTREND/DOWNTREND**: 通常のトレンド環境
- **WEAK_UPTREND/WEAK_DOWNTREND**: 弱いトレンド（微かな傾向あり）
- **RANGE**: レンジ相場（低ボラティリティ、傾き小）
- **EMERGENCY**: 急激な価格変動時（ブラックスワンイベント）

## 🔧 セットアップ

### 前提条件

- Node.js 18.x以上（ESMをサポート）
- npm/yarn
- PostgreSQL 13+ （メタデータとパフォーマンス分析用）

### インストール手順

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/SOL-bot.git
cd SOL-bot

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集して取引所のAPIキーなどを設定

# 開発モードで実行
npm run dev

# 本番モードで実行
npm run start
```

### テスト実行

SOL-BotはESM環境に完全対応したテストフレームワークを提供しています：

```bash
# 標準テスト実行
npm run test

# ESM専用テスト実行（高度なモック機能と安定性向上）
npm run test:esm

# カバレッジレポート生成
npm run test:coverage

# 統合テスト実行（CommonJS/ESMの両方を実行）
npm run test:unified

# テストグループ別実行（高速/中速/低速/重いテスト）
npm run test:unified --group fast
npm run test:unified --group medium
npm run test:unified --group slow
npm run test:unified --group heavy

# 前回のテスト実行レポート表示
npm run test:unified:report

# CommonJSテストのみ実行
npm run test:unified:cjs

# ESMテストのみ実行
npm run test:unified:esm
```

詳細なセットアップ手順やシステムの使用方法については、[ユーザーマニュアル](docs/UserManual.md)を参照してください。また、[ドキュメント索引](docs/index.md)からその他のガイドにもアクセスできます。

## ⚙️ 設定

`.env`ファイルで以下の項目を設定できます：

```
# 運用モード: simulation, backtest, live
OPERATION_MODE=simulation

# 取引所設定
EXCHANGE_API_KEY=your_api_key
EXCHANGE_SECRET_KEY=your_secret_key

# 取引設定
TRADING_PAIR=SOL/USDT
TIMEFRAME=1h
INITIAL_BALANCE=10000

# リスク管理
MAX_RISK_PER_TRADE=0.01
MAX_DAILY_LOSS=0.05

# AWS設定（データアーカイブ用）
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=your-bucket-name
S3_ARCHIVE_BUCKET=your-archive-bucket
DATA_RETENTION_DAYS=90
```

## 📊 バックテスト

バックテストを実行して、異なる市場環境での戦略パフォーマンスを検証できます：

```bash
# 基本的なバックテスト
npm run backtest -- --symbol SOL/USDT --timeframe 1h --days 90

# 詳細なレポート出力
npm run backtest -- --symbol SOL/USDT --timeframe 1h --days 90 --report full

# 複数の通貨ペアでバックテスト
npm run backtest -- --symbols SOL/USDT,BTC/USDT,ETH/USDT --timeframe 1h --days 30

# クワイエットモード（最小限の出力）
npm run backtest -- --symbol SOL/USDT --quiet

# マルチエクスチェンジバックテスト
npm run backtest -- --symbol SOL/USDT --exchanges binance,bybit,kucoin
```

## 🔍 現在の開発状況

### 最新スプリント進捗（W10: 追加機能開発・ユーザビリティ向上スプリント）

- ✅ **ALG-018**: 市場環境に応じた動的パラメータ調整機能の追加。市場の状態（トレンド/レンジ）を検出し、それに応じてEMA期間、ATR乗数、エントリー閾値などの主要パラメータを自動調整する機能を実装。ボラティリティベースの資金配分戦略も実装。

- 🔄 **DOC-004**: ユーザーマニュアル作成（50%完了）。インストール手順、設定ファイルの編集方法、コマンドラインオプションの説明、バックテスト実行方法などを包括的に文書化中。

- ✅ **TODO-CLI**: todo-lintの機能強化。front-matterブロックスキップ機能や空文字チェック、タスク行とフィールドの検出精度向上、統計情報表示機能などを追加。

- ✅ **OMS-018**: UnifiedOrderManagerの配分アルゴリズム単体テスト実装。PRIORITY、ROUND_ROBIN、SPLIT_EQUAL、CUSTOMなど各種配分方式のエッジケース対応を検証済み。

- ✅ **TST-055**: モジュールモックの一貫性向上。ESM/CJSデュアルフォーマット対応のモックファクトリーライブラリを実装。戦略・サービス・データモジュール用のモックファクトリー関数と、一括モック化機能を提供。テスト間でのモック実装の統一とコード重複削減を実現。

- ✅ **TST-084**: 統合テスト実行スクリプトの実装。CommonJSとESMのテストを一括実行し、テストグループ別（fast/medium/slow/heavy/core/esm）の実行とパフォーマンス計測機能を提供。詳細なテスト統計の収集、レポート生成、実行履歴の保存など高度な機能を実装。CIパイプラインとの連携も強化。

- 🔄 **REF-020/021/022/023**: テスト環境のESM完全対応プロジェクト（進行中）。Jest設定ファイルのESM対応、型アノテーション除去の強化、テスト変換スクリプトの改良中。

### 前回スプリント（W9: パフォーマンス最適化・リソース管理スプリント）

- ✅ **PERF-006**: RealTimeDataProcessorにLRUキャッシュを実装し、メモリ使用量を最適化。バックプレッシャー計測機能の追加によりデータ処理パフォーマンスを改善。

- ✅ **TST-013**: DataRepositoryの並列書き込み競合を検証するE2Eテストを実装。async-mutexによるロック機構でデータ整合性を確保。

- ✅ **INF-023**: 90日超のデータファイルをS3→Glacierに自動移行するスクリプトを実装。AWS SDK for JavaScriptを使用して効率的なデータライフサイクル管理を実現。

- ✅ **INF-021**: Dependabotとの依存脆弱性スキャン統合。Trivyによる週次スキャンとPR時の自動チェックを実装。SECURITY.mdドキュメントも作成。

## 📈 パフォーマンス

主要通貨ペアでの直近3ヶ月のバックテスト結果：

### SOL/USDT

- **総取引数**: 142回
- **勝率**: 59.8%
- **利益率**: 24.5%
- **最大ドローダウン**: 8.76%
- **シャープレシオ**: 1.45

### BTC/USDT

- **総取引数**: 95回
- **勝率**: 62.1%
- **利益率**: 18.7%
- **最大ドローダウン**: 7.32%
- **シャープレシオ**: 1.58

### ETH/USDT

- **総取引数**: 118回
- **勝率**: 57.3%
- **利益率**: 21.2%
- **最大ドローダウン**: 9.15%
- **シャープレシオ**: 1.37

## 🔌 API エンドポイント

主要エンドポイント（詳細は`src/docs/APIEndpoints.md`を参照）：

- `GET /api/status`: システム状態取得
- `GET /api/market/:symbol`: 市場データ取得
- `GET /api/analysis/:symbol`: 市場分析結果取得
- `GET /api/account`: アカウント情報・ポジション取得
- `POST /api/orders`: 注文作成
- `POST /api/backtest`: バックテスト実行

## 📁 プロジェクト構造

プロジェクトの詳細な構造については、[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)を参照してください。

## 👀 監視システム

SOL-Botには包括的な監視機能が組み込まれています：

### 監視スタック

- **Prometheus**: メトリクスの収集と保存
- **Grafana**: データの可視化とダッシュボード
- **Alertmanager**: アラート管理とDiscord通知

### 主要メトリクス

- 取引残高推移、日次損益、勝率、最大ドローダウン
- 取引数と取引量、エラー率、レイテンシ
- CPU、メモリ、ディスク使用率
- バックプレッシャーと処理遅延
- トレンド/レンジ判定精度

### 起動方法

```bash
cd monitoring
docker-compose up -d
```

アクセス方法：

- Grafanaダッシュボード: http://localhost:3000 (admin/solbot123)
- Prometheusコンソール: http://localhost:9090

## 🔒 セキュリティ対策

SOL-Botは複数のセキュリティ対策を実装しています：

### 依存関係管理と脆弱性対策

- **Dependabot自動アップデート**: 依存パッケージを週次で自動スキャン・更新

  - npm パッケージの自動更新
  - GitHub Actions の依存関係自動更新
  - 安全なマイナー・パッチリリースの自動PR作成

- **Trivy脆弱性スキャン**: 依存パッケージの脆弱性を自動検出

  - 週次の定期スキャンでセキュリティリスクを早期発見
  - PR時に自動スキャンし、検出した脆弱性をコメント通知
  - 優先度に基づく脆弱性修正推奨

- **SBOM (Software Bill of Materials)**: ソフトウェア部品表の自動生成
  - 使用しているすべての依存関係の可視化
  - 依存関係のライセンス確認
  - サプライチェーンセキュリティの向上

### 機密情報保護

- **シークレットマネージャー**: 複数バックエンド対応の機密情報管理

  - AWS Parameter Store、GCP Secret Manager対応
  - 開発/本番環境での適切な実装切替
  - ファクトリーパターンによる実装切替

- **Gitleaks**: リポジトリ内の機密情報を自動検出
  - コミット前チェック
  - PRマージ前チェック
  - 定期的な全リポジトリスキャン

### 緊急停止機能

- **Kill Switch**: 異常時の迅速な取引停止メカニズム
  - フラグファイル検出による安全な停止
  - 5分ごとの定期的なフラグチェック
  - アプリケーションとサービスの両レベルでの停止対応
  - 詳細は[緊急停止ガイド](docs/EmergencyStopGuide.md)を参照

### データセキュリティ

- **データライフサイクル管理**: 古いデータの安全な保存と移行
  - 90日超のデータを自動的にS3に移行
  - S3からGlacierへの段階的アーカイブ
  - IAMロールによる最小権限アクセス

これらのセキュリティ対策により、SOL-Botは常に安全な状態を維持し、潜在的なセキュリティリスクを早期に発見・対処します。詳細は[SECURITY.md](./SECURITY.md)を参照してください。

## 🔄 最適化と性能向上

### パフォーマンス最適化

- **RealTimeDataProcessor**: LRUキャッシュ実装によるメモリ使用量最適化
- **バックプレッシャー計測**: 高負荷時のデータ処理パフォーマンス改善
- **動的バッファサイズ**: データ量に応じたバッファサイズの自動調整
- **並列バックテスト**: MultiSymbolBacktestRunnerの並列化による大幅な高速化
- **IncrementalEMA/ATR**: 増分計算による指標計算の効率化（最大10倍の高速化）

### リソース管理

- **メモリ使用量監視**: リアルタイムメモリ監視とリソース制限設定
- **GCサイクル制御**: 最適なタイミングでのGC呼び出しによるメモリ効率化
- **バッチ処理**: 大量データ処理時のチャンク単位処理による効率化
- **データライフサイクル**: 古いデータの自動アーカイブと効率的な保存

## 🤝 コントリビューション

プロジェクトへの貢献に興味がある場合は、次の手順に従ってください：

1. このリポジトリをフォーク
2. 新しいブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

コントリビューション時には、以下の点に注意してください：

- Todo形式に従ったタスク管理（詳細は`.todo/todo-format.md`を参照）
- テスト駆動開発（TDD）アプローチの採用
- コードカバレッジ90%以上の維持
- セキュリティベストプラクティスの遵守

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)を参照してください。

## ⚠️ 免責事項

このソフトウェアは教育目的で提供されています。実際の取引で使用する場合は、自己責任で行ってください。市場リスクを十分に理解し、損失に耐えられる資金でのみ取引を行うことをお勧めします。
