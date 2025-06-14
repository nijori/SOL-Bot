/**
 * 複数取引所設定サンプルスクリプト
 *
 * このスクリプトは複数取引所の初期化と利用方法を示すサンプルです。
 * OMS-009: 複数取引所対応
 *
 * 使用方法:
 * npm run multi-exchange -- --config=config/multiExchangeConfig.example.json
 */

const { UnifiedOrderManager, AllocationStrategy } = require('../services/UnifiedOrderManager.js');
import { ExchangeService } from '../services/exchangeService.js';
import type { Order } from '../core/interfaces';
import { OrderSide, OrderType } from '../core/types';
import { SymbolInfoService } from '../services/symbolInfoService.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { ParameterService } from '../config/parameterService.js';

// コマンドライン引数のパース
const argv = yargs(hideBin(process.argv))
  .options({
    config: {
      alias: 'c',
      describe: '複数取引所設定ファイルのパス',
      type: 'string',
      default: 'src/config/multiExchangeConfig.example.json'
    },
    symbols: {
      alias: 's',
      describe: '処理対象のシンボル（カンマ区切り）',
      type: 'string',
      default: 'SOL/USDT'
    },
    mode: {
      alias: 'm',
      describe: '動作モード（demo: 実際に注文を出さない、live: 実際に注文を出す）',
      choices: ['demo', 'live'],
      default: 'demo'
    }
  })
  .help()
  .parseSync();

