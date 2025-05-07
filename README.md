# SOL-Bot: SOL/USDT 取引アルゴリズム

[![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.18.2-green.svg)](https://expressjs.com/)
[![CCXT](https://img.shields.io/badge/CCXT-4.0.0-orange.svg)](https://github.com/ccxt/ccxt)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

SOL/USDTペアのトレンドとレンジを自動検出し、適切な売買戦略を適用するアルゴリズムトレーディングシステムです。

![SOL-Bot概要](https://via.placeholder.com/800x400?text=SOL-Bot+Overview)

## 🌟 特徴

- **マルチレジーム対応**: トレンド/レンジを自動検出し最適な戦略を選択
- **リスク管理**: ATRベースのポジションサイジングと動的ストップロス
- **市場適応性**: ボラティリティに応じたパラメータ自動調整
- **ブラックスワン対策**: 急激な価格変動時の緊急対応戦略
- **REST API**: 監視・制御用のAPIエンドポイント
- **高速計算**: EMA/ATR計算のインクリメンタル化により最大10倍のパフォーマンス向上

## 🚀 主要技術

- **TypeScript**: 型安全なコードベース
- **CCXT**: 複数取引所との互換性
- **Node.js**: サーバーサイド実行環境
- **Express**: REST API提供

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

## 🔧 セットアップ

### 前提条件

- Node.js 18.x以上
- npm/yarn

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
```

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

## 📈 パフォーマンス

SOL/USDTペアでの2024年4月〜6月のバックテスト結果：

- **総取引数**: 142回
- **勝率**: 59.8%
- **利益率**: 24.5%
- **最大ドローダウン**: 8.76%
- **シャープレシオ**: 1.45

## 🤝 貢献

バグレポート、機能リクエスト、プルリクエストを歓迎します。
大きな変更を行う前には、まずIssueでディスカッションを開始してください。

## 📜 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## ⚠️ 免責事項

このソフトウェアは教育目的で提供されています。実際の取引で使用する場合は、自己責任で行ってください。市場リスクを十分に理解し、損失に耐えられる資金でのみ取引を行うことをお勧めします。

## 監視とモニタリング

SOL-Botには監視ダッシュボード機能が組み込まれており、次のコンポーネントで構成されています。

### 監視スタック

- **Prometheus**: メトリクスの収集と保存
- **Grafana**: データの可視化とダッシュボード
- **Alertmanager**: アラート管理とDiscord通知
- **Node Exporter**: ホストマシンのリソース監視
- **cAdvisor**: コンテナメトリクスの収集

### 主要メトリクス

- 取引残高推移
- 日次損益（金額・率）
- 勝率
- 最大ドローダウン
- 取引数と取引量
- エラー率
- システムリソース使用状況

### 起動方法

監視スタックを起動するには以下のコマンドを実行します：

```bash
cd monitoring
docker-compose up -d
```

アクセス方法：
- Grafanaダッシュボード: http://localhost:3000 (ユーザー名: admin, パスワード: solbot123)
- Prometheusコンソール: http://localhost:9090

### アラート

重要なアラートはDiscordに自動通知されます。アラートには以下が含まれます：

- システムリソース（CPU、メモリ、ディスク）の高使用率
- SOL-Botの稼働状態異常
- 高エラー率
- 取引量の異常な変動
- 日次損失率が制限に近づいた場合 

## Services

### OrderSizingService

新しく追加されたOrderSizingServiceは、リスクベースのポジションサイズ計算をより洗練された形で提供します：

- **マルチアセット対応**: SOL/USDT、BTC/USDT、ETH/USDTなど様々な通貨ペアに対応
- **取引所の制約に対応**: 各取引所の最小ロットサイズ、数量精度、最小注文金額などに自動対応
- **リスク計算の統一**: シンボル、口座残高、ストップ距離から適切な注文サイズを算出

```typescript
// 使用例
const orderSizingService = new OrderSizingService(exchangeService);
const orderSize = await orderSizingService.calculateOrderSize(
  'BTC/USDT',    // シンボル 
  5000,          // 利用可能残高
  1000,          // ストップ距離
  50000,         // 現在価格
  0.01           // リスク率 (1%)
);
```

TradingEngineとの統合も進行中で、今後すべての戦略で一貫した注文サイズ計算が可能になります。 