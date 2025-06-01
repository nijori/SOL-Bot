#!/usr/bin/env pwsh
# SOL-Bot Healthcheck Test Script for PowerShell
# docker-composeサービスのヘルスステータスをチェックします

# ログファイルの設定
$LogFile = "logs/healthcheck_test_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
New-Item -Path "logs" -ItemType Directory -Force | Out-Null

# ログ出力関数
function Write-Log {
    param (
        [string]$Message
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $LogFile -Value $logMessage
}

# Docker Desktopの実行状態を確認する関数
function Test-DockerRunning {
    try {
        $result = docker info 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Log "エラー: Docker Desktopが実行されていません。Docker Desktopを起動してください。"
            Write-Log "エラー詳細: $result"
            return $false
        }
        return $true
    }
    catch {
        Write-Log "エラー: Docker Desktopの状態確認中に例外が発生しました: $_"
        return $false
    }
}

# ヘルスチェック関数
function Test-ContainerHealth {
    param (
        [string]$ContainerName,
        [int]$Timeout = 180
    )
    
    Write-Log "コンテナ '$ContainerName' のヘルスステータスをチェックしています..."
    
    $elapsed = 0
    $status = ""
    
    while ($elapsed -lt $Timeout) {
        # コンテナの存在確認
        $containerExists = docker ps -a | Select-String -Pattern $ContainerName
        if (-not $containerExists) {
            Write-Log "エラー: コンテナ '$ContainerName' が存在しません"
            return $false
        }
        
        # コンテナの状態確認
        $state = docker inspect -f "{{.State.Status}}" $ContainerName 2>$null
        if ($state -ne "running") {
            Write-Log "エラー: コンテナ '$ContainerName' が実行されていません (状態: $state)"
            return $false
        }
        
        # ヘルスステータスの取得
        try {
            $status = docker inspect --format="{{.State.Health.Status}}" $ContainerName 2>$null
        }
        catch {
            $status = "none"
        }
        
        if ($status -eq "healthy") {
            Write-Log "成功: コンテナ '$ContainerName' は正常 (healthy) です"
            return $true
        }
        
        Write-Log "待機中... コンテナ '$ContainerName' の現在のステータス: $status (経過時間: ${elapsed}秒)"
        Start-Sleep -Seconds 10
        $elapsed += 10
    }
    
    Write-Log "タイムアウト: コンテナ '$ContainerName' が $Timeout 秒以内に正常状態にならなかった (最終ステータス: $status)"
    
    # 最後のヘルスチェックログを表示
    Write-Log "ヘルスチェックログ:"
    $healthLogs = docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' $ContainerName
    Write-Log $healthLogs
    
    return $false
}

# 簡易的なヘルスチェックテスト関数
function Test-SimpleHealthcheck {
    Write-Log "簡易的なヘルスチェックテストを実行します..."
    
    # test.ymlファイルを使用してnginxコンテナを起動
    Write-Log "docker-compose.test.yml を使用してテスト環境を起動します..."
    docker-compose -f docker-compose.test.yml up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Log "エラー: テスト環境の起動に失敗しました"
        return $false
    }
    
    # nginx-testコンテナのヘルスチェック
    if (Test-ContainerHealth -ContainerName "nginx-test" -Timeout 60) {
        Write-Log "✅ nginx-test ヘルスチェックに成功しました"
        
        # テスト完了後にコンテナを停止
        Write-Log "テスト環境を停止しています..."
        docker-compose -f docker-compose.test.yml down
        
        return $true
    }
    else {
        Write-Log "❌ nginx-test ヘルスチェックに失敗しました"
        
        # 失敗時もコンテナを停止
        Write-Log "テスト環境を停止しています..."
        docker-compose -f docker-compose.test.yml down
        
        return $false
    }
}

# メイン処理
function Start-HealthcheckTest {
    Write-Log "SOL-Bot ヘルスチェックテストを開始します"
    
    # 現在のディレクトリがプロジェクトルートか確認
    if (-not (Test-Path "docker-compose.yml")) {
        Write-Log "エラー: スクリプトはプロジェクトルートディレクトリから実行してください"
        exit 1
    }
    
    # Docker Desktopの実行状態を確認
    if (-not (Test-DockerRunning)) {
        Write-Log "Docker Desktopが実行されていません。Docker Desktopを起動してからスクリプトを再実行してください。"
        exit 1
    }
    
    # まず簡易的なヘルスチェックテストを実行
    if (-not (Test-SimpleHealthcheck)) {
        Write-Log "簡易的なヘルスチェックテストに失敗しました。Docker環境を確認してください。"
        exit 1
    }
    
    Write-Log "docker-compose で環境を起動します..."
    docker-compose up -d solbot-dev solbot-prod
    
    # 開発環境のヘルスチェック (開発環境は起動に時間がかかる可能性あり)
    if (Test-ContainerHealth -ContainerName "solbot-dev" -Timeout 240) {
        Write-Log "✅ solbot-dev ヘルスチェックに成功しました"
    }
    else {
        Write-Log "❌ solbot-dev ヘルスチェックに失敗しました"
        exit 1
    }
    
    # 本番環境のヘルスチェック
    if (Test-ContainerHealth -ContainerName "solbot-prod" -Timeout 180) {
        Write-Log "✅ solbot-prod ヘルスチェックに成功しました"
    }
    else {
        Write-Log "❌ solbot-prod ヘルスチェックに失敗しました"
        exit 1
    }
    
    Write-Log "🎉 すべてのヘルスチェックが成功しました"
    Write-Log "SOL-Bot ヘルスチェックテストを完了しました"
}

# スクリプト実行
Start-HealthcheckTest 