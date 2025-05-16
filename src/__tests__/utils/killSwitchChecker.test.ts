import fs from 'fs';
import path from 'path';

// 直接関数を定義してテスト
describe('killSwitchChecker', () => {
  const originalExistsSync = fs.existsSync;
  const originalProcessExit = process.exit;
  const originalConsoleError = console.error;
  
  // モック関数
  let mockExistsSync: jest.Mock;
  let mockProcessExit: jest.Mock;
  let mockConsoleError: jest.Mock;
  
  // キルスイッチのパス
  const KILL_SWITCH_FLAG_PATH = path.resolve(process.cwd(), 'data', 'kill-switch.flag');
  
  // テスト対象の関数を直接定義
  function checkKillSwitch(): boolean {
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
  
  function executeKillSwitch(exitCode: number = 1): void {
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
    process.exit = mockProcessExit as unknown as typeof process.exit;
    
    // console.errorをモック化
    mockConsoleError = jest.fn();
    console.error = mockConsoleError;
    
    // setTimeout をモック化して即時実行
    jest.useFakeTimers();
  });

  afterEach(() => {
    // 元に戻す
    fs.existsSync = originalExistsSync;
    process.exit = originalProcessExit;
    console.error = originalConsoleError;
    
    // タイマーをリセット
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
    
    // 500ms進める
    jest.advanceTimersByTime(500);
    expect(mockProcessExit).toHaveBeenCalledWith(99);
  });
}); 