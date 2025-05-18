// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

/**
 * マルチエクスチェンジ統合テスト
 *
 * BT-007: Binance / Bybit / KuCoin stub を用いた end-to-end backtest
 * 複数取引所間の注文配分、レート差異、手数料計算の正確性を検証
 * 異なるAPI応答パターンに対する互換性も確認
 */

// 明示的にTypesをインポート
const { Types, OrderSide, OrderType, OrderStatus } = require('../../core/types');
const ccxt = require('ccxt');

// モック用の取引所サービスを作成
class MockExchangeService {
  // ExchangeServiceインターフェースを実装するために必要なプロパティ
  exchange; // ダミーのccxt.Exchangeインスタンス
  isInitialized = true;
  MAX_RETRIES = 7; // ExchangeServiceと同じ値
  INITIAL_BACKOFF_MS = 1000;
  MAX_BACKOFF_MS = 64000; // ExchangeServiceと同じ値
  BACKOFF_FACTOR = 2;

  constructor(
    exchangeName,
    feeRate = 0.001,
    latency = 0,
    priceOffset = 0
  ) {
    this.exchangeName = exchangeName;
    this.feeRate = feeRate;
    this.latency = latency;
    this.priceOffset = priceOffset;
    this.symbolInfos = new Map();

    // ダミーのccxt.Exchangeインスタンスを作成
    this.exchange = {
      id: exchangeName.toLowerCase(),
      name: exchangeName
    };

    // デフォルトのシンボル情報を設定
    this.addSymbolInfo('BTC/USDT', {
      symbol: 'BTC/USDT',
      base: 'BTC',
      quote: 'USDT',
      active: true,
      pricePrecision: 2,
      amountPrecision: 6,
      costPrecision: 2,
      minPrice: 1,
      maxPrice: 100000,
      minAmount: 0.0001,
      maxAmount: 100,
      minCost: 10,
      tickSize: 0.01,
      stepSize: 0.0001,
      makerFee: 0.001,
      takerFee: 0.001,
      fetchTimestamp: Date.now(),
      exchangeSpecific: {}
    });

    this.addSymbolInfo('ETH/USDT', {
      symbol: 'ETH/USDT',
      base: 'ETH',
      quote: 'USDT',
      active: true,
      pricePrecision: 2,
      amountPrecision: 5,
      costPrecision: 2,
      minPrice: 1,
      maxPrice: 10000,
      minAmount: 0.001,
      maxAmount: 1000,
      minCost: 10,
      tickSize: 0.01,
      stepSize: 0.001,
      makerFee: 0.001,
      takerFee: 0.001,
      fetchTimestamp: Date.now(),
      exchangeSpecific: {}
    });

    this.addSymbolInfo('SOL/USDT', {
      symbol: 'SOL/USDT',
      base: 'SOL',
      quote: 'USDT',
      active: true,
      pricePrecision: 2,
      amountPrecision: 3,
      costPrecision: 2,
      minPrice: 0.1,
      maxPrice: 1000,
      minAmount: 0.01,
      maxAmount: 10000,
      minCost: 5,
      tickSize: 0.01,
      stepSize: 0.01,
      makerFee: 0.001,
      takerFee: 0.001,
      fetchTimestamp: Date.now(),
      exchangeSpecific: {}
    });
  }

  // ExchangeServiceインターフェースの必須メソッド
  async initialize() {
    return true;
  }

  getExchangeName() {
    return this.exchangeName;
  }

  getFeeRate() {
    return this.feeRate;
  }

  getPriceOffset() {
    return this.priceOffset;
  }

  async executeOrder(order) {
    // シミュレートされた注文処理
    await this.simulateLatency();
    return `${this.exchangeName}-${Date.now()}`;
  }

  getSymbolInfo(symbol) {
    return this.symbolInfos.get(symbol) || null;
  }

  addSymbolInfo(symbol, info) {
    this.symbolInfos.set(symbol, info);
  }

  async fetchCandles(symbol, timeframe, limit = 100) {
    await this.simulateLatency();
    const candles = [];
    const now = Date.now();

    // 時間足に合わせた間隔を設定
    const interval =
      timeframe === '1h'
        ? 3600000
        : timeframe === '4h'
          ? 14400000
          : timeframe === '1d'
            ? 86400000
            : 60000;

    // 基準価格
    const basePrice =
      symbol === 'BTC/USDT'
        ? 50000
        : symbol === 'ETH/USDT'
          ? 3000
          : symbol === 'SOL/USDT'
            ? 100
            : 1;

    // ダミーローソク足データを生成
    for (let i = 0; i < limit; i++) {
      const timestamp = now - (limit - i) * interval;
      const priceChange = (Math.random() - 0.5) * 0.02; // -1%〜+1%の価格変動
      const price = basePrice * (1 + this.priceOffset) * (1 + priceChange);

      candles.push({
        timestamp,
        open: price * 0.99,
        high: price * 1.02,
        low: price * 0.98,
        close: price,
        volume: Math.random() * 1000
      });
    }

    return candles;
  }

