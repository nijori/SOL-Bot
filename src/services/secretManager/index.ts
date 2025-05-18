/**
 * Secret Manager Module
 * 
 * シークレット管理のための中央モジュール
 * 環境に応じた適切なSecretManagerの実装を提供
 */

// @ts-nocheck
const FileSecretManager = require('./FileSecretManager');
const EnvSecretManager = require('./EnvSecretManager');
const AWSParameterStoreManager = require('./AWSParameterStoreManager');
const GCPSecretManager = require('./GCPSecretManager');
const SecretManagerFactory = require('./SecretManagerFactory');

// コモンJS形式でエクスポート
module.exports = {
  FileSecretManager: FileSecretManager.FileSecretManager,
  EnvSecretManager: EnvSecretManager.EnvSecretManager,
  AWSParameterStoreManager: AWSParameterStoreManager.AWSParameterStoreManager,
  GCPSecretManager: GCPSecretManager.GCPSecretManager,
  createSecretManager: SecretManagerFactory.createSecretManager,
  listAvailableManagers: SecretManagerFactory.listAvailableManagers
};

// 型の再エクスポートはexport typeで統一
export type { AWSParameterStoreConfig } from './AWSParameterStoreManager.js';
export type { GCPSecretManagerConfig } from './GCPSecretManager.js';
export type { SecretManagerConfig } from './SecretManagerFactory.js';
export type { SecretManagerInterface } from './SecretManagerInterface.js';
