/**
 * AWS Parameter Storeを使用したシークレットマネージャー実装
 *
 * AWSのSSMパラメータストアを使用してシークレットを安全に管理します。
 */

import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
  DeleteParameterCommand,
  GetParameterCommandOutput,
  ParameterNotFound
} from '@aws-sdk/client-ssm';
import { fromIni } from '@aws-sdk/credential-providers';
import { SecretManagerInterface } from './SecretManagerInterface.js';
import logger from '../../utils/logger.js';

export interface AWSParameterStoreConfig {
  region?: string;
  profile?: string;
  pathPrefix?: string;
  withDecryption?: boolean;
}

export class AWSParameterStoreManager implements SecretManagerInterface {
  private ssmClient: SSMClient;
  private readonly pathPrefix: string;
  private readonly withDecryption: boolean;

  /**
   * コンストラクタ
   * @param config AWS Parameter Store設定
   */
  constructor(config: AWSParameterStoreConfig = {}) {
    // デフォルト値の設定
    const region = config.region || process.env.AWS_REGION || 'us-east-1';
    this.pathPrefix = config.pathPrefix || '/sol-bot/';
    this.withDecryption = config.withDecryption !== undefined ? config.withDecryption : true;

    // SSMClientの初期化
    const clientConfig: any = { region };
    
    // プロファイルが指定されている場合は認証情報を設定
    if (config.profile) {
      clientConfig.credentials = fromIni({ profile: config.profile });
    }
    
    this.ssmClient = new SSMClient(clientConfig);

    logger.info(`AWS Parameter Store接続初期化: region=${region}, pathPrefix=${this.pathPrefix}`);
  }

  /**
   * キーからSSMパラメータ名を生成
   * @param key キー名
   * @returns SSMパラメータ名
   */
  private getParameterName(key: string): string {
    // キーが既にスラッシュで始まっている場合は、重複を避ける
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    return `${this.pathPrefix}${cleanKey}`;
  }

  /**
   * シークレット値を取得する
   * @param key シークレットのキー
   * @returns 取得した値、エラーまたは存在しない場合はnull
   */
  async getSecret(key: string): Promise<string | null> {
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
   * @param key シークレットのキー
   * @param value 設定する値
   * @param type パラメータタイプ（String, StringList, またはSecureString）
   * @returns 成功したかどうか
   */
  async setSecret(
    key: string,
    value: string,
    type: 'String' | 'StringList' | 'SecureString' = 'SecureString'
  ): Promise<boolean> {
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
   * @param key シークレットのキー
   * @returns 成功したかどうか
   */
  async deleteSecret(key: string): Promise<boolean> {
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
   * @param key シークレットのキー
   * @returns 存在する場合はtrue
   */
  async hasSecret(key: string): Promise<boolean> {
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
