/**
 * 単純なESM環境テスト
 * TST-057: ESMテスト環境の修正と安定化
 */

// ESM環境では直接importを使用
import { describe, test, expect, jest } from '@jest/globals';

describe('ESM テスト環境', () => {
  test('基本的なアサーションが動作する', () => {
    expect(1 + 1).toBe(2);
  });

  test('@jest/globalsからのimportが機能する', () => {
    // jestオブジェクトが正しくimportされているか確認
    expect(typeof jest.fn).toBe('function');
  });

  test('配列操作が正しく動作する', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });

  test('タイマーAPIが動作する', done => {
    let completed = false;
    
    setTimeout(() => {
      completed = true;
      expect(completed).toBe(true);
      done();
    }, 100);
  });
}); 