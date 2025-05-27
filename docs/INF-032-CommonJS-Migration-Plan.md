# INF-032: CommonJS形式への変換計画

## 1. 概要と目的

ES Module形式で実装されていたSOL-botのコードベースをCommonJS形式に変換します。これによりDockerでの実行環境の安定性を向上させ、循環参照問題やモジュール解決の問題を解消します。

## 2. 変換の現状と進捗

現在の進捗状況:
- **コアモジュール**: 完了 (100%)  
  - types.ts, tradingEngine.ts, orderManagementSystem.ts 等、基幹システムのほとんどを変換完了
  - moduleHelperシステムの導入により循環参照問題を一部解決

- **戦略(strategies)**: 完了 (100%)
  - trendStrategy.ts、DonchianBreakoutStrategy.ts、meanRevertStrategy.ts、trendFollowStrategy.ts、rangeStrategy.tsの変換が完了
  - 全6ファイルの変換作業が完了し、INF-032-2タスクとして管理

- **インジケーター(indicators)**: 完了 (100%)
  - 約10ファイルの変換が完了
  - INF-032-6タスクとして管理

- **データ処理モジュール(data)**: 完了 (100%)
  - 全8ファイル（marketDataFetcher.ts、parquetDataStore.ts、dataRepository.ts、MultiTimeframeDataFetcher.ts、fetchHourlyData.ts、fetchMultiTimeframeData.ts、generateSampleData.ts、runSampleTest.ts）をCommonJS形式に変換完了
  - INF-032-7タスクとして管理済み

- **サービス(services)**: 完了 (100%)
  - 全ファイルの変換が完了
  - secretManagerディレクトリの全9ファイルを含む主要サービスファイル（UnifiedOrderManager.ts、orderSizingService.ts、symbolInfoService.ts、exchangeService.ts）をCommonJS形式に変換
  - INF-032-8タスクとして管理済み

- **テスト**: 一部対応 (40%)
  - **完了したもの**:
    - 主要テストファイルの「Types is not defined」エラー解決
    - core/types.tsモジュールを修正し、CommonJS環境での実行時Typesオブジェクト参照問題を解決
    - parameterService.test.tsの変換（元の19テストケースすべてを保持）
    - exchangeService.test.ts、marketState.test.ts、RealTimeDataProcessor.test.ts、orderSizingService.test.ts、trendStrategy.test.tsなどの変換完了
  - **進行中のもの**:
    - 残りのテストファイルのCommonJS形式への変換作業（INF-032-9）
    - モック関数の正しい設定パターンを確立
  - **残作業**:
    - .ts形式の残りのテストファイルを.js形式に変換する作業（INF-032-9タスクとして進行中）
    - DataRepository.e2e.test.ts、atrCalibrator.test.tsなどの変換

- **型定義問題**: 一部対応 (50%)
  - core/types.tsの修正によりCommonJS環境でのTypes参照問題を解決
  - 現在は@ts-nocheck指示子を使用
  - moduleHelperシステムの拡張による循環参照問題の一部解決
  - INF-032-4タスクとして管理中

## 3. 主な変換作業内容

### 3.1 import/export構文の変換

**変換前（ESM形式）**:
```typescript
// 型定義のインポート
import { OrderType, OrderSide } from '../core/types.js';
// 外部モジュールのインポート
import { ADX } from 'technicalindicators';
// 関数エクスポート
export function calculateATR(candles: Candle[], period: number): number { 
  // 実装
}
```

**変換後（CommonJS形式）**:
```typescript
// @ts-nocheck
// 型定義のインポート
const Types = require('../core/types');
const { OrderType, OrderSide } = Types;
// 外部モジュールのインポート
const technicalIndicators = require('technicalindicators');
const { ADX } = technicalIndicators;
// 関数エクスポート
function calculateATR(candles, period) {
  // 実装
}
// CommonJS形式でエクスポート
module.exports = {
  calculateATR
};
```

### 3.2 ファイルパス参照の修正

- ファイルパス末尾の`.js`拡張子を削除
  - `'../core/types.js'` → `'../core/types'`

### 3.3 TypeScript型定義対応

- 型定義の型引数指定（Generics）を削除
  - `parameterService.get<number>('key', 0)` → `parameterService.get('key', 0)`
- 引数/戻り値の型アノテーションを削除
  - `function calc(x: number): number` → `function calc(x)`
- JSDoc形式のコメントに型情報を移動 
  - `@param {number} x パラメータ説明`

### 3.4 循環参照問題の解決策

moduleHelperシステムを利用してモジュール間の循環参照問題を回避：

```typescript
// モジュール登録
moduleHelperRef.registerModule('positionSizing', positionSizing);

// 循環参照可能性がある場合の条件付きロード
const loggerRef = moduleHelperRef.hasModule('logger') 
  ? moduleHelperRef.getModule('logger') 
  : require('./logger').default;
```

### 3.5 テストファイルでのTypes参照問題の解決

INF-032-3で実装した解決パターン：

