# モックファクトリー使用ガイド

TST-055: モジュールモックの一貫性向上の一環として作成されたモックファクトリーライブラリです。テストコードで一貫したモックパターンを実現し、テストの品質と保守性を向上させます。

## 基本概念

このライブラリは以下の問題を解決することを目的としています：

1. テストファイル間でモック実装の不一致がある
2. `@jest/globals`のインポートや`jest.mock`パターンの不統一
3. テスト間での共通モック実装の重複
4. ESM/CJSデュアルフォーマット環境での互換性問題

## 対応モジュール

現在は以下のモジュールに対してモックファクトリーが実装されています：

### 戦略（Strategy）モック
- `createStrategyMock`: 基本戦略モック
- `createMeanReversionStrategyMock`: 平均回帰戦略モック
- `createTrendFollowStrategyMock`: トレンドフォロー戦略モック
- `createRangeStrategyMock`: レンジ戦略モック

### サービスモック
- `createLoggerMock`: ロガーモック
- `createParameterServiceMock`: パラメータサービスモック
- `createDbServiceMock`: データベースサービスモック
- `createExchangeApiMock`: 取引所APIサービスモック

### データモック
- `createDataRepositoryMock`: データリポジトリモック
- `createParquetDataStoreMock`: Parquetデータストアモック
- `createMultiTimeframeDataFetcherMock`: マルチタイムフレームデータフェッチャーモック
- `createRealTimeDataProcessorMock`: リアルタイムデータプロセッサーモック

## 使用方法

### ESMモジュール（.mjs ファイル）での使用例

```javascript
// モジュールインポート
import { jest, describe, test, expect } from '@jest/globals';
import { 
  createMeanReversionStrategyMock, 
  createParameterServiceMock,
  createDataRepositoryMock
} from '../../utils/test-helpers/mock-factories/index.mjs';

// 個別モックの作成
const mockStrategyClass = createMeanReversionStrategyMock();
const mockParamService = createParameterServiceMock({
  'meanRevertStrategy.overboughtThreshold': 80, // カスタムパラメータ
  'meanRevertStrategy.oversoldThreshold': 20
});
const mockDataRepo = createDataRepositoryMock({
  loadCandles: jest.fn().mockResolvedValue([
    { timestamp: 1625097600000, open: 100, high: 105, low: 95, close: 102, volume: 1000 }
  ])
});

// モジュールのモック化
jest.mock('../../strategies/meanReversionStrategy.js', () => ({
  MeanReversionStrategy: mockStrategyClass
}));

jest.mock('../../config/parameterService.js', () => ({
  parameterService: mockParamService
}));

jest.mock('../../data/dataRepository.js', () => ({
  dataRepository: mockDataRepo,
  DataRepository: jest.fn().mockImplementation(() => mockDataRepo)
}));

// テスト
describe('MeanReversionStrategy Tests', () => {
  let strategy;
  
  beforeEach(() => {
    strategy = new mockStrategyClass('SOL/USDT');
  });
  
  test('should generate correct signals', () => {
    // テストコード
  });
});
```

### CommonJSモジュール（.js ファイル）での使用例

```javascript
const { 
  createTrendFollowStrategyMock, 
  createLoggerMock,
  createMultiTimeframeDataFetcherMock
} = require('../../utils/test-helpers/mock-factories');

// モックの作成
const mockStrategyClass = createTrendFollowStrategyMock();
const mockLogger = createLoggerMock();
const mockDataFetcher = createMultiTimeframeDataFetcherMock({
  fetchAndSaveTimeframe: jest.fn().mockResolvedValue(false), // カスタム実装
  fetchAllTimeframes: jest.fn().mockResolvedValue({
    '1m': false,
    '15m': true,
    '1h': true,
    '1d': true
  })
});

// モジュールのモック化
jest.mock('../../strategies/trendFollowStrategy.js', () => ({
  TrendFollowStrategy: mockStrategyClass
}));

jest.mock('../../utils/logger.js', () => mockLogger);

jest.mock('../../data/MultiTimeframeDataFetcher.js', () => ({
  MultiTimeframeDataFetcher: jest.fn().mockImplementation(() => mockDataFetcher),
  Timeframe: {
    MINUTE_1: '1m',
    MINUTE_15: '15m',
    HOUR_1: '1h',
    DAY_1: '1d'
  }
}));

// テスト
describe('TrendFollowStrategy Tests', () => {
  // テストコード
});
```

### すべてのモジュールを一括モック化する方法（ESM）

```javascript
import { jest } from '@jest/globals';
import { setupAllMocks } from '../../utils/test-helpers/mock-factories/index.mjs';

// すべての一般的なモジュールを一度にモック化
await setupAllMocks(jest);

// テスト
describe('Integration Test', () => {
  // モックされた依存関係を使用するテスト
});
```

### すべてのモジュールを一括モック化する方法（CommonJS）

```javascript
const { setupAllMocks } = require('../../utils/test-helpers/mock-factories');

// すべての一般的なモジュールを一度にモック化
setupAllMocks(jest);

// テスト
describe('Integration Test', () => {
  // モックされた依存関係を使用するテスト
});
```

## カスタムモック実装の提供

デフォルトの実装を使用せず、特定のテストケース用にカスタム実装を提供することも可能です：

```javascript
// カスタム実装を提供
const mockStrategyClass = createMeanReversionStrategyMock((candles, positions, accountBalance) => {
  // テスト固有の条件でシグナルを返す
  if (candles.length > 0 && candles[candles.length - 1].close < 100) {
    return [{
      symbol: 'TEST/USDT',
      type: 'market',
      side: 'buy',
      amount: 1.0,
      timestamp: Date.now()
    }];
  }
  return [];
});

// データリポジトリモックでカスタム実装を提供
const mockDataRepo = createDataRepositoryMock({
  loadCandles: jest.fn().mockImplementation(async (symbol, timeframe, start, end) => {
    // テスト固有の条件で異なるデータを返す
    if (timeframe === '1h') {
      return [{ timestamp: 1625097600000, open: 100, high: 105, low: 95, close: 102, volume: 1000 }];
    }
    return []; // その他の時間足では空配列を返す
  })
});
```

## モックファクトリーの追加方法

新しいモジュールのモックファクトリーを追加する場合は、以下の手順に従ってください：

1. `src/utils/test-helpers/mock-factories/` に新しいファクトリーファイルを作成（ESMとCJS両方）
2. `index.mjs`と`index.js`にエクスポートを追加
3. 必要に応じて`setupAllMocks`関数に追加

## ベストプラクティス

- 新しいテストを書く際は、このモックファクトリーを使用して一貫性を確保する
- 既存のテストを修正する際は、可能な限りモックファクトリーを使用するように移行する
- モックの実装は最小限に保ち、テストの意図を明確にする
- モックの振る舞いが複雑な場合は、カスタム実装を提供する
- `jest.fn()`の代わりに、常にモックファクトリーを使用する 