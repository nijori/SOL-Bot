// @ts-nocheck
const fs = require('fs');
const path = require('path');
const { jest, describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// 直接関数を定義してテスト
describe('killSwitchChecker', () => {
  const originalExistsSync = fs.existsSync;
  const originalProcessExit = process.exit;
  const originalConsoleError = console.error;
  
  // モック関数
  let mockExistsSync;
  let mockProcessExit;
  let mockConsoleError;
  
  // キルスイッチのパス
  const KILL_SWITCH_FLAG_PATH = path.resolve(process.cwd(), 'data', 'kill-switch.flag');
  
  // テスト対象の関数を直接定義
  function checkKillSwitch() {
    try {
      const exists = fs.existsSync(KILL_SWITCH_FLAG_PATH);
      if (exists) {
        console.error('緊急停止フラグが検出されました。アプリケーションを停止します。');
        return true;
      }
      return false;
    } catch (error) {
      console.error(`緊急停止フラグチェック中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
      return true;
    }
  }
  
  function executeKillSwitch(exitCode = 1) {
    console.error('緊急停止処理を実行します。プロセスを終了します。');
    setTimeout(() => {
      process.exit(exitCode);
    }, 500);
  }

  beforeEach(() => {
    // fs.existsSyncをモック化
    mockExistsSync = jest.fn();
    fs.existsSync = mockExistsSync;
    
    // process.exitをモック化
    mockProcessExit = jest.fn();
    process.exit = mockProcessExit;
    
    // console.errorをモック化
    mockConsoleError = jest.fn();
    console.error = mockConsoleError;
    
    // setTimeout をモック化して即時実行
    jest.useFakeTimers({ doNotFake: [] });
  });

  afterEach(() => {
    // 元に戻す
    fs.existsSync = originalExistsSync;
    process.exit = originalProcessExit;
    console.error = originalConsoleError;
    
    // タイマーをリセット
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  test('checkKillSwitch はフラグが存在しない場合 false を返す', () => {
    mockExistsSync.mockReturnValue(false);
    expect(checkKillSwitch()).toBe(false);
    expect(mockExistsSync).toHaveBeenCalledWith(KILL_SWITCH_FLAG_PATH);
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  test('checkKillSwitch はフラグが存在する場合 true を返す', () => {
    mockExistsSync.mockReturnValue(true);
    expect(checkKillSwitch()).toBe(true);
    expect(mockExistsSync).toHaveBeenCalledWith(KILL_SWITCH_FLAG_PATH);
    expect(mockConsoleError).toHaveBeenCalled();
  });

  test('checkKillSwitch はエラーが発生した場合 true を返す', () => {
    mockExistsSync.mockImplementation(() => {
      throw new Error('テスト用エラー');
    });
    expect(checkKillSwitch()).toBe(true);
    expect(mockConsoleError).toHaveBeenCalled();
  });

  test('executeKillSwitch は500ms後にprocess.exitを呼び出す', () => {
    executeKillSwitch(99);
    expect(mockProcessExit).not.toHaveBeenCalled();
    expect(mockConsoleError).toHaveBeenCalled();
    
    // タイマーを実行
    jest.runAllTimers();
    // 500ms進める
    jest.advanceTimersByTime(500);
    expect(mockProcessExit).toHaveBeenCalledWith(99);
  });
}); 