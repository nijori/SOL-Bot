# WSL環境での開発セットアップガイド（Claude Code対応）

## 📋 概要

SOL-BotプロジェクトをWSL（Windows Subsystem for Linux）環境で開発し、**Claude Code**（Anthropicの新しいAIコーディングアシスタント）を使用するためのセットアップガイドです。

**重要**: Claude CodeはWindows環境では直接動作せず、WSL環境が必須です。

## 🎯 Claude Codeとは

Claude Codeは2025年にAnthropicがリリースした革新的なAIコーディングアシスタントです：

### 主な特徴
- **ターミナル統合**: コマンドラインで直接動作
- **コードベース理解**: プロジェクト全体を理解して支援
- **自然言語コマンド**: 日本語で指示を出せる
- **実際のアクション**: ファイル編集、Git操作、テスト実行など
- **エージェント機能**: 自律的にタスクを実行

### できること
- コードの説明と理解支援
- バグ修正とリファクタリング
- テストコード生成
- Git操作（コミット、PR作成など）
- ドキュメント生成

## 🔄 可逆性の保証

**WSL環境セットアップは100%可逆的です。一方通行になる作業は一切ありません。**

### 共有されるもの（変更されない）
- **プロジェクトファイル**: ソースコード、設定ファイル
- **Git履歴**: コミット履歴、ブランチ情報
- **環境設定**: `.env`, `tsconfig.json`, `package.json`

### 環境固有のもの（変更される）
- **`node_modules`**: プラットフォーム固有のバイナリ
- **`package-lock.json`**: 依存関係のロック情報
- **実行環境**: Node.js、npm、Claude Code

## 🛡️ 安全対策

### Phase 1: バックアップ作成
```powershell
# PowerShell環境で実行
cd C:\Users\nijor\Dev\SOL_bot

# 現在の状態をバックアップ
Copy-Item package-lock.json package-lock.json.windows-backup -ErrorAction SilentlyContinue
Copy-Item .env .env.windows-backup -ErrorAction SilentlyContinue

# Git状態確認
git status
```

## 🚀 WSL環境セットアップ手順

### Step 1: WSLインストール（管理者権限で実行）

```powershell
# PowerShellを管理者として実行
# Windows + X → "Windows Terminal (Admin)"

# WSLインストール
wsl --install

# 再起動が必要な場合は再起動
# 再起動後、自動的にUbuntuのセットアップが開始されます
```

**トラブルシューティング:**
- エラー0x80370102: BIOSで仮想化を有効にする
- エラー0x80004005: Windowsを再起動して再試行
- WSLが認識されない: Windows 10 version 2004以上が必要

### Step 2: Ubuntu初期設定

```bash
# Ubuntuが起動したら、ユーザー名とパスワードを設定
# ユーザー名: 小文字、スペースなし
# パスワード: 入力時は表示されません（正常です）

# システム更新
sudo apt update && sudo apt upgrade -y

# 必要なツールをインストール
sudo apt install curl git build-essential -y
```

### Step 3: Node.js環境構築（NVM使用）

```bash
# NVMインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 設定を反映（新しいターミナルを開くか以下を実行）
source ~/.bashrc

# nvmが使用可能か確認
nvm --version

# Node.js 18 LTSをインストール
nvm install 18
nvm use 18
nvm alias default 18

# インストール確認
node --version  # v18.x.x
npm --version   # 9.x.x以上
```

### Step 4: Claude Codeインストール

```bash
# npmのグローバルディレクトリ設定（権限問題回避）
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Claude Codeインストール
npm install -g @anthropic-ai/claude-code

# インストール確認
which claude
claude --version
```

### Step 5: Claude Code認証設定

```bash
# Anthropicアカウントでの認証
claude

# 初回実行時：
# 1. ブラウザが開いてAnthropic Consoleに移動
# 2. ログインして認証コードを取得
# 3. ターミナルに認証コードを入力
# 4. プロジェクトファイルへのアクセスを許可
```

