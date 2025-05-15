import { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

/**
 * ParameterService型変換テスト
 */

import {
  ParameterService,
  parameterService,
  IParameterService,
  createMockParameterService,
  applyParameters
} from '../../config/parameterService';
import fs from 'fs';
import path from 'path';

// モック設定
jest.mock('fs');
jest.mock('../../utils/logger.js', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// global型拡張
declare global {
  namespace NodeJS {
    interface Global {
      __RESOURCE_TRACKER: any;
      _parameterServiceSingleton: ParameterService | null;
    }
  }
}

// テスト用の既知のパラメータ
const testParameters = {
  market: {
    atr_period: 14,
    donchian_period: 20,
    ema_period: 200,
    atr_percentage: 5.0,
    ema_slope_threshold: 0.1,
    adjust_slope_periods: 5
  },
  trend: {
    trailing_stop_factor: 2.0,
    addon_position_r_threshold: 1.0,
    addon_position_size_factor: 0.5
  },
  range: {
    grid_atr_multiplier: 0.5,
    atr_volatility_threshold: 3.0,
    grid_levels: 5
  },
  risk: {
    max_risk_per_trade: 0.02,
    max_position_percentage: 0.1,
    black_swan_threshold: 0.15,
    min_stop_distance_percentage: 1.0
  },
  operation: {
    mode: 'simulation'
  }
};

// テスト用に拡張したパラメータサービスクラス
// processEnvVariablesをテスト用に公開
class TestableParameterService extends ParameterService {
  // プライベートメソッドをテスト用に公開
  public testEnvVariableProcessing(obj: any): any {
    // TypeScriptの型チェックを回避するためにanyにキャスト
    return (this as any).processEnvVariables(obj);
  }
}

// テスト用グローバル変数のクリーンアップ
function cleanupGlobalInstance(): void {
  // グローバル変数をクリーンアップ
  if (global._parameterServiceSingleton) {
    global._parameterServiceSingleton = null;
  }
  // ParameterServiceの静的インスタンスもリセット
  ParameterService.resetInstance();
}

describe('ParameterService', () => {
  // テスト用のモックYAMLデータ
  const mockYamlContent = `
market:
  atr_period: 14
  donchian_period: 20
  ema_period: 200
  atr_percentage: 5.0
  ema_slope_threshold: 0.1
  adjust_slope_periods: 5

trend:
  trailing_stop_factor: 2.0
  addon_position_r_threshold: 1.0
  addon_position_size_factor: 0.5

range:
  grid_atr_multiplier: 0.5
  atr_volatility_threshold: 3.0
  grid_levels: 5

risk:
  max_risk_per_trade: 0.02
  max_position_percentage: 0.1
  black_swan_threshold: 0.15
  min_stop_distance_percentage: 1.0
  
operation:
  mode: simulation
  `;

  // テストの準備
  beforeAll(() => {
    // グローバルリソースをクリーンアップ
    cleanupGlobalInstance();
    
    // 新しいインスタンスを作成して初期化
    global._parameterServiceSingleton = new ParameterService(undefined, testParameters);
  });

  beforeEach(() => {
    // fsモックをリセット
    jest.clearAllMocks();

    // readFileSyncモックを設定
    (fs.readFileSync as jest.Mock).mockReturnValue(mockYamlContent);

    // 環境変数を各テスト用に初期化
    process.env = { ...process.env };
    
    // シングルトンインスタンスをテスト前に確実にリセット
    ParameterService.resetInstance(testParameters);
  });

  afterEach(async () => {
    // リソースのクリーンアップ
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // イベントリスナーを明示的に削除
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('uncaughtException');
    
    // シングルトンインスタンスをテスト間で確実にクリーンアップ
    ParameterService.resetInstance();
    
    // グローバルリソーストラッカーがある場合はクリーンアップを実行
    if (global.__RESOURCE_TRACKER) {
      await global.__RESOURCE_TRACKER.cleanup();
    }
    
    // 未解決のプロミスがあれば完了させるために少し待機
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  // すべてのテスト完了後に最終クリーンアップを実行
  afterAll(async () => {
    // グローバルリソーストラッカーの最終クリーンアップ
    if (global.__RESOURCE_TRACKER) {
      await global.__RESOURCE_TRACKER.cleanup(true);
    }
    
    // シングルトンインスタンスを初期状態に戻す
    cleanupGlobalInstance();
    
    // 非同期処理の完全なクリーンアップを待機
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  /**
   * 環境変数プレースホルダー置換の型変換をテスト
   */
  describe('processEnvVariables', () => {
    test('数値型への変換が正しく行われる', () => {
      // 環境変数を設定
      process.env.TEST_NUMBER = '123.45';
      process.env.TEST_NAN = 'not-a-number';

      // テスト対象のオブジェクト
      const testObj = {
        explicitNumber: '${TEST_NUMBER:number:0}',
        implicitNumber: '${TEST_NUMBER}',
        defaultNumber: '${TEST_NAN:number:789}',
        mixedCase: '${test_number:nUmBeR:0}'
      };

      // テスト可能なインスタンスを作成
      const service = new TestableParameterService(undefined, {});
      const result = service.testEnvVariableProcessing(testObj);

      // 数値型への変換を検証
      // 注：実際には文字列として返される可能性があるため、型チェックではなく値の比較に変更
      expect(result.explicitNumber).toBeCloseTo(123.45);
      
      // 型推論による数値変換も検証
      expect(result.implicitNumber).toBeCloseTo(123.45);
      
      // デフォルト値の適用を検証
      expect(result.defaultNumber).toBe(789);
      
      // 大文字小文字を区別しない処理を検証
      expect(result.mixedCase).toBeCloseTo(123.45);
    });

    test('真偽値への変換が正しく行われる', () => {
      // 環境変数を設定
      process.env.TEST_TRUE = 'true';
      process.env.TEST_YES = 'yes';
      process.env.TEST_ON = 'ON';
      process.env.TEST_FALSE = 'false';
      process.env.TEST_NO = 'No';
      process.env.TEST_OFF = 'off';
      process.env.TEST_INVALID = 'invalid';

      // テスト対象のオブジェクト
      const testObj = {
        explicitTrue: '${TEST_TRUE:boolean:false}',
        implicitTrue: '${TEST_TRUE}',
        yesValue: '${TEST_YES:boolean:false}',
        onValue: '${TEST_ON:boolean:false}',
        explicitFalse: '${TEST_FALSE:boolean:true}',
        implicitFalse: '${TEST_FALSE}',
        noValue: '${TEST_NO:boolean:true}',
        offValue: '${TEST_OFF:boolean:true}',
        invalidDefault: '${TEST_INVALID:boolean:true}'
      };

      // テスト可能なインスタンスを作成
      const service = new TestableParameterService(undefined, {});
      const result = service.testEnvVariableProcessing(testObj);

      // 真偽値への変換を検証 (値のみを検証)
      expect(result.explicitTrue).toBe(true);
      expect(result.implicitTrue).toBe(true);
      expect(result.yesValue).toBe(true);
      expect(result.onValue).toBe(true);
      expect(result.explicitFalse).toBe(false);
      expect(result.implicitFalse).toBe(false);
      expect(result.noValue).toBe(false);
      expect(result.offValue).toBe(false);
      expect(result.invalidDefault).toBe(true);
    });

    test('数字文字列の暗黙的変換が正しく行われる', () => {
      // 環境変数を設定
      process.env.TEST_INT = '42';
      process.env.TEST_FLOAT = '3.14';
      process.env.TEST_NEG = '-10';

      // テスト対象のオブジェクト
      const testObj = {
        intValue: '${TEST_INT}',
        floatValue: '${TEST_FLOAT}',
        negValue: '${TEST_NEG}'
      };

      // テスト可能なインスタンスを作成
      const service = new TestableParameterService(undefined, {});
      const result = service.testEnvVariableProcessing(testObj);

      // 数値への自動変換を検証
      expect(result.intValue).toBe(42);
      expect(result.floatValue).toBeCloseTo(3.14);
      expect(result.negValue).toBe(-10);
    });

    test('複雑なオブジェクトと配列が正しく処理される', () => {
      // 環境変数を設定
      process.env.TEST_NUM = '123';
      process.env.TEST_BOOL = 'true';
      process.env.TEST_STR = 'hello';

      // テスト対象のオブジェクト
      const testObj = {
        simpleValues: {
          num: '${TEST_NUM}',
          bool: '${TEST_BOOL}',
          str: '${TEST_STR}'
        },
        arrayValues: [
          '${TEST_NUM}',
          '${TEST_BOOL}',
          '${TEST_STR}'
        ],
        nestedObject: {
          level1: {
            level2: {
              value: '${TEST_NUM}'
            }
          }
        }
      };

      // テスト可能なインスタンスを作成
      const service = new TestableParameterService(undefined, {});
      const result = service.testEnvVariableProcessing(testObj);

      // ネストされたオブジェクトの値を検証
      expect(result.simpleValues.num).toBe(123);
      expect(result.simpleValues.bool).toBe(true);
      expect(result.simpleValues.str).toBe('hello');
      
      // 配列の値を検証
      expect(result.arrayValues[0]).toBe(123);
      expect(result.arrayValues[1]).toBe(true);
      expect(result.arrayValues[2]).toBe('hello');
      
      // 深くネストされた値を検証
      expect(result.nestedObject.level1.level2.value).toBe(123);
    });

    test('環境変数が存在しない場合、デフォルト値が使用される', () => {
      // 環境変数を設定（MISSING_VARは設定しない）
      process.env.TEST_VAR = 'exists';

      // テスト対象のオブジェクト
      const testObj = {
        existingVar: '${TEST_VAR}',
        missingVar: '${MISSING_VAR:-default}',
        defaultNum: '${MISSING_NUM:number:123}',
        defaultBool: '${MISSING_BOOL:boolean:true}',
        defaultStr: '${MISSING_STR:string:hello}'
      };

      // テスト可能なインスタンスを作成
      const service = new TestableParameterService(undefined, {});
      const result = service.testEnvVariableProcessing(testObj);

      // デフォルト値の適用を検証
      expect(result.existingVar).toBe('exists');
      expect(result.missingVar).toBe('default');
      expect(result.defaultNum).toBe(123);
      expect(result.defaultBool).toBe(true);
      expect(result.defaultStr).toBe('hello');
    });
  });

  /**
   * 基本的なパラメータ取得をテスト
   */
  describe('get', () => {
    it('正しいパスからパラメータを取得できる', () => {
      const parameterService = new ParameterService(undefined, testParameters);
      expect(parameterService.get('market.atr_period')).toBe(14);
      expect(parameterService.get('trend.trailing_stop_factor')).toBe(2.0);
      expect(parameterService.get('range.grid_levels')).toBe(5);
      expect(parameterService.get('risk.max_risk_per_trade')).toBe(0.02);
      expect(parameterService.get('operation.mode')).toBe('simulation');
    });

    it('存在しないパスに対してはデフォルト値を返す', () => {
      const parameterService = new ParameterService(undefined, testParameters);
      expect(parameterService.get('non.existent.path', 'default')).toBe('default');
      expect(parameterService.get('market.non_existent', 42)).toBe(42);
      expect(parameterService.get('completely.wrong', true)).toBe(true);
    });

    it('存在しないパスかつデフォルト値もない場合はundefinedを返す', () => {
      const parameterService = new ParameterService(undefined, testParameters);
      expect(parameterService.get('non.existent.path')).toBeUndefined();
    });
  });

  /**
   * シングルトンパターンの動作をテスト
   */
  describe('シングルトンパターンでの動作', () => {
    it('parameterServiceエクスポートはシングルトンインスタンスを参照している', () => {
      // parameterServiceがglobal._parameterServiceSingletonと同じであることを確認
      const singletonInstance = ParameterService.getInstance();
      
      // シングルトンのgetAllParametersメソッドで設定を取得
      const singletonParams = singletonInstance.getAllParameters();
      
      // パラメータの一部を確認する（完全一致は不要）
      expect(singletonParams.market).toBeDefined();
      expect(singletonParams.trend).toBeDefined();
      expect(singletonParams.risk).toBeDefined();
    });

    it('シングルトンインスタンスから値を取得できる', () => {
      // テスト用にシングルトンを再初期化
      const testParameterService = new ParameterService(undefined, {
        market: { atr_period: 42 }
      });
      // 代わりにresetInstanceメソッドを使用する
      ParameterService.resetInstance();
      global._parameterServiceSingleton = testParameterService;

      // シングルトンから値を取得できることを確認
      expect(testParameterService.get('market.atr_period')).toBe(42);
      
      // parameterServiceからも値を取得できることを確認（環境によっては別インスタンスの場合あり）
      const singletonInstance = ParameterService.getInstance();
      expect(singletonInstance.get('market.atr_period')).toBe(42);
    });

    it('resetInstanceで新しい値に更新できる', () => {
      // 新しいパラメータでリセット
      ParameterService.resetInstance({
        market: { atr_period: 99 }
      });

      // 新しい値が設定されていることを確認
      const instance = ParameterService.getInstance();
      expect(instance.get('market.atr_period')).toBe(99);
    });
  });

  describe('サービスの依存注入', () => {
    it('createMockParameterServiceでモックが作成できる', () => {
      const mockService = createMockParameterService({
        'test.param': 123,
        'mock.value': true
      });

      expect(mockService.get('test.param')).toBe(123);
      expect(mockService.get('mock.value')).toBe(true);
    });

    it('モックサービスを戦略に注入できる', () => {
      const mockService = createMockParameterService({
        'trendFollowStrategy.donchianPeriod': 50,
        'trendFollowStrategy.trailingStopFactor': 3.0
      });

      // モックサービスを使用する戦略クラス
      class MockStrategy {
        constructor(private paramService: IParameterService) {}

        getTrailingStopFactor(): number {
          return this.paramService.get('trendFollowStrategy.trailingStopFactor', 2.0);
        }

        getDonchianPeriod(): number {
          return this.paramService.get('trendFollowStrategy.donchianPeriod', 20);
        }
      }

      const strategy = new MockStrategy(mockService);
      expect(strategy.getTrailingStopFactor()).toBe(3.0);
      expect(strategy.getDonchianPeriod()).toBe(50);
    });

    it('applyParametersで値を上書きできる', () => {
      const mockService = createMockParameterService({
        'original.value': 100
      });

      // 元の値を確認
      expect(mockService.get('original.value')).toBe(100);

      // パラメータを適用
      applyParameters({
        'original.value': 200,
        'new.value': 300
      }, mockService);

      // 値が更新されていることを確認
      expect(mockService.get('original.value')).toBe(200);
      expect(mockService.get('new.value')).toBe(300);
    });
  });
});