// 設定ファイルの読み込み
function loadConfig(configPath: string) {
  try {
    const fullPath = path.resolve(process.cwd(), configPath);
    const configData = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    logger.error(
      `設定ファイルの読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

// 環境変数置換処理
function replaceEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    // ${ENV_VAR} 形式の環境変数を置換
    return obj.replace(/\${([^}]+)}/g, (_, envName) => {
      return process.env[envName] || '';
    });
  } else if (Array.isArray(obj)) {
    return obj.map((item) => replaceEnvVars(item));
  } else if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceEnvVars(value);
    }
    return result;
  }
  return obj;
}

/**
 * 複数取引所の初期化と利用のメイン関数
 */
async function main() {
  // 設定の読み込みと環境変数置換
  logger.info(`設定ファイル ${argv.config} を読み込みます`);
  const rawConfig = loadConfig(argv.config);
  const config = replaceEnvVars(rawConfig);

  // 統合注文管理システムの初期化
  const allocationConfig = {
    strategy:
      config.allocation.strategy === 'CUSTOM'
        ? AllocationStrategy.CUSTOM
        : (AllocationStrategy as any)[config.allocation.strategy] || AllocationStrategy.PRIORITY,
    customRatios:
      config.allocation.strategy === 'CUSTOM'
        ? new Map(Object.entries(config.allocation.customRatios).map(([k, v]) => [k, Number(v)]))
        : undefined
  };

  const unifiedManager = new UnifiedOrderManager(allocationConfig);

  // 取引所の初期化とマネージャーへの登録
  const exchangeServices = new Map<string, ExchangeService>();
  const symbolInfoServices = new Map<string, SymbolInfoService>();

  for (const [exchangeId, exchangeConfig] of Object.entries(config.exchanges)) {
    try {
      logger.info(`取引所 ${exchangeId} を初期化中...`);

      const exchangeService = new ExchangeService();
      const initSuccess = await exchangeService.initialize(
        exchangeId,
        (exchangeConfig as any).apiKey,
        (exchangeConfig as any).secret
      );

      if (!initSuccess) {
        logger.error(`取引所 ${exchangeId} の初期化に失敗しました`);
        continue;
      }

      // 取引所サービスを保存
      exchangeServices.set(exchangeId, exchangeService);

      // 通貨ペア情報サービスを初期化
      const symbolInfoService = new SymbolInfoService(exchangeService);
      symbolInfoServices.set(exchangeId, symbolInfoService);

      // 統合管理システムに登録
      unifiedManager.addExchange(
        exchangeId,
        exchangeService,
        (exchangeConfig as any).priority || 100
      );

      // アクティブ設定を適用
      if ((exchangeConfig as any).active === false) {
        unifiedManager.setExchangeActive(exchangeId, false);
      }

      logger.info(
        `取引所 ${exchangeId} (${exchangeService.getExchangeName()}) の初期化が完了しました`
      );
    } catch (error) {
      logger.error(
        `取引所 ${exchangeId} の初期化エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // 対象シンボルの処理
  const symbols = argv.symbols.split(',').map((s) => s.trim());

  for (const symbol of symbols) {
    logger.info(`シンボル ${symbol} の情報を取得中...`);

    // 各取引所から通貨ペア情報を取得
    for (const [exchangeId, symbolInfoService] of symbolInfoServices.entries()) {
      try {
        // シンボルマッピングがある場合は使用
        const mappedSymbol =
          config.symbolMapping &&
          config.symbolMapping[symbol] &&
          config.symbolMapping[symbol][exchangeId]
            ? config.symbolMapping[symbol][exchangeId]
            : symbol;

        const symbolInfo = await symbolInfoService.getSymbolInfo(mappedSymbol);
        if (symbolInfo) {
          logger.info(
            `${exchangeId} の ${mappedSymbol} 情報: 最小注文量=${symbolInfo.minAmount}, 価格精度=${symbolInfo.pricePrecision}, 数量精度=${symbolInfo.amountPrecision}`
          );
        } else {
          logger.warn(`${exchangeId} の ${mappedSymbol} 情報を取得できませんでした`);
        }
      } catch (error) {
        logger.error(
          `${exchangeId} の ${symbol} 情報取得エラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // デモモードの場合はテスト注文を送信
    if (argv.mode === 'demo') {
      logger.info(`${symbol} のテスト注文をシミュレート（実際に発注しません）`);

      // テスト注文の作成
      const order: Order = {
        symbol,
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 100, // デモ用の仮の価格
        amount: 1 // デモ用の仮の数量
      };

      // 注文配分のシミュレーション（実際には発注しない）
      const allocatedOrders = (unifiedManager as any).allocateOrder(order);

      logger.info('注文配分結果:');
      for (const [exchangeId, allocatedOrder] of allocatedOrders.entries()) {
        logger.info(
          `${exchangeId}: ${allocatedOrder.side} ${allocatedOrder.amount} ${allocatedOrder.symbol} @ ${allocatedOrder.price}`
        );
      }
    } else if (argv.mode === 'live') {
      logger.warn(`ライブモードは実際に注文を発注します。このサンプルでは無効化されています。`);
      // 実際の運用では、ここで実際の注文を行うコードを実装
    }
  }

  // 複数取引所のポジション統合例
  for (const symbol of symbols) {
    logger.info(`${symbol} の統合ポジション情報:`);

    const positions = unifiedManager.getAllPositions(symbol);
    if (positions.size === 0) {
      logger.info(`${symbol} のポジションはありません`);
    } else {
      for (const [exchangeId, exchangePositions] of positions.entries()) {
        for (const position of exchangePositions) {
          logger.info(
            `${exchangeId}: ${position.side} ${position.amount} @ ${position.entryPrice}, PnL: ${position.unrealizedPnl}`
          );
        }
      }

      // 統合ポジション
      const totalPosition = unifiedManager.getTotalPosition(symbol);
      if (totalPosition) {
        logger.info(
          `統合ポジション: ${totalPosition.side} ${totalPosition.size} @ ${totalPosition.entryPrice}, PnL: ${totalPosition.unrealizedPnl}`
        );
      }
    }
  }

  // 終了メッセージ
  logger.info('複数取引所サンプルの実行が完了しました');
}

// スクリプト実行
main().catch((error) => {
  logger.error(`実行エラー: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
