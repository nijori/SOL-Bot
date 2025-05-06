/**
 * P0修正後のバックテスト検証用スモークテスト
 * 
 * このスクリプトは以下を実行します：
 * 1. 3日間のSOLUSDTデータでバックテストを実行
 * 2. 結果が特定の閾値を満たしているか検証
 * 3. 重要なメトリクスをレポート
 */
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 検証用の閾値
const THRESHOLDS = {
  MIN_PROFIT_FACTOR: 0.8,  // 最低利益率（負けてもあまりに大きく負けないこと）
  MAX_DRAWDOWN: 30,        // 最大許容ドローダウン（%）
  MIN_SHARPE: -1.0,        // 最低シャープレシオ（極端に悪くないこと）
  MIN_TRADES: 3            // 最低取引数（少なくともいくつかの取引が発生すること）
};

// 出力ファイルパス
const OUTPUT_DIR = path.resolve(__dirname, '../../data/metrics');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'smoke_test_result.json');

/**
 * スモークテストを実行する
 */
async function runSmokeTest(): Promise<void> {
  console.log('🔍 P0バグ修正後の検証スモークテストを開始...');
  
  try {
    // 出力ディレクトリが存在しない場合は作成
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // バックテストのスモークテストコマンド実行
    console.log('⚙️ バックテスト実行中...');
    const { stdout, stderr } = await execAsync('npm run backtest:smoke -- --output ' + OUTPUT_FILE);
    
    // エラーがあれば表示（ATR警告は無視）
    const isFatalError = stderr && 
                       !stderr.includes('ExperimentalWarning') && 
                       !stderr.includes('ATR配列') && // ATRに関するエラーは無視
                       stderr.includes('Error:'); // 実際のエラーが含まれているか
    
    if (isFatalError) {
      console.error('❌ バックテスト実行エラー:');
      console.error(stderr);
      process.exit(1);
    }
    
    console.log('✅ バックテスト完了');
    
    // 結果ファイルが存在するか確認
    if (!fs.existsSync(OUTPUT_FILE)) {
      console.error('❌ 結果ファイルが生成されませんでした: ' + OUTPUT_FILE);
      // テスト用のダミー結果ファイルを生成
      const dummyResults = {
        metrics: {
          totalReturn: 0.0,
          winRate: 0.0,
          maxDrawdown: 0.0,
          sharpeRatio: 0.0,
          profitFactor: 0.0,
          calmarRatio: 0.0,
          averageWin: 0.0,
          averageLoss: 0.0
        },
        trades: [],
        parameters: {
          slippage: 0.001,
          commissionRate: 0.001
        }
      };
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dummyResults, null, 2));
      console.log('⚠️ ダミーの結果ファイルを生成しました');
    }
    
    // 結果を読み込んで検証
    console.log('🔍 テスト結果を検証中...');
    let results;
    try {
      results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    } catch (parseError) {
      console.error('❌ 結果ファイルの解析に失敗しました:', parseError);
      // 最小限の結果オブジェクトを作成
      results = {
        metrics: {
          totalReturn: 0.0,
          winRate: 0.0,
          maxDrawdown: 0.0,
          sharpeRatio: 0.0,
          profitFactor: 0.0,
          calmarRatio: 0.0,
          averageWin: 0.0,
          averageLoss: 0.0
        },
        trades: [],
        parameters: {
          slippage: 0.001,
          commissionRate: 0.001
        }
      };
    }
    
    // 結果の検証
    const validationResults = validateResults(results);
    
    // レポート表示
    reportResults(results, validationResults);
    
    // 検証に失敗した場合は終了コード1で終了
    if (!validationResults.allPassed) {
      console.error('❌ スモークテストに失敗しました');
      process.exit(1);
    }
    
    console.log('✅ スモークテスト完了 - すべての検証に合格しました');
    
  } catch (error) {
    console.error('❌ スモークテスト実行エラー:', error);
    process.exit(1);
  }
}

/**
 * テスト結果を検証する
 */
function validateResults(results: any): { 
  allPassed: boolean;
  profitFactorPassed: boolean;
  drawdownPassed: boolean;
  sharpePassed: boolean;
  tradesPassed: boolean;
} {
  const { metrics, trades } = results;
  
  // 各閾値に対する検証
  const profitFactorPassed = metrics.profitFactor >= THRESHOLDS.MIN_PROFIT_FACTOR;
  const drawdownPassed = metrics.maxDrawdown <= THRESHOLDS.MAX_DRAWDOWN;
  const sharpePassed = metrics.sharpeRatio >= THRESHOLDS.MIN_SHARPE;
  const tradesPassed = trades.length >= THRESHOLDS.MIN_TRADES;
  
  // すべての検証に合格したかどうか
  const allPassed = profitFactorPassed && drawdownPassed && sharpePassed && tradesPassed;
  
  return {
    allPassed,
    profitFactorPassed,
    drawdownPassed,
    sharpePassed,
    tradesPassed
  };
}

/**
 * テスト結果をレポートする
 */
function reportResults(results: any, validation: any): void {
  const { metrics, trades, parameters } = results;
  
  console.log('\n📊 スモークテスト結果 📊');
  console.log('------------------------------');
  console.log(`総利益率:        ${metrics.totalReturn.toFixed(2)}%`);
  console.log(`取引数:          ${trades.length} 件`);
  console.log(`勝率:            ${metrics.winRate.toFixed(2)}%`);
  console.log(`最大ドローダウン: ${metrics.maxDrawdown.toFixed(2)}%`);
  console.log(`シャープレシオ:   ${metrics.sharpeRatio.toFixed(3)}`);
  console.log(`プロフィットファクター: ${metrics.profitFactor.toFixed(3)}`);
  console.log(`カルマーレシオ:   ${metrics.calmarRatio.toFixed(3)}`);
  console.log(`平均利益:        ${metrics.averageWin.toFixed(2)}`);
  console.log(`平均損失:        ${metrics.averageLoss.toFixed(2)}`);
  console.log('------------------------------');
  
  // スリッページと手数料の設定
  console.log(`スリッページ:     ${parameters.slippage * 100}%`);
  console.log(`取引手数料:       ${parameters.commissionRate * 100}%`);
  console.log('------------------------------');
  
  // 検証結果
  console.log('\n🔍 検証結果 🔍');
  console.log(`プロフィットファクター: ${validation.profitFactorPassed ? '✅' : '❌'} (${metrics.profitFactor.toFixed(3)} >= ${THRESHOLDS.MIN_PROFIT_FACTOR})`);
  console.log(`最大ドローダウン: ${validation.drawdownPassed ? '✅' : '❌'} (${metrics.maxDrawdown.toFixed(2)}% <= ${THRESHOLDS.MAX_DRAWDOWN}%)`);
  console.log(`シャープレシオ: ${validation.sharpePassed ? '✅' : '❌'} (${metrics.sharpeRatio.toFixed(3)} >= ${THRESHOLDS.MIN_SHARPE})`);
  console.log(`取引数: ${validation.tradesPassed ? '✅' : '❌'} (${trades.length} >= ${THRESHOLDS.MIN_TRADES})`);
  console.log('------------------------------');
  console.log(`総合評価: ${validation.allPassed ? '✅ 合格' : '❌ 不合格'}`);
}

// スクリプトのエントリーポイント
if (require.main === module) {
  runSmokeTest();
}

export { runSmokeTest };