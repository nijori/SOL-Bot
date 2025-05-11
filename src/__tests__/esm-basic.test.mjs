/**
 * 単純なESM環境テスト
 */
import { describe, test, expect } from '@jest/globals';

describe('最小限のESMテスト', () => {
  test('基本的な計算が正しく動作する', () => {
    expect(1 + 1).toBe(2);
  });

  test('配列操作が正しく動作する', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });

  test('オブジェクト比較が正しく動作する', () => {
    const obj = { name: 'test', value: 42 };
    expect(obj).toEqual({ name: 'test', value: 42 });
    expect(obj.name).toBe('test');
  });
}); 