// DonchianBreakoutStrategyのモック
module.exports = {
  DonchianBreakoutStrategy: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ signals: [] })
  }))
};
