/**
 * 取引所との通信を管理するサービス
 * 
 * このファイルはccxtライブラリを使用して、暗号資産取引所とのやり取りを抽象化します。
 * 市場データの取得や注文の実行など、取引所関連の操作を提供します。
 */

import ccxt from 'ccxt';
import { Candle, Order, OrderSide, OrderType } from '../core/types';
import logger from '../utils/logger';

/**
 * 取引所サービスクラス
 */
export class ExchangeService {
  private exchange: ccxt.Exchange;
  private isInitialized: boolean = false;

  /**
   * 取引所サービスを初期化する
   * @param exchangeId 取引所ID（例: 'binance'）
   * @param apiKey APIキー
   * @param secret 秘密鍵
   */
  public async initialize(exchangeId: string, apiKey?: string, secret?: string): Promise<boolean> {
    try {
      // 取引所インスタンスの作成
      const exchangeClass = ccxt[exchangeId];
      if (!exchangeClass) {
        logger.error(`指定された取引所が見つかりません: ${exchangeId}`);
        return false;
      }

      this.exchange = new exchangeClass({
        apiKey,
        secret,
        enableRateLimit: true,
      });

      // 取引所への接続テスト
      await this.exchange.loadMarkets();
      this.isInitialized = true;
      logger.info(`取引所に接続しました: ${exchangeId}`);
      return true;
    } catch (error) {
      logger.error(`取引所接続エラー: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 指定された銘柄と時間枠の市場データを取得する
   * @param symbol 銘柄（例: 'SOL/USDT'）
   * @param timeframe 時間枠（例: '1h', '5m'）
   * @param limit 取得するローソク足の数
   * @returns ローソク足データの配列
   */
  public async fetchCandles(symbol: string, timeframe: string, limit: number = 100): Promise<Candle[]> {
    if (!this.isInitialized) {
      logger.error('取引所が初期化されていません');
      return [];
    }

    try {
      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
      
      return ohlcv.map(candle => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5]
      }));
    } catch (error) {
      logger.error(`市場データ取得エラー: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 注文を実行する
   * @param order 注文オブジェクト
   * @returns 注文ID（成功した場合）またはnull
   */
  public async executeOrder(order: Order): Promise<string | null> {
    if (!this.isInitialized) {
      logger.error('取引所が初期化されていません');
      return null;
    }

    try {
      const type = order.type.toLowerCase();
      const side = order.side.toLowerCase();
      const amount = order.amount;
      const price = order.price;
      const symbol = order.symbol;

      const params: any = {};
      
      // ストップ注文の場合、パラメータを追加
      if (order.type === OrderType.STOP || order.type === OrderType.STOP_LIMIT) {
        params.stopPrice = order.stopPrice;
      }

      const result = await this.exchange.createOrder(
        symbol,
        type,
        side,
        amount,
        price,
        params
      );

      logger.info(`注文実行: ${side} ${amount} ${symbol} @ ${price || 'market'}`);
      return result.id;
    } catch (error) {
      logger.error(`注文実行エラー: ${error instanceof Error ? error.message : String(error)}`);
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
      const balances = await this.exchange.fetchBalance();
      const result: Record<string, number> = {};

      // 利用可能な残高を抽出
      for (const [currency, balance] of Object.entries(balances.free)) {
        result[currency] = balance as number;
      }

      return result;
    } catch (error) {
      logger.error(`残高取得エラー: ${error instanceof Error ? error.message : String(error)}`);
      return {};
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
    
    return this.exchange.has[feature];
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
} 