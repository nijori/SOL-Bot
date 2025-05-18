/**
 * パラメータサービス
 * YAMLファイルと環境変数から設定パラメータを読み込む
 */

// ESM対応のインポート
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import logger from '../utils/logger';
import 'dotenv/config';
import { MultiSymbolConfig, SymbolConfig } from '../types/cli-options';

/**
 * IParameterServiceインターフェース
 * DI対応のためのインターフェース定義
 */
export interface IParameterService {
  getAllParameters(): Record<string, any>;
  get<T>(path: string, defaultValue?: T): T;
  getMarketParameters(): any;
  getTrendParameters(): any;
  getRangeParameters(): any;
  getRiskParameters(): any;
  getMonitoringParameters(): any;
  getBacktestParameters(): any;
  getOperationMode(): string;
  getParametersForSymbol(symbol: string): Record<string, any>;
  setSymbolOverrides(overrides: MultiSymbolConfig): void;
}

// シングルトンインスタンスをグローバルに格納するための型拡張
declare global {
  var _parameterServiceSingleton: ParameterService | null;
}

// グローバル変数の初期化（未定義の場合）
if (global._parameterServiceSingleton === undefined) {
  global._parameterServiceSingleton = null;
}

/**
 * パラメータサービスクラス
 * YAMLファイルからパラメータを読み込み、環境変数で上書き可能
 */
export class ParameterService implements IParameterService {
  private static instance: ParameterService | null = null;
  private parameters: Record<string, any> = {};
  private yamlPath: string;
  private symbolOverrides: MultiSymbolConfig | null = null;

