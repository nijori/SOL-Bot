#!/bin/bash

# SOL-Bot デプロイスクリプト
# GitHub Actionsから実行されることを想定したスクリプト

set -e  # エラーが発生したら停止

echo "======== SOL-Bot デプロイスクリプト開始 ========"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOY_LOG="./logs/deploy_${TIMESTAMP}.log"

# ログディレクトリの作成
mkdir -p ./logs

# 環境変数のチェック
if [ -z "$NODE_ENV" ]; then
  echo "NODE_ENV環境変数が設定されていません。'production'として続行します。"
  export NODE_ENV=production
fi

echo "環境: $NODE_ENV" | tee -a $DEPLOY_LOG

# 本番環境ディレクトリ
PRODUCTION_DIR="/opt/solbot"

# バックアップディレクトリ
BACKUP_DIR="${PRODUCTION_DIR}/backups"
mkdir -p $BACKUP_DIR

# 現在のコードをバックアップ
if [ -d "$PRODUCTION_DIR/current" ]; then
  echo "現在の本番コードをバックアップしています..." | tee -a $DEPLOY_LOG
  BACKUP_NAME="backup_${TIMESTAMP}.tar.gz"
  tar -czf "$BACKUP_DIR/$BACKUP_NAME" -C "$PRODUCTION_DIR" current
  echo "バックアップ完了: $BACKUP_DIR/$BACKUP_NAME" | tee -a $DEPLOY_LOG
fi

# 古いバックアップの削除（最新の5つだけ保持）
echo "古いバックアップを削除しています..." | tee -a $DEPLOY_LOG
ls -t $BACKUP_DIR/backup_*.tar.gz | tail -n +6 | xargs rm -f 2>/dev/null || true

# Dockerイメージのビルド
echo "Dockerイメージをビルドしています..." | tee -a $DEPLOY_LOG
docker build -t solbot:latest . --no-cache 2>&1 | tee -a $DEPLOY_LOG

# 古いコンテナを停止・削除
echo "古いコンテナを停止しています..." | tee -a $DEPLOY_LOG
docker ps -a | grep solbot-prod && docker stop solbot-prod || true
docker ps -a | grep solbot-prod && docker rm solbot-prod || true

# 新しいコンテナを起動
echo "新しいコンテナを起動しています..." | tee -a $DEPLOY_LOG
docker-compose up -d solbot-prod 2>&1 | tee -a $DEPLOY_LOG

# コンテナの状態確認
echo "コンテナ起動状態を確認しています..." | tee -a $DEPLOY_LOG
CONTAINER_STATE=$(docker inspect -f '{{.State.Status}}' solbot-prod 2>/dev/null || echo "not_found")

if [ "$CONTAINER_STATE" == "running" ]; then
  echo "デプロイ成功: コンテナが正常に起動しています" | tee -a $DEPLOY_LOG
  
  # ヘルスチェック（30秒待機）
  echo "ヘルスチェックを実行しています（30秒待機）..." | tee -a $DEPLOY_LOG
  sleep 30
  
  # Docker ヘルスステータスの確認
  HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' solbot-prod 2>/dev/null || echo "not_found")
  
  if [ "$HEALTH_STATUS" == "healthy" ]; then
    echo "ヘルスチェック成功: コンテナは正常に動作しています" | tee -a $DEPLOY_LOG
    exit 0
  else
    echo "警告: ヘルスチェックの結果が不明です（ステータス: $HEALTH_STATUS）" | tee -a $DEPLOY_LOG
    docker logs solbot-prod | tail -n 50 | tee -a $DEPLOY_LOG
    # 警告は出すが、エラー終了はしない
    exit 0
  fi
else
  echo "エラー: コンテナが起動していません" | tee -a $DEPLOY_LOG
  docker logs solbot-prod | tee -a $DEPLOY_LOG
  exit 1
fi 