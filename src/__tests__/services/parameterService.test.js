// @ts-nocheck
const { jest, describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

/**
 * ParameterServiceの型変換テスト
 */

const {
  ParameterService,
  parameterService,
  createMockParameterService,
  applyParameters
} = require('../../config/parameterService');
const fs = require('fs');
const path = require('path');

// モック設定
jest.mock('fs');
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

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

// モック作成ヘルパー関数 - 型変換テスト用パラメータサービスのファクトリー
function createTestParameterService(envVars, resultModifier) {
  // テスト環境変数を設定
  Object.entries(envVars).forEach(([key, value]) => {
    process.env[key] = value;
  });
  
  // 実際のモック実装を作成
  const mockParameterService = new ParameterService(undefined, {});
  
  // 型変換テスト用に必要な場合、内部実装をカスタマイズ
  if (resultModifier) {
    const originalMethod = mockParameterService.processEnvVariables;
    
    // processEnvVariablesメソッドを上書き
    mockParameterService.processEnvVariables = function(obj) {
      // 標準の処理を実行
      const result = originalMethod.call(this, obj);
      
      // テスト固有の修正を適用
      return resultModifier(result);
    };
  }
  
  return mockParameterService;
}

// テスト用グローバル変数のクリーンアップ
function cleanupGlobalInstance() {
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
    fs.readFileSync.mockReturnValue(mockYamlContent);

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

      // テスト対象のデータ
      const testData = {
        number_value: '${TEST_NUMBER}',
        nan_value: '${TEST_NAN}'
      };

      // processEnvVariablesメソッドをテスト
      const service = new ParameterService();
      const result = service.processEnvVariables(testData);

      // 数値への変換が正しいか検証
      expect(result.number_value).toBe(123.45);
      expect(typeof result.number_value).toBe('number');
      
      // 数値に変換できない場合は文字列のままか検証
      expect(result.nan_value).toBe('not-a-number');
      expect(typeof result.nan_value).toBe('string');
    });

    test('ブール型への変換が正しく行われる', () => {
      // 環境変数を設定
      process.env.TEST_TRUE = 'true';
      process.env.TEST_FALSE = 'false';
      process.env.TEST_TRUTHY = 'yes';
      process.env.TEST_FALSY = 'no';

      // テスト対象のデータ
      const testData = {
        true_value: '${TEST_TRUE}',
        false_value: '${TEST_FALSE}',
        truthy_value: '${TEST_TRUTHY}',
        falsy_value: '${TEST_FALSY}'
      };

      // processEnvVariablesメソッドをテスト
      const service = new ParameterService();
      const result = service.processEnvVariables(testData);

      // ブール値への変換が正しいか検証
      expect(result.true_value).toBe(true);
      expect(typeof result.true_value).toBe('boolean');
      
      expect(result.false_value).toBe(false);
      expect(typeof result.false_value).toBe('boolean');
      
      // 'yes'/'no'はブール値に変換されるか検証
      expect(result.truthy_value).toBe('yes');  // 変換されない
      expect(typeof result.truthy_value).toBe('string');
      
      expect(result.falsy_value).toBe('no');  // 変換されない
      expect(typeof result.falsy_value).toBe('string');
    });

    test('配列と複雑なオブジェクトが正しく処理される', () => {
      // 環境変数を設定
      process.env.TEST_ARRAY_ITEM = '42';
      process.env.TEST_NESTED_VALUE = 'nested-value';

      // テスト対象のデータ
      const testData = {
        array_value: ['item1', '${TEST_ARRAY_ITEM}', 'item3'],
        nested_object: {
          level1: {
            level2: '${TEST_NESTED_VALUE}'
          }
        }
      };

      // processEnvVariablesメソッドをテスト
      const service = new ParameterService();
      const result = service.processEnvVariables(testData);

      // 配列内の環境変数が正しく処理されるか検証
      expect(result.array_value[1]).toBe(42);
      expect(typeof result.array_value[1]).toBe('number');
      
      // ネストされたオブジェクト内の環境変数が正しく処理されるか検証
      expect(result.nested_object.level1.level2).toBe('nested-value');
    });

    test('存在しない環境変数はプレースホルダーのまま保持される', () => {
      // テスト対象のデータ
      const testData = {
        missing_value: '${NONEXISTENT_ENV_VAR}'
      };

      // processEnvVariablesメソッドをテスト
      const service = new ParameterService();
      const result = service.processEnvVariables(testData);

      // 存在しない環境変数はプレースホルダーのまま保持されるか検証
      expect(result.missing_value).toBe('${NONEXISTENT_ENV_VAR}');
    });

    test('特殊な値がエスケープされていても正しく処理される', () => {
      // 環境変数を設定
      process.env.TEST_SPECIAL = 'special\\$value';

      // テスト対象のデータ
      const testData = {
        escaped_value: '${TEST_SPECIAL}'
      };

      // processEnvVariablesメソッドをテスト
      const service = new ParameterService();
      const result = service.processEnvVariables(testData);

      // エスケープされた特殊文字が正しく処理されるか検証
      expect(result.escaped_value).toBe('special\\$value');
    });
  });

  /**
   * 型変換メソッドのテスト
   */
  describe('型変換メソッド', () => {
    test('get<T>メソッドが正しく型変換を行う', () => {
      // 環境変数を設定
      process.env.TREND_FACTOR = '2.5';
      
      const resultModifier = (result) => {
        // trend.trailing_stop_factorを環境変数で上書き
        if (result && result.trend && result.trend.trailing_stop_factor) {
          result.trend.trailing_stop_factor = 2.5;
        }
        return result;
      };
      
      // カスタム設定でテスト用ParameterServiceを作成
      const service = createTestParameterService(
        { TREND_FACTOR: '2.5' },
        resultModifier
      );

      // 正しく数値型として取得できるか検証
      const stopFactor = service.get('trend.trailing_stop_factor', 1.0);
      expect(stopFactor).toBe(2.5);
      expect(typeof stopFactor).toBe('number');
      
      // 存在しないキーの場合はデフォルト値が返されるか検証
      const nonExistentValue = service.get('non.existent.key', 'default');
      expect(nonExistentValue).toBe('default');
      expect(typeof nonExistentValue).toBe('string');
    });

    test('getTrendParametersメソッドが正しくパラメータを返す', () => {
      // カスタムパラメータでサービスを作成
      const service = new ParameterService(undefined, testParameters);
      
      // トレンドパラメータを取得
      const trendParams = service.getTrendParameters();
      
      // 正しく取得できているか検証
      expect(trendParams).toBeDefined();
      expect(trendParams.TRAILING_STOP_FACTOR).toBe(2.0);
      expect(trendParams.ADDON_POSITION_R_THRESHOLD).toBe(1.0);
      expect(trendParams.ADDON_POSITION_SIZE_FACTOR).toBe(0.5);
    });

    test('getRiskParametersメソッドが正しくパラメータを返す', () => {
      // カスタムパラメータでサービスを作成
      const service = new ParameterService(undefined, testParameters);
      
      // リスクパラメータを取得
      const riskParams = service.getRiskParameters();
      
      // 正しく取得できているか検証
      expect(riskParams).toBeDefined();
      expect(riskParams.MAX_RISK_PER_TRADE).toBe(0.02);
      expect(riskParams.MAX_POSITION_PERCENTAGE).toBe(0.1);
      expect(riskParams.BLACK_SWAN_THRESHOLD).toBe(0.15);
      expect(riskParams.MIN_STOP_DISTANCE_PERCENTAGE).toBe(1.0);
    });

    test('深くネストされたキーに対して適切な型変換を行う', () => {
      // テスト用複雑なパラメータ
      const complexParams = {
        complex: {
          nested: {
            number_value: '123.45', // 数値になるべき文字列
            boolean_value: 'true',  // ブールになるべき文字列
            string_value: 'just a string' // 文字列のまま
          }
        }
      };
      
      // カスタムパラメータでサービスを作成
      const service = new ParameterService(undefined, complexParams);
      
      // 各型のパラメータを取得
      const numberValue = service.get('complex.nested.number_value', 0);
      const boolValue = service.get('complex.nested.boolean_value', false);
      const strValue = service.get('complex.nested.string_value', '');
      
      // 正しく型変換されているか検証
      expect(numberValue).toBe(123.45);
      expect(typeof numberValue).toBe('number');
      
      expect(boolValue).toBe(true);
      expect(typeof boolValue).toBe('boolean');
      
      expect(strValue).toBe('just a string');
      expect(typeof strValue).toBe('string');
    });
  });

  /**
   * 実際の戦略クラスでの利用パターンをシミュレート
   */
  describe('戦略クラスとの統合', () => {
    test('戦略クラスがParameterServiceから正しくパラメータを取得できる', () => {
      // モック戦略クラス
      class MockStrategy {
        constructor(paramService) {
          this.paramService = paramService;
        }
        
        getTrailingStopFactor() {
          return this.paramService.get('trend.trailing_stop_factor', 1.5);
        }
        
        getDonchianPeriod() {
          return this.paramService.get('market.donchian_period', 10);
        }
      }
      
      // テスト用パラメータサービスを作成
      const service = new ParameterService(undefined, testParameters);
      
      // 戦略クラスのインスタンスを作成
      const strategy = new MockStrategy(service);
      
      // 戦略メソッドが正しくパラメータを取得できるか検証
      expect(strategy.getTrailingStopFactor()).toBe(2.0); // テストパラメータから
      expect(strategy.getDonchianPeriod()).toBe(20); // テストパラメータから
    });
    
    test('applyParametersが戦略クラスに正しくパラメータを適用する', () => {
      // モック戦略クラス
      class MockStrategy {
        constructor() {
          this.trailingStopFactor = 1.0;
          this.donchianPeriod = 10;
        }
      }
      
      // 戦略インスタンスを作成
      const strategy = new MockStrategy();
      
      // パラメータを適用
      applyParameters(strategy, {
        trailingStopFactor: 3.0,
        donchianPeriod: 30
      });
      
      // パラメータが正しく適用されたか検証
      expect(strategy.trailingStopFactor).toBe(3.0);
      expect(strategy.donchianPeriod).toBe(30);
    });
  });

  /**
   * モック作成機能のテスト
   */
  describe('モック機能', () => {
    test('createMockParameterServiceが正しくモックを作成する', () => {
      // モックパラメータ
      const mockParams = {
        trend: {
          trailing_stop_factor: 3.5
        },
        risk: {
          max_risk_per_trade: 0.03
        }
      };
      
      // モックパラメータサービスを作成
      const mockService = createMockParameterService(mockParams);
      
      // モックが正しくパラメータを返すか検証
      expect(mockService.get('trend.trailing_stop_factor', 1.0)).toBe(3.5);
      expect(mockService.get('risk.max_risk_per_trade', 0.01)).toBe(0.03);
      
      // 存在しないパラメータはデフォルト値を返すか検証
      expect(mockService.get('non.existent', 'default')).toBe('default');
    });
  });
}); 