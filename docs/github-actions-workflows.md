# GitHub Actions ワークフロー詳細ガイド

## 概要

SOL-Botプロジェクトでは、以下のGitHub Actionsワークフローを使用してCI/CDパイプラインを構築しています。

## 🔄 CI/CDパイプライン全体図

```mermaid
graph TD
    A[GitHub Push to master] --> B[ci.yml - CI Tests]
    B --> C{Tests Pass?}
    C -->|✅ Pass| D[deploy-stg.yml - Staging Deploy]
    C -->|❌ Fail| E[❌ CI Failed - Stop]
    
    D --> F[Staging App Deploy]
    F --> G[TST-085: 30s Stop Test]
    G --> H[OPS-009: PnL=0 Smoke Test]
    H --> I{Staging Tests Pass?}
    
    I -->|✅ Pass| J[deploy-prod.yml - Production Deploy] 
    I -->|❌ Fail| K[❌ Staging Failed - Stop]
    
    J --> L[Production App Deploy]
    L --> M[TST-085: Production 30s Stop Test]
    M --> N[OPS-009: Production PnL=0 Smoke Test]
    N --> O{Production Tests Pass?}
    
    O -->|✅ Pass| P[✅ Deployment Complete]
    O -->|❌ Fail| Q[⚠️ Auto-Stop Production Service]
    
    style A fill:#e1f5fe
    style P fill:#c8e6c9
    style E fill:#ffcdd2
    style K fill:#ffcdd2
    style Q fill:#ffcdd2
```

### 🔍 テストフロー詳細

```mermaid
graph LR
    A[Deploy Complete] --> B[TST-085: 30s Stop Test]
    B --> C[systemctl stop service]
    C --> D{Stopped ≤ 30s?}
    D -->|✅ Yes| E[Service Restart]
    D -->|❌ No| F[❌ Test Failed]
    
    E --> G[OPS-009: PnL=0 Test]
    G --> H[curl /api/account]
    H --> I[Extract dailyPnL]
    I --> J{dailyPnL == 0?}
    J -->|✅ Yes| K[✅ All Tests Pass]
    J -->|❌ No| L[🛑 Auto-Stop Service]
    
    style A fill:#e1f5fe
    style K fill:#c8e6c9
    style F fill:#ffcdd2
    style L fill:#ffcdd2
```

## 📋 ワークフロー一覧

**現在のワークフローファイル構成** (2025-06-17時点):
- `deploy-stg.yml` - ステージング環境デプロイ ✅ SSM統合完了
- `deploy-prod.yml` - 本番環境デプロイ ✅ SSM統合完了
- `ci.yml` - CI（テスト・ビルド）✅ 整理完了
- `security-scan.yml` - セキュリティスキャン ✅ 統合強化完了
- `pr-todo-auto-update.yml` - PRタスク自動更新
- `pr-label-check.yml` - PRラベル検証

### デプロイメント系

#### 1. Deploy to Staging (`deploy-stg.yml`) ✅
**目的**: ステージング環境への自動デプロイ  
**トリガー**: `master`ブランチへのpush  
**実行環境**: Ubuntu Latest + Amazon Linux 2023 (EC2)  
**最終更新**: 2025-06-17 (SEC-005/SEC-006: SSM Parameter Store統合完了)

**処理フロー**:
1. **AWS認証**: OIDC認証でSSM Parameter Storeアクセス
2. **設定取得**: SSMから環境変数・SSH鍵・Discord Webhook取得
3. **アプリケーション配布**: rsync+SCPでコードとenv情報をEC2転送
4. **環境構築**: Node.js 18インストール・依存関係構築
5. **TypeScriptビルド**: `npm run build`（`src/` → `dist/`）
6. **systemdサービス**: bot.service作成・設定・起動
7. **ヘルスチェック**: `/api/status`エンドポイント確認（最大6回リトライ）
8. **統合テスト（3ジョブ並行実行）**: 
   - **TST-085**: 30秒以内サービス停止テスト + 復旧確認
   - **OPS-009**: PnL=0 Smokeテスト（独立ジョブ）
9. **Discord通知**: 全ステップの結果通知

