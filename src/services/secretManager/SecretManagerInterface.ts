/**
 * シークレットマネージャーのインターフェース
 * 異なるシークレット管理サービス（AWS Parameter Store、GCP Secret Manager等）で共通のインターフェースを提供
 */

// @ts-nocheck
/**
 * SecretManagerInterface
 * シークレット管理サービスの共通インターフェース
 * 
 * @interface
 * @property {Function} getSecret - シークレット値を取得する
 * @property {Function} setSecret - シークレット値を設定/更新する
 * @property {Function} deleteSecret - シークレットを削除する
 * @property {Function} hasSecret - シークレットが存在するか確認
 */

/**
 * シークレット値を取得する
 * @param {string} key シークレットのキー
 * @returns {Promise<string|null>} 取得した値、エラー時はnull
 */

/**
 * シークレット値を設定/更新する
 * @param {string} key シークレットのキー
 * @param {string} value 設定する値
 * @returns {Promise<boolean>} 成功したかどうか
 */

/**
 * シークレットを削除する
 * @param {string} key シークレットのキー
 * @returns {Promise<boolean>} 成功したかどうか
 */

/**
 * シークレットが存在するか確認
 * @param {string} key シークレットのキー
 * @returns {Promise<boolean>} 存在する場合はtrue
 */

// CommonJS形式でemptyオブジェクトをエクスポート（インターフェース定義のため）
module.exports = {};
