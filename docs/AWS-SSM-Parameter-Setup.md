# AWS SSM Parameter Store 設定ガイド

SEC-006タスクの完了に必要なAWS SSM Parameter Store設定手順を記載します。

## 概要

このドキュメントでは、GitHub SecretsからAWS SSM Parameter Storeへの移行に必要なパラメータ設定について説明します。

## 必要なSSMパラメータ一覧

### 1. 環境変数パラメータ (SecureString)

```bash
# ステージング環境変数
aws ssm put-parameter \
  --name "/solbot/stg/env" \
  --type "SecureString" \
  --value "NODE_ENV=staging
LOG_LEVEL=info
PORT=3000
BYBIT_API_KEY=your_staging_api_key
BYBIT_SECRET_KEY=your_staging_secret_key
BINANCE_API_KEY=your_staging_binance_key
BINANCE_SECRET_KEY=your_staging_binance_secret"

# 本番環境変数
aws ssm put-parameter \
  --name "/solbot/prod/env" \
  --type "SecureString" \
  --value "NODE_ENV=production
LOG_LEVEL=warn
PORT=3001
BYBIT_API_KEY=your_production_api_key
BYBIT_SECRET_KEY=your_production_secret_key
BINANCE_API_KEY=your_production_binance_key
BINANCE_SECRET_KEY=your_production_binance_secret"
```

### 2. デプロイメント設定パラメータ

```bash
# ステージング環境設定
aws ssm put-parameter \
  --name "/solbot/stg/host" \
  --type "String" \
  --value "ec2-13-158-58-241.ap-northeast-1.compute.amazonaws.com"

aws ssm put-parameter \
  --name "/solbot/stg/username" \
  --type "String" \
  --value "ec2-user"

aws ssm put-parameter \
  --name "/solbot/stg/ssh-key" \
  --type "SecureString" \
  --value "-----BEGIN OPENSSH PRIVATE KEY-----
[あなたのステージング用SSH秘密鍵をここに貼り付け]
-----END OPENSSH PRIVATE KEY-----"

# 本番環境設定
aws ssm put-parameter \
  --name "/solbot/prod/host" \
  --type "String" \
  --value "your_production_host"

aws ssm put-parameter \
  --name "/solbot/prod/username" \
  --type "String" \
  --value "ec2-user"

aws ssm put-parameter \
  --name "/solbot/prod/ssh-key" \
  --type "SecureString" \
  --value "-----BEGIN OPENSSH PRIVATE KEY-----
[あなたの本番用SSH秘密鍵をここに貼り付け]
-----END OPENSSH PRIVATE KEY-----"
```

### 3. 通知設定パラメータ

```bash
# Discord Webhook URL
aws ssm put-parameter \
  --name "/solbot/discord/webhook-url" \
  --type "SecureString" \
  --value "https://discord.com/api/webhooks/your_webhook_url"
```

## 設定確認コマンド

```bash
# パラメータ一覧確認
aws ssm describe-parameters --parameter-filters "Key=Name,Option=BeginsWith,Values=/solbot/"

# 個別パラメータ値確認（SecureStringも復号化して表示）
aws ssm get-parameter --name "/solbot/stg/env" --with-decryption
aws ssm get-parameter --name "/solbot/stg/host"
aws ssm get-parameter --name "/solbot/stg/username"
aws ssm get-parameter --name "/solbot/discord/webhook-url" --with-decryption
```

## IAM権限要件

GitHub Actions（solbot-ci ロール）に以下の権限が必要：

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ssm:GetParameter",
                "ssm:GetParameters"
            ],
            "Resource": "arn:aws:ssm:ap-northeast-1:475538532274:parameter/solbot/*"
        }
    ]
}
```

## 移行後の動作確認

1. GitHub Actionsワークフローでdeploy-stg.ymlを実行
2. "Retrieve configuration from SSM Parameter Store"ステップが成功することを確認
3. EC2インスタンスに.envファイルが正しく配置されることを確認
4. アプリケーションが正常に起動することを確認

## トラブルシューティング

### よくあるエラーと対処法

1. **ParameterNotFound エラー**
   - パラメータ名のスペルミスを確認
   - `/solbot/` プレフィックスが正しいかチェック

2. **AccessDenied エラー**
   - IAMロールにSSM:GetParameter権限があるか確認
   - リソースARNが正しいか確認

3. **値の形式エラー**
   - SSH秘密鍵の改行文字が保持されているか確認
   - 環境変数の形式（KEY=VALUE）が正しいか確認

## セキュリティ注意事項

- SecureStringタイプのパラメータはKMS暗号化される
- SSH秘密鍵や APIキーは必ずSecureStringタイプで保存
- パラメータへのアクセスはCloudTrailでログ記録される
- 定期的なローテーション（キー更新）を推奨

## 次のステップ

1. 上記のSSMパラメータを設定
2. GitHub Secretsから対応する値を削除
3. deploy-stg.yml／deploy-prod.ymlでの動作確認
4. SEC-005、INF-024タスクへ進行