# SOL-Bot API エンドポイント ドキュメント

このドキュメントでは、SOL-Botが提供するREST APIエンドポイントについて説明します。

## ベースURL

```
http://localhost:3000
```

実際の本番環境では、適切なドメインとSSL証明書を設定してください。

## 認証

APIリクエストには認証が必要です。認証はHTTPヘッダーに`API-Key`を含めることで行います。

```
API-Key: your_api_key_here
```

APIキーは環境変数`API_KEY`で設定するか、`.env`ファイルに定義してください。

## エンドポイント

### 1. システム状態

#### GET /api/status

システムの現在の状態を取得します。

**リクエスト例**

```
GET /api/status
```

**レスポンス例**

```json
{
  "status": "running",
  "mode": "live",
  "uptime": "2d 6h 30m",
  "version": "1.0.0",
  "lastUpdated": "2025-06-28T12:34:56Z"
}
```

### 2. マーケットデータ

#### GET /api/market/:symbol

指定したシンボルの市場データを取得します。

**パラメータ**

- `symbol` (必須): トレーディングペア (例: SOLUSDT)

**クエリパラメータ**

- `timeframe` (オプション): 時間足 (デフォルト: 1h, 選択肢: 1m, 5m, 15m, 1h, 4h, 1d)
- `limit` (オプション): 取得するデータ数 (デフォルト: 100, 最大: 1000)

**リクエスト例**

```
GET /api/market/SOLUSDT?timeframe=1h&limit=50
```

**レスポンス例**

```json
{
  "symbol": "SOLUSDT",
  "timeframe": "1h",
  "candles": [
    {
      "timestamp": 1656000000000,
      "open": 35.45,
      "high": 35.79,
      "low": 35.21,
      "close": 35.67,
      "volume": 123456.78
    },
    // ... 他のローソク足データ
  ]
}
```

### 3. 市場分析

#### GET /api/analysis/:symbol

指定したシンボルの市場分析結果を取得します。

**パラメータ**

- `symbol` (必須): トレーディングペア (例: SOLUSDT)

**リクエスト例**

```
GET /api/analysis/SOLUSDT
```

**レスポンス例**

```json
{
  "symbol": "SOLUSDT",
  "timestamp": 1656010000000,
  "environment": "uptrend",
  "recommendedStrategy": "trend_following",
  "indicators": {
    "shortTermEma": 35.67,
    "longTermEma": 34.89,
    "shortTermSlope": 0.58,
    "longTermSlope": 0.32,
    "atr": 1.23,
    "atrPercentage": 3.45,
    "highVolatility": false,
    "lowVolatility": true,
    "bullTrend": true,
    "bearTrend": false,
    "emaCrossover": true
  }
}
```

### 4. 取引戦略

#### GET /api/strategy/:symbol

指定したシンボルの現在の取引戦略情報を取得します。

**パラメータ**

- `symbol` (必須): トレーディングペア (例: SOLUSDT)

**リクエスト例**

```
GET /api/strategy/SOLUSDT
```

**レスポンス例**

```json
{
  "symbol": "SOLUSDT",
  "activeStrategy": "trend_following",
  "parameters": {
    "donchianPeriod": 20,
    "adxPeriod": 14,
    "adxThreshold": 25,
    "atrTrailingStopMultiplier": 1.2
  },
  "lastExecuted": "2025-06-28T12:30:00Z",
  "signalsGenerated": 2
}
```

### 5. アカウント情報

#### GET /api/account

アカウント情報と現在のポジションを取得します。

**リクエスト例**

```
GET /api/account
```

**レスポンス例**

```json
{
  "balance": 10250.45,
  "available": 8750.32,
  "positions": [
    {
      "symbol": "SOLUSDT",
      "side": "buy",
      "amount": 15.5,
      "entryPrice": 35.67,
      "currentPrice": 36.21,
      "unrealizedPnl": 8.37,
      "timestamp": 1656005000000
    }
  ],
  "dailyPnl": 125.45,
  "dailyPnlPercentage": 1.24
}
```

