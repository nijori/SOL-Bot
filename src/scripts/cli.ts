#!/usr/bin/env node
/**
 * cli.ts - SOL-Bot コマンドラインインターフェース
 * マルチシンボル対応と設定オーバーライド機能を含む拡張CLIツール
 */

import { CliParser } from "../utils/cliParser.js";
import logger from "../utils/logger.js";
import { CliOptions } from "../types/cli-options.js";
import { parameterService } from "../config/parameterService.js";
import { BacktestRunner } from "../core/backtestRunner.js";
import { OperationMode } from "../config/parameters.js";
import 'dotenv/config';

/**
 * メイン関数
 */
async function main(): Promise<void> {
  try {
    // コマンドライン引数を解析
    const options = CliParser.parse();
    
    // ヘルプフラグが指定されていれば、ヘルプを表示して終了
    if (options.help) {
      CliParser.showHelp();
      process.exit(0);
    }
    
    // 動作モードの設定
    const mode = options.mode || process.env.OPERATION_MODE || 'simulation';
    
    // 設定オーバーライドが指定されている場合は解析して適用
    if (options['config-override']) {
      const overrides = CliParser.parseConfigOverride(options['config-override']);
      if (overrides) {
        parameterService.setSymbolOverrides(overrides);
        logger.info('設定オーバーライドを適用しました');
      }
    }
    
    // マルチシンボル設定の処理
    const symbols = options.symbols || (options.symbol ? [options.symbol] : ['SOL/USDT']);
    const timeframes = options.timeframes || (options.timeframe ? [options.timeframe] : ['1h']);
    
    logger.info(`動作モード: ${mode}`);
    logger.info(`取引ペア: ${symbols.join(', ')}`);
    logger.info(`タイムフレーム: ${timeframes.join(', ')}`);
    
    // 動作モードに応じた処理の実行
    switch (mode) {
      case OperationMode.BACKTEST:
        await runBacktest(options, symbols, timeframes);
        break;
        
      case OperationMode.SIMULATION:
        await runSimulation(options, symbols, timeframes);
        break;
        
      case OperationMode.LIVE:
        await runLiveTrading(options, symbols, timeframes);
        break;
        
      default:
        logger.error(`不明な動作モード: ${mode}`);
        process.exit(1);
    }
  } catch (error) {
    logger.error(`エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * バックテストモードを実行
 */
async function runBacktest(
  options: CliOptions,
  symbols: string[],
  timeframes: string[]
): Promise<void> {
  logger.info('バックテストモードで実行しています...');
  
  // スモークテストフラグ
  const isSmokeTest = options['smoke-test'] === true;
  
  // 日数設定（スモークテストで使用）
  const days = options.days || 30;
  
  // 日付設定
  let startDate = options['start-date'] || '';
  let endDate = options['end-date'] || '';
  
  // 日付が指定されていない場合は、現在から指定日数分の期間を設定
  if (!startDate || !endDate) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    
    startDate = start.toISOString();
    endDate = end.toISOString();
    
    logger.info(`期間が指定されていないため、過去${days}日間のデータを使用します: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);
  }
  
  // 初期残高
  const initialBalance = options['initial-balance'] || 10000;
  
  // 各シンボルに対してバックテストを実行
  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      logger.info(`${symbol} - ${timeframe} のバックテストを実行中...`);
      
      // タイムフレームから時間単位を抽出
      const timeframeHours = parseTimeframeToHours(timeframe);
      
      // バックテスト設定
      const config = {
        symbol,
        timeframeHours,
        startDate,
        endDate,
        initialBalance,
        isSmokeTest,
        quiet: options.quiet === true,
        slippage: options.slippage,
        commissionRate: options['commission-rate'],
        batchSize: options['batch-size'],
        gcInterval: options['gc-interval'],
        memoryMonitoring: !options['no-memory-monitor']
      };
      
      // シンボル固有の設定があればロード
      const symbolParams = parameterService.getParametersForSymbol(symbol);
      
      // バックテストの実行
      const runner = new BacktestRunner({
        ...config,
        parameters: symbolParams
      });
      
      const result = await runner.run();
      
      // 結果の出力（quietモードでなければ）
      if (!options.quiet) {
        console.log(JSON.stringify(result, null, 2));
      }
    }
  }
  
  logger.info('すべてのバックテストが完了しました');
}

/**
 * シミュレーションモードを実行
 */
async function runSimulation(
  options: CliOptions,
  symbols: string[],
  timeframes: string[]
): Promise<void> {
  logger.info('シミュレーションモードで実行しています...');
  // 実装はTODO: シミュレーション実行ロジックを追加
  logger.info('シミュレーションモードの実装はまだ完了していません');
}

/**
 * 本番取引モードを実行
 */
async function runLiveTrading(
  options: CliOptions,
  symbols: string[],
  timeframes: string[]
): Promise<void> {
  logger.info('本番取引モードで実行しています...');
  // 実装はTODO: 本番取引実行ロジックを追加
  logger.info('本番取引モードの実装はまだ完了していません');
}

/**
 * タイムフレーム文字列を時間単位に変換
 * 例: '1m' -> 1/60, '5m' -> 5/60, '1h' -> 1, '4h' -> 4, '1d' -> 24
 */
function parseTimeframeToHours(timeframe: string): number {
  const units = timeframe.charAt(timeframe.length - 1).toLowerCase();
  const value = parseInt(timeframe.slice(0, -1), 10);
  
  switch (units) {
    case 'm':
      return value / 60;
    case 'h':
      return value;
    case 'd':
      return value * 24;
    case 'w':
      return value * 24 * 7;
    default:
      logger.warn(`不明なタイムフレーム単位: ${units}、デフォルトで1時間として扱います`);
      return value;
  }
}

// スクリプトが直接実行された場合にメイン関数を実行
if (require.main === module) {
  main().catch((error) => {
    logger.error('致命的なエラー:', error);
    process.exit(1);
  });
} 