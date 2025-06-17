# SOL-Bot ステージング環境用 Terraform 変数
# 実際の値に変更し、terraform.tfvarsとして保存してください

# AWS認証とリージョン
region         = "ap-northeast-1"  # 東京リージョン
aws_account_id = "475538532274"    # 実際のAWSアカウントID

# ネットワーク設定
vpc_id         = "vpc-0a5247fa3321bc5e6"  # 実際のVPC ID
subnet_id      = "subnet-0d9a3cc365a05c510"  # 実際のサブネットID

# EC2インスタンス設定
instance_type  = "t3.small"  # インスタンスタイプ
key_name       = "solbot-stg-key"  # 既存のSSHキーペア名

# アプリケーション設定
app_name       = "solbot"  # アプリケーション名
environment    = "stg"  # 環境名
log_bucket_name = "solbot-logs"  # ログ保存用S3バケット名 