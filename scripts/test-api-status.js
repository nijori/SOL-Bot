/**
 * /api/status エンドポイントのテストスクリプト
 * 
 * 使用方法:
 * node scripts/test-api-status.js [host] [port]
 * 
 * デフォルト値:
 * host: localhost
 * port: 3000
 */

const http = require('http');

// コマンドライン引数の処理
const host = process.argv[2] || 'localhost';
const port = process.argv[3] || '3000';

console.log(`${host}:${port}/api/status エンドポイントをテスト中...`);

// リクエストオプション
const options = {
  hostname: host,
  port: port,
  path: '/api/status',
  method: 'GET',
  timeout: 5000 // 5秒タイムアウト
};

// APIリクエストの実行
const req = http.request(options, (res) => {
  console.log(`ステータスコード: ${res.statusCode}`);
  
  let data = '';
  
  // データ受信イベント
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  // レスポンス完了イベント
  res.on('end', () => {
    try {
      const jsonResponse = JSON.parse(data);
      console.log('レスポンス内容:');
      console.log(JSON.stringify(jsonResponse, null, 2));
      
      // ステータスの確認
      if (jsonResponse.status === 'running') {
        console.log('\n✅ テスト成功: API エンドポイントは正常に動作しています');
        process.exit(0);
      } else {
        console.log('\n❌ テスト失敗: ステータスが "running" ではありません');
        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ テスト失敗: JSONの解析に失敗しました', error.message);
      process.exit(1);
    }
  });
});

// エラーイベント
req.on('error', (error) => {
  console.error('\n❌ テスト失敗: リクエストエラー', error.message);
  process.exit(1);
});

// タイムアウト処理
req.on('timeout', () => {
  console.error('\n❌ テスト失敗: リクエストタイムアウト');
  req.destroy();
  process.exit(1);
});

// リクエスト終了
req.end(); 