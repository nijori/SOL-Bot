# SOL Trading Bot - systemd Deployment Guide

## 概要

このガイドでは、SOL Trading BotをLinux systemdサービスとしてデプロイする方法を説明します。

## 前提条件

- Linux環境（Ubuntu 20.04+ 推奨）
- Node.js 18+ がインストール済み
- sudo権限を持つユーザー
- Git でリポジトリがクローン済み

## インストール手順

### 1. systemdサービスのインストール

```bash
# リポジトリルートで実行
sudo ./scripts/install-systemd-service.sh
```

このスクリプトは以下を実行します：
- `solbot` システムユーザーの作成
- `/opt/solbot` ディレクトリの作成
- systemdサービスファイルのインストール
- サービスの有効化（自動起動設定）

### 2. アプリケーションのデプロイ

```bash
# リポジトリルートで実行
sudo ./scripts/deploy-to-systemd.sh
```

このスクリプトは以下を実行します：
- 既存サービスの停止
- アプリケーションファイルのコピー
- 依存関係のインストール
- サービスの起動

## サービス管理

### 基本コマンド

```bash
# サービス開始
sudo systemctl start bot

# サービス停止
sudo systemctl stop bot

# サービス再起動
sudo systemctl restart bot

# サービス状態確認
sudo systemctl status bot

# ログ確認
sudo journalctl -u bot -f

# 最新50行のログ確認
sudo journalctl -u bot -n 50
```

### 自動起動設定

```bash
# 自動起動を有効化
sudo systemctl enable bot

# 自動起動を無効化
sudo systemctl disable bot
```

## 設定ファイル

### systemdサービス設定

ファイル: `/etc/systemd/system/bot.service`

主要な設定項目：
- `TimeoutStopSec=30`: 停止タイムアウト30秒
- `KillMode=mixed`: 適切なプロセス終了処理
- `Restart=always`: 異常終了時の自動再起動
- セキュリティ強化設定（NoNewPrivileges, PrivateTmp等）

### 環境変数

環境変数は以下の方法で設定できます：

1. `.env` ファイル（`/opt/solbot/.env`）
2. systemdサービスファイルの `Environment=` 行
3. `/etc/systemd/system/bot.service.d/override.conf` での上書き

## ディレクトリ構造

```
/opt/solbot/
├── src/                 # アプリケーションソースコード
├── data/               # データファイル（solbotユーザー書き込み可能）
├── logs/               # ログファイル（solbotユーザー書き込み可能）
├── node_modules/       # Node.js依存関係
├── package.json        # パッケージ設定
├── .env               # 環境変数（オプション）
└── tsconfig*.json     # TypeScript設定
```

## トラブルシューティング

### サービスが起動しない場合

1. ログを確認：
   ```bash
   sudo journalctl -u bot -n 50
   ```

2. Node.jsのパスを確認：
   ```bash
   which node
   # /usr/bin/node であることを確認
   ```

3. ファイル権限を確認：
   ```bash
   ls -la /opt/solbot/
   # solbot:solbot の所有権であることを確認
   ```

### パフォーマンス問題

1. リソース使用量を確認：
   ```bash
   sudo systemctl status bot
   ```

2. メモリ使用量を監視：
   ```bash
   sudo journalctl -u bot | grep -i memory
   ```

### 設定変更後の反映

systemdサービスファイルを変更した場合：
```bash
sudo systemctl daemon-reload
sudo systemctl restart bot
```

## セキュリティ考慮事項

- `solbot` ユーザーはシステムユーザー（ログイン不可）
- 最小権限の原則に基づく設定
- 書き込み可能ディレクトリの制限
- プロセス分離とセキュリティ機能の有効化

## 監視とメンテナンス

### ヘルスチェック

アプリケーションは `/api/status` エンドポイントでヘルスチェックを提供します：

```bash
curl http://localhost:3000/api/status
```

### ログローテーション

systemd journalは自動的にログローテーションを行いますが、必要に応じて設定を調整できます：

```bash
# ログサイズ制限の確認
sudo journalctl --disk-usage

# 古いログの削除
sudo journalctl --vacuum-time=30d
```

## 更新手順

1. 新しいコードをデプロイ：
   ```bash
   sudo ./scripts/deploy-to-systemd.sh
   ```

2. サービス状態を確認：
   ```bash
   sudo systemctl status bot
   ```

3. ログで正常動作を確認：
   ```bash
   sudo journalctl -u bot -f
   ``` 