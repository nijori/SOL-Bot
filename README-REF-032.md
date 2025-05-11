# REF-032: テストファイルのインポートパス修正

## 概要

このタスクでは、テストファイル内のインポートパスを修正するスクリプトを実装しました。特に`__broken_mjs__`ディレクトリ内のファイルに見られる壊れたインポートパスパターンを自動検出し、修正する機能を提供します。

## 実装内容

1. **修正パターン**
   - `'../../.js''core/types''.js'` → `'../../core/types'`
   - `'../../'core/types'.js'` → `'../../core/types'`
   - `from '../../path.js'` → `from '../../path'` (.js拡張子の除去)
   - `jest.mock('../../''data/path''.js')` → `jest.mock('../../data/path')`
   - 壊れた型名の修正: `OrderType"` → `OrderType`

2. **スクリプト**
   - `fix-test-imports.js` - 本番用スクリプト
   - `fix-test-imports-dry-run.js` - ドライラン用スクリプト（実際にファイルを変更せず差分のみ表示）

3. **NPMスクリプト**
   - `npm run fix:test-imports` - パス修正の実行
   - `npm run fix:test-imports:dry` - ドライランの実行

## 使用方法

1. ドライランモードで実行して変更箇所を確認:
   ```bash
   npm run fix:test-imports:dry
   ```

2. 問題なければ本番実行:
   ```bash
   npm run fix:test-imports
   ```

## 安全対策

- Gitブランチを使用して安全に変更: `refactor/REF-032-test-imports`
- ドライランモードで事前に変更内容を確認
- 実行結果の詳細なレポート出力（処理ファイル数、変更ファイル数、エラー数など）

## 今後の改善

- テスト実行時の状況を継続的に監視し、さらなるパターンの追加
- テスト安定性向上のためのESM/CommonJS混在環境対応
- 長時間実行テストの最適化

## 参照

- `src/scripts/fix-test-imports.js`
- `src/scripts/fix-test-imports-dry-run.js`
- `esm-migration-issues.md` REF-032セクション 