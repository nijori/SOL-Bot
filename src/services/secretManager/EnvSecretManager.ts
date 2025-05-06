/**
 * 環境変数を使用したシークレットマネージャー実装
 * 
 * プロセス環境変数から設定を取得する簡易的なシークレットマネージャーです。
 * ローカル開発やCIでの使用を想定しています。
 */

import { SecretManagerInterface } from './SecretManagerInterface';
import logger from '../../utils/logger';
import dotenv from 'dotenv';

// .envファイルを読み込む
dotenv.config();

export interface EnvSecretManagerConfig {
  prefix?: string;
}

export class EnvSecretManager implements SecretManagerInterface {
  private readonly prefix: string;
  
  /**
   * コンストラクタ
   * @param config 環境変数のプレフィックス設定
   */
  constructor(config: EnvSecretManagerConfig = {}) {
    this.prefix = config.prefix || 'SECRET_';
    logger.info(`環境変数シークレットマネージャー初期化: prefix=${this.prefix}`);
  }
  
  /**
   * キーに対応する環境変数名を取得
   * @param key シークレットのキー
   * @returns 環境変数名
   */
  private getEnvName(key: string): string {
    // キーをスネークケースに変換（例: api.key → API_KEY）
    const normalizedKey = key
      .replace(/\./g, '_')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toUpperCase();
    
    return `${this.prefix}${normalizedKey}`;
  }
  
  /**
   * シークレット値を取得する
   * @param key シークレットのキー
   * @returns 取得した値、エラーまたは存在しない場合はnull
   */
  async getSecret(key: string): Promise<string | null> {
    const envName = this.getEnvName(key);
    const value = process.env[envName];
    
    if (value === undefined) {
      logger.debug(`環境変数が見つかりません: ${envName}`);
      return null;
    }
    
    return value;
  }
  
  /**
   * シークレット値を設定/更新する
   * 注意: 実行時の環境変数のみを変更し、.envファイルは更新しません
   * @param key シークレットのキー
   * @param value 設定する値
   * @returns 成功したかどうか
   */
  async setSecret(key: string, value: string): Promise<boolean> {
    try {
      const envName = this.getEnvName(key);
      process.env[envName] = value;
      logger.debug(`環境変数を設定しました: ${envName}`);
      return true;
    } catch (error) {
      logger.error(`環境変数設定エラー: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  /**
   * シークレットを削除する（環境変数から削除）
   * @param key シークレットのキー
   * @returns 成功したかどうか
   */
  async deleteSecret(key: string): Promise<boolean> {
    try {
      const envName = this.getEnvName(key);
      delete process.env[envName];
      logger.debug(`環境変数を削除しました: ${envName}`);
      return true;
    } catch (error) {
      logger.error(`環境変数削除エラー: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  /**
   * シークレットが存在するか確認
   * @param key シークレットのキー
   * @returns 存在する場合はtrue
   */
  async hasSecret(key: string): Promise<boolean> {
    const envName = this.getEnvName(key);
    return envName in process.env;
  }
} 