#!/bin/bash

# エラー時に停止
set -e

# root権限チェック
if [ "$EUID" -ne 0 ]; then
    echo "このスクリプトはroot権限で実行する必要があります"
    exit 1
fi

# solbotユーザーとグループの作成
if ! getent group solbot > /dev/null; then
    groupadd solbot
fi

if ! getent passwd solbot > /dev/null; then
    useradd -r -g solbot -d /opt/solbot -s /bin/false solbot
fi

# アプリケーションディレクトリの作成と権限設定
mkdir -p /opt/solbot
chown solbot:solbot /opt/solbot

# ログディレクトリの作成と権限設定
mkdir -p /var/log/solbot
chown solbot:solbot /var/log/solbot
chmod 755 /var/log/solbot

# サービスユニットファイルのコピー
cp solbot.service /etc/systemd/system/
chmod 644 /etc/systemd/system/solbot.service

# systemdの再読み込みと自動起動の有効化
systemctl daemon-reload
systemctl enable solbot.service

echo "SOL Botサービスのセットアップが完了しました"
echo "以下のコマンドでサービスを管理できます:"
echo "  開始: systemctl start solbot"
echo "  停止: systemctl stop solbot"
echo "  状態確認: systemctl status solbot"
echo "  ログ確認: journalctl -u solbot" 