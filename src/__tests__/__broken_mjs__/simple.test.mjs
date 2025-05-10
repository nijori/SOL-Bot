/**
 * 単純なESMテスト
 */

import { describe, test, expect } from '@jest/globals';

describe('Simple test suite', () => {
  test('1 + 1 = 2', () => {
    expect(1 + 1).toBe(2);
  });
});
