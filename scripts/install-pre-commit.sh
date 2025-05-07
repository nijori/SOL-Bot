#!/bin/bash

# SOL-bot pre-commitセットアップスクリプト
# pre-commitとgitleaksフックをインストールします

set -e  # エラーが発生したら停止

echo "======== SOL-bot pre-commitセットアップスクリプト開始 ========"

# Python3が存在するか確認
if ! command -v python3 &> /dev/null; then
    echo "Python3がインストールされていません。インストールしてから再試行してください。"
    exit 1
fi

# pipが存在するか確認
if ! command -v pip3 &> /dev/null && ! command -v pip &> /dev/null; then
    echo "pipがインストールされていません。インストールしてから再試行してください。"
    exit 1
fi

# pre-commitのインストール
echo "pre-commitをインストールしています..."
if command -v pip3 &> /dev/null; then
    pip3 install pre-commit
else
    pip install pre-commit
fi

# 現在のディレクトリがgitリポジトリのルートディレクトリか確認
if [ ! -d ".git" ]; then
    echo "カレントディレクトリがgitリポジトリのルートディレクトリではありません。"
    echo "リポジトリのルートディレクトリに移動してから再試行してください。"
    exit 1
fi

# pre-commitフックの設定
echo "pre-commitフックを設定しています..."
pre-commit install

# 設定ファイルの存在確認
if [ ! -f ".pre-commit-config.yaml" ]; then
    echo "警告: .pre-commit-config.yamlファイルが見つかりません。"
    echo "このスクリプトを適切に実行するには、リポジトリのルートに.pre-commit-config.yamlファイルが必要です。"
    exit 1
fi

if [ ! -f ".gitleaks.toml" ]; then
    echo "警告: .gitleaks.tomlファイルが見つかりません。"
    echo "このスクリプトを適切に実行するには、リポジトリのルートに.gitleaks.tomlファイルが必要です。"
    exit 1
fi

echo "テストコミットで検証しています..."
echo "これは正当なコミットです" > .pre-commit-test
git add .pre-commit-test

# テストコミットをシミュレート
pre-commit run --all-files
if [ $? -eq 0 ]; then
    echo "pre-commitフックが正常に動作しています。"
else
    echo "pre-commitフックのテスト中にエラーが発生しました。問題を解決してから再試行してください。"
fi

# テストファイルを削除
git reset .pre-commit-test
rm -f .pre-commit-test

echo "======== SOL-bot pre-commitセットアップスクリプト完了 ========"
echo "pre-commitとgitleaksフックが正常にインストールされました。"
echo "今後、git commitを実行するたびに、シークレットがないかをチェックします。" 