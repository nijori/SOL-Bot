# REF-022: ESM移行中に見つかった問題点と解決すべき課題

## 主な問題点

1. **型アノテーションの削除不備**

   - 関数パラメータ、変数宣言などで一部の型情報が正しく削除されていない
   - 特に複雑な型定義やジェネリック型で問題が発生
   - 解決策: 正規表現パターンの改善と変換スクリプトの堅牢化

2. **関数パラメータの括弧閉じ忘れ**

   - mockImplementation関数などで構文エラーが発生
   - 特にアロー関数を含む場合に問題が発生
   - 解決策: 閉じ括弧の検出と追加のロジック改善

3. **モックの設定が正しく機能しない**

   - OrderManagementSystem.prototype.setExchangeServiceなどが正しくモック化されていない
   - jest.mockの変換が不完全な場合がある
   - 解決策: モック関数の変換処理の強化とテスト別の手動調整

4. **テストプロセスが終了しない**
   - "Jest did not exit one second after the test run has completed"エラー
   - 非同期処理が正しくクリーンアップされていない
   - 解決策: --detectOpenHandlesフラグを使用して問題箇所を特定し、非同期処理のクリーンアップを実装

## REF-023: テスト実行フローのESM対応

REF-023タスクでは、テスト実行フローのESM対応を行いました。主な成果物は以下の通りです：

1. **テスト実行スクリプトの整備**

   - `setup-esm-test-flow.js` - ESM対応のテスト実行環境を設定するスクリプト
   - `run-esm-tests.js` - ESMテストファイルを実行するためのカスタムランナー
   - `cleanup-test-resources.js` - テスト用リソースをクリーンアップするスクリプト

2. **package.jsonのテストスクリプト拡張**

   - `test:esm` - ESMテストファイルのみを実行
   - `test:runner` - カスタムランナーを使用してESMテストを実行
   - `test:detect-handles` - オープンハンドル検出付きでテスト実行
   - `test:debug` - デバッグモードでテスト実行
   - `test:cleanup` - テスト用リソースのクリーンアップ

3. **テスト関連の最適化**

   - Node.jsのESMフラグ設定
   - テスト実行時のタイムアウト設定
   - 非同期処理のクリーンアップ強化

4. **CI/CD対応**
   - GitHub Actionsワークフローでのテスト実行コマンド更新
   - テストプロセスの終了検知改善

## REF-024: ESM型アノテーション削除の最終処理

REF-024タスクでは、変換済みの.mjsファイルに残っている型アノテーションを完全に削除するための最終処理を実施しました。

1. **enhance-mjs-cleanup.jsスクリプトの開発**

   - .mjsファイル内の型アノテーションを自動検出して削除するスクリプトを作成
   - 変換統計（処理ファイル数、修正ファイル数、エラー数）の表示機能も実装
   - 再帰的なファイル検索機能によるテストディレクトリ内の全.mjsファイルの処理

2. **型アノテーション削除パターンの強化**

   - ジェネリック型パラメータの削除 (`ClassName<Type>` → `ClassName`)
   - メソッド戻り値の型アノテーション除去 (`method(): ReturnType {` → `method() {`)
   - 関数パラメータの型アノテーション削除 (`function(param: Type)` → `function(param)`)
   - オブジェクト定義内の型アノテーション削除 (`property: Type,` → `property,`)
   - アロー関数の戻り値型アノテーション削除 (`): ReturnType =>` → `) =>`)

3. **文字列リテラルと構文エラーの修正**

   - "Position""のような壊れた文字列リテラルの修正
   - symbol/USDTのような壊れた通貨ペア文字列の修正
   - 数値*演算子のスペース修正 (`open*0.99`→`open \* 0.99`)
   - symbol'BTC/USDT'のような壊れた構文の修正
   - 壊れた三項演算子の修正

4. **処理実績**

   - 合計24個の.mjsファイルをすべて処理
   - 24個すべてのファイルで型アノテーションを除去・文法修正
   - 残りの問題は主にインポート文とパスに集中していることを確認

5. **今後の課題と新規タスク**
   - インポートパスの問題（相対パスと拡張子）→ REF-027として新規タスク化
     - 例: `'../../'core/types: '.js'` のようなパス正規化
     - 例: `from '@'jest/globals''` のようなパス修正
   - テスト用ライブラリのESM対応 → REF-028として新規タスク化
     - "jest is not defined" エラーの解決
     - jest.mockのESM対応
     - ts/mjsファイル混在環境での互換性向上
   - CommonJSとESMが混在するモジュールの参照問題
     - ファイル拡張子の明示的指定の徹底
     - import/requireの混在防止

REF-024の作業自体は完了しましたが、実際のテスト実行中に上記の新しい問題が見つかったため、これらは別のタスクとして追跡することになりました。型アノテーション関連の問題は解消されましたが、ESM移行全体のプロセスはまだ継続中で、残りの作業はREF-027、REF-028などの追加タスクで対応する予定です。

## REF-025: ESMテスト安定性の向上

REF-025タスクでは、ESMテストの安定性向上に重点を置いて、クリーンアップヘルパーやテスト実行環境の改善を行いました。

1. **クリーンアップユーティリティの作成**

   - `test-cleanup-utils.js` - 非同期処理やリソースのクリーンアップ用ユーティリティ
   - `cleanupAsyncOperations` 関数によるタイマーやプロミスの適切なクリーンアップ
   - プロセスのイベントリスナー削除機能の追加

2. **テスト環境セットアップの強化**

   - `jest-setup-esm.js` - タイマーやリスナーなどを自動クリーンアップする機能
   - グローバルタイマー追跡システムの実装
   - イベントリスナー、非同期操作の自動検出と管理

3. **テストランナーの安定性向上**

   - `run-esm-tests-safely.js` - ハング検出と強制終了機能を追加
   - テストタイムアウト機能の実装
   - 環境変数の自動設定

4. **共通パターンの確立**
   - afterAllフックでのクリーンアップ標準化
   - テスト間の分離を強化
   - 非同期処理の正しいクリーンアップパターンの標準化

REF-025の実装により、「Jest did not exit」エラーの発生頻度が大幅に減少し、テスト実行の安定性が著しく向上しました。

## REF-026: ESMテスト用CI/CD最適化

REF-026タスクでは、ESMテスト実行のためのCI/CD環境を最適化し、効率的なテスト実行パイプラインを構築しました。

1. **GitHub Actionsワークフローの作成**

   - `esm-tests.yml` - ESMテスト専用の新しいワークフローを実装
   - マトリックス戦略による複数環境での並列実行（Node.js 18.x/20.xとcore/data/strategies/services/utils）
   - テスト失敗時も他のグループは継続実行する`fail-fast: false`設定
   - 手動トリガー機能によるテストパターン指定オプション

2. **キャッシュ戦略の最適化**

   - node_modules、npm、Jest キャッシュの効率的な管理
   - 依存関係ごとにキャッシュを分離し再利用率を向上

3. **カバレッジレポート機能の強化**

   - テストグループごとのカバレッジレポート生成
   - `merge-coverage`ジョブによる複数レポートの統合
   - PR時のカバレッジサマリー自動コメント機能

4. **通知システムの改善**

   - テスト結果をDiscordに自動通知
   - 成功/失敗ステータスに応じたフォーマット
   - テスト完了時刻や実行者情報の記録

5. **環境設定の統一化**

   - `.github/actions-env.yml` - CI/CD環境変数を一元管理する設定ファイル
   - テスト、ビルド、デプロイの各フェーズに最適化された設定
   - タイムアウトやメモリ設定の標準化

6. **CI環境セットアップの自動化**
   - `ci-esm-setup.js` - CI環境でのテスト実行環境を自動準備
   - 必要なディレクトリ作成とパーミッション設定
   - GitHub Actions環境の自動検出と最適化

REF-026の実装により、テスト実行時間が短縮され、並列処理による効率化が実現しました。カバレッジレポートの生成と保存も自動化され、テスト品質の可視化が向上しました。また、CI/CDパイプラインの信頼性が向上し、安定したテスト実行環境が構築されました。

## REF-027: ESMインポートパス問題修正

REF-027タスクでは、ESM変換後の.mjsファイルに残っていた壊れたインポートパスを修正するためのスクリプトを開発・実装しました。

1. **fix-esm-import-paths.jsスクリプトの開発**

   - ESM変換後の.mjsファイルのインポートパス問題を自動検出・修正するスクリプトを作成
   - globパッケージを使用して再帰的にソースファイルを検索
   - 詳細な処理統計（処理ファイル数、修正ファイル数、スキップ数、エラー数）の表示機能も実装
   - 修正されたファイルの一覧表示機能

2. **修正パターンの実装**

   - 一般的なパターン修正:
     - `'path: '` → `'path'` のような余分なコロンとスペースの削除
     - `__dirname"` → `__dirname` のような壊れた文字列リテラルの修正
     - `'../../'path/to/module''` → `'../../path/to/module.js'` のような壊れたパスの連結を修正
     - `'@'jest/globals''` → `'@jest/globals'` のような壊れたパッケージ参照を修正
   - jest関連の修正:
     - `jest.mock('module', () => { return { __esModule'` → `jest.mock('module', () => { return { __esModule: true`
     - `}, { virtual' });` → `}, { virtual: true });` のような壊れたオブジェクト定義を修正
   - その他の構文修正:
     - `execute).mockResolvedValue({ signals)` → `execute).mockResolvedValue({ signals: [] })`
     - `MeanReversionStrategy;` → `MeanReversionStrategy: jest.fn()`

3. **よく発生する特定パスの直接修正**

   - `'../../'strategies/meanReversionStrategy''` → `'../../strategies/meanReversionStrategy.js'`
   - `'../../'strategies/DonchianBreakoutStrategy''` → `'../../strategies/DonchianBreakoutStrategy.js'`

4. **package.jsonの拡張**

   - `fix:esm-imports` スクリプトを追加し、コマンドラインから容易に実行可能に
   - 他のESM関連スクリプトとの連携を強化

5. **実行結果**
   - 全24個の.mjsファイルを処理
   - 18個のファイルでインポートパスやその他の構文問題を修正
   - 残りの6個のファイルは問題なしと判断
   - 特にsetupJest.mjs、meanRevertStrategy.test.mjsなどの複雑なファイルの問題を解消

REF-027の実装により、ESM環境でのモジュール解決問題が大幅に減少し、テスト実行時のエラーが減りました。特に「Cannot find module」や「Unexpected token」などのエラーが解消され、テスト実行の安定性が向上しました。また、拡張子を明示的に付与することでESM環境でのモジュール解決の信頼性が向上しました。

## REF-028: Jestモック関数のESM対応

REF-028タスクでは、ESM環境でのJestモック関数の問題を解決し、テスト実行の安定性を向上させました。

1. **fix-jest-mocks-for-esm.jsスクリプトの開発**

   - .mjsテストファイル内のJestモック関数をESM環境に適合させるスクリプトを作成
   - 主な処理内容:
     - jest.mockの修正（requireMockからimportMockへの変換）
     - モック定義の修正（module.exportsからESM exportへの変換）
     - jest関数呼び出しの修正
     - モック実装の修正
   - パターン修正機能：
     - `jest.mock('module', () => { ... })` 呼び出しの修正
     - モジュールパスへの.js拡張子の追加
     - `__esModule: true`フラグの適切な設定
     - 壊れたモック実装の修正（例: `execute).mockResolvedValue({ signals) })`）

2. **export-esm-mock.mjsヘルパーユーティリティの作成**

   - ESM環境でのモック作成を簡略化するヘルパー関数群
   - 主要機能:
     - `mockModule`: モジュールをモック化するヘルパー関数
     - `createMockFactory`: モック実装を返すファクトリ関数
     - `createSimpleMock`: シンプルなモック実装（メソッドの返り値を指定）
     - `createMultiMock`: 複数クラスのモック化

3. **モックファイルのESM形式変換**

   - CommonJSのモックファイル（module.exports）をESM形式（export const）に変換
   - import { jest } from '@jest/globals' の適切な追加
   - 同一ディレクトリに.mjsファイルとして保存

4. **setupJest.mjsの修正**

   - 壊れた関数宣言の修正（$1関数 → mockModuleHelper関数）
   - 壊れたオブジェクト構文の修正（**esModule, → **esModule: true,）
   - 壊れたプロパティ参照の修正（[moduleName] → [$1]）
   - 壊れたjest.mock呼び出しの修正
   - モック実装の修正（execute).mockResolvedValue → execute: jest.fn().mockResolvedValue）
   - グローバルモックヘルパーの追加：
     - `mockESMModule`: ESMモジュールを簡単にモック化するヘルパー
     - `createMock`: モッククラスとそのメソッドを作成するヘルパー

5. **package.jsonの拡張**

   - `fix:jest-mocks`: Jestモック関数のESM対応スクリプト実行
   - `fix:esm:all`: 全ESM修正スクリプトの一括実行

6. **ドキュメント作成**

   - `ESM-Migration-Guide.md`: ESM環境でのJestモック対応ガイド
   - 内容:
     - ESMとJestの互換性
     - 変換スクリプトの使用方法
     - モックヘルパーの使用方法
     - CommonJSからESMへの変換例
     - よくある問題と解決策
     - ベストプラクティス

7. **処理結果**
   - 全.mjsテストファイルのjest.mock呼び出しを修正
   - モックファイルをESM形式に変換
   - setupJest.mjsファイルの修正
   - "jest is not defined"エラーの解決
   - "Cannot find module"エラーの解決
   - 型エラーの解決

REF-028の実装により、ESM環境でのJestモック関数の問題が解決され、テスト実行の安定性が大幅に向上しました。特に`import { jest } from '@jest/globals'`の追加、.js拡張子の明示的な指定、\_\_esModuleフラグの設定などが重要な改善点となりました。また、ESM対応のモックヘルパーの提供により、今後のテスト開発も効率化されました。

## REF-029: ESMテストのモックデータ生成改善

REF-029タスクでは、テスト用のモックデータ生成ユーティリティを作成し、テストの再現性と安定性を向上させました。

1. **MarketDataFactoryクラスの実装**

   - 固定シード値に基づく再現性のあるランダムデータ生成機能
   - 様々な市場シナリオに対応したローソク足データ生成機能
     - `createCandles`: 基本的なローソク足データ生成
     - `createTrendCandles`: トレンド相場のローソク足データ生成
     - `createRangeCandles`: レンジ相場のローソク足データ生成
     - `createBreakoutCandles`: ブレイクアウト相場のローソク足データ生成
     - `createVolatilitySpike`: ボラティリティ急増相場のローソク足データ生成
   - 市場状態検出機能 (`detectMarketStatus`)
   - ポジションデータと注文データの生成機能

2. **TestScenarioFactoryクラスの実装**

   - 各種売買戦略向けのテストシナリオを生成するファクトリークラス
   - 戦略タイプごとの専用シナリオ生成メソッド
     - `createTrendFollowingScenario`: トレンドフォロー戦略のテストシナリオ
     - `createRangeTradingScenario`: レンジ取引戦略のテストシナリオ
     - `createBreakoutScenario`: ブレイクアウト戦略のテストシナリオ
     - `createVolatilityScenario`: 高ボラティリティ相場のテストシナリオ
     - `createMultiTimeframeScenario`: マルチタイムフレーム分析のテストシナリオ
     - `createErrorScenario`: エラーケースのテストシナリオ
   - 期待される発注シグナルも含む包括的なテストデータ生成

3. **テストの実装**

   - 両方のファクトリークラスの単体テスト
   - 市場データ生成の正確性検証
   - シナリオ生成の一貫性検証

4. **テスト環境向上の成果**
   - テストデータの再現性確保（固定シード値）
   - 様々な市場シナリオの簡単なシミュレーション
   - エラーケース検証の効率化
   - 戦略テストの標準化と網羅性向上

このREF-029の実装により、ESM環境でのテストデータ生成が大幅に改善され、テストの安定性と再現性が向上しました。今後の戦略テストは、これらのファクトリークラスを使用することで、一貫した方法でさまざまな市場シナリオをシミュレートできるようになりました。

## 今後の対応

1. **REF-028: Jestモック関数のESM対応** - 完了 ✅

   - Jestグローバルオブジェクトの適切なインポート
   - モック実装のESM対応
   - 自動変換スクリプトとヘルパーユーティリティ

2. **TST-015: MeanRevertStrategyテストの安定性強化** - 完了 ✅

   - 不安定なテスト結果の修正
   - テストデータ生成の改善（CandleDataFactory/CandleFactoryクラスの実装）
   - 十分な量のローソク足データ（40本以上）を保証する機能を追加
   - グリッド境界を確実にまたぐデータ生成機能の実装
   - TypeScript版とESModule版のテスト両方の安定性を向上

3. **REF-029: ESMテストのモックデータ生成改善** - 完了 ✅

   - テスト用モックデータ生成ユーティリティの作成
   - シナリオベースのデータ生成
   - 優先順位: 低

4. **混在環境での開発フローの確立**
   - CommonJSとESMが混在する環境での開発プロセス改善
   - リントルールの強化
   - ファイル拡張子の規約化
   - ESMベースの開発フローへの段階的移行

## ステータスとタイムライン

- REF-019 (ParameterService ESM対応) - 完了 ✅
- REF-020 (テスト環境のESM完全対応) - 完了 ✅
- REF-021 (テスト変換スクリプト改良) - 完了 ✅
- REF-022 (複雑なテストファイルのESM対応) - 完了 ✅
- REF-023 (テスト実行フローのESM対応) - 完了 ✅
- REF-024 (ESM型アノテーション削除の最終処理) - 完了 ✅
- REF-025 (ESMテスト安定性の向上) - 完了 ✅
- REF-026 (ESMテスト用CI/CD最適化) - 完了 ✅
- REF-027 (ESMインポートパス問題修正) - 完了 ✅
- REF-028 (Jestモック関数のESM対応) - 完了 ✅
- REF-029 (ESMテストのモックデータ生成改善) - 完了 ✅
- TST-015: MeanRevertStrategyテストの安定性強化 - 完了 ✅

次のステップ:

- すべてのESM対応タスクが完了しました ✅
