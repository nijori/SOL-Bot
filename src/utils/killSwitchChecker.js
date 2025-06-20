const fs = require('fs');
const path = require('path');
const logger = require('./logger').default;

/**
 * 緊急停止フラグファイルのパス
 */
const KILL_SWITCH_FLAG_PATH = path.resolve(process.cwd(), 'data', 'kill-switch.flag');

/**
 * 緊急停止フラグが存在するかチェックする
 * 
 * @returns {boolean} 緊急停止フラグが存在する場合はtrue、存在しない場合はfalse
 */
function checkKillSwitch() {
  try {
    // ファイルが存在するか確認
    const exists = fs.existsSync(KILL_SWITCH_FLAG_PATH);
    
    if (exists) {
      logger.error('緊急停止フラグが検出されました。アプリケーションを停止します。');
      return true;
    }
    
    return false;
  } catch (error) {
    // エラーが発生した場合、安全側に倒してtrueを返す
    logger.error(`緊急停止フラグチェック中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    return true;
  }
}

/**
 * 緊急停止処理を実行する
 * 
 * @param {number} exitCode プロセス終了コード（デフォルト: 1）
 */
function executeKillSwitch(exitCode = 1) {
  logger.error('緊急停止処理を実行します。プロセスを終了します。');
  
  // 一度ログをflushするために少し待ってから終了
  setTimeout(() => {
    process.exit(exitCode);
  }, 500);
}

/**
 * 緊急停止フラグをチェックし、存在する場合はプロセスを終了する
 * 
 * @param {number} exitCode プロセス終了コード（デフォルト: 1）
 * @returns {boolean} 緊急停止フラグが存在しない場合はfalse、存在する場合はプロセスが終了するため返り値なし
 */
function checkAndExecuteKillSwitch(exitCode = 1) {
  if (checkKillSwitch()) {
    executeKillSwitch(exitCode);
    // ここには到達しないが、TypeScriptの型検査を満たすために返り値を設定
    return true;
  }
  return false;
}

// CommonJSエクスポート
module.exports = {
  KILL_SWITCH_FLAG_PATH,
  checkKillSwitch,
  executeKillSwitch,
  checkAndExecuteKillSwitch
}; 