**🔒 セキュリティ強化（SEC-005対応）**:
- GitHub Secrets完全削除、SSM Parameter Store統合
- AWS OIDC認証（最小権限IAMポリシー）
- 各ジョブでSSM設定を独立取得（ジョブ間環境変数共有問題解決）

**📊 SSMパラメータ**:
- `/solbot/stg/env` - 環境変数一式
- `/solbot/stg/host` - EC2ホスト名  
- `/solbot/stg/username` - SSH接続ユーザー
- `/solbot/stg/ssh-key` - SSH秘密鍵（SecureString）
- `/solbot/discord/webhook-url` - Discord通知URL

**対象EC2**: `ec2-13-158-58-241.ap-northeast-1.compute.amazonaws.com:3000`

---

#### 2. Deploy to Production (`deploy-prod.yml`) ✅
**目的**: 本番環境への制御されたデプロイ  
**トリガー**: `master`ブランチpush + 手動実行(`workflow_dispatch`)  
**実行環境**: Ubuntu Latest + Amazon Linux 2023 (EC2) - 1台構成  
**最終更新**: 2025-06-17 (SEC-005/SEC-006: SSM Parameter Store統合完了)

**処理フロー**:
1. **AWS認証**: OIDC認証でSSM Parameter Storeアクセス
2. **設定取得**: SSMから本番環境変数・SSH鍵・Discord Webhook取得
3. **アプリケーション配布**: rsync+SCPでコードとenv情報をEC2転送
4. **環境構築**: Node.js 18インストール・依存関係構築  
5. **TypeScriptビルド**: `npm run build`（`src/` → `dist/`）
6. **systemdサービス**: bot-prod.service作成・設定・起動
7. **ヘルスチェック**: `/api/status`エンドポイント確認（ポート3001）
8. **統合テスト**: 
   - **TST-085**: 30秒以内サービス停止テスト + 復旧確認
   - **PnL検証**: 30秒停止テスト内でPnL=0確認（プレースホルダー実装）
9. **Discord通知**: デプロイ・テスト結果通知

**🔒 セキュリティ強化（SEC-005対応）**:
- GitHub Secrets完全削除、SSM Parameter Store統合
- AWS OIDC認証（最小権限IAMポリシー）  
- 本番環境専用SSH鍵管理（`/solbot/prod/ssh-key`）

**📊 SSMパラメータ**:
- `/solbot/prod/env` - 本番環境変数一式
- `/solbot/prod/host` - EC2ホスト名
- `/solbot/prod/username` - SSH接続ユーザー
- `/solbot/prod/ssh-key` - SSH秘密鍵（SecureString）
- `/solbot/discord/webhook-url` - Discord通知URL（共通）

**🏗️ 1台構成の特徴**:
- ディレクトリ分離（Staging: `/opt/solbot`, Production: `/opt/solbot-prod`）
- ポート分離（Staging: 3000, Production: 3001）
- サービス分離（`bot.service`, `bot-prod.service`）

**対象EC2**: `ec2-13-158-58-241.ap-northeast-1.compute.amazonaws.com:3001`

---

## 🧪 統合テスト詳細

### TST-085: 30秒停止テスト

**目的**: サービスが30秒以内に安全に停止できることを確認  
**実行環境**: ステージング・本番両環境  

**テスト手順**:
1. サービス稼働状態確認
2. `systemctl stop` コマンド実行
3. 停止時間が30秒以内かを測定
4. サービス再起動・動作確認

**成功条件**: 
- 停止時間 ≤ 30秒
- サービス正常再起動
- ヘルスチェック成功

### OPS-009: PnL=0 Smokeテスト

**目的**: デプロイ後のPnL（損益）が0であることを確認  
**実行環境**: 
- **ステージング**: 独立した詳細スモークテストジョブ（`pnl-smoke-test`）
- **本番**: 30秒停止テスト内でPnL検証（プレースホルダー実装）

