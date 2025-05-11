/**
 * examples/dual-format-usage.js
 * CommonJSからソルボットモジュールを使用する例
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

// CommonJSスタイルのインポート
const solBot = require('../index.js');
const core = require('../core/index.js');

// メインの処理関数
async function main() {
  console.log('CommonJSからソルボットモジュールを使用するサンプル');
  
  try {
    // モジュールの初期化が必要
    console.log('モジュールを初期化中...');
    await solBot.initModules();
    
    // コアモジュールのロード
    console.log('コアモジュールを初期化中...');
    await core.initCoreModules();
    
    // モジュールの使用例
    console.log('\n使用例：');
    
    // トレーディングエンジンのクラスを取得
    const TradingEngine = solBot.tradingEngine.TradingEngine;
    console.log('- トレーディングエンジンクラスを取得: ', typeof TradingEngine === 'function' ? 'OK' : 'エラー');
    
    // BacktestRunnerのクラスを取得
    const BacktestRunner = core.backtestRunner.BacktestRunner;
    console.log('- バックテストランナークラスを取得: ', typeof BacktestRunner === 'function' ? 'OK' : 'エラー');
    
    // 注文種別を取得
    const OrderType = solBot.types.OrderType;
    console.log('- 注文種別を取得: ', OrderType ? 'OK' : 'エラー');
    
    console.log('\nテスト完了 - CommonJSからのモジュール利用が正常に動作しています');
    
  } catch (err) {
    console.error('エラーが発生しました:', err);
  }
}

// スクリプトの実行
main().catch(err => {
  console.error('実行エラー:', err);
  process.exit(1);
}); 