**事前準備:**
1. [console.anthropic.com](https://console.anthropic.com)でアカウント作成
2. 請求設定で最低$5のクレジット追加
3. API使用量は従量課金（通常$0.10-$2.00/セッション）

### Step 6: プロジェクト環境セットアップ

```bash
# プロジェクトディレクトリに移動
cd /mnt/c/Users/nijor/Dev/SOL_bot

# 既存のnode_modulesを削除（WSL用に再構築）
rm -rf node_modules package-lock.json

# WSL環境用に依存関係をインストール
npm install

# 動作確認
npm run test
npm run build
```

## 🎮 Claude Code使用方法

### 基本的な使い方

```bash
# プロジェクトディレクトリでClaude Codeを起動
cd /mnt/c/Users/nijor/Dev/SOL_bot
claude

# 基本コマンド
/help     # ヘルプ表示
/cost     # 使用料金確認
/exit     # 終了
/undo     # 最後の変更を取り消し
```

### 実用的な例

```bash
# コードの説明を求める
> このプロジェクトの認証システムはどのように動作していますか？

# バグ修正を依頼
> src/core/tradingEngine.tsのメモリリークを修正してください

# テストコード生成
> OrderSizingServiceのユニットテストを作成してください

# Git操作
> 変更をコミットしてください
> PRを作成してください

# リファクタリング
> このコードをTypeScriptの最新のベストプラクティスに従って改善してください
```

## 🔙 PowerShell環境への復帰方法

### 即座に復帰する場合

```powershell
# PowerShell環境で実行
cd C:\Users\nijor\Dev\SOL_bot

# WSL用のnode_modulesを削除
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue

# Windows用に再インストール
npm install

# バックアップから復元（必要に応じて）
Copy-Item package-lock.json.windows-backup package-lock.json -ErrorAction SilentlyContinue
Copy-Item .env.windows-backup .env -ErrorAction SilentlyContinue

# 動作確認
npm run test
```

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. "Claude Code is not supported on Windows"
```bash
# 原因: Windows環境でClaude Codeを実行しようとしている
# 解決: WSL環境で実行していることを確認
uname -a  # Linuxと表示されるはず

# WSLに入り直す
wsl
```

#### 2. "npm: command not found"
```bash
# 原因: Node.js/npmがWSL内にインストールされていない
# 解決: NVMでNode.jsを再インストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 18
```

#### 3. 権限エラー
```bash
# 原因: sudoでnpmインストールを実行した
# 解決: npmグローバルディレクトリを再設定
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### 4. パフォーマンス問題
```bash
# 原因: /mnt/c/でのファイルアクセスが遅い
# 解決: Linuxファイルシステムにプロジェクトをコピー
cp -r /mnt/c/Users/nijor/Dev/SOL_bot ~/SOL_bot
cd ~/SOL_bot

# Windowsからアクセスする場合
# エクスプローラーで \\wsl$\Ubuntu\home\username\SOL_bot
```

## 💡 パフォーマンス最適化

### WSL設定最適化

```ini
# C:\Users\nijor\.wslconfig ファイルを作成
[wsl2]
memory=8GB
processors=4
swap=2GB
```

### 開発効率向上のTips

```bash
# エイリアス設定
echo 'alias claude-project="cd /mnt/c/Users/nijor/Dev/SOL_bot && claude"' >> ~/.bashrc
echo 'alias sol-bot="cd /mnt/c/Users/nijor/Dev/SOL_bot"' >> ~/.bashrc
source ~/.bashrc

# 使用例
claude-project  # プロジェクトディレクトリでClaude Code起動
sol-bot         # プロジェクトディレクトリに移動
```

## 📊 Claude Code料金目安

| 使用パターン | 月額目安 | 説明 |
|-------------|---------|------|
| 軽い使用 | $5-15 | 週数回、簡単な質問やコード説明 |
| 通常使用 | $15-50 | 日常的な開発支援、リファクタリング |
| 重い使用 | $50-150 | 大規模なコード生成、複雑なタスク |

## 🎯 次のステップ

1. **WSL環境セットアップ完了**
2. **Claude Codeでの開発体験**
3. **必要に応じてPowerShell環境に復帰**
4. **最適な開発環境の選択**

---

**作成日**: 2025-01-10  
**最終更新**: 2025-01-10  
**対象**: Claude Code + WSL環境での開発 