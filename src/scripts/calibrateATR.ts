/**
 * ATR%自動キャリブレーションCLIスクリプト
 *
 * 複数シンボルのATR%を自動キャリブレーションし、最適なパラメータを算出するコマンドラインツール
 * ALG-040: ATR%自動キャリブレーション
 *
 * 使用方法:
 * npm run calibrate-atr -- --symbols BTC/USDT,ETH/USDT,SOL/USDT --timeframe 1h
 */

import { atrCalibrator, CalibrationResult } from '../utils/atrCalibrator.js';
import { dataRepository } from '../data/dataRepository.js';
import { parameterService } from '../config/parameterService.js';
import logger from '../utils/logger.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { Candle } from '../core/types.js';
import fs from 'fs';
import path from 'path';

// CLIオプションを設定
const argv = yargs(hideBin(process.argv))
  .options({
    symbols: {
      describe: 'カンマ区切りの通貨ペアリスト（例："BTC/USDT,ETH/USDT,SOL/USDT"）',
      type: 'string',
      demandOption: false,
      default: 'SOL/USDT'
    },
    timeframe: {
      describe: 'キャリブレーションに使用するタイムフレーム（例："1h", "4h", "1d"）',
      type: 'string',
      demandOption: false,
      default: '1h'
    },
    lookback: {
      describe: 'キャリブレーションに使用するロウソク足数（例：90）',
      type: 'number',
      demandOption: false
    },
    output: {
      describe: '結果をJSONファイルに出力',
      type: 'boolean',
      demandOption: false,
      default: true
    },
    outputDir: {
      describe: '結果を出力するディレクトリ',
      type: 'string',
      demandOption: false,
      default: './data/optimization'
    }
  })
  .help()
  .parseSync();

/**
 * タイムフレームを時間に変換
 * @param timeframe タイムフレーム文字列（例："1h", "4h", "1d"）
 * @returns 時間単位の数値
 */
function timeframeToHours(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([mhd])$/);
  if (!match) {
    throw new Error(`不正なタイムフレーム形式: ${timeframe}`);
  }

  const [, value, unit] = match;
  const numValue = parseInt(value, 10);

  switch (unit) {
    case 'm':
      return numValue / 60;
    case 'h':
      return numValue;
    case 'd':
      return numValue * 24;
    default:
      return numValue;
  }
}

/**
 * 結果を整形してコンソールに表示
 * @param results キャリブレーション結果
 */
function printResults(results: Map<string, CalibrationResult>): void {
  console.log('\n=== ATR%キャリブレーション結果 ===\n');

  // 結果をシンボル名でソート
  const sortedResults = Array.from(results.entries()).sort(([symbolA], [symbolB]) =>
    symbolA.localeCompare(symbolB)
  );

  // ヘッダー
  console.log(
    '| シンボル | ATR% | ボラティリティ | 推奨ATR閾値 | トレイリング | グリッド幅 | ストップ距離 |'
  );
  console.log(
    '|----------|------|----------------|------------|------------|-----------|------------|'
  );

  // 各シンボルの結果を表示
  sortedResults.forEach(([symbol, result]) => {
    console.log(
      `| ${symbol.padEnd(8)} | ${result.atrPercentage.toFixed(2).padEnd(4)}% | ${result.volatilityProfile.padEnd(14)} | ${result.recommendedParameters.atrPercentageThreshold.toFixed(2).padEnd(10)}% | ${result.recommendedParameters.trailingStopFactor.toFixed(2).padEnd(10)}x | ${result.recommendedParameters.gridAtrMultiplier.toFixed(2).padEnd(9)}x | ${result.recommendedParameters.stopDistanceMultiplier.toFixed(2).padEnd(10)}x |`
    );
  });

  console.log('\n注: これらのパラメータは各通貨ペアの最適な設定として使用できます。');
  console.log('    パラメータは各通貨ペアのボラティリティプロファイルに基づいて調整されています。');
  console.log(`    * ATR計算期間: ${parameterService.get<number>('market.atr_period', 14)}`);
  console.log('');
}

/**
 * 結果をJSONファイルに保存
 * @param results キャリブレーション結果
 * @param outputDir 出力ディレクトリ
 */
function saveResultsToFile(results: Map<string, CalibrationResult>, outputDir: string): void {
  try {
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 現在の日時をファイル名に使用
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `atr_calibration_${timestamp}.json`;
    const filepath = path.join(outputDir, filename);

    // 結果をオブジェクトに変換
    const resultsObj = Object.fromEntries(results);

    // JSONとして保存
    fs.writeFileSync(filepath, JSON.stringify(resultsObj, null, 2));

    console.log(`\n結果を保存しました: ${filepath}`);
  } catch (error) {
    logger.error(
      `結果の保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * メイン関数
 */
async function main() {
  try {
    // パラメータの取得
    const symbolsArg = argv.symbols;
    const timeframe = argv.timeframe;
    const outputJsonFile = argv.output;
    const outputDir = argv.outputDir;

    // シンボルリストを作成
    const symbols = symbolsArg.split(',').map((s) => s.trim());
    const timeframeHours = timeframeToHours(timeframe);

    logger.info(
      `${symbols.length}個のシンボルでATR%キャリブレーションを開始します (${timeframe})...`
    );

    // キャリブレーション用のキャンドルデータを取得
    const symbolsCandles = new Map<string, Candle[]>();

    for (const symbol of symbols) {
      logger.info(`${symbol}のデータを取得中...`);

      try {
        // データリポジトリからローソク足データを取得
        let candles = await dataRepository.getCandles(symbol, timeframe);

        // 十分なデータがあるか確認
        const minLookbackCandles = parameterService.get<number>('risk.minLookbackCandles', 30);

        if (!candles || candles.length < minLookbackCandles) {
          logger.warn(
            `${symbol}の十分なデータがありません: ${candles?.length || 0} < ${minLookbackCandles}`
          );
          continue;
        }

        // 指定されたルックバック期間に制限
        if (argv.lookback && candles.length > argv.lookback) {
          candles = candles.slice(-argv.lookback);
        }

        symbolsCandles.set(symbol, candles);
        logger.info(`${symbol}のデータを取得しました (${candles.length}件)`);
      } catch (error) {
        logger.error(
          `${symbol}のデータ取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // データを取得できたシンボルがあるか確認
    if (symbolsCandles.size === 0) {
      logger.error('キャリブレーションできるシンボルがありません。データを確認してください。');
      process.exit(1);
    }

    // キャリブレーション実行
    logger.info(`${symbolsCandles.size}個のシンボルでキャリブレーションを実行します...`);
    const results = atrCalibrator.calibrateMultipleSymbols(symbolsCandles, timeframeHours, false);

    // 結果を表示
    printResults(results);

    // 結果をJSONファイルに保存
    if (outputJsonFile) {
      saveResultsToFile(results, outputDir);
    }

    logger.info('キャリブレーション完了');
  } catch (error) {
    logger.error(
      `キャリブレーション中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

// スクリプト実行
main();
