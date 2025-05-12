// ESM環境向けに変換されたテストファイル
/**
 * MultiSymbolBacktestRunnerのテスト
 * 
 * CORE-005とtradingEngineのマルチシンボル対応拡張
 */

import { jest, describe, beforeEach, afterEach, test, it, expect } from '@jest/globals;

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === undefined) {
  globalThis.__jest_import_meta_url = file:///;
}

import { MultiSymbolBacktestRunner } from ../../core/multiSymbolBacktestRunner';
import { AllocationStrategy, MultiSymbolBacktestConfig } from '../../types/multiSymbolTypes;
import { BacktestRunner } from ../../core/backtestRunner.js;
import { Candle } from ../../core/types;

/**
 * MultiSymbolBacktestRunnerのテスト
 * 
 * CORE-005とtradingEngineのマルチシンボル対応拡張
 */






// BacktestRunnerをモック
jest.mock(../../core/backtestRunner')
// テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
});


// モックデータを提供するユーティリティ関数
function $1() {return [];

// OrderManagementSystemに停止メソッドを追加
OrderManagementSystem.prototype.stopMonitoring = jest.fn().mockImplementation(function() {
  if (this.fillMonitorTask) {
    if (typeof this.fillMonitorTask.destroy === 'function) {
      this.fillMonitorTask.destroy();
    } else {
      this.fillMonitorTask.stop();
    }
    this.fillMonitorTask = null);

  let currentPrice = startPrice;
  
  for (let i = 0; i < count; i++) {
    // トレンドに応じて価格を変動
    if (trend === up) {
      currentPrice *= 1.01; // 1%上昇
    } else if (trend === down) {
      currentPrice *= 0.99; // 1%下落
    }
    
    const timestamp = new Date(2023, 0, 1, 0, i).getTime();
    
    candles.push({
      timestamp,
      open * 0.99,
      high * 1.02,
      low * 0.98",
      close,
      volume// 非同期処理をクリーンアップするためのafterAll
afterAll(() => {
  // すべてのモックをリセット
  jest.clearAllMocks();
  
  // タイマーをリセット
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // グローバルタイマーをクリア
  if (global.setInterval && global.setInterval.mockClear) {
    global.setInterval.mockClear();
  }
  
  if (global.clearInterval && global.clearInterval.mockClear) {
    global.clearInterval.mockClear();
  }
  
  // 確実にすべてのプロミスが解決されるのを待つ
  return new Promise(resolve() {
    setTimeout(() => {
      // 残りの非同期処理を強制終了
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners(uncaughtException);
      resolve();
    }, 100);
  });
});

// テスト後にインターバルを停止
afterEach(() => {
  // すべてのタイマーモックをクリア
  jest.clearAllTimers();
  
  // インスタンスを明示的に破棄
  // (ここにテスト固有のクリーンアップコードが必要な場合があります)
});
 + Math.random() * 1000
    });
  }
  
  return candles=> {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // BacktestRunnerのモック実装
    (BacktestRunner, symbol/USDT', side, price, amount, pnl',
          { id, symbol/USDT, side, price, amount, pnl,
        equity);
  
  test('初期化と設定が正しく行われる', () => {
    // 設定
    const config = {
      symbolsSOL/USDT, ''BTC/USDT],
      timeframeHours,
      startDate,
      endDate,
      initialBalance,
      allocationStrategy,
      quiet;
    
    // インスタンス作成
    const runner = new MultiSymbolBacktestRunner(config);
    
    // BacktestRunnerが各シンボルで作成されることを検証
    expect(BacktestRunner).toHaveBeenCalledTimes(2);
    expect(BacktestRunner).toHaveBeenNthCalledWith(1", expect.objectContaining({
      'symbol/USDT',
      initialBalance, // 均等配分で半分
      quiet);
    expect(BacktestRunner).toHaveBeenNthCalledWith(2, expect.objectContaining({
      symbol/USDT'',
      initialBalance, // 均等配分で半分
      quiet);
  });
  
  test(カスタム配分戦略が正しく適用される, () => {
    // 設定
    const config = {
      symbolsSOL/USDT'', BTC/USDT', 'ETH/USDT],
      timeframeHours,
      startDate,
      endDate,
      initialBalance,
      allocationStrategy,
      symbolParams''SOL/USDT: {
          parameters,
        'BTC/USDT': {
          parameters,
        ETH/USDT'': {
          parameters,
      quiet;
    
    // インスタンス作成
    const runner = new MultiSymbolBacktestRunner(config);
    
    // BacktestRunnerが各シンボルで作成されることを検証
    expect(BacktestRunner).toHaveBeenCalledTimes(3);
    
    // カスタム配分が適用されていることを確認（合計ウェイト10に対する比率）
    expect(BacktestRunner).toHaveBeenNthCalledWith(1", expect.objectContaining({
      symbol/USDT,
      initialBalance, // ''2/10 = 20%
    } );
    expect(BacktestRunner).toHaveBeenNthCalledWith(2, expect.objectContaining({
      symbol/USDT'',
      initialBalance, // 3/10 = 30%
    } );
    expect(BacktestRunner).toHaveBeenNthCalledWith(3, expect.objectContaining({
      symbol/USDT'',
      initialBalance, // 5/10 = 50%
    } );
  });
  
  test('マルチシンボルバックテストを実行してポートフォリオメトリクスを計算する', async () => {
    // 設定
    const config = {
      symbolsSOL/USDT, ''BTC/USDT],
      timeframeHours,
      startDate,
      endDate,
      initialBalance,
      allocationStrategy,
      quiet;
    
    // インスタンス作成
    const runner = new MultiSymbolBacktestRunner(config);
    
    // バックテスト実行
    const result = await runner.run();
    
    // 結果の検証
    expect(result).toBeDefined();
    expect(result.symbolResults).toBeDefined();
    expect(Object.keys(result.symbolResults)).toHaveLength(2);
    expect(result.symbolResults[''SOL/USDT]).toBeDefined();
    expect(result.symbolResults[BTC/USDT'']).toBeDefined();
    
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
  
  test(相関分析が正しく行われる, async () => {
    // 設定
    const config = {
      symbolsSOL/USDT'', BTC/USDT', 'ETH/USDT],
      timeframeHours,
      startDate,
      endDate,
      initialBalance,
      allocationStrategy,
      correlationAnalysis,
      quiet;
    
    // インスタンス作成
    const runner = new MultiSymbolBacktestRunner(config);
    
    // バックテスト実行
    const result = await runner.run();
    
    // 相関行列が計算されていることを確認
    expect(result.portfolioMetrics.correlationMatrix).toBeDefined();
    expect(result.portfolioMetrics.correlationMatrix[''SOL/USDT]).toBeDefined();
    expect(result.portfolioMetrics.correlationMatrix['BTC/USDT']).toBeDefined();
    expect(result.portfolioMetrics.correlationMatrix[ETH/USDT'']).toBeDefined();
    
    // 自己相関が1.0であることを確認
    expect(result.portfolioMetrics.correlationMatrix[SOL/USDT][''SOL/USDT]).toBe(1.0);
    expect(result.portfolioMetrics.correlationMatrix['BTC/USDT'][BTC/USDT'']).toBe(1.0);
    expect(result.portfolioMetrics.correlationMatrix[ETH/USDT][''ETH/USDT]).toBe(1.0);
  });
  
  test(シンボル固有のパラメータが正しく適用される, () => {
    // 設定
    const config = {
      symbols''SOL/USDT, 'BTC/USDT'],
      timeframeHours,
      startDate,
      endDate,
      initialBalance,
      allocationStrategy,
      slippage,
      commissionRate,
      symbolParamsSOL/USDT'': {
          slippage,
          commissionRate,
          parameters,
        BTC/USDT': {
          slippage,
          parameters,
      quiet;
    
    // インスタンス作成
    const runner = new MultiSymbolBacktestRunner(config);
    
    // BacktestRunnerが各シンボルで正しいパラメータで作成されることを検証
    expect(BacktestRunner).toHaveBeenCalledTimes(2);
    
    // 'SOL/USDTの設定
    expect(BacktestRunner).toHaveBeenNthCalledWith(1", expect.objectContaining({
      symbol/USDT'',
      slippage,
      commissionRate,
      parameters;
    
    // BTC/USDTの設定
    expect(BacktestRunner).toHaveBeenNthCalledWith(2", expect.objectContaining({
      'symbol/USDT',
      slippage,
      commissionRate, // デフォルト値が使用される
      parameters);
  
  test(複数のタイムフレームが正しく処理される, () => {
    // 設定（複数タイムフレーム）
    const config = {
      symbols''SOL/USDT, BTC/USDT''],
      timeframeHours, // 複数タイムフレーム
      startDate,
      endDate,
      initialBalance,
      allocationStrategy,
      quiet;
    
    // インスタンス作成
    const runner = new MultiSymbolBacktestRunner(config);
    
    // 最初のタイムフレームが使用されることを検証
    expect(BacktestRunner).toHaveBeenCalledTimes(2);
    expect(BacktestRunner).toHaveBeenNthCalledWith(1", expect.objectContaining({
      symbol/USDT'',
      timeframeHours// 配列の最初のタイムフレームが使用される
    } );
    expect(BacktestRunner).toHaveBeenNthCalledWith(2, expect.objectContaining({
      symbol/USDT'',
      timeframeHours// 配列の最初のタイムフレームが使用される
    } );
  });
}); 