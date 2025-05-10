/**
 * RealTimeDataProcessor テスト
 *
 * リアルタイムデータ処理クラスのテスト
 */

import {
  RealTimeDataProcessor,
  RealTimeDataType,
  RealTimeData
} from '../../data/RealTimeDataProcessor.js';
import { EventEmitter } from 'events';

// ロガーをモック
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('RealTimeDataProcessor', () => {
  let processor: RealTimeDataProcessor;

  // テスト用のリアルタイムデータ
  const createMockTradeData = (symbol: string, price: number, amount: number): RealTimeData => ({
    symbol,
    timestamp: Date.now(),
    type: RealTimeDataType.TRADE,
    data: {
      price,
      amount,
      timestamp: Date.now()
    }
  });

  const createMockTickerData = (symbol: string, price: number, volume: number): RealTimeData => ({
    symbol,
    timestamp: Date.now(),
    type: RealTimeDataType.TICKER,
    data: {
      price,
      volume,
      timestamp: Date.now()
    }
  });

  // テスト前の準備
  beforeEach(() => {
    // タイマーをモック化
    jest.useFakeTimers();

    // 新しいプロセッサーを作成
    processor = new RealTimeDataProcessor({
      symbols: ['BTC/USDT', 'ETH/USDT'],
      bufferSize: 100,
      throttleMs: 100,
      batchSize: 5
    });

    // プロセッサーを開始
    processor.start();
  });

  // テスト後の後処理
  afterEach(() => {
    processor.stop();
    jest.useRealTimers();
  });

  describe('基本機能', () => {
    it('イベントエミッタとして正しく機能すること', () => {
      expect(processor).toBeInstanceOf(EventEmitter);
    });

    it('初期化時に指定したシンボルとバッファサイズが設定されること', () => {
      const stats = processor.getStats();
      expect(stats.symbolCount).toBe(2);
      expect(Object.keys(stats.bufferSizes).length).toBeGreaterThan(0);
    });

    it('start/stopで処理状態を切り替えられること', () => {
      // 既に開始している状態
      expect(processor.getStats().isRunning).toBe(true);

      // 停止
      processor.stop();
      expect(processor.getStats().isRunning).toBe(false);

      // 再開
      processor.start();
      expect(processor.getStats().isRunning).toBe(true);
    });
  });

  describe('データ処理', () => {
    it('シングルデータを正しく処理できること', () => {
      const data = createMockTradeData('BTC/USDT', 40000, 0.1);
      processor.processData(data);

      // 処理されたデータ数をチェック
      expect(processor.getStats().totalDataProcessed).toBe(1);

      // 対応するバッファに追加されていることをチェック
      const bufferKey = 'BTC/USDT_trade';
      expect(processor.getStats().bufferSizes[bufferKey]).toBe(1);
    });

    it('バッチデータを正しく処理できること', () => {
      const batchData = [
        createMockTradeData('BTC/USDT', 40000, 0.1),
        createMockTradeData('BTC/USDT', 40100, 0.2),
        createMockTradeData('ETH/USDT', 2800, 0.5)
      ];

      processor.processBatch(batchData);

      // 処理されたデータ数をチェック
      expect(processor.getStats().totalDataProcessed).toBe(3);

      // 対応するバッファに追加されていることをチェック
      expect(processor.getStats().bufferSizes['BTC/USDT_trade']).toBe(2);
      expect(processor.getStats().bufferSizes['ETH/USDT_trade']).toBe(1);
    });

    it('未知のシンボルでもデータを処理できること', () => {
      const data = createMockTradeData('SOL/USDT', 100, 1.0);

      // シンボルを追加
      processor.addSymbols(['SOL/USDT']);
      processor.processData(data);

      // 処理されたデータ数をチェック
      expect(processor.getStats().totalDataProcessed).toBe(1);
      expect(processor.getStats().bufferSizes['SOL/USDT_trade']).toBe(1);
    });

    it('バッファサイズの制限が機能すること', () => {
      // バッファサイズを小さく設定した新しいプロセッサ
      const smallProcessor = new RealTimeDataProcessor({
        symbols: ['BTC/USDT'],
        bufferSize: 3
      });

      smallProcessor.start();

      // バッファサイズ以上のデータを追加
      for (let i = 0; i < 5; i++) {
        smallProcessor.processData(createMockTradeData('BTC/USDT', 40000 + i * 100, 0.1));
      }

      // サイズが制限されていることを確認
      expect(smallProcessor.getStats().bufferSizes['BTC/USDT_trade']).toBe(3);

      // 最新の3件のデータが保持されていることを確認
      const latestData = smallProcessor.getLatestData('BTC/USDT', RealTimeDataType.TRADE, 3);
      expect(latestData.length).toBe(3);
      expect(latestData[0].data.price).toBe(40200);
      expect(latestData[2].data.price).toBe(40400);

      smallProcessor.stop();
    });
  });

  describe('イベント通知', () => {
    it('データ処理後にイベントが発火すること', (done) => {
      // イベントリスナーを追加
      processor.on('data-trade', (event) => {
        expect(event.symbol).toBe('BTC/USDT');
        expect(event.data.length).toBe(1);
        expect(event.data[0].data.price).toBe(40000);
        done();
      });

      // データを追加
      processor.processData(createMockTradeData('BTC/USDT', 40000, 0.1));

      // タイマーを進める
      jest.advanceTimersByTime(150);
    });

    it('特定のデータタイプのイベントが発火すること', (done) => {
      // tradeイベントリスナー
      processor.on('trades', (event) => {
        expect(event.symbol).toBe('BTC/USDT');
        expect(event.data.length).toBe(1);
        done();
      });

      // データを追加
      processor.processData(createMockTradeData('BTC/USDT', 40000, 0.1));

      // タイマーを進める
      jest.advanceTimersByTime(150);
    });

    it('キャンドルイベントが発火すること', (done) => {
      // テストのタイムアウトを延長
      jest.setTimeout(10000);

      // candle-updateイベントリスナー
      processor.on('candle-update', (candleData) => {
        expect(candleData.symbol).toBe('BTC/USDT');
        expect(candleData.timeframe).toBe('1m');
        expect(candleData.candle.open).toBe(40000);
        done(); // イベントが発火したらすぐにテスト完了
      });

      // トレードデータを追加
      const tradeData = createMockTradeData('BTC/USDT', 40000, 0.1);
      processor.processData(tradeData);

      // タイマーを進める - 十分な時間を確保
      jest.advanceTimersByTime(200);
    });

    it('新しいキャンドルが生成されると完了イベントが発火すること', (done) => {
      // テストのタイムアウトを延長
      jest.setTimeout(10000);

      let updateEventReceived = false;
      let completeEventReceived = false;
      let doneExecuted = false;

      // テストを一度だけ完了させる関数
      const finishTest = () => {
        if (!doneExecuted && updateEventReceived && completeEventReceived) {
          doneExecuted = true;
          done();
        }
      };

      // 更新イベントをリスン
      processor.on('candle-update', () => {
        updateEventReceived = true;
        finishTest();
      });

      // 完了イベントをリスン
      processor.on('candle-complete', (candleData) => {
        completeEventReceived = true;
        expect(candleData.symbol).toBe('BTC/USDT');
        expect(candleData.timeframe).toBe('1m');
        expect(candleData.isComplete).toBe(true);
        finishTest();
      });

      // 現在の時刻を保存
      const now = Date.now();

      // 最初の分のトレードデータ
      const tradeData1 = createMockTradeData('BTC/USDT', 40000, 0.1);
      tradeData1.timestamp = now;
      tradeData1.data.timestamp = now;
      processor.processData(tradeData1);

      // タイマーを少し進める（updateイベントが発火するのを待つ）
      jest.advanceTimersByTime(100);

      // 次の分のトレードデータ（60秒後）
      const tradeData2 = createMockTradeData('BTC/USDT', 40100, 0.2);
      tradeData2.timestamp = now + 60000;
      tradeData2.data.timestamp = now + 60000;
      processor.processData(tradeData2);

      // タイマーを十分に進める
      jest.advanceTimersByTime(200);
    });
  });

  describe('バッファ管理', () => {
    it('バッファをクリアできること', () => {
      // データを追加
      processor.processData(createMockTradeData('BTC/USDT', 40000, 0.1));
      processor.processData(createMockTickerData('BTC/USDT', 40000, 1000));
      processor.processData(createMockTradeData('ETH/USDT', 2800, 0.5));

      // 特定のシンボルのバッファをクリア
      processor.clearBuffers('BTC/USDT');

      // バッファがクリアされていることを確認
      expect(processor.getStats().bufferSizes['BTC/USDT_trade']).toBe(0);
      expect(processor.getStats().bufferSizes['BTC/USDT_ticker']).toBe(0);
      expect(processor.getStats().bufferSizes['ETH/USDT_trade']).toBe(1);

      // 全バッファをクリア
      processor.clearBuffers();

      // すべてのバッファがクリアされていることを確認
      expect(processor.getStats().bufferSizes['ETH/USDT_trade']).toBe(0);
    });

    it('特定のデータタイプのバッファをクリアできること', () => {
      // データを追加
      processor.processData(createMockTradeData('BTC/USDT', 40000, 0.1));
      processor.processData(createMockTickerData('BTC/USDT', 40000, 1000));

      // トレードタイプのバッファをクリア
      processor.clearBuffers(undefined, RealTimeDataType.TRADE);

      // トレードバッファがクリアされ、ティッカーバッファは残っていることを確認
      expect(processor.getStats().bufferSizes['BTC/USDT_trade']).toBe(0);
      expect(processor.getStats().bufferSizes['BTC/USDT_ticker']).toBe(1);
    });

    it('監視シンボルを追加・削除できること', () => {
      // 新しいシンボルを追加
      processor.addSymbols(['SOL/USDT', 'ADA/USDT']);

      // シンボル数が増えていることを確認
      expect(processor.getStats().symbolCount).toBe(4);

      // データを処理
      processor.processData(createMockTradeData('SOL/USDT', 100, 1.0));

      // シンボルを削除
      processor.removeSymbols(['SOL/USDT']);

      // シンボル数が減っていることを確認
      expect(processor.getStats().symbolCount).toBe(3);

      // 削除されたシンボルのバッファが存在しないことを確認
      expect(processor.getStats().bufferSizes['SOL/USDT_trade']).toBeUndefined();
    });
  });

  describe('データ取得', () => {
    it('最新データを取得できること', () => {
      // 複数のデータを追加
      for (let i = 0; i < 5; i++) {
        processor.processData(createMockTradeData('BTC/USDT', 40000 + i * 100, 0.1));
      }

      // 最新の3件を取得
      const latestData = processor.getLatestData('BTC/USDT', RealTimeDataType.TRADE, 3);

      // 正しいデータが取得できていることを確認
      expect(latestData.length).toBe(3);
      expect(latestData[0].data.price).toBe(40200);
      expect(latestData[1].data.price).toBe(40300);
      expect(latestData[2].data.price).toBe(40400);
    });

    it('存在しないバッファに対して空配列を返すこと', () => {
      const data = processor.getLatestData('INVALID/PAIR', RealTimeDataType.TRADE);
      expect(data).toEqual([]);
    });
  });

  describe('エラー処理', () => {
    it('停止状態でデータを処理しようとしても安全にスキップすること', () => {
      // プロセッサを停止
      processor.stop();

      // データ処理を試みる
      processor.processData(createMockTradeData('BTC/USDT', 40000, 0.1));

      // 処理されていないことを確認
      expect(processor.getStats().totalDataProcessed).toBe(0);
    });

    it('不正なデータに対しても例外を投げないこと', () => {
      // 不完全なデータ
      const invalidData1: any = {
        symbol: 'BTC/USDT',
        timestamp: Date.now(),
        type: RealTimeDataType.TRADE
        // dataプロパティがない
      };

      // 完全に空のデータ
      const invalidData2: any = {};

      // データがnull
      const invalidData3: any = null;

      // トレードデータがnullのケース
      const invalidData4: any = {
        symbol: 'BTC/USDT',
        timestamp: Date.now(),
        type: RealTimeDataType.TRADE,
        data: null
      };

      // エラーが発生しないことを確認
      expect(() => processor.processData(invalidData1)).not.toThrow();
      expect(() => processor.processData(invalidData2)).not.toThrow();
      expect(() => processor.processData(invalidData3)).not.toThrow();
      expect(() => processor.processData(invalidData4)).not.toThrow();
    });
  });
});
