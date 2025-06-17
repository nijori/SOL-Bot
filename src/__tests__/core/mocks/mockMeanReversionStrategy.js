// MeanReversionStrategyのモック
module.exports = {
  MeanReversionStrategy: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ signals: [] })
  }))
};
