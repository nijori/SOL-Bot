/**
 * シークレットマネージャーモジュール
 * 
 * API Key、秘密鍵などの機密情報を安全に管理するためのインターフェースを提供します。
 * 複数のバックエンド（ファイル、環境変数、AWS Parameter Store、GCP Secret Manager）に対応しています。
 */

// インターフェース
export { SecretManagerInterface } from './SecretManagerInterface';

// 実装クラス
export { FileSecretManager } from './FileSecretManager';
export { EnvSecretManager } from './EnvSecretManager';
export { AWSParameterStoreManager, AWSParameterStoreConfig } from './AWSParameterStoreManager';
export { GCPSecretManager, GCPSecretManagerConfig } from './GCPSecretManager';

// ファクトリー
export { 
  SecretManagerFactory, 
  SecretManagerType,
  SecretManagerOptions
} from './SecretManagerFactory';

// デフォルトエクスポート - 簡単アクセス用のファクトリーインスタンス
import { SecretManagerFactory } from './SecretManagerFactory';

/**
 * デフォルトのシークレットマネージャーインスタンスを取得
 */
export const secretManager = SecretManagerFactory.getSecretManager();

// デフォルトエクスポート
export default secretManager; 