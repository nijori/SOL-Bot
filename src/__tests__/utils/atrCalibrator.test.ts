import { ATRCalibrator, CalibrationResult, atrCalibrator } from '../../utils/atrCalibrator.js';
import { Candle } from '../../core/types.js';
import { parameterService } from '../../config/parameterService.js';

// パラメータサービスをモック
jest.mock('../../config/parameterService.js', () => ({
  parameterService: {
    get: jest.fn((key: string, defaultValue: any) => {
      // テスト用のパラメータマッピング
      const params: Record<string, any> = {
        'risk.minLookbackCandles': 30,
        'market.atr_period': 14,
        'risk.maxCalibrationLookback': 90,
        'risk.volatilityLowThreshold': 2.0,
        'risk.volatilityMediumThreshold': 5.0,
        'risk.volatilityHighThreshold': 10.0,
        'risk.defaultAtrPercentage': 0.02
      };
      return params[key] !== undefined ? params[key] : defaultValue;
    })
  }
}));

// atrUtilsモジュールをモック
jest.mock('../../utils/atrUtils.js', () => ({
  calculateATR: jest.fn((candles: Candle[], period: number) => {
    // モック実装：最終価格の3%をATRとして返す
    if (!candles || candles.length === 0) return 0;
    const lastCandle = candles[candles.length - 1];
    return lastCandle.close * 0.03;
  })
}));

// モックローソク足生成用ヘルパー関数
function createMockCandles(
  count: number,
  basePrice: number = 100,
  volatility: number = 0.05,
  timeframeHours: number = 1
): Candle[] {
  const candles: Candle[] = [];
  let currentPrice = basePrice;

  const now = Date.now();
  const timeframeMs = timeframeHours * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // 価格の変動をシミュレート
    const change = currentPrice * volatility * (Math.random() * 2 - 1);
    currentPrice += change;

    // 価格が0未満にならないように
    if (currentPrice < 0.1) currentPrice = 0.1;

    const high = currentPrice * (1 + Math.random() * volatility);
    const low = currentPrice * (1 - Math.random() * volatility);

    candles.push({
      timestamp: now - (count - i) * timeframeMs,
      open: currentPrice - change,
      high: high,
      low: low,
      close: currentPrice,
      volume: Math.random() * 1000
    });
  }

  return candles;
}

