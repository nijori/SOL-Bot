# SOL-Bot プロジェクト構造

## フォルダ構成

このプロジェクトは以下のフォルダ構造で構成されています：

```
SOL-Bot/
├── .todo/                     # Todo管理システム
│   ├── backlog.mdc            # 未着手タスク (inbox)
│   ├── sprint.mdc             # 今スプリントの WIP/Done
│   └── archive.mdc            # 完了タスク
├── data/                      # データストレージ
│   ├── candles/               # ローソク足データ（Parquet形式）
│   ├── orders/                # 注文履歴
│   ├── optimization/          # 最適化結果YAML
│   └── metrics/               # パフォーマンスメトリクス
├── logs/                      # ログファイル
├── src/                       # ソースコード
│   ├── config/                # 設定ファイル、パラメータ定義
│   │   ├── parameters.yaml    # YAML形式の設定パラメータ
│   │   ├── parameters.ts      # TypeScript定数エクスポート
│   │   └── parameterService.ts # パラメータ管理サービス
│   ├── core/                  # コアロジック、型定義
│   │   ├── types.ts           # 共通型定義
│   │   ├── tradingEngine.ts   # トレーディングエンジン
│   │   ├── orderManagementSystem.ts # 注文管理システム
│   │   ├── backtestRunner.ts  # バックテスト実行と評価指標計算
│   │   └── smokeTest.ts       # CIパイプライン用スモークテスト
│   ├── indicators/            # テクニカル指標計算
│   │   └── marketState.ts     # 市場環境分析
│   ├── strategies/            # トレーディング戦略
│   │   ├── trendStrategy.ts   # トレンドフォロー戦略
│   │   ├── rangeStrategy.ts   # レンジ相場戦略
│   │   └── DonchianBreakoutStrategy.ts # ドンチャンブレイクアウト戦略
│   ├── utils/                 # ユーティリティ関数
│   │   └── logger.ts          # ロギングユーティリティ
│   ├── data/                  # データ処理、永続化
│   │   ├── dataRepository.ts  # データ保存・読込
│   │   ├── parquetDataStore.ts # Parquet形式データストア
│   │   ├── marketDataFetcher.ts # 市場データ取得
│   │   ├── generateSampleData.ts # サンプルデータ生成ツール
│   │   └── runSampleTest.ts   # サンプルデータ生成と検証テスト
│   ├── optimizer/             # パラメータ最適化
│   │   ├── optunaOptimizer.ts # Optunaによる最適化エンジン
│   │   ├── parameterSpace.ts  # 最適化パラメータ空間定義
│   │   └── runOptimization.ts # 最適化実行のCLIツール
│   ├── services/              # 外部サービス連携
│   │   └── exchangeService.ts # 取引所APIラッパー
│   └── docs/                  # ドキュメント
│       └── APIEndpoints.md    # API仕様書
├── .env                       # 環境変数
├── .env.example               # 環境変数サンプル
├── package.json               # 依存関係定義
├── tsconfig.json              # TypeScript設定
├── PROJECT_STRUCTURE.md       # プロジェクト構造説明（このファイル）
├── SOLUSDT_Algo_Strategy_Design # 戦略設計書
└── README.md                  # プロジェクト説明
```

## コンポーネント設計

### コア (src/core/)

- **types.ts**: システム全体で使用される型定義（Candle, Order, Position等）
- **tradingEngine.ts**: トレーディングエンジンのメインロジック、戦略切替、データ更新、ポジション偏りヘッジ機能、スリッページと手数料計算を組み込み
- **orderManagementSystem.ts**: 注文管理システム、ポジション追跡、約定処理、高度な注文タイプ（Post-Only, Hidden, Iceberg）サポート
- **backtestRunner.ts**: バックテスト実行と評価指標計算（シャープレシオ、最大ドローダウン、勝率など）、ParquetDataStoreからのデータ取得と最適化パラメータの動的適用、サンプルデータ生成機能
- **smokeTest.ts**: CIパイプライン用の軽量バックテスト実行と評価、結果が閾値基準を満たすか検証

### インジケーター (src/indicators/)

- **marketState.ts**: 市場状態分析（トレンド/レンジ判定、ボラティリティ計測）、ATRとEMA計算および分析機能強化

### 戦略 (src/strategies/)

- **trendStrategy.ts**: トレンド相場用の戦略（ATRベースのトレイリングストップ、追い玉ポジション機能）
- **rangeStrategy.ts**: レンジ相場用の戦略（動的グリッドレベル計算、ATR%ベースの幅調整）
- **DonchianBreakoutStrategy.ts**: ドンチャンチャネルブレイクアウト戦略（ATRベースのストップロス）

### データアクセス (src/data/)

- **dataRepository.ts**: データの永続化と取得
- **parquetDataStore.ts**: Parquet形式でのデータ永続化（DuckDBを使用した高速アクセス）、クエリエラーハンドリング強化
- **marketDataFetcher.ts**: 取引所からの定期的なデータ取得とバッチ処理
- **generateSampleData.ts**: バックテストと最適化用のサンプルデータ生成ツール（現実的な価格変動を模したシンセティックデータを生成）
- **runSampleTest.ts**: サンプルデータ生成、バックテスト実行、最適化テストの一連の流れを自動化するスクリプト（DAT-003タスク）

### サービス (src/services/)

- **exchangeService.ts**: 取引所APIとの通信、各種注文タイプのサポート、OCO注文（One-Cancels-the-Other）機能

### 設定 (src/config/)

