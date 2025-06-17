# SOL-Bot ステージング環境 Terraform IaC

このディレクトリには、SOL-BotのステージングEC2環境（t3.small）を作成するためのTerraformコードが含まれています。

## 概要

- EC2インスタンス (t3.small)
- セキュリティグループ
- Elastic IP
- IAMロールとポリシー（S3アクセス、SSMパラメータストアアクセス）
- ユーザーデータスクリプト（Docker、Node.jsのインストールなど）

## 前提条件

- Terraform v1.0.0以上がインストールされていること
- AWS CLIがインストールされ、適切に設定されていること
- AWSアカウントへの適切なアクセス権限があること

## 実行手順

### 1. 環境変数の設定

```bash
# AWSの認証情報を設定
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="ap-northeast-1"
```

### 2. パラメータの設定

`terraform.tfvars`ファイルを作成して、必要なパラメータを設定します。

```hcl
# terraform.tfvars
vpc_id         = "vpc-xxxxxxxxxxxxxxxxx"  # 実際のVPC ID
subnet_id      = "subnet-xxxxxxxxxxxxxxxxx"  # 実際のサブネットID
key_name       = "your-key-pair-name"  # 既存のキーペア名
aws_account_id = "123456789012"  # 実際のAWSアカウントID
```

### 3. Terraformの初期化

```bash
terraform init
```

### 4. 実行計画の確認

```bash
terraform plan
```

### 5. リソースの作成

```bash
terraform apply
```

実行後に表示される出力値を確認し、EC2インスタンスのパブリックIPアドレスやDNS名をメモしておきます。

### 6. リソースの削除（必要な場合）

```bash
terraform destroy
```

## 主要なリソース

- **EC2インスタンス**: t3.smallインスタンス（Amazon Linux 2）
- **セキュリティグループ**: SSH、HTTP、HTTPS、API（3000）、Prometheus（9090）ポートを公開
- **Elastic IP**: 固定IPアドレス
- **IAMロール**: S3アクセス、SSMパラメータストアアクセス用のポリシーを含む
- **ユーザーデータ**: Docker、Node.js、その他必要なセットアップを自動実行

## カスタマイズ

`variables.tf`ファイルを編集するか、`terraform.tfvars`ファイルで変数を上書きすることで、以下の設定をカスタマイズできます：

- インスタンスタイプ
- リージョン
- VPC・サブネットID
- キーペア名
- アプリケーション名
- 環境名
- ログバケット名

## 注意事項

- 本番環境での使用前に、セキュリティグループの設定を見直し、必要なIPアドレスからのアクセスのみを許可するように制限することを推奨します。
- SSHキーペアは事前に作成しておく必要があります。
- 初期セットアップ後、実際のアプリケーションのデプロイは別途行う必要があります。 