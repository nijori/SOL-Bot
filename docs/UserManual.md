# SOL-Bot ユーザーマニュアル

## 目次

1. [概要](#概要)
2. [インストール](#インストール)
3. [設定](#設定)
4. [基本的な使用方法](#基本的な使用方法)
5. [コマンドラインオプション](#コマンドラインオプション)
6. [バックテスト](#バックテスト)
7. [マルチシンボル対応](#マルチシンボル対応)
8. [ライブトレード](#ライブトレード)
9. [データ管理](#データ管理)
10. [監視とアラート](#監視とアラート)
11. [トラブルシューティング](#トラブルシューティング)
12. [開発者向け情報](#開発者向け情報)
13. [セキュリティのベストプラクティス](#セキュリティのベストプラクティス)
14. [動的パラメータ調整](#動的パラメータ調整)
15. [ボラティリティベースの資金配分](#ボラティリティベースの資金配分)

## 概要

SOL-Botは複数の暗号資産ペア（SOL/USDT, BTC/USDT, ETH/USDTなど）を対象とした自動取引アルゴリズムシステムです。市場の状態（トレンド/レンジ）を自動検出し、最適な売買戦略を適用します。

### 主な特徴

- マルチアセット対応: 複数の暗号資産ペアでの取引
- マルチレジーム対応: トレンド/レンジを自動検出し最適な戦略を選択
- リスク管理: ATRベースのポジションサイジングと動的ストップロス
- 市場適応性: ボラティリティに応じたパラメータ自動調整
- ブラックスワン対策: 急激な価格変動時の緊急対応戦略
- 監視システム: Prometheus & Grafanaによるシステム監視
- 動的パラメータ調整: 市場環境に応じてパラメータを自動調整
- ボラティリティベース資金配分: リスクパリティアプローチによる最適な資金配分

## インストール

### システム要件

- Node.js 18.x以上
- npm 8.x以上または yarn 1.22.x以上
- メモリ: 最小2GB（推奨4GB以上）
- ディスク: 最小10GB（データ保存用）

### 方法1: ソースコードからインストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/SOL-bot.git
cd SOL-bot

# 依存関係のインストール
npm install

# TypeScriptコードのビルド
npm run build
```

### 方法2: Dockerを使用したインストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/SOL-bot.git
cd SOL-bot

# 開発環境用のDockerイメージビルド
docker-compose build solbot-dev

# または本番環境用のDockerイメージビルド
docker-compose build solbot-prod
```

Docker環境の詳細な設定については、[Docker-Setup.md](./Docker-Setup.md)を参照してください。

## 設定

### 環境変数

`.env`ファイルをプロジェクトルートに作成し、以下の環境変数を設定します：

```
# 運用モード: simulation, backtest, live
OPERATION_MODE=simulation

# 取引所設定
EXCHANGE_ID=binance  # 利用する取引所（binance, bybit, kucoinなど）
EXCHANGE_API_KEY=your_api_key
EXCHANGE_SECRET_KEY=your_secret_key

# 取引設定
TRADING_PAIR=SOL/USDT  # デフォルトの取引ペア
TIMEFRAME=1h           # デフォルトの時間足
INITIAL_BALANCE=10000  # シミュレーション/バックテスト時の初期残高

# リスク管理
MAX_RISK_PER_TRADE=0.01  # 1トレードあたりの最大リスク（1%）
MAX_DAILY_LOSS=0.05      # 日次最大損失（5%）

# AWS設定（データ管理用）
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
S3_BUCKET=solbot-data
S3_ARCHIVE_BUCKET=solbot-archive

# データライフサイクル管理設定
DATA_RETENTION_DAYS=90    # ローカルでの保持日数
GLACIER_MOVE_DAYS=30      # S3からGlacierに移動するまでの日数
CRON_SCHEDULE="0 3 * * *" # スケジュール設定（デフォルト：毎日午前3時）
```

### 設定ファイル

#### 基本設定ファイル

基本設定は`src/config/config.ts`で定義されています。ただし、これを直接編集するのではなく、以下のいずれかの方法で設定を上書きすることを推奨します：

1. 環境変数を使用する（上記参照）
2. JSONファイルによるオーバーライド（後述）

#### JSON設定ファイルによるオーバーライド

特定の設定を上書きする場合は、JSONファイルを作成して`--config-override`オプションで指定します：

例（`custom-config.json`）:
```json
{
  "general": {
    "logLevel": "info",
    "backupFrequency": "daily"
  },
  "trading": {
    "maxRiskPerTrade": 0.02,
    "trailingStopFactor": 1.5,
    "emergencyStopLoss": 0.1
  },
  "symbols": {
    "SOL/USDT": {
      "maxRiskPerTrade": 0.01,
      "gridLevels": 5
    },
    "BTC/USDT": {
      "maxRiskPerTrade": 0.005,
      "trailingStopFactor": 2.0
    }
  }
}
```

コマンド実行時に以下のように指定します：
```bash
npm run cli -- --config-override custom-config.json
```

## 基本的な使用方法

SOL-Botは以下の主要なモードで動作します：

### 開発モード

ソースコードの変更がリアルタイムで反映される開発モードです：

```bash
npm run dev
```

### シミュレーションモード

実際の取引は行わず、仮想環境でアルゴリズムの動作をシミュレーションします：

```bash
npm run cli -- --mode simulation
```

### バックテストモード

過去のデータを使用してアルゴリズムの性能をテストします：

```bash
npm run cli -- --mode backtest
```

### ライブトレードモード

実際の取引所で自動取引を行います：

```bash
npm run cli -- --mode live
```

## コマンドラインオプション

SOL-Botは豊富なコマンドラインオプションを提供しています：

### 基本的なCLIオプション

```bash
npm run cli -- --help
```

出力例：
```
使用方法: cli [options]

オプション:
  -m, --mode <mode>             動作モード: backtest, simulation, live（デフォルト: "backtest"）
  -s, --symbols <symbols>       取引ペア（カンマ区切り）（デフォルト: "SOL/USDT"）
  -t, --timeframes <timeframes> 時間足（カンマ区切り）（デフォルト: "1h"）
  -d, --days <days>             バックテスト期間（日）（デフォルト: 30）
  -b, --balance <balance>       初期残高（デフォルト: 10000）
  -r, --risk <risk>             トレードあたりのリスク率（デフォルト: 0.01）
  -e, --exchange <exchange>     取引所ID（デフォルト: "binance"）
  --start-date <startDate>      開始日（YYYY-MM-DD）
  --end-date <endDate>          終了日（YYYY-MM-DD）
  --config-override <file>      設定ファイルのパス
  --save-results                結果を保存する
  --report-format <format>      レポート形式: json, csv, html（デフォルト: "json"）
  --verbose                     詳細なログ出力
  --no-cache                    キャッシュを使用しない
  -h, --help                    ヘルプを表示
```

詳細なコマンド例と使用方法については、[CLIコマンドリファレンス](../src/scripts/cliCommands.md)を参照してください。

### 便利なショートカットコマンド

```bash
# 複数シンボル・複数時間足のバックテスト
npm run cli:multisymbols

# 設定ファイルオーバーライドのサンプル実行
npm run cli:multiconfig

# バックテスト実行（デフォルト設定）
npm run cli:backtest

# ヘルプ表示
npm run cli:help
```

## バックテスト

### 基本的なバックテストの実行

```bash
# デフォルト設定でバックテスト実行（SOL/USDT、1h、30日間）
npm run cli -- --mode backtest

# 期間を指定してバックテスト実行（60日間）
npm run cli -- --mode backtest --days 60

# 特定の日付範囲でバックテスト実行
npm run cli -- --mode backtest --start-date 2023-01-01 --end-date 2023-03-31
```

### バックテスト結果の保存

```bash
# 結果をJSONファイルに保存
npm run cli -- --mode backtest --save-results

# 特定のフォーマットで結果を保存
npm run cli -- --mode backtest --save-results --report-format html
```

保存された結果は `data/backtest-results/` ディレクトリに格納されます。

### パラメータの最適化

```bash
# パラメータ最適化の実行
npm run optimize

# 特定のパラメータを対象に最適化
npm run optimize -- --parameters ATR_PERCENTAGE_THRESHOLD,TRAILING_STOP_FACTOR

# 最適化済みパラメータでバックテスト実行
npm run backtest:optimized
```

## マルチシンボル対応

SOL-Botは複数の暗号資産ペアを同時に取引できます：

```bash
# 複数シンボルのバックテスト
npm run cli -- --mode backtest --symbols SOL/USDT,BTC/USDT,ETH/USDT

# 複数シンボルと複数時間足の組み合わせ
npm run cli -- --mode backtest --symbols SOL/USDT,BTC/USDT --timeframes 1h,4h,1d

# 複数シンボル・複数時間足のショートカット
npm run cli:multisymbols
```

### シンボル別設定

`--config-override`オプションを使用して、シンボルごとに異なる設定を適用できます：

```json
// multi-symbol-config.json
{
  "symbols": {
    "SOL/USDT": {
      "maxRiskPerTrade": 0.01,
      "trailingStopFactor": 1.2,
      "gridLevels": 5
    },
    "BTC/USDT": {
      "maxRiskPerTrade": 0.005,
      "trailingStopFactor": 1.5
    },
    "ETH/USDT": {
      "maxRiskPerTrade": 0.008,
      "emergencyStopLoss": 0.12
    }
  }
}
```

```bash
npm run cli -- --mode backtest --symbols SOL/USDT,BTC/USDT,ETH/USDT --config-override multi-symbol-config.json
```

## ライブトレード

### ライブトレードの開始

ライブトレードを開始する前に、以下を確認してください：
- 取引所のAPIキーが正しく設定されていること
- 十分なバックテストが行われていること
- リスク管理パラメータが適切に設定されていること

```bash
# ライブトレードの開始
npm run cli -- --mode live

# 特定のシンボルでライブトレード
npm run cli -- --mode live --symbols SOL/USDT

# 複数シンボルでライブトレード
npm run cli -- --mode live --symbols SOL/USDT,BTC/USDT
```

### 取引所の設定

SOL-Botは複数の取引所をサポートしています：

```bash
# Binanceでの取引
npm run cli -- --mode live --exchange binance

# Bybitでの取引
npm run cli -- --mode live --exchange bybit

# KuCoinでの取引
npm run cli -- --mode live --exchange kucoin
```

### API権限の設定

取引所のAPIキーには、以下の権限が必要です：

- 読み取り（必須）: 価格データ、残高情報の取得
- 現物取引（必須）: 注文の作成・キャンセル
- 先物取引（オプション）: 先物取引を行う場合

**.env** ファイルに正しいAPIキーとシークレットを設定します：

```
EXCHANGE_API_KEY=your_api_key
EXCHANGE_SECRET_KEY=your_secret_key
```

## データ管理

### データの収集

```bash
# すべての時間足のデータを取得
npm run fetch-data:all

# 特定の時間足のデータを取得
npm run fetch-data:1h
npm run fetch-data:15m
npm run fetch-data:1d

# データ収集サービスの開始（定期実行）
npm run start-data-service
```

### データのバックアップと管理

SOL-Botは自動的にデータのバックアップと管理を行います：

```bash
# データライフサイクル管理（即時実行）
npm run data-lifecycle:now

# データライフサイクル管理（スケジュール設定）
npm run data-lifecycle:schedule
```

AWS S3とGlacierを使用したデータ管理の詳細については、[AWS-S3-SETUP.md](./AWS-S3-SETUP.md)を参照してください。

## 監視とアラート

### 監視システムの起動

```bash
# 監視システム（Prometheus, Grafana, Alertmanager）の起動
cd monitoring
docker-compose up -d
```

### ダッシュボードへのアクセス

- Grafanaダッシュボード: http://localhost:3000 (admin/solbot123)
- Prometheusコンソール: http://localhost:9090

### アラート設定

アラートはDiscordに通知されます。設定は以下の手順で行います：

1. Discordでウェブフックを作成
2. .envファイルに`DISCORD_WEBHOOK_URL`を設定
3. アラートルールは`monitoring/prometheus/alert.rules`で定義

## トラブルシューティング

### 一般的な問題

- **「Node.jsのバージョンが古い」エラー**: Node.js v18以上にアップデートしてください
- **メモリ不足エラー**: Node.jsのメモリ制限を引き上げる（`NODE_OPTIONS=--max-old-space-size=4096`）

### バックテスト関連の問題

- **「データが見つからない」エラー**: `npm run fetch-data:all`でデータを取得してください
- **バックテストが遅い**: 期間を短くするか、`--no-verbose`オプションを使用してください

### 取引所接続の問題

- **API認証エラー**: APIキーとシークレットが正しいか確認してください
- **レート制限エラー**: リクエスト頻度を下げるか、取引所のレート制限を確認してください

### ログの確認

問題が発生した場合は、ログファイルを確認してください：

```bash
# 最新のログを表示
tail -f logs/combined.log

# エラーログのみ表示
grep "error" logs/combined.log
```

## 開発者向け情報

### ESM（ECMAScript Modules）対応

SOL-Botは完全にESM（ECMAScript Modules）に対応しています。これにより以下のメリットがあります：

1. **最新のJavaScript/TypeScriptモジュールシステム**
   - `import/export` 構文を使用した明示的なモジュール管理
   - ツリーシェイキングによる最適化
   - トップレベルawait対応

2. **テスト環境の強化**
   - Jest環境でのESM完全対応
   - 特殊なテストコマンド: `npm run test:esm`
   - モックデータ生成ユーティリティの提供

### テスト開発

#### ESM環境でのテスト実行

```bash
# 基本的なESMテスト実行
npm run test:esm

# 特定のテストファイルのみ実行
npm run test:esm -- src/__tests__/utils/marketDataFactory.test.ts

# デバッグモードでのテスト実行
npm run test:esm:debug
```

#### モックデータの生成

テスト用にモックデータを生成するには、`MarketDataFactory`と`TestScenarioFactory`を使用します：

```typescript
import { MarketDataFactory } from '../../utils/test-helpers/marketDataFactory.js';
import { TestScenarioFactory } from '../../utils/test-helpers/testsScenarioFactory.js';

// 再現性のあるトレンド相場のローソク足データを生成
const trendCandles = MarketDataFactory.createTrendCandles({
  basePrice: 100,
  count: 60,
  isUptrend: true,
  trendStrength: 1.5
});

// トレンドフォロー戦略のテストシナリオを生成
const scenario = TestScenarioFactory.createTrendFollowingScenario({
  isUptrend: true,
  initialBalance: 10000
});
```

#### Jestモックのサポート

ESM環境でJestモックを使用するには、以下のようにします：

```typescript
import { jest } from '@jest/globals';
import { mockModule, createMockFactory } from '../../__tests__/utils/export-esm-mock.mjs';

// モジュールをモック化
mockModule('../../services/exchangeService.js', () => ({
  ExchangeService: jest.fn().mockImplementation(() => ({
    fetchMarketData: jest.fn().mockResolvedValue([]),
    createOrder: jest.fn().mockResolvedValue({ id: 'test-order-id' })
  }))
}));
```

#### テスト実行時の安定性向上

テストの安定性向上のために、以下の機能が利用可能です：

- 非同期処理の自動クリーンアップ
- テスト間のリソース分離
- タイマーとイベントリスナーの追跡と自動解放

```typescript
afterAll(async () => {
  // クリーンアップヘルパーを使用して非同期リソースを解放
  await global.cleanupAsyncResources();
});
```

### 非推奨の機能と移行

CommonJS形式のコードはレガシーサポートのみとなり、新規開発はすべてESM形式で行います：

- `require()` の代わりに `import` を使用
- `.js` 拡張子をインポートパスに含める
- ディレクトリ構造内での循環参照を避ける

## セキュリティのベストプラクティス

### APIキーの管理

- 取引所のAPIキーは最小限の権限で作成する
- APIキーを環境変数として設定し、ソースコードにハードコードしない
- 定期的にAPIキーをローテーションする

### 本番環境のセキュリティ

- Dockerを使用する場合は非rootユーザーで実行する
- ファイアウォールを設定し、必要なポートのみを開放する
- 定期的にシステムとSOL-Botをアップデートする

### セキュリティスキャン

SOL-Botは自動的に依存パッケージの脆弱性をスキャンします：

```bash
# 依存パッケージの脆弱性スキャン
npm run security-scan
```

詳細なセキュリティ対策については、[SECURITY.md](../SECURITY.md)を参照してください。

## 動的パラメータ調整

SOL-Botは市場の状態（トレンド/レンジ）を検出し、それに応じて戦略パラメータを自動調整する機能を備えています。

### 市場状態の自動検出

```bash
# 市場状態分析の実行
npm run analyze-market -- --symbols SOL/USDT --timeframes 1h,4h

# 最近の市場状態レポートの表示
npm run cli -- --market-regime-report
```

### 動的パラメータの設定

`dynamic-params.json`ファイルで市場状態ごとのパラメータを設定できます：

```json
{
  "TREND": {
    "EMA_PERIOD": 21,
    "ATR_MULTIPLIER": 1.5,
    "ENTRY_THRESHOLD": 0.02
  },
  "RANGE": {
    "EMA_PERIOD": 10,
    "ATR_MULTIPLIER": 1.2,
    "ENTRY_THRESHOLD": 0.01
  }
}
```

コマンド実行時に以下のように指定します：
```bash
npm run cli -- --mode live --dynamic-params dynamic-params.json
```

### パラメータ自動調整の設定

自動調整機能の有効化と調整感度を設定できます：

```bash
# 自動調整を有効化（高感度）
npm run cli -- --mode live --auto-tune high

# 自動調整を有効化（低感度）
npm run cli -- --mode live --auto-tune low

# 自動調整を無効化
npm run cli -- --mode live --auto-tune off
```

## ボラティリティベースの資金配分

SOL-Botはボラティリティに基づいて複数の通貨ペアに資金を最適に配分する機能を備えています。

### 配分戦略の種類

- **VOLATILITY**: ATRの逆数を使用して配分（低ボラティリティに多く配分）
- **EQUAL**: すべての通貨ペアに均等に配分
- **PRIORITY**: 優先度リストに従って配分
- **CUSTOM**: ユーザー定義の配分比率を使用

### 配分戦略の設定

```bash
# ボラティリティベースの資金配分を使用
npm run cli -- --mode live --allocation-strategy VOLATILITY

# カスタム配分比率を使用
npm run cli -- --mode live --allocation-strategy CUSTOM --allocation-ratio "SOL/USDT:0.4,BTC/USDT:0.35,ETH/USDT:0.25"
```

### 資金配分設定ファイル

詳細な資金配分設定は`allocation-config.json`ファイルで行えます：

```json
{
  "strategy": "VOLATILITY",
  "maxAllocationPerSymbol": 0.5,
  "minAllocationPerSymbol": 0.05,
  "rebalancingThreshold": 0.1,
  "rebalancingPeriod": "1d",
  "customRatios": {
    "SOL/USDT": 0.4,
    "BTC/USDT": 0.35,
    "ETH/USDT": 0.25
  }
}
```

```bash
npm run cli -- --mode live --symbols SOL/USDT,BTC/USDT,ETH/USDT --allocation-config allocation-config.json
``` 