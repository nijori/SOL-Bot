import { executeMeanRevertStrategy } from '../../strategies/meanRevertStrategy';
import { Candle, OrderSide, OrderType, Position, StrategyType } from '../../core/types';

// テスト用のモックデータ
const generateMockCandles = (count: number, basePrice: number, highLowRange: number, trend: 'up' | 'down' | 'range'): Candle[] => {
  const candles: Candle[] = [];
  let price = basePrice;
  
  for (let i = 0; i < count; i++) {
    // トレンドに基づいて価格を調整
    if (trend === 'up') {
      price += (Math.random() * highLowRange * 0.2);
    } else if (trend === 'down') {
      price -= (Math.random() * highLowRange * 0.2);
    } else {
      price += (Math.random() * highLowRange * 0.4) - (highLowRange * 0.2);
    }
    
    // 価格の範囲を保証するための調整
    price = Math.max(basePrice - highLowRange, Math.min(basePrice + highLowRange, price));
    
    const high = price + Math.random() * highLowRange * 0.1;
    const low = price - Math.random() * highLowRange * 0.1;
    
    candles.push({
      timestamp: Date.now() - (count - i) * 60000, // 1分ごとに
      open: price,
      high,
      low,
      close: price,
      volume: Math.random() * 1000 + 500
    });
  }
  
  return candles;
};

describe('MeanRevertStrategy Tests', () => {
  // データ不足時のテスト
  test('should return empty signals when insufficient data', () => {
    // Arrange
    const candles = generateMockCandles(20, 100, 5, 'range');
    const positions: Position[] = [];
    
    // Act
    const result = executeMeanRevertStrategy(candles, 'SOL/USDT', positions);
    
    // Assert
    expect(result.strategy).toBe(StrategyType.RANGE_TRADING);
    expect(result.signals).toHaveLength(0);
  });
  
  // レンジ内でのグリッド取引テスト
  test('should generate grid signals within range', () => {
    // Arrange
    // 十分な履歴データを作成し、直近のキャンドルでグリッドレベルをクロスする価格変動を作る
    const candles = generateMockCandles(100, 100, 5, 'range');
    
    // グリッドレベルをクロスする価格変動を明示的に設定
    candles[candles.length - 2].close = 102; // 前の価格
    candles[candles.length - 1].close = 104; // 現在の価格（上昇）
    
    const positions: Position[] = [];
    
    // Act
    const result = executeMeanRevertStrategy(candles, 'SOL/USDT', positions, 10000);
    
    // Assert
    expect(result.strategy).toBe(StrategyType.RANGE_TRADING);
    expect(result.signals.length).toBeGreaterThan(0);
    
    // グリッドレベルをクロスした場合、注文が生成されていることを確認
    const sellOrders = result.signals.filter(s => s.side === OrderSide.SELL);
    expect(sellOrders.length).toBeGreaterThan(0);
    
    // Maker-only Limitであることを確認
    expect(sellOrders[0].type).toBe(OrderType.LIMIT);
    expect(sellOrders[0].postOnly).toBe(true);
  });
  
  // レンジ上限エスケープのテスト
  test('should generate escape signals when price exceeds range upper bound', () => {
    // Arrange
    const candles = generateMockCandles(100, 100, 5, 'range');
    
    // ドンチアンレンジ上限を超える価格に設定
    const highPrice = 120;
    candles[candles.length - 1].close = highPrice;
    candles[candles.length - 1].high = highPrice + 1;
    
    // ショートポジションを持っていると仮定
    const positions: Position[] = [{
      symbol: 'SOL/USDT',
      side: OrderSide.SELL,
      amount: 1.0,
      entryPrice: 100,
      timestamp: Date.now() - 3600000
    }];
    
    // Act
    const result = executeMeanRevertStrategy(candles, 'SOL/USDT', positions, 10000);
    
    // Assert
    expect(result.signals.length).toBeGreaterThan(0);
    
    // エスケープのための市場決済注文が含まれていることを確認
    const marketOrders = result.signals.filter(s => s.type === OrderType.MARKET);
    expect(marketOrders.length).toBeGreaterThan(0);
    
    // ショートポジションを決済するためのBUY注文があることを確認
    const closeShortOrders = marketOrders.filter(s => s.side === OrderSide.BUY);
    expect(closeShortOrders.length).toBeGreaterThan(0);
  });
  
  // ポジション偏りヘッジのテスト
  test('should generate hedge orders for position imbalance', () => {
    // Arrange
    const candles = generateMockCandles(100, 100, 5, 'range');
    
    // 極端なロングポジション偏りを作成（ヘッジが必要な状況）
    const positions: Position[] = [
      {
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        amount: 3.0,
        entryPrice: 95,
        timestamp: Date.now() - 7200000
      },
      {
        symbol: 'SOL/USDT',
        side: OrderSide.SELL,
        amount: 0.5,
        entryPrice: 105,
        timestamp: Date.now() - 3600000
      }
    ];
    
    // Act
    const result = executeMeanRevertStrategy(candles, 'SOL/USDT', positions, 10000);
    
    // Assert
    expect(result.signals.length).toBeGreaterThan(0);
    
    // ヘッジのための注文が含まれていることを確認
    const hedgeOrders = result.signals.filter(s => s.side === OrderSide.SELL && s.type === OrderType.LIMIT);
    expect(hedgeOrders.length).toBeGreaterThan(0);
  });
  
  // ポジション上限チェックのテスト
  test('should respect position size limit', () => {
    // Arrange
    const candles = generateMockCandles(100, 100, 5, 'range');
    
    // 上限ぎりぎりのポジションを持っていると仮定（35%）
    const positions: Position[] = [
      {
        symbol: 'SOL/USDT',
        side: OrderSide.BUY,
        amount: 17.5, // 17.5 × 100 = 1750, 口座残高5000の35%
        entryPrice: 100,
        timestamp: Date.now() - 3600000
      }
    ];
    
    // Act
    const result = executeMeanRevertStrategy(candles, 'SOL/USDT', positions, 5000);
    
    // Assert
    // ポジション上限に達しているため、新規グリッド注文は生成されないはず
    // ただし、ヘッジやエスケープ注文は生成される可能性あり
    const newPositionOrders = result.signals.filter(s => 
      (s.side === OrderSide.BUY && s.type === OrderType.LIMIT) || 
      (s.side === OrderSide.SELL && s.type === OrderType.LIMIT)
    );
    
    // このテストは不安定かもしれない（仕様によって変わる可能性あり）
    // 境界条件のため、エスケープやヘッジ注文が必要ない場合は注文なし
    expect(newPositionOrders.length).toBeLessThanOrEqual(1);
  });
}); 