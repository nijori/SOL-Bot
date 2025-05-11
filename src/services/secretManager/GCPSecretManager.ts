/**
 * Google Cloud Platform Secret Managerを使用したシークレットマネージャー実装
 *
 * GCPのSecret Managerサービスを使用してシークレットを安全に管理します。
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { SecretManagerInterface } from './SecretManagerInterface.js';
import logger from '../../utils/logger.js';

/**
 * GCP Secret Manager設定オプション
 */
export interface GCPSecretManagerConfig {
  /**
   * GCPプロジェクトID
   */
  projectId?: string;

  /**
   * 認証情報
   */
  credentials?: any;

  /**
   * 認証情報ファイル名
   */
  keyFilename?: string;
}

export class GCPSecretManager implements SecretManagerInterface {
  private client: SecretManagerServiceClient;
  private readonly projectId: string;
  private readonly credentials: any;

  /**
   * コンストラクタ
   * @param config GCP Secret Manager設定
   */
  constructor(config: GCPSecretManagerConfig = {}) {
    this.projectId = config.projectId || process.env.GCP_PROJECT_ID || '';
    this.credentials = config.credentials;

    if (!this.projectId) {
      throw new Error(
        'GCP Project IDが指定されていません。config.projectIdまたは環境変数GCP_PROJECT_IDを設定してください。'
      );
    }

    // Secret Managerクライアントの初期化
    this.client = new SecretManagerServiceClient({
      keyFilename: config.keyFilename || process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    logger.info(`GCP Secret Manager接続初期化: projectId=${this.projectId}`);
  }

  /**
   * シークレット名のフルパスを生成
   * @param name シークレット名
   * @returns フルパスシークレット名
   */
  private getSecretName(name: string): string {
    return `projects/${this.projectId}/secrets/${name}`;
  }

  /**
   * シークレットバージョンのフルパスを生成
   * @param name シークレット名
   * @param version バージョン（デフォルト: 'latest'）
   * @returns フルパスバージョン名
   */
  private getSecretVersionName(name: string, version: string = 'latest'): string {
    return `${this.getSecretName(name)}/versions/${version}`;
  }

  /**
   * シークレット値を取得する
   * @param key シークレットのキー
   * @returns 取得した値、エラーまたは存在しない場合はnull
   */
  async getSecret(key: string): Promise<string | null> {
    try {
      const name = this.getSecretVersionName(key);
      const [version] = await this.client.accessSecretVersion({ name });

      if (version.payload && version.payload.data) {
        return version.payload.data.toString();
      }

      return null;
    } catch (error) {
      // シークレットが存在しない場合はnull
      if (error instanceof Error && error.message.includes('NOT_FOUND')) {
        logger.debug(`シークレットが存在しません: ${key}`);
        return null;
      }

      logger.error(
        `GCP Secret Manager取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * シークレット値を設定/更新する
   * @param key シークレットのキー
   * @param value 設定する値
   * @returns 成功したかどうか
   */
  async setSecret(key: string, value: string): Promise<boolean> {
    try {
      const secretName = this.getSecretName(key);

      // シークレットがまだ存在しない場合は作成
      try {
        await this.client.getSecret({ name: secretName });
      } catch (error) {
        if (error instanceof Error && error.message.includes('NOT_FOUND')) {
          // シークレットを作成
          await this.client.createSecret({
            parent: `projects/${this.projectId}`,
            secretId: key,
            secret: {
              replication: {
                automatic: {}
              }
            }
          });
        } else {
          throw error;
        }
      }

      // 新しいバージョンを追加
      await this.client.addSecretVersion({
        parent: secretName,
        payload: {
          data: Buffer.from(value, 'utf8')
        }
      });

      logger.debug(`シークレットを設定しました: ${key}`);
      return true;
    } catch (error) {
      logger.error(
        `GCP Secret Manager設定エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * シークレットを削除する
   * @param key シークレットのキー
   * @returns 成功したかどうか
   */
  async deleteSecret(key: string): Promise<boolean> {
    try {
      const name = this.getSecretName(key);
      await this.client.deleteSecret({ name });

      logger.debug(`シークレットを削除しました: ${key}`);
      return true;
    } catch (error) {
      // シークレットが存在しない場合も成功として扱う
      if (error instanceof Error && error.message.includes('NOT_FOUND')) {
        logger.debug(`削除対象のシークレットが存在しません: ${key}`);
        return true;
      }

      logger.error(
        `GCP Secret Manager削除エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * シークレットが存在するか確認
   * @param key シークレットのキー
   * @returns 存在する場合はtrue
   */
  async hasSecret(key: string): Promise<boolean> {
    try {
      const name = this.getSecretName(key);
      await this.client.getSecret({ name });
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('NOT_FOUND')) {
        return false;
      }

      logger.error(
        `GCP Secret Manager確認エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }
}
