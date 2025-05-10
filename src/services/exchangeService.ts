/**
 * 取引所との通信を管理するサービス
 *
 * このファイルはccxtライブラリを使用して、暗号資産取引所とのやり取りを抽象化します。
 * 市場データの取得や注文の実行など、取引所関連の操作を提供します。
 */

import ccxt from 'ccxt';
import { Candle, Order, OrderSide, OrderType, OrderStatus } from "../core/types.js";
import logger from "../utils/logger.js";
import {
  orderTypeToCcxt,
  ccxtToOrderType,
  ORDER_TYPE_TO_CCXT_MAPPING,
  CCXT_TO_ORDER_TYPE_MAPPING
} from "../utils/orderTypeUtils.js";

/**
 * 注文オプションのインターフェース
 */
export interface OrderOptions {
  postOnly?: boolean; // Post-Onlyオプション
  hidden?: boolean; // 隠し注文オプション
  iceberg?: number; // アイスバーグ注文の表示数量
  stopPrice?: number; // ストップ価格
}

/**
 * OCO注文の入力パラメータ
 */
export interface OcoOrderParams {
  symbol: string; // 銘柄シンボル
  side: OrderSide; // 注文サイド
  amount: number; // 注文数量
  stopPrice: number; // ストップ価格
  limitPrice: number; // 指値価格
  stopLimitPrice?: number; // ストップリミットの場合の指値価格
}

/**
 * 取引所APIエラーのインターフェース
 */
export interface ExchangeError extends Error {
  code?: number | string;
  name: string;
  message: string;
}

/**
 * OrderType enumとCCXT注文タイプのマッピング
 * 取引所ごとに異なる注文タイプの文字列表現を正規化する
 */
// orderTypeUtils.tsで定義されたマッピングを使用するため削除
// const ORDER_TYPE_MAPPING = { ... }

/**
 * CCXT注文タイプ文字列からOrderType enumへの逆マッピング
 * 取引所から返された文字列の注文タイプをシステム内部のEnum値に変換
 */
// orderTypeUtils.tsで定義されたマッピングを使用するため削除
// const CCXT_TO_ORDER_TYPE_MAPPING = { ... }

/**
 * 取引所サービスクラス
 */
export class ExchangeService {
  private exchange!: ccxt.Exchange; // 初期化は initialize() で行うため ! を使用
  private isInitialized: boolean = false;
  private readonly MAX_RETRIES = 7; // 最大再試行回数
  // 固定値ではなく、真の指数バックオフのパラメータを定義
  private readonly INITIAL_BACKOFF_MS = 1000; // 初期バックオフ時間（ミリ秒）
  private readonly MAX_BACKOFF_MS = 64000; // 最大バックオフ時間（ミリ秒）
  private readonly BACKOFF_FACTOR = 2; // バックオフ係数（2倍ずつ増加）

