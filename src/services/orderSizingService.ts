/**
 * OrderSizingService
 * 
 * マルチアセット対応の第一歩として、
 * symbol/riskAmount/stopDistanceからロットサイズを計算するサービスを実装。
 * 
 * - 各ペアの取引単位と最小ロットサイズの適切な計算
 * - 高額通貨（BTC, ETH）と小額通貨の両方で精度対応
 * - リスク金額からの注文量適切変換
 */

import { ExchangeService } from './exchangeService';
import logger from '../utils/logger';
import { ParameterService } from '../config/parameterService';

// パラメータサービスのインスタンスを取得
const parameterService = ParameterService.getInstance();

// リスク関連のパラメータを取得
const DEFAULT_RISK_PERCENTAGE = parameterService.get<number>('risk.max_risk_per_trade', 0.01);
const DEFAULT_FALLBACK_ATR_PERCENTAGE = parameterService.get<number>('risk.defaultAtrPercentage', 0.02);
const MIN_STOP_DISTANCE_PERCENTAGE = parameterService.get<number>('risk.minStopDistancePercentage', 0.01);

export class OrderSizingService {
  private exchangeService: ExchangeService;

  /**
   * OrderSizingServiceコンストラクタ
   * @param exchangeService 取引所サービスのインスタンス
   */
  constructor(exchangeService: ExchangeService) {
    this.exchangeService = exchangeService;
  }

  /**
   * 注文サイズを計算する
   * @param symbol 通貨ペア (例: 'BTC/USDT')
   * @param accountBalance 利用可能残高
   * @param stopDistance ストップ距離 (エントリー価格とストップ価格の差)
   * @param currentPrice 現在価格 (未指定の場合は取引所から取得)
   * @param riskPercentage リスク割合 (未指定の場合はデフォルト値を使用)
   * @returns 計算された注文サイズ
   */
  public async calculateOrderSize(
    symbol: string,
    accountBalance: number,
    stopDistance: number,
    currentPrice?: number,
    riskPercentage: number = DEFAULT_RISK_PERCENTAGE
  ): Promise<number> {
    // マーケット情報を取得
    const marketInfo = await this.getMarketInfo(symbol);
    if (!marketInfo) {
      throw new Error(`マーケット情報が見つかりません: ${symbol}`);
    }

    // 現在価格が指定されていない場合は取引所から取得
    if (!currentPrice) {
      try {
        const ticker = await this.exchangeService.fetchTicker(symbol);
        currentPrice = ticker.last;
      } catch (error) {
        logger.error(`価格取得エラー: ${symbol}`, error);
        throw new Error(`現在価格を取得できません: ${symbol}`);
      }
    }

    // currentPriceが取得できなかった場合はエラー
    if (!currentPrice) {
      throw new Error(`現在価格の取得に失敗しました: ${symbol}`);
    }

    // ストップ距離のチェックと修正
    if (stopDistance <= 0 || stopDistance < currentPrice * 0.0001) {
      logger.warn(`ストップ距離が非常に小さいまたは0です: ${stopDistance}. フォールバック値を使用します。`);
      stopDistance = currentPrice * MIN_STOP_DISTANCE_PERCENTAGE;
    }

    // リスク許容額を計算
    const riskAmount = accountBalance * riskPercentage;

    // ポジションサイズを計算（リスク許容額 / ストップ距離）
    let orderSize = riskAmount / stopDistance;

    // 最小ロットサイズと最小コスト制約に対応
    orderSize = this.applyMarketConstraints(orderSize, currentPrice, marketInfo);

    // 数量精度に丸める
    orderSize = this.roundToPrecision(orderSize, marketInfo.precision.amount);

    logger.debug(
      `OrderSizingService: 計算結果 ${symbol} - サイズ: ${orderSize}, 残高: ${accountBalance}, リスク: ${riskPercentage}, ストップ距離: ${stopDistance}`
    );

    return orderSize;
  }

  /**
   * マーケットの制約（最小ロットサイズ、最小コスト）を適用する
   * @param orderSize 計算された注文サイズ
   * @param price 現在価格
   * @param marketInfo マーケット情報
   * @returns 制約を適用した注文サイズ
   */
  private applyMarketConstraints(
    orderSize: number,
    price: number,
    marketInfo: any
  ): number {
    // 最小ロットサイズ制約
    const minAmount = marketInfo.limits.amount.min || 0;
    if (orderSize < minAmount) {
      logger.debug(
        `注文サイズ(${orderSize})が最小ロットサイズ(${minAmount})より小さいため、最小値に調整します`
      );
      orderSize = minAmount;
    }

    // 最小コスト制約
    const minCost = marketInfo.limits.cost?.min || 0;
    if (minCost > 0 && orderSize * price < minCost) {
      const newSize = minCost / price;
      logger.debug(
        `注文コスト(${orderSize * price})が最小コスト(${minCost})より小さいため、サイズを調整します: ${newSize}`
      );
      
      // 最小コストを満たすためのサイズが最小ロットサイズより大きい場合のみ適用
      if (newSize > minAmount) {
        orderSize = newSize;
      }
    }

    // 最大ロットサイズ制約
    const maxAmount = marketInfo.limits.amount.max || Number.MAX_VALUE;
    if (orderSize > maxAmount) {
      logger.debug(
        `注文サイズ(${orderSize})が最大ロットサイズ(${maxAmount})より大きいため、最大値に調整します`
      );
      orderSize = maxAmount;
    }

    return orderSize;
  }

  /**
   * 数値を指定された精度に丸める
   * @param value 丸める数値
   * @param precision 精度（小数点以下の桁数）
   * @returns 丸められた数値
   */
  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.floor(value * factor) / factor;
  }

  /**
   * マーケット情報を取得する
   * @param symbol 通貨ペア
   * @returns マーケット情報オブジェクト
   */
  private async getMarketInfo(symbol: string): Promise<any> {
    try {
      return await this.exchangeService.getMarketInfo(symbol);
    } catch (error) {
      logger.error(`マーケット情報取得エラー: ${symbol}`, error);
      return null;
    }
  }
} 