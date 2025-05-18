/**
 * パラメータサービス
 * YAMLファイルと環境変数から設定パラメータを読み込む
 */

// @ts-nocheck
// CommonJS対応のインポート
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../utils/logger');
require('dotenv/config');

/**
 * IParameterServiceインターフェース
 * DI対応のためのインターフェース定義
 */
// export interface IParameterService {
//   getAllParameters(): Record<string, any>;
//   get<T>(path: string, defaultValue?: T): T;
//   getMarketParameters(): any;
//   getTrendParameters(): any;
//   getRangeParameters(): any;
//   getRiskParameters(): any;
//   getMonitoringParameters(): any;
//   getBacktestParameters(): any;
//   getOperationMode(): string;
//   getParametersForSymbol(symbol: string): Record<string, any>;
//   setSymbolOverrides(overrides: MultiSymbolConfig): void;
// }

// シングルトンインスタンスをグローバルに格納するための型拡張
// declare global {
//   var _parameterServiceSingleton: ParameterService | null;
// }

// グローバル変数の初期化（未定義の場合）
if (global._parameterServiceSingleton === undefined) {
  global._parameterServiceSingleton = null;
}

/**
 * パラメータサービスクラス
 * YAMLファイルからパラメータを読み込み、環境変数で上書き可能
 */
class ParameterService {
  /**
   * コンストラクタ
   * @param customYamlPath カスタムYAMLファイルパス（テスト用）
   * @param initialParameters 初期パラメータ（テスト用）
   */
  constructor(customYamlPath, initialParameters) {
    this.yamlPath = customYamlPath || path.join(process.cwd(), 'src', 'config', 'parameters.yaml');
    this.parameters = {};
    this.symbolOverrides = null;

    if (initialParameters) {
      this.parameters = initialParameters;
      logger.info('初期パラメータを設定しました');
    } else {
      this.loadParameters();
    }
  }

  /**
   * シングルトンインスタンスを取得（後方互換性のため）
   * @deprecated 直接インスタンス化するか、DIコンテナを使用してください
   * @returns ParameterServiceのインスタンス
   */
  static getInstance() {
    if (ParameterService.instance === null) {
      // グローバル変数にインスタンスがある場合はそれを使用
      if (global._parameterServiceSingleton !== null && global._parameterServiceSingleton !== undefined) {
        ParameterService.instance = global._parameterServiceSingleton;
        logger.debug('既存のパラメータサービスを使用しました');
      } else {
        // なければ新規作成
        ParameterService.instance = new ParameterService();
        // グローバル変数にも保存
        global._parameterServiceSingleton = ParameterService.instance;
        logger.debug('新しいパラメータサービスを作成しました');
      }
    }
    return ParameterService.instance;
  }

  /**
   * シングルトンインスタンスをリセット（主にテスト用）
   * @param parameters 新しいパラメータ
   */
  static resetInstance(parameters) {
    // 新しいインスタンスを作成
    const newInstance = parameters 
      ? new ParameterService(undefined, parameters)
      : new ParameterService();
    
    // 既存のインスタンスを更新
    ParameterService.instance = newInstance;
    
    // グローバルのparameterServiceも同じインスタンスを参照するように更新
    global._parameterServiceSingleton = newInstance;
    
    logger.debug('パラメータサービスをリセットしました');
  }

  /**
   * YAMLファイルからパラメータを読み込む
   */
  loadParameters() {
    try {
      // YAMLファイルを読み込む
      const yamlContent = fs.readFileSync(this.yamlPath, 'utf8');

      // YAMLをJavaScriptオブジェクトに変換
      let params = yaml.load(yamlContent);

      // 環境変数の埋め込み、${VARIABLE:-default}形式をサポート
      params = this.processEnvVariables(params);

      this.parameters = params;
      logger.info('パラメータをYAMLから読み込みました');
    } catch (error) {
      logger.error(
        `パラメータ読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
      );
      // 読み込みに失敗した場合、空のオブジェクトを設定
      this.parameters = {};
    }
  }

  /**
   * オブジェクト内の環境変数プレースホルダーを置換する
   * ${ENV_VAR:-defaultValue} 形式をサポート
   * 型ヒントも処理: ${ENV_VAR:number:123} - 数値として処理
   *                ${ENV_VAR:boolean:true} - 真偽値として処理
   *                ${ENV_VAR:string:default} - 文字列として処理
   */
  processEnvVariables(obj) {
    if (typeof obj === 'string') {
      // 環境変数プレースホルダーを検出して置換
      return obj.replace(
        /\${([^:}]+)(?::([^:}]+))?(?::([^}]+))?}/g,
        (match, envVar, typeHint, defaultValue) => {
          const envValue = process.env[envVar];
          
          // 環境変数が存在しない場合はデフォルト値を使用
          if (envValue === undefined) {
            // デフォルト値を適切な型に変換
            if (typeHint && defaultValue) {
              return this.convertValueByTypeHint(defaultValue, typeHint.toLowerCase());
            }
            
            // 以前の形式 ${MISSING_VAR:-default} に対応
            if (defaultValue && !typeHint) {
              return this.autoDetectAndConvertType(defaultValue);
            }
            
            return defaultValue || '';
          }
          
          // 型ヒントがある場合の処理
          if (typeHint) {
            return this.convertValueByTypeHint(envValue, typeHint.toLowerCase());
          }
          
          // 一般的な型推論処理
          return this.autoDetectAndConvertType(envValue);
        }
      );
    } else if (Array.isArray(obj)) {
      // 配列の各要素を再帰的に処理
      return obj.map((item) => this.processEnvVariables(item));
    } else if (obj !== null && typeof obj === 'object') {
      // オブジェクトの各プロパティを再帰的に処理
      const result = {};
      for (const key in obj) {
        result[key] = this.processEnvVariables(obj[key]);
      }
      return result;
    }
    
    // その他の型はそのまま返す
    return obj;
  }

  /**
   * 全パラメータを取得
   * @returns パラメータオブジェクト
   */
  getAllParameters() {
    return { ...this.parameters };
  }

  /**
   * 指定されたパスのパラメータを取得
   * @param path ドット区切りのパラメータパス (例: "market.atr_period")
   * @param defaultValue パラメータが見つからない場合のデフォルト値
   * @returns パラメータ値またはデフォルト値
   */
  get(path, defaultValue) {
    const parts = path.split('.');
    let current = this.parameters;

    for (const part of parts) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[part];
    }

    return current !== undefined && current !== null ? current : defaultValue;
  }

  /**
   * 相場環境判定用パラメータを取得
   */
  getMarketParameters() {
    return this.get('market', {});
  }

  /**
   * トレンドフォロー戦略用パラメータを取得
   */
  getTrendParameters() {
    return this.get('trend', {});
  }

  /**
   * レンジ戦略用パラメータを取得
   */
  getRangeParameters() {
    return this.get('range', {});
  }

  /**
   * リスク管理用パラメータを取得
   */
  getRiskParameters() {
    return this.get('risk', {});
  }

  /**
   * モニタリング用パラメータを取得
   */
  getMonitoringParameters() {
    return this.get('monitoring', {});
  }

  /**
   * バックテスト用パラメータを取得
   */
  getBacktestParameters() {
    return this.get('backtest', {});
  }

  /**
   * 運用モードを取得（バックテスト/リアル）
   */
  getOperationMode() {
    return this.get('general.mode', 'backtest');
  }

  /**
   * パラメータを更新する
   * @param params 更新するパラメータ
   */
  updateParameters(params) {
    // ディープマージを行う関数
    const deepMerge = (target, source) => {
      if (target === undefined || target === null) {
        return source;
      }
      
      if (source === undefined || source === null) {
        return target;
      }
      
      if (typeof source !== 'object' || typeof target !== 'object') {
        return source;
      }
      
      for (const key in source) {
        target[key] = deepMerge(target[key], source[key]);
      }
      
      return target;
    };
    
    // 既存のパラメータとマージ
    this.parameters = deepMerge(this.parameters, params);
    logger.debug('パラメータを更新しました');
  }

  /**
   * 特定のシンボルのパラメータを取得（シンボル固有の設定を上書き適用）
   * @param symbol 銘柄シンボル (例: 'BTC/USDT')
   * @returns 銘柄固有の設定を適用したパラメータ
   */
  getParametersForSymbol(symbol) {
    // ベースとなる全体パラメータ
    const baseParameters = this.getAllParameters();
    
    // シンボル固有のオーバーライドがなければそのまま返す
    if (!this.symbolOverrides || !this.symbolOverrides[symbol]) {
      return baseParameters;
    }
    
    // シンボル固有のパラメータをディープマージして適用
    const deepMerge = (target, source) => {
      if (source === null || typeof source !== 'object') {
        return source;
      }
      
      if (target === null || typeof target !== 'object') {
        if (Array.isArray(source)) {
          return [...source];
        }
        return { ...source };
      }
      
      const result = { ...target };
      
      Object.keys(source).forEach(key => {
        if (source[key] && typeof source[key] === 'object') {
          if (target[key]) {
            result[key] = deepMerge(target[key], source[key]);
          } else {
            result[key] = Array.isArray(source[key]) ? [...source[key]] : { ...source[key] };
          }
        } else {
          result[key] = source[key];
        }
      });
      
      return result;
    };
    
    // シンボル固有のオーバーライドを深くマージ
    const result = deepMerge(baseParameters, this.symbolOverrides[symbol]);
    
    return result;
  }

  /**
   * シンボル固有のパラメータオーバーライドを設定
   * @param overrides シンボルごとのパラメータオーバーライド
   */
  setSymbolOverrides(overrides) {
    this.symbolOverrides = overrides;
    logger.debug('シンボル固有のパラメータオーバーライドを設定しました');
  }

  /**
   * 型ヒントに基づいて値を変換
   * @param value 変換する値
   * @param typeHint 型ヒント（'number', 'boolean', 'string'）
   * @returns 変換された値
   */
  convertValueByTypeHint(value, typeHint) {
    switch (typeHint) {
      case 'number':
        // 数値変換
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
        
      case 'boolean':
        // 真偽値変換
        if (typeof value === 'boolean') {
          return value;
        }
        
        if (typeof value === 'string') {
          const lowercased = value.toLowerCase();
          if (['true', 'yes', '1', 'on'].includes(lowercased)) {
            return true;
          }
          if (['false', 'no', '0', 'off'].includes(lowercased)) {
            return false;
          }
        }
        
        return Boolean(value);
        
      case 'string':
        // 文字列変換
        return String(value);
        
      default:
        // 型ヒントが不明な場合は自動検出
        return this.autoDetectAndConvertType(value);
    }
  }

  /**
   * 値の型を自動検出して変換
   * @param value 変換する値
   * @returns 変換された値
   */
  autoDetectAndConvertType(value) {
    if (typeof value !== 'string') {
      return value;
    }
    
    // 真偽値チェック
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }
    
    // null チェック
    if (value.toLowerCase() === 'null') {
      return null;
    }
    
    // undefined チェック
    if (value.toLowerCase() === 'undefined') {
      return undefined;
    }
    
    // 数値チェック
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }
    
    // それ以外は文字列として返す
    return value;
  }
}

// 静的プロパティの初期化
ParameterService.instance = null;

/**
 * テスト用のモックパラメータサービスを作成
 * @param mockParams モックパラメータ
 * @returns IParameterServiceインターフェースを実装したオブジェクト
 */
function createMockParameterService(mockParams = {}) {
  return {
    getAllParameters: () => ({ ...mockParams }),
    
    get: (path, defaultValue) => {
      const parts = path.split('.');
      let current = mockParams;
      
      for (const part of parts) {
        if (current === undefined || current === null || typeof current !== 'object') {
          return defaultValue;
        }
        current = current[part];
      }
      
      return current !== undefined && current !== null ? current : defaultValue;
    },
    
    getMarketParameters: () => mockParams.market || {},
    getTrendParameters: () => mockParams.trend || {},
    getRangeParameters: () => mockParams.range || {},
    getRiskParameters: () => mockParams.risk || {},
    getMonitoringParameters: () => mockParams.monitoring || {},
    getBacktestParameters: () => mockParams.backtest || {},
    
    getOperationMode: () => mockParams.general?.mode || 'backtest',
    
    getParametersForSymbol: (symbol) => {
      // 簡略化されたバージョン - シンボル固有の設定は考慮しない
      return { ...mockParams };
    },
    
    setSymbolOverrides: () => {
      // モックでは何もしない
    }
  };
}

/**
 * 既存のパラメータサービスにパラメータを適用するユーティリティ関数
 * @param params 適用するパラメータ
 * @param service パラメータサービス（デフォルトはグローバルパラメータサービス）
 */
function applyParameters(params, service = parameterService) {
  // service がシングルトンインスタンスかどうかをチェック
  if (service === parameterService && ParameterService.instance) {
    ParameterService.instance.updateParameters(params);
  } else if (typeof service.updateParameters === 'function') {
    // updateParameters メソッドがある場合は呼び出す
    service.updateParameters(params);
  } else {
    // それ以外の場合はエラーログ
    logger.error('パラメータサービスにupdateParametersメソッドがありません');
  }
}

// シングルトンインスタンスの作成
const parameterService = ParameterService.getInstance();

// CommonJS形式でエクスポート
module.exports = {
  ParameterService,
  parameterService,
  createMockParameterService,
  applyParameters
};