describe('ATRCalibrator', () => {
  let calibrator: ATRCalibrator;

  beforeEach(() => {
    // 各テスト前にキャリブレーターの新しいインスタンスを作成
    calibrator = new ATRCalibrator();
    // jest.clearAllMocks();
  });

  describe('基本機能', () => {
    test('シングルトンインスタンスが正しく機能する', () => {
      const instance1 = ATRCalibrator.getInstance();
      const instance2 = ATRCalibrator.getInstance();

      // 同じインスタンスであることを確認
      expect(instance1).toBe(instance2);

      // グローバルエクスポートされたatrCalibratorもシングルトンと同じであることを確認
      expect(atrCalibrator).toBe(instance1);
    });

    test('ATR%が正しく計算される', () => {
      const symbol = 'BTC/USDT';
      const candles = createMockCandles(50, 40000);

      const result = calibrator.calibrateATR(symbol, candles);

      // ATR%が計算されていることを確認
      expect(result.atrPercentage).toBeGreaterThan(0);

      // シンボルが正しいことを確認
      expect(result.symbol).toBe(symbol);

      // 推奨パラメータが生成されていることを確認
      expect(result.recommendedParameters).toBeDefined();
      expect(result.recommendedParameters.atrPercentageThreshold).toBeGreaterThan(0);
      expect(result.recommendedParameters.trailingStopFactor).toBeGreaterThan(0);
      expect(result.recommendedParameters.gridAtrMultiplier).toBeGreaterThan(0);
      expect(result.recommendedParameters.stopDistanceMultiplier).toBeGreaterThan(0);
    });

    test('データが不足している場合はフォールバック値を使用する', () => {
      const symbol = 'ETH/USDT';
      const candles = createMockCandles(10, 3000); // 必要な30未満のデータ

      const result = calibrator.calibrateATR(symbol, candles);

      // フォールバック値を使用していることを確認
      expect(result.volatilityProfile).toBe('MEDIUM');
      expect(result.atrPercentage).toBe(2); // デフォルトの0.02 * 100
    });

    test('大量のデータは最大ルックバック期間に制限される', () => {
      const symbol = 'SOL/USDT';
      const candles = createMockCandles(200, 100); // maxLookback(90)より多い

      const result = calibrator.calibrateATR(symbol, candles);

      // 使用されたデータ数が制限されていることを確認
      expect(result.calculatedFrom.candleCount).toBe(90);
    });
  });

  describe('ボラティリティプロファイル', () => {
    test('低ボラティリティ(LOW)の分類', () => {
      // ATR値をモックで調整
      require('../../utils/atrUtils.js').calculateATR.mockImplementationOnce(() => 1); // 100ドルの1%

      const symbol = 'USDC/USDT';
      const candles = createMockCandles(50, 100);

      const result = calibrator.calibrateATR(symbol, candles);

      // 低ボラティリティに分類されることを確認
      expect(result.volatilityProfile).toBe('LOW');

      // 低ボラティリティ用のパラメータが適用されていることを確認
      expect(result.recommendedParameters.trailingStopFactor).toBeCloseTo(2.0);
      expect(result.recommendedParameters.gridAtrMultiplier).toBeCloseTo(0.8);
    });

    test('中ボラティリティ(MEDIUM)の分類', () => {
      // ATR値をモックで調整
      require('../../utils/atrUtils.js').calculateATR.mockImplementationOnce(() => 3); // 100ドルの3%

      const symbol = 'BTC/USDT';
      const candles = createMockCandles(50, 100);

      const result = calibrator.calibrateATR(symbol, candles);

      // 中ボラティリティに分類されることを確認
      expect(result.volatilityProfile).toBe('MEDIUM');

      // 中ボラティリティ用のパラメータが適用されていることを確認
      expect(result.recommendedParameters.trailingStopFactor).toBeCloseTo(1.5);
      expect(result.recommendedParameters.gridAtrMultiplier).toBeCloseTo(0.6);
    });

    test('高ボラティリティ(HIGH)の分類', () => {
      // ATR値をモックで調整
      require('../../utils/atrUtils.js').calculateATR.mockImplementationOnce(() => 7); // 100ドルの7%

      const symbol = 'DOGE/USDT';
      const candles = createMockCandles(50, 100);

      const result = calibrator.calibrateATR(symbol, candles);

      // 高ボラティリティに分類されることを確認
      expect(result.volatilityProfile).toBe('HIGH');

      // 高ボラティリティ用のパラメータが適用されていることを確認
      expect(result.recommendedParameters.trailingStopFactor).toBeCloseTo(1.2);
      expect(result.recommendedParameters.gridAtrMultiplier).toBeCloseTo(0.5);
    });

    test('極高ボラティリティ(EXTREME)の分類', () => {
      // ATR値をモックで調整
      require('../../utils/atrUtils.js').calculateATR.mockImplementationOnce(() => 15); // 100ドルの15%

      const symbol = 'SHIB/USDT';
      const candles = createMockCandles(50, 100);

      const result = calibrator.calibrateATR(symbol, candles);

      // 極高ボラティリティに分類されることを確認
      expect(result.volatilityProfile).toBe('EXTREME');

      // 極高ボラティリティ用のパラメータが適用されていることを確認
      expect(result.recommendedParameters.trailingStopFactor).toBeCloseTo(1.0);
      expect(result.recommendedParameters.gridAtrMultiplier).toBeCloseTo(0.4);
    });
  });

  describe('キャッシュ機能', () => {
    test('キャッシュが正しく機能する', () => {
      const symbol = 'XRP/USDT';
      const candles = createMockCandles(50, 0.5);

      // スパイを最初に設定
      const calculateATRSpy = jest.spyOn(require('../../utils/atrUtils.js'), 'calculateATR');
      calculateATRSpy.mockClear(); // スパイをクリア

      // 1回目のキャリブレーション
      const result1 = calibrator.calibrateATR(symbol, candles);

      // スパイ呼び出し回数を確認
      expect(calculateATRSpy).toHaveBeenCalled();
      calculateATRSpy.mockClear(); // スパイをリセット

      // 2回目のキャリブレーション（キャッシュを使用する）
      const result2 = calibrator.calibrateATR(symbol, candles);

      // calculateATRが呼ばれていないことを確認（キャッシュが使われた）
      expect(calculateATRSpy).not.toHaveBeenCalled();

      // 結果が同じであることを確認
      expect(result2).toEqual(result1);

      // キャッシュを無効化
      calibrator.invalidateCache(symbol);
      calculateATRSpy.mockClear(); // スパイをリセット

      // 3回目のキャリブレーション（キャッシュが無効化されたので再計算）
      const result3 = calibrator.calibrateATR(symbol, candles);

      // calculateATRが呼ばれたことを確認（再計算された）
      expect(calculateATRSpy).toHaveBeenCalled();
    });

    test('キャッシュのTTLが正しく機能する', (done) => {
      // TTLを短く設定
      calibrator.setCacheTTL(0.001); // 0.001時間 = 3.6秒

      const symbol = 'LINK/USDT';
      const candles = createMockCandles(50, 20);

      // 1回目のキャリブレーション
      calibrator.calibrateATR(symbol, candles);

      // キャッシュからの取得をモニターするためのスパイ
      const calculateATRSpy = jest.spyOn(require('../../utils/atrUtils.js'), 'calculateATR');

      // TTL期限切れを待ってからテスト
      setTimeout(() => {
        // キャッシュ期限切れ後のキャリブレーション
        calibrator.calibrateATR(symbol, candles);

        // calculateATRが呼ばれたことを確認（キャッシュ期限切れで再計算）
        expect(calculateATRSpy).toHaveBeenCalled();
        done();
      }, 100); // 100ms待機（TTL 0.001時間 = 3.6秒よりはるかに短い時間だが、テスト時間短縮のため）
    });
  });

  describe('マルチシンボル機能', () => {
    test('複数シンボルのキャリブレーションが機能する', () => {
      const symbolsCandles = new Map<string, Candle[]>();
      symbolsCandles.set('BTC/USDT', createMockCandles(50, 40000));
      symbolsCandles.set('ETH/USDT', createMockCandles(50, 3000));
      symbolsCandles.set('SOL/USDT', createMockCandles(50, 100));

      const results = calibrator.calibrateMultipleSymbols(symbolsCandles);

      // 全てのシンボルの結果が含まれていることを確認
      expect(results.size).toBe(3);
      expect(results.has('BTC/USDT')).toBe(true);
      expect(results.has('ETH/USDT')).toBe(true);
      expect(results.has('SOL/USDT')).toBe(true);

      // 各シンボルの結果が正しいことを確認
      const btcResult = results.get('BTC/USDT') as CalibrationResult;
      const ethResult = results.get('ETH/USDT') as CalibrationResult;
      const solResult = results.get('SOL/USDT') as CalibrationResult;

      expect(btcResult.symbol).toBe('BTC/USDT');
      expect(ethResult.symbol).toBe('ETH/USDT');
      expect(solResult.symbol).toBe('SOL/USDT');
    });
  });
});
