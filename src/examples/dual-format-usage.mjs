/**
 * ESMからSOL-Botライブラリを使用する例
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

// ESM形式でライブラリをインポート
import { 
  TradingEngine, 
  BacktestRunner, 
  TrendFollowStrategy, 
  MeanReversionStrategy,
  logger
} from '../../dist/index.mjs';

// 個別モジュールからの直接インポート
import { OrderManagementSystem } from '../../dist/core/index.mjs';
import * as atrUtils from '../../dist/utils/atrUtils.js';

// ESM/CJS互換ヘルパーのインポート
import { require, __dirname, isESMEnvironment } from '../../dist/utils/esm-compat.mjs';

async function main() {
  console.log('ESM環境からSOL-Botライブラリを使用する例');
  
  try {
    // 環境確認
    console.log(`実行環境: ${isESMEnvironment() ? 'ESM' : 'CommonJS'}`);
    console.log(`__dirname: ${__dirname}`);
    
    // TradingEngineの使用
    const engine = new TradingEngine({
      symbol: 'SOL/USDT',
      initialBalance: 1000
    });
    console.log(`トレーディングエンジンを作成: ${engine.getSymbol()}`);
    
    // BacktestRunnerの使用
    const runner = new BacktestRunner({
      symbol: 'SOL/USDT',
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-01-31')
    });
    console.log(`バックテストランナーを作成: ${runner.getConfig().symbol}`);
    
    // 戦略の使用
    const trendStrategy = new TrendFollowStrategy({ symbol: 'SOL/USDT' });
    const reversionStrategy = new MeanReversionStrategy({ symbol: 'SOL/USDT' });
    console.log(`戦略を作成: ${trendStrategy.constructor.name}, ${reversionStrategy.constructor.name}`);
    
    // OMSの使用
    const oms = new OrderManagementSystem();
    console.log(`OMSを作成: ${oms.constructor.name}`);
    
    // ATRユーティリティの使用
    console.log(`ATR計算関数を取得: ${typeof atrUtils.calculateATR === 'function' ? 'Success' : 'Failed'}`);
    
    // requireを使用してCommonJSモジュールをロード（ESM環境から）
    const fs = require('fs');
    console.log(`requireでfsモジュールをロード: ${typeof fs.readFileSync === 'function' ? 'Success' : 'Failed'}`);
    
    // loggerの使用
    logger.info('ESMからのログ出力テスト');
    
    console.log('ESM環境から全モジュールを正常に使用できました。');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

// スクリプトを実行
main().catch(err => console.error('トップレベルエラー:', err)); 