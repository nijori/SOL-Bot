# SOL-Bot 緊急停止機能ガイド

## 概要

SOL-Botには緊急停止機能が実装されており、特定のフラグファイルを作成するだけで、実行中のボットを安全かつ迅速に停止することができます。この機能は、異常な市場状況や予期せぬ動作が発生した場合に、トレーディングアクティビティを緊急に停止するために使用します。

## 動作の仕組み

1. SOL-Botは起動時と定期的な実行時（5分ごと）に `data/kill-switch.flag` ファイルの存在をチェックします
2. フラグファイルが見つかった場合、ボットは以下の処理を実行します：
   - ログに緊急停止を記録
   - 取引を停止
   - プロセスを終了（終了コード: 1）

## 緊急停止の実行方法

### 方法1: フラグファイルを直接作成

```bash
# プロジェクトルートディレクトリから実行
touch data/kill-switch.flag
```

### 方法2: SSHで接続してsystemctlを使用

```bash
# EC2インスタンスにSSH接続後
sudo systemctl stop bot.service
```

### 方法3: AWS System Manager（SSM）で実行

AWS管理コンソールからEC2インスタンスにコマンドを送信：

```bash
touch /home/ec2-user/SOL-bot/data/kill-switch.flag
```

または

```bash
sudo systemctl stop bot.service
```

## 緊急停止のテスト方法

1. 開発環境でSOL-Botを起動

```bash
npm run dev
```

2. 別のターミナルでフラグファイルを作成

```bash
touch data/kill-switch.flag
```

3. ログを確認し、ボットが30秒以内に停止することを確認

```bash
# ログの末尾を監視
tail -f logs/app.log
```

緊急停止が有効に機能している場合、以下のようなログメッセージが表示されます：

```
[ERROR] 緊急停止フラグが検出されました。アプリケーションを停止します。
[ERROR] 緊急停止処理を実行します。プロセスを終了します。
```

## 緊急停止後の再起動

緊急停止後にボットを再起動するには、まずフラグファイルを削除してから再起動する必要があります：

```bash
# フラグファイルを削除
rm data/kill-switch.flag

# ボットを再起動
npm run start
```

EC2環境では：

```bash
# フラグファイルを削除
rm /home/ec2-user/SOL-bot/data/kill-switch.flag

# サービスを再起動
sudo systemctl start bot.service
```

## 注意事項

- 緊急停止機能はプロセスを完全に終了するため、保存されていない状態やデータが失われる可能性があります
- 緊急停止は残高や注文ステータスなどの現在の状態を保存しません
- ボットの再起動後、市場状況によっては手動での状態確認が必要な場合があります

## トラブルシューティング

### フラグファイルが機能しない場合

1. ファイルパスが正しいことを確認

```bash
ls -la data/kill-switch.flag
```

2. アプリケーションの作業ディレクトリを確認

```bash
pwd
```

3. ファイルのアクセス権を確認

```bash
chmod 644 data/kill-switch.flag
```

### systemctlが機能しない場合

1. サービス設定を確認

```bash
sudo systemctl status bot.service
```

2. サービス設定ファイルを確認

```bash
cat /etc/systemd/system/bot.service
```

3. 最新のエラーログを確認

```bash
journalctl -u bot.service -n 50
``` 