#!/usr/bin/env node
/**
 * マルチシンボルバックテスト実行スクリプト
 *
 * CORE-005: backtestRunnerとtradingEngineのマルチシンボル対応拡張
 *
 * 使用例:
 * npm run backtest:multi -- --symbols SOL/USDT,BTC/USDT --timeframe 4 --start-date 2023-01-01 --end-date 2023-05-01
 */

import { MultiSymbolBacktestRunner } from '../core/multiSymbolBacktestRunner.js';
import { AllocationStrategy } from '../types/multiSymbolTypes.js';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../utils/logger.js';

// メイン処理
async function main() {
  try {
    await MultiSymbolBacktestRunner.runFromCli();
  } catch (error) {
    logger.error('マルチシンボルバックテスト実行エラー:', error);
    process.exit(1);
  }
}

// スクリプト実行
main();
