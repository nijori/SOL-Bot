/**
 * パラメータサービス
 * YAMLファイルと環境変数から設定パラメータを読み込む
 */

// ESM対応のインポート
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import logger from '../utils/logger.js';
import 'dotenv/config';
import { MultiSymbolConfig, SymbolConfig } from '../types/cli-options.js';

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

/**
 * パラメータサービスクラス
 * YAMLファイルからパラメータを読み込み、環境変数で上書き可能
 */
export class ParameterService implements IParameterService {
  private static instance: ParameterService;
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
    if (!ParameterService.instance) {
      ParameterService.instance = new ParameterService();
    }
    return ParameterService.instance;
  }

  /**
   * シングルトンインスタンスをリセット（主にテスト用）
   * @param parameters 新しいパラメータ
   */
  public static resetInstance(parameters?: Record<string, any>): void {
    if (parameters) {
      ParameterService.instance = new ParameterService(undefined, parameters);
    } else {
      ParameterService.instance = new ParameterService();
    }
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
      // 新しい正規表現パターンで型ヒントをサポート
      return obj.replace(
        /\${([^:}]+)(?::([^:}]+))?(?::([^}]+))?}/g,
        (match, envVar, typeHint, defaultValue) => {
          const envValue = process.env[envVar];

          // 環境変数が存在しない場合はデフォルト値を使用
          if (envValue === undefined) {
            return defaultValue || '';
          }

          // 型ヒントがある場合は適切な型に変換
          if (typeHint) {
            try {
              switch (typeHint.toLowerCase()) {
                case 'number':
                  // 数値に変換
                  const numValue = Number(envValue);
                  // 有効な数値であることを確認
                  if (!isNaN(numValue)) {
                    return numValue;
                  }
                  // 変換できなければデフォルト値を数値として返す
                  return defaultValue ? Number(defaultValue) : 0;

                case 'boolean':
                  // 真偽値に変換 (true、yes、1、onなどを真として扱う)
                  const boolStr = envValue.toLowerCase();
                  if (['true', 'yes', '1', 'on', 'y'].includes(boolStr)) {
                    return true;
                  }
                  if (['false', 'no', '0', 'off', 'n'].includes(boolStr)) {
                    return false;
                  }
                  // 変換できなければデフォルト値を真偽値として返す
                  return defaultValue
                    ? ['true', 'yes', '1', 'on', 'y'].includes(defaultValue.toLowerCase())
                    : false;

                case 'string':
                  // 明示的に文字列として扱う
                  return envValue;

                default:
                  // 不明な型ヒントの場合は文字列として処理
                  logger.warn(
                    `未知の型ヒント '${typeHint}' が指定されました。文字列として処理します。`
                  );
                  return envValue;
              }
            } catch (error) {
              logger.error(
                `環境変数 ${envVar} の型変換中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
              );
              return defaultValue || envValue;
            }
          }

          // 型ヒントがない場合は自動的に型を推論
          // 数値として解析可能かチェック
          if (/^-?\d+(\.\d+)?$/.test(envValue)) {
            return Number(envValue);
          }

          // 真偽値として解析可能かチェック
          if (['true', 'false'].includes(envValue.toLowerCase())) {
            return envValue.toLowerCase() === 'true';
          }

          // それ以外は文字列として扱う
          return envValue;
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

    return current !== undefined && current !== null ? current : (defaultValue as T);
  }

  /**
   * 相場環境判定用パラメータを取得
   */
  public getMarketParameters(): any {
    return this.parameters.market || {};
  }

  /**
   * トレンド戦略用パラメータを取得
   */
  public getTrendParameters(): any {
    return this.parameters.trend || {};
  }

  /**
   * レンジ戦略用パラメータを取得
   */
  public getRangeParameters(): any {
    return this.parameters.range || {};
  }

  /**
   * リスク管理パラメータを取得
   */
  public getRiskParameters(): any {
    return this.parameters.risk || {};
  }

  /**
   * ログと監視パラメータを取得
   */
  public getMonitoringParameters(): any {
    return this.parameters.monitoring || {};
  }

  /**
   * バックテストパラメータを取得
   */
  public getBacktestParameters(): any {
    return this.parameters.backtest || {};
  }

  /**
   * 動作モードを取得
   */
  public getOperationMode(): string {
    return this.parameters.operation?.mode || 'simulation';
  }

  /**
   * パラメータを更新する（部分的に）
   * 主に最適化やテスト用
   * @param params 更新するパラメータ
   */
  public updateParameters(params: Record<string, any>): void {
    // ディープマージ関数
    const deepMerge = (target: any, source: any) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    };

    // パラメータをマージ
    this.parameters = deepMerge(this.parameters, params);
    logger.debug('パラメータを更新しました');
  }

  /**
   * 特定のシンボルに対応するパラメータを取得する
   * シンボル固有の設定がある場合は、デフォルト設定と深くマージして返す
   * @param symbol 取引ペアシンボル
   * @returns シンボル用のパラメータ設定
   */
  public getParametersForSymbol(symbol: string): Record<string, any> {
    // シンボルオーバーライドがない場合は標準パラメータを返す
    if (!this.symbolOverrides) {
      return this.getAllParameters();
    }

    // シンボル固有の設定がない場合はデフォルト設定を返す
    if (!this.symbolOverrides[symbol]) {
      return {
        ...this.getAllParameters(),
        ...this.symbolOverrides.default
      };
    }

    // デフォルトパラメータをベースに、デフォルトオーバーライドとシンボル固有オーバーライドを適用
    const baseParams = this.getAllParameters();
    const defaultOverrides = this.symbolOverrides.default || {};
    const symbolOverrides = this.symbolOverrides[symbol] || {};

    // 深いマージを行う関数
    const deepMerge = (target: any, source: any): any => {
      if (source === null || typeof source !== 'object') return source;
      if (target === null || typeof target !== 'object') return { ...source };

      const result = { ...target };

      Object.keys(source).forEach((key) => {
        if (source[key] instanceof Object && key in target) {
          result[key] = deepMerge(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      });

      return result;
    };

    // パラメータを順番に適用（ベース → デフォルトオーバーライド → シンボル固有オーバーライド）
    let mergedParams = deepMerge(baseParams, defaultOverrides);
    mergedParams = deepMerge(mergedParams, symbolOverrides);

    return mergedParams;
  }

  /**
   * シンボル別設定オーバーライドを設定する
   * @param overrides シンボル別設定オーバーライド
   */
  public setSymbolOverrides(overrides: MultiSymbolConfig): void {
    this.symbolOverrides = overrides;
    logger.info('シンボル別設定オーバーライドを適用しました');
  }
}

// 後方互換性のためのシングルトンインスタンス
export const parameterService = ParameterService.getInstance();

/**
 * テスト用のモックパラメータサービスを作成する関数
 * @param mockParams モックパラメータ
 * @returns モックパラメータサービス
 */
export function createMockParameterService(
  mockParams: Record<string, any> = {}
): IParameterService {
  return new ParameterService(undefined, mockParams);
}

/**
 * 最適化のためにパラメータを一時的に適用する
 * @param params 適用するパラメータのオブジェクト
 * @param service 対象のパラメータサービス（省略時はシングルトンインスタンス）
 */
export function applyParameters(
  params: Record<string, any>,
  service: IParameterService = parameterService
): void {
  if (service instanceof ParameterService) {
    service.updateParameters(params);
  } else {
    logger.warn(
      '提供されたサービスはParameterServiceのインスタンスではなく、updateParametersメソッドがありません'
    );
  }
}
