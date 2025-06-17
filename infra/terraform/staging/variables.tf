variable "instance_type" {
  description = "EC2インスタンスタイプ"
  type        = string
  default     = "t3.small"
}

variable "key_name" {
  description = "EC2インスタンスへのSSHアクセスに使用するキーペア名"
  type        = string
  default     = "solbot-stg-key"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
  default     = "vpc-0123456789abcdef0"  # 実際のVPC IDに置き換えてください
}

variable "subnet_id" {
  description = "サブネットID"
  type        = string
  default     = "subnet-0123456789abcdef0"  # 実際のサブネットIDに置き換えてください
}

variable "region" {
  description = "AWS リージョン"
  type        = string
  default     = "ap-northeast-1"  # 東京リージョン
}

variable "aws_account_id" {
  description = "AWS アカウントID"
  type        = string
  default     = "123456789012"  # 実際のAWSアカウントIDに置き換えてください
}

variable "environment" {
  description = "環境名"
  type        = string
  default     = "stg"
}

variable "app_name" {
  description = "アプリケーション名"
  type        = string
  default     = "solbot"
}

variable "log_bucket_name" {
  description = "ログバケット名"
  type        = string
  default     = "solbot-logs"
} 