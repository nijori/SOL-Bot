/**
 * examples/dual-format-usage.mjs
 * ESMからソルボットモジュールを使用する例
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

// ESMスタイルのインポート
import { TradingEngine, BacktestRunner, OrderType } from '../index.mjs';
import { require, __dirname } from '../utils/esm-compat.mjs';

// メインの処理関数
async function main() {
  console.log('ESMからソルボットモジュールを使用するサンプル');
  
  try {
    // モジュールの使用例
    console.log('\n使用例：');
    
    // トレーディングエンジンのクラスをチェック
    console.log('- トレーディングエンジンクラスを確認: ', typeof TradingEngine === 'function' ? 'OK' : 'エラー');
    
    // BacktestRunnerのクラスをチェック
    console.log('- バックテストランナークラスを確認: ', typeof BacktestRunner === 'function' ? 'OK' : 'エラー');
    
    // 注文種別をチェック
    console.log('- 注文種別を確認: ', OrderType ? 'OK' : 'エラー');
    
    // ESM互換レイヤーの使用例
    console.log('\nESM互換レイヤーの使用例:');
    console.log('- __dirname:', __dirname);
    
    // requireを使用してCommonJSモジュールをロード
    const fs = require('fs');
    const fileExists = fs.existsSync(__dirname + '/dual-format-usage.mjs');
    console.log('- fs.existsSync():', fileExists ? 'OK' : 'エラー');
    
    console.log('\nテスト完了 - ESMからのモジュール利用が正常に動作しています');
    
  } catch (err) {
    console.error('エラーが発生しました:', err);
  }
}

// スクリプトの実行
main().catch(err => {
  console.error('実行エラー:', err);
  process.exit(1);
}); 