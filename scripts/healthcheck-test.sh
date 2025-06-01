#!/bin/bash
# SOL-Bot Healthcheck Test Script
# docker-composeサービスのヘルスステータスをチェックします

set -e

# ログファイルの設定
LOG_FILE="logs/healthcheck_test_$(date +%Y%m%d_%H%M%S).log"
mkdir -p logs

# ログ出力関数
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

# Docker実行状態確認関数
check_docker_running() {
  log "Dockerの実行状態を確認中..."
  
  if ! docker info > /dev/null 2>&1; then
    log "エラー: Dockerが実行されていません。Docker Desktopを起動してください。"
    return 1
  fi
  
  log "Docker環境は正常に実行されています。"
  return 0
}

# ヘルスチェック関数
check_health() {
  local container_name=$1
  local timeout=${2:-180} # デフォルトのタイムアウト: 180秒
  local elapsed=0
  local status=""

  log "コンテナ '$container_name' のヘルスステータスをチェックしています..."
  
  while [ $elapsed -lt $timeout ]; do
    # コンテナが存在するか確認
    if ! docker ps -a | grep -q $container_name; then
      log "エラー: コンテナ '$container_name' が存在しません"
      return 1
    fi
    
    # コンテナが実行中か確認
    local state=$(docker inspect -f '{{.State.Status}}' $container_name 2>/dev/null)
    if [ "$state" != "running" ]; then
      log "エラー: コンテナ '$container_name' が実行されていません (状態: $state)"
      return 1
    fi
    
    # ヘルスステータスの取得
    status=$(docker inspect --format='{{.State.Health.Status}}' $container_name 2>/dev/null || echo "none")
    
    if [ "$status" = "healthy" ]; then
      log "成功: コンテナ '$container_name' は正常 (healthy) です"
      return 0
    fi
    
    log "待機中... コンテナ '$container_name' の現在のステータス: $status (経過時間: ${elapsed}秒)"
    sleep 10
    elapsed=$((elapsed + 10))
  done
  
  log "タイムアウト: コンテナ '$container_name' が $timeout 秒以内に正常状態にならなかった (最終ステータス: $status)"
  
  # 最後のヘルスチェックログを表示
  log "ヘルスチェックログ:"
  docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' $container_name
  
  return 1
}

# 簡易的なヘルスチェックテスト関数
test_simple_healthcheck() {
  log "簡易的なヘルスチェックテストを実行します..."
  
  # test.ymlファイルを使用してnginxコンテナを起動
  log "docker-compose.test.yml を使用してテスト環境を起動します..."
  docker-compose -f docker-compose.test.yml up -d
  
  if [ $? -ne 0 ]; then
    log "エラー: テスト環境の起動に失敗しました"
    return 1
  fi
  
  # nginx-testコンテナのヘルスチェック
  if check_health "nginx-test" 60; then
    log "✅ nginx-test ヘルスチェックに成功しました"
    
    # テスト完了後にコンテナを停止
    log "テスト環境を停止しています..."
    docker-compose -f docker-compose.test.yml down
    
    return 0
  else
    log "❌ nginx-test ヘルスチェックに失敗しました"
    
    # 失敗時もコンテナを停止
    log "テスト環境を停止しています..."
    docker-compose -f docker-compose.test.yml down
    
    return 1
  fi
}

# メイン処理
main() {
  log "SOL-Bot ヘルスチェックテストを開始します"
  
  # 現在のディレクトリがプロジェクトルートか確認
  if [ ! -f "docker-compose.yml" ]; then
    log "エラー: スクリプトはプロジェクトルートディレクトリから実行してください"
    exit 1
  fi
  
  # Docker実行状態を確認
  if ! check_docker_running; then
    log "Docker環境に問題があります。Docker Desktopが実行されているか確認してください。"
    exit 1
  fi
  
  # まず簡易的なヘルスチェックテストを実行
  if ! test_simple_healthcheck; then
    log "簡易的なヘルスチェックテストに失敗しました。Docker環境を確認してください。"
    exit 1
  fi
  
  log "docker-compose で環境を起動します..."
  docker-compose up -d solbot-dev solbot-prod
  
  # 開発環境のヘルスチェック (開発環境は起動に時間がかかる可能性あり)
  if check_health "solbot-dev" 240; then
    log "✅ solbot-dev ヘルスチェックに成功しました"
  else
    log "❌ solbot-dev ヘルスチェックに失敗しました"
    exit 1
  fi
  
  # 本番環境のヘルスチェック
  if check_health "solbot-prod" 180; then
    log "✅ solbot-prod ヘルスチェックに成功しました"
  else
    log "❌ solbot-prod ヘルスチェックに失敗しました"
    exit 1
  fi
  
  log "🎉 すべてのヘルスチェックが成功しました"
  log "SOL-Bot ヘルスチェックテストを完了しました"
}

# スクリプト実行
main "$@"

# 使用方法の説明:
# このスクリプトを実行するには:
# 1. chmod +x scripts/healthcheck-test.sh で実行権限を付与
# 2. ./scripts/healthcheck-test.sh で実行 