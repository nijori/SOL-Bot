import { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

/**
 * MultiSymbolBacktestRunnerのテスト
 *
 * CORE-005: backtestRunnerとtradingEngineのマルチシンボル対応拡張
 */

import { MultiSymbolBacktestRunner } from '../../core/multiSymbolBacktestRunner';
import { AllocationStrategy, MultiSymbolBacktestConfig } from '../../types/multiSymbolTypes';
import { BacktestRunner } from '../../core/backtestRunner';
import { Candle } from '../../core/types';

// BacktestRunnerをモック
jest.mock('../../core/backtestRunner.js');

// モックデータを提供するユーティリティ関数
function createMockCandles(
  symbol: string,
  count: number,
  startPrice: number,
  trend: 'up' | 'down' | 'flat'
): Candle[] {
  const candles: Candle[] = [];
  let currentPrice = startPrice;

  for (let i = 0; i < count; i++) {
    // トレンドに応じて価格を変動
    if (trend === 'up') {
      currentPrice *= 1.01; // 1%上昇
    } else if (trend === 'down') {
      currentPrice *= 0.99; // 1%下落
    }

    const timestamp = new Date(2023, 0, 1, 0, i).getTime();

    candles.push({
      timestamp,
      open: currentPrice * 0.99,
      high: currentPrice * 1.02,
      low: currentPrice * 0.98,
      close: currentPrice,
      volume: 1000 + Math.random() * 1000
    });
  }

  return candles;
}

describe('MultiSymbolBacktestRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // BacktestRunnerのモック実装
    (BacktestRunner as jest.Mock).mockImplementation(() => ({
      run: jest.fn().mockImplementation(async () => ({
        metrics: {
          totalReturn: 10.5,
          sharpeRatio: 1.2,
          maxDrawdown: 0.15,
          winRate: 0.6,
          profitFactor: 1.8,
          calmarRatio: 0.7,
          sortinoRatio: 1.5
        },
        trades: [
          { id: 'trade1', symbol: 'SOL/USDT', side: 'buy', price: 100, amount: 1, pnl: 10 },
          { id: 'trade2', symbol: 'SOL/USDT', side: 'sell', price: 110, amount: 1, pnl: -5 }
        ],
        equity: [
          { timestamp: new Date(2023, 0, 1).toISOString(), equity: 10000 },
          { timestamp: new Date(2023, 0, 2).toISOString(), equity: 10100 },
          { timestamp: new Date(2023, 0, 3).toISOString(), equity: 10050 }
        ],
        parameters: {}
      }))
    }));
  });

  test('初期化と設定が正しく行われる', () => {
    // 設定
    const config: MultiSymbolBacktestConfig = {
      symbols: ['SOL/USDT', 'BTC/USDT'],
      timeframeHours: 4,
      startDate: '2023-01-01',
      endDate: '2023-05-01',
      initialBalance: 10000,
      allocationStrategy: AllocationStrategy.EQUAL,
      quiet: true
    };

    // インスタンス作成
    const runner = new MultiSymbolBacktestRunner(config);

    // BacktestRunnerが各シンボルで作成されることを検証
    expect(BacktestRunner).toHaveBeenCalledTimes(2);
    expect(BacktestRunner).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        symbol: 'SOL/USDT',
        initialBalance: 5000, // 均等配分で半分
        quiet: true
      })
    );
    expect(BacktestRunner).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        symbol: 'BTC/USDT',
        initialBalance: 5000, // 均等配分で半分
        quiet: true
      })
    );
  });

  test('カスタム配分戦略が正しく適用される', () => {
    // 設定
    const config: MultiSymbolBacktestConfig = {
      symbols: ['SOL/USDT', 'BTC/USDT', 'ETH/USDT'],
      timeframeHours: 4,
      startDate: '2023-01-01',
      endDate: '2023-05-01',
      initialBalance: 10000,
      allocationStrategy: AllocationStrategy.CUSTOM,
      symbolParams: {
        'SOL/USDT': {
          parameters: { weight: 2 }
        },
        'BTC/USDT': {
          parameters: { weight: 3 }
        },
        'ETH/USDT': {
          parameters: { weight: 5 }
        }
      },
      quiet: true
    };

    // インスタンス作成
    const runner = new MultiSymbolBacktestRunner(config);

    // BacktestRunnerが各シンボルで作成されることを検証
    expect(BacktestRunner).toHaveBeenCalledTimes(3);

    // カスタム配分が適用されていることを確認（合計ウェイト10に対する比率）
    expect(BacktestRunner).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        symbol: 'SOL/USDT',
        initialBalance: 2000 // 2/10 = 20%
      })
    );
    expect(BacktestRunner).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        symbol: 'BTC/USDT',
        initialBalance: 3000 // 3/10 = 30%
      })
    );
    expect(BacktestRunner).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        symbol: 'ETH/USDT',
        initialBalance: 5000 // 5/10 = 50%
      })
    );
  });

  test('マルチシンボルバックテストを実行してポートフォリオメトリクスを計算する', async () => {
    // 設定
    const config: MultiSymbolBacktestConfig = {
      symbols: ['SOL/USDT', 'BTC/USDT'],
      timeframeHours: 4,
      startDate: '2023-01-01',
      endDate: '2023-05-01',
      initialBalance: 10000,
      allocationStrategy: AllocationStrategy.EQUAL,
      quiet: true
    };

    // インスタンス作成
    const runner = new MultiSymbolBacktestRunner(config);

    // バックテスト実行
    const result = await runner.run();

    // 結果の検証
    expect(result).toBeDefined();
    expect(result.symbolResults).toBeDefined();
    expect(Object.keys(result.symbolResults)).toHaveLength(2);
    expect(result.symbolResults['SOL/USDT']).toBeDefined();
    expect(result.symbolResults['BTC/USDT']).toBeDefined();

    // ポートフォリオメトリクスが計算されていることを確認
    expect(result.portfolioMetrics).toBeDefined();
    expect(result.portfolioMetrics.totalReturn).toBeDefined();
    expect(result.portfolioMetrics.sharpeRatio).toBeDefined();
    expect(result.portfolioMetrics.maxDrawdown).toBeDefined();

    // エクイティ履歴が結合されていることを確認
    expect(result.equity).toBeDefined();
    expect(result.equity.length).toBeGreaterThan(0);
    expect(result.equity[0].symbolEquity).toBeDefined();
    expect(Object.keys(result.equity[0].symbolEquity)).toHaveLength(2);
  });

  test('相関分析が正しく行われる', async () => {
    // 設定
    const config: MultiSymbolBacktestConfig = {
      symbols: ['SOL/USDT', 'BTC/USDT', 'ETH/USDT'],
      timeframeHours: 4,
      startDate: '2023-01-01',
      endDate: '2023-05-01',
      initialBalance: 10000,
      allocationStrategy: AllocationStrategy.EQUAL,
      correlationAnalysis: true,
      quiet: true
    };

    // インスタンス作成
    const runner = new MultiSymbolBacktestRunner(config);

    // バックテスト実行
    const result = await runner.run();

    // 相関行列が計算されていることを確認
    expect(result.portfolioMetrics.correlationMatrix).toBeDefined();
    expect(result.portfolioMetrics.correlationMatrix!['SOL/USDT']).toBeDefined();
    expect(result.portfolioMetrics.correlationMatrix!['BTC/USDT']).toBeDefined();
    expect(result.portfolioMetrics.correlationMatrix!['ETH/USDT']).toBeDefined();

    // 自己相関が1.0であることを確認
    expect(result.portfolioMetrics.correlationMatrix!['SOL/USDT']['SOL/USDT']).toBe(1.0);
    expect(result.portfolioMetrics.correlationMatrix!['BTC/USDT']['BTC/USDT']).toBe(1.0);
    expect(result.portfolioMetrics.correlationMatrix!['ETH/USDT']['ETH/USDT']).toBe(1.0);
  });

  test('シンボル固有のパラメータが正しく適用される', () => {
    // 設定
    const config: MultiSymbolBacktestConfig = {
      symbols: ['SOL/USDT', 'BTC/USDT'],
      timeframeHours: 4,
      startDate: '2023-01-01',
      endDate: '2023-05-01',
      initialBalance: 10000,
      allocationStrategy: AllocationStrategy.EQUAL,
      slippage: 0.001,
      commissionRate: 0.001,
      symbolParams: {
        'SOL/USDT': {
          slippage: 0.002,
          commissionRate: 0.0015,
          parameters: {
            stopLoss: 0.05
          }
        },
        'BTC/USDT': {
          slippage: 0.0005,
          parameters: {
            stopLoss: 0.03
          }
        }
      },
      quiet: true
    };

    // インスタンス作成
    const runner = new MultiSymbolBacktestRunner(config);

    // BacktestRunnerが各シンボルで正しいパラメータで作成されることを検証
    expect(BacktestRunner).toHaveBeenCalledTimes(2);

    // SOL/USDTの設定
    expect(BacktestRunner).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        symbol: 'SOL/USDT',
        slippage: 0.002,
        commissionRate: 0.0015,
        parameters: expect.objectContaining({
          stopLoss: 0.05
        })
      })
    );

    // BTC/USDTの設定
    expect(BacktestRunner).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        symbol: 'BTC/USDT',
        slippage: 0.0005,
        commissionRate: 0.001, // デフォルト値が使用される
        parameters: expect.objectContaining({
          stopLoss: 0.03
        })
      })
    );
  });

  test('複数のタイムフレームが正しく処理される', () => {
    // 設定（複数タイムフレーム）
    const config: MultiSymbolBacktestConfig = {
      symbols: ['SOL/USDT', 'BTC/USDT'],
      timeframeHours: [1, 4, 24], // 複数タイムフレーム
      startDate: '2023-01-01',
      endDate: '2023-05-01',
      initialBalance: 10000,
      allocationStrategy: AllocationStrategy.EQUAL,
      quiet: true
    };

    // インスタンス作成
    const runner = new MultiSymbolBacktestRunner(config);

    // 最初のタイムフレームが使用されることを検証
    expect(BacktestRunner).toHaveBeenCalledTimes(2);
    expect(BacktestRunner).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        symbol: 'SOL/USDT',
        timeframeHours: 1 // 配列の最初のタイムフレームが使用される
      })
    );
    expect(BacktestRunner).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        symbol: 'BTC/USDT',
        timeframeHours: 1 // 配列の最初のタイムフレームが使用される
      })
    );
  });
});
