/**
 * シークレットマネージャーモジュール
 *
 * API Key、秘密鍵などの機密情報を安全に管理するためのインターフェースを提供します。
 * 複数のバックエンド（ファイル、環境変数、AWS Parameter Store、GCP Secret Manager）に対応しています。
 */

/**
 * シークレットマネージャーの集約インターフェース
 * シークレットの取得・保存方法を抽象化
 * 
 * SEC-001: シークレット管理基盤
 */

// インターフェース
export { SecretManagerInterface } from './SecretManagerInterface.js';

// 実装クラス
export { FileSecretManager } from './FileSecretManager.js';
export { EnvSecretManager } from './EnvSecretManager.js';
export { AWSParameterStoreManager } from './AWSParameterStoreManager.js';
export type { AWSParameterStoreConfig } from './AWSParameterStoreManager.js';
export { GCPSecretManager } from './GCPSecretManager.js';
export type { GCPSecretManagerConfig } from './GCPSecretManager.js';

// ファクトリー
export { SecretManagerFactory } from './SecretManagerFactory.js';
export { SecretManagerType } from './SecretManagerFactory.js';
export type { SecretManagerOptions } from './SecretManagerFactory.js';

// ファクトリー関数をエクスポート
export {
  createSecretManager,
  listAvailableManagers,
  SecretManagerConfig
} from './SecretManagerFactory.js';

// デフォルトエクスポート - 簡単アクセス用のファクトリーインスタンス
import { SecretManagerFactory } from './SecretManagerFactory.js';

/**
 * デフォルトのシークレットマネージャーインスタンスを取得
 */
export const secretManager = SecretManagerFactory.getSecretManager();

// デフォルトエクスポート
export default secretManager;
