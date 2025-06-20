# SOL-Bot: クリプト自動取引アルゴリズム

[![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.18.2-green.svg)](https://expressjs.com/)
[![CCXT](https://img.shields.io/badge/CCXT-4.0.0-orange.svg)](https://github.com/ccxt/ccxt)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/yourusername/SOL-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/SOL-bot/actions)
[![codecov](https://codecov.io/gh/yourusername/SOL-bot/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/SOL-bot)



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

### MultiSymbolTradingEngine

マルチシンボル取引エンジン（REF-036で最適化済み）：

- **複数通貨ペア同時取引**: SOL/USDT、BTC/USDT、ETH/USDTなどを同時に管理
- **ポートフォリオリスク管理**: VaR計算、相関分析、集中リスク監視
- **動的資金配分**: 均等配分、ボラティリティベース配分、カスタム配分
- **モジュラー設計**: AllocationManagerとPortfolioRiskAnalyzerによる機能分離

```typescript
// 使用例
const multiEngine = new MultiSymbolTradingEngine({
  symbols: ['SOL/USDT', 'BTC/USDT', 'ETH/USDT'],
  allocationStrategy: AllocationStrategy.VOLATILITY,
  timeframeHours: 1
});

// ポートフォリオ更新
await multiEngine.update(candlesBySymbol);

// リスク分析結果取得
const riskAnalysis = multiEngine.getPortfolioRiskAnalysis();
```

## 🌟 特徴

- **マルチアセット対応**: SOL/USDT、BTC/USDT、ETH/USDTなど様々な通貨ペアでのトレーディング
- **マルチレジーム対応**: トレンド/レンジを自動検出し最適な戦略を選択
- **リスク管理**: ATRベースのポジションサイジングと動的ストップロス
- **ブラックスワン対策**: 急激な価格変動時の緊急対応戦略
- **REST API**: 監視・制御用のAPIエンドポイント
- **高速計算**: EMA/ATR計算のインクリメンタル化により最大10倍のパフォーマンス向上
- **Wilder's ATRアルゴリズム**: technicalindicatorsライブラリとの完全互換性（誤差率4.54%以内）
- **動的パラメータ調整**: 市場状態に応じて自動的に戦略パラメータを最適化
- **リソース最適化**: LRUキャッシュ実装によるメモリ使用量の最適化
- **マルチシンボル取引**: 複数通貨ペアの同時取引とポートフォリオ管理
- **高度なリスク分析**: VaR計算、相関分析、集中リスク管理
- **モジュラー設計**: 機能別モジュール分離による保守性とテスト性の向上
- **自動デプロイメント**: GitHub ActionsによるEC2ステージング環境への安全なデプロイ

## 🚀 主要技術

- **TypeScript**: 型安全なコードベース
- **CommonJS**: 安定したモジュールシステム（Docker環境での起動問題を解決済み）
- **CCXT**: 複数取引所との互換性
- **Node.js**: サーバーサイド実行環境
- **Express**: REST API提供
- **systemd**: Linux本番環境でのサービス管理
- **Prometheus & Grafana**: システム監視とアラート
- **DuckDB & Parquet**: 高効率なデータ永続化と分析
- **GitHub Actions CI/CD**: 自動テスト・デプロイ・セキュリティスキャン
- **Jest**: テストフレームワーク（REF-036でネイティブスタックトレースエラー解決済み）
- **モジュラーアーキテクチャ**: 機能別モジュール分離による保守性向上

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

- Node.js 18.x以上
- npm/yarn
- PostgreSQL 13+ （メタデータとパフォーマンス分析用）

### インストール手順

#### 開発環境

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

#### Linux本番環境（systemdサービス）

```bash
# 1. systemdサービスのインストール
sudo ./scripts/install-systemd-service.sh

# 2. アプリケーションのデプロイ
sudo ./scripts/deploy-to-systemd.sh

# 3. サービス管理
sudo systemctl start bot      # サービス開始
sudo systemctl stop bot       # サービス停止
sudo systemctl status bot     # 状態確認
sudo journalctl -u bot -f     # ログ確認
```

詳細なsystemdデプロイメント手順については、[systemdデプロイメントガイド](docs/systemd-deployment.md)を参照してください。

#### CI/CD自動デプロイ（推奨）

```bash
# masterブランチへのプッシュで自動実行
git add -A
git commit -m "CICD-005: Update application code"
git push origin master

# GitHub Actionsによる自動デプロイ実行：
# 1. rsync+SCPでソースコードをEC2に転送
# 2. npm依存関係の自動インストール
# 3. systemdサービスの自動起動
# 4. ヘルスチェック（/api/status）実行
# 5. Discord通知送信

# 1台構成での運用：
# - ステージング環境：ポート3000、/opt/solbot
# - 本番環境：ポート3001、/opt/solbot-prod
# - SSM Parameter Store統合（/solbot/prod/env）
```

**デプロイ完了確認:**
- GitHub Actionsタブでワークフロー実行状況を確認
- Discord通知でデプロイ結果を確認
- ステージング環境: `http://13.158.58.241:3000/api/status`
- 本番環境: `http://13.158.58.241:3001/api/status`（1台構成でポート分離）

### GitHub Actions ワークフロー

SOL-Botでは以下のワークフローで完全なCI/CDパイプラインを構築しています：

| ワークフロー | 用途 | トリガー | 状況 |
|-------------|------|----------|------|
| **Deploy to Staging** | ステージング環境自動デプロイ | master push | ✅ 稼働中 |
| **Security Scan** | セキュリティチェック（gitleaks + Trivy） | push/PR/日次 | ✅ 保持 |
| **CI/CD Pipeline** | テスト・ビルド・品質管理 | push/PR | ⚠️ 整理予定 |
| **Deploy to Production** | 本番環境デプロイ（1台構成、SSM対応） | master push + 手動 | ⚠️ 修正中 |


詳細な設定・用途・トラブルシューティングについては、[GitHub Actions ワークフロー詳細ガイド](docs/github-actions-workflows.md)を参照してください。

### テスト実行

SOL-BotはCommonJS環境で安定したテストフレームワークを提供しています：

```bash
# 標準テスト実行
npm run test

# カバレッジレポート生成
npm run test:coverage

# 統合テスト実行
npm run test:unified

# テストグループ別実行（高速/中速/低速/重いテスト）
npm run test:parallel:fast
npm run test:parallel:medium
npm run test:parallel:slow
npm run test:parallel:heavy
npm run test:parallel:core

# 前回のテスト実行レポート表示
npm run test:unified:report

# CommonJSテスト実行
npm run test:unified:cjs
```

詳細なセットアップ手順やシステムの使用方法については、[ユーザーマニュアル](docs/UserManual.md)を参照してください。また、[ドキュメント索引](docs/index.md)からその他のガイドにもアクセスできます。

## ⚙️ 設定

### 本番環境での設定管理

**本番・ステージング環境では、機密情報は AWS SSM Parameter Store で管理されています** (SEC-006/SEC-005対応完了)：

| パラメータ | 説明 | 環境 | 暗号化 |
|-----------|------|------|--------|
| `/solbot/stg/env` | ステージング環境変数 | Staging | ✅ SecureString |
| `/solbot/prod/env` | 本番環境変数 | Production | ✅ SecureString |
| `/solbot/stg/ssh-key` | ステージングSSH秘密鍵 | Staging | ✅ SecureString |
| `/solbot/prod/ssh-key` | 本番SSH秘密鍵 | Production | ✅ SecureString |
| `/solbot/discord/webhook-url` | Discord通知URL | 共通 | ✅ SecureString |

**セキュリティ強化 (SEC-005完了)**:
- ✅ GitHub Secrets完全削除、AWS OIDC認証統合
- ✅ 最小権限IAMポリシー（ssm:GetParameter, s3:GetObject/PutObject のみ）
- ✅ KMS暗号化（aws/ssm）による SecureString 保護
- ✅ ジョブ間環境変数分離、時限的アクセストークン（OIDC）
- ✅ 監査ログ強化（CloudTrail連携）、中央集権管理

### 開発環境での設定

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

### 最新完了タスク（2025-06-17）

- ✅ **ALG-057**: ATR Wilder平滑化アルゴリズム実装完了。technicalindicatorsライブラリとの誤差率を15.37%から4.54%以内に改善。

- ✅ **SEC-005/SEC-006**: GitHub Secrets to SSM Parameter Store完全移行。AWS OIDC認証統合、KMS暗号化によるSecureString保護、最小権限IAMポリシー実装。

- ✅ **DAT-015**: Data-Lifecycle Cron実機テスト完了。EC2環境で90日以上前のファイルをS3に自動アーカイブ成功。cronジョブ設定サンプル作成済み。

### 前回スプリント進捗（W13: P0→P1 安全ネット＆インフラHardening）

- ✅ **INF-026**: ステージングEC2セットアップ完了。TerraformによるIaCでAWS EC2インスタンス（t3.small）、セキュリティグループ、IAMロール、Elastic IPを作成。Docker、Node.js、必要なディレクトリ構造が自動セットアップ済み。パブリックIP: 13.158.58.241で稼働中。

- ✅ **ALG-018**: 市場環境に応じた動的パラメータ調整機能の追加。市場の状態（トレンド/レンジ）を検出し、それに応じてEMA期間、ATR乗数、エントリー閾値などの主要パラメータを自動調整する機能を実装。ボラティリティベースの資金配分戦略も実装。

- 🔄 **DOC-004**: ユーザーマニュアル作成（50%完了）。インストール手順、設定ファイルの編集方法、コマンドラインオプションの説明、バックテスト実行方法などを包括的に文書化中。



- ✅ **OMS-018**: UnifiedOrderManagerの配分アルゴリズム単体テスト実装。PRIORITY、ROUND_ROBIN、SPLIT_EQUAL、CUSTOMなど各種配分方式のエッジケース対応を検証済み。

- ✅ **TST-055**: モジュールモックの一貫性向上。CommonJS対応のモックファクトリーライブラリを実装。戦略・サービス・データモジュール用のモックファクトリー関数と、一括モック化機能を提供。テスト間でのモック実装の統一とコード重複削減を実現。

- ✅ **TST-084**: 統合テスト実行スクリプトの実装。CommonJSテストのグループ別（fast/medium/slow/heavy/core）の実行とパフォーマンス計測機能を提供。詳細なテスト統計の収集、レポート生成、実行履歴の保存など高度な機能を実装。CIパイプラインとの連携も強化。

- ⚠️ **CICD-007**: deploy-prod.ymlの更新・SSM対応（90%完了）。1台構成での本番環境デプロイ対応、SSM Parameter Store統合、systemdサービス管理への移行を実装。AWS設定修正（INF-031）完了後にワークフロー成功確認予定。

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

## 📦 データライフサイクル管理

SOL-Botには自動データアーカイブ機能が実装されています：

### 主な機能

- **自動アーカイブ**: 90日以上経過したデータファイルをS3に自動移行
- **Glacier対応**: S3保存後30日でGlacierへの段階的移行（コスト最適化）
- **IAMロール統合**: EC2インスタンスロールによる安全なS3アクセス
- **ファイルタイプ対応**: Parquet（取引データ）、JSON（メトリクス）、ログファイル

### 使用方法

```bash
# 手動実行
npm run data-lifecycle:now

# スケジュール実行（バックグラウンド）
npm run data-lifecycle:schedule

# cronジョブ設定（毎日深夜2時に実行）
0 2 * * * cd /opt/solbot && node dist/scripts/data-lifecycle-manager.js --run-now >> logs/data-lifecycle.log 2>&1
```

### 必要な設定

- S3バケット: `solbot-data`（通常アーカイブ）、`solbot-archive-nijori`（長期保存）
- IAMロール権限: s3:PutObject, s3:GetObject, s3:DeleteObject, s3:ListBucket

詳細な設定方法は[AWS S3設定ガイド](docs/AWS-S3-SETUP.md)を参照してください。

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
