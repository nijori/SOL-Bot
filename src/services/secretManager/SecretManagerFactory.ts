/**
 * シークレットマネージャーのファクトリークラス
 *
 * 環境に応じた適切なシークレットマネージャー実装を提供します。
 */

import { SecretManagerInterface } from "./SecretManagerInterface.js";
import { FileSecretManager } from "./FileSecretManager.js";
import { EnvSecretManager } from "./EnvSecretManager.js";
import { AWSParameterStoreManager, AWSParameterStoreConfig } from "./AWSParameterStoreManager.js";
import { GCPSecretManager, GCPSecretManagerConfig } from "./GCPSecretManager.js";
import logger from "../../utils/logger.js";

/**
 * シークレットマネージャーの種類
 */
export enum SecretManagerType {
  /**
   * ファイルベースのシークレットマネージャー（開発環境用）
   */
  FILE = 'file',

  /**
   * 環境変数ベースのシークレットマネージャー
   */
  ENV = 'env',

  /**
   * AWS Parameter Storeを使用したシークレットマネージャー
   */
  AWS_PARAMETER_STORE = 'aws-parameter-store',

  /**
   * GCP Secret Managerを使用したシークレットマネージャー
   */
  GCP_SECRET_MANAGER = 'gcp-secret-manager'
}

/**
 * シークレットマネージャー設定オプション
 */
export interface SecretManagerOptions {
  /**
   * シークレットマネージャーの種類
   */
  type?: SecretManagerType;

  /**
   * ファイルシークレットマネージャーのファイルパス
   */
  filePath?: string;

  /**
   * 環境変数シークレットマネージャーのプレフィックス
   */
  envPrefix?: string;

  /**
   * AWS Parameter Store設定
   */
  awsConfig?: AWSParameterStoreConfig;

  /**
   * GCP Secret Manager設定
   */
  gcpConfig?: GCPSecretManagerConfig;
}

/**
 * シークレットマネージャーファクトリークラス
 */
export class SecretManagerFactory {
  private static instance: SecretManagerInterface;

  /**
   * 環境変数から適切なシークレットマネージャータイプを判定
   * @returns シークレットマネージャータイプ
   */
  private static determineManagerType(): SecretManagerType {
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
   * @param options シークレットマネージャー設定オプション
   * @returns シークレットマネージャーインスタンス
   */
  public static getSecretManager(options: SecretManagerOptions = {}): SecretManagerInterface {
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
        SecretManagerFactory.instance = new FileSecretManager(options.filePath);
        break;

      case SecretManagerType.ENV:
        SecretManagerFactory.instance = new EnvSecretManager({ prefix: options.envPrefix });
        break;

      case SecretManagerType.AWS_PARAMETER_STORE:
        SecretManagerFactory.instance = new AWSParameterStoreManager(options.awsConfig);
        break;

      case SecretManagerType.GCP_SECRET_MANAGER:
        SecretManagerFactory.instance = new GCPSecretManager(options.gcpConfig);
        break;

      default:
        logger.warn(
          `未知のシークレットマネージャータイプ: ${type}、環境変数マネージャーを使用します`
        );
        SecretManagerFactory.instance = new EnvSecretManager();
    }

    return SecretManagerFactory.instance;
  }

  /**
   * シークレットマネージャーのインスタンスをリセット（主にテスト用）
   */
  public static resetInstance(): void {
    SecretManagerFactory.instance = undefined as unknown as SecretManagerInterface;
  }
}
