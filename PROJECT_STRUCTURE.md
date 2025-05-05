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
│   ├── candles/               # ローソク足データ
│   ├── orders/                # 注文履歴
│   └── metrics/               # パフォーマンスメトリクス
├── logs/                      # ログファイル
├── src/                       # ソースコード
│   ├── config/                # 設定ファイル、パラメータ定義
│   ├── core/                  # コアロジック、型定義
│   │   ├── types.ts           # 共通型定義
│   │   ├── tradingEngine.ts   # トレーディングエンジン
│   │   └── orderManagementSystem.ts # 注文管理システム
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
│   │   └── marketDataFetcher.ts # 市場データ取得
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
- **tradingEngine.ts**: トレーディングエンジンのメインロジック、戦略切替、データ更新、ポジション偏りヘッジ機能
- **orderManagementSystem.ts**: 注文管理システム、ポジション追跡、約定処理、高度な注文タイプ（Post-Only, Hidden, Iceberg）サポート

### インジケーター (src/indicators/)

- **marketState.ts**: 市場状態分析（トレンド/レンジ判定、ボラティリティ計測）

### 戦略 (src/strategies/)

- **trendStrategy.ts**: トレンド相場用の戦略（ATRベースのトレイリングストップ）
- **rangeStrategy.ts**: レンジ相場用の戦略（動的グリッドレベル計算、ATR%ベースの幅調整）
- **DonchianBreakoutStrategy.ts**: ドンチャンチャネルブレイクアウト戦略（ATRベースのストップロス）

### データアクセス (src/data/)

- **dataRepository.ts**: データの永続化と取得
- **marketDataFetcher.ts**: 取引所からの定期的なデータ取得とバッチ処理

### サービス (src/services/)

- **exchangeService.ts**: 取引所APIとの通信、各種注文タイプのサポート、OCO注文（One-Cancels-the-Other）機能

### 設定 (src/config/)

- **parameters.ts**: 戦略パラメータと設定（EMAPeriod, DonchianPeriod, ATRMultiplier, 動的グリッド設定等）

### ユーティリティ (src/utils/)

- **logger.ts**: 構造化ロギングユーティリティ

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

## 開発環境のセットアップ

1. リポジトリをクローン
2. `npm install` で依存関係をインストール
3. `.env.example` を `.env` にコピーして設定を行う
4. `npm run dev` で開発モードで実行

## 実行モード

- **シミュレーション**: 実際に注文を出さず、戦略のテストを行う
- **バックテスト**: 過去のデータを使用した戦略の検証
- **ライブ**: 実際の取引所で取引を実行

詳細は README.md を参照してください。 