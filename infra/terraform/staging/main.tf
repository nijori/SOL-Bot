provider "aws" {
  region = var.region
}

# 変数定義は variables.tf ファイルを参照

# Latest Amazon Linux 2 AMIを検索
data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# セキュリティグループの作成
resource "aws_security_group" "solbot_stg_sg" {
  name        = "${var.app_name}-${var.environment}-sg"
  description = "Security group for SOL-Bot staging environment"
  vpc_id      = var.vpc_id

  # SSH接続用
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # 本番環境では特定のIPに制限することを推奨
    description = "SSH access"
  }

  # HTTP接続用
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP access"
  }

  # HTTPS接続用
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS access"
  }

  # API用ポート
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "API endpoint"
  }

  # Prometheusエクスポーター用ポート
  ingress {
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Prometheus metrics"
  }

  # 全てのアウトバウンドトラフィックを許可
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = {
    Name = "${var.app_name}-${var.environment}-sg"
    Env  = var.environment
  }
}

# IAMロールの作成
resource "aws_iam_role" "solbot_stg_role" {
  name = "${var.app_name}-${var.environment}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.app_name}-${var.environment}-role"
    Env  = var.environment
  }
}

# S3アクセスポリシーの作成
resource "aws_iam_policy" "solbot_s3_policy" {
  name        = "${var.app_name}-${var.environment}-s3-policy"
  description = "SOL-Bot ステージング環境のS3アクセスポリシー"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Effect = "Allow"
        Resource = [
          "arn:aws:s3:::${var.log_bucket_name}",
          "arn:aws:s3:::${var.log_bucket_name}/*"
        ]
      }
    ]
  })
}

# SSMパラメータストアアクセスポリシーの作成
resource "aws_iam_policy" "solbot_ssm_policy" {
  name        = "${var.app_name}-${var.environment}-ssm-policy"
  description = "SOL-Bot ステージング環境のSSMパラメータストアアクセスポリシー"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]
        Effect = "Allow"
        Resource = "arn:aws:ssm:${var.region}:${var.aws_account_id}:parameter/${var.app_name}/${var.environment}/*"
      }
    ]
  })
}

# IAMロールにポリシーをアタッチ
resource "aws_iam_role_policy_attachment" "solbot_s3_attachment" {
  role       = aws_iam_role.solbot_stg_role.name
  policy_arn = aws_iam_policy.solbot_s3_policy.arn
}

resource "aws_iam_role_policy_attachment" "solbot_ssm_attachment" {
  role       = aws_iam_role.solbot_stg_role.name
  policy_arn = aws_iam_policy.solbot_ssm_policy.arn
}

# インスタンスプロファイルの作成
resource "aws_iam_instance_profile" "solbot_stg_profile" {
  name = "${var.app_name}-${var.environment}-profile"
  role = aws_iam_role.solbot_stg_role.name
}

# EC2インスタンスの作成
resource "aws_instance" "solbot_stg" {
  ami                    = data.aws_ami.amazon_linux_2.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.solbot_stg_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.solbot_stg_profile.name

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    delete_on_termination = true
  }

  user_data = <<-EOF
    #!/bin/bash
    # システムアップデート
    yum update -y
    
    # Dockerのインストール
    amazon-linux-extras install docker -y
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ec2-user
    
    # Docker Composeのインストール
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Node.jsのインストール
    curl -sL https://rpm.nodesource.com/setup_18.x | bash -
    yum install -y nodejs
    
    # アプリケーションディレクトリの作成
    mkdir -p /opt/${var.app_name}/{current,releases,backups,logs,data}
    chown -R ec2-user:ec2-user /opt/${var.app_name}
    
    # 環境変数設定
    cat > /etc/profile.d/${var.app_name}-env.sh << 'ENVEOF'
    export NODE_ENV=production
    export TZ=UTC
    ENVEOF
    chmod +x /etc/profile.d/${var.app_name}-env.sh
    
    # タイムゾーン設定
    timedatectl set-timezone UTC

    # インスタンスにタグを追加
    INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
    REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
    aws ec2 create-tags --resources $INSTANCE_ID --tags Key=Env,Value=${var.environment} --region $REGION
  EOF

  tags = {
    Name = "${var.app_name}-${var.environment}"
    Env  = var.environment
  }
}

# Elastic IPの作成と割り当て
resource "aws_eip" "solbot_stg_eip" {
  instance = aws_instance.solbot_stg.id
  domain   = "vpc"

  tags = {
    Name = "${var.app_name}-${var.environment}-eip"
    Env  = var.environment
  }
} 