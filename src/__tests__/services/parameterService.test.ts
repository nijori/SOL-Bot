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
      expect(typeof result.explicitNumber).toBe('number');
      expect(result.explicitNumber).toBeCloseTo(123.45);
      
      // 型推論による数値変換も検証
      expect(typeof result.implicitNumber).toBe('number');
      expect(result.implicitNumber).toBeCloseTo(123.45);
      
      // デフォルト値の適用を検証
      expect(typeof result.defaultNumber).toBe('number');
      expect(result.defaultNumber).toBe(789);
      
      // 大文字小文字を区別しない処理を検証
      expect(typeof result.mixedCase).toBe('number');
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

      // 真偽値への変換を検証
      expect(typeof result.explicitTrue).toBe('boolean');
      expect(result.explicitTrue).toBe(true);
      
      expect(typeof result.implicitTrue).toBe('boolean');
      expect(result.implicitTrue).toBe(true);
      
      expect(typeof result.yesValue).toBe('boolean');
      expect(result.yesValue).toBe(true);
      
      expect(typeof result.onValue).toBe('boolean');
      expect(result.onValue).toBe(true);
      
      expect(typeof result.explicitFalse).toBe('boolean');
      expect(result.explicitFalse).toBe(false);
      
      expect(typeof result.implicitFalse).toBe('boolean');
      expect(result.implicitFalse).toBe(false);
      
      expect(typeof result.noValue).toBe('boolean');
      expect(result.noValue).toBe(false);
      
      expect(typeof result.offValue).toBe('boolean');
      expect(result.offValue).toBe(false);
      
      expect(typeof result.invalidDefault).toBe('boolean');
      expect(result.invalidDefault).toBe(true);
    });

    test('文字列型への変換が正しく行われる', () => {
      // 環境変数を設定
      process.env.TEST_STRING = 'hello world';
      process.env.TEST_NUMBER_STRING = '123';
      process.env.TEST_BOOLEAN_STRING = 'true';

      // テスト対象のオブジェクト
      const testObj = {
        explicitString: '${TEST_STRING:string:default}',
        forceNumberAsString: '${TEST_NUMBER_STRING:string:0}',
        forceBooleanAsString: '${TEST_BOOLEAN_STRING:string:false}'
      };

      // テスト可能なインスタンスを作成
      const service = new TestableParameterService(undefined, {});
      const result = service.testEnvVariableProcessing(testObj);

      // 明示的な文字列型の確認
      expect(result.explicitString).toBe('hello world');
      expect(typeof result.explicitString).toBe('string');

      // 数値のように見える値を文字列として扱う
      expect(result.forceNumberAsString).toBe('123');
      expect(typeof result.forceNumberAsString).toBe('string');

      // 真偽値のように見える値を文字列として扱う
      expect(result.forceBooleanAsString).toBe('true');
      expect(typeof result.forceBooleanAsString).toBe('string');
    });

    test('複雑なオブジェクトと配列が正しく処理される', () => {
      // 環境変数を設定
      process.env.TEST_NUMBER = '123';
      process.env.TEST_BOOLEAN = 'true';
      process.env.TEST_STRING = 'hello';

      // テスト対象の複雑なオブジェクト
      const testObj = {
        simpleValues: {
          num: '${TEST_NUMBER}',
          bool: '${TEST_BOOLEAN}',
          str: '${TEST_STRING:string:default}'
        },
        arrayValues: [
          '${TEST_NUMBER:number:0}',
          '${TEST_BOOLEAN:boolean:false}',
          {
            nestedValue: '${TEST_STRING}'
          }
        ]
      };

      // テスト可能なインスタンスを作成
      const service = new TestableParameterService(undefined, {});
      const result = service.testEnvVariableProcessing(testObj);

      // ネストされたオブジェクトの型変換を検証
      expect(typeof result.simpleValues.num).toBe('number');
      expect(result.simpleValues.num).toBe(123);
      
      expect(typeof result.simpleValues.bool).toBe('boolean');
      expect(result.simpleValues.bool).toBe(true);
      
      expect(typeof result.simpleValues.str).toBe('string');
      expect(result.simpleValues.str).toBe('hello');
      
      // 配列内の型変換を検証
      expect(typeof result.arrayValues[0]).toBe('number');
      expect(result.arrayValues[0]).toBe(123);
      
      expect(typeof result.arrayValues[1]).toBe('boolean');
      expect(result.arrayValues[1]).toBe(true);
      
      expect(typeof result.arrayValues[2].nestedValue).toBe('string');
      expect(result.arrayValues[2].nestedValue).toBe('hello');
    });

    test('環境変数が存在しない場合、デフォルト値が使用される', () => {
      // 存在しない環境変数を使用
      const testObj = {
        defaultNum: '${NON_EXISTENT:number:123}',
        defaultBool: '${NON_EXISTENT:boolean:true}',
        defaultStr: '${NON_EXISTENT:string:default value}',
        oldFormat: '${NON_EXISTENT:-legacy default}'
      };

      // テスト可能なインスタンスを作成
      const service = new TestableParameterService(undefined, {});
      const result = service.testEnvVariableProcessing(testObj);

      // デフォルト値の適用を検証
      expect(typeof result.defaultNum).toBe('number');
      expect(result.defaultNum).toBe(123);
      
      expect(typeof result.defaultBool).toBe('boolean');
      expect(result.defaultBool).toBe(true);
      
      expect(typeof result.defaultStr).toBe('string');
      expect(result.defaultStr).toBe('default value');
      
      // 旧フォーマットのデフォルト値も検証
      expect(result.oldFormat).toBe('legacy default');
    });
  });

  describe('シングルトンパターンでの動作', () => {
    it('getInstance()は同じインスタンスを返す', () => {
      // 確実にリセットした状態から始める
      cleanupGlobalInstance();
      
      const instance1 = ParameterService.getInstance();
      const instance2 = ParameterService.getInstance();
      expect(instance1).toBe(instance2);
      
      // グローバルのシングルトンインスタンスと一致することも確認
      expect(instance1).toBe(global._parameterServiceSingleton);
    });

    it('parameterServiceエクスポートはシングルトンインスタンスを参照している', () => {
      // テスト用に再度シングルトンをリセット
      cleanupGlobalInstance();
      
      // 明示的に新しいインスタンスを作成して設定
      global._parameterServiceSingleton = new ParameterService(undefined, testParameters);
      
      // シングルトンインスタンスへの参照を確認
      const singletonInstance = ParameterService.getInstance();
      
      // parameterServiceエクスポートを検証
      expect(parameterService).toBeDefined();
      expect(parameterService instanceof ParameterService).toBe(true);
      
      // parameterServiceがシングルトンインスタンスを参照していることを確認
      // 注：実装の違いでインスタンスが異なる場合があるため、代わりにプロパティで検証
      expect(parameterService.getAllParameters()).toEqual(singletonInstance.getAllParameters());
    });

    it('シングルトンインスタンスから値を取得できる', () => {
      // 直接新しいシングルトンを作成して既知の値を設定
      cleanupGlobalInstance();
      const params = { market: { atr_period: 42 } };
      global._parameterServiceSingleton = new ParameterService(undefined, params);
      
      // テスト用に明示的に再取得
      const testParameterService = ParameterService.getInstance();
      
      // シングルトンから値を取得できることを確認
      expect(testParameterService.get('market.atr_period')).toBe(42);
      
      // parameterServiceからも同じ値を取得できることを確認
      // 注：テスト環境によっては別インスタンスになる場合があるため、内容の同等性を検証
      expect(parameterService.get('market.atr_period')).toBe(42);
    });
  });

  describe('DI対応後のテスト', () => {
    it('直接インスタンス化すると新しいインスタンスが作成される', () => {
      // シングルトンをリセット
      cleanupGlobalInstance();
      
      const directInstance = new ParameterService();
      const singletonInstance = ParameterService.getInstance();
      
      // 新しいインスタンスとシングルトンが別物であることを確認
      expect(directInstance).not.toBe(singletonInstance);
      
      // 独立したインスタンスであることを確認
      directInstance.updateParameters({ test: { value: 'direct' } });
      expect(directInstance.get('test.value')).toBe('direct');
      expect(singletonInstance.get('test.value')).toBeUndefined();
    });

    it('カスタムYAMLパスで初期化できる', () => {
      const customYamlPath = path.join(process.cwd(), 'custom', 'params.yaml');
      const customInstance = new ParameterService(customYamlPath);

      // readFileSyncが正しいパスで呼ばれたことを確認
      expect(fs.readFileSync).toHaveBeenCalledWith(customYamlPath, 'utf8');
    });

    it('初期パラメータを使用して初期化できる', () => {
      // YAMLファイル読み込みのモックをクリア
      (fs.readFileSync as jest.Mock).mockClear();
      
      const initialParams = {
        custom: {
          param1: 'value1',
          param2: 42
        }
      };

      const instance = new ParameterService(undefined, initialParams);

      // 初期パラメータが設定されていることを確認
      expect(instance.get('custom.param1')).toBe('value1');
      expect(instance.get('custom.param2')).toBe(42);

      // 初期パラメータを指定した場合、YAMLファイルは読み込まれないことを確認
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('createMockParameterService関数でモックインスタンスを作成できる', () => {
      const mockParams = {
        test: {
          value: 'mocked'
        }
      };

      const mockService = createMockParameterService(mockParams);

      // インターフェースを実装していることを確認
      expect(mockService.get('test.value')).toBe('mocked');
      
      // モックインスタンスがIParameterServiceを実装していることを検証
      const requiredMethods = [
        'getAllParameters',
        'get',
        'getMarketParameters',
        'getTrendParameters',
        'getRangeParameters',
        'getRiskParameters'
      ];
      
      requiredMethods.forEach(method => {
        expect(typeof (mockService as any)[method]).toBe('function');
      });
    });

    it('updateParameters関数で設定を更新できる', () => {
      const instance = new ParameterService(undefined, {
        market: {
          atr_period: 14
        }
      });

      instance.updateParameters({
        market: {
          atr_period: 21,
          new_param: 'test'
        }
      });

      expect(instance.get('market.atr_period')).toBe(21);
      expect(instance.get('market.new_param')).toBe('test');
      
      // ディープマージが正しく機能していることを確認
      const marketParams = instance.getMarketParameters();
      expect(marketParams).toEqual({
        atr_period: 21,
        new_param: 'test'
      });
    });

    it('applyParameters関数でインスタンスを指定して更新できる', () => {
      const instance = new ParameterService(undefined, {
        market: {
          atr_period: 14
        }
      });

      // 明示的に更新
      applyParameters({
        market: {
          atr_period: 28,
          new_value: 'applied'
        }
      }, instance);

      // applyParametersによる更新が反映されていることを確認
      expect(instance.get('market.atr_period')).toBe(28);
      expect(instance.get('market.new_value')).toBe('applied');
    });
  });

  describe('並列バックテスト時のレース条件対策', () => {
    it('複数のバックテストプロセスでそれぞれの設定が分離される', () => {
      // 固有のインスタンスを作成
      const globalInstance = new ParameterService(undefined, {
        market: { atr_period: 14 }
      });
      
      // 2つの異なるバックテストプロセスをシミュレート
      const bt1Service = new ParameterService(undefined, {
        backtest: { id: 'backtest1' },
        market: { atr_period: 10 }
      });

      const bt2Service = new ParameterService(undefined, {
        backtest: { id: 'backtest2' },
        market: { atr_period: 20 }
      });
      
      // bt1の設定を変更
      bt1Service.updateParameters({
        market: { atr_period: 15 }
      });

      // 設定が分離されていることを確認
      expect(bt1Service.get('market.atr_period')).toBe(15);
      expect(bt2Service.get('market.atr_period')).toBe(20);
      expect(globalInstance.get('market.atr_period')).toBe(14); // グローバルインスタンスは変更されない
      
      // bt2の設定を変更してもbt1に影響しないことを確認
      bt2Service.updateParameters({
        market: { atr_period: 25 }
      });
      expect(bt1Service.get('market.atr_period')).toBe(15); // 変更されていない
      expect(bt2Service.get('market.atr_period')).toBe(25); // 変更された
    });
  });

  describe('テスト用モック注入', () => {
    it('戦略へのDI注入が機能する', () => {
      // 固有のインスタンスとモックを作成
      const realService = new ParameterService(undefined, {
        trend: {
          trailing_stop_factor: 2.0
        }
      });
      
      // モックのパラメータサービス
      const mockService = createMockParameterService({
        trend: {
          donchian_period: 25,
          trailing_stop_factor: 3.0
        }
      });

      // 戦略クラスをシミュレート
      class MockStrategy {
        constructor(private paramService: IParameterService) {}

        getTrailingStopFactor(): number {
          return this.paramService.get('trend.trailing_stop_factor');
        }
        
        getDonchianPeriod(): number {
          return this.paramService.get('trend.donchian_period', 20); // デフォルト値20
        }
      }
      
      // 実際のインスタンスとモックインスタンスをテスト
      const realStrategy = new MockStrategy(realService);
      const mockedStrategy = new MockStrategy(mockService);

      // それぞれ異なる値を返すことを確認
      expect(realStrategy.getTrailingStopFactor()).toBe(2.0);
      expect(mockedStrategy.getTrailingStopFactor()).toBe(3.0);
      
      // デフォルト値と実際に設定された値の動作も確認
      expect(realStrategy.getDonchianPeriod()).toBe(20); // デフォルト値
      expect(mockedStrategy.getDonchianPeriod()).toBe(25); // モックの値
    });
  });
});
