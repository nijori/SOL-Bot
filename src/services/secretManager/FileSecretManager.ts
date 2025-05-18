/**
 * ファイルベースのシークレットマネージャー実装
 * 開発環境やテスト環境で使用するためのもので、本番環境では使用しないでください
 */

// @ts-nocheck
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

/**
 * ファイルベースのシークレットマネージャークラス
 */
class FileSecretManager {
  /**
   * コンストラクタ
   * @param {string} [secretsFilePath='.secrets.json'] - シークレットを保存するJSONファイルのパス
   */
  constructor(secretsFilePath = '.secrets.json') {
    // プロジェクトルートからの相対パスを絶対パスに変換
    this.secretsFilePath = path.resolve(process.cwd(), secretsFilePath);
    this.secrets = {};
    this.loadSecrets();
  }

  /**
   * シークレットをファイルから読み込む
   */
  loadSecrets() {
    try {
      if (fs.existsSync(this.secretsFilePath)) {
        const data = fs.readFileSync(this.secretsFilePath, 'utf8');
        this.secrets = JSON.parse(data);
        logger.debug(`シークレットファイルを読み込みました: ${this.secretsFilePath}`);
      } else {
        logger.debug(
          `シークレットファイルが存在しないため、新規作成します: ${this.secretsFilePath}`
        );
        this.saveSecrets();
      }
    } catch (error) {
      logger.error(
        `シークレットファイル読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
      );
      this.secrets = {};
    }
  }

  /**
   * シークレットをファイルに保存する
   */
  saveSecrets() {
    try {
      const dirPath = path.dirname(this.secretsFilePath);

      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      fs.writeFileSync(this.secretsFilePath, JSON.stringify(this.secrets, null, 2), 'utf8');

      // シークレットファイルのパーミッションを制限（Unixシステムの場合）
      if (process.platform !== 'win32') {
        fs.chmodSync(this.secretsFilePath, 0o600); // ユーザーのみ読み書き可能
      }

      logger.debug(`シークレットファイルを保存しました: ${this.secretsFilePath}`);
    } catch (error) {
      logger.error(
        `シークレットファイル保存エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * シークレット値を取得する
   * @param {string} key - シークレットのキー
   * @returns {Promise<string|null>} 取得した値、エラーまたは存在しない場合はnull
   */
  async getSecret(key) {
    return this.secrets[key] || null;
  }

  /**
   * シークレット値を設定/更新する
   * @param {string} key - シークレットのキー
   * @param {string} value - 設定する値
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setSecret(key, value) {
    try {
      this.secrets[key] = value;
      this.saveSecrets();
      return true;
    } catch (error) {
      logger.error(
        `シークレット設定エラー: ${error instanceof Error ? error.message : String(error)}`
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
      if (this.secrets[key]) {
        delete this.secrets[key];
        this.saveSecrets();
      }
      return true;
    } catch (error) {
      logger.error(
        `シークレット削除エラー: ${error instanceof Error ? error.message : String(error)}`
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
    return key in this.secrets;
  }
}

// CommonJS形式でエクスポート
module.exports = {
  FileSecretManager
};
