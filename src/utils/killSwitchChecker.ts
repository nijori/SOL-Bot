/**
 * 緊急停止機能チェッカー
 * INF-032: CommonJS形式への変換
 */
// @ts-nocheck
// 循環参照を避けるため、型チェックを一時的に無効化

// モジュールヘルパーを使用して循環参照を解決
var moduleHelperRef = require('./moduleHelper');
var fsRef = require('fs');
var pathRef = require('path');
var loggerRef = moduleHelperRef.hasModule('logger') 
  ? moduleHelperRef.getModule('logger') 
  : require('./logger').default;

/**
 * 緊急停止フラグファイルのパス
 * @type {string}
 */
var KILL_SWITCH_FLAG_PATH = pathRef.resolve(process.cwd(), 'data', 'kill-switch.flag');

/**
 * 緊急停止フラグが存在するかチェックする
 * 
 * @returns {boolean} 緊急停止フラグが存在する場合はtrue、存在しない場合はfalse
 */
function checkKillSwitchFlag() {
  try {
    // ファイルが存在するか確認
    const exists = fsRef.existsSync(KILL_SWITCH_FLAG_PATH);
    
    if (exists) {
      loggerRef.error('緊急停止フラグが検出されました。アプリケーションを停止します。');
      return true;
    }
    
    return false;
  } catch (error) {
    // エラーが発生した場合、安全側に倒してtrueを返す
    loggerRef.error(`緊急停止フラグチェック中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    return true;
  }
}

/**
 * 緊急停止処理を実行する
 * 
 * @param {number} [exitCode=1] プロセス終了コード（デフォルト: 1）
 */
function executeKillSwitch(exitCode = 1) {
  loggerRef.error('緊急停止処理を実行します。プロセスを終了します。');
  
  // 一度ログをflushするために少し待ってから終了
  setTimeout(() => {
    process.exit(exitCode);
  }, 500);
}

/**
 * 緊急停止フラグをチェックし、存在する場合はプロセスを終了する
 * 
 * @param {number} [exitCode=1] プロセス終了コード（デフォルト: 1）
 * @returns {boolean} 緊急停止フラグが存在しない場合はfalse、存在する場合はプロセスが終了するため返り値なし
 */
function checkAndExecuteKillSwitchFlag(exitCode = 1) {
  if (checkKillSwitchFlag()) {
    executeKillSwitch(exitCode);
    // ここには到達しないが、TypeScriptの型検査を満たすために返り値を設定
    return true;
  }
  return false;
}

// モジュールをレジストリに登録
moduleHelperRef.registerModule('killSwitchChecker', {
  KILL_SWITCH_FLAG_PATH,
  checkKillSwitch: checkKillSwitchFlag,
  executeKillSwitch,
  checkAndExecuteKillSwitch: checkAndExecuteKillSwitchFlag
});

// CommonJS形式でエクスポート
module.exports = {
  KILL_SWITCH_FLAG_PATH,
  checkKillSwitch: checkKillSwitchFlag,
  executeKillSwitch,
  checkAndExecuteKillSwitch: checkAndExecuteKillSwitchFlag
}; 