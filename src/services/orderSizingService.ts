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

import { ExchangeService } from "./exchangeService.js";
import { SymbolInfoService, SymbolInfo } from "./symbolInfoService.js";
import logger from "../utils/logger.js";
import { ParameterService } from "../config/parameterService.js";

// パラメータサービスのインスタンスを取得
const parameterService = ParameterService.getInstance();

// リスク関連のパラメータを取得
const DEFAULT_RISK_PERCENTAGE = parameterService.get<number>('risk.max_risk_per_trade', 0.01);
const DEFAULT_FALLBACK_ATR_PERCENTAGE = parameterService.get<number>('risk.defaultAtrPercentage', 0.02);
const MIN_STOP_DISTANCE_PERCENTAGE = parameterService.get<number>('risk.minStopDistancePercentage', 0.01);

export class OrderSizingService {
  private exchangeService: ExchangeService;
  private symbolInfoService: SymbolInfoService;

  /**
   * OrderSizingServiceコンストラクタ
   * @param exchangeService 取引所サービスのインスタンス
   * @param symbolInfoService シンボル情報サービスのインスタンス（指定がない場合は内部で作成）
   */
  constructor(exchangeService: ExchangeService, symbolInfoService?: SymbolInfoService) {
    this.exchangeService = exchangeService;
    this.symbolInfoService = symbolInfoService || new SymbolInfoService(exchangeService);
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
    try {
      // 通貨ペア情報を取得
      const symbolInfo = await this.symbolInfoService.getSymbolInfo(symbol);
      
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
      orderSize = this.applyMarketConstraints(orderSize, currentPrice, symbolInfo);

      // 数量精度に丸める
      orderSize = this.roundToPrecision(orderSize, symbolInfo.amountPrecision);

      logger.debug(
        `OrderSizingService: 計算結果 ${symbol} - サイズ: ${orderSize}, 残高: ${accountBalance}, リスク: ${riskPercentage}, ストップ距離: ${stopDistance}`
      );

      return orderSize;
    } catch (error) {
      logger.error(`注文サイズ計算エラー: ${symbol}`, error);
      throw new Error(`注文サイズの計算に失敗しました: ${symbol} - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 複数銘柄の注文サイズを一括計算
   * @param symbols 通貨ペアの配列
   * @param accountBalance 利用可能残高
   * @param stopDistances 各シンボルのストップ距離
   * @param currentPrices 各シンボルの現在価格（省略可）
   * @param riskPercentage リスク割合（全銘柄共通）
   * @returns 通貨ペアごとの注文サイズを含むマップ
   */
  public async calculateMultipleOrderSizes(
    symbols: string[],
    accountBalance: number,
    stopDistances: Record<string, number>,
    currentPrices?: Record<string, number>,
    riskPercentage: number = DEFAULT_RISK_PERCENTAGE
  ): Promise<Map<string, number>> {
    // 各シンボルの注文サイズを個別に計算
    const result = new Map<string, number>();
    const promises = symbols.map(async (symbol) => {
      try {
        const stopDistance = stopDistances[symbol];
        if (!stopDistance) {
          logger.warn(`シンボル ${symbol} のストップ距離が指定されていません`);
          return;
        }
        
        const currentPrice = currentPrices ? currentPrices[symbol] : undefined;
        const orderSize = await this.calculateOrderSize(
          symbol,
          accountBalance,
          stopDistance,
          currentPrice,
          riskPercentage
        );
        
        result.set(symbol, orderSize);
      } catch (error) {
        logger.error(`シンボル ${symbol} の注文サイズ計算に失敗:`, error);
        // エラーは無視して処理を続行（個別の失敗を許容）
      }
    });
    
    await Promise.all(promises);
    return result;
  }

  /**
   * マーケットの制約（最小ロットサイズ、最小コスト）を適用する
   * @param orderSize 計算された注文サイズ
   * @param price 現在価格
   * @param symbolInfo シンボル情報
   * @returns 制約を適用した注文サイズ
   */
  private applyMarketConstraints(
    orderSize: number,
    price: number,
    symbolInfo: SymbolInfo
  ): number {
    // 最小ロットサイズ制約
    const minAmount = symbolInfo.minAmount || 0;
    if (orderSize < minAmount) {
      logger.debug(
        `注文サイズ(${orderSize})が最小ロットサイズ(${minAmount})より小さいため、最小値に調整します`
      );
      orderSize = minAmount;
    }

    // 最小コスト制約
    const minCost = symbolInfo.minCost || 0;
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
    const maxAmount = symbolInfo.maxAmount || Number.MAX_VALUE;
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
    if (precision === undefined || precision < 0) {
      logger.warn(`不正な精度値: ${precision}、デフォルト値8を使用します`);
      precision = 8; // デフォルト値
    }
    const factor = Math.pow(10, precision);
    return Math.floor(value * factor) / factor;
  }

  /**
   * 指定された通貨ペアの価格を最小ティックに丸める
   * @param symbol 通貨ペア
   * @param price 丸める価格
   * @returns 最小ティックに丸められた価格
   */
  public async roundPriceToTickSize(symbol: string, price: number): Promise<number> {
    try {
      const symbolInfo = await this.symbolInfoService.getSymbolInfo(symbol);
      const tickSize = symbolInfo.tickSize;
      
      if (!tickSize) {
        logger.warn(`ティックサイズが見つかりません: ${symbol}、価格精度でフォールバックします`);
        return this.roundToPrecision(price, symbolInfo.pricePrecision);
      }
      
      return Math.floor(price / tickSize) * tickSize;
    } catch (error) {
      logger.error(`価格の丸め処理エラー: ${symbol}`, error);
      // エラー時は精度8で丸める
      return Math.floor(price * 100000000) / 100000000;
    }
  }
  
  /**
   * シンボル情報サービスを取得する
   * @returns シンボル情報サービスのインスタンス
   */
  public getSymbolInfoService(): SymbolInfoService {
    return this.symbolInfoService;
  }
} 