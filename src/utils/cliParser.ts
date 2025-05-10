/**
 * コマンドライン引数パーサー
 * マルチシンボルオプションと設定オーバーライド機能をサポート
 */

import * as fs from 'fs';
import * as path from 'path';
import logger from "./logger.js";
import { CliOptions, MultiSymbolConfig } from "../types/cli-options.js";

export class CliParser {
  /**
   * コマンドライン引数を解析する
   * @param args コマンドライン引数の配列（通常はprocess.argv.slice(2)）
   * @returns 解析されたオプション
   */
  static parse(args: string[] = process.argv.slice(2)): CliOptions {
    const options: CliOptions = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const key = arg.substring(2);
        
        // 次の引数が別のオプションでなければ値として扱う
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          const value = args[++i];
          
          // 特殊なオプションを処理
          if (key === 'symbols') {
            // カンマ区切りの複数シンボルを配列に変換
            options.symbols = value.split(',').map(s => s.trim());
          } else if (key === 'timeframes') {
            // カンマ区切りの複数タイムフレームを配列に変換
            options.timeframes = value.split(',').map(t => t.trim());
          } else if (key === 'config-override') {
            // 設定オーバーライドをパース
            options['config-override'] = value;
          } else {
            // 数値に変換可能なら数値として扱う
            const numValue = Number(value);
            options[key] = !isNaN(numValue) ? numValue : value;
          }
        } else {
          // 値がない場合はフラグとして扱う
          options[key] = true;
        }
      }
    }
    
    return options;
  }
  
  /**
   * 設定オーバーライド文字列またはファイルをパースする
   * @param configOverride JSON文字列またはJSONファイルパス
   * @returns パースされた設定オブジェクト
   */
  static parseConfigOverride(configOverride: string): MultiSymbolConfig | null {
    try {
      // 文字列がファイルパスかJSONかを判断
      if (fs.existsSync(configOverride)) {
        // ファイルから読み込む
        const configStr = fs.readFileSync(
          path.resolve(configOverride),
          'utf8'
        );
        return JSON.parse(configStr) as MultiSymbolConfig;
      } else {
        // JSON文字列として解析
        return JSON.parse(configOverride) as MultiSymbolConfig;
      }
    } catch (error) {
      logger.error(`設定オーバーライドの解析に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * ヘルプメッセージを表示する
   */
  static showHelp(): void {
    console.log(`
SOL-Bot CLI ヘルプ

使用方法: npm start -- [オプション]

基本オプション:
  --mode <モード>             動作モード (live, simulation, backtest)
  --verbose                   詳細ログを表示
  --quiet                     最小限のログ出力

シンボル設定:
  --symbol <シンボル>          単一取引ペア (例: SOL/USDT)
  --symbols <シンボル1,シンボル2>  複数取引ペア (カンマ区切り)
  --timeframe <タイムフレーム>  時間枠 (例: 1m, 5m, 1h, 1d)
  --timeframes <タイムフレーム1,タイムフレーム2>  複数時間枠 (カンマ区切り)

設定オーバーライド:
  --config-override <JSON文字列またはファイルパス>  シンボル固有の設定をオーバーライド

バックテスト用オプション:
  --start-date <開始日>       開始日時 (例: 2023-01-01)
  --end-date <終了日>         終了日時 (例: 2023-12-31)
  --initial-balance <残高>    初期残高 (デフォルト: 10000)
  --slippage <値>             スリッページ率 (例: 0.001 = 0.1%)
  --commission-rate <値>      手数料率 (例: 0.001 = 0.1%)
  --batch-size <数>           バッチサイズ (キャンドル数)
  --smoke-test                スモークテストモード
  --days <日数>               スモークテスト時の日数 (デフォルト: 5)

例:
  npm start -- --mode backtest --symbol SOL/USDT --timeframe 1h
  npm start -- --symbols SOL/USDT,BTC/USDT --timeframes 1h,4h
  npm start -- --config-override ./config-override.json
    `);
  }
} 