  /**
   * 取引所サービスを初期化する
   * @param exchangeId 取引所ID（例: 'binance'）
   * @param apiKey APIキー
   * @param secret 秘密鍵
   */
  public async initialize(exchangeId: string, apiKey?: string, secret?: string): Promise<boolean> {
    try {
      // 取引所インスタンスの作成
      // ccxtは動的にインスタンス化するのでRecord型を使用
      const exchangeClasses = ccxt as unknown as Record<
        string,
        new (options: ccxt.ExchangeOptions) => ccxt.Exchange
      >;
      const exchangeClass = exchangeClasses[exchangeId];

      if (!exchangeClass) {
        logger.error(`指定された取引所が見つかりません: ${exchangeId}`);
        return false;
      }

      this.exchange = new exchangeClass({
        apiKey,
        secret,
        enableRateLimit: true
      });

      // 取引所への接続テスト
      await this.fetchWithExponentialBackoff(() => this.exchange.loadMarkets());
      this.isInitialized = true;
      logger.info(`取引所に接続しました: ${exchangeId}`);
      return true;
    } catch (error) {
      logger.error(`取引所接続エラー: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * エラーが再試行可能かどうか判定する
   * @param error 発生したエラー
   * @returns 再試行可能な場合はtrue
   */
  private isRetryable(error: ExchangeError): boolean {
    // レート制限（429）エラー
    if (
      (error.name && error.name === 'RateLimitExceeded') ||
      (error.message && error.message.includes('429')) ||
      (error.code && error.code === 429)
    ) {
      return true;
    }

    // サーバーエラー（5xx）
    if (
      (error.message && /50\d/.test(error.message)) ||
      (error.code && typeof error.code === 'number' && error.code >= 500 && error.code < 600)
    ) {
      return true;
    }

    // ゲートウェイエラー
    if (
      error.message &&
      (error.message.includes('502') ||
        error.message.includes('Bad Gateway') ||
        error.message.includes('Gateway Timeout'))
    ) {
      return true;
    }

    // 接続リセットやネットワークエラー
    if (
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ESOCKETTIMEDOUT' ||
      error.code === 'ECONNREFUSED'
    ) {
      return true;
    }

    return false;
  }

  /**
   * 指数バックオフ付きのAPI呼び出し
   * HTTP 429（レート制限）やその他の一時的なエラーが発生した場合に再試行する
   * @param apiCall API呼び出し関数
   * @returns API呼び出しの結果
   */
  private async fetchWithExponentialBackoff<T>(apiCall: () => Promise<T>): Promise<T> {
    let lastError: ExchangeError = new Error('Unknown error') as ExchangeError;

    for (let retry = 0; retry < this.MAX_RETRIES; retry++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error as ExchangeError;

        // 再試行可能なエラーかどうか判定
        if (this.isRetryable(lastError)) {
          // 最後の試行なら例外をそのまま投げる
          if (retry === this.MAX_RETRIES - 1) {
            throw error;
          }

          // 真の指数バックオフ計算: min(初期値 * 係数^試行回数, 最大値)
          const delay = Math.min(
            this.INITIAL_BACKOFF_MS * Math.pow(this.BACKOFF_FACTOR, retry),
            this.MAX_BACKOFF_MS
          );

          const errorCode = lastError.code || '';
          const errorType =
            lastError.name ||
            (lastError.message && lastError.message.includes('429')
              ? 'レート制限'
              : lastError.message && /50\d/.test(lastError.message)
                ? 'サーバーエラー'
                : 'ネットワークエラー');

          logger.warn(
            `${errorType}エラー(${errorCode})が発生しました。${delay / 1000}秒待機後に再試行 (${retry + 1}/${this.MAX_RETRIES})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          // 再試行不可能なエラーはすぐに例外を投げる
          throw error;
        }
      }
    }

