/**
 * シークレットマネージャー使用例
 *
 * このファイルはシークレットマネージャーの使用方法を示します。
 * 実際のコードでの参照用で、実行することは意図されていません。
 */

import { secretManager, SecretManagerFactory, SecretManagerType } from "./index.js";
import logger from "../../utils/logger.js";

/**
 * デフォルトのシークレットマネージャーを使用する例
 */
async function useDefaultSecretManager() {
  try {
    // デフォルトのシークレットマネージャーでシークレットを取得
    const apiKey = await secretManager.getSecret('exchange.api_key');
    const apiSecret = await secretManager.getSecret('exchange.api_secret');

    logger.info(`API Keyを取得しました: ${apiKey ? '成功' : '未設定'}`);

    // 環境に応じた処理
    if (apiKey && apiSecret) {
      // 取引所クライアントの初期化などの処理
      logger.info('取引所クライアントを初期化しました');
    } else {
      logger.warn('API認証情報が見つかりません');
    }
  } catch (error) {
    logger.error(
      `シークレット取得エラー: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 特定のシークレットマネージャーを指定して使用する例
 */
async function useSpecificSecretManager() {
  try {
    // AWS Parameter Storeを使用するシークレットマネージャーを取得
    const awsSecretManager = SecretManagerFactory.getSecretManager({
      type: SecretManagerType.AWS_PARAMETER_STORE,
      awsConfig: {
        region: 'ap-northeast-1',
        pathPrefix: '/sol-bot/prod/'
      }
    });

    // シークレットを取得
    const dbPassword = await awsSecretManager.getSecret('database.password');

    // シークレットを設定（新規作成または更新）
    await awsSecretManager.setSecret('app.version', '1.0.0');

    // シークレットが存在するか確認
    const hasApiKey = await awsSecretManager.hasSecret('exchange.api_key');

    logger.info(`シークレットチェック結果 - API Key: ${hasApiKey ? '存在します' : '存在しません'}`);
  } catch (error) {
    logger.error(
      `AWS Parameter Store操作エラー: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * GCP Secret Managerを使用する例
 */
async function useGCPSecretManager() {
  try {
    // GCP Secret Managerを使用するシークレットマネージャーを取得
    const gcpSecretManager = SecretManagerFactory.getSecretManager({
      type: SecretManagerType.GCP_SECRET_MANAGER,
      gcpConfig: {
        projectId: 'sol-bot-prod'
      }
    });

    // シークレットを取得
    const apiKey = await gcpSecretManager.getSecret('exchange-api-key');

    // シークレットを設定（新規作成または更新）
    await gcpSecretManager.setSecret('app-version', '1.0.0');

    logger.info('GCP Secret Managerの操作が完了しました');
  } catch (error) {
    logger.error(
      `GCP Secret Manager操作エラー: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 環境変数を使用する例
 */
async function useEnvSecretManager() {
  try {
    // 環境変数を使用するシークレットマネージャーを取得
    const envSecretManager = SecretManagerFactory.getSecretManager({
      type: SecretManagerType.ENV,
      envPrefix: 'SOL_BOT_'
    });

    // シークレットを取得（例: 環境変数 SOL_BOT_API_KEY の値を取得）
    const apiKey = await envSecretManager.getSecret('api_key');

    // 実行時の環境変数を設定
    await envSecretManager.setSecret('debug_mode', 'true');

    logger.info('環境変数シークレットマネージャーの操作が完了しました');
  } catch (error) {
    logger.error(`環境変数操作エラー: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function runExamples() {
  await useDefaultSecretManager();
  // 実際の環境に応じてコメントアウトを解除
  // await useSpecificSecretManager();
  // await useGCPSecretManager();
  // await useEnvSecretManager();
}
