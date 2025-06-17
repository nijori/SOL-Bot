# INF-025: docker-compose Healthcheck 整備

## 実装内容

INF-025タスクとして、以下の内容を実装しました：

1. `solbot-dev`サービスにHTTP `/api/status`エンドポイントを使用したヘルスチェック設定を追加しました
   - 30秒間隔で実行
   - タイムアウト: 10秒
   - リトライ: 3回
   - 開始までの猶予期間: 40秒 (開発環境は起動に時間がかかるため)

2. Dockerfileに開発環境と本番環境両方にヘルスチェックに必要なcurlをインストールする設定を追加
   - ビルダーステージとプロダクションステージの両方にインストール
   - APTキャッシュをクリーンアップしてイメージサイズを最適化

3. テスト用スクリプトの作成・強化
   - Bash版: `scripts/healthcheck-test.sh` (Docker実行状態チェック機能追加)
   - PowerShell版: `scripts/healthcheck-test.ps1` (Docker実行状態チェック機能追加)
   - テスト用の簡易設定: `docker-compose.test.yml`
   - APIエンドポイントテスト: `scripts/test-api-status.js`

4. ネットワーク設定の追加
   - docker-compose.ymlに`app-network`ネットワーク定義を追加

## テスト方法

### 前提条件
1. Docker Desktopがインストールされていること
2. Docker Desktopが起動していること（スクリプトは起動状態を確認します）

### テスト実行手順

#### PowerShell（Windows）:
```powershell
.\scripts\healthcheck-test.ps1
```

#### Bash（Linux/Mac）:
```bash
chmod +x scripts/healthcheck-test.sh
./scripts/healthcheck-test.sh
```

#### APIエンドポイント単体テスト:
```bash
node scripts/test-api-status.js
```

#### 簡易テスト用のcompose設定:
```
docker-compose -f docker-compose.test.yml up -d
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## 検証基準

- solbot-devとsolbot-prodの両方のコンテナが起動し、ヘルスステータスが「healthy」と表示される
- `docker ps`コマンドの出力で、両コンテナのStatusに「healthy」と表示されること
- `/api/status`エンドポイントが正常に動作し、適切なJSONレスポンスが返されること

## テスト環境での検証手順

1. Docker Desktopが起動していることを確認
2. 次のコマンドを実行して、docker-compose.test.ymlファイルを使用した簡易テストを実行:
   ```
   docker-compose -f docker-compose.test.yml up -d
   ```
3. nginx-testコンテナのヘルスステータスを確認:
   ```
   docker ps --format "table {{.Names}}\t{{.Status}}"
   ```
4. 成功確認後、次のコマンドで実際のアプリケーションを起動:
   ```
   docker-compose up -d solbot-dev solbot-prod
   ```
5. 両方のコンテナのヘルスステータスを確認:
   ```
   docker ps --format "table {{.Names}}\t{{.Status}}"
   ```
6. テスト完了後、環境をクリーンアップ:
   ```
   docker-compose down
   ```

## 注意事項

- ESモジュール関連の問題により、実環境でのテストが困難な場合があります
- 本番環境での完全なテストには、package.json設定の調整が必要な可能性があります
- Docker Desktopが実行されていない場合、テストスクリプトはエラーメッセージを表示して終了します 