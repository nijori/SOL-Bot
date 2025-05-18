/**
 * シンプルなESMテスト
 * ESM互換性の検証用
 */

import { jest, describe, test, expect } from '@jest/globals';

describe('ESM Basic Test', () => {
  test('基本的な数値演算', () => {
    expect(1 + 1).toBe(2);
    expect(5 * 5).toBe(25);
  });

  test('文字列処理', () => {
    expect('hello'.toUpperCase()).toBe('HELLO');
    expect('world'.length).toBe(5);
  });

  test('配列操作', () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
    expect(arr.map(x => x * 2)).toEqual([2, 4, 6]);
  });
}); 