- **parameters.yaml**: 設定パラメータをYAML形式で定義（環境変数からのオーバーライドをサポート）
- **parameters.ts**: パラメータ定数をTypeScriptエクスポート
- **parameterService.ts**: パラメータ管理サービス（YAMLファイルと環境変数からパラメータを読み込み、一時的なパラメータ適用機能）

### 最適化 (src/optimizer/)

- **optunaOptimizer.ts**: Optunaを使用したハイパーパラメータ最適化エンジン（ベイズ最適化によるパラメータ探索）
- **parameterSpace.ts**: 最適化対象パラメータの探索空間定義（範囲、ステップサイズ、デフォルト値）
- **runOptimization.ts**: コマンドラインからの最適化実行ツール（npm run optimize）

### ユーティリティ (src/utils/)

- **logger.ts**: 構造化ロギングユーティリティ、環境に応じたログレベル動的設定

### ドキュメント (src/docs/)

- **APIEndpoints.md**: REST APIエンドポイントの仕様書

## 市場環境判定ロジック

MarketState分析では、以下の環境を識別します：

- **STRONG_UPTREND/STRONG_DOWNTREND**: 強いトレンド環境（傾きが高く、長短EMAが同方向、ADX>25）
- **UPTREND/DOWNTREND**: 通常のトレンド環境
- **WEAK_UPTREND/WEAK_DOWNTREND**: 弱いトレンド（微かな傾向あり）
- **RANGE**: レンジ相場（低ボラティリティ、傾き小）

## 戦略選択ロジック

市場環境に応じて、以下の戦略を自動選択します：

- トレンド環境 → **Donchianブレイクアウト戦略** または **トレンドフォロー戦略**
- レンジ環境 → **グリッド/レンジ戦略**（動的グリッド計算）
- 急激な変動時 → **緊急戦略**（ポジション削減、トレイリングストップ）
- ポジション偏り時 → **ヘッジ戦略**（15%以上の偏りでVWAP価格による反対ポジション）

## 注文管理システム（OMS）

- 注文の作成、追跡、キャンセル
- 高度な注文オプション（Post-Only, Hidden, Iceberg）
- OCO注文（One-Cancels-the-Other）サポート
- ポジション管理（新規、追加、部分決済）
- 損益計算（実現/未実現PnL）
- 価格更新によるポジション評価額更新
- WebhookとRESTによる約定検知
- 未決済注文監視タスク

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
- **問題点と改善計画**: 現在スモークテストでは取引シグナルが生成されないため、TST-003タスクでTradingEngine.isSmokeTestフラグ処理とサンプルデータ生成を改良予定

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
- **サンプルデータ生成**: シンセティックな価格変動データを生成し、バックテストとOptunaによる最適化の検証に利用
- **エラーハンドリング**: クエリ実行時の例外処理とリトライメカニズム

## リスク管理

- **最大取引リスク**: 口座残高の1%
- **日次損失上限**: 口座残高の5%（超過時取引停止）
- **ポジションサイジング**: ATRベースのリスク計算（ストップロス幅に基づく）
- **トレイリングストップ**: ATR × 1.2の動的計算（市場ボラティリティに適応）
- **ポジション偏りヘッジ**: ネットポジションが15%以上偏った場合に自動ヘッジ
- **ブラックスワン対策**: 急激な価格変動時に自動的にポジション半減

## 高度な注文タイプ

- **Post-Only**: 指値注文がメイカーとしてのみ約定（テイカー約定を防止）
- **Hidden**: 板に表示されない隠し注文
- **Iceberg**: 大口注文を小分けにして表示（例: 表示数量制限）
- **OCO**: One-Cancels-the-Other注文（利確と損切りの同時発注）

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

## 開発環境のセットアップ

1. リポジトリをクローン
2. `npm install` で依存関係をインストール
3. `.env.example` を `.env` にコピーして設定を行う
4. `npm run dev` で開発モードで実行

## 実行モード

- **シミュレーション**: 実際に注文を出さず、戦略のテストを行う (`npm run simulation`)
- **バックテスト**: 過去のデータを使用した戦略の検証（`npm run backtest`)または期間指定バックテスト(`npm run backtest -- --start-date 2023-01-01 --end-date 2023-06-30`)
- **ライブ**: 実際の取引所で取引を実行 (`npm run live`)
- **最適化**: Optunaによるパラメータ最適化の実行（`npm run optimize`または`npm run optimize -- --trials 50 --metric sharpe_ratio`）
- **サンプルデータ生成**: バックテスト用サンプルデータ生成（`npm run generate-sample-data`）
- **サンプルテスト実行**: サンプルデータ生成、バックテスト、最適化の一連テスト（`npm run sample-test`）
- **スモークテスト**: CIパイプラインで使用する簡易バックテスト（`npm run backtest:smoke`）、結果検証（`npm run test:smoke`）

詳細は README.md を参照してください。

## Todo管理システム

プロジェクトの進捗管理は `.todo/` ディレクトリで専用フォーマットを使用して管理されています:

- **backlog.mdc**: 未着手タスクのプール (inbox)
- **sprint.mdc**: 現在スプリントの進行中/完了タスク
- **archive.mdc**: 完了から3ヶ月経過したタスク

タスクは所定のフォーマットに従い、以下の情報を含みます:
- タスクID（カテゴリ接頭辞＋連番）
- タイトル
- 期限日
- 担当者
- 依存タスク
- ラベル
- 健全性ステータス
- メモ

カテゴリ接頭辞には以下のものがあります:
- DAT: データ関連タスク
- ALG: アルゴリズム・売買ロジック
- OMS: 注文管理システム
- INF: インフラ・環境構築
- CONF: 設定系
- OPT: 最適化関連
- TST: テスト関連 