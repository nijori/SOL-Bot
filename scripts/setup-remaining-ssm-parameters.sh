#!/bin/bash

# SEC-006: 残りのSSMパラメータ設定スクリプト
# 使用方法: このスクリプトを実行前に、必要な値を設定してください

set -e

echo "=== SEC-006: 残りのSSMパラメータ設定 ==="

# 1. SSH秘密鍵の設定（GitHub SecretsのSTG_SSH_KEYとPROD_SSH_KEYの値が必要）
echo "SSH秘密鍵を設定します..."

# ステージング用SSH秘密鍵（GitHub Secrets STG_SSH_KEYの値を入力）
read -p "GitHub SecretsのSTG_SSH_KEYの値を貼り付けてください: " STG_SSH_KEY
if [ -n "$STG_SSH_KEY" ]; then
    aws ssm put-parameter \
        --name "/solbot/stg/ssh-key" \
        --type "SecureString" \
        --value "$STG_SSH_KEY" \
        --description "SOL Bot ステージング環境のSSH秘密鍵" \
        --overwrite
    echo "✅ /solbot/stg/ssh-key 設定完了"
else
    echo "⚠️ STG_SSH_KEYがスキップされました"
fi

# 本番用SSH秘密鍵（GitHub Secrets PROD_SSH_KEYの値を入力）
read -p "GitHub SecretsのPROD_SSH_KEYの値を貼り付けてください（無い場合はEnter）: " PROD_SSH_KEY
if [ -n "$PROD_SSH_KEY" ]; then
    aws ssm put-parameter \
        --name "/solbot/prod/ssh-key" \
        --type "SecureString" \
        --value "$PROD_SSH_KEY" \
        --description "SOL Bot 本番環境のSSH秘密鍵" \
        --overwrite
    echo "✅ /solbot/prod/ssh-key 設定完了"
else
    echo "⚠️ PROD_SSH_KEYがスキップされました"
fi

# 2. Discord Webhook URLの設定
echo ""
echo "Discord Webhook URLを設定します..."
read -p "GitHub SecretsのDISCORD_WEBHOOK_URLの値を貼り付けてください: " DISCORD_WEBHOOK_URL
if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    aws ssm put-parameter \
        --name "/solbot/discord/webhook-url" \
        --type "SecureString" \
        --value "$DISCORD_WEBHOOK_URL" \
        --description "SOL Bot Discord通知用Webhook URL" \
        --overwrite
    echo "✅ /solbot/discord/webhook-url 設定完了"
else
    echo "⚠️ DISCORD_WEBHOOK_URLがスキップされました"
fi

# 3. 本番環境のホスト設定（必要に応じて）
echo ""
read -p "本番環境のホスト名を入力してください（ステージングと同じ場合はEnter）: " PROD_HOST
if [ -n "$PROD_HOST" ]; then
    aws ssm put-parameter \
        --name "/solbot/prod/host" \
        --type "String" \
        --value "$PROD_HOST" \
        --description "SOL Bot 本番環境のホスト名" \
        --overwrite
    echo "✅ /solbot/prod/host 設定完了"
else
    # ステージングと同じホストを使用
    aws ssm put-parameter \
        --name "/solbot/prod/host" \
        --type "String" \
        --value "ec2-13-158-58-241.ap-northeast-1.compute.amazonaws.com" \
        --description "SOL Bot 本番環境のホスト名" \
        --overwrite
    echo "✅ /solbot/prod/host 設定完了（ステージングと同じホスト）"
fi

# 本番環境のユーザー名
aws ssm put-parameter \
    --name "/solbot/prod/username" \
    --type "String" \
    --value "ec2-user" \
    --description "SOL Bot 本番環境のSSHユーザー名" \
    --overwrite
echo "✅ /solbot/prod/username 設定完了"

echo ""
echo "=== パラメータ設定完了確認 ==="
aws ssm describe-parameters --parameter-filters "Key=Name,Option=BeginsWith,Values=/solbot/" \
    --query 'Parameters[].Name' --output table

echo ""
echo "🎉 SSMパラメータ設定が完了しました！"
echo "次のステップ："
echo "1. deploy-stg.ymlでSSM統合をテスト"
echo "2. 動作確認後、GitHub Secretsから対応する値を削除"
echo "3. SEC-006タスクを100%完了にマーク"