1. core/types.tsファイルの修正:
```typescript
// @ts-nocheck
// CommonJS環境でも動作するようTypes名前空間を実行時オブジェクトとしても定義
const Types = {
  // 実行時に必要な定数をエクスポート
  OrderType,
  OrderSide,
  OrderStatus,
  MarketEnvironment,
  StrategyType,
  // ...他の必要な型
};

// モジュールとしてエクスポート
module.exports = {
  Types,
  OrderType,
  OrderSide,
  // ...その他の定数や関数も個別にエクスポート
};
```

2. テストファイルでの明示的インポート:
```javascript
// @ts-nocheck
const { jest, describe, test, expect } = require('@jest/globals');

// core/typesの明示的なインポートを追加
const { Types, OrderType, OrderSide, OrderStatus } = require('../../core/types');

// 以下、テストコード
```

### 3.6 Jest モック関数の正しい設定方法

テストファイルにおけるモック関数の設定に関する課題と解決策：

1. fsモジュールのモック (parameterService.test.tsなど):
```javascript
// TypeScriptのfalsyエラー回避方法
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockImplementation(() => mockYamlContent)
}));

// または実装をシンプル化する方法
const mockFs = {
  readFileSync: function() { return mockYamlContent; }
};
jest.mock('fs', () => mockFs);
```

2. モック関数のキャスト問題の回避:
```javascript
// TypeScriptでの型キャスト
(fs.readFileSync as jest.Mock).mockReturnValue(mockYamlContent);

// JavaScript変換後は別の方法で対応
fs.readFileSync.mockReturnValue = jest.fn().mockReturnValue(mockYamlContent);
// または
jest.spyOn(fs, 'readFileSync').mockReturnValue(mockYamlContent);
```

## 4. ファイル変換の優先順位

1. **高優先度** (完了):
   - コアモジュール (INF-032-1)
   - 戦略ファイル (strategies/) (INF-032-2)
   - インジケーター (indicators/) (INF-032-6)

2. **中優先度** (完了):
   - データ処理モジュール (data/) (INF-032-7)
   - サービス (services/) (INF-032-8)

3. **低〜中優先度** (進行中):
   - Types参照問題の解決 (INF-032-3) (完了)
   - テストファイルの変換 (INF-032-9) (新規)
   - 型定義問題の完全解決 (INF-032-4) (進行中)
   - Docker環境でのテスト (INF-032-5) (未着手)

## 5. 型定義の処理方針

短期的には `@ts-nocheck` 指示子を使用して型チェックを無効化し、機能を優先。
中長期的には以下の方針で型安全性を復元:

1. 名前空間を利用した型定義と実行時オブジェクトの分離
   - INF-032-3で実装したパターンを拡張し、TypesオブジェクトをCommonJS環境で利用可能に
2. JSDoc形式での型情報提供
3. TypeScriptのallowJs=trueとcheckJs=trueオプションの活用

## 6. 推定作業工数と分担

| カテゴリ | ファイル数 | 推定工数 | 進捗 |
|---------|----------|---------|------|
| コア     | 8ファイル | 16時間   | 100% |
| 戦略     | 6ファイル | 12時間   | 100% |
| インジケーター | 10ファイル | 15時間 | 100% |
| データ処理 | 8ファイル | 12時間  | 100% |
| サービス  | 12ファイル | 18時間  | 100% |
| テスト (Types参照問題) | 6ファイル | 10時間  | 100% |
| テスト (残りの変換)  | 13+ファイル | 20時間 | 0% |
| 型定義問題 | - | 15時間 | 50% |

**合計残作業時間**: 約27-30時間

## 7. 次のステップと提案

1. **テストファイル変換の継続**:
   - INF-032-9タスクで残りのテストファイル(.ts形式)を.js形式に変換
   - INF-032-3で確立した明示的Typesインポート方式を活用
   - テストの機能とカバレッジを維持する方針で変換を進める
   - モック関数の正しい設定パターンを確立

2. **Docker環境でのテスト実行**:
   - 変換完了したモジュールをDocker環境でテスト(INF-032-5)
   - `docker-compose run solbot-test`でのユニットテスト実行確認

3. **型定義問題の完全解決**:
   - @ts-nocheck指示子を除去(INF-032-4)
   - 段階的にTypeScriptの型チェックエラーを解消

## 8. リスクと対策

1. **循環参照問題**:
   - リスク: 複雑な依存関係の解決に時間がかかる
   - 対策: moduleHelperシステムの拡張と依存関係の再設計
   - 進捗: 主要なモジュールでは解決済み、残りは段階的に対応

2. **テストファイル変換の複雑さ**:
   - リスク: 多数のテストファイルで異なるモック設定や参照方法が使用されている
   - 対策: INF-032-3で確立したパターンを適用し、統一的なアプローチで変換を進める
   - 進捗: 主要なテストファイルの変換パターンを確立済み

3. **ビルド/実行エラー**:
   - リスク: 変換ミスによる実行時エラーの増加
   - 対策: 段階的な変換とDockerコンテナでの動作検証
   - 進捗: 主要モジュールはすでに変換完了、残りは既存パターンを踏襲して変換 