/**
 * CommonJSからSOL-Botライブラリを使用する例
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

// ライブラリをCommonJSスタイルでインポート
const solbot = require('../../dist/index.js');

async function main() {
  console.log('CommonJS環境からSOL-Botライブラリを使用する例');
  
  try {
    // モジュールを初期化（ESMモジュールの非同期ロード）
    const modules = await solbot.initModules();
    
    // トレーディングエンジンを使用
    const { TradingEngine } = modules.tradingEngine;
    const engine = new TradingEngine({
      symbol: 'SOL/USDT',
      initialBalance: 1000
    });
    
    console.log(`トレーディングエンジンを作成: ${engine.getSymbol()}`);
    
    // 戦略の使用
    const { TrendFollowStrategy } = modules.strategies.trendFollowStrategy;
    const strategy = new TrendFollowStrategy({
      symbol: 'SOL/USDT'
    });
    
    console.log(`戦略を作成: ${strategy.constructor.name}`);
    
    // ユーティリティの使用
    const { calculateATR } = modules.utils.atrUtils;
    console.log('ATR計算関数を取得:', calculateATR ? 'Success' : 'Failed');
    
    // logger使用例
    const { logger } = modules;
    logger.info('CommonJSからのログ出力テスト');
    
    console.log('CommonJS環境から全モジュールを正常にロードできました。');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

// スクリプトを実行
main().catch(err => console.error('トップレベルエラー:', err)); 