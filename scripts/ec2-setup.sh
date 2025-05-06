#!/bin/bash

# SOL-Bot EC2インスタンス初期セットアップスクリプト
# 本番環境の構築を自動化します

set -e  # エラーが発生したら停止

echo "======== SOL-Bot EC2セットアップスクリプト開始 ========"

# システムアップデート
echo "システムアップデートを実行しています..."
sudo apt-get update
sudo apt-get upgrade -y

# 基本ツールのインストール
echo "基本ツールをインストールしています..."
sudo apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  htop \
  vim \
  tmux \
  unzip

# Dockerのインストール
echo "Dockerをインストールしています..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
  echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io
  sudo systemctl enable docker
  sudo systemctl start docker
  
  # 現在のユーザーをdockerグループに追加
  sudo usermod -aG docker $USER
  echo "Dockerがインストールされました。ユーザーがdockerグループに追加されました。反映には再ログインが必要です。"
else
  echo "Dockerは既にインストールされています。"
fi

# Docker Composeのインストール
echo "Docker Composeをインストールしています..."
if ! command -v docker-compose &> /dev/null; then
  COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
  sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  echo "Docker Composeがインストールされました: $(docker-compose --version)"
else
  echo "Docker Composeは既にインストールされています: $(docker-compose --version)"
fi

# Node.jsのインストール
echo "Node.jsをインストールしています..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
  echo "Node.jsがインストールされました: $(node -v)"
  echo "NPMがインストールされました: $(npm -v)"
else
  echo "Node.jsは既にインストールされています: $(node -v)"
fi

# アプリケーションディレクトリの作成
echo "アプリケーションディレクトリを作成しています..."
sudo mkdir -p /opt/solbot/{current,releases,backups,logs,data}
sudo chown -R $USER:$USER /opt/solbot

# 環境変数設定用のシステム全体の設定ファイル
echo "環境変数設定ファイルを作成しています..."
sudo bash -c 'cat > /etc/profile.d/solbot-env.sh' << 'EOF'
export NODE_ENV=production
export TZ=UTC
EOF
sudo chmod +x /etc/profile.d/solbot-env.sh

# crontabの設定
echo "crontabを設定しています..."
mkdir -p ~/.ssh
touch ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# sudoなしでのDockerソケットアクセス許可（CI/CD用）
echo "Dockerソケットへのアクセスを設定しています..."
sudo bash -c 'cat > /etc/docker/daemon.json' << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
EOF
sudo systemctl restart docker

# ファイアウォール設定
echo "ファイアウォールを設定しています..."
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # APIポート
sudo ufw --force enable

echo "======== SOL-Bot EC2セットアップスクリプト完了 ========"
echo "システムを再起動することを推奨します。" 