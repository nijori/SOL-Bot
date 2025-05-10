/**
 * ParameterService型変換テスト
 */

import {
  ParameterService,
  parameterService,
  IParameterService,
  createMockParameterService,
  applyParameters
} from "../../config/parameterService.js";
import fs from 'fs';
import path from 'path';

// privateメソッドをテストするためのハック
// @ts-ignore - privateメソッドにアクセス
const originalProcessEnvVariables = ParameterService.getInstance()['processEnvVariables'];

// 環境変数をモック
const originalEnv = process.env;

// モック設定
jest.mock('fs');
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

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

  beforeEach(() => {
    // fsモックをリセット
    jest.clearAllMocks();

    // readFileSyncモックを設定
    (fs.readFileSync as jest.Mock).mockReturnValue(mockYamlContent);

    // シングルトンインスタンスをリセット
    ParameterService.resetInstance();

    // 環境変数を初期化
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // 環境変数を元に戻す
    process.env = originalEnv;
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

      // @ts-ignore - privateメソッドにアクセス
      const result = ParameterService.getInstance()['processEnvVariables'](testObj);

      // 明示的な型ヒントで数値に変換
      expect(result.explicitNumber).toBe(123.45);
      expect(typeof result.explicitNumber).toBe('number');

      // 型ヒントなしでも自動推論で数値に変換
      expect(result.implicitNumber).toBe(123.45);
      expect(typeof result.implicitNumber).toBe('number');

      // 変換できない場合はデフォルト値を使用
      expect(result.defaultNumber).toBe(789);
      expect(typeof result.defaultNumber).toBe('number');

      // 大文字小文字の区別なし
      expect(result.mixedCase).toBe(123.45);
      expect(typeof result.mixedCase).toBe('number');
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

      // @ts-ignore - privateメソッドにアクセス
      const result = ParameterService.getInstance()['processEnvVariables'](testObj);

      // 真の値のテスト
      expect(result.explicitTrue).toBe(true);
      expect(typeof result.explicitTrue).toBe('boolean');
      expect(result.implicitTrue).toBe(true);
      expect(typeof result.implicitTrue).toBe('boolean');
      expect(result.yesValue).toBe(true);
      expect(result.onValue).toBe(true);

      // 偽の値のテスト
      expect(result.explicitFalse).toBe(false);
      expect(typeof result.explicitFalse).toBe('boolean');
      expect(result.implicitFalse).toBe(false);
      expect(typeof result.implicitFalse).toBe('boolean');
      expect(result.noValue).toBe(false);
      expect(result.offValue).toBe(false);

      // 無効な値はデフォルト値を使用
      expect(result.invalidDefault).toBe(true);
      expect(typeof result.invalidDefault).toBe('boolean');
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

      // @ts-ignore - privateメソッドにアクセス
      const result = ParameterService.getInstance()['processEnvVariables'](testObj);

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

      // @ts-ignore - privateメソッドにアクセス
      const result = ParameterService.getInstance()['processEnvVariables'](testObj);

      // オブジェクトのプロパティが正しく変換されることを確認
      expect(result.simpleValues.num).toBe(123);
      expect(typeof result.simpleValues.num).toBe('number');
      expect(result.simpleValues.bool).toBe(true);
      expect(typeof result.simpleValues.bool).toBe('boolean');
      expect(result.simpleValues.str).toBe('hello');
      expect(typeof result.simpleValues.str).toBe('string');

      // 配列の要素が正しく変換されることを確認
      expect(result.arrayValues[0]).toBe(123);
      expect(typeof result.arrayValues[0]).toBe('number');
      expect(result.arrayValues[1]).toBe(true);
      expect(typeof result.arrayValues[1]).toBe('boolean');
      expect(result.arrayValues[2].nestedValue).toBe('hello');
      expect(typeof result.arrayValues[2].nestedValue).toBe('string');
    });

    test('環境変数が存在しない場合、デフォルト値が使用される', () => {
      // 存在しない環境変数を使用
      const testObj = {
        defaultNum: '${NON_EXISTENT:number:123}',
        defaultBool: '${NON_EXISTENT:boolean:true}',
        defaultStr: '${NON_EXISTENT:string:default value}',
        oldFormat: '${NON_EXISTENT:-legacy default}'
      };

      // @ts-ignore - privateメソッドにアクセス
      const result = ParameterService.getInstance()['processEnvVariables'](testObj);

      // デフォルト値が正しく使用されることを確認
      expect(result.defaultNum).toBe(123);
      expect(typeof result.defaultNum).toBe('number');
      expect(result.defaultBool).toBe(true);
      expect(typeof result.defaultBool).toBe('boolean');
      expect(result.defaultStr).toBe('default value');
      expect(typeof result.defaultStr).toBe('string');

      // 古い形式のデフォルト値も機能することを確認
      expect(result.oldFormat).toBe('legacy default');
      expect(typeof result.oldFormat).toBe('string');
    });
  });

  describe('シングルトンパターンでの動作', () => {
    it('getInstance()は同じインスタンスを返す', () => {
      const instance1 = ParameterService.getInstance();
      const instance2 = ParameterService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('parameterServiceエクスポートはシングルトンインスタンスを参照している', () => {
      expect(parameterService).toBe(ParameterService.getInstance());
    });

    it('シングルトンインスタンスから値を取得できる', () => {
      expect(parameterService.get('market.atr_period')).toBe(14);
    });
  });

  describe('DI対応後のテスト', () => {
    it('直接インスタンス化すると新しいインスタンスが作成される', () => {
      const directInstance = new ParameterService();
      expect(directInstance).not.toBe(ParameterService.getInstance());
    });

    it('カスタムYAMLパスで初期化できる', () => {
      const customYamlPath = path.join(process.cwd(), 'custom', 'params.yaml');
      const customInstance = new ParameterService(customYamlPath);

      // readFileSyncが正しいパスで呼ばれたことを確認
      expect(fs.readFileSync).toHaveBeenCalledWith(customYamlPath, 'utf8');
    });

    it('初期パラメータを使用して初期化できる', () => {
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

      // YAMLファイルが読み込まれていないことを確認
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
    });

    it('applyParameters関数でインスタンスを指定して更新できる', () => {
      const instance = new ParameterService(undefined, {
        market: {
          atr_period: 14
        }
      });

      applyParameters(
        {
          'market.atr_period': 28,
          'market.new_value': 'applied'
        },
        instance
      );

      expect(instance.get('market.atr_period')).toBe(28);
      expect(instance.get('market.new_value')).toBe('applied');
    });
  });

  describe('並列バックテスト時のレース条件対策', () => {
    it('複数のバックテストプロセスでそれぞれの設定が分離される', () => {
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
      expect(parameterService.get('market.atr_period')).toBe(14); // グローバルインスタンスは変更されない
    });
  });

  describe('テスト用モック注入', () => {
    it('戦略へのDI注入が機能する', () => {
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
      }

      // 実際のインスタンスとモックインスタンスをテスト
      const realStrategy = new MockStrategy(parameterService);
      const mockedStrategy = new MockStrategy(mockService);

      // それぞれ異なる値を返すことを確認
      expect(realStrategy.getTrailingStopFactor()).toBe(2.0); // シングルトンの元の値
      expect(mockedStrategy.getTrailingStopFactor()).toBe(3.0); // モックの値
    });
  });
});
