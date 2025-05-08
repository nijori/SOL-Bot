# SOL-Bot: クリプト自動取引アルゴリズム

[![Build Status](https://github.com/yourusername/SOL-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/SOL-bot/actions)
[![codecov](https://codecov.io/gh/yourusername/SOL-bot/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/SOL-bot)
[![Code Style: ESLint](https://img.shields.io/badge/code_style-ESLint-5ed9c7.svg)](https://eslint.org/)

SOLANA / USDTペア（および他の暗号資産）のための自動取引アルゴリズム。市場の状態（トレンド / レンジ）を自動検出し、最適な戦略を適用します。

## ✨ 機能

- **マルチレジーム対応**: トレンド相場とレンジ相場を自動検出し、最適な戦略を選択
- **リスク管理**: ATRベースのポジションサイジングと動的ストップロス
- **バックテスト**: 過去データを用いた戦略検証と最適化
- **マルチアセット**: 複数の暗号資産ペアでの並行取引
- **異常検知**: 市場の異常な動きを検出し、リスク管理を強化
- **ブラックスワン対策**: 急激な価格変動時の緊急対応戦略
- **監視システム**: Prometheus & Grafanaによるパフォーマンス監視

## 🔧 セットアップ

### 必要条件

- Node.js 16+
- npm または yarn
- PostgreSQL 13+ （メタデータとパフォーマンス分析用）

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

詳細なセットアップ手順やシステムの使用方法については、[ユーザーマニュアル](docs/UserManual.md)を参照してください。また、[ドキュメント索引](docs/index.md)からその他のガイドにもアクセスできます。

## ⚙️ 設定

主要な設定は `.env` ファイルで行います：

```
# 取引所API設定
EXCHANGE_API_KEY=your_api_key
EXCHANGE_API_SECRET=your_api_secret

# 取引パラメータ
BASE_ORDER_SIZE=0.1
MAX_POSITION_SIZE=1.0
RISK_PER_TRADE=0.01

# バックテスト設定
BACKTEST_START_DATE=2023-01-01
BACKTEST_END_DATE=2023-07-31
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
```

## 🔍 現在の開発状況

### ESMテスト環境への移行プロジェクト（REF-020/021/022/023）

現在、テスト環境をCommonJSからES Modulesに移行するプロジェクトを進行中です：

- ✅ Jest設定ファイルのESM対応（REF-020、50%完了）
- ✅ テスト変換スクリプトの基本実装（REF-020、50%完了）
- 🔄 テスト変換スクリプトの改良（REF-021、50%完了）
  - 型アノテーション除去の強化
  - jest.mockブロック処理の改善
  - クラス定義のESM対応化
  - 複雑なモック関数の変換サポート
  - 変換結果の統計表示
- 🔄 複雑なテストファイルのESM対応（REF-022、0%）
- 🔄 テスト実行フローのESM対応（REF-023、0%）

この移行により、最新のNode.js ESM環境でのテスト実行が可能になり、開発効率が向上します。

## 📈 パフォーマンス

バックテスト結果（SOL/USDT, 2023年1月〜6月）：

- 年率リターン: 78.2%
- 最大ドローダウン: 15.3%
- シャープレシオ: 2.1
- 勝率: 62%
- 平均利益/損失比率: 1.8

## 🤝 コントリビューション

プロジェクトへの貢献に興味がある場合は、次の手順に従ってください：

1. このリポジトリをフォーク
2. 新しいブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)を参照してください。 