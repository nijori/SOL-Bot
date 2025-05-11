/**
 * Secret Manager Module
 * 
 * シークレット管理のための中央モジュール
 * 環境に応じた適切なSecretManagerの実装を提供
 */

// 削除: 存在しないファイルへの参照を外します
// 他のマネージャーは実態のあるファイルからインポート
export { FileSecretManager } from './FileSecretManager.js';
export { EnvSecretManager }  from './EnvSecretManager.js';
export { AWSParameterStoreManager } from './AWSParameterStoreManager.js';
export { GCPSecretManager }      from './GCPSecretManager.js';
// SecretManagerFactory のエクスポートを整理
export { createSecretManager, listAvailableManagers } from './SecretManagerFactory.js';

// 型の再エクスポートはexport typeで統一
export type { AWSParameterStoreConfig } from './AWSParameterStoreManager.js';
export type { GCPSecretManagerConfig } from './GCPSecretManager.js';
export type { SecretManagerConfig } from './SecretManagerFactory.js';
export type { SecretManagerInterface } from './SecretManagerInterface.js';
