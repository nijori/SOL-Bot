# AWS S3 / Glacier 設定ガイド

このガイドでは、SOL-Botのデータライフサイクル管理機能を使用するための AWS S3 バケットとGlacier設定の手順を説明します。

## 前提条件

- AWSアカウント
- AWS CLIがインストールされていること
- 適切な権限（S3およびGlacierへのアクセス権）を持つIAMユーザー

## 環境変数の設定

以下の環境変数を`.env`ファイルに設定してください：

```
# AWS設定
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
S3_BUCKET=solbot-data
S3_ARCHIVE_BUCKET=solbot-archive

# データライフサイクル管理設定
DATA_RETENTION_DAYS=90  # ローカルでの保持日数
GLACIER_MOVE_DAYS=30    # S3からGlacierに移動するまでの日数
CRON_SCHEDULE=0 3 * * * # スケジュール設定（デフォルト：毎日午前3時）
```

## S3バケットの作成

1. AWSマネジメントコンソールからS3サービスに移動
2. 「バケットを作成」をクリック
3. バケット名に`solbot-data`（または環境変数で指定した名前）を入力
4. リージョンを選択（環境変数と同じリージョン）
5. 他の設定はデフォルトのままで「バケットを作成」をクリック

同様に、アーカイブ用バケット`solbot-archive`も作成します。

## AWS CLIを使用してバケットを作成

AWS CLIを使用する場合は、以下のコマンドでバケットを作成できます：

```bash
# データバケットの作成
aws s3 mb s3://solbot-data --region ap-northeast-1

# アーカイブバケットの作成
aws s3 mb s3://solbot-archive --region ap-northeast-1
```

## S3からGlacierへのライフサイクルルール設定

アーカイブバケット（solbot-archive）にライフサイクルルールを設定して、アップロードされたデータを自動的にGlacierに移行します：

1. AWSマネジメントコンソールからS3サービスに移動
2. `solbot-archive`バケットを選択
3. 「管理」タブ→「ライフサイクルルール」→「ルールを作成」をクリック
4. ルール名を入力（例：`GlacierArchiveRule`）
5. ルールの範囲を選択（すべてのオブジェクト）
6. 「ライフサイクルルールのアクション」で「現在のバージョンの移行」にチェック
7. 「Glacier Deep Archive に移行」を選択し、日数に「0」と入力（すぐに移行）
8. 「作成」をクリック

## AWS CLIでライフサイクルルールを設定

AWS CLIを使用する場合は、以下の手順でライフサイクルルールを設定できます：

1. lifecycle.jsonファイルを作成：

```json
{
  "Rules": [
    {
      "ID": "GlacierArchiveRule",
      "Status": "Enabled",
      "Prefix": "",
      "Transitions": [
        {
          "Days": 0,
          "StorageClass": "GLACIER"
        }
      ]
    }
  ]
}
```

2. ライフサイクルルールを適用：

```bash
aws s3api put-bucket-lifecycle-configuration --bucket solbot-archive --lifecycle-configuration file://lifecycle.json
```

## IAMユーザーの権限設定

データライフサイクル管理スクリプトを実行するIAMユーザーには、以下の権限が必要です：

- S3へのアクセス（PutObject, GetObject, DeleteObject, ListBucket）
- Glacierへのアクセス（InitiateJob, UploadArchive）

IAMポリシーの例：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::solbot-data",
        "arn:aws:s3:::solbot-data/*",
        "arn:aws:s3:::solbot-archive",
        "arn:aws:s3:::solbot-archive/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["glacier:InitiateJob", "glacier:UploadArchive"],
      "Resource": "*"
    }
  ]
}
```

## データライフサイクル管理スクリプトの実行

環境変数とAWS設定が完了したら、以下のコマンドでデータライフサイクル管理スクリプトを実行できます：

```bash
# 即時実行
npm run data-lifecycle:now

# スケジュール設定して実行（デーモンとして動作）
npm run data-lifecycle:schedule

# ヘルプを表示
npm run data-lifecycle:help
```

## トラブルシューティング

1. **認証エラー**：AWS認証情報（AWS_ACCESS_KEY_IDとAWS_SECRET_ACCESS_KEY）が正しく設定されているか確認してください。

2. **権限エラー**：IAMユーザーに適切な権限が付与されているか確認してください。

3. **リージョンエラー**：環境変数のAWS_REGIONと実際のバケットのリージョンが一致しているか確認してください。

4. **ロギング**：スクリプト実行中のログは`logs/combined.log`に記録されます。問題が発生した場合はこのログを確認してください。
