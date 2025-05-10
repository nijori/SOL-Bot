# SOL-Bot CLIコマンドリファレンス

このドキュメントでは、SOL-Botで使用できるCLIコマンドの詳細な一覧と使用例を提供します。

## 基本コマンド

### ヘルプ表示

```bash
npm run cli -- --help
```

すべての利用可能なコマンドラインオプションと説明を表示します。

### バックテスト実行

```bash
npm run cli -- --mode backtest
```

デフォルト設定（SOL/USDT、1h時間足、30日間）でバックテストを実行します。

### シミュレーション実行

```bash
npm run cli -- --mode simulation
```

シミュレーションモードで実行します（取引所APIへの実際の注文は行いません）。

### ライブトレード実行

```bash
npm run cli -- --mode live
```

実際の取引所アカウントで自動取引を開始します。

## パラメータ設定

### シンボル指定

```bash
npm run cli -- --symbols SOL/USDT,BTC/USDT
```

複数のシンボルを指定してバックテストまたはライブトレードを実行します。

### 時間足指定

```bash
npm run cli -- --timeframes 1h,4h,1d
```

複数の時間足でバックテストまたはライブトレードを実行します。

### 期間指定

```bash
# 日数指定
npm run cli -- --days 60

# 日付範囲指定
npm run cli -- --start-date 2023-01-01 --end-date 2023-03-31
```

特定の期間でバックテストを実行します。

### 資金とリスク設定

```bash
# 初期残高設定
npm run cli -- --balance 5000

# リスク率設定
npm run cli -- --risk 0.02
```

初期残高とリスク率を指定します。

### 取引所指定

```bash
npm run cli -- --exchange binance
```

特定の取引所でバックテストまたはライブトレードを実行します。

## 出力と保存オプション

```bash
# 結果を保存
npm run cli -- --save-results

# 保存形式指定
npm run cli -- --save-results --report-format html

# 詳細ログ
npm run cli -- --verbose

# ログ抑制
npm run cli -- --quiet
```

## 設定オーバーライド

```bash
npm run cli -- --config-override custom-config.json
```

JSONファイルを使用して基本設定をオーバーライドします。

## 市場状態と動的調整

```bash
# 市場状態分析の実行
npm run analyze-market -- --symbols SOL/USDT --timeframes 1h,4h

# 市場状態レポートの表示
npm run cli -- --market-regime-report

# 動的パラメータ設定ファイルの指定
npm run cli -- --dynamic-params custom-dynamic-params.json

# 自動調整の有効化と感度設定
npm run cli -- --auto-tune high|low|off
```

## 資金配分設定

```bash
# 配分戦略の指定
npm run cli -- --allocation-strategy VOLATILITY|EQUAL|PRIORITY|CUSTOM

# カスタム配分比率の指定
npm run cli -- --allocation-strategy CUSTOM --allocation-ratio "SOL/USDT:0.4,BTC/USDT:0.35,ETH/USDT:0.25"

# 詳細な配分設定ファイルの指定
npm run cli -- --allocation-config custom-allocation-config.json

# リバランス設定
npm run cli -- --rebalance-threshold 0.1 --rebalance-period 1d
```

## ショートカットコマンド

package.jsonに定義されているショートカットコマンドは、頻繁に使用される長いコマンドを簡略化したものです。

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

## 実行例

### 完全な例：複数シンボル、カスタム設定、結果保存

```bash
npm run cli -- --mode backtest --symbols SOL/USDT,BTC/USDT,ETH/USDT --timeframes 1h,4h --days 90 --risk 0.015 --balance 10000 --config-override trading-config.json --save-results --report-format html --verbose
```

### 動的パラメータと資金配分を使用した例

```bash
npm run cli -- --mode live --symbols SOL/USDT,BTC/USDT,ETH/USDT --auto-tune high --allocation-strategy VOLATILITY --rebalance-threshold 0.1
```

### シンプルなスモークテスト

```bash
npm run cli -- --mode backtest --smoke-test --days 3
```

3日間の短期データでスモークテストを実行します。

## 環境変数との連携

CLIコマンドは`.env`ファイルの設定と組み合わせて使用できます。コマンドライン引数は`.env`ファイルの設定を上書きします。
