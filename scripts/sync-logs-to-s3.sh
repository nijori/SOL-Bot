#!/bin/bash
# S3へログファイルを同期するスクリプト

# 環境変数から値を取得、設定されていない場合はデフォルト値を使用
S3_BUCKET=${S3_BUCKET:-solbot-logs}
AWS_REGION=${AWS_REGION:-ap-northeast-1}
LOG_DIR=${LOG_DIR:-/app/logs}
RETENTION_DAYS=${LOG_RETENTION_DAYS:-90}

# 現在の日付を取得してS3のプレフィックスを生成
DATE_PREFIX=$(date +%Y/%m/%d)

echo "Starting log sync to S3 bucket $S3_BUCKET"

# S3へログファイルを同期
aws s3 sync $LOG_DIR s3://$S3_BUCKET/logs/$DATE_PREFIX \
  --exclude "*" \
  --include "*.log" \
  --include "*.json" \
  --region $AWS_REGION

# 古いローカルログファイルを削除
echo "Deleting local log files older than $RETENTION_DAYS days"
find $LOG_DIR -name "*.log.*.gz" -mtime +$RETENTION_DAYS -delete
find $LOG_DIR -name "*.json.*.gz" -mtime +$RETENTION_DAYS -delete

echo "Log sync completed at $(date)" 