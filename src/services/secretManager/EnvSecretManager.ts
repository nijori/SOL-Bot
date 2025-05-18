/**
 * 環境変数を使用したシークレットマネージャー実装
 *
 * プロセス環境変数から設定を取得する簡易的なシークレットマネージャーです。
 * ローカル開発やCIでの使用を想定しています。
 */

// @ts-nocheck
const dotenv = require('dotenv');
const logger = require('../../utils/logger');

// .envファイルを読み込む
dotenv.config();

/**
 * @typedef {Object} EnvSecretManagerConfig
 * @property {string} [prefix] - 環境変数のプレフィックス
 */

/**
 * 環境変数ベースのシークレットマネージャークラス
 */
class EnvSecretManager {
  /**
   * コンストラクタ
   * @param {EnvSecretManagerConfig} [config={}] - 環境変数のプレフィックス設定
   */
  constructor(config = {}) {
    this.prefix = config.prefix || 'SECRET_';
    logger.info(`環境変数シークレットマネージャー初期化: prefix=${this.prefix}`);
  }

  /**
   * キーに対応する環境変数名を取得
   * @param {string} key - シークレットのキー
   * @returns {string} 環境変数名
   */
  getEnvName(key) {
    // キーをスネークケースに変換（例: api.key → API_KEY）
    const normalizedKey = key
      .replace(/\./g, '_')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toUpperCase();

    return `${this.prefix}${normalizedKey}`;
  }

  /**
   * シークレット値を取得する
   * @param {string} key - シークレットのキー
   * @returns {Promise<string|null>} 取得した値、エラーまたは存在しない場合はnull
   */
  async getSecret(key) {
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
   * @param {string} key - シークレットのキー
   * @param {string} value - 設定する値
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setSecret(key, value) {
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
   * @param {string} key - シークレットのキー
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async deleteSecret(key) {
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
   * @param {string} key - シークレットのキー
   * @returns {Promise<boolean>} 存在する場合はtrue
   */
  async hasSecret(key) {
    const envName = this.getEnvName(key);
    return envName in process.env;
  }
}

// CommonJS形式でエクスポート
module.exports = {
  EnvSecretManager
};