**テスト手順（ステージング詳細版）**:
1. サービス稼働状態確認（`systemctl is-active bot.service`）
2. `/api/account` エンドポイントアクセス（最大6回リトライ）
3. `dailyPnL` 値の抽出（jqまたはgrep/sed）
4. 値が0であることを確認（`0`, `0.0`, `0.00`のいずれか）
5. 残高チェック・健全性検証

**テスト手順（本番軽量版）**:
- 30秒停止テスト内でPnL検証プレースホルダー実装
- 今後の拡張予定：`/api/account`エンドポイント実装後に詳細化

**成功条件**: 
- `dailyPnL === 0` （フレッシュデプロイ後の期待値）
- API正常応答（ステータス200）
- 残高が正常範囲内（≥ 0 USDT）

**🛡️ 安全機能**: 
- **本番環境でテスト失敗時は自動的にサービス停止**
- Discord通知で即座にアラート送信
- GitHub Actions Status も失敗マーク

**💡 スモークテストとは**: 
システムの基本機能が「煙を上げずに」正常動作するかの軽量検証テスト

### OBS-009: /metrics エンドポイント

**目的**: Prometheus形式のメトリクスを公開し、監視システムとの統合を実現  
**実装場所**: `index.ts` の `/metrics` エンドポイント  

**公開メトリクス**:
- `solbot_account_balance`: 現在の残高
- `solbot_daily_pnl`: 日次損益
- `solbot_orders_total`: 注文総数
- `solbot_uptime_seconds`: アプリケーション稼働時間

**Prometheus設定**:
- ステージング: `ec2-13-158-58-241:3000/metrics`
- 本番: `ec2-13-158-58-241:3001/metrics`
- 収集間隔: 30秒

**安全機能**:
- prom-client統合とフォールバック機能
- エラー時も基本メトリクスを提供
- 機密情報を含まない安全な設計

---

### テスト・品質管理系

#### 3. CI/CD Pipeline (`ci.yml`) ✅ 整理完了
**目的**: 継続的インテグレーション（テスト・ビルド専用）  
**トリガー**: push、pull_request

**処理内容**:
- **test**ジョブ:
  - 並列テスト実行（fast/medium/slow/core/heavy）
  - PRでの未完了Todoタスクチェック
- **build**ジョブ:
  - TypeScriptビルド
  - distアーティファクト保存

**特徴** (CICD-008で完了):
- デプロイ機能を専用ワークフローに分離
- CommonJS統一環境でのテスト実行
- 古いPM2/SSH設定完全削除
- Node.js 18に統一

---



### セキュリティ系

#### 6. Security Scan (`security-scan.yml`) ✅ 統合強化完了
**目的**: 包括的なセキュリティチェック  
**トリガー**: push、pull_request、毎日UTC 0:00、週次詳細スキャン、手動実行

**処理内容**:
- **secrets-scan**: gitleaksによる機密情報漏洩検出
- **dependency-scan**: Trivyによる詳細脆弱性チェック（旧trivy-dependency-scan.yml統合）
- **sbom-generation**: CycloneDXによるSBOM生成
- **security-report**: 統合レポート生成

**特徴**:
- SARIF形式でGitHub Securityタブに統合
- PRに詳細脆弱性サマリーを自動コメント（上位5件表示）
- 重大度レベル別の集計表示
- 手動実行時の重大度カスタマイズ対応
- JSONレポート生成とアーティファクト保存

---



### 運用管理系

#### 4. PR Todo Auto Update (`pr-todo-auto-update.yml`)
**目的**: PRマージ時のTodoタスク自動更新  
**トリガー**: pull_request (closed)  
**処理**: PRタイトルのタスクIDを[x]完了状態に更新

#### 5. PR Label Check (`pr-label-check.yml`)
**目的**: PRラベル検証  
**トリガー**: pull_request  
**処理**: 必須ラベルの確認

---

## 🔒 セキュリティ強化（SEC-005/SEC-006対応）

### GitHub Secrets → SSM Parameter Store移行完了

**移行対象**:
- ✅ `STG_SSH_KEY` → `/solbot/stg/ssh-key`
- ✅ `PROD_SSH_KEY` → `/solbot/prod/ssh-key`  
- ✅ `DISCORD_WEBHOOK_URL` → `/solbot/discord/webhook-url`
- ✅ 環境変数一式 → `/solbot/stg/env`, `/solbot/prod/env`

