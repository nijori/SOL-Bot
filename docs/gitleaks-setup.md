# Gitleaksを使用したシークレットスキャンのセットアップ

このドキュメントでは、SOL-botリポジトリでAPI鍵やシークレットが誤ってコミットされないようにするための、Gitleaksを使用したpre-commitフックのセットアップ方法について説明します。

## 前提条件

- Python 3.6以上
- Git

## セットアップ手順

### 1. pre-commitのインストール

まず、pre-commitをインストールします：

```bash
pip install pre-commit
```

または

```bash
pip3 install pre-commit
```

### 2. pre-commitフックの有効化

リポジトリのルートディレクトリで以下のコマンドを実行して、pre-commitフックをインストールします：

```bash
pre-commit install
```

これにより、`.git/hooks/pre-commit`が作成され、コミット前に自動的にGitleaksが実行されるようになります。

## 使用方法

セットアップが完了すると、`git commit`コマンドを実行する前に自動的にGitleaksが実行され、シークレットが検出された場合はコミットがブロックされます。

```bash
git commit -m "メッセージ"
```

もし正当な理由でGitleaksのチェックをスキップする必要がある場合は、以下のコマンドを使用できます：

```bash
SKIP=gitleaks git commit -m "メッセージ"
```

## カスタム設定

SOL-bot用のカスタムGitleaks設定は、リポジトリルートの`.gitleaks.toml`ファイルで定義されています。この設定ファイルには以下が含まれています：

- Binance、Coinbase、Krakenなどの暗号通貨取引所のAPIキーとシークレット検出ルール
- 暗号通貨ウォレットのシードフレーズと秘密鍵の検出ルール
- AWS認証情報の検出ルール
- ソラナ固有の秘密鍵検出ルール
- テストファイルやサンプルコードの除外設定

## トラブルシューティング

### pre-commitフックが動作しない場合

1. pre-commitが正しくインストールされているか確認します：
   ```bash
   pre-commit --version
   ```

2. pre-commitフックが正しくインストールされているか確認します：
   ```bash
   ls -la .git/hooks/pre-commit
   ```

3. 必要に応じてフックを再インストールします：
   ```bash
   pre-commit install --force
   ```

### 誤検出（False Positives）が多い場合

`.gitleaks.toml`ファイルを編集して、特定のパターンをallowlistsに追加するか、エントロピーの閾値を調整することで、誤検出を減らすことができます。

## 参考情報

- [Gitleaks公式ドキュメント](https://github.com/gitleaks/gitleaks)
- [pre-commit公式ドキュメント](https://pre-commit.com/) 