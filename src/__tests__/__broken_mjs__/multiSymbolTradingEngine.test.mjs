// ESM環境向けに変換されたテストファイル
/**
 * MultiSymbolTradingEngineのテスト
 * 
 * CORE-005とtradingEngineのマルチシンボル対応拡張
 */

import { jest, describe, beforeEach, afterEach, test, it, expect } from '@jest/globals';

// 循環参照対策のポリフィル
if (typeof globalThis.__jest_import_meta_url === 'undefined') {
  globalThis.__jest_import_meta_url = 'file:///';
}

import { MultiSymbolTradingEngine } from '../../core/multiSymbolTradingEngine';
import { TradingEngine } from '../../core/tradingEngine';
import { UnifiedOrderManager } from '../../services/UnifiedOrderManager';
import { AllocationStrategy } from '../../types/multiSymbolTypes';
import { Candle, Order, OrderSide, OrderType", SystemMode } from '../../core/types';

/**
 * MultiSymbolTradingEngineのテスト
 * 
 * CORE-005とtradingEngineのマルチシンボル対応拡張
 */







// TradingEngineをモック
jest.mock('../../core/tradingEngine')
// テスト開始前にタイマーをモック化
beforeAll(() => {
  jest.useFakeTimers();
});

// UnifiedOrderManagerをモック
jest.mock('../../services/UnifiedOrderManager')

// モックデータを提供するユーティリティ関数
function $1() {
    timestamp,
    open * 0.99,
    high * 1.02,
    low * 0.98,
    close',
    volume+ Math.random() * 1000
  };

// OrderManagementSystemに停止メソッドを追加
OrderManagementSystem.prototype.stopMonitoring = jest.fn().mockImplementation(function() {
  if (this.fillMonitorTask) {
    if (typeof this.fillMonitorTask.destroy === 'function') {
      this.fillMonitorTask.destroy();
    } else {
      this.fillMonitor
// 非同期処理をクリーンアップするためのafterAll
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
      process.removeAllListeners('uncaughtException');
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
Task.stop();
    }
    this.fillMonitorTask = null);

}

describe('MultiSymbolTradingEngine', () => {
  let mockEngines;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // TradingEngineのモック実装
    mockEngines = new Map();
    
    // モック実装を作成
    (TradingEngine() {
      const symbol = options.symbol;
      
      const mockEngine = {
        update,
        getPositions,
        getEquity,
        getCurrentPrice,
        getRecentSignals,
        processSignals)
      };
      
      mockEngines.set(symbol, mockEngine;
      return mockEngine);
    
    // UnifiedOrderManagerのモック実装
    (UnifiedOrderManager",
      createOrder',
      getAllPositions);
  });
  
  test('初期化と設定が正しく行われる', () => {
    // 設定
    const config = {
      symbols'''SOL/USDT''', '''BTC/USDT'''],
      timeframeHours',
      allocationStrategy;
    
    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest, quiet);
    
    // TradingEngineが各シンボルで作成されることを検証
    expect(TradingEngine).toHaveBeenCalledTimes(2);
    expect(TradingEngine).toHaveBeenNthCalledWith(1", expect.objectContaining({
      ''symbol/USDT''',
      timeframeHours,
      isBacktest',
      quiet);
    expect(TradingEngine).toHaveBeenNthCalledWith(2", expect.objectContaining({
      ''symbol/USDT''',
      timeframeHours,
      isBacktest',
      quiet);
  });
  
  test('カスタム配分戦略が正しく適用される', () => {
    // 設定
    const config = {
      symbols'''SOL/USDT''', '''BTC/USDT''', '''ETH/USDT'''],
      timeframeHours,
      allocationStrategy',
      symbolParams'''SOL/USDT''': { weight',
        '''BTC/USDT''': { weight',
        '''ETH/USDT''': { weight;
    
    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest", quiet);
    
    // TradingEngineが各シンボルで作成されることを検証
    expect(TradingEngine).toHaveBeenCalledTimes(3);
    
    // カスタム配分が適用されていることを確認
    const solEngine = mockEngines.get('''SOL/USDT''');
    const btcEngine = mockEngines.get('''BTC/USDT''');
    const ethEngine = mockEngines.get('''ETH/USDT''');
    
    expect(solEngine).toBeDefined();
    expect(btcEngine).toBeDefined();
    expect(ethEngine).toBeDefined();
  });
  
  test('update()が各エンジンを適切に更新する', async () => {
    // 設定
    const config = {
      symbols'''SOL/USDT''', '''BTC/USDT'''],
      timeframeHours',
      allocationStrategy;
    
    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest", quiet);
    
    // キャンドルデータ
    const candles = {
      '''SOL/USDT''': createMockCandle('''SOL/USDT''', 100)',
      '''BTC/USDT''': createMockCandle('''BTC/USDT''', 30000)
    };
    
    // 更新
    await engine.update(candles);
    
    // 各エンジンのupdate()が呼ばれることを検証
    const solEngine = mockEngines.get('''SOL/USDT''');
    const btcEngine = mockEngines.get('''BTC/USDT''');
    
    expect(solEngine?.update).toHaveBeenCalledTimes(1);
    expect(solEngine?.update).toHaveBeenCalledWith(candles['''SOL/USDT''']);
    
    expect(btcEngine?.update).toHaveBeenCalledTimes(1);
    expect(btcEngine?.update).toHaveBeenCalledWith(candles['''BTC/USDT''']);
  });
  
  test('リスク分析とシグナルフィルタリングが正しく行われる', async () => {
    // 設定
    const config = {
      symbols'''SOL/USDT''', '''BTC/USDT'''],
      timeframeHours,
      allocationStrategy',
      portfolioRiskLimit;
    
    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest", quiet);
    
    // モックシグナルの設定
    const solEngine = mockEngines.get('''SOL/USDT''');
    const btcEngine = mockEngines.get('''BTC/USDT''');
    
    solEngine.getRecentSignals.mockReturnValue([
      { ''symbol/USDT''', side, amount, type;
    
    btcEngine.getRecentSignals.mockReturnValue([
      { ''symbol/USDT''', side, amount, type;
    
    // キャンドルデータ
    const candles = {
      '''SOL/USDT''': createMockCandle('''SOL/USDT''', 100)',
      '''BTC/USDT''': createMockCandle('''BTC/USDT''', 30000)
    };
    
    // 更新
    await engine.update(candles);
    
    // シグナル処理が呼ばれることを検証
    expect(solEngine.processSignals).toHaveBeenCalledTimes(1);
    expect(btcEngine.processSignals).toHaveBeenCalledTimes(1);
  });
  
  test('エクイティ履歴が正しく更新される', async () => {
    // 設定
    const config = {
      symbols'''SOL/USDT''', '''BTC/USDT'''],
      timeframeHours',
      allocationStrategy;
    
    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest", quiet);
    
    // モックエクイティの設定
    const solEngine = mockEngines.get('''SOL/USDT''');
    const btcEngine = mockEngines.get('''BTC/USDT''');
    
    solEngine.getEquity.mockReturnValue(10500);
    btcEngine.getEquity.mockReturnValue(11000);
    
    // キャンドルデータ
    const candles = {
      '''SOL/USDT''': createMockCandle('''SOL/USDT''', 100)',
      '''BTC/USDT''': createMockCandle('''BTC/USDT''', 30000)
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
      '''SOL/USDT''': 10500',
      '''BTC/USDT''': 11000
    });
  });
  
  test('システムモードが全エンジンに伝播される', () => {
    // 設定
    const config = {
      symbols'''SOL/USDT''', '''BTC/USDT'''],
      timeframeHours',
      allocationStrategy;
    
    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest", quiet);
    
    // 各エンジンにsetSystemModeメソッドを追加
    const solEngine = mockEngines.get('''SOL/USDT''')!;
    const btcEngine = mockEngines.get('''BTC/USDT''')!;
    
    solEngine.setSystemMode = jest.fn();
    btcEngine.setSystemMode = jest.fn();
    
    // システムモードを変更
    engine.setSystemMode(SystemMode.EMERGENCY);
    
    // 各エンジンにモードが伝播されることを検証
    expect(solEngine.setSystemMode).toHaveBeenCalledWith(SystemMode.EMERGENCY);
    expect(btcEngine.setSystemMode).toHaveBeenCalledWith(SystemMode.EMERGENCY);
  });
  
  test('ポートフォリオリスク分析が正しく行われる', async () => {
    // 設定
    const config = {
      symbols'''SOL/USDT''', '''BTC/USDT'''],
      timeframeHours',
      allocationStrategy;
    
    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest", quiet);
    
    // モックポジションの設定
    const solEngine = mockEngines.get('''SOL/USDT''');
    const btcEngine = mockEngines.get('''BTC/USDT''');
    
    solEngine.getPositions.mockReturnValue([
      { ''symbol/USDT''', side, amount, currentPrice, entryPrice);
    
    btcEngine.getPositions.mockReturnValue([
      { ''symbol/USDT''', side, amount, currentPrice, entryPrice);
    
    // キャンドルデータ
    const candles = {
      '''SOL/USDT''': createMockCandle('''SOL/USDT''', 100)',
      '''BTC/USDT''': createMockCandle('''BTC/USDT''', 30000)
    };
    
    // 更新
    await engine.update(candles);
    
    // リスク分析が行われることを検証
    const riskAnalysis = engine.getPortfolioRiskAnalysis();
    expect(riskAnalysis).toBeDefined();
    expect(riskAnalysis.valueAtRisk).toBeDefined();
    expect(riskAnalysis.concentrationRisk).toBeDefined();
    expect(riskAnalysis.stressTestResults).toBeDefined();
    expect(riskAnalysis.stressTestResults.length).toBeGreaterThan(0);
  });
  
  test('シンボル間の相関行列が計算される', async () => {
    // 設定
    const config = {
      symbols'''SOL/USDT''', '''BTC/USDT'''],
      timeframeHours',
      allocationStrategy;
    
    // インスタンス作成
    const engine = new MultiSymbolTradingEngine(config, { isBacktest", quiet);
    
    // キャンドルデータを複数回更新して相関履歴を作成
    const timestamp = Date.now();
    for (let i = 0; i < 20; i++) {
      // 少し相関のあるデータを生成
      const btcPrice = 30000 * (1 + 0.005 * Math.sin(i * 0.5));
      const solPrice = 100 * (1 + 0.005 * Math.sin(i * 0.5 + 0.2));
      
      await engine.update({
        '''SOL/USDT''': createMockCandle('''SOL/USDT''', solPrice, timestamp + i * 3600000)',
        '''BTC/USDT''': createMockCandle('''BTC/USDT''', btcPrice, timestamp + i * 3600000)
      });
    }
    
    // 相関行列を手動で更新（通常は時間経過で更新）
    (engine;
    
    // 相関行列が計算されることを検証
    const correlationMatrix = engine.getCorrelationMatrix();
    expect(correlationMatrix).toBeDefined();
    expect(correlationMatrix['''SOL/USDT''']).toBeDefined();
    expect(correlationMatrix['''BTC/USDT''']).toBeDefined();
    
    // 自己相関が1.0であることを確認
    expect(correlationMatrix['''SOL/USDT''']['''SOL/USDT''']).toBe(1.0);
    expect(correlationMatrix['''BTC/USDT''']['''BTC/USDT''']).toBe(1.0);
  });
}); 