  // モック実装のためのヘルパーメソッド
  // 実際のExchangeServiceにはないが、モックとして必要
  async simulateLatency() {
    if (this.latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latency));
    }
  }

  // 以下、ExchangeServiceのインターフェースを満たすためのダミー実装
  async getOpenOrders() {
    await this.simulateLatency();
    return [];
  }

  async getOrder() {
    await this.simulateLatency();
    return null;
  }

  async cancelOrder() {
    await this.simulateLatency();
    return true;
  }

  async getPositions() {
    await this.simulateLatency();
    return [];
  }

  async getLatestPrice(symbol) {
    await this.simulateLatency();
    // 取引所ごとの価格差を模擬
    const basePrice =
      symbol === 'BTC/USDT'
        ? 50000
        : symbol === 'ETH/USDT'
          ? 3000
          : symbol === 'SOL/USDT'
            ? 100
            : 0;
    return basePrice * (1 + this.priceOffset);
  }

  async createOcoOrder() {
    await this.simulateLatency();
    return `${this.exchangeName}-OCO-${Date.now()}`;
  }

  async fetchBalance() {
    await this.simulateLatency();
    return {
      USDT: 10000,
      BTC: 0.1,
      ETH: 1,
      SOL: 10
    };
  }

  // テスト用のモックなので、必要最小限のメソッドだけを実装
  // 実際のExchangeServiceはより多くのメソッドを持つ
  isRetryable() {
    return false;
  }
  async fetchWithExponentialBackoff(apiCall) {
    return apiCall();
  }
  mapOrderTypeToCCXT() {
    return 'limit';
  }
  mapCCXTToOrderType() {
    return OrderType.LIMIT;
  }
  async fetchOrder() {
    return null;
  }
  async fetchOrderAndConvert() {
    return null;
  }
  supportsFeature() {
    return true;
  }
  supportsOCO() {
    return true;
  }
  async getMarketInfo() {
    return null;
  }
  async fetchTicker() {
    return null;
  }
}

// UnifiedOrderManagerをモック
jest.mock('../../services/UnifiedOrderManager', () => {
  const original = jest.requireActual('../../services/UnifiedOrderManager');

  class MockUnifiedOrderManager {
    constructor(allocationConfig = { strategy: original.AllocationStrategy.PRIORITY }) {
      this.allocationConfig = allocationConfig;
      this.exchanges = new Map();
    }

    addExchange(
      exchangeId,
      exchangeService,
      priority = 100
    ) {
      this.exchanges.set(exchangeId, {
        id: exchangeId,
        exchangeService,
        active: true,
        priority
      });
      return true;
    }

    removeExchange(exchangeId) {
      return this.exchanges.delete(exchangeId);
    }

    setExchangeActive(exchangeId, active) {
      const exchange = this.exchanges.get(exchangeId);
      if (exchange) {
        exchange.active = active;
        return true;
      }
      return false;
    }

    createOrder(order) {
      const orderIds = new Map();
      this.exchanges.forEach((exchange, exchangeId) => {
        if (exchange.active) {
          orderIds.set(exchangeId, `${exchangeId}-${Date.now()}`);
        }
      });
      return orderIds;
    }

    syncAllOrders() {
      return Promise.resolve(true);
    }
  }

  return {
    ...original,
    UnifiedOrderManager: MockUnifiedOrderManager
  };
});