**セキュリティ強化内容**:

1. **AWS OIDC認証**:
   - GitHub Secrets認証からOIDCロールベース認証に移行
   - IAMロール: `arn:aws:iam::475538532274:role/solbot-ci`
   - 最小権限ポリシー（ssm:GetParameter, s3:GetObject/PutObject のみ）

2. **暗号化強化**:
   - SSH秘密鍵: KMS暗号化SecureString（aws/ssm）
   - Discord Webhook: SecureString暗号化
   - 環境変数: SecureString一括管理

3. **アクセス制御**:
   - GitHub ActionsからのみSSMアクセス可能
   - リポジトリ固有の制限（`repo:nijori/SOL_bot:*`）
   - 時限的なアクセストークン（OIDC）

4. **ジョブ間分離**:
   - 各ジョブで独立してSSM Parameter Store取得
   - 環境変数の漏洩防止（ジョブ間非共有）
   - 最小権限でのSSMアクセス

**移行効果**:
- ✅ GitHub Secrets依存完全排除
- ✅ 機密情報の中央集権管理
- ✅ 監査ログ強化（CloudTrail連携）
- ✅ ローテーション・アクセス制御の向上

---

## 🔧 使用方法

### 手動デプロイ実行

本番環境への手動デプロイ：
```bash
# GitHub Actions タブで "Deploy to Production" を選択
# workflow_dispatch で手動実行
# 理由を入力（例：「緊急バグ修正」）
```

### ワークフロー監視

```bash
# ワークフロー状況確認
gh run list --workflow=deploy-stg.yml

# 特定の実行詳細確認
gh run view <run-id>

# ログ確認
gh run view <run-id> --log
```

### セキュリティスキャン結果確認

1. **GitHub Security タブ**: SARIF形式の脆弱性情報
2. **Actions アーティファクト**: 詳細レポート（JSON形式）
3. **PRコメント**: 脆弱性サマリー自動通知

---

## 🎯 最新の成果と今後の計画

### 完了タスク（2025-06-17時点）
- ✅ **SEC-005/SEC-006**: GitHub Secrets → SSM Parameter Store完全移行
- ✅ **CICD-007**: `deploy-prod.yml`のSSM対応・modernization完了
- ✅ **CICD-008**: `ci.yml`の機能整理・重複排除完了
- ✅ **CICD-009**: `trivy-dependency-scan.yml`削除・`security-scan.yml`統合完了
- ✅ **TST-085**: 30秒停止テスト統合（ステージング・本番両環境）
- ✅ **OPS-009**: PnL=0 Smokeテスト実装（ステージング環境）

### 中期計画（P2フェーズ：監視システム整備）
- 監視システム（Prometheus/Grafana）との統合
- Blue/Green デプロイメントの実装
- アラート自動化（Alertmanager + Discord）

### 長期計画
- マルチ環境デプロイ（dev/staging/prod）
- カナリアデプロイメント
- 自動ロールバック機能

---

## 📚 関連ドキュメント

- [systemdデプロイメントガイド](systemd-deployment.md)
- [AWS設定ドキュメント](AWS-S3-SETUP.md)
- [AWS OIDC設定ガイド](aws-oidc-setup.md)
- [Runbook - 運用手順書](runbook.md)
- [セキュリティポリシー](../SECURITY.md)
- [プロジェクト構造](../PROJECT_STRUCTURE.md)

---

## 🚨 トラブルシューティング

### よくある問題

**デプロイ失敗時**:
```bash
# EC2での手動確認
sudo systemctl status bot.service
sudo journalctl -u bot.service -f
```

**ヘルスチェック失敗時**:
```bash
# ステージング環境
curl http://localhost:3000/api/status
sudo netstat -tulpn | grep :3000

# 本番環境
curl http://localhost:3001/api/status
sudo netstat -tulpn | grep :3001
```

**セキュリティスキャンエラー時**:
```bash
# ローカルでのGitleaks実行
gitleaks detect --source . --config .gitleaks.toml
``` 