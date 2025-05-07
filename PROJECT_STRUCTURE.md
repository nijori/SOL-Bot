# SOL-Bot プロジェクト構造

## 目次

1. [フォルダ構成](#フォルダ構成)
2. [コンポーネント設計](#コンポーネント設計)
3. [市場分析と戦略](#市場分析と戦略)
4. [注文管理システム（OMS）](#注文管理システムoms)
5. [データ処理と最適化](#データ処理と最適化)
6. [テストとCI/CD](#テストとcicd)
7. [セキュリティと運用](#セキュリティと運用)
8. [監視システム](#監視システム)
9. [Todoタスク管理](#todoタスク管理)
10. [マルチアセット対応計画](#マルチアセット対応計画)
11. [開発環境とツール](#開発環境とツール)

## フォルダ構成

このプロジェクトは以下のフォルダ構造で構成されています：

```
SOL-Bot/
├── .cursor/                    # Cursor IDE設定
├── .github/                    # GitHub Actions設定
│   └── workflows/              # CI/CDワークフロー定義
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
│   └── Docker-Setup.md         # Docker環境構築ガイド
├── logs/                       # ログファイル
├── monitoring/                 # 監視システム
│   ├── alertmanager/           # Alertmanager設定
│   ├── grafana/                # Grafanaダッシュボード
│   ├── prometheus/             # Prometheus設定
│   └── logrotate/              # ログローテーション設定
├── scripts/                    # 運用スクリプト
│   ├── deploy.sh               # デプロイ自動化スクリプト
│   ├── monitor.sh              # システム監視スクリプト
│   └── ec2-setup.sh            # EC2初期セットアップスクリプト
├── src/                        # ソースコード
│   ├── __tests__/              # テストコード
│   ├── config/                 # 設定ファイル、パラメータ定義
│   ├── core/                   # コアロジック
│   ├── data/                   # データ処理、永続化
│   ├── indicators/             # テクニカル指標計算
│   ├── optimizer/              # パラメータ最適化
│   ├── scripts/                # コマンドラインスクリプト
│   ├── services/               # 外部サービス連携
│   ├── strategies/             # トレーディング戦略
│   ├── utils/                  # ユーティリティ関数
│   └── docs/                   # API仕様など
├── Dockerfile                  # Dockerビルド定義
├── docker-compose.yml          # Docker Compose設定
├── package.json                # 依存関係定義
├── tsconfig.json               # TypeScript設定
└── README.md                   # プロジェクト説明
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

### インジケーター (src/indicators/)

- **marketState.ts**: 市場状態分析ロジック
  - EMA傾き、ATR、RSI、ADXによる市場環境判定
  - トレンド/レンジの強度判定
  - VWAPとボラティリティ計測
  - 緊急モード判定と復帰ロジック
  - IncrementalEMA/IncrementalATRによる高速計算
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
- **parquetDataStore.ts**: 高速Parquetデータストア
- **marketDataFetcher.ts**: 市場データ取得
- **MultiTimeframeDataFetcher.ts**: 複数時間足データ処理
- **generateSampleData.ts**: 合成データ生成ツール

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

## テストとCI/CD

### テスト環境

- **Jest**: TypeScriptテストフレームワーク
- **テストカバレッジ目標**:
  - 新規コード: 90%以上
  - 既存修正コード: 75%以上
- **テスト優先順位**:
  - 論理バグ修正（特にSARシグナル）
  - 共通ユーティリティ（ATRフォールバック）
  - リスク計算（ポジションサイジング）

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
- **Todo検証**: PRマージ時のタスク状態自動更新
- **セキュリティチェック**: リリース前の機密情報スキャン
- **Discord通知**: デプロイ結果の自動通知

## セキュリティと運用

### セキュリティ対策

- **シークレットマネージャー**: 機密情報の安全な管理
  - AWS Parameter Store、GCP Secret Manager対応
  - 開発/本番環境での適切な実装切替
- **Gitleaksによる機密情報スキャン**:
  - コミット前の自動スキャン
  - APIキー、ウォレットキー、AWS認証情報等の検出
  - 誤検知防止のための除外設定
- **非rootユーザー実行**: 専用ユーザー（solbot）でのコンテナ実行
- **最小権限の原則**: 必要最小限の権限設定

### インフラストラクチャ

- **Docker環境**:
  - マルチステージビルド（開発/本番分離）
  - 非rootユーザー実行
  - ヘルスチェックによる自動復旧
- **監視・運用**:
  - コンテナ状態、リソース使用量の監視
  - 閾値超過時のDiscord通知
  - 定期バックアップと自動ログローテーション

### コマンドラインスクリプト

- **fetchMultiTimeframeData.ts**: 複数時間足データ取得
- **todo-lint.ts**: Todoタスク形式検証
- **fix-todo-issues.ts**: Todo問題自動修正

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
- **オプション**:
  - `--quiet`: エラーのみ表示
  - `--format=json`: JSON出力
  - `--fix`: 自動修正（一部対応）

## マルチアセット対応計画

SOL-Botは複数の暗号資産ペアに拡張可能なフレームワークとして設計されています。

### マルチアセット化の主要課題

1. **取引単位とロットサイズの抽象化** ✅
   - OrderSizingServiceによる取引量自動計算
   - 各通貨ペアの最小注文量、精度対応

2. **取引パラメータのペア別設定**
   - 設定ファイルのネスト構造化
   - 通貨ペア固有の設定分離

3. **ボラティリティに応じたパラメータ調整**
   - ATR%ベースのパラメータ自動調整
   - 通貨特性に基づく動的調整

4. **データストアのマルチシンボル対応**
   - 動的ディレクトリ構造
   - マルチシンボルクエリ最適化

5. **ポートフォリオリスク管理**
   - 横断的なリスク集中管理
   - ポジション制限とVaR計算

### 実装フェーズ

#### フェーズ1: 基本対応（完了済み）
- OrderSizingService実装
- ExchangeServiceマルチシンボル対応
- テスト強化

#### フェーズ2: 動的パラメータ調整
- ATR%自動キャリブレーション
- データストアマルチシンボル拡張
- 通貨ペア特性分析

#### フェーズ3: ポートフォリオリスク管理
- PortfolioRiskGuard実装
- マルチエンジン構成
- 監視ダッシュボード拡張

## 開発環境とツール

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