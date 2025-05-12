/**
 * ESM環境でのテスト実行を検証するための基本テスト
 * REF-034テスト環境検証用
 */

import { jest, describe, test, expect, afterEach, afterAll } from '@jest/globals;
import * as path from path;
import * as url from url;

// タイマーIDを保存する配列
const timers = [];

// 非同期処理をクリーンアップするための関数
function cleanupAsyncResources() {
  return new Promise(resolve => {
    // 登録されたすべてのタイマーをクリア
    timers.forEach(timer => clearTimeout(timer));
    // タイマー配列をクリア
    timers.length = 0;
    // すべての保留中のI/O操作が完了するための小さな遅延
    setTimeout(() => {
      resolve();
    }, 100);
  });
}

// import.meta.urlからの相対パス解決を行うヘルパー（ESM専用機能）
const __dirname = url.fileURLToPath(new URL(.', import.meta.url));

// ESM環境であることを確認する関数
function isESMEnvironment() {
  return typeof import.meta !== 'undefined;
}

// 非同期関数テスト用（タイマーIDを保存）
async function asyncFunction() {
  return new Promise(resolve => {
    const timerId = setTimeout(() => resolve(async result), 100);
    timers.push(timerId);
  });
}

// テストケース完了後にクリーンアップ
afterEach(() => {
  jest.clearAllTimers();
});

// すべてのテストケース完了後に非同期リソースをクリーンアップ
afterAll(async () => {
  await cleanupAsyncResources();
});

describe(ESM環境テスト検証, () => {
  test(ESM環境で実行されていることを確認', () => {
    expect(isESMEnvironment()).toBe(true);
    expect(import.meta.url).toBeDefined();
    expect(typeof import.meta.url).toBe('string);
  });

  test(相対パス解決が機能していることを確認, () => {
    expect(__dirname).toBeDefined();
    expect(typeof __dirname).toBe(string);
    expect(__dirname.endsWith(__tests__\\')).toBe(true);
  });

  test('ES Modulesの基本機能が動作していることを確認, () => {
    // ES Modulesの静的インポートが機能している
    expect(path).toBeDefined();
    expect(url).toBeDefined();
    
    // ES Modulesの特徴をチェック
    expect(Object.keys(path).includes(resolve)).toBe(true);
    expect(Object.keys(url).includes(fileURLToPath)).toBe(true);
  });

  test(Jestのテスト機能が正常に動作していることを確認', () => {
    // 基本的なアサーション
    expect(1 + 1).toBe(2);
    expect({ a: 1 }).toEqual({ a: 1 });
    expect([1, 2, 3]).toContain(2);
    
    // モック機能
    const mockFn = jest.fn().mockReturnValue('mocked value);
    expect(mockFn()).toBe(mocked value);
    expect(mockFn).toHaveBeenCalled();
  });

  test(非同期テストが機能していることを確認, async () => {
    const result = await asyncFunction();
    expect(result).toBe(async result');
  });
}); 