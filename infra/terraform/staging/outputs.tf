output "instance_id" {
  description = "EC2インスタンスID"
  value       = aws_instance.solbot_stg.id
}

output "public_ip" {
  description = "EC2インスタンスのパブリックIP"
  value       = aws_eip.solbot_stg_eip.public_ip
}

output "public_dns" {
  description = "EC2インスタンスのパブリックDNS"
  value       = aws_instance.solbot_stg.public_dns
}

output "security_group_id" {
  description = "セキュリティグループID"
  value       = aws_security_group.solbot_stg_sg.id
}

output "iam_role_arn" {
  description = "IAMロールARN"
  value       = aws_iam_role.solbot_stg_role.arn
}

output "instance_profile_name" {
  description = "インスタンスプロファイル名"
  value       = aws_iam_instance_profile.solbot_stg_profile.name
} 