### 6. 注文管理

#### GET /api/orders

すべての注文履歴を取得します。

**クエリパラメータ**

- `status` (オプション): 注文ステータスでフィルタリング (選択肢: open, filled, canceled, all)
- `symbol` (オプション): シンボルでフィルタリング
- `limit` (オプション): 取得する注文数 (デフォルト: 50, 最大: 500)

**リクエスト例**

```
GET /api/orders?status=filled&symbol=SOLUSDT&limit=10
```

**レスポンス例**

```json
{
  "orders": [
    {
      "id": "order-1656000123456-1",
      "symbol": "SOLUSDT",
      "type": "market",
      "side": "buy",
      "amount": 5.0,
      "price": 35.67,
      "status": "filled",
      "timestamp": 1656000123456
    },
    // ... 他の注文データ
  ],
  "total": 10,
  "hasMore": true
}
```

#### POST /api/orders

新しい注文を作成します。

**リクエストボディ**

```json
{
  "symbol": "SOLUSDT",
  "type": "limit",
  "side": "buy",
  "amount": 5.0,
  "price": 35.50
}
```

**レスポンス例**

```json
{
  "success": true,
  "orderId": "order-1656020123456-2",
  "message": "注文が正常に作成されました"
}
```

#### DELETE /api/orders/:orderId

指定した注文をキャンセルします。

**パラメータ**

- `orderId` (必須): キャンセルする注文のID

**リクエスト例**

```
DELETE /api/orders/order-1656020123456-2
```

**レスポンス例**

```json
{
  "success": true,
  "message": "注文がキャンセルされました"
}
```

### 7. バックテスト

#### POST /api/backtest

バックテストを実行します。

**リクエストボディ**

```json
{
  "symbol": "SOLUSDT",
  "strategy": "trend_following",
  "startDate": "2025-01-01",
  "endDate": "2025-06-01",
  "initialBalance": 10000,
  "parameters": {
    "donchianPeriod": 20,
    "adxThreshold": 25
  }
}
```

**レスポンス例**

```json
{
  "backestId": "bt-1656030123456",
  "status": "running",
  "message": "バックテストの実行を開始しました。完了までにしばらく時間がかかります。"
}
```

#### GET /api/backtest/:backestId

バックテスト結果を取得します。

**パラメータ**

- `backestId` (必須): バックテストID

**リクエスト例**

```
GET /api/backtest/bt-1656030123456
```

**レスポンス例**

```json
{
  "backestId": "bt-1656030123456",
  "status": "completed",
  "results": {
    "totalTrades": 42,
    "winningTrades": 25,
    "losingTrades": 17,
    "winRate": 59.52,
    "averageWin": 2.34,
    "averageLoss": 1.15,
    "profitFactor": 2.03,
    "maxDrawdown": 8.76,
    "sharpeRatio": 1.45,
    "totalReturn": 24.5,
    "annualizedReturn": 48.2
  },
  "equityCurve": [
    [1656000000000, 10000],
    [1656086400000, 10125],
    // ... 他の資産推移データ
  ]
}
```

## エラーレスポンス

エラーが発生した場合、以下のような形式でレスポンスが返されます。

```json
{
  "error": true,
  "code": 400,
  "message": "無効なパラメータが指定されました",
  "details": "シンボルは必須パラメータです"
}
```

一般的なエラーコード:

- 400: リクエストが無効
- 401: 認証エラー
- 404: リソースが見つからない
- 429: レート制限超過
- 500: サーバー内部エラー

## レート制限

APIにはレート制限があります。制限は以下の通りです:

- 認証済みのリクエスト: 1分あたり120リクエスト
- 未認証のリクエスト: 1分あたり30リクエスト

レート制限に関する情報は、レスポンスヘッダーに含まれます:

```
X-Rate-Limit-Limit: 120
X-Rate-Limit-Remaining: 115
X-Rate-Limit-Reset: 1656000060
``` 