# SOL-Bot プロジェクト構造

## 目次

1. [フォルダ構成](#フォルダ構成)
2. [コンポーネント設計](#コンポーネント設計)
3. [市場分析と戦略](#市場分析と戦略)
4. [注文管理システム（OMS）](#注文管理システムoms)
5. [データ処理と最適化](#データ処理と最適化)
6. [モジュールシステム](#モジュールシステム)
7. [テストとCI/CD](#テストとcicd)
8. [インフラストラクチャ](#インフラストラクチャ)
9. [セキュリティと運用](#セキュリティと運用)
10. [監視システム](#監視システム)
11. [Todoタスク管理](#todoタスク管理)
12. [マルチアセット対応計画](#マルチアセット対応計画)
13. [ドキュメント体系](#ドキュメント体系)
14. [開発環境とツール](#開発環境とツール)

## フォルダ構成

このプロジェクトは以下のフォルダ構造で構成されています：

```
SOL-Bot/
├── .cursor/                    # Cursor IDE設定
├── .github/                    # GitHub Actions設定
│   ├── workflows/              # CI/CDワークフロー定義
│   │   ├── ci.yml                  # 基本CI/CDパイプライン
│   │   ├── deploy-stg.yml          # ステージング環境自動デプロイ（SCP+systemd）
│   │   ├── deploy-prod.yml         # 本番環境デプロイ
│   │   ├── esm-tests.yml           # ESM環境テスト実行
│   │   ├── security-scan.yml       # セキュリティスキャン
│   │   ├── trivy-dependency-scan.yml # 依存関係脆弱性スキャン
│   │   ├── todo-check.yml          # Todoフォーマット検証
│   │   ├── pr-todo-auto-update.yml # PR時のTodoタスク更新
│   │   └── pr-label-check.yml      # PRラベル検証
│   ├── dependabot.yml          # Dependabot自動更新設定
│   └── PULL_REQUEST_TEMPLATE.md # PRテンプレート
├── .todo/                      # Todo管理システム
│   ├── backlog.mdc             # 未着手タスク (inbox)
│   ├── sprint.mdc              # 今スプリントの WIP/Done
│   ├── archive.mdc             # 完了タスク
│   └── todo-format.md          # Todoフォーマットガイドライン
├── data/                       # データストレージ
│   ├── candles/                # ローソク足データ（Parquet形式）
│   ├── orders/                 # 注文履歴
│   ├── optimization/           # 最適化結果YAML
│   └── metrics/                # パフォーマンスメトリクス
├── docs/                       # ドキュメント
│   ├── UserManual.md           # ユーザーマニュアル
│   ├── index.md                # ドキュメント索引
│   ├── Docker-Setup.md         # Docker環境構築ガイド
│   ├── AWS-S3-SETUP.md         # AWS S3/Glacier設定ガイド
│   ├── systemd-deployment.md   # systemdサービスデプロイメントガイド
│   └── gitleaks-setup.md       # Gitleaksセキュリティスキャン設定ガイド
├── infra/                      # インフラストラクチャ
│   ├── systemd/                # systemdサービス設定
│   │   └── bot.service         # systemdサービスファイル（TimeoutStopSec=30、セキュリティ強化設定）
│   └── terraform/              # Terraform IaC定義
│       └── staging/            # ステージング環境
│           ├── main.tf         # 主要リソース定義（EC2、セキュリティグループ、IAM）
│           ├── variables.tf    # 変数定義
│           ├── outputs.tf      # 出力値定義
│           ├── terraform.tfvars.example # 変数設定例
│           └── README.md       # ステージング環境ドキュメント
├── logs/                       # ログファイル
├── monitoring/                 # 監視システム
│   ├── alertmanager/           # Alertmanager設定
│   ├── grafana/                # Grafanaダッシュボード
│   ├── prometheus/             # Prometheus設定
│   └── logrotate/              # ログローテーション設定
├── scripts/                    # 運用スクリプト
│   ├── deploy.sh               # デプロイ自動化スクリプト
│   ├── monitor.sh              # システム監視スクリプト
│   ├── ec2-setup.sh            # EC2初期セットアップスクリプト
│   ├── install-systemd-service.sh # systemdサービスインストールスクリプト
│   └── deploy-to-systemd.sh    # systemd環境へのデプロイスクリプト
├── src/                        # ソースコード
│   ├── __tests__/              # テストコード
│   ├── config/                 # 設定ファイル、パラメータ定義
│   ├── core/                   # コアロジック
│   ├── data/                   # データ処理、永続化
│   ├── indicators/             # テクニカル指標計算
│   ├── optimizer/              # パラメータ最適化
│   ├── scripts/                # コマンドラインスクリプト
│   │   └── cliCommands.md      # CLIコマンドリファレンス
│   ├── services/               # 外部サービス連携
│   ├── strategies/             # トレーディング戦略
│   ├── utils/                  # ユーティリティ関数
│   └── docs/                   # API仕様など
├── Dockerfile                  # Dockerビルド定義
├── docker-compose.yml          # Docker Compose設定
├── package.json                # 依存関係定義
├── tsconfig.json               # TypeScript設定
├── README.md                   # プロジェクト説明
├── PROJECT_STRUCTURE.md        # プロジェクト構造説明
└── SECURITY.md                 # セキュリティポリシーとガイド
```

## コンポーネント設計

### コア (src/core/)

- **types.ts**: システム全体の型定義（Candle, Order, Position等）、タイムスタンプの型ガード関数
- **tradingEngine.ts**: トレーディングエンジンのメインロジック
  - 市場環境判定と戦略選択機能
  - ポジション偏りヘッジ機能
  - スリッページと手数料計算
  - メトリクス更新とエラー監視統合
- **backtestRunner.ts**: バックテスト実行と評価指標計算
  - シャープレシオ、最大ドローダウン、勝率などの計算
  - バッチ処理によるメモリ効率の最適化
  - メモリ使用量モニタリングとGCサイクル制御
- **orderManagementSystem.ts**: 注文管理と取引所連携
  - 未決済注文の自動チェック
  - 注文状態の同期と更新
- **multiSymbolTradingEngine.js**: マルチシンボル取引エンジン（REF-036で最適化済み）
  - 複数通貨ペアの同時取引管理
  - シンボル間の相関分析とリスク管理
  - 統合されたポートフォリオ管理
  - AllocationManagerとPortfolioRiskAnalyzerを活用
- **AllocationManager.js**: 資金配分管理モジュール（REF-036で分離）
  - 均等配分、カスタム配分、ボラティリティベース配分
  - 時価総額ベース配分（将来実装予定）
  - 動的配分比率の再計算機能
- **PortfolioRiskAnalyzer.js**: ポートフォリオリスク分析モジュール（REF-036で分離）
  - VaR（Value at Risk）計算
  - 集中リスクと相関リスクの分析
  - 相関行列の自動更新
  - ストレステスト結果の提供

### インジケーター (src/indicators/)

- **marketState.ts**: 市場状態分析ロジック
  - EMA傾き、ATR、RSI、ADXによる市場環境判定
  - トレンド/レンジの強度判定
  - VWAPとボラティリティ計測
  - 緊急モード判定と復帰ロジック
  - IncrementalEMA/IncrementalATRによる高速計算
  - Wilder's ATRアルゴリズム実装（technicalindicatorsライブラリとの完全互換性）
- **parabolicSAR.ts**: トレンド転換点検出とストップロス設定
  - インクリメンタル計算対応で効率的なリアルタイム更新

### 戦略 (src/strategies/)

- **trendFollowStrategy.ts**: 改良版トレンドフォロー戦略
  - Donchianブレイク+ADXによるエントリー
  - Parabolic SARによる追従システム
  - リスクベースのポジションサイジング
  - 複数トレイリングストップ手法（損益分岐点移動、利益確定等）
- **meanReversionStrategy.ts**: レンジ/ミーンリバース戦略
  - DonchianRange基準のグリッド注文
  - Maker-only Limit注文方式
  - 動的グリッドレベル（ATR%ベース）
  - ポジション偏りヘッジ（15%以上の偏りで自動調整）
- **DonchianBreakoutStrategy.ts**: ブレイクアウト戦略（ATRベースのストップロス）
- **trendStrategy.ts**: 基本トレンド戦略（ATRトレイリングストップ、追い玉機能）
- **rangeStrategy.ts**: 基本レンジ戦略（動的グリッドレベル計算）

### ユーティリティ (src/utils/)

- **logger.ts**: 構造化ロギング（環境別ログレベル設定）
- **positionSizing.ts**: リスクベースのポジションサイジング
- **orderUtils.ts**: 注文と約定情報の同期ユーティリティ
- **metrics.ts**: Prometheusメトリクスエクスポーター
- **atrUtils.ts**: ATR計算とフォールバック機能
- **todoValidator.ts**: Todoタスク形式検証ツール

### サービス (src/services/)

- **orderSizingService.ts**: マルチアセット対応の注文サイズ計算
  - 各通貨ペアの最小注文量、精度に対応
  - リスクベースのポジションサイズ自動計算
- **exchangeService.ts**: 取引所API統合
  - 複数取引所対応（Binance, Bybit, KuCoin等）
  - 高度な注文タイプ（Post-Only, Hidden, OCO等）
  - 自動リトライとエラー処理機能
- **secretManager/**: API Key、シークレット管理
  - 複数バックエンド対応（AWS, GCP, 環境変数, ファイル）
  - ファクトリーパターンによる実装切替

## 市場分析と戦略

### 市場環境判定ロジック

MarketState分析では、以下の環境を識別します：

- **STRONG_UPTREND/STRONG_DOWNTREND**: 強いトレンド環境（傾き高、長短EMA同方向、ADX>25）
- **UPTREND/DOWNTREND**: 通常のトレンド環境
- **WEAK_UPTREND/WEAK_DOWNTREND**: 弱いトレンド（微かな傾向あり）
- **RANGE**: レンジ相場（低ボラティリティ、傾き小）
- **EMERGENCY**: 急激な価格変動時（ブラックスワンイベント）

### 戦略選択ロジック

市場環境に応じて、以下の戦略を自動選択します：

- トレンド環境 → **Donchianブレイクアウト**または**トレンドフォロー**戦略
- レンジ環境 → **グリッド**または**ミーンリバース**戦略
- 急激な変動時 → **緊急戦略**（ポジション半減、トレイリングストップ強化）
- ポジション偏り時 → **ヘッジ戦略**（15%以上の偏りで自動調整）

### リスク管理

- **最大取引リスク**: 口座残高の1%
- **日次損失上限**: 口座残高の5%（超過時取引停止）
- **ポジションサイジング**: ATRベースのリスク計算
- **トレイリングストップ**: ATR × 1.2の動的計算
- **ブラックスワン対策**: 急激な価格変動時にポジション半減
- **ATRフォールバック**: ATR=0時のフォールバック機能

## 注文管理システム（OMS）

- 注文の作成、追跡、キャンセルの統合管理
- ポジション管理（新規、追加、部分決済）
- 損益計算（実現/未実現PnL）
- 高度な注文タイプ
  - **Post-Only**: メイカーとしてのみ約定
  - **Hidden**: 板に表示されない注文
  - **Iceberg**: 大口注文の分割表示
  - **OCO**: One-Cancels-the-Other注文
- 注文状態同期機能
  - **syncOrderForSimulateFill**: 注文結果を約定シミュレータに連携
  - **syncFillWithOrder**: 約定情報と注文オブジェクト同期
  - **updateOrderStatus**: 取引所固有の状態文字列を標準化

## データ処理と最適化

### データ永続化

- **Parquet形式**: 列指向の効率的データ保存
- **DuckDB**: 高速分析SQL処理
- **マルチタイムフレーム対応**: 1m, 15m, 1h, 1d の統合管理
- **定期実行**: node-cronによるスケジュール実行

### データアクセス (src/data/)

- **dataRepository.ts**: データの永続化と取得
  - マルチシンボル対応
  - 非同期ミューテックスによる並列アクセス制御
  - ファイル単位のアトミック書き込み保証
- **parquetDataStore.ts**: 高速Parquetデータストア
- **marketDataFetcher.ts**: 市場データ取得
- **MultiTimeframeDataFetcher.ts**: 複数時間足データ処理
- **generateSampleData.ts**: 合成データ生成ツール
- **RealTimeDataProcessor.ts**: リアルタイムデータ処理
  - LRUキャッシュ実装によるメモリ最適化
  - バックプレッシャー機能
  - メモリ使用量監視とGC制御
  - 動的バッファサイズ調整

### パラメータ最適化

- **Optunaによるベイズ最適化**: 効率的なハイパーパラメータ探索
- **最適化対象パラメータ**:
  - ATR_PERCENTAGE_THRESHOLD: レンジ/トレンド判定閾値
  - TRAILING_STOP_FACTOR: トレイリングストップ係数
  - GRID_ATR_MULTIPLIER: グリッド間隔計算乗数
  - EMA_SLOPE_THRESHOLD: EMA傾き閾値
  - ADJUST_SLOPE_PERIODS: EMA傾き計算期間
- **評価指標**: シャープレシオ、カルマーレシオ、ソルティノレシオ
- **ウォークフォワード検証**: 過学習防止のための期間分割テスト

## モジュールシステム

### CommonJS形式の採用（INF-030対応）

SOL-Botは、安定性と互換性を優先するため、CommonJSモジュールシステムを採用しています。これは以下の利点があります：

1. **安定性**: Node.jsの長期的なサポート形式であるCommonJSを使用することで、環境間の互換性問題を最小限に抑えられます。
2. **互換性**: 多くのNode.jsライブラリやツールがCommonJSを前提としており、シームレスな統合が可能です。
3. **デバッグ容易性**: より成熟したエコシステムのため、問題発生時の解決が容易です。
4. **Docker環境での安定性**: 特にコンテナ環境での動作が安定しています。

#### CommonJSでのインポート/エクスポート規約

- **インポート**: 
  ```javascript
  const { Module } = require('./path/to/module');
  const dependencyModule = require('dependency-name');
  ```

- **エクスポート**:
  ```javascript
  class MyClass {
    // クラス実装
  }
  
  function utilityFunction() {
    // 関数実装
  }
  
  module.exports = {
    MyClass,
    utilityFunction
  };
  ```

#### TypeScriptとの統合

- TypeScript設定では`"module": "CommonJS"`を指定し、CommonJS形式の出力を生成します。
- `esModuleInterop`と`allowSyntheticDefaultImports`オプションにより、CommonJSモジュールをESM風の構文でインポート可能です。

```typescript
// TypeScript内でのインポート
import express from 'express'; // 内部的にはrequire('express')に変換されます
import { ComponentClass } from './component';

// エクスポート
export class MyService {
  // サービス実装
}
```

#### モジュール参照規約

- 相対パスインポートでは拡張子（.js）を省略可能
  ```javascript
  const { util } = require('./utilities');
  ```

- パッケージ参照は完全なパッケージ名を使用
  ```javascript
  const axios = require('axios');
  ```

- 内部モジュールは明示的なパスで参照
  ```javascript
  const { TradingEngine } = require('../../core/tradingEngine');
  ```

## テストとCI/CD

### テスト環境

- **Jest**: TypeScriptテストフレームワーク
- **ESM対応**: テスト環境のES Module完全対応

  - Jest設定ファイルのESM設定
  - テストファイルの.mjs拡張子対応
  - テスト実行用カスタムスクリプト
  - Jestモック関数のESM互換実装
  - **進捗状況**: ESM対応は完了 ✅

- **統合テスト実行システム**:
  - **TST-084**: 統合テスト実行スクリプト実装
  - CJS/ESMの両モード対応テスト自動実行
  - テストグループ別実行機能（fast/medium/slow/heavy/core/esm）
  - 詳細なテスト統計とパフォーマンス計測
  - レポート生成と履歴保存機能
  - NPMスクリプト連携（test:unified）
  - グループ別タイムアウト設定と並列実行オプション
  - 実行環境情報の記録と表示
  - ベースライン時間との比較機能

### テスト戦略

- **テストタイプ**:
  - **実装テスト**: 実際のコード実装をテスト（基本アプローチ）
  - **コントラクトテスト**: インターフェース契約のみをテスト（補助的アプローチ）
  - **ハイブリッドアプローチ**: 必要に応じて両方を使用

- **CommonJS対応状況**:
  - 実装の正確さを維持したままCommonJS形式に変換
  - **INF-032-9**: 現在進行中のテストファイル変換タスク（進捗: 50%）
  - Jest環境でのモック関数設定パターンを確立
  - 循環参照問題の解決策を導入

- **テスト変換ガイドライン**:
  - 元のテスト機能とカバレッジの維持を最優先
  - TypeScript固有機能の適切なJavaScript置換
  - スパイ/モック設定の標準化
  - 詳細なドキュメント化（`docs/INF-032-CommonJS-Test-Fix.md`）

- **テストグループ分類**:
  - **fast**: 高速テスト（utils, config, indicators）< 3秒/テスト
  - **medium**: 中速テスト（strategies, services）3-10秒/テスト
  - **slow**: 低速テスト（一部services）10-30秒/テスト
  - **heavy**: 特に重いテスト（RealTimeDataProcessor）30秒以上/テスト
  - **core**: コア機能テスト（core）
  - **esm**: ESMテスト（.mjs拡張子）

- **テストヘルパーユーティリティ**:
  - `export-esm-mock.mjs`: ESM環境でのモック作成ヘルパー
  - `test-cleanup-utils.js`: 非同期処理クリーンアップユーティリティ
  - カスタムテストランナー（ハング検出と強制終了機能付き）
  - モックデータファクトリー関数
    - `MarketDataFactory`: 市場データ生成
    - `TestScenarioFactory`: 戦略テスト用シナリオ生成
    - 固定シード値によるランダムデータの再現性確保
  - **モックファクトリー** (TST-055):
    - `strategyMocks.js/mjs`: 戦略モジュールのモックファクトリー
    - `serviceMocks.js/mjs`: サービスモジュールのモックファクトリー
    - `dataMocks.js/mjs`: データ関連モジュールのモックファクトリー
      - `createDataRepositoryMock`: データリポジトリモック
      - `createParquetDataStoreMock`: Parquetデータストアモック
      - `createMultiTimeframeDataFetcherMock`: マルチタイムフレームデータフェッチャーモック
      - `createRealTimeDataProcessorMock`: リアルタイムデータプロセッサーモック
    - `setupAllMocks`: すべてのモジュールを一括モック化する関数
    - **デュアルフォーマット対応**: ESM/CJS両環境での一貫したモックパターン実装

- **ESM対応ドキュメント**:
  - `ESM-Migration-Guide.md`: ESM環境での開発とテストのガイド
  - `esm-migration-issues.md`: 移行プロセスで見つかった問題と解決策の記録

- **テストカバレッジ目標**:
  - 全体コード: 90%以上（CI/CDによる自動検証）
  - ブランチ: 80%以上
  - 関数: 85%以上
  - 行: 90%以上
  - ステートメント: 90%以上

### スモークテスト

- **CI/CD用の軽量テスト**: GitHub Actionsでの自動実行
- **検証基準**:
  - 最小プロフィットファクター: 0.8
  - 最大ドローダウン: 30%以下
  - 最小シャープレシオ: -1.0以上
  - 最小取引数: 3件以上
- **強制シグナル生成**: データ不足時でもテスト実行可能

### バックテスト

- **パラメータ検証**: 異なる市場環境での戦略検証
- **スリッページ・手数料シミュレーション**: 現実的な取引コスト
- **複数評価指標**: 多角的なパフォーマンス分析

### CI/CD統合

- **GitHub Actions**: プッシュ時の自動テスト・ビルド・デプロイ
- **自動デプロイメント**:
  - **ステージング環境** (`deploy-stg.yml`): rsync+SCP方式でEC2への安全なデプロイ
  - **本番環境** (`deploy-prod.yml`): 本番環境への制御されたデプロイ
  - **systemd連携**: 自動サービス起動・ヘルスチェック・Discord通知
- **ESMテスト環境** (`esm-tests.yml`): ESM専用テスト実行とモック互換性検証
- **テストカバレッジ検証**:
  - HTML/LCOVレポート生成
  - カバレッジ閾値のゲート機能（PRがカバレッジ基準を満たさない場合はマージ不可）
  - コードのホットスポットの可視化
- **Todo検証**: PRマージ時のタスク状態自動更新
- **セキュリティチェック**: リリース前の機密情報スキャン
- **Discord通知**: デプロイ結果の自動通知

## インフラストラクチャ

SOL-Botのインフラストラクチャは、Infrastructure as Code（IaC）の原則に基づいてTerraformで管理されています。

### Terraform構成

#### ステージング環境 (infra/terraform/staging/)

**INF-026タスクで実装済み** ✅

- **main.tf**: 主要なAWSリソース定義
  - EC2インスタンス（t3.small）
  - セキュリティグループ（SSH、HTTP、HTTPS、API、Prometheus用ポート）
  - IAMロール・ポリシー・インスタンスプロファイル
  - Elastic IP（固定パブリックIP）
  - 自動セットアップ用user-data（Docker、Node.js、ディレクトリ構造）

- **variables.tf**: 設定可能な変数定義
  - AWSリージョン、アカウントID
  - VPC・サブネット設定
  - インスタンスタイプ、キーペア名
  - アプリケーション設定

- **outputs.tf**: 作成されたリソース情報の出力
  - インスタンスID、パブリックIP、DNS名
  - セキュリティグループID、IAMロールARN

- **terraform.tfvars.example**: 設定例ファイル

### 実際のAWSリソース（ステージング環境）

| リソース | 値 | 説明 |
|----------|-----|------|
| **EC2インスタンス** | `i-0dbe2af5c7b01181e` | ステージング環境のメインサーバー |
| **パブリックIP** | `13.158.58.241` | 固定IPアドレス（Elastic IP） |
| **パブリックDNS** | `ec2-18-183-190-79.ap-northeast-1.compute.amazonaws.com` | DNS名 |
| **セキュリティグループ** | `sg-090defb21d10228f6` | ファイアウォール設定 |
| **IAMロール** | `arn:aws:iam::475538532274:role/solbot-stg-role` | 権限管理 |

### 自動セットアップ機能

EC2インスタンス起動時に以下が自動インストール・設定されます：

- **Docker & Docker Compose**: コンテナ実行環境
- **Node.js 18**: アプリケーション実行環境
- **ディレクトリ構造**: `/opt/solbot/`配下の必要なディレクトリ
- **環境変数**: 本番環境用の設定
- **タイムゾーン**: UTC設定

### セキュリティ設定

- **IAMロール**: 最小権限の原則に基づく権限設定
  - S3アクセス権限（ログ保存用）
  - SSMパラメータストアアクセス権限（機密情報管理用）
- **セキュリティグループ**: 必要最小限のポート開放
  - SSH (22), HTTP (80), HTTPS (443)
  - API (3000), Prometheus (9090)
- **Elastic IP**: 固定IPによる安定したアクセス

### 運用管理

- **コスト管理**: t3.smallインスタンスの時間課金
- **停止/開始**: 使用しない時間帯の停止によるコスト削減
- **Terraformステート**: terraform.tfstateファイルの適切な管理
- **機密情報**: terraform.tfvarsファイルのGit除外

### systemdサービス管理

**INF-027タスクで実装済み** ✅

- **systemdサービスファイル** (`infra/systemd/bot.service`):
  - TimeoutStopSec=30による適切なプロセス終了
  - KillMode=mixedによる安全なプロセス管理
  - セキュリティ強化設定（NoNewPrivileges, PrivateTmp等）
  - 自動再起動とリソース制限設定
  - systemd journalとの統合ログ管理

- **インストールスクリプト** (`scripts/install-systemd-service.sh`):
  - solbotシステムユーザーの自動作成
  - /opt/solbot/ディレクトリ構造の設定
  - systemdサービスの有効化と設定

- **デプロイスクリプト** (`scripts/deploy-to-systemd.sh`):
  - アプリケーションファイルの安全なデプロイ
  - 依存関係の自動インストール
  - サービスの起動確認とヘルスチェック
  - バックアップ機能付きの無停止デプロイ

- **運用管理**:
  ```bash
  # サービス管理
  sudo systemctl start bot
  sudo systemctl stop bot
  sudo systemctl restart bot
  sudo systemctl status bot
  
  # ログ確認
  sudo journalctl -u bot -f
  sudo journalctl -u bot -n 50
  ```

### 今後の拡張計画

- **本番環境**: infra/terraform/production/の追加
- **リモートステート**: S3バックエンドによるステート管理
- **マルチAZ構成**: 高可用性のための冗長化
- **Auto Scaling**: 負荷に応じた自動スケーリング
- **RDS**: データベースの外部化

## セキュリティと運用

### セキュリティ対策

- **シークレットマネージャー**: 機密情報の安全な管理
  - AWS Parameter Store、GCP Secret Manager対応
  - 開発/本番環境での適切な実装切替
  - ファクトリーパターンによる実装切替
- **Gitleaksによる機密情報スキャン**:
  - コミット前と定期実行による自動スキャン
  - プッシュ時、PR時、日次バッチスキャン
  - APIキー、ウォレットキー、AWS認証情報等の検出
  - 誤検知防止のための除外設定
- **緊急停止機能（Kill Switch）**:
  - フラグファイルベースの緊急停止メカニズム
  - 起動時と定期実行時（5分間隔）の停止フラグチェック
  - 安全なプロセス終了とリソース解放
  - トレーディングエンジンとの統合によるポジション安全停止
  - フォールセーフ実装によるエラー発生時の安全停止
  - 本番環境での systemctl サービス連携
- **依存関係脆弱性スキャン**:
  - Trivyによる依存パッケージ脆弱性スキャン
  - 重大度別報告（CRITICAL/HIGH優先）
  - 修正不可の脆弱性は除外可能
  - 週次の自動スキャンと結果レポート
  - PRレビュー時の自動脆弱性チェック
  - SARIF形式での結果出力とGitHub Security統合
  - PR作成時の自動コメント機能（検出脆弱性のサマリー）
  - スキャン結果のGitHub Actions Artifactとしての保存
- **Dependabot自動更新**:
  - npmパッケージの週次自動アップデート
  - GitHub Actions依存関係の自動更新
  - 開発依存性/本番依存性のグループ化
  - マイナー/パッチ更新の自動PR作成
  - メジャーバージョン更新の手動レビュー
  - PRラベル自動付与（dependencies, security）
  - カスタムコミットメッセージプレフィックス
  - 更新タイプに基づく差別化管理
  - 自動更新によるセキュリティリスクの継続的な低減
- **SBOM生成と管理**:
  - CycloneDXによるソフトウェア部品表（SBOM）生成
  - 依存関係の透明性確保
  - Trivyとの統合による包括的な脆弱性管理
- **セキュリティレポート**:
  - 各スキャン結果の統合レポート
  - Artifactとしての保存と履歴管理
- **非rootユーザー実行**: 専用ユーザー（solbot）でのコンテナ実行
- **最小権限の原則**: 必要最小限の権限設定
- **セキュリティポリシードキュメント**:
  - SECURITY.mdによる包括的なセキュリティ方針の明示
  - 脆弱性の報告手順と連絡先の定義
  - 安全なAPI認証管理のベストプラクティス
  - ブランチ保護ルールとデプロイセキュリティ対策
  - セキュリティアップデート履歴の管理

### インフラストラクチャ運用

- **Docker環境**:
  - マルチステージビルド（開発/本番分離）
  - 非rootユーザー実行
  - ヘルスチェックによる自動復旧
- **監視・運用**:
  - コンテナ状態、リソース使用量の監視
  - 閾値超過時のDiscord通知
  - 定期バックアップと自動ログローテーション
- **データライフサイクル管理**:
  - 古いデータファイル（Parquet/Log）の自動検出と移行
  - AWS S3バケットへの自動アップロード
  - S3からGlacierへの段階的移行
  - cronによるスケジュール実行
  - カスタマイズ可能な保持期間設定
  - シンボル別のディレクトリ構造維持
  - ファイルタイプ別処理（Parquet, JSON, Log）
  - 日付ベースの自動アーカイブ
  - AWS SDK for JavaScriptによるS3/Glacier連携
  - ファイルの自動カテゴリ分類と整理
  - コマンドライン引数によるモード切替（即時実行/スケジュール実行）
  - 詳細なロギングとエラーハンドリング
  - 環境変数による設定カスタマイズ（保持期間、バケット名、リージョン等）

### コマンドラインスクリプト

- **fetchMultiTimeframeData.ts**: 複数時間足データ取得
- **todo-lint.ts**: Todoタスク形式検証
- **fix-todo-issues.ts**: Todo問題自動修正
- **data-lifecycle-manager.ts**: データのライフサイクル管理
  - 90日以上前のデータファイルをS3に移行
  - S3のデータをGlacierに自動アーカイブ
  - コマンドライン引数によるモード切替（--run-now/--schedule）
  - 再帰的なディレクトリスキャンとファイル検出
  - ファイルの日付と種類に基づく自動分類
  - CRONスケジュールによる定期実行
  - 環境変数によるカスタマイズ（DATA_RETENTION_DAYS, GLACIER_MOVE_DAYS等）

## 監視システム

監視スタックは以下のコンポーネントで構成：

### Prometheusとメトリクス

- **主要メトリクス**:
  - 取引残高、日次損益、勝率
  - 最大ドローダウン、取引数
  - CPU/メモリ/ディスク使用率
  - エラー率、応答時間
- **アラートルール**: 異常検知と自動通知

### Grafanaダッシュボード

- **トレーディングパフォーマンス**: 残高推移、損益率
- **システムリソース**: リソース使用状況
- **トレード分析**: 勝率、平均損益
- **メトリクスエクスポート**: Express APIによる公開

### Alertmanager

- **通知先**: Discord連携
- **通知テンプレート**: カスタマイズ可能なフォーマット
- **通知グループ化**: アラート集約と重複抑制

## Todoタスク管理

プロジェクトの進捗管理は`.todo/`ディレクトリで専用フォーマットを使用：

### タスク構造

- **backlog.mdc**: 未着手タスク（inbox）
- **sprint.mdc**: 現スプリントのWIP/Done
- **archive.mdc**: 完了タスク（3ヶ月経過後）
- **フォーマット**:
  ```
  - [ ] TASK‑ID: <タイトル>
        - 📅 Due        : YYYY‑MM‑DD
        - 👤 Owner      : <担当者>
        - 🔗 Depends-on : TASK‑ID1, TASK‑ID2
        - 🏷️ Label      : bug / feat / doc / infra
        - 🩺 Health     : ⏳ / ⚠️ / 🚑 / ✅
        - 📊 Progress   : 0% / 25% / 50% / 75% / 100%
        - ✎ Notes      : (メモ)
  ```

### GitHub Actions連携

- **フォーマットチェック**: Todoファイル変更時の自動検証
- **タスク自動更新**: PRマージ時の完了状態更新
- **PRテンプレート**: タスクID参照の強制
- **セキュリティスキャン**:
  - プッシュ時のGitleaksチェック
  - 週次のTrivy脆弱性スキャン
  - SBOM自動生成と管理
  - Dependabotによる依存関係更新

### Todo検証ツール

```bash
npm run todo-lint
```

- **検証項目**:
  - タスクID重複
  - 進捗率/Health整合性
  - 期限切れタスク
  - 依存関係整合性
  - 必須フィールド確認
  - 日付フォーマット検証
  - フィールド値空チェック
  - タスクIDフォーマット
  - アーカイブタスク処理
- **オプション**:
  - `--quiet`: エラーのみ表示
  - `--format=json`: JSON出力
  - `--fix`: 自動修正（一部対応）
- **高度な機能**:
  - front-matterブロックスキップ（`---`や```で囲まれた部分を解析対象外）
  - 先頭に「.」があるタスクIDをアーカイブ済みとして処理
  - エラータイプ別の統計情報表示
  - 柔軟なタスク行・フィールド検出
  - 大文字小文字両方のチェックボックス対応（[x]と[X]）
  - 日付の妥当性厳密チェック（例：2月30日などの無効日付検出）
  - 差分表示モード（--diff）で変更箇所のみを表示
  - 日付比較時のUTC統一による正確な期限切れ判定
  - CI/CD連携による自動チェックと失敗検出
  - 空白文字のみのフィールド値検証機能

## マルチアセット対応計画

### 実装状況

SOL-Botはマルチシンボル対応を実装し、複数の暗号資産ペアを同時に取引できるよう拡張されました：

- **CLI引数拡張（CLI-001）**:
  - `--symbols` オプションで複数シンボル指定（例: `--symbols SOL/USDT,BTC/USDT,ETH/USDT`）
  - `--timeframes` オプションで複数時間足指定（例: `--timeframes 1h,4h,1d`）
  - 結果の集計と保存機能
- **設定ファイル構造変更（CONF-006）**:
  - シンボル別設定をネスト構造で管理
  - デフォルト設定と通貨ペア固有設定の階層化
  - JSON設定ファイルによるオーバーライド機能（`--config-override` オプション）

### コマンドラインインターフェース

SOL-Botは拡張されたCLIインターフェースにより、柔軟な運用が可能です：

```bash
# 基本的な使用方法
npm run cli -- --help  # ヘルプ表示

# マルチシンボル・マルチタイムフレームのバックテスト
npm run cli -- --mode backtest --symbols SOL/USDT,BTC/USDT --timeframes 1h,4h

# 設定オーバーライドを使用したバックテスト
npm run cli -- --config-override src/config/multiSymbolConfig.example.json

# 便利なショートカットコマンド
npm run cli:multisymbols     # 複数シンボル・複数タイムフレームのバックテスト
npm run cli:multiconfig      # 設定ファイルオーバーライドのサンプル実行
```

### マルチアセット対応の実装状況

マルチアセット対応は以下の機能を含め、完全に実装されました：

1. **UTIL-002: 通貨ペア情報取得ユーティリティ**（完了 ✅）

   - SymbolInfoServiceを実装し、複数通貨ペア情報を一括取得・キャッシュ
   - 取引所API過剰リクエスト防止のためのキャッシュ機構
   - ティックサイズ・ステップサイズ計算、手数料情報抽出機能

2. **ALG-040: ATR%自動キャリブレーション**（完了 ✅）

   - ATRCalibratorクラスによるボラティリティプロファイル対応
   - LOW/MEDIUM/HIGH/EXTREMEプロファイルに基づくパラメータ自動調整
   - キャッシュ機能とCLIツールによるキャリブレーション

3. **DAT-014: データストアマルチシンボル拡張**（完了 ✅）

   - シンボル固有のディレクトリ構造の実装
   - 複数シンボルの横断検索機能
   - loadMultipleSymbolCandlesなどのマルチシンボル対応API

4. **CORE-005: バックテストランナーの拡張**（完了 ✅）

   - 複数シンボルの同時バックテスト
   - 資金配分戦略（EQUAL/CUSTOM/VOLATILITY/MARKET_CAP）
   - ポートフォリオリスク管理、相関分析機能

5. **OMS-009: 複数取引所対応**（完了 ✅）
   - UnifiedOrderManagerによる取引所間の注文統合管理
   - 取引所間の注文配分アルゴリズム
   - 取引所特有の制約への自動対応

## ドキュメント体系

SOL-Botのドキュメント体系は、利用者、管理者、開発者向けに分類され、実装されています：

### 利用者向けドキュメント

- **UserManual.md**: SOL-Botの包括的な使用方法ガイド
  - インストールと設定
  - 基本的な使用方法
  - コマンドラインオプション
  - バックテスト実行方法
  - マルチシンボル対応
  - ライブトレード設定
  - データ管理と監視方法
  - トラブルシューティング
  - 動的パラメータ調整機能
  - ボラティリティベースの資金配分機能
- **cliCommands.md**: コマンドラインインターフェースのリファレンスガイド
  - 基本コマンドと使用例
  - パラメータ設定オプション
  - 出力と保存オプション
  - 設定オーバーライド方法
  - 市場状態と動的調整オプション
  - 資金配分設定オプション
  - ショートカットコマンド
  - 実行例と環境変数の連携

### 管理者向けドキュメント

- **Docker-Setup.md**: Docker環境構築ガイド
  - 開発環境と本番環境のセットアップ
  - コンテナ構成と依存関係
  - ボリュームマウントとデータ永続化
- **AWS-S3-SETUP.md**: AWS S3/Glacier設定ガイド
  - データライフサイクル管理のAWS設定
  - バケット設定と権限管理
  - データ移行ポリシー
- **gitleaks-setup.md**: セキュリティスキャン設定ガイド
  - Gitleaksのセットアップと設定
  - スキャン実行方法と結果解釈
  - 誤検知の除外設定

### ドキュメント整備と管理

- **index.md**: ドキュメント索引
  - 全ドキュメントへの一元的なアクセスポイント
  - 主要ドキュメントの簡単な説明とリンク
  - クイックスタートガイド
- **SECURITY.md**: セキュリティポリシーとガイドライン
  - セキュリティ対策の概要
  - 脆弱性報告方法
  - セキュリティベストプラクティス
- **PROJECT_STRUCTURE.md**: プロジェクト構造の包括的な説明
  - フォルダ構成と役割
  - コンポーネント設計
  - モジュール間の依存関係
  - 拡張方法

ドキュメントは`docs/`ディレクトリと`src/scripts/cliCommands.md`に配置され、READMEからリンクされています。すべてのドキュメントは更新時に他のドキュメントとの一貫性を維持するよう管理されています。

## 開発環境とツール

### 既知の問題

- **REF-032**: Docker環境でのESモジュール起動問題
  - 現在、Docker環境でアプリケーション起動時に「ERR_UNKNOWN_MODULE_FORMAT」エラーが発生
  - ts-nodeとESモジュールの設定問題により、/api/statusエンドポイントが正常に動作しない
  - ヘルスチェック機能自体は実装済みで、アプリケーション起動問題の解決が必要

### 依存関係

- **typescript**: 静的型付け
- **ccxt**: 暗号資産取引所API接続
- **technicalindicators**: テクニカル分析
- **express**: REST API提供
- **winston**: 構造化ロギング
- **duckdb**: 高性能分析データベース
- **parquetjs**: Parquetデータ処理
- **optuna**: パラメータ最適化
- **prom-client**: Prometheusメトリクス生成

### 実行モード

- **シミュレーション**: `npm run simulation`
- **バックテスト**: `npm run backtest`
- **ライブ取引**: `npm run live`
- **最適化**: `npm run optimize`
- **サンプルデータ生成**: `npm run generate-sample-data`
- **テスト**: `npm test`
- **Docker開発環境**: `docker-compose up solbot-dev`
- **Docker本番環境**: `docker-compose up solbot-prod`
- **監視システム**: `cd monitoring && docker-compose up -d`

### セットアップ手順

1. リポジトリをクローン
2. `npm install` で依存関係をインストール
3. `.env.example` を `.env` にコピーして設定
4. `npm run dev` で開発モードで実行
5. または `docker-compose up solbot-dev` でDockerコンテナとして実行

詳細は README.md を参照してください。

## 開発環境

- **言語**: TypeScript（Node.js環境）
- **パッケージ管理**: npm
- **ビルドツール**: tsc（TypeScriptコンパイラ）
- **開発補助**:
  - ESLint（コード品質）
  - Prettier（フォーマット）
  - Jest（テスト）
- **外部ライブラリ**:
  - ccxt: 取引所API統一インターフェース
  - technicalindicators: テクニカル指標計算
  - parquetjs: Parquetファイル操作
  - lru-cache: メモリキャッシュ最適化
  - express: API公開
  - winston: ロギング
  - dotenv: 環境変数
  - commander: CLIインターフェース
  - @solana/web3.js: Solanaブロックチェーン連携
  - node-cron: スケジュールタスク
  - @aws-sdk: S3/Glacierデータアーカイブ

## モジュール構成

### ESMとCommonJSの共存
-Jest自体がESMをネイティブにサポートしていないことから、現状のJestはCommonJSベースで、ESMモジュールをテストするために様々なワークアラウンドが必要
 現状の Jest は内部的に CommonJS をベースに動いており、ESM をネイティブでフルサポートしているわけではありません。

-Jest のアーキテクチャ
  -Jest 本体やプラグイン群は CommonJS モジュールとして書かれており、Node.js の ESM ローダーに完全対応するにはまだ"橋渡し"が必要な部分があります。

-公式の ESM 実験機能
  Node.js の --experimental-vm-modules フラグや、ts-jest/presets/default-esm などのプリセットで ESM テストは可能ですが、テストランナー、モジュールリゾルバ、トランスフォーム周りで細かな不整合や未対応ケースが残っていて、繰り返しワークアラウンドが必要になるのが現状です。

-踏まえESM フルサポートまでの「つなぎ」として一旦 CommonJS モードと共存し実装。将来的に ESM へ移行するメリットは確かにありますが、今は「動くものを動かす」ことにフォーカス。

- **デュアルフォーマットパッケージ**: 両方のモジュールシステムに対応
- **package.json設定**:
  - `"type": "module"` は指定せず、拡張子で区別
  - `"exports"` フィールドで両形式の入口点を指定
  - `"main"`: `"dist/index.js"` (CommonJS)
  - `"module"`: `"dist/index.mjs"` (ESM)
- **拡張子規約**:
  - `.js`: CommonJSモジュール
  - `.mjs`: ESMモジュール
  - `.d.ts`: TypeScript型定義
- **ビルドプロセス**:
  - `npm run build:cjs`: CommonJSビルド
  - `npm run build:esm`: ESMビルド
  - `npm run build`: 両方のビルドを実行
- **推奨ベストプラクティス**:
  - 新規モジュールはESMで作成（`.mjs`拡張子）
  - インポート時は拡張子を明示（`.js`または`.mjs`）
  - 名前付きインポートの使用を推奨、ワイルドカードは避ける

### 環境変数

- **API_KEY**: 取引所APIキー
- **SECRET_KEY**: 取引所APIシークレット
- **TIMEFRAME**: 使用する時間足（1h, 4h, 1d）
- **SYMBOLS**: 対象通貨ペア（例：SOL/USDT, BTC/USDT）
- **DATA_DIR**: データディレクトリ
- **LOG_LEVEL**: ログレベル（debug, info, warn, error）
- **DISCORD_WEBHOOK_URL**: Discord通知用URL
- **AWS_REGION**: AWSリージョン設定
- **AWS_ACCESS_KEY_ID**: AWSアクセスキー
- **AWS_SECRET_ACCESS_KEY**: AWSシークレットキー
- **S3_BUCKET**: S3バケット名
- **S3_ARCHIVE_BUCKET**: S3アーカイブバケット名
- **DATA_RETENTION_DAYS**: データローカル保持日数

### スケジュールタスク（crontab.txt）

- 監視スクリプト実行（毎時5分）
- ログローテーション（毎日午前2時）
- データバックアップ（毎日午前3時）
- システムアップデート（毎週日曜午前4時）
- ディスク使用量レポート作成（毎月1日午前5時）
- S3へのログ同期（毎時30分）
- 古いログファイルをS3 Glacierに移行（毎週月曜午前1時）
- データライフサイクル管理（毎日午前4時）

## Todo管理システム

プロジェクトの進捗管理は`.todo/`ディレクトリで専用フォーマットを使用：

### タスク構造

- **backlog.mdc**: 未着手タスク（inbox）
- **sprint.mdc**: 現スプリントのWIP/Done
- **archive.mdc**: 完了タスク（3ヶ月経過後）
- **フォーマット**:
  ```
  - [ ] TASK‑ID: <タイトル>
        - 📅 Due        : YYYY‑MM‑DD
        - 👤 Owner      : <担当者>
        - 🔗 Depends-on : TASK‑ID1, TASK‑ID2
        - 🏷️ Label      : bug / feat / doc / infra
        - 🩺 Health     : ⏳ / ⚠️ / 🚑 / ✅
        - 📊 Progress   : 0% / 25% / 50% / 75% / 100%
        - ✎ Notes      : (メモ)
  ```

### GitHub Actions連携

- **フォーマットチェック**: Todoファイル変更時の自動検証
- **タスク自動更新**: PRマージ時の完了状態更新
- **PRテンプレート**: タスクID参照の強制
- **セキュリティスキャン**:
  - プッシュ時のGitleaksチェック
  - 週次のTrivy脆弱性スキャン
  - SBOM自動生成と管理
  - Dependabotによる依存関係更新

### Todo検証ツール

```bash
npm run todo-lint
```

- **検証項目**:
  - タスクID重複
  - 進捗率/Health整合性
  - 期限切れタスク
  - 依存関係整合性
  - 必須フィールド確認
  - 日付フォーマット検証
  - フィールド値空チェック
  - タスクIDフォーマット
  - アーカイブタスク処理
- **オプション**:
  - `--quiet`: エラーのみ表示
  - `--format=json`: JSON出力
  - `--fix`: 自動修正（一部対応）
- **高度な機能**:
  - front-matterブロックスキップ（`---`