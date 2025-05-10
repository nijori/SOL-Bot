/**
 * テスト実行後のクリーンアップスクリプト
 * REF-023: テスト実行フローのESM対応
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// テスト用の一時ディレクトリをクリーンアップ
const testDirs = [path.join(rootDir, 'data', 'test-e2e'), path.join(rootDir, 'data', 'test')];

console.log('🧹 テスト用一時ディレクトリをクリーンアップしています...');

for (const dir of testDirs) {
  if (fs.existsSync(dir)) {
    try {
      // ディレクトリ内のすべてのファイルを削除
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          // サブディレクトリを再帰的に処理（必要に応じて実装）
          // 現在はトップレベルのファイルのみ削除
        } else {
          fs.unlinkSync(filePath);
          console.log(`  削除: ${filePath}`);
        }
      }
      console.log(`✅ ${dir} をクリーンアップしました`);
    } catch (err) {
      console.error(`❌ ${dir} のクリーンアップ中にエラーが発生しました:`, err);
    }
  }
}

// テスト時に作成される可能性のある一時ファイルのパターン
const tempFilesPattern = [
  path.join(rootDir, 'temp-*'),
  path.join(rootDir, '*.lock'),
  path.join(rootDir, 'test-*.json')
];

// 将来的に特定の一時ファイルを削除する必要がある場合はここに実装

console.log('✅ クリーンアップが完了しました');
