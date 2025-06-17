/**
 * シンプルなCommonJSテスト
 */
const { describe, test, expect } = require('@jest/globals');

describe('シンプルな基本テスト', () => {
  test('基本的な計算が動作する', () => {
    expect(1 + 1).toBe(2);
  });

  test('配列が正しく処理される', () => {
    const array = [1, 2, 3];
    expect(array).toHaveLength(3);
    expect(array).toContain(2);
  });

  test('オブジェクトが正しく処理される', () => {
    const obj = { a: 1, b: 'test' };
    expect(obj).toEqual({ a: 1, b: 'test' });
  });
}); 