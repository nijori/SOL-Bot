/**
 * REF-031検証スクリプト
 * 
 * tsconfig.build.jsonが正しく設定され、CommonJSビルドが正常に
 * 動作することを検証します。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 検証結果
const results = {
  pass: [],
  fail: []
};

console.log('REF-031検証を開始します');
console.log('===============================');

// テスト1: CJSビルドの実行
try {
  console.log('テスト1: CommonJSビルドの実行');
  execSync('npm run build:cjs', { stdio: 'inherit' });
  results.pass.push('CommonJSビルドが正常に実行されました');
} catch (error) {
  results.fail.push('CommonJSビルドに失敗しました');
  console.error(error);
}

// テスト2: importMetaHelperの検証
try {
  console.log('\nテスト2: importMetaHelperモジュールの検証');
  
  const helperPath = path.join(__dirname, '../dist/utils/importMetaHelper.js');
  
  if (fs.existsSync(helperPath)) {
    results.pass.push('importMetaHelperモジュールが正常にビルドされました');
  } else {
    results.fail.push('importMetaHelperモジュールのビルドに失敗しました');
  }
  
  // ヘルパーの内容を確認
  const content = fs.readFileSync(helperPath, 'utf8');
  
  if (content.includes('getCurrentFileUrl') && 
      content.includes('isMainModule') && 
      content.includes('resolvePathFromCurrent')) {
    results.pass.push('importMetaHelperに必要な関数が含まれています');
  } else {
    results.fail.push('importMetaHelperに必要な関数が含まれていません');
  }
} catch (error) {
  results.fail.push('importMetaHelperの検証に失敗しました');
  console.error(error);
}

// テスト3: tsconfig.build.jsonの検証
try {
  console.log('\nテスト3: tsconfig.build.jsonの検証');
  
  const tsconfigPath = path.join(__dirname, '../tsconfig.build.json');
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  
  if (tsconfig.compilerOptions.module === 'commonjs') {
    results.pass.push('tsconfig.build.jsonのmodule設定が正しく「commonjs」に設定されています');
  } else {
    results.fail.push(`tsconfig.build.jsonのmodule設定が「${tsconfig.compilerOptions.module}」になっています（「commonjs」が期待値）`);
  }
  
  if (tsconfig.compilerOptions.moduleResolution === 'Node') {
    results.pass.push('tsconfig.build.jsonのmoduleResolution設定が正しく「Node」に設定されています');
  } else {
    results.fail.push(`tsconfig.build.jsonのmoduleResolution設定が「${tsconfig.compilerOptions.moduleResolution}」になっています（「Node」が期待値）`);
  }
} catch (error) {
  results.fail.push('tsconfig.build.jsonの検証に失敗しました');
  console.error(error);
}

// 結果の表示
console.log('\n===============================');
console.log('検証結果:');

if (results.pass.length > 0) {
  console.log('\n✅ 成功項目:');
  results.pass.forEach((msg, i) => {
    console.log(`  ${i+1}. ${msg}`);
  });
}

if (results.fail.length > 0) {
  console.log('\n❌ 失敗項目:');
  results.fail.forEach((msg, i) => {
    console.log(`  ${i+1}. ${msg}`);
  });
}

console.log('\n===============================');

if (results.fail.length > 0) {
  console.log(`❌ REF-031検証: ${results.fail.length}件の問題が見つかりました`);
  process.exit(1);
} else {
  console.log('✅ REF-031検証: すべてのテストに合格しました!');
} 