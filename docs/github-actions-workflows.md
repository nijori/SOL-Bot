# GitHub Actions ワークフロー詳細ガイド

## 概要

SOL-Botプロジェクトでは、以下のGitHub Actionsワークフローを使用してCI/CDパイプラインを構築しています。

## 📋 ワークフロー一覧

### デプロイメント系

#### 1. Deploy to Staging (`deploy-stg.yml`) ✅
**目的**: ステージング環境への自動デプロイ  
**トリガー**: `master`ブランチへのpush  
**実行環境**: Ubuntu Latest + Amazon Linux 2023 (EC2)

**処理フロー**:
1. **ソースコード準備**: rsync+SCPでソースコードをEC2に転送
2. **環境構築**: Node.js 18インストール・NPMアップデート
3. **アプリケーションビルド**: TypeScriptコンパイル（`src/` → `dist/`）
4. **systemdサービス設定**: bot.serviceファイル作成・強制更新
5. **サービス起動**: systemctl start + ヘルスチェック
6. **通知**: Discord通知（成功・失敗）

**特徴**:
- here-document構文エラー修正済み
- TypeScriptビルド対応（`ExecStart=/usr/bin/node dist/index.js`）
- ヘルスチェックエンドポイント（`/api/status`）での起動確認
- Discord通知の条件付き実行（Webhook URL設定時のみ）

**対象EC2**: `ec2-13-158-58-241.ap-northeast-1.compute.amazonaws.com`

---

#### 2. Deploy to Production (`deploy-prod.yml`) ✅
**目的**: 本番環境への制御されたデプロイ  
**トリガー**: `master`ブランチpush + 手動実行(`workflow_dispatch`)  
**実行環境**: Ubuntu Latest + Amazon Linux 2023 (EC2) - 1台構成

**処理フロー**:
1. **ソースコード準備**: rsync+SCPでソースコードをEC2に転送
2. **環境構築**: Node.js 18インストール・NPMアップデート
3. **アプリケーションビルド**: TypeScriptコンパイル（`src/` → `dist/`）
4. **systemdサービス設定**: bot-prod.serviceファイル作成・強制更新
5. **サービス起動**: systemctl start + ヘルスチェック（ポート3001）
6. **統合テスト**: TST-085（30秒以内サービス停止テスト）
7. **通知**: Discord通知（成功・失敗）

**特徴**:
- SSM Parameter Store対応（`/solbot/prod/env`）
- 1台構成（ステージングと本番が同居、ディレクトリ分離）
- ポート分離（Staging: 3000, Production: 3001）
- 本番専用systemdサービス（`bot-prod.service`）
- 統合テスト自動実行（サービス停止・復旧テスト）

**対象EC2**: `ec2-13-158-58-241.ap-northeast-1.compute.amazonaws.com`

---

### テスト・品質管理系

#### 3. CI/CD Pipeline (`ci.yml`) ⚠️ 整理予定
**目的**: 統合CI/CDパイプライン（テスト・ビルド・デプロイ）  
**トリガー**: push、pull_request

**処理内容**:
- **lint-and-test**ジョブ:
  - ESLint実行
  - 並列テスト実行（fast/medium/slow/core/heavy/esm）
  - PRでの未完了Todoタスクチェック
- **build**ジョブ:
  - TypeScriptビルド
  - distアーティファクト保存
- **deploy**ジョブ:
  - EC2への本番デプロイ（masterブランチのみ）

**問題と修正予定** (CICD-008):
- `deploy-stg.yml`との機能重複排除
- テスト・ビルドのみに機能限定
- 古いPM2設定削除

---

#### 4. ESM Tests (`esm-tests.yml`)
**目的**: ESM環境専用テスト実行  
**トリガー**: push、pull_request  
**特徴**: ES Modulesでのモック互換性検証

---

### セキュリティ系

#### 5. Security Scan (`security-scan.yml`) ✅ 保持推奨
**目的**: 包括的なセキュリティチェック  
**トリガー**: push、pull_request、毎日UTC 0:00

**処理内容**:
- **secrets-scan**: gitleaksによる機密情報漏洩検出
- **dependency-scan**: Trivyによる依存関係脆弱性チェック
- **sbom-generation**: CycloneDXによるSBOM生成
- **security-report**: 統合レポート生成

**特徴**:
- SARIF形式でGitHub Securityタブに統合
- PRに脆弱性サマリーを自動コメント
- 重大度レベル別の集計表示

---

#### 6. Trivy Dependency Scan (`trivy-dependency-scan.yml`) ❌ 削除予定
**目的**: 依存関係脆弱性スキャン  
**問題**: `security-scan.yml`と機能完全重複

**対応** (CICD-009): 削除して`security-scan.yml`に統合

---

### 運用管理系

#### 7. PR Todo Auto Update (`pr-todo-auto-update.yml`)
**目的**: PRマージ時のTodoタスク自動更新  
**トリガー**: pull_request (closed)  
**処理**: PRタイトルのタスクIDを[x]完了状態に更新

#### 8. PR Label Check (`pr-label-check.yml`)
**目的**: PRラベル検証  
**トリガー**: pull_request  
**処理**: 必須ラベルの確認

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

## 🎯 改善計画

### 短期（W12スプリント）
- **CICD-007**: ✅ `deploy-prod.yml`のSSM対応・modernization完了
- **CICD-008**: `ci.yml`の機能整理・重複排除
- **CICD-009**: `trivy-dependency-scan.yml`削除

### 中期（W13-W14スプリント）
- Blue/Green デプロイメントの実装
- Parameter Store integration
- 監視システム（Prometheus/Grafana）との統合

### 長期
- マルチ環境デプロイ（dev/staging/prod）
- カナリアデプロイメント
- 自動ロールバック機能

---

## 📚 関連ドキュメント

- [systemdデプロイメントガイド](systemd-deployment.md)
- [AWS設定ドキュメント](AWS-S3-SETUP.md)
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