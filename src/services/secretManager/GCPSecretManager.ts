/**
 * Google Cloud Platform Secret Managerを使用したシークレットマネージャー実装
 *
 * GCPのSecret Managerサービスを使用してシークレットを安全に管理します。
 */

// @ts-nocheck
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const logger = require('../../utils/logger');

/**
 * GCP Secret Manager設定オプション
 * @typedef {Object} GCPSecretManagerConfig
 * @property {string} [projectId] - GCPプロジェクトID
 * @property {any} [credentials] - 認証情報
 * @property {string} [keyFilename] - 認証情報ファイル名
 */

/**
 * GCP Secret Managerクラス
 */
class GCPSecretManager {
  /**
   * コンストラクタ
   * @param {GCPSecretManagerConfig} [config={}] - GCP Secret Manager設定
   */
  constructor(config = {}) {
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
   * @param {string} name - シークレット名
   * @returns {string} フルパスシークレット名
   */
  getSecretName(name) {
    return `projects/${this.projectId}/secrets/${name}`;
  }

  /**
   * シークレットバージョンのフルパスを生成
   * @param {string} name - シークレット名
   * @param {string} [version='latest'] - バージョン（デフォルト: 'latest'）
   * @returns {string} フルパスバージョン名
   */
  getSecretVersionName(name, version = 'latest') {
    return `${this.getSecretName(name)}/versions/${version}`;
  }

  /**
   * シークレット値を取得する
   * @param {string} key - シークレットのキー
   * @returns {Promise<string|null>} 取得した値、エラーまたは存在しない場合はnull
   */
  async getSecret(key) {
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
   * @param {string} key - シークレットのキー
   * @param {string} value - 設定する値
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setSecret(key, value) {
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
   * @param {string} key - シークレットのキー
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async deleteSecret(key) {
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
   * @param {string} key - シークレットのキー
   * @returns {Promise<boolean>} 存在する場合はtrue
   */
  async hasSecret(key) {
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

// CommonJS形式でエクスポート
module.exports = {
  GCPSecretManager
};
