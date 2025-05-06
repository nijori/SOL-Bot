/**
 * シークレットマネージャーのインターフェース
 * 異なるシークレット管理サービス（AWS Parameter Store、GCP Secret Manager等）で共通のインターフェースを提供
 */
export interface SecretManagerInterface {
  /**
   * シークレット値を取得する
   * @param key シークレットのキー
   * @returns 取得した値、エラー時はnull
   */
  getSecret(key: string): Promise<string | null>;
  
  /**
   * シークレット値を設定/更新する
   * @param key シークレットのキー
   * @param value 設定する値
   * @returns 成功したかどうか
   */
  setSecret(key: string, value: string): Promise<boolean>;
  
  /**
   * シークレットを削除する
   * @param key シークレットのキー
   * @returns 成功したかどうか
   */
  deleteSecret(key: string): Promise<boolean>;
  
  /**
   * シークレットが存在するか確認
   * @param key シークレットのキー
   * @returns 存在する場合はtrue
   */
  hasSecret(key: string): Promise<boolean>;
} 