  /**
   * コンストラクタ
   * @param customYamlPath カスタムYAMLファイルパス（テスト用）
   * @param initialParameters 初期パラメータ（テスト用）
   */
  constructor(customYamlPath?: string, initialParameters?: Record<string, any>) {
    this.yamlPath = customYamlPath || join(process.cwd(), 'src', 'config', 'parameters.yaml');

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
  public static getInstance(): ParameterService {
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
  public static resetInstance(parameters?: Record<string, any>): void {
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
  private loadParameters(): void {
    try {
      // YAMLファイルを読み込む
      const yamlContent = readFileSync(this.yamlPath, 'utf8');

      // YAMLをJavaScriptオブジェクトに変換
      let params = yaml.load(yamlContent) as Record<string, any>;

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
  private processEnvVariables(obj: any): any {
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
      const result: Record<string, any> = {};
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
  public getAllParameters(): Record<string, any> {
    return { ...this.parameters };
  }

  /**
   * 指定されたパスのパラメータを取得
   * @param path ドット区切りのパラメータパス (例: "market.atr_period")
   * @param defaultValue パラメータが見つからない場合のデフォルト値
   * @returns パラメータ値またはデフォルト値
   */
  public get<T>(path: string, defaultValue?: T): T {
    const parts = path.split('.');
    let current: any = this.parameters;

    for (const part of parts) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return defaultValue as T;
      }
      current = current[part];
    }

    return current !== undefined && current !== null ? current as T : (defaultValue as T);
  }

  /**
   * 相場環境判定用パラメータを取得
   */
  public getMarketParameters(): any {
    return this.get('market', {});
  }

  /**
   * トレンドフォロー戦略用パラメータを取得
   */
  public getTrendParameters(): any {
    return this.get('trend', {});
  }

  /**
   * レンジ戦略用パラメータを取得
   */
  public getRangeParameters(): any {
    return this.get('range', {});
  }

  /**
   * リスク管理用パラメータを取得
   */
  public getRiskParameters(): any {
    return this.get('risk', {});
  }

  /**
   * モニタリング用パラメータを取得
   */
  public getMonitoringParameters(): any {
    return this.get('monitoring', {});
  }

  /**
   * バックテスト用パラメータを取得
   */
  public getBacktestParameters(): any {
    return this.get('backtest', {});
  }

  /**
   * 運用モード（live, simulation, backtest）を取得
   */
  public getOperationMode(): string {
    return this.get('operation.mode', 'simulation');
  }

  /**
   * パラメータをマージして更新する
   * @param params 更新するパラメータ
   */
  public updateParameters(params: Record<string, any>): void {
    // ディープマージ関数
    const deepMerge = (target: any, source: any) => {
      for (const key in source) {
        if (source[key] === Object(source[key]) && !Array.isArray(source[key])) {
          target[key] = target[key] || {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    };

    // 既存のパラメータに新しいパラメータをマージ
    this.parameters = deepMerge({ ...this.parameters }, params);
    logger.debug('パラメータを更新しました');
  }

  /**
   * 指定された通貨ペアのパラメータを取得
   * オーバーライドがあれば適用
   * @param symbol 通貨ペア（例: "SOL/USDT"）
   * @returns 通貨ペア固有のパラメータ
   */
  public getParametersForSymbol(symbol: string): Record<string, any> {
    // 基本パラメータをコピー
    const baseParams = { ...this.parameters };
    
    // シンボルオーバーライドがなければ基本パラメータを返す
    if (!this.symbolOverrides || !this.symbolOverrides[symbol]) {
      return baseParams;
    }

    // ディープマージ関数（オーバーライド用）
    const deepMerge = (target: any, source: any): any => {
      const result = { ...target };
      
      for (const key in source) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          // 両方がオブジェクトの場合は再帰的にマージ
          if (target[key] !== null && typeof target[key] === 'object' && !Array.isArray(target[key])) {
            result[key] = deepMerge(target[key], source[key]);
          } else {
            // ターゲットがオブジェクトでない場合はソースのオブジェクトを使用
            result[key] = { ...source[key] };
          }
        } else {
          // オブジェクトでない場合は直接上書き
          result[key] = source[key];
        }
      }
      
      return result;
    };

    // 通貨ペア固有のオーバーライドを適用
    const symbolSpecificParams = deepMerge(baseParams, this.symbolOverrides[symbol]);
    logger.debug(`${symbol}固有のパラメータを適用しました`);
    
    return symbolSpecificParams;
  }

  /**
   * 複数通貨ペアのパラメータオーバーライドを設定
   * @param overrides 通貨ペアごとのオーバーライド設定
   */
  public setSymbolOverrides(overrides: MultiSymbolConfig): void {
    this.symbolOverrides = overrides;
    logger.info(`${Object.keys(overrides).length}通貨ペアのオーバーライド設定を適用しました`);
  }

  /**
   * 値を型ヒントに基づいて変換する
   * @param value 変換する値
   * @param typeHint 型ヒント
   * @returns 変換された値
   */
  private convertValueByTypeHint(value: string, typeHint: string): any {
    try {
      switch (typeHint) {
        case 'number':
          // 数値に変換
          return Number(value);
          
        case 'boolean':
          // 真偽値に変換
          const boolStr = value.toLowerCase();
          if (['true', 'yes', '1', 'on', 'y'].includes(boolStr)) {
            return true;
          }
          if (['false', 'no', '0', 'off', 'n'].includes(boolStr)) {
            return false;
          }
          // 変換できない場合はデフォルト値を使用
          return value === 'true';
          
        case 'string':
          // 明示的に文字列として扱う
          return String(value);
          
        default:
          logger.warn(`未知の型ヒント '${typeHint}' が指定されました。文字列として処理します。`);
          return value;
      }
    } catch (error) {
      logger.error(`値 ${value} の型変換中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
      return value;
    }
  }

  /**
   * 値を自動検出して変換する
   * @param value 変換する値
   * @returns 変換された値
   */
  private autoDetectAndConvertType(value: string): any {
    // 数値に見える場合は数値に変換
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return Number(value);
    }
    
    // 真偽値に見える場合
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true') {
      return true;
    }
    if (lowerValue === 'false') {
      return false;
    }
    
    // それ以外は文字列として扱う
    return value;
  }
}

/**
 * シングルトンインスタンス（後方互換性のため）
 * 注: 新しいコードでは直接インスタンス化するか、DIコンテナを使用することを推奨
 */
export const parameterService = ParameterService.getInstance();

/**
 * モックパラメータサービスを作成（テスト用）
 * @param mockParams モックパラメータ
 * @returns IParameterServiceインターフェースを実装したモックオブジェクト
 */
export function createMockParameterService(
  mockParams: Record<string, any> = {}
): IParameterService {
  // モックパラメータにドット表記のキーが含まれているか確認
  const processedParams: Record<string, any> = {};
  
  // ドット表記のキーをネストされたオブジェクトとして変換
  for (const [key, value] of Object.entries(mockParams)) {
    if (key.includes('.')) {
      // ドット区切りのキーを分割
      const parts = key.split('.');
      let current = processedParams;
      
      // 最後のパートを除く各階層を作成
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      // 最後のパートに値を設定
      current[parts[parts.length - 1]] = value;
    } else {
      // ドットがない場合はそのまま設定
      processedParams[key] = value;
    }
  }
  
  // 処理したパラメータでモックサービスを作成
  const mockService = new ParameterService(undefined, processedParams);
  
  // モックパラメータサービスを返す
  return mockService;
}

/**
 * パラメータを適用するユーティリティ関数
 * @param params 適用するパラメータ
 * @param service 対象のパラメータサービス（デフォルトはシングルトン）
 */
export function applyParameters(
  params: Record<string, any>,
  service: IParameterService = parameterService
): void {
  if (service instanceof ParameterService) {
    service.updateParameters(params);
  } else {
    logger.warn('パラメータ適用先がParameterServiceのインスタンスではありません');
  }
}

