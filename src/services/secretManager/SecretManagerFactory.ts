/**
 * シークレットマネージャーのファクトリークラス
 *
 * 環境に応じた適切なシークレットマネージャー実装を提供します。
 */

// @ts-nocheck
const FileSecretManager = require('./FileSecretManager');
const EnvSecretManager = require('./EnvSecretManager');
const AWSParameterStoreManager = require('./AWSParameterStoreManager');
const GCPSecretManager = require('./GCPSecretManager');
const logger = require('../../utils/logger');

/**
 * シークレットマネージャーの種類
 * @type {Object}
 */
const SecretManagerType = {
  /**
   * ファイルベースのシークレットマネージャー（開発環境用）
   */
  FILE: 'file',

  /**
   * 環境変数ベースのシークレットマネージャー
   */
  ENV: 'env',

  /**
   * AWS Parameter Storeを使用したシークレットマネージャー
   */
  AWS_PARAMETER_STORE: 'aws-parameter-store',

  /**
   * GCP Secret Managerを使用したシークレットマネージャー
   */
  GCP_SECRET_MANAGER: 'gcp-secret-manager'
};

/**
 * @typedef {Object} SecretManagerOptions
 * @property {string} [type] - シークレットマネージャーの種類
 * @property {string} [filePath] - ファイルシークレットマネージャーのファイルパス
 * @property {string} [envPrefix] - 環境変数シークレットマネージャーのプレフィックス
 * @property {Object} [awsConfig] - AWS Parameter Store設定
 * @property {Object} [gcpConfig] - GCP Secret Manager設定
 */

/**
 * @typedef {Object} SecretManagerConfig
 * @property {string} [type] - シークレットマネージャーの種類
 * @property {string} [filePath] - ファイルパス
 * @property {string} [envPrefix] - 環境変数プレフィックス
 * @property {Object} [aws] - AWS設定
 * @property {string} [aws.region] - AWSリージョン
 * @property {string} [aws.profile] - AWSプロファイル
 * @property {Object} [gcp] - GCP設定
 * @property {string} [gcp.projectId] - GCPプロジェクトID
 * @property {any} [gcp.credentials] - GCP認証情報
 */

/**
 * シークレットマネージャーファクトリークラス
 */
class SecretManagerFactory {
  /**
   * 環境変数から適切なシークレットマネージャータイプを判定
   * @returns {string} シークレットマネージャータイプ
   */
  static determineManagerType() {
    // 環境変数でタイプが指定されている場合はそれを使用
    const envType = process.env.SECRET_MANAGER_TYPE?.toLowerCase();
    if (envType) {
      switch (envType) {
        case 'file':
          return SecretManagerType.FILE;
        case 'env':
          return SecretManagerType.ENV;
        case 'aws':
        case 'aws-parameter-store':
          return SecretManagerType.AWS_PARAMETER_STORE;
        case 'gcp':
        case 'gcp-secret-manager':
          return SecretManagerType.GCP_SECRET_MANAGER;
      }
    }

    // AWSのCredentials環境変数が設定されている場合
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      return SecretManagerType.AWS_PARAMETER_STORE;
    }

    // GCPのCredentials環境変数が設定されている場合
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_PROJECT_ID) {
      return SecretManagerType.GCP_SECRET_MANAGER;
    }

    // それ以外の場合はデフォルトで環境変数を使用
    return SecretManagerType.ENV;
  }

  /**
   * シークレットマネージャーのインスタンスを取得
   * @param {SecretManagerOptions} [options={}] - シークレットマネージャー設定オプション
   * @returns {Object} シークレットマネージャーインスタンス
   */
  static getSecretManager(options = {}) {
    // すでにインスタンスが作成されていれば再利用
    if (SecretManagerFactory.instance) {
      return SecretManagerFactory.instance;
    }

    // オプションでタイプが指定されていない場合は自動判定
    const type = options.type || this.determineManagerType();

    logger.info(`シークレットマネージャーを初期化します: タイプ=${type}`);

    // タイプに応じたシークレットマネージャーを作成
    switch (type) {
      case SecretManagerType.FILE:
        SecretManagerFactory.instance = new FileSecretManager.FileSecretManager(options.filePath);
        break;

      case SecretManagerType.ENV:
        SecretManagerFactory.instance = new EnvSecretManager.EnvSecretManager({ prefix: options.envPrefix });
        break;

      case SecretManagerType.AWS_PARAMETER_STORE:
        SecretManagerFactory.instance = new AWSParameterStoreManager.AWSParameterStoreManager(options.awsConfig);
        break;

      case SecretManagerType.GCP_SECRET_MANAGER:
        SecretManagerFactory.instance = new GCPSecretManager.GCPSecretManager(options.gcpConfig);
        break;

      default:
        logger.warn(
          `未知のシークレットマネージャータイプ: ${type}、環境変数マネージャーを使用します`
        );
        SecretManagerFactory.instance = new EnvSecretManager.EnvSecretManager();
    }

    return SecretManagerFactory.instance;
  }

  /**
   * シークレットマネージャーのインスタンスをリセット（主にテスト用）
   */
  static resetInstance() {
    SecretManagerFactory.instance = undefined;
  }
}

// 静的プロパティの初期化
SecretManagerFactory.instance = null;

/**
 * シークレットマネージャーのインスタンスを作成する関数
 * @param {SecretManagerConfig} [config] - シークレットマネージャーの設定
 * @returns {Object} シークレットマネージャーのインスタンス
 */
function createSecretManager(config) {
  const options = {};
  
  if (config) {
    // 種類の変換
    if (config.type) {
      switch (config.type.toLowerCase()) {
        case 'file':
          options.type = SecretManagerType.FILE;
          break;
        case 'env':
          options.type = SecretManagerType.ENV;
          break;
        case 'aws':
        case 'aws-parameter-store':
          options.type = SecretManagerType.AWS_PARAMETER_STORE;
          break;
        case 'gcp':
        case 'gcp-secret-manager':
          options.type = SecretManagerType.GCP_SECRET_MANAGER;
          break;
      }
    }
    
    // 各種設定
    options.filePath = config.filePath;
    options.envPrefix = config.envPrefix;
    
    if (config.aws) {
      options.awsConfig = {
        region: config.aws.region,
        profile: config.aws.profile
      };
    }
    
    if (config.gcp) {
      options.gcpConfig = {
        projectId: config.gcp.projectId,
        credentials: config.gcp.credentials
      };
    }
  }
  
  return SecretManagerFactory.getSecretManager(options);
}

/**
 * 利用可能なシークレットマネージャータイプを一覧する関数
 * @returns {string[]} 利用可能なシークレットマネージャーのタイプ一覧
 */
function listAvailableManagers() {
  return Object.values(SecretManagerType);
}

// CommonJS形式でエクスポート
module.exports = {
  SecretManagerType,
  SecretManagerFactory,
  createSecretManager,
  listAvailableManagers
};
