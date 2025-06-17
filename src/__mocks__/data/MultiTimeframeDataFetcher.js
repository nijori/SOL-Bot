/**
 * MultiTimeframeDataFetcherのモック
 */

const mockParquetDataStore = {
  saveCandles: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(undefined)
};

const mockJob = {
  stop: jest.fn(),
  destroy: jest.fn()
};

// 時間フレーム定数
const Timeframe = {
  MINUTE_1: '1m',
  MINUTE_15: '15m',
  HOUR_1: '1h',
  DAY_1: '1d'
};

class MultiTimeframeDataFetcher {
  constructor() {
    this.parquetDataStore = mockParquetDataStore;
    this.exchanges = new Map([
      ['binance', {}],
      ['kucoin', {}],
      ['bybit', {}]
    ]);
    this.activeJobs = new Map();
  }

  async fetchAndSaveTimeframe(timeframe, symbol) {
    if (timeframe === Timeframe.DAY_1 && process.env.THROW_API_ERROR === 'true') {
      return false;
    }
    return true;
  }

  async fetchAllTimeframes(symbol) {
    if (process.env.THROW_API_ERROR === 'true') {
      return {
        [Timeframe.MINUTE_1]: true,
        [Timeframe.MINUTE_15]: true,
        [Timeframe.HOUR_1]: true,
        [Timeframe.DAY_1]: false
      };
    }
    return {
      [Timeframe.MINUTE_1]: true,
      [Timeframe.MINUTE_15]: true,
      [Timeframe.HOUR_1]: true,
      [Timeframe.DAY_1]: true
    };
  }

  startScheduledJob(timeframe, symbol) {
    // scheduleJobs内にジョブを設定
    this.activeJobs.set(timeframe, mockJob);
    return mockJob;
  }

  stopScheduledJob(timeframe) {
    const job = this.activeJobs.get(timeframe);
    if (job) {
      job.stop();
      job.destroy();
      this.activeJobs.delete(timeframe);
    }
  }

  startAllScheduledJobs(symbol) {
    this.startScheduledJob(Timeframe.MINUTE_1, symbol);
    this.startScheduledJob(Timeframe.MINUTE_15, symbol);
    this.startScheduledJob(Timeframe.HOUR_1, symbol);
    this.startScheduledJob(Timeframe.DAY_1, symbol);
  }

  stopAllScheduledJobs() {
    for (const [timeframe, job] of this.activeJobs.entries()) {
      this.stopScheduledJob(timeframe);
    }
  }

  close() {
    this.stopAllScheduledJobs();
    if (this.parquetDataStore) {
      this.parquetDataStore.close();
    }
  }

  async fetchCandlesFromExchange(exchangeId, symbol, timeframe) {
    if (exchangeId === 'binance' && process.env.PRIMARY_EXCHANGE_ERROR === 'true') {
      throw new Error('Primary exchange error');
    }
    return [
      {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000
      }
    ];
  }
}

// モックオブジェクトのエクスポート
module.exports = {
  MultiTimeframeDataFetcher,
  mockParquetDataStore,
  mockJob,
  Timeframe
}; 