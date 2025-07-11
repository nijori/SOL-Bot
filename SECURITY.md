# セキュリティポリシー

SOL-Botプロジェクトはセキュリティを重要視しており、ユーザーデータと資産の保護のために複数のセキュリティ対策を実装しています。

## 脆弱性の報告

セキュリティの脆弱性を発見した場合は、以下の手順で報告してください：

1. **公開リポジトリでの公開は避ける**: 脆弱性の詳細を公開Issue/PRとして投稿しないでください
2. **直接連絡**: [security@example.com](mailto:security@example.com)に詳細を送信してください
3. **必要な情報を含める**:
   - 脆弱性の詳細な説明
   - 脆弱性の再現手順
   - 想定される影響
   - 可能であれば修正案

## セキュリティ対策

### 依存関係管理

SOL-Botでは以下の方法で依存関係の脆弱性を防止しています：

#### Dependabot自動アップデート

- 毎週月曜日に実行される自動スキャン
- 安全なマイナー・パッチバージョンアップデートを自動PRとして提案
- メジャーバージョンアップデートは個別レビュー必須
- 開発依存関係と本番依存関係のグループ化によるリスク低減

#### Trivyによる脆弱性スキャン

- 週次のバルク脆弱性スキャン
- PR時の自動脆弱性チェック
- CRITICAL/HIGH重大度の脆弱性を優先的に通知
- SARIFフォーマットでのレポート出力とGitHub Security統合

#### その他のセキュリティ対策

- **SBOM生成**: 全依存関係の可視化と追跡
- **Gitleaks**: 機密情報の漏洩防止
- **セキュリティレポート**: セキュリティスキャン結果の定期的なレポート

## API認証セキュリティ

取引所APIキー管理のベストプラクティス：

1. **最小権限の原則を採用**: トレーディングに必要な最小限の権限のみ付与
2. **IP制限を設定**: 取引所のAPIアクセスを特定IPに制限
3. **Secret Managerを使用**: APIキーをプレーンテキストで保存しない
4. **監視と定期的なローテーション**: 異常なアクティビティを監視し、定期的にAPIキーをローテーション

## ブランチ保護ルール

SOL-Botでは、主要ブランチの保護のために以下のルールを設定しています：

- **レビュー必須**: すべてのPRは少なくとも1人のレビュー承認が必要
- **ステータスチェック必須**: テスト、リント、セキュリティスキャンのパスが必須
- **署名済みコミット推奨**: コミットの信頼性確保のためGPG署名を推奨

## デプロイセキュリティ

- 本番環境への自動デプロイ前にセキュリティスキャンを実行
- デプロイ環境でのシークレット管理（環境変数ではなくシークレットマネージャー使用）
- コンテナイメージの脆弱性スキャン

## セキュリティアップデート履歴

各セキュリティ対策の実装履歴：

| 日付       | 対策    | 詳細                                   |
| ---------- | ------- | -------------------------------------- |
| 2025-04-10 | SEC-003 | gitleaks + SBOM セキュリティ対応導入   |
| 2026-01-10 | SEC-001 | API Key Secret Manager対応実装         |
| 2026-04-20 | INF-021 | CI 依存脆弱性スキャン & Dependabot追加 |
