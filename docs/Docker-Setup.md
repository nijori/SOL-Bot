# SOL-Bot Docker 環境構築ガイド

このドキュメントでは、SOL-Botを開発および本番環境でDockerを使用して実行する方法について説明します。

## 前提条件

- Dockerがインストールされていること
- Docker Composeがインストールされていること

## クイックスタート

### 開発環境での実行

開発環境では、ソースコードの変更がリアルタイムで反映されます。

```bash
# 開発環境のコンテナを構築して起動
docker-compose up solbot-dev

# バックグラウンドで実行する場合
docker-compose up -d solbot-dev

# ログの確認
docker-compose logs -f solbot-dev
```

### 本番環境での実行

本番環境では、ビルド済みのアプリケーションが最小限の依存関係で実行されます。

```bash
# 本番環境のコンテナを構築して起動
docker-compose up solbot-prod

# バックグラウンドで実行する場合
docker-compose up -d solbot-prod

# ログの確認
docker-compose logs -f solbot-prod
```

## 環境変数の設定

プロジェクトルートに`.env`ファイルを作成し、必要な環境変数を設定します。Docker Composeがこのファイルを自動的に読み込みます。

主な環境変数:

- `NODE_ENV`: `development`または`production`
- `EXCHANGE_API_KEY`: 取引所APIキー
- `EXCHANGE_SECRET_KEY`: 取引所APIシークレット
- `TRADING_PAIR`: 取引ペア（例: `SOL/USDT`）
- その他アプリケーション固有の設定

## ボリュームとデータ管理

Docker Composeファイルは以下のボリュームマウントを設定しています:

- `./src:/app/src`: ソースコード（開発環境のみ）
- `./data:/app/data`: データディレクトリ（ローソク足データ、注文履歴など）
- `./logs:/app/logs`: ログファイル

データを永続化するために、ホストマシン上のこれらのディレクトリが適切なアクセス権限を持っていることを確認してください。

## セキュリティ対策

- 本番環境では非rootユーザー（`solbot`）を使用しています
- セキュリティリスクを減らすため、必要最小限の依存パッケージのみをインストールします
- 機密情報（APIキーなど）は環境変数として設定し、コンテナ内にハードコードしないでください

## カスタマイズ

- ポート変更: `docker-compose.yml`の`ports`セクションを編集
- メモリ制限: `docker-compose.yml`に`mem_limit`を追加
- カスタム起動コマンド: `command`セクションを変更

## トラブルシューティング

- **コンテナが起動しない**: `docker-compose logs solbot-dev`または`docker-compose logs solbot-prod`でログを確認
- **ヘルスチェック失敗**: アプリケーションが正しく起動しているか、APIエンドポイントがアクセス可能か確認
- **ボリュームマウントの問題**: ディレクトリの所有権とアクセス権限を確認

詳細なエラー情報は`logs`ディレクトリ内のログファイルを参照してください。
