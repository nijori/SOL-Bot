/**
 * パラメータサービス
 * YAMLファイルと環境変数から設定パラメータを読み込む
 */

// Node.js関連の型定義
declare const require: any;
declare const process: any;
declare const __dirname: string;

// fsとpathをrequireで取得
const fs = require('fs');
const path = require('path');
import logger from '../utils/logger';
import 'dotenv/config';

// yamlパッケージをインポート
const yaml = require('js-yaml');

/**
 * パラメータサービスクラス
 * YAMLファイルからパラメータを読み込み、環境変数で上書き可能
 */
export class ParameterService {
  private static instance: ParameterService;
  private parameters: Record<string, any> = {};
  private yamlPath: string;

  /**
   * コンストラクタ - シングルトンパターンのため、直接インスタンス化せずgetInstance()を使用
   */
  private constructor() {
    this.yamlPath = path.join(process.cwd(), 'src', 'config', 'parameters.yaml');
    this.loadParameters();
  }

  /**
   * シングルトンインスタンスを取得
   * @returns ParameterServiceのインスタンス
   */
  public static getInstance(): ParameterService {
    if (!ParameterService.instance) {
      ParameterService.instance = new ParameterService();
    }
    return ParameterService.instance;
  }

  /**
   * YAMLファイルからパラメータを読み込む
   */
  private loadParameters(): void {
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
      logger.error(`パラメータ読み込みエラー: ${error instanceof Error ? error.message : String(error)}`);
      // 読み込みに失敗した場合、空のオブジェクトを設定
      this.parameters = {};
    }
  }

  /**
   * オブジェクト内の環境変数プレースホルダーを置換する
   * ${ENV_VAR:-defaultValue} 形式をサポート
   */
  private processEnvVariables(obj: any): any {
    if (typeof obj === 'string') {
      // 環境変数プレースホルダーを検出して置換
      return obj.replace(/\${([^:-]+)(?:-([^}]+))?}/g, (match, envVar, defaultValue) => {
        return process.env[envVar] || defaultValue || '';
      });
    } else if (Array.isArray(obj)) {
      // 配列の各要素を再帰的に処理
      return obj.map(item => this.processEnvVariables(item));
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
    return this.parameters;
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
    
    return (current !== undefined && current !== null) ? current : defaultValue as T;
  }

  /**
   * 相場環境判定用パラメータを取得
   */
  public getMarketParameters(): any {
    return this.get('market', {});
  }

  /**
   * トレンド戦略用パラメータを取得
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
   * リスク管理パラメータを取得
   */
  public getRiskParameters(): any {
    return this.get('risk', {});
  }

  /**
   * ログと監視パラメータを取得
   */
  public getMonitoringParameters(): any {
    return this.get('monitoring', {});
  }

  /**
   * バックテストパラメータを取得
   */
  public getBacktestParameters(): any {
    return this.get('backtest', {});
  }

  /**
   * 動作モードを取得
   */
  public getOperationMode(): string {
    return this.get('operation.mode', 'simulation');
  }
}

// 外部からのアクセス用のエクスポート
export const parameterService = ParameterService.getInstance();

/**
 * 最適化のためにパラメータを一時的に適用する
 * @param params 適用するパラメータのオブジェクト
 */
export function applyParameters(params: Record<string, any>): void {
  const service = ParameterService.getInstance();
  const allParams = service.getAllParameters();
  
  // パラメータを適用
  Object.entries(params).forEach(([key, value]) => {
    // ATR_PERCENTAGE_THRESHOLDなどの全大文字のパラメータはmarket.atr_percentageなどに変換
    if (key === 'ATR_PERCENTAGE_THRESHOLD') {
      if (!allParams.market) allParams.market = {};
      allParams.market.atr_percentage = value;
    }
    else if (key === 'TRAILING_STOP_FACTOR') {
      if (!allParams.trend) allParams.trend = {};
      allParams.trend.trailing_stop_factor = value;
    }
    else if (key === 'GRID_ATR_MULTIPLIER') {
      if (!allParams.range) allParams.range = {};
      allParams.range.grid_atr_multiplier = value;
    }
    else if (key === 'EMA_SLOPE_THRESHOLD') {
      if (!allParams.market) allParams.market = {};
      allParams.market.ema_slope_threshold = value;
    }
    else if (key === 'ADDON_POSITION_R_THRESHOLD') {
      if (!allParams.trend) allParams.trend = {};
      allParams.trend.addon_position_r_threshold = value;
    }
    else if (key === 'ADDON_POSITION_SIZE_FACTOR') {
      if (!allParams.trend) allParams.trend = {};
      allParams.trend.addon_position_size_factor = value;
    }
    else if (key === 'BLACK_SWAN_THRESHOLD') {
      if (!allParams.risk) allParams.risk = {};
      allParams.risk.black_swan_threshold = value;
    }
    else {
      // その他のパラメータはそのまま適用
      // 階層構造のパラメータ（例: market.xxx）に対応
      const parts = key.toLowerCase().split('.');
      let current = allParams;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      current[parts[parts.length - 1]] = value;
    }
  });
  
  logger.info(`${Object.keys(params).length}個のパラメータを一時的に適用しました`);
} 