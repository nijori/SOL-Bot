#!/bin/bash

# SOL-Bot 監視スクリプト
# 定期的に実行してシステムの状態を監視し、問題があれば通知する

set -e

# タイムスタンプ
TIMESTAMP=$(date +%Y-%m-%d\ %H:%M:%S)
LOG_FILE="./logs/monitor_$(date +%Y%m%d).log"

# ログディレクトリの作成
mkdir -p ./logs

# Discord Webhook URL (環境変数から取得)
if [ -z "$DISCORD_WEBHOOK_URL" ]; then
  echo "DISCORD_WEBHOOK_URL環境変数が設定されていません。通知は送信されません。"
  DISCORD_WEBHOOK_URL=""
fi

# アラート送信機能
send_alert() {
  local severity="$1"
  local title="$2"
  local message="$3"
  
  echo "[$TIMESTAMP] $severity: $title - $message" >> $LOG_FILE
  
  if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    # 色の設定
    case "$severity" in
      "INFO") color="3447003" ;; # 青
      "WARNING") color="16776960" ;; # 黄
      "CRITICAL") color="15158332" ;; # 赤
      *) color="9807270" ;; # グレー
    esac
    
    # Discordメッセージ送信
    curl -s -H "Content-Type: application/json" \
      -d "{\"embeds\":[{\"title\":\"$title\",\"description\":\"$message\",\"color\":$color,\"footer\":{\"text\":\"SOL-Bot Monitor @ $TIMESTAMP\"}}]}" \
      $DISCORD_WEBHOOK_URL
  fi
}

# コンテナの状態確認
check_container() {
  local container_name="solbot-prod"
  
  # コンテナの存在確認
  if ! docker ps -a | grep -q $container_name; then
    send_alert "CRITICAL" "コンテナが存在しません" "コンテナ '$container_name' が見つかりません。デプロイに問題がある可能性があります。"
    return 1
  fi
  
  # コンテナの状態確認
  local container_state=$(docker inspect -f '{{.State.Status}}' $container_name 2>/dev/null)
  if [ "$container_state" != "running" ]; then
    send_alert "CRITICAL" "コンテナが実行されていません" "コンテナ '$container_name' の状態: $container_state"
    return 1
  fi
  
  # ヘルスチェック
  local health_status=$(docker inspect --format='{{.State.Health.Status}}' $container_name 2>/dev/null || echo "none")
  if [ "$health_status" != "healthy" ] && [ "$health_status" != "none" ]; then
    send_alert "WARNING" "コンテナのヘルスチェックに失敗" "コンテナ '$container_name' のヘルスステータス: $health_status"
  fi
  
  # コンテナの再起動回数
  local restart_count=$(docker inspect -f '{{.RestartCount}}' $container_name 2>/dev/null || echo "0")
  if [ "$restart_count" -gt "3" ]; then
    send_alert "WARNING" "コンテナが頻繁に再起動しています" "コンテナ '$container_name' の再起動回数: $restart_count"
  fi
  
  return 0
}

# ディスク使用量の確認
check_disk_usage() {
  # ルートパーティションの使用率
  local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
  
  if [ "$disk_usage" -gt "90" ]; then
    send_alert "CRITICAL" "ディスク使用量が危険レベル" "ルートパーティションの使用率: ${disk_usage}%"
    return 1
  elif [ "$disk_usage" -gt "80" ]; then
    send_alert "WARNING" "ディスク使用量が高い" "ルートパーティションの使用率: ${disk_usage}%"
  fi
  
  # データディレクトリの使用率
  if [ -d "/opt/solbot/current/data" ]; then
    local data_size=$(du -sh /opt/solbot/current/data | awk '{print $1}')
    echo "[$TIMESTAMP] INFO: データディレクトリのサイズ: $data_size" >> $LOG_FILE
  fi
  
  return 0
}

# メモリ使用量の確認
check_memory_usage() {
  # システム全体のメモリ使用率
  local mem_usage=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
  
  if [ "$mem_usage" -gt "90" ]; then
    send_alert "CRITICAL" "メモリ使用量が危険レベル" "システムメモリの使用率: ${mem_usage}%"
    return 1
  elif [ "$mem_usage" -gt "80" ]; then
    send_alert "WARNING" "メモリ使用量が高い" "システムメモリの使用率: ${mem_usage}%"
  fi
  
  # コンテナのメモリ使用量
  if docker ps | grep -q solbot-prod; then
    local container_mem=$(docker stats solbot-prod --no-stream --format "{{.MemPerc}}" | tr -d '%')
    if [ "$container_mem" -gt "80" ]; then
      send_alert "WARNING" "コンテナのメモリ使用量が高い" "コンテナ 'solbot-prod' のメモリ使用率: ${container_mem}%"
    fi
  fi
  
  return 0
}

# ログファイルのエラー確認
check_logs() {
  if [ -d "/opt/solbot/current/logs" ]; then
    # 最新のログファイルを確認
    local latest_log=$(ls -t /opt/solbot/current/logs/*.log 2>/dev/null | head -1)
    
    if [ -n "$latest_log" ]; then
      # エラーメッセージの検出
      local error_count=$(grep -c -i "error\|exception\|fail" "$latest_log")
      
      if [ "$error_count" -gt "10" ]; then
        local sample_errors=$(grep -i "error\|exception\|fail" "$latest_log" | tail -3)
        send_alert "WARNING" "ログファイルに複数のエラーが検出されました" "エラー数: $error_count\n例: $sample_errors"
      fi
    fi
  fi
}

# メイン処理
echo "[$TIMESTAMP] 監視スクリプト開始" >> $LOG_FILE

# 各チェックを実行
check_container
check_disk_usage
check_memory_usage
check_logs

echo "[$TIMESTAMP] 監視スクリプト終了" >> $LOG_FILE

exit 0 