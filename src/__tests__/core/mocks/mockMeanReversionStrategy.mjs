// MeanReversionStrategyのモック (ESM形式)
import { jest } from '@jest/globals';

// ESM形式のエクスポート
export const MeanReversionStrategy = jest.fn().mockImplementation(() => ({
  execute: jest.fn().mockResolvedValue({ signals: [] })
})); 