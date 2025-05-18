/**
 * AWS Parameter Storeを使用したシークレットマネージャー実装
 *
 * AWSのSSMパラメータストアを使用してシークレットを安全に管理します。
 */

// @ts-nocheck
const {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
  DeleteParameterCommand,
  ParameterNotFound
} = require('@aws-sdk/client-ssm');
const { fromIni } = require('@aws-sdk/credential-providers');
const logger = require('../../utils/logger');

/**
 * @typedef {Object} AWSParameterStoreConfig
 * @property {string} [region] - AWSリージョン
 * @property {string} [profile] - AWS認証情報プロファイル
 * @property {string} [pathPrefix] - パラメータパスのプレフィックス
 * @property {boolean} [withDecryption] - 復号化フラグ
 */

/**
 * AWS Parameter Storeを使用したシークレットマネージャークラス
 */
class AWSParameterStoreManager {
  /**
   * コンストラクタ
   * @param {AWSParameterStoreConfig} [config={}] - AWS Parameter Store設定
   */
  constructor(config = {}) {
    // デフォルト値の設定
    const region = config.region || process.env.AWS_REGION || 'us-east-1';
    this.pathPrefix = config.pathPrefix || '/sol-bot/';
    this.withDecryption = config.withDecryption !== undefined ? config.withDecryption : true;

    // SSMClientの初期化
    const clientConfig = { region };
    
    // プロファイルが指定されている場合は認証情報を設定
    if (config.profile) {
      clientConfig.credentials = fromIni({ profile: config.profile });
    }
    
    this.ssmClient = new SSMClient(clientConfig);

    logger.info(`AWS Parameter Store接続初期化: region=${region}, pathPrefix=${this.pathPrefix}`);
  }

  /**
   * キーからSSMパラメータ名を生成
   * @param {string} key - キー名
   * @returns {string} SSMパラメータ名
   */
  getParameterName(key) {
    // キーが既にスラッシュで始まっている場合は、重複を避ける
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    return `${this.pathPrefix}${cleanKey}`;
  }

  /**
   * シークレット値を取得する
   * @param {string} key - シークレットのキー
   * @returns {Promise<string|null>} 取得した値、エラーまたは存在しない場合はnull
   */
  async getSecret(key) {
    try {
      const paramName = this.getParameterName(key);
      const command = new GetParameterCommand({
        Name: paramName,
        WithDecryption: this.withDecryption
      });

      const response = await this.ssmClient.send(command);
      return response.Parameter?.Value || null;
    } catch (error) {
      // パラメータが存在しない場合はnull
      if (error instanceof ParameterNotFound) {
        logger.debug(`パラメータが存在しません: ${key}`);
        return null;
      }

      logger.error(
        `AWS Parameter Store取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * シークレット値を設定/更新する
   * @param {string} key - シークレットのキー
   * @param {string} value - 設定する値
   * @param {string} [type='SecureString'] - パラメータタイプ（String, StringList, またはSecureString）
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setSecret(
    key,
    value,
    type = 'SecureString'
  ) {
    try {
      const paramName = this.getParameterName(key);
      const command = new PutParameterCommand({
        Name: paramName,
        Value: value,
        Type: type,
        Overwrite: true
      });

      await this.ssmClient.send(command);
      logger.debug(`パラメータを設定しました: ${key}`);
      return true;
    } catch (error) {
      logger.error(
        `AWS Parameter Store設定エラー: ${error instanceof Error ? error.message : String(error)}`
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
      const paramName = this.getParameterName(key);
      const command = new DeleteParameterCommand({
        Name: paramName
      });

      await this.ssmClient.send(command);
      logger.debug(`パラメータを削除しました: ${key}`);
      return true;
    } catch (error) {
      // パラメータが存在しない場合も成功として扱う
      if (error instanceof ParameterNotFound) {
        logger.debug(`削除対象のパラメータが存在しません: ${key}`);
        return true;
      }

      logger.error(
        `AWS Parameter Store削除エラー: ${error instanceof Error ? error.message : String(error)}`
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
      const paramName = this.getParameterName(key);
      const command = new GetParameterCommand({
        Name: paramName,
        WithDecryption: false // 値は不要なのでfalse
      });

      await this.ssmClient.send(command);
      return true;
    } catch (error) {
      if (error instanceof ParameterNotFound) {
        return false;
      }

      logger.error(
        `AWS Parameter Store確認エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }
}

// CommonJS形式でエクスポート
module.exports = {
  AWSParameterStoreManager
};