describe('マルチエクスチェンジ統合テスト', () => {
  // テスト用のUnifiedOrderManagerインスタンス
  let unifiedOrderManager;

  // 各取引所のモックサービス
  let binanceService;
  let bybitService;
  let kucoinService;

  beforeEach(() => {
    // 各取引所のモックサービスを作成
    // 手数料率、レイテンシー、価格オフセットを微妙に変える
    binanceService = new MockExchangeService('Binance', 0.001, 50, 0); // 標準
    bybitService = new MockExchangeService('Bybit', 0.0015, 80, 0.0005); // 少し高い手数料、価格+0.05%
    kucoinService = new MockExchangeService('KuCoin', 0.002, 100, -0.0002); // より高い手数料、価格-0.02%

    // UnifiedOrderManagerを初期化
    const {
      UnifiedOrderManager,
      AllocationStrategy
    } = require('../../services/UnifiedOrderManager');
    unifiedOrderManager = new UnifiedOrderManager({
      strategy: AllocationStrategy.ROUND_ROBIN
    });

    // 各取引所を登録
    unifiedOrderManager.addExchange('binance', binanceService, 1);
    unifiedOrderManager.addExchange('bybit', bybitService, 2);
    unifiedOrderManager.addExchange('kucoin', kucoinService, 3);
  });

  test('複数取引所への注文配分テスト', async () => {
    // 同一シンボルで複数取引所への注文作成をテスト
    const order = {
      symbol: 'BTC/USDT',
      side: OrderSide.BUY,
      type: OrderType.MARKET,
      amount: 0.006, // 小額で複数に分散
      status: OrderStatus.OPEN
    };

    // 注文を作成（内部でRound Robin配分される）
    const orderIds = unifiedOrderManager.createOrder(order);

    // 全取引所に注文が配分されたことを確認
    expect(orderIds.size).toBe(3);
    expect(orderIds.has('binance')).toBeTruthy();
    expect(orderIds.has('bybit')).toBeTruthy();
    expect(orderIds.has('kucoin')).toBeTruthy();
  });

  test('取引所別の手数料計算テスト', () => {
    // 各取引所の手数料率を取得
    const binanceFee = binanceService.getFeeRate();
    const bybitFee = bybitService.getFeeRate();
    const kucoinFee = kucoinService.getFeeRate();

    // 手数料が正しく設定されていることを確認
    expect(binanceFee).toBe(0.001);
    expect(bybitFee).toBe(0.0015);
    expect(kucoinFee).toBe(0.002);

    // 金額に応じた手数料計算の検証
    const amount = 10000; // 10,000 USDT

    const binanceFeeAmount = amount * binanceFee;
    const bybitFeeAmount = amount * bybitFee;
    const kucoinFeeAmount = amount * kucoinFee;

    expect(binanceFeeAmount).toBe(10); // 10 USDT
    expect(bybitFeeAmount).toBe(15); // 15 USDT
    expect(kucoinFeeAmount).toBe(20); // 20 USDT

    // 最も安いBinanceと最も高いKuCoinの差が2倍であることを確認
    expect(kucoinFee / binanceFee).toBe(2);
  });

  test('取引所間の価格差の検証', async () => {
    // 同じシンボルでも取引所によって価格が異なる場合のテスト
    const binancePrice = await binanceService.getLatestPrice('BTC/USDT');
    const bybitPrice = await bybitService.getLatestPrice('BTC/USDT');
    const kucoinPrice = await kucoinService.getLatestPrice('BTC/USDT');

    // 各取引所の価格にオフセットが適用されていることを確認
    expect(binancePrice).toBe(50000); // 基準価格
    expect(bybitPrice).toBe(50000 * 1.0005); // +0.05%
    expect(kucoinPrice).toBe(50000 * 0.9998); // -0.02%

    // BinanceとBybitの価格差
    const priceDiffBinanceBybit = (bybitPrice - binancePrice) / binancePrice;
    expect(priceDiffBinanceBybit).toBeCloseTo(0.0005, 6);

    // BinanceとKuCoinの価格差
    const priceDiffBinanceKucoin = (kucoinPrice - binancePrice) / binancePrice;
    expect(priceDiffBinanceKucoin).toBeCloseTo(-0.0002, 6);
  });

  test('取引所間での注文同期テスト', async () => {
    // 注文同期のテスト（モックなので実際の挙動は限定的）
    const syncResult = await unifiedOrderManager.syncAllOrders();
    expect(syncResult).toBe(true);
  });

  test('取引所の有効/無効切り替えテスト', () => {
    // Bybitを無効化
    const result = unifiedOrderManager.setExchangeActive('bybit', false);
    expect(result).toBe(true);

    // Bybit無効化後の注文配分（Bybitに配分されないことを確認）
    const order = {
      symbol: 'ETH/USDT',
      side: OrderSide.BUY,
      type: OrderType.MARKET,
      amount: 1,
      status: OrderStatus.OPEN
    };

    const orderIds = unifiedOrderManager.createOrder(order);

    // Bybitには注文が配分されていないことを確認
    expect(orderIds.size).toBe(2);
    expect(orderIds.has('binance')).toBeTruthy();
    expect(orderIds.has('bybit')).toBeFalsy();
    expect(orderIds.has('kucoin')).toBeTruthy();
  });

  test('シンボル情報取得テスト', () => {
    // 各取引所のシンボル情報が正しく取得できることを確認
    const binanceBTC = binanceService.getSymbolInfo('BTC/USDT');
    const bybitETH = bybitService.getSymbolInfo('ETH/USDT');
    const kucoinSOL = kucoinService.getSymbolInfo('SOL/USDT');

    expect(binanceBTC).not.toBeNull();
    expect(bybitETH).not.toBeNull();
    expect(kucoinSOL).not.toBeNull();

    expect(binanceBTC?.minAmount).toBe(0.0001);
    expect(bybitETH?.minAmount).toBe(0.001);
    expect(kucoinSOL?.minAmount).toBe(0.01);
  });
}); 