    // ここには到達しないはずだが、コンパイルエラーを防ぐ
    throw lastError;
  }

  /**
   * 指定された銘柄と時間枠の市場データを取得する
   * @param symbol 銘柄（例: 'SOL/USDT'）
   * @param timeframe 時間枠（例: '1h', '5m'）
   * @param limit 取得するローソク足の数
   * @returns ローソク足データの配列
   */
  public async fetchCandles(
    symbol: string,
    timeframe: string,
    limit: number = 100
  ): Promise<Candle[]> {
    if (!this.isInitialized) {
      logger.error('取引所が初期化されていません');
      return [];
    }

    try {
      const ohlcv = await this.fetchWithExponentialBackoff(() =>
        this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit)
      );

      return ohlcv.map((candle) => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5]
      }));
    } catch (error) {
      logger.error(
        `市場データ取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * 注文を実行する
   * @param order 注文オブジェクト
   * @param options 注文オプション
   * @returns 注文ID（成功した場合）またはnull
   */
  public async executeOrder(order: Order, options?: OrderOptions): Promise<string | null> {
    if (!this.isInitialized) {
      logger.error('取引所が初期化されていません');
      return null;
    }

    try {
      // OrderType enumとCCXTの注文タイプをマッピング
      const ccxtOrderType = orderTypeToCcxt(order.type);
      const side = order.side.toLowerCase();
      const amount = order.amount;
      let price = order.price;
      const symbol = order.symbol;

      const params: Record<string, unknown> = {};

      // 成行系注文の場合、priceパラメータを明示的にundefinedに設定
      if (order.type === OrderType.MARKET || order.type.toString().endsWith('MARKET')) {
        // 成行注文の場合はpriceをundefinedに設定（ccxtの型定義に合わせる）
        price = undefined;
        logger.debug(
          `[ExchangeService] 成行系注文のためpriceパラメータを削除: ${order.type} ${side} ${amount} ${symbol}`
        );
      }

      // ストップ注文の場合、パラメータを追加
      if (
        order.type === OrderType.STOP ||
        order.type === OrderType.STOP_LIMIT ||
        order.type.toString().includes('STOP')
      ) {
        params.stopPrice = order.stopPrice;
      }

      // 追加オプションを適用
      if (options) {
        // Post-Onlyオプション
        if (options.postOnly) {
          params.postOnly = true;
          logger.debug(`[ExchangeService] Post-Onlyオプションを適用: ${symbol}`);
        }

        // 隠し注文オプション
        if (options.hidden) {
          params.hidden = true;
          logger.debug(`[ExchangeService] 隠し注文オプションを適用: ${symbol}`);
        }

        // アイスバーグ注文オプション
        if (options.iceberg && options.iceberg > 0) {
          params.iceberg = options.iceberg;
          logger.debug(
            `[ExchangeService] アイスバーグ注文オプションを適用: 表示数量=${options.iceberg}, ${symbol}`
          );
        }
      }

      // 全取引所で一貫した成行注文処理を行う
      if (
        price === undefined &&
        (order.type === OrderType.MARKET || order.type.toString().endsWith('MARKET'))
      ) {
        // 成行注文のパラメータを準備
        const marketOrderParams = { ...params };

        // 取引所ごとの特殊処理を適用
        const result = await this.fetchWithExponentialBackoff(() => {
          logger.debug(`[ExchangeService] 成行注文実行: ${symbol} ${side} ${amount}`);

          // 取引所がBitgetまたはBybitの場合、特別な処理が必要
          if (this.exchange.id === 'bitget' || this.exchange.id === 'bybit') {
            logger.debug(
              `[ExchangeService] ${this.exchange.id}向け成行注文特殊処理: priceパラメータ省略`
            );

            // @ts-ignore: ccxtの型定義問題を回避
            return this.exchange.createOrder(
              symbol,
              ccxtOrderType,
              side,
              amount,
              undefined,
              marketOrderParams
            );
          }

          // 標準的な取引所の場合
          return this.exchange.createOrder(
            symbol,
            ccxtOrderType,
            side,
            amount,
            undefined,
            marketOrderParams
          );
        });

        logger.info(
          `成行注文実行: ${side} ${amount} ${symbol}, オプション: ${JSON.stringify(marketOrderParams)}`
        );

        // resultがnullでなく、かつidプロパティを持つことを確認
        if (result && typeof result === 'object' && 'id' in result && result.id) {
          return result.id;
        } else {
          logger.warn('注文は成功しましたが、注文IDが取得できませんでした');
          return null;
        }
      } else {
        // 指値注文など、価格が必要な注文の処理
        const result = await this.fetchWithExponentialBackoff(() => {
          return this.exchange.createOrder(symbol, ccxtOrderType, side, amount, price, params);
        });

        logger.info(
          `注文実行: ${side} ${amount} ${symbol} @ ${price || 'market'}, オプション: ${JSON.stringify(params)}`
        );

        // resultがnullでなく、かつidプロパティを持つことを確認
        if (result && typeof result === 'object' && 'id' in result && result.id) {
          return result.id;
        } else {
          logger.warn('注文は成功しましたが、注文IDが取得できませんでした');
          return null;
        }
      }
    } catch (error) {
      logger.error(`注文実行エラー: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * OrderTypeをCCXTの注文タイプ文字列に変換する
   * @param orderType 注文タイプEnum
   * @returns CCXTで使用する注文タイプ文字列
   */
  private mapOrderTypeToCCXT(orderType: OrderType): string {
    // 新しいユーティリティ関数を使用
    return orderTypeToCcxt(orderType);
  }

  /**
   * CCXTの注文タイプ文字列からOrderTypeに変換する
   * @param ccxtOrderType CCXT注文タイプ文字列
   * @returns OrderType enum値
   */
  private mapCCXTToOrderType(ccxtOrderType: string): OrderType {
    // 新しいユーティリティ関数を使用
    return ccxtToOrderType(ccxtOrderType);
  }

  /**
   * OCO注文（One-Cancels-the-Other）を作成
   * 利確と損切りを同時に注文し、どちらかが約定すると他方はキャンセルされる
   * @param params OCO注文のパラメータ
   * @returns 注文ID（成功した場合）またはnull
   */
  public async createOcoOrder(params: OcoOrderParams): Promise<string | null> {
    if (!this.isInitialized) {
      logger.error('取引所が初期化されていません');
      return null;
    }

    try {
      // 取引所がOCO注文をサポートしているか確認
      const hasOcoSupport = this.supportsOCO();

      if (hasOcoSupport) {
        // ネイティブOCO注文をサポートしている場合
        // まず標準的なメソッド名'createOCOOrder'をチェック
        let createOCOMethod = this.exchange.createOCOOrder;

        // 存在しなければ'createOCO'をチェック（一部の取引所での命名）
        if (!createOCOMethod && 'createOCO' in this.exchange) {
          createOCOMethod = (this.exchange as any).createOCO;
        }

        if (!createOCOMethod) {
          logger.error('取引所がOCO注文をサポートしているのに、メソッドが存在しません');
          return null;
        }

        const result = await this.fetchWithExponentialBackoff(() =>
          createOCOMethod.call(
            this.exchange,
            params.symbol,
            params.side.toLowerCase(),
            params.amount,
            params.limitPrice,
            params.stopPrice,
            params.stopLimitPrice
          )
        );

        logger.info(
          `OCO注文実行: ${params.side} ${params.amount} ${params.symbol}, 指値=${params.limitPrice}, ストップ=${params.stopPrice}`
        );

        // resultの安全な処理 - 取引所によって戻り値が異なる可能性に対応
        if (!result) {
          logger.warn('OCO注文結果がnullまたはundefinedでした');
          return null;
        }

        // Binanceなど配列を返す取引所への対応
        if (Array.isArray(result)) {
          logger.debug(`OCO注文結果が配列形式で返されました (${this.exchange.id})`);
          if (
            result.length > 0 &&
            result[0] &&
            typeof result[0] === 'object' &&
            'id' in result[0]
          ) {
            return result[0].id as string;
          }
        }
        // KuCoinなどオブジェクトを返す取引所への対応
        else if (typeof result === 'object') {
          logger.debug(`OCO注文結果がオブジェクト形式で返されました (${this.exchange.id})`);
          if ('id' in result && result.id) {
            return result.id as string;
          }
        }

        // いずれの形式にも該当しない場合
        logger.warn(
          `OCO注文は成功しましたが、想定外の形式でした: ${JSON.stringify(result).substring(0, 200)}...`
        );
        return null;
      } else {
        // OCOをサポートしていない場合は個別に注文を出す
        logger.warn(
          `取引所がOCO注文をサポートしていないため、個別に注文を出します: ${this.exchange.name}`
        );

        // 利確注文（指値）
        const limitOrderId = await this.executeOrder({
          symbol: params.symbol,
          type: OrderType.LIMIT,
          side: params.side,
          amount: params.amount,
          price: params.limitPrice
        });

        // 損切り注文（ストップ）
        const stopOrderId = await this.executeOrder({
          symbol: params.symbol,
          type: OrderType.STOP,
          side: params.side,
          amount: params.amount,
          stopPrice: params.stopPrice,
          price: params.stopLimitPrice || params.stopPrice // ストップリミットの場合は指定された価格、そうでなければストップ価格
        });

        if (limitOrderId && stopOrderId) {
          logger.info(`個別注文で擬似OCO作成: 指値=${limitOrderId}, ストップ=${stopOrderId}`);
          return `${limitOrderId},${stopOrderId}`; // 両方の注文IDをカンマ区切りで返す
        } else {
          logger.error('OCO注文の作成に失敗しました');

          // 部分的に成功した注文をキャンセル
          if (limitOrderId) {
            await this.fetchWithExponentialBackoff(() =>
              this.exchange.cancelOrder(limitOrderId, params.symbol)
            );
          }
          if (stopOrderId) {
            await this.fetchWithExponentialBackoff(() =>
              this.exchange.cancelOrder(stopOrderId, params.symbol)
            );
          }

          return null;
        }
      }
    } catch (error) {
      logger.error(`OCO注文実行エラー: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * 口座残高を取得する
   * @returns 利用可能な残高
   */
  public async fetchBalance(): Promise<Record<string, number>> {
    if (!this.isInitialized) {
      logger.error('取引所が初期化されていません');
      return {};
    }

    try {
      const balances = await this.fetchWithExponentialBackoff(() => this.exchange.fetchBalance());
      const result: Record<string, number> = {};

      // 利用可能な残高を抽出
      for (const [currency, balance] of Object.entries(balances.free || {})) {
        result[currency] = balance as number;
      }

      return result;
    } catch (error) {
      logger.error(`残高取得エラー: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  }

  /**
   * 注文情報を取得する
   * @param orderId 取引所の注文ID
   * @param symbol 銘柄（例: 'SOL/USDT'）
   * @returns 注文情報
   */
  public async fetchOrder(orderId: string, symbol: string): Promise<ccxt.Order | null> {
    if (!this.isInitialized) {
      logger.error('取引所が初期化されていません');
      return null;
    }

    try {
      return await this.fetchWithExponentialBackoff(() =>
        this.exchange.fetchOrder(orderId, symbol)
      );
    } catch (error) {
      logger.error(`注文情報取得エラー: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * 注文情報を取得し、システム内部のOrder型に変換する
   * @param orderId 取引所の注文ID
   * @param symbol 銘柄（例: 'SOL/USDT'）
   * @returns システム内部のOrder型に変換された注文情報、またはnull
   */
  public async fetchOrderAndConvert(orderId: string, symbol: string): Promise<Order | null> {
    const ccxtOrder = await this.fetchOrder(orderId, symbol);
    if (!ccxtOrder) {
      return null;
    }

    // CCXT注文をシステム内部のOrder型に変換
    return this.convertCcxtOrderToInternalOrder(ccxtOrder);
  }

  /**
   * CCXT注文オブジェクトをシステム内部のOrder型に変換する
   * @param ccxtOrder CCXT注文オブジェクト
   * @returns システム内部のOrder型
   */
  private convertCcxtOrderToInternalOrder(ccxtOrder: ccxt.Order): Order {
    // 注文タイプが存在する場合は変換、ない場合はデフォルトでLIMIT
    const orderType = ccxtOrder.type ? this.mapCCXTToOrderType(ccxtOrder.type) : OrderType.LIMIT;

    return {
      exchangeOrderId: ccxtOrder.id,
      symbol: ccxtOrder.symbol,
      type: orderType,
      side: ccxtOrder.side as OrderSide,
      price: ccxtOrder.price,
      amount: ccxtOrder.amount,
      status: this.mapCcxtStatusToOrderStatus(ccxtOrder.status),
      timestamp: ccxtOrder.timestamp
    };
  }

  /**
   * CCXT注文ステータスをOrderStatusに変換する
   * @param ccxtStatus CCXT注文ステータス
   * @returns OrderStatus
   */
  private mapCcxtStatusToOrderStatus(ccxtStatus?: string): OrderStatus {
    if (!ccxtStatus) return OrderStatus.OPEN;

    switch (ccxtStatus.toLowerCase()) {
      case 'open':
        return OrderStatus.PLACED;
      case 'closed':
      case 'filled':
        return OrderStatus.FILLED;
      case 'canceled':
        return OrderStatus.CANCELED;
      case 'rejected':
        return OrderStatus.REJECTED;
      default:
        return OrderStatus.OPEN;
    }
  }

  /**
   * 取引所のサポート状況をチェックする
   * @param feature チェックする機能（例: 'fetchOHLCV'）
   * @returns サポートされているかどうか
   */
  public supportsFeature(feature: string): boolean {
    if (!this.isInitialized) {
      return false;
    }

    // OCO関連の機能は特別な処理を行う
    if (feature === 'createOCO' || feature === 'createOCOOrder') {
      return this.supportsOCO();
    }

    return Boolean(this.exchange.has[feature]);
  }

  /**
   * 取引所がOCO注文をサポートしているかどうかをチェックする
   * この関数は両方の可能なキー名をチェックします
   * @returns OCO注文がサポートされているかどうか
   */
  public supportsOCO(): boolean {
    if (!this.isInitialized || !this.exchange.has) {
      return false;
    }

    // 両方のキー名をチェック（'createOCO'と'createOCOOrder'）
    return Boolean(this.exchange.has['createOCO'] || this.exchange.has['createOCOOrder']);
  }

  /**
   * 取引所名を取得する
   * @returns 取引所の名前
   */
  public getExchangeName(): string {
    if (!this.isInitialized) {
      return 'Not initialized';
    }

    return this.exchange.name;
  }

  /**
   * 特定の通貨ペアのマーケット情報を取得する
   * @param symbol 通貨ペア (例: 'BTC/USDT')
   * @returns マーケット情報オブジェクト
   */
  public async getMarketInfo(symbol: string): Promise<any> {
    if (!this.isInitialized) {
      logger.error('取引所が初期化されていません');
      throw new Error('取引所が初期化されていません');
    }

    try {
      // マーケット情報をロード
      await this.exchange.loadMarkets();
      
      // シンボルが存在するか確認
      if (!(symbol in this.exchange.markets)) {
        logger.error(`シンボルが見つかりません: ${symbol}`);
        return null;
      }
      
      return this.exchange.markets[symbol];
    } catch (error) {
      logger.error(`マーケット情報取得エラー: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`マーケット情報を取得できません: ${symbol}`);
    }
  }

  /**
   * 特定の通貨ペアのティッカー（現在価格情報）を取得する
   * @param symbol 通貨ペア (例: 'BTC/USDT')
   * @returns ティッカーオブジェクト
   */
  public async fetchTicker(symbol: string): Promise<any> {
    if (!this.isInitialized) {
      logger.error('取引所が初期化されていません');
      throw new Error('取引所が初期化されていません');
    }

    try {
      return await this.exchange.fetchTicker(symbol);
    } catch (error) {
      logger.error(`ティッカー取得エラー: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`ティッカーを取得できません: ${symbol}`);
    }
  }
}
