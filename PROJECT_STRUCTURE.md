# SOL-Bot プロジェクト構造

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
│   │   ├── alertmanager.yml    # アラート管理設定
│   │   └── templates/          # 通知テンプレート
│   │       └── discord.tmpl    # Discord通知テンプレート
│   ├── aws/                    # AWSモニタリング設定
│   ├── grafana/                # Grafanaダッシュボード
│   │   └── provisioning/       # Grafana初期設定
│   │       ├── dashboards/     # ダッシュボード定義
│   │       │   ├── dashboard.yaml      # ダッシュボード設定
│   │       │   └── solbot_dashboard.json # SOL-Botダッシュボード
│   │       └── datasources/    # データソース定義
│   │           └── prometheus.yaml     # Prometheusデータソース
│   ├── logrotate/              # ログローテーション設定
│   └── prometheus/             # Prometheus設定
│       ├── prometheus.yml      # Prometheus主設定
│       └── alert_rules.yml     # アラートルール定義
├── scripts/                    # 運用スクリプト
│   ├── deploy.sh               # デプロイ自動化スクリプト
│   ├── monitor.sh              # システム監視スクリプト
│   ├── ec2-setup.sh            # EC2初期セットアップスクリプト
│   └── crontab.txt             # cron設定サンプル
├── src/                        # ソースコード
│   ├── __tests__/              # テストコード
│   │   ├── indicators/         # 指標テスト
│   │   ├── strategies/         # 戦略テスト
│   │   └── smokeTest.ts        # CIパイプライン用スモークテスト
│   ├── config/                 # 設定ファイル、パラメータ定義
│   │   ├── parameters.yaml     # YAML形式の設定パラメータ
│   │   ├── parameters.ts       # TypeScript定数エクスポート
│   │   └── parameterService.ts # パラメータ管理サービス
│   ├── core/                   # コアロジック
│   │   ├── types.ts            # 共通型定義
│   │   ├── constants.ts        # 定数定義
│   │   ├── tradingEngine.ts    # メイン取引エンジン
│   │   └── backtestRunner.ts   # バックテスト実行エンジン
│   ├── indicators/             # テクニカル指標計算
│   │   ├── marketState.ts      # 市場状態分析ロジック（EMA傾き、ATR、RSI、ADXを利用した市場環境判定）、トレンド/レンジ判定、ボラティリティ計測、ATRとEMA計算および分析機能強化、EMERGENCYモードからの復帰ロジック（24時間以上、価格変動がBLACK_SWAN_THRESHOLD/2未満）、VWAP計算機能追加（ミーンリバース戦略のサポート）、IncrementalEMA/IncrementalATRクラスの内部実装（増分計算に対応した高速なEMA/ATR計算）
│   │   └── parabolicSAR.ts     # Parabolic SAR（Stop and Reverse）指標の実装、トレンドの転換点検出およびストップロスの設定・更新に使用、インクリメンタル計算対応で効率的なリアルタイム更新
│   ├── strategies/             # トレーディング戦略
│   │   ├── trendStrategy.ts    # トレンドフォロー戦略
│   │   ├── rangeStrategy.ts    # レンジ相場戦略
│   │   ├── DonchianBreakoutStrategy.ts # ドンチャンブレイクアウト戦略
│   │   ├── trendFollowStrategy.ts # 改良版トレンドフォロー戦略
│   │   └── meanReversionStrategy.ts # レンジ/ミーンリバース戦略
│   ├── utils/                  # ユーティリティ関数
│   │   ├── logger.ts           # ロギングユーティリティ
│   │   ├── orderUtils.ts       # 注文と約定情報の同期ユーティリティ
│   │   └── metrics.ts          # Prometheusメトリクスエクスポーター
│   ├── data/                   # データ処理、永続化
│   │   ├── dataRepository.ts   # データ保存・読込
│   │   ├── parquetDataStore.ts # Parquet形式データストア
│   │   ├── marketDataFetcher.ts # 市場データ取得
│   │   ├── MultiTimeframeDataFetcher.ts # 複数時間足データ取得
│   │   ├── fetchMultiTimeframeData.ts # マルチタイムフレームデータ取得CLI
│   │   ├── generateSampleData.ts # サンプルデータ生成ツール
│   │   └── runSampleTest.ts    # サンプルデータ生成と検証テスト
│   ├── optimizer/              # パラメータ最適化
│   │   ├── optunaOptimizer.ts  # Optunaによる最適化エンジン
│   │   ├── parameterSpace.ts   # 最適化パラメータ空間定義
│   │   └── runOptimization.ts  # 最適化実行のCLIツール
│   ├── services/               # 外部サービス連携
│   │   ├── secretManager/      # シークレットマネージャー
│   │   │   ├── SecretManagerInterface.ts   # シークレット管理の抽象インターフェース 
│   │   │   ├── SecretManagerFactory.ts     # 環境に応じた実装選択ファクトリー
│   │   │   ├── FileSecretManager.ts        # ファイルベース実装
│   │   │   ├── EnvSecretManager.ts         # 環境変数ベース実装
│   │   │   ├── AWSParameterStoreManager.ts # AWS Parameter Store実装
│   │   │   ├── GCPSecretManager.ts         # GCP Secret Manager実装
│   │   │   ├── example.ts                  # 使用例
│   │   │   └── index.ts                    # エクスポート定義
│   │   └── exchangeService.ts  # 取引所APIラッパー
│   └── docs/                   # ドキュメント
│       └── APIEndpoints.md     # API仕様書
├── .dockerignore               # Dockerビルド除外ファイル設定
├── .env                        # 環境変数
├── .env.example                # 環境変数サンプル
├── Dockerfile                  # マルチステージDockerビルド定義
├── docker-compose.yml          # Docker Compose設定
├── jest.config.js              # Jestテスト設定
├── package.json                # 依存関係定義
├── tsconfig.json               # TypeScript設定
├── PROJECT_STRUCTURE.md        # プロジェクト構造説明（このファイル）
├── SOLUSDT_Algo_Strategy_Design # 戦略設計書
└── README.md                   # プロジェクト説明
```

## コンポーネント設計

### コア (src/core/)

- **types.ts**: システム全体で使用される型定義（Candle, Order(price?: number | undefined), Position等）、タイムスタンプの型ガード関数と正規化関数を追加
- **tradingEngine.ts**: トレーディングエンジンのメインロジック、戦略切替、データ更新、ポジション偏りヘッジ機能、スリッページと手数料計算を組み込み
  - **注文ID同期機能**: syncOrderForSimulateFill関数によるID/状態の同期に対応
  - **メトリクス更新**: Prometheusメトリクス（取引残高、PnL、勝率など）を更新する機能を追加
  - **エラー監視**: エラーログとメトリクス更新の統合機能（logErrorAndUpdateMetrics）
- **backtestRunner.ts**: バックテスト実行と評価指標計算（シャープレシオ、最大ドローダウン、勝率など）、ParquetDataStoreからのデータ取得と最適化パラメータの動的適用、サンプルデータ生成機能
  - **バッチ処理**: 大量データのメモリ効率処理機能
  - **メモリモニタリング**: バックテスト中のメモリ使用量追跡
  - **ガベージコレクション制御**: 定期的なGC実行によるメモリリーク防止
- **orderManagementSystem.ts**: 注文管理、取引所との通信、未決済注文の監視など
  - **checkPendingOrders関数**: 未決済注文の自動チェック機能を強化
  - **注文状態同期**: updateOrderStatus関数による取引所APIからの状態更新機能を追加

### インジケーター (src/indicators/)

- **marketState.ts**: 市場状態分析ロジック（EMA傾き、ATR、RSI、ADXを利用した市場環境判定）、トレンド/レンジ判定、ボラティリティ計測、ATRとEMA計算および分析機能強化、EMERGENCYモードからの復帰ロジック（24時間以上、価格変動がBLACK_SWAN_THRESHOLD/2未満）、VWAP計算機能追加（ミーンリバース戦略のサポート）、IncrementalEMA/IncrementalATRクラスの内部実装（増分計算に対応した高速なEMA/ATR計算）
- **parabolicSAR.ts**: Parabolic SAR（Stop and Reverse）指標の実装、トレンドの転換点検出およびストップロスの設定・更新に使用、インクリメンタル計算対応で効率的なリアルタイム更新

注: このディレクトリには上記2つのファイルのみが含まれています。IncrementalEMAとIncrementalATRクラスはmarketState.ts内に内部クラスとして実装されており、独立したファイルとしては存在しません。

### 戦略 (src/strategies/)

- **trendStrategy.ts**: トレンド相場用の戦略（ATRベースのトレイリングストップ、追い玉ポジション機能）
- **rangeStrategy.ts**: レンジ相場用の戦略（動的グリッドレベル計算、ATR%ベースの幅調整）
- **DonchianBreakoutStrategy.ts**: ドンチャンチャネルブレイクアウト戦略（ATRベースのストップロス）
- **trendFollowStrategy.ts**: 改良版トレンドフォロー戦略、Donchianブレイク+ADXによるエントリー、Parabolic SARによる追従システム、リスクベースのポジションサイジング、複数のトレイリングストップ手法（損益分岐点移動、利益確定、ATRベース、Parabolic SARベース）
- **meanReversionStrategy.ts**: レンジ/ミーンリバース戦略、DonchianRange基準のグリッド注文、Maker-only Limit注文方式、ポジション上限とエスケープ条件、動的グリッドレベル計算（ATR%に基づく）、ポジション偏りヘッジ機能（15%以上の偏りで自動調整）、レンジ上限/下限での反転取引、VWAPを使用した価格分析

### データアクセス (src/data/)

- **dataRepository.ts**: データの永続化と取得
- **parquetDataStore.ts**: Parquet形式でのデータ永続化（DuckDBを使用した高速アクセス）、クエリエラーハンドリング強化、マルチタイムフレーム対応
- **marketDataFetcher.ts**: 取引所からの定期的なデータ取得とバッチ処理
- **MultiTimeframeDataFetcher.ts**: 複数の時間足（1m, 15m, 1h, 1d）でのデータ取得と永続化、スケジュール実行対応
- **fetchMultiTimeframeData.ts**: マルチタイムフレームデータ取得のCLIツール
- **generateSampleData.ts**: バックテストと最適化用のサンプルデータ生成ツール（現実的な価格変動を模したシンセティックデータを生成）
- **runSampleTest.ts**: サンプルデータ生成、バックテスト実行、最適化テストの一連の流れを自動化するスクリプト（DAT-003タスク）

### サービス (src/services/)

- **exchangeService.ts**: 取引所APIとの通信、各種注文タイプのサポート、OCO注文（One-Cancels-the-Other）機能、異なる取引所のOCO注文対応キー名（createOCO/createOCOOrder）を自動検出するsupportsOCO関数の実装
- **secretManager/**: API Key、シークレットキーなどの機密情報を安全に管理するためのモジュール
  - **SecretManagerInterface.ts**: 共通インターフェース定義（getSecret, setSecret, deleteSecret, hasSecret）
  - **SecretManagerFactory.ts**: 環境に応じた適切な実装を自動選択するファクトリー
  - **FileSecretManager.ts**: 開発環境用のファイルベースシークレット管理
  - **EnvSecretManager.ts**: 環境変数ベースのシンプルなシークレット管理
  - **AWSParameterStoreManager.ts**: AWS Systems Manager Parameter Storeを使用した本番環境向け実装
  - **GCPSecretManager.ts**: Google Cloud Platform Secret Managerを使用した本番環境向け実装

### テスト (src/__tests__/)

- **indicators/**: 指標計算ロジックのテスト、特にIncrementalEMAとIncrementalATRの検証
- **services/exchangeService.test.ts**: 取引所サービスのユニットテスト、特にOCO注文対応キー（createOCO/createOCOOrder）の検出機能テスト
- **strategies/trendStrategy.test.ts**: トレンド戦略のユニットテスト、データ不足時の挙動やポジション管理、トレイリングストップの機能を検証
- **strategies/rangeStrategy.test.ts**: レンジ戦略のユニットテスト、グリッドレベルのクロス検知、レンジ上限/下限でのシグナル生成、ブレイクアウト時のポジション決済機能を検証、シミュレーションデータを使用した自動テストにより戦略の堅牢性を確保

### 設定 (src/config/)

- **parameters.yaml**: 設定パラメータをYAML形式で定義（環境変数からのオーバーライドをサポート）、adjustSlopePeriods閾値を外部設定化し最適化対象に追加
- **parameters.ts**: パラメータ定数をTypeScriptエクスポート
- **parameterService.ts**: パラメータ管理サービス（YAMLファイルと環境変数からパラメータを読み込み、一時的なパラメータ適用機能）

### 最適化 (src/optimizer/)

- **optunaOptimizer.ts**: Optunaを使用したハイパーパラメータ最適化エンジン（ベイズ最適化によるパラメータ探索）
- **parameterSpace.ts**: 最適化対象パラメータの探索空間定義（範囲、ステップサイズ、デフォルト値）
- **runOptimization.ts**: コマンドラインからの最適化実行ツール（npm run optimize）

### ユーティリティ (src/utils/)

- **logger.ts**: 構造化ロギングユーティリティ、環境に応じたログレベル動的設定
- **positionSizing.ts**: リスクベースのポジションサイジング共通ユーティリティ、ATR=0や極小値の場合のフォールバック機能
- **orderUtils.ts**: 注文と約定情報の同期ユーティリティ
  - **syncOrderForSimulateFill**: createOrderの結果をsimulatedFillに適切に渡すためのヘルパー関数
  - **syncFillWithOrder**: 約定情報と注文オブジェクトを同期させる関数
  - **updateOrderStatus**: 取引所の状態文字列をアプリケーションの状態に変換する関数
- **metrics.ts**: Prometheusメトリクスのエクスポーター
  - Express APIによるメトリクス公開（/metrics エンドポイント）
  - 残高、PnL、勝率、最大ドローダウンなどの主要メトリクス定義と更新関数
  - updateMetricsオブジェクトによる各種メトリクス更新インターフェース

### インフラストラクチャ (プロジェクトルート)

- **Dockerfile**: マルチステージビルドによる最適化Docker環境（builder -> production）
- **docker-compose.yml**: 開発環境と本番環境の両方に対応したコンテナ定義
  - **監視スタック統合**: Prometheus、Grafana、Alertmanager、Node Exporter、cAdvisorの定義を追加
  - **ログ管理強化**: ログローテーション設定と永続化ボリュームの追加
  - **ヘルスチェック**: コンテナのヘルスステータス監視設定
- **.dockerignore**: Dockerビルド時に除外するファイル一覧
- **.github/workflows/deploy-prod.yml**: GitHub ActionsによるCI/CD自動デプロイワークフロー
- **.github/workflows/todo-check.yml**: Todo項目のフォーマット検証ワークフロー
- **.github/workflows/pr-todo-auto-update.yml**: PRマージ時のTodoタスク自動更新ワークフロー
- **.github/PULL_REQUEST_TEMPLATE.md**: PRテンプレート（タスクID参照を強制）

### 運用スクリプト (scripts/)

- **deploy.sh**: 本番環境へのデプロイを自動化するスクリプト
- **monitor.sh**: システム状態（コンテナ、ディスク、メモリ）を監視しDiscord通知
- **ec2-setup.sh**: EC2インスタンスの初期セットアップを自動化
- **crontab.txt**: 定期タスク設定例

### ドキュメント

- **docs/Docker-Setup.md**: Docker環境のセットアップと使用方法ガイド

## 市場環境判定ロジック

MarketState分析では、以下の環境を識別します：

- **STRONG_UPTREND/STRONG_DOWNTREND**: 強いトレンド環境（傾きが高く、長短EMAが同方向、ADX>25）
- **UPTREND/DOWNTREND**: 通常のトレンド環境
- **WEAK_UPTREND/WEAK_DOWNTREND**: 弱いトレンド（微かな傾向あり）
- **RANGE**: レンジ相場（低ボラティリティ、傾き小）

## 戦略選択ロジック

市場環境に応じて、以下の戦略を自動選択します：

- トレンド環境 → **Donchianブレイクアウト戦略** または **トレンドフォロー戦略**
- レンジ環境 → **グリッド/レンジ戦略**（動的グリッド計算）または**ミーンリバース戦略**（適度なボラティリティを持つレンジ相場の場合）
- 急激な変動時 → **緊急戦略**（ポジション削減、トレイリングストップ、24時間後に変動率が基準値の半分以下で通常戦略に復帰）
- ポジション偏り時 → **ヘッジ戦略**（15%以上の偏りでVWAP価格による反対ポジション）

## 注文管理システム（OMS）

- 注文の作成、追跡、キャンセル
- 高度な注文オプション（Post-Only, Hidden, Iceberg）
- OCO注文（One-Cancels-the-Other）サポート、複数取引所の異なるキー名（createOCO/createOCOOrder）を自動検出
- ポジション管理（新規、追加、部分決済）
- 損益計算（実現/未実現PnL）
- 価格更新によるポジション評価額更新
- WebhookとRESTによる約定検知
- 未決済注文監視タスク
- **注文IDと約定情報の同期機能**: createOrderの結果をsimulatedFillに適切に渡すためのヘルパー関数を追加（syncOrderForSimulateFill）
- **約定情報との注文同期**: 取引所APIからの約定レスポンスと内部注文オブジェクトを一致させる機能（syncFillWithOrder）
- **取引所ステータスマッピング**: 異なる取引所の注文状態文字列をアプリケーション内のOrderStatusに変換する機能（updateOrderStatus）

## バックテストとスモークテスト

### バックテスト

- **バックテストランナー**: 過去データや合成データに対して戦略を実行し、パフォーマンスを評価
- **スリッページ・手数料シミュレーション**: 実際の取引環境に近いシミュレーションのためのスリッページと手数料計算機能
- **評価指標**: シャープレシオ、最大ドローダウン、勝率、プロフィットファクターなど多角的な評価
- **データソース**: 実際の市場データまたは合成的なサンプルデータ（データがない場合）

### スモークテスト

- **目的**: CIパイプラインでのコードレベルの検証と最低限の機能確認
- **軽量実行**: 最小限の依存関係とシンセティックデータでの高速検証
- **検証基準**:
  - 最小プロフィットファクター: 0.8
  - 最大ドローダウン: 30%
  - 最小シャープレシオ: -1.0
  - 最小取引数: 3件
- **改善済み機能**: TradingEngine.executeStrategyがスモークテスト時に強制的にシグナルを生成するロジックを実装、キャンドル数が不足していても取引シグナルを生成

## パラメータ最適化

- **Optunaによる最適化**: ベイズ最適化アルゴリズムを使用した効率的なハイパーパラメータ探索
- **最適化対象パラメータ**:
  - ATR_PERCENTAGE_THRESHOLD (4.0〜8.0): レンジ/トレンド判定の閾値
  - TRAILING_STOP_FACTOR (0.8〜1.5): トレイリングストップのATR乗数
  - GRID_ATR_MULTIPLIER (0.3〜0.9): レンジ戦略のグリッド間隔計算用乗数
  - EMA_SLOPE_THRESHOLD (0.05〜0.25): レンジ判定に使用するEMA傾き閾値
  - ADDON_POSITION_R_THRESHOLD (0.7〜1.5): 追加ポジション判定のR値閾値
  - ADDON_POSITION_SIZE_FACTOR (0.3〜0.7): 追加ポジションのサイズ係数
  - BLACK_SWAN_THRESHOLD (0.1〜0.2): ブラックスワン判定の価格変動率閾値
  - ADJUST_SLOPE_PERIODS (3～8): EMA傾き計算の調整期間
- **評価指標**:
  - シャープレシオ: リスク調整後リターン
  - カルマーレシオ: リターン/最大ドローダウン
  - ソルティノレシオ: 下方リスクのみ考慮したリスク調整後リターン
  - 複合指標: 複数の指標を組み合わせた総合評価
- **最適化フロー**:
  1. 探索空間からパラメータセットを生成
  2. バックテストでパラメータセットを評価
  3. ベイズアルゴリズムで次のパラメータセットを選択
  4. 設定回数の試行後、最適パラメータセットを特定
  5. 結果をYAML形式で保存（/data/optimization/）
- **バックテスト評価**:
  - 単一期間評価: シンプルなバックテスト評価
  - ウォークフォワード検証: 複数期間での過学習防止テスト

## データ永続化

- **Parquet形式**: 列指向で効率的なデータ保存形式
- **DuckDB**: 分析に最適化されたSQLデータベース
- **高速クエリ**: 時系列データの迅速な分析と検索
- **マルチタイムフレーム対応**: 1分足、15分足、1時間足、日足の各時間足データを一元管理
- **サンプルデータ生成**: シンセティックな価格変動データを生成し、バックテストとOptunaによる最適化の検証に利用
- **エラーハンドリング**: クエリ実行時の例外処理とリトライメカニズム
- **定期実行**: node-cronを使用したスケジュールベースのデータ取得自動化

## リスク管理

- **最大取引リスク**: 口座残高の1%
- **日次損失上限**: 口座残高の5%（超過時取引停止）
- **ポジションサイジング**: ATRベースのリスク計算（ストップロス幅に基づく）
- **トレイリングストップ**: ATR × 1.2の動的計算（市場ボラティリティに適応）
- **ポジション偏りヘッジ**: ネットポジションが15%以上偏った場合に自動ヘッジ
- **ブラックスワン対策**: 急激な価格変動時に自動的にポジション半減、24時間後に変動率が基準値の半分以下で通常戦略に復帰
- **ポジションサイジング共通ユーティリティ**: calculateRiskBasedPositionSizeを共通関数として実装し、すべての戦略から参照。ATR=0のケースでも安全なフォールバック機能を実装
- **ATRフォールバック**: 低ボラティリティ市場やデータ不足時にATR=0となるケースでも、price * DEFAULT_ATR_PERCENTAGEをフォールバック値として使用

## 高度な注文タイプ

- **Post-Only**: 指値注文がメイカーとしてのみ約定（テイカー約定を防止）
- **Hidden**: 板に表示されない隠し注文
- **Iceberg**: 大口注文を小分けにして表示（例: 表示数量制限）
- **OCO**: One-Cancels-the-Other注文（利確と損切りの同時発注）、異なる取引所の実装に対応（createOCO/createOCOOrder）

## テスト環境

- **Jest**: JavaScript/TypeScriptのテストフレームワーク
- **ts-jest**: TypeScriptファイルを直接テストするためのJestプリセット
- **テストディレクトリ**: src/__tests__/ 以下に機能ごとのテストを実装
- **テストカバレッジ**: 主要コンポーネントのユニットテスト、特に重要な機能のテスト優先実装

## インフラストラクチャ

### Docker環境

- **マルチステージビルド**: 開発用ビルドステージと軽量な本番用ステージを分離
- **非rootユーザー**: 本番環境では特権のない専用ユーザー（solbot）でコンテナを実行
- **最小依存関係**: 本番コンテナには必要最小限のパッケージのみをインストール
- **Docker Compose**: 開発環境と本番環境の両方に対応した設定
- **ヘルスチェック**: 定期的なAPIエンドポイント応答確認による自動復旧

### CI/CD

- **GitHub Actions**: プッシュ時に自動テスト・ビルド・デプロイを実行
- **自動テスト**: コードプッシュ時にJestテストとESLint検証を実行
- **自動デプロイ**: masterブランチへのプッシュ時に本番環境へ自動デプロイ
- **環境変数管理**: GitHubシークレットによる機密情報の安全な管理
- **Discord通知**: デプロイ結果をDiscordに自動通知

### 監視・運用

- **監視スクリプト**: コンテナ状態、ディスク使用量、メモリ使用量を監視
- **異常検知**: 閾値超過時にDiscordへ通知
- **定期タスク**: crontabによる監視、バックアップ、ログローテーションの自動化
- **EC2セットアップ**: 新規EC2インスタンス構築を自動化するスクリプト

## 依存関係

主な依存関係：

- `typescript`: 静的型付け
- `ccxt`: 暗号資産取引所API接続ライブラリ
- `technicalindicators`: テクニカル分析指標計算
- `express`: REST APIエンドポイント提供
- `node-cron`: 定期実行ジョブ
- `winston`: 構造化ロギング
- `dotenv`: 環境変数管理
- `js-yaml`: YAML設定ファイル処理
- `duckdb`: 高性能分析データベース
- `apache-arrow`: メモリ効率の良いデータ形式
- `parquetjs`: Parquetファイル形式の操作
- `optuna`: ハイパーパラメータ最適化フレームワーク（ベイズ最適化）
- `@aws-sdk/client-ssm`: AWS Systems Manager Parameter Storeクライアント
- `@google-cloud/secret-manager`: Google Cloud Platform Secret Managerクライアント
- `jest`: テストフレームワーク
- `ts-jest`: TypeScriptファイルのテスト用プリセット
- `@types/jest`: Jestの型定義
- `prom-client`: Prometheusメトリクスの生成とエクスポート

## 開発環境のセットアップ

1. リポジトリをクローン
2. `npm install` で依存関係をインストール
3. `.env.example` を `.env` にコピーして設定を行う
4. `npm run dev` で開発モードで実行
5. または `docker-compose up solbot-dev` でDockerコンテナとして実行

## 実行モード

- **シミュレーション**: 実際に注文を出さず、戦略のテストを行う (`npm run simulation`)
- **バックテスト**: 過去のデータを使用した戦略の検証（`npm run backtest`)または期間指定バックテスト(`npm run backtest -- --start-date 2023-01-01 --end-date 2023-06-30`)
- **ライブ**: 実際の取引所で取引を実行 (`npm run live`)
- **最適化**: Optunaによるパラメータ最適化の実行（`npm run optimize`または`npm run optimize -- --trials 50 --metric sharpe_ratio`)
- **サンプルデータ生成**: バックテスト用サンプルデータ生成（`npm run generate-sample-data`)
- **サンプルテスト実行**: サンプルデータ生成、バックテスト、最適化の一連テスト（`npm run sample-test`)
- **スモークテスト**: CIパイプラインで使用する簡易バックテスト（`npm run backtest:smoke`）、結果検証（`npm run test:smoke`）
- **ユニットテスト**: コードの各部分のテスト実行（`npm test`または`npm test -- --grep=ExchangeService`)
- **Docker開発環境**: Docker Composeによる開発環境実行（`docker-compose up solbot-dev`)
- **Docker本番環境**: Docker Composeによる本番環境実行（`docker-compose up solbot-prod`)
- **監視スタック**: Prometheus、Grafana、Alertmanagerによる監視システムの起動（`cd monitoring && docker-compose up -d`）
  - **Grafanaダッシュボード**: http://localhost:3000 からアクセス（デフォルト認証情報: admin/solbot123）
  - **Prometheusコンソール**: http://localhost:9090 からアクセス
  - **Discord通知**: Alertmanagerによるアラート通知（CPU/メモリ/ディスク使用率、エラー率、日次損失率など）

詳細は README.md を参照してください。

## Todo管理システム

プロジェクトの進捗管理は `.todo/` ディレクトリで専用フォーマットを使用して管理されています:

- **backlog.mdc**: 未着手タスクのプール (inbox)
- **sprint.mdc**: 現在スプリントの進行中/完了タスク
- **archive.mdc**: 完了から3ヶ月経過したタスク
- **todo-format.md**: Todoフォーマットガイドライン

タスクは所定のフォーマットに従い、以下の情報を含みます:
- タスクID（カテゴリ接頭辞＋連番）
- タイトル
- 期限日
- 担当者
- 依存タスク
- ラベル
- 健全性ステータス
- 進捗率
- メモ

カテゴリ接頭辞には以下のものがあります:
- DAT: データ関連タスク
- ALG: アルゴリズム・売買ロジック
- OMS: 注文管理システム
- INF: インフラ・環境構築
- CONF: 設定系
- OPT: 最適化関連
- TST: テスト関連
- CICD: CI/CD関連
- PERF: パフォーマンス最適化
- SEC: セキュリティ関連

### CI/CD連携

Todoタスク管理はGitHub Actionsと連携して自動化されています:

1. **フォーマットチェック(.github/workflows/todo-check.yml)**:
   - Todoファイル更新時に必須フィールド検証
   - タスクIDの形式確認（3文字カテゴリ + 3桁数字）
   - 完了タスクの健全性ステータス確認
   - ラベル、進捗率、オーナーの必須チェック

2. **タスク自動更新(.github/workflows/pr-todo-auto-update.yml)**:
   - PRマージ時に関連タスクを自動的に完了状態に更新
   - PRタイトルまたは本文からタスクIDを抽出
   - チェックボックス、進捗率、健全性ステータスを更新
   - 変更を自動コミット

3. **PRテンプレート(.github/PULL_REQUEST_TEMPLATE.md)**:
   - タスクIDの明示的な参照を強制
   - 関連タスクとの紐付けを促進
   - コードレビューチェックリスト提供 

## 監視システム (monitoring/)

監視スタックは以下のコンポーネントで構成されています：

### Prometheus (monitoring/prometheus/)

- **prometheus.yml**: Prometheusの主設定ファイル、メトリクス収集対象の定義
- **alert_rules.yml**: アラートルール定義（CPU/メモリ/ディスク使用率、SOL-Bot稼働状態、エラー率など）

### Grafana (monitoring/grafana/)

- **provisioning/dashboards/**: ダッシュボード設定
  - **solbot_dashboard.json**: SOL-Bot用ダッシュボード定義（取引残高、日次損益、勝率、最大ドローダウンなど）
  - **dashboard.yaml**: ダッシュボードプロバイダー設定
- **provisioning/datasources/**: データソース設定
  - **prometheus.yaml**: Prometheusデータソース定義

### Alertmanager (monitoring/alertmanager/)

- **alertmanager.yml**: アラートマネージャーの設定（通知先、グループ化など）
- **templates/**: 通知テンプレート
  - **discord.tmpl**: Discord通知用テンプレート

### Docker設定

- **monitoring/docker-compose.yml**: 監視スタック用のDocker Compose設定（Prometheus、Grafana、Alertmanager、Node Exporter、cAdvisor）

### メトリクスエクスポーター

- **src/utils/metrics.ts**: Prometheusメトリクスのエクスポーター、Express HTTP APIで公開
  - 主要メトリクス：取引残高、日次損益、勝率、最大ドローダウン、取引数、取引量、エラー率 