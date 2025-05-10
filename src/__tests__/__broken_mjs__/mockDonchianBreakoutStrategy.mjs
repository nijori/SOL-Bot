// DonchianBreakoutStrategyのモック (ESM形式)
import { jest } from '@jest/globals';

// ESM形式のエクスポート
export const DonchianBreakoutStrategy = jest.fn().mockImplementation(() => ({
  execute: jest.fn().mockResolvedValue({ signals: [] })
}));
