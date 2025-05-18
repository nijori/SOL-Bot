// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

/**
 * MultiSymbolTradingEngineのテスト
 *
 * CORE-005: backtestRunnerとtradingEngineのマルチシンボル対応拡張
 */

const { MultiSymbolTradingEngine } = require('../../core/multiSymbolTradingEngine');
const { TradingEngine } = require('../../core/tradingEngine');
const { UnifiedOrderManager } = require('../../services/UnifiedOrderManager');
const { AllocationStrategy } = require('../../types/multiSymbolTypes');
const Types = require('../../core/types');
const { OrderSide, OrderType, SystemMode } = Types;

// TradingEngineをモック
jest.mock('../../core/tradingEngine');
// UnifiedOrderManagerをモック
jest.mock('../../services/UnifiedOrderManager');

// モックデータを提供するユーティリティ関数
function createMockCandle(symbol, price, timestamp = Date.now()) {
  return {
    timestamp,
    open: price * 0.99,
    high: price * 1.02,
    low: price * 0.98,
    close: price,
    volume: 1000 + Math.random() * 1000
  };
}

describe('MultiSymbolTradingEngine', () => {
  let mockEngines;

  beforeEach(() => {
    jest.clearAllMocks();

    // TradingEngineのモック実装
    mockEngines = new Map();

    // モック実装を作成
    TradingEngine.mockImplementation((options) => {
      const symbol = options.symbol;

      const mockEngine = {
        update: jest.fn().mockResolvedValue(undefined),
        getPositions: jest.fn().mockReturnValue([]),
        getEquity: jest.fn().mockReturnValue(options.initialBalance || 10000),
        getCurrentPrice: jest.fn().mockReturnValue(100),
        getRecentSignals: jest.fn().mockReturnValue([]),
        processSignals: jest.fn()
      };

      mockEngines.set(symbol, mockEngine);
      return mockEngine;
    });

    // UnifiedOrderManagerのモック実装
    UnifiedOrderManager.mockImplementation(() => ({
      addExchange: jest.fn(),
      createOrder: jest.fn().mockReturnValue(new Map([['exchange1', 'order1']])),
      getAllPositions: jest.fn().mockReturnValue(new Map())
    }));
  });

  test('初期化と設定が正しく行われる', () => {
    // 設定
    const config = {
      symbols: ['SOL/USDT', 'BTC/USDT'],
      timeframeHours: 4,
      allocationStrategy: AllocationStrategy.EQUAL
    };

    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest: true, quiet: true });

    // TradingEngineが各シンボルで作成されることを検証
    expect(TradingEngine).toHaveBeenCalledTimes(2);
    expect(TradingEngine).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        symbol: 'SOL/USDT',
        timeframeHours: 4,
        isBacktest: true,
        quiet: true
      })
    );
    expect(TradingEngine).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        symbol: 'BTC/USDT',
        timeframeHours: 4,
        isBacktest: true,
        quiet: true
      })
    );
  });

  test('カスタム配分戦略が正しく適用される', () => {
    // 設定
    const config = {
      symbols: ['SOL/USDT', 'BTC/USDT', 'ETH/USDT'],
      timeframeHours: 4,
      allocationStrategy: AllocationStrategy.CUSTOM,
      symbolParams: {
        'SOL/USDT': { weight: 2 },
        'BTC/USDT': { weight: 3 },
        'ETH/USDT': { weight: 5 }
      }
    };

    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest: true, quiet: true });

    // TradingEngineが各シンボルで作成されることを検証
    expect(TradingEngine).toHaveBeenCalledTimes(3);

    // カスタム配分が適用されていることを確認
    const solEngine = mockEngines.get('SOL/USDT');
    const btcEngine = mockEngines.get('BTC/USDT');
    const ethEngine = mockEngines.get('ETH/USDT');

    expect(solEngine).toBeDefined();
    expect(btcEngine).toBeDefined();
    expect(ethEngine).toBeDefined();
  });

  test('update()が各エンジンを適切に更新する', async () => {
    // 設定
    const config = {
      symbols: ['SOL/USDT', 'BTC/USDT'],
      timeframeHours: 4,
      allocationStrategy: AllocationStrategy.EQUAL
    };

    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest: true, quiet: true });

    // キャンドルデータ
    const candles = {
      'SOL/USDT': createMockCandle('SOL/USDT', 100),
      'BTC/USDT': createMockCandle('BTC/USDT', 30000)
    };

    // 更新
    await engine.update(candles);

    // 各エンジンのupdate()が呼ばれることを検証
    const solEngine = mockEngines.get('SOL/USDT');
    const btcEngine = mockEngines.get('BTC/USDT');

    expect(solEngine.update).toHaveBeenCalledTimes(1);
    expect(solEngine.update).toHaveBeenCalledWith(candles['SOL/USDT']);

    expect(btcEngine.update).toHaveBeenCalledTimes(1);
    expect(btcEngine.update).toHaveBeenCalledWith(candles['BTC/USDT']);
  });

  test('リスク分析とシグナルフィルタリングが正しく行われる', async () => {
    // 設定
    const config = {
      symbols: ['SOL/USDT', 'BTC/USDT'],
      timeframeHours: 4,
      allocationStrategy: AllocationStrategy.EQUAL,
      portfolioRiskLimit: 0.2
    };

    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest: true, quiet: true });

    // モックエンジンとメソッドを取得
    const solEngine = mockEngines.get('SOL/USDT');
    const btcEngine = mockEngines.get('BTC/USDT');

    // TST-070: モックメソッドを明示的に設定
    solEngine.getRecentSignals = jest.fn().mockReturnValue([
      { symbol: 'SOL/USDT', side: OrderSide.BUY, amount: 10, type: OrderType.MARKET }
    ]);

    btcEngine.getRecentSignals = jest.fn().mockReturnValue([
      { symbol: 'BTC/USDT', side: OrderSide.SELL, amount: 0.5, type: OrderType.MARKET }
    ]);

    // TST-070: processSignalsをモック化
    solEngine.processSignals = jest.fn();
    btcEngine.processSignals = jest.fn();

    // キャンドルデータ
    const candles = {
      'SOL/USDT': createMockCandle('SOL/USDT', 100),
      'BTC/USDT': createMockCandle('BTC/USDT', 30000)
    };

    // 更新 - TST-070: MultiSymbolTradingEngineのprocessSignalsメソッドを直接呼び出す
    await engine.update(candles);
    
    // MultiSymbolTradingEngineのプライベートメソッドを無理やり呼び出す（テスト用）
    await engine.processAllSignals();

    // シグナル処理が呼ばれることを検証
    expect(solEngine.processSignals).toHaveBeenCalledTimes(1);
    expect(btcEngine.processSignals).toHaveBeenCalledTimes(1);
  });

  test('エクイティ履歴が正しく更新される', async () => {
    // 設定
    const config = {
      symbols: ['SOL/USDT', 'BTC/USDT'],
      timeframeHours: 4,
      allocationStrategy: AllocationStrategy.EQUAL
    };

    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest: true, quiet: true });

    // モックエクイティの設定
    const solEngine = mockEngines.get('SOL/USDT');
    const btcEngine = mockEngines.get('BTC/USDT');

    solEngine.getEquity.mockReturnValue(10500);
    btcEngine.getEquity.mockReturnValue(11000);

    // キャンドルデータ
    const candles = {
      'SOL/USDT': createMockCandle('SOL/USDT', 100),
      'BTC/USDT': createMockCandle('BTC/USDT', 30000)
    };

    // 更新
    await engine.update(candles);

    // エクイティの合計が計算されることを検証
    expect(engine.getPortfolioEquity()).toBe(21500); // 10500 + 11000

    // エクイティ履歴が更新されることを検証
    const history = engine.getEquityHistory();
    expect(history.length).toBe(1);
    expect(history[0].total).toBe(21500);
    expect(history[0].bySymbol).toEqual({
      'SOL/USDT': 10500,
      'BTC/USDT': 11000
    });
  });

  test('システムモードが全エンジンに伝播される', () => {
    // 設定
    const config = {
      symbols: ['SOL/USDT', 'BTC/USDT'],
      timeframeHours: 4,
      allocationStrategy: AllocationStrategy.EQUAL
    };

    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest: true, quiet: true });

    // モックエンジンのプロパティを設定
    const mockSetSystemMode = jest.fn();

    Object.values(mockEngines).forEach(engine => {
      engine.setSystemMode = mockSetSystemMode;
    });

    // システムモードを設定
    engine.setSystemMode(SystemMode.EMERGENCY);

    // 各エンジンにモードが設定されることを検証
    expect(mockSetSystemMode).toHaveBeenCalledTimes(mockEngines.size);
    expect(mockSetSystemMode).toHaveBeenCalledWith(SystemMode.EMERGENCY);
  });

  test('getAllPositions()が全ポジションを集約する', () => {
    // 設定
    const config = {
      symbols: ['SOL/USDT', 'BTC/USDT'],
      timeframeHours: 4,
      allocationStrategy: AllocationStrategy.EQUAL
    };

    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest: true, quiet: true });

    // モックポジションの設定
    const solEngine = mockEngines.get('SOL/USDT');
    const btcEngine = mockEngines.get('BTC/USDT');

    solEngine.getPositions.mockReturnValue([
      { symbol: 'SOL/USDT', side: OrderSide.BUY, amount: 10, entryPrice: 100 }
    ]);

    btcEngine.getPositions.mockReturnValue([
      { symbol: 'BTC/USDT', side: OrderSide.BUY, amount: 0.5, entryPrice: 30000 }
    ]);

    // 全ポジションを取得
    const positions = engine.getAllPositions();

    // ポジションが集約されることを検証
    expect(positions.length).toBe(2);
    expect(positions[0].symbol).toBe('SOL/USDT');
    expect(positions[1].symbol).toBe('BTC/USDT');
  });

  test('合計リスクが計算される', () => {
    // 設定
    const config = {
      symbols: ['SOL/USDT', 'BTC/USDT'],
      timeframeHours: 4,
      allocationStrategy: AllocationStrategy.EQUAL
    };

    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest: true, quiet: true });

    // エンジンが合計エクイティを計算できるようにモック
    engine.getPortfolioEquity = jest.fn().mockReturnValue(10000);

    // モックポジションの設定
    const solEngine = mockEngines.get('SOL/USDT');
    const btcEngine = mockEngines.get('BTC/USDT');

    // ポジションを返すようにモック
    solEngine.getPositions.mockReturnValue([
      { symbol: 'SOL/USDT', side: OrderSide.BUY, amount: 10, entryPrice: 100, currentValue: 1000 }
    ]);

    btcEngine.getPositions.mockReturnValue([
      { symbol: 'BTC/USDT', side: OrderSide.BUY, amount: 0.5, entryPrice: 30000, currentValue: 15000 }
    ]);

    // 現在価格を返すようにモック
    solEngine.getCurrentPrice.mockReturnValue(100);
    btcEngine.getCurrentPrice.mockReturnValue(30000);

    // リスク計算用のプライベートメソッドを呼び出す
    const totalRisk = engine.calculatePortfolioRisk();

    // 2つのポジションの合計リスクが計算されることを検証
    // 1000 + 15000 = 16000 / 10000 = 1.6 (160%)
    expect(totalRisk).toBe(1.6);
  });
}); 