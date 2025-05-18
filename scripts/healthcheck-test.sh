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

# メイン処理
main() {
  log "SOL-Bot ヘルスチェックテストを開始します"
  
  # 現在のディレクトリがプロジェクトルートか確認
  if [ ! -f "docker-compose.yml" ]; then
    log "エラー: スクリプトはプロジェクトルートディレクトリから実行してください"
    exit 1
  fi
  
  log "docker-compose で環境を起動します..."
  docker-compose up -d
  
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