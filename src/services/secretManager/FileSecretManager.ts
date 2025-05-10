/**
 * ファイルベースのシークレットマネージャー実装
 * 開発環境やテスト環境で使用するためのもので、本番環境では使用しないでください
 */

import fs from 'fs';
import path from 'path';
import { SecretManagerInterface } from "./SecretManagerInterface.js";
import logger from "../../utils/logger.js";

export class FileSecretManager implements SecretManagerInterface {
  private readonly secretsFilePath: string;
  private secrets: Record<string, string> = {};

  /**
   * コンストラクタ
   * @param secretsFilePath シークレットを保存するJSONファイルのパス（デフォルト: ".secrets.json"）
   */
  constructor(secretsFilePath: string = '.secrets.json') {
    // プロジェクトルートからの相対パスを絶対パスに変換
    this.secretsFilePath = path.resolve(process.cwd(), secretsFilePath);
    this.loadSecrets();
  }

  /**
   * シークレットをファイルから読み込む
   */
  private loadSecrets(): void {
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
  private saveSecrets(): void {
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
   * @param key シークレットのキー
   * @returns 取得した値、エラーまたは存在しない場合はnull
   */
  async getSecret(key: string): Promise<string | null> {
    return this.secrets[key] || null;
  }

  /**
   * シークレット値を設定/更新する
   * @param key シークレットのキー
   * @param value 設定する値
   * @returns 成功したかどうか
   */
  async setSecret(key: string, value: string): Promise<boolean> {
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
   * @param key シークレットのキー
   * @returns 成功したかどうか
   */
  async deleteSecret(key: string): Promise<boolean> {
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
   * @param key シークレットのキー
   * @returns 存在する場合はtrue
   */
  async hasSecret(key: string): Promise<boolean> {
    return key in this.secrets;
  }
}
