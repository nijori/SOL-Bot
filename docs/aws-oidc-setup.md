# AWS OIDC設定情報

## SEC-007で作成されたリソース

### IAM Role
- **Role Name**: `solbot-ci`
- **Role ARN**: `arn:aws:iam::475538532274:role/solbot-ci`
- **Purpose**: GitHub ActionsからAWSリソースへのアクセス

### OIDC Identity Provider
- **Provider URL**: `https://token.actions.githubusercontent.com`
- **Provider ARN**: `arn:aws:iam::475538532274:oidc-provider/token.actions.githubusercontent.com`
- **Audience**: `sts.amazonaws.com`

### 許可されたリポジトリ
- **Repository**: `nijor/SOL_bot`
- **Branch**: `*` (全ブランチ)

### 付与された権限
1. **EC2操作**:
   - StartInstances, StopInstances, RebootInstances
   - DescribeInstances, DescribeInstanceStatus
   - 条件: `ec2:ResourceTag/Project = "solbot"`

2. **SSM Parameter Store**:
   - GetParameter, GetParameters, GetParametersByPath
   - リソース: `/solbot/*` パス配下

3. **ECR**:
   - GetAuthorizationToken, BatchCheckLayerAvailability
   - GetDownloadUrlForLayer, BatchGetImage

4. **S3**:
   - GetObject, PutObject
   - リソース: `solbot-*` バケット配下

## GitHub Actionsでの使用方法

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::475538532274:role/solbot-ci
          aws-region: ap-northeast-1
```

## 作成日
- **作成日**: 2025-06-09
- **作成者**: @assistant
- **関連タスク**: SEC-007 