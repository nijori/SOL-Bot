# INF-026: ステージングEC2セットアップ - 次のステップ

## 完了した作業

1. ステージング環境用のTerraformコードを作成
   - `infra/terraform/staging/main.tf` - 主要なリソース定義
   - `infra/terraform/staging/variables.tf` - 変数定義
   - `infra/terraform/staging/outputs.tf` - 出力値定義
   - `infra/terraform/staging/terraform.tfvars.example` - 変数設定例
   - `infra/terraform/staging/README.md` - ステージング環境用のドキュメント
   - `infra/terraform/README.md` - Terraform全体のドキュメント

2. タスクの進捗状況更新
   - 進捗を75%に更新
   - ヘルスステータスを⚠️（遅延気味）に更新

## 次のステップ（実行手順）

### 1. 実際のAWS環境情報の収集

以下の情報を収集する必要があります：
- AWSアカウントID
- 使用するVPC ID
- 使用するサブネットID
- SSHキーペア名（存在しない場合は作成）

### 2. terraform.tfvarsの作成

```bash
cd infra/terraform/staging
cp terraform.tfvars.example terraform.tfvars
```

terraform.tfvarsファイルを開き、実際の値に更新します：

```hcl
# AWS認証とリージョン
region         = "ap-northeast-1"  # 東京リージョン
aws_account_id = "123456789012"    # 実際のAWSアカウントID

# ネットワーク設定
vpc_id         = "vpc-xxxxxxxxxxxxxxxxx"  # 実際のVPC ID
subnet_id      = "subnet-xxxxxxxxxxxxxxxxx"  # 実際のサブネットID

# EC2インスタンス設定
instance_type  = "t3.small"
key_name       = "solbot-stg-key"  # 実際のSSHキーペア名

# アプリケーション設定
app_name       = "solbot"
environment    = "stg"
log_bucket_name = "solbot-logs"
```

### 3. Terraformの実行

```bash
# AWS認証情報の設定
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="ap-northeast-1"

# Terraformの初期化
terraform init

# 実行計画の確認
terraform plan

# リソースの作成
terraform apply
```

### 4. 確認事項

Terraformの実行後、以下の項目を確認します：

1. EC2インスタンスが正常に起動していること
2. セキュリティグループが正しく設定されていること
3. Elastic IPが割り当てられていること
4. SSHでEC2インスタンスに接続できること
5. Docker、Node.js、その他必要なソフトウェアが正しくインストールされていること

### 5. タスクの完了

すべての確認が完了したら、タスクを完了とします：

1. `.todo/sprint.mdc`ファイルを更新
   - チェックボックスを`[x]`に変更
   - 🩺 Health を ✅ に更新
   - 📊 Progress を 100% に更新
   - ✎ Notes に実際のEC2インスタンス情報（パブリックIP）を追記

2. 変更をコミットしてプッシュ
   ```bash
   git add .todo/sprint.mdc
   git commit -m "INF-026: Complete staging EC2 setup"
   git push origin feature/INF-026-staging-ec2
   ```

3. PRを作成してマージ

## 注意事項

- Terraformの状態ファイル（terraform.tfstate）は重要なファイルです。リモートバックエンド（S3など）を使用して保存することを検討してください。
- 機密情報（AWSキーなど）をGitリポジトリにコミットしないように注意してください。
- EC2インスタンスを使用しない時間帯は停止することでコスト削減できます。 