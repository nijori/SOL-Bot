/**
 * 戦略モジュール用モックファクトリー関数（CommonJS版）
 * TST-055: モジュールモックの一貫性向上
 * 
 * 一貫性のあるモックパターンを提供します。
 * このファイルはCommonJS環境で使用するためのものです。
 */

/**
 * 基本戦略モックを作成するファクトリー関数
 * @param {string} strategy - モックする戦略名
 * @param {function} [executeImpl] - executeメソッドの実装
 * @returns {jest.Mock} - 設定済みのjest.mockオブジェクト
 */
function createStrategyMock(strategy, executeImpl = null) {
  const defaultImpl = (candles, positions, accountBalance) => {
    // データ不足のケース
    if (candles.length < 20) {
      return [];
    }
    
    // ポジションがある場合は何もしない
    if (positions.length > 0) {
      return [];
    }
    
    // 基本的なシグナルを返す
    return [{
      symbol: 'TEST/USDT',
      type: 'market',
      side: 'buy',
      amount: accountBalance * 0.01 / candles[candles.length - 1].close,
      timestamp: Date.now()
    }];
  };
  
  // カスタム実装か基本実装を使用
  const mockImpl = executeImpl || defaultImpl;
  
  // モックオブジェクトを作成
  const strategyMock = jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockImplementation(mockImpl)
  }));
  
  return strategyMock;
}

/**
 * MeanReversionStrategyモックを作成
 * @param {function} [customImpl] - カスタム実装（オプション）
 * @returns {jest.Mock} - 設定済みのモック
 */
function createMeanReversionStrategyMock(customImpl = null) {
  const defaultImpl = (candles, positions, accountBalance) => {
    // データ不足のケース
    if (candles.length < 24) {
      return [];
    }
    
    // ポジションがある場合は何もしない
    if (positions.some(p => p.symbol === 'TEST/USDT')) {
      return [];
    }
    
    // 標準的なミーンリバージョンシグナル
    return [{
      symbol: 'TEST/USDT',
      type: 'market',
      side: 'sell',
      amount: accountBalance * 0.01 / candles[candles.length - 1].close,
      timestamp: Date.now()
    }];
  };
  
  return createStrategyMock('MeanReversionStrategy', customImpl || defaultImpl);
}

/**
 * TrendFollowStrategyモックを作成
 * @param {function} [customImpl] - カスタム実装（オプション）
 * @returns {jest.Mock} - 設定済みのモック
 */
function createTrendFollowStrategyMock(customImpl = null) {
  const defaultImpl = (candles, positions, accountBalance) => {
    // データ不足のケース
    if (candles.length < 30) {
      return [];
    }
    
    // トレンドが検出された場合、シグナルを返す
    const trendDetected = candles[candles.length - 1].close > candles[candles.length - 10].close;
    
    if (trendDetected && positions.length === 0) {
      return [{
        symbol: 'TEST/USDT',
        type: 'market',
        side: 'buy',
        amount: accountBalance * 0.02 / candles[candles.length - 1].close,
        timestamp: Date.now()
      }];
    }
    
    return [];
  };
  
  return createStrategyMock('TrendFollowStrategy', customImpl || defaultImpl);
}

/**
 * RangeStrategyモックを作成
 * @param {function} [customImpl] - カスタム実装（オプション）
 * @returns {jest.Mock} - 設定済みのモック
 */
function createRangeStrategyMock(customImpl = null) {
  const defaultImpl = (candles, positions, accountBalance) => {
    // データ不足のケース
    if (candles.length < 24) {
      return [];
    }
    
    const currentPrice = candles[candles.length - 1].close;
    const upperBound = currentPrice * 1.02;
    const lowerBound = currentPrice * 0.98;
    
    // レンジ境界に達した場合、リミット注文のシグナルを返す
    if (positions.length < 3) {
      return [
        {
          symbol: 'TEST/USDT',
          type: 'limit',
          side: 'buy',
          price: lowerBound,
          amount: accountBalance * 0.01 / lowerBound,
          timestamp: Date.now()
        },
        {
          symbol: 'TEST/USDT',
          type: 'limit',
          side: 'sell',
          price: upperBound,
          amount: accountBalance * 0.01 / upperBound,
          timestamp: Date.now()
        }
      ];
    }
    
    return [];
  };
  
  return createStrategyMock('RangeStrategy', customImpl || defaultImpl);
}

/**
 * すべての戦略に対して標準モックを登録するヘルパー関数
 * @param {jest} jestInstance - Jestインスタンス
 */
function mockAllStrategies(jestInstance) {
  jestInstance.mock('../../strategies/meanReversionStrategy.js', () => ({
    MeanReversionStrategy: createMeanReversionStrategyMock()
  }));
  
  jestInstance.mock('../../strategies/trendFollowStrategy.js', () => ({
    TrendFollowStrategy: createTrendFollowStrategyMock()
  }));
  
  jestInstance.mock('../../strategies/rangeStrategy.js', () => ({
    RangeStrategy: createRangeStrategyMock()
  }));
}

module.exports = {
  createStrategyMock,
  createMeanReversionStrategyMock,
  createTrendFollowStrategyMock,
  createRangeStrategyMock,
  mockAllStrategies
}; 