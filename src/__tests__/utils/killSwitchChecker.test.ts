import fs from 'fs';
import path from 'path';
import {
  KILL_SWITCH_FLAG_PATH,
  checkKillSwitch,
  executeKillSwitch
} from '../../utils/killSwitchChecker';

// モックの設定
jest.mock('fs');
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

describe('killSwitchChecker', () => {
  const mockExistSync = fs.existsSync as jest.Mock;
  const originalProcessExit = process.exit;

  beforeEach(() => {
    // process.exitをモック化（型アサーションでエラーを回避）
    process.exit = jest.fn() as unknown as typeof process.exit;
    
    // fsのモックをリセット
    mockExistSync.mockReset();
    
    // setTimeout をモック化して即時実行
    jest.useFakeTimers();
  });

  afterEach(() => {
    // process.exitを元に戻す
    process.exit = originalProcessExit;
    
    // タイマーをリセット
    jest.useRealTimers();
  });

  test('KILL_SWITCH_FLAG_PATHは正しいパスを返す', () => {
    const expectedPath = path.resolve(process.cwd(), 'data', 'kill-switch.flag');
    expect(KILL_SWITCH_FLAG_PATH).toBe(expectedPath);
  });

  test('checkKillSwitch はフラグが存在しない場合 false を返す', () => {
    mockExistSync.mockReturnValue(false);
    expect(checkKillSwitch()).toBe(false);
    expect(mockExistSync).toHaveBeenCalledWith(KILL_SWITCH_FLAG_PATH);
  });

  test('checkKillSwitch はフラグが存在する場合 true を返す', () => {
    mockExistSync.mockReturnValue(true);
    expect(checkKillSwitch()).toBe(true);
    expect(mockExistSync).toHaveBeenCalledWith(KILL_SWITCH_FLAG_PATH);
  });

  test('checkKillSwitch はエラーが発生した場合 true を返す', () => {
    mockExistSync.mockImplementation(() => {
      throw new Error('テスト用エラー');
    });
    expect(checkKillSwitch()).toBe(true);
  });

  test('executeKillSwitch は500ms後にprocess.exitを呼び出す', () => {
    executeKillSwitch(99);
    expect(process.exit).not.toHaveBeenCalled();
    
    // 500ms進める
    jest.advanceTimersByTime(500);
    expect(process.exit).toHaveBeenCalledWith(99);
  });
}); 