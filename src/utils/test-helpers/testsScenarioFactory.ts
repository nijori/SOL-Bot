/**
 * REF-029: ESMテスト用シナリオ生成ユーティリティ
 *
 * このファイルはテスト用のシナリオ（戦略の評価対象となる市場状況や環境）を
 * 生成するためのクラスと関数を提供します。
 * marketDataFactoryと連携して、テスト用の状況設定と期待結果を生成します。
 */

import { MarketDataFactory, MarketStatus } from './marketDataFactory.js';
import {
  OrderSide,
  OrderType,
  StrategyType,
  Order,
  Position,
  OrderStatus
} from '../../core/types.js';

/**
 * テストシナリオの基本構造
 */
export interface TestScenario {
  name: string;
  description: string;
  // 入力データ
  candles: any[]; // TestCandle[]
  positions: Position[];
  balance: number;
  marketStatus: MarketStatus;
  // 期待される出力
  expectedSignals: Order[];
  expectedStrategy: StrategyType;
  shouldSucceed: boolean;
  params?: Record<string, any>; // 追加パラメータ
}

/**
 * テストシナリオを生成するファクトリークラス
 */
export class TestScenarioFactory {
  /**
   * トレンドフォロー戦略のテストシナリオを生成
   * @param params シナリオ生成パラメータ
   * @returns トレンドフォロー戦略のテストシナリオ
   */
  public static createTrendFollowingScenario({
    basePrice = 100,
    trendStrength = 1.0,
    isUptrend = true,
    includePositions = true,
    positionCount = 2,
    initialBalance = 10000
  } = {}): TestScenario {
    // トレンド相場のローソク足データを生成
    const candles = MarketDataFactory.createTrendCandles({
      basePrice,
      count: 60,
      trendStrength,
      isUptrend,
      volatility: 0.8
    });

    // ポジションデータを生成（オプション）
    const positions = includePositions
      ? MarketDataFactory.createPositions({
          count: positionCount,
          avgPrice: basePrice,
          // トレンド方向と逆のポジションを多めに持つ（ヘッジシグナルのテスト）
          longRatio: isUptrend ? 0.3 : 0.7
        })
      : [];

    // 期待される取引シグナル
    const expectedSignals: Order[] = [];

    // トレンド方向に合わせたマーケットオーダーを期待
    if (isUptrend) {
      expectedSignals.push({
        symbol: 'BTC/USDT',
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        amount: (initialBalance * 0.1) / basePrice,
        status: OrderStatus.OPEN
      });
    } else {
      expectedSignals.push({
        symbol: 'BTC/USDT',
        side: OrderSide.SELL,
        type: OrderType.MARKET,
        amount: (initialBalance * 0.1) / basePrice,
        status: OrderStatus.OPEN
      });
    }

    return {
      name: isUptrend ? 'Strong Uptrend Scenario' : 'Strong Downtrend Scenario',
      description: `テスト用の${isUptrend ? '上昇' : '下降'}トレンド相場シナリオ。トレンド強度: ${trendStrength}%`,
      candles,
      positions,
      balance: initialBalance,
      marketStatus: isUptrend ? MarketStatus.UPTREND : MarketStatus.DOWNTREND,
      expectedSignals,
      expectedStrategy: StrategyType.TREND_FOLLOWING,
      shouldSucceed: true,
      params: {
        trendStrength,
        isUptrend
      }
    };
  }

  /**
   * レンジ相場戦略のテストシナリオを生成
   * @param params シナリオ生成パラメータ
   * @returns レンジ相場戦略のテストシナリオ
   */
  public static createRangeTradingScenario({
    basePrice = 100,
    rangeWidth = 5,
    volatility = 0.5,
    includePositions = true,
    initialBalance = 10000
  } = {}): TestScenario {
    // レンジ相場のローソク足データを生成
    const candles = MarketDataFactory.createRangeCandles({
      basePrice,
      count: 60,
      rangeWidth,
      volatility
    });

    // ポジションデータを生成（オプション）
    const positions = includePositions
      ? MarketDataFactory.createPositions({
          count: 3,
          avgPrice: basePrice,
          longRatio: 0.5 // レンジ相場では買いと売りが均等
        })
      : [];

    // 現在の価格でレンジの位置を判断
    const currentPrice = candles[candles.length - 1].close;
    const rangeLow = basePrice * (1 - rangeWidth / 100);
    const rangeHigh = basePrice * (1 + rangeWidth / 100);
    const rangeMiddle = (rangeLow + rangeHigh) / 2;

    // 期待される取引シグナル
    const expectedSignals: Order[] = [];

    // レンジの上部では売り、下部では買いを期待
    if (currentPrice > rangeMiddle + rangeWidth * 0.3) {
      // レンジ上部ではSELL
      expectedSignals.push({
        symbol: 'BTC/USDT',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        price: currentPrice * 1.005, // 現在価格よりわずかに高い
        amount: (initialBalance * 0.05) / currentPrice,
        status: OrderStatus.OPEN
      });
    } else if (currentPrice < rangeMiddle - rangeWidth * 0.3) {
      // レンジ下部ではBUY
      expectedSignals.push({
        symbol: 'BTC/USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: currentPrice * 0.995, // 現在価格よりわずかに安い
        amount: (initialBalance * 0.05) / currentPrice,
        status: OrderStatus.OPEN
      });
    }

    return {
      name: 'Range Trading Scenario',
      description: `テスト用のレンジ相場シナリオ。レンジ幅: ${rangeWidth}%、ボラティリティ: ${volatility}`,
      candles,
      positions,
      balance: initialBalance,
      marketStatus: MarketStatus.RANGE,
      expectedSignals,
      expectedStrategy: StrategyType.RANGE_TRADING,
      shouldSucceed: true,
      params: {
        rangeWidth,
        volatility
      }
    };
  }

  /**
   * ブレイクアウト戦略のテストシナリオを生成
   * @param params シナリオ生成パラメータ
   * @returns ブレイクアウト戦略のテストシナリオ
   */
  public static createBreakoutScenario({
    basePrice = 100,
    breakoutStrength = 10,
    isUpside = true,
    breakoutComplete = true, // ブレイクアウトが完了しているか
    includePositions = true,
    initialBalance = 10000
  } = {}): TestScenario {
    // ブレイクアウト相場のローソク足データを生成
    const candles = MarketDataFactory.createBreakoutCandles({
      basePrice,
      count: 60,
      breakoutStrength,
      isUpside,
      // ブレイクアウトが完了している（過去）か、現在進行中か
      breakoutAt: breakoutComplete ? 40 : 55
    });

    // ポジションデータを生成（オプション）
    const positions = includePositions
      ? MarketDataFactory.createPositions({
          count: 2,
          avgPrice: basePrice * (isUpside ? 0.95 : 1.05), // ブレイク方向と逆のエントリー価格
          longRatio: isUpside ? 0.7 : 0.3 // ブレイク方向に合わせたポジション傾向
        })
      : [];

    // 期待される取引シグナル
    const expectedSignals: Order[] = [];

    // ブレイクアウト方向に合わせたマーケットオーダーを期待
    if (isUpside) {
      expectedSignals.push({
        symbol: 'BTC/USDT',
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        amount: (initialBalance * 0.1) / basePrice,
        status: OrderStatus.OPEN
      });
    } else {
      expectedSignals.push({
        symbol: 'BTC/USDT',
        side: OrderSide.SELL,
        type: OrderType.MARKET,
        amount: (initialBalance * 0.1) / basePrice,
        status: OrderStatus.OPEN
      });
    }

    return {
      name: isUpside ? 'Upside Breakout Scenario' : 'Downside Breakout Scenario',
      description: `テスト用の${isUpside ? '上昇' : '下降'}ブレイクアウト相場シナリオ。ブレイク強度: ${breakoutStrength}%`,
      candles,
      positions,
      balance: initialBalance,
      marketStatus: MarketStatus.BREAKOUT,
      expectedSignals,
      expectedStrategy: StrategyType.DONCHIAN_BREAKOUT,
      shouldSucceed: true,
      params: {
        breakoutStrength,
        isUpside,
        breakoutComplete
      }
    };
  }

  /**
   * 高ボラティリティ相場のテストシナリオを生成
   * @param params シナリオ生成パラメータ
   * @returns 高ボラティリティ相場のテストシナリオ
   */
  public static createVolatilityScenario({
    basePrice = 100,
    spikeStrength = 5,
    includePositions = true,
    initialBalance = 10000
  } = {}): TestScenario {
    // 高ボラティリティ相場のローソク足データを生成
    const candles = MarketDataFactory.createVolatilitySpike({
      basePrice,
      count: 60,
      spikeStrength,
      spikeAt: 50 // 直近でボラティリティ急増
    });

    // ポジションデータを生成（オプション）
    const positions = includePositions
      ? MarketDataFactory.createPositions({
          count: 3,
          avgPrice: basePrice,
          longRatio: 0.5 // 買いと売りが均等
        })
      : [];

    // 期待される取引シグナル
    const expectedSignals: Order[] = [];

    // 高ボラティリティ相場では、方向に関わらず既存ポジションの一部クローズを期待
    if (positions.length > 0) {
      const firstPosition = positions[0];
      expectedSignals.push({
        symbol: 'BTC/USDT',
        side: firstPosition.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY,
        type: OrderType.MARKET,
        amount: firstPosition.amount * 0.5, // 半分クローズ
        status: OrderStatus.OPEN
      });
    }

    return {
      name: 'High Volatility Scenario',
      description: `テスト用の高ボラティリティ相場シナリオ。ボラティリティ急増強度: ${spikeStrength}倍`,
      candles,
      positions,
      balance: initialBalance,
      marketStatus: MarketStatus.BREAKOUT,
      expectedSignals,
      expectedStrategy: StrategyType.EMERGENCY, // 緊急戦略（ポジション削減など）
      shouldSucceed: true,
      params: {
        spikeStrength
      }
    };
  }

  /**
   * マルチタイムフレームテストシナリオを生成
   * @param params シナリオ生成パラメータ
   * @returns マルチタイムフレームのテストシナリオ
   */
  public static createMultiTimeframeScenario({
    basePrice = 100,
    initialBalance = 10000
  } = {}): TestScenario {
    // 複数のタイムフレームのデータを生成
    const candles1m = MarketDataFactory.createCandles({
      basePrice,
      count: 60,
      timeframe: 60000, // 1分足
      volatility: 0.2
    });

    const candles5m = MarketDataFactory.createCandles({
      basePrice,
      count: 30,
      timeframe: 300000, // 5分足
      volatility: 0.5
    });

    const candles1h = MarketDataFactory.createTrendCandles({
      basePrice,
      count: 24,
      timeframe: 3600000, // 1時間足
      isUptrend: true,
      trendStrength: 0.8
    });

    // 複数のタイムフレームを含むシナリオ
    return {
      name: 'Multi-Timeframe Analysis Scenario',
      description:
        'テスト用のマルチタイムフレーム分析シナリオ。1分足、5分足、1時間足のデータを含む。',
      candles: candles1m, // 基本的には最小タイムフレームを使用
      positions: [],
      balance: initialBalance,
      marketStatus: MarketStatus.UPTREND,
      expectedSignals: [], // テスト次第で期待値は変動
      expectedStrategy: StrategyType.TREND_FOLLOWING,
      shouldSucceed: true,
      params: {
        candles1m,
        candles5m,
        candles1h
      }
    };
  }

  /**
   * エラーケースのテストシナリオを生成
   * @param params シナリオ生成パラメータ
   * @returns エラーケースのテストシナリオ
   */
  public static createErrorScenario({
    errorType = 'insufficient_data',
    basePrice = 100,
    initialBalance = 10000
  } = {}): TestScenario {
    let candles;
    let description;

    // エラータイプに合わせてシナリオを生成
    switch (errorType) {
      case 'insufficient_data':
        candles = MarketDataFactory.createCandles({ basePrice, count: 5 }); // データ不足
        description = 'データ不足エラーシナリオ。計算に必要な最小限のデータ量を下回る。';
        break;

      case 'zero_price':
        candles = MarketDataFactory.createCandles({ basePrice: 0, count: 30 }); // 価格がゼロ
        description = '価格ゼロエラーシナリオ。ゼロ除算や不正な計算が発生する可能性。';
        break;

      case 'negative_price':
        // ローソク足の一部に負の価格を含める
        candles = MarketDataFactory.createCandles({ basePrice, count: 30 });
        candles[15].low = -1; // 負の価格
        description = '負の価格エラーシナリオ。負の価格値が含まれている。';
        break;

      default:
        candles = MarketDataFactory.createCandles({ basePrice, count: 30 });
        description = '一般的なエラーシナリオ。';
    }

    return {
      name: `Error Scenario: ${errorType}`,
      description,
      candles,
      positions: [],
      balance: initialBalance,
      marketStatus: MarketStatus.UNKNOWN,
      expectedSignals: [], // エラーシナリオでは通常シグナルは発生しない
      expectedStrategy: StrategyType.EMERGENCY, // エラー時は緊急戦略
      shouldSucceed: false, // このシナリオは失敗することを期待
      params: {
        errorType
      }
    };
  }
}
