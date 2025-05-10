# SOL-Bot ドキュメント

## 利用者向けドキュメント

- [ユーザーマニュアル](./UserManual.md) - SOL-Botの包括的な使用方法ガイド
- [Docker環境構築ガイド](./Docker-Setup.md) - DockerでのSOL-Bot実行環境の構築方法
- [CLIコマンドリファレンス](../src/scripts/cliCommands.md) - すべてのコマンドラインオプションと使用例

## 管理者向けドキュメント

- [AWS S3/Glacier設定ガイド](./AWS-S3-SETUP.md) - データライフサイクル管理用のAWS設定方法
- [Gitleaks設定ガイド](./gitleaks-setup.md) - セキュリティスキャン設定方法

## 開発者向けリソース

- [プロジェクト構造](../PROJECT_STRUCTURE.md) - プロジェクトのディレクトリ構造と設計概要
- [セキュリティガイドライン](../SECURITY.md) - セキュリティ対策の概要

## クイックスタート

SOL-Botをすぐに始めるには：

1. リポジトリをクローン: `git clone https://github.com/yourusername/SOL-bot.git`
2. 依存関係をインストール: `npm install`
3. 設定ファイルを作成: `.env.example`を`.env`にコピーして編集
4. バックテストを実行: `npm run cli:backtest`

より詳細な情報は[ユーザーマニュアル](./UserManual.md)を参照してください。
