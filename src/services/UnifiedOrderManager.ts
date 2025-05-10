/**
 * UnifiedOrderManager
 *
 * 複数取引所の注文を統合管理するクラス
 * OMS-009: 複数取引所対応
 */

import { Order, OrderStatus, OrderSide, OrderType, Position } from '../core/types.js';
import { OrderManagementSystem } from '../core/orderManagementSystem.js';
import { ExchangeService } from './exchangeService.js';
import logger from '../utils/logger.js';

// 取引所情報の型定義
export interface ExchangeInfo {
  id: string;
  name: string;
  exchangeService: ExchangeService;
  oms: OrderManagementSystem;
  active: boolean;
  priority: number; // 優先度（低いほど優先）
}

// 注文配分方法
export enum AllocationStrategy {
  PRIORITY = 'PRIORITY', // 優先度の高い取引所から順に
  ROUND_ROBIN = 'ROUND_ROBIN', // ラウンドロビン方式
  SPLIT_EQUAL = 'SPLIT_EQUAL', // 均等分割
  CUSTOM = 'CUSTOM' // カスタム配分（getAllocationRatioで定義）
}

// 注文配分設定
export interface AllocationConfig {
  strategy: AllocationStrategy;
  customRatios?: Map<string, number>; // CUSTOM戦略の場合の取引所ごとの配分率
}

/**
 * 複数取引所の注文を統合管理するクラス
 */
export class UnifiedOrderManager {
  private exchanges: Map<string, ExchangeInfo> = new Map();
  private allocationConfig: AllocationConfig;
  private lastUsedExchangeIndex: number = 0;

  /**
   * コンストラクタ
   * @param allocationConfig 注文配分設定
   */
  constructor(allocationConfig: AllocationConfig = { strategy: AllocationStrategy.PRIORITY }) {
    this.allocationConfig = allocationConfig;
    logger.info('[UnifiedOrderManager] 複数取引所対応の注文管理システムを初期化しました');
  }

  /**
   * 取引所を追加
   * @param exchangeId 取引所ID
   * @param exchangeService 取引所サービス
   * @param priority 優先度（低いほど優先）
   * @returns 追加が成功したかどうか
   */
  public addExchange(
    exchangeId: string,
    exchangeService: ExchangeService,
    priority: number = 100
  ): boolean {
    if (this.exchanges.has(exchangeId)) {
      logger.warn(`[UnifiedOrderManager] 取引所 ${exchangeId} は既に追加されています`);
      return false;
    }

    // 取引所ごとのOMSを作成
    const oms = new OrderManagementSystem();
    oms.setExchangeService(exchangeService);

    this.exchanges.set(exchangeId, {
      id: exchangeId,
      name: exchangeService.getExchangeName(),
      exchangeService,
      oms,
      active: true,
      priority
    });

    logger.info(
      `[UnifiedOrderManager] 取引所 ${exchangeId} (${exchangeService.getExchangeName()}) を追加しました`
    );
    return true;
  }

  /**
   * 取引所を削除
   * @param exchangeId 取引所ID
   * @returns 削除が成功したかどうか
   */
  public removeExchange(exchangeId: string): boolean {
    if (!this.exchanges.has(exchangeId)) {
      logger.warn(`[UnifiedOrderManager] 取引所 ${exchangeId} は登録されていません`);
      return false;
    }

    this.exchanges.delete(exchangeId);
    logger.info(`[UnifiedOrderManager] 取引所 ${exchangeId} を削除しました`);
    return true;
  }

  /**
   * 取引所の有効/無効を切り替え
   * @param exchangeId 取引所ID
   * @param active 有効にするかどうか
   * @returns 切り替えが成功したかどうか
   */
  public setExchangeActive(exchangeId: string, active: boolean): boolean {
    const exchange = this.exchanges.get(exchangeId);
    if (!exchange) {
      logger.warn(`[UnifiedOrderManager] 取引所 ${exchangeId} は登録されていません`);
      return false;
    }

    exchange.active = active;
    this.exchanges.set(exchangeId, exchange);

    logger.info(
      `[UnifiedOrderManager] 取引所 ${exchangeId} を${active ? '有効' : '無効'}にしました`
    );
    return true;
  }

  /**
   * 有効な取引所をソートして取得
   * @returns 有効な取引所のリスト（優先度順）
   */
  private getActiveExchanges(): ExchangeInfo[] {
    return Array.from(this.exchanges.values())
      .filter((ex) => ex.active)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * 注文を最適な取引所に配分
   * @param order 注文情報
   * @returns 配分された注文と取引所のマップ
   */
  private allocateOrder(order: Order): Map<string, Order> {
    const activeExchanges = this.getActiveExchanges();
    if (activeExchanges.length === 0) {
      logger.error('[UnifiedOrderManager] 有効な取引所がありません');
      return new Map();
    }

    const allocatedOrders = new Map<string, Order>();

    switch (this.allocationConfig.strategy) {
      case AllocationStrategy.PRIORITY:
        // 優先度の最も高い取引所に全量配分
        allocatedOrders.set(activeExchanges[0].id, { ...order });
        break;

      case AllocationStrategy.ROUND_ROBIN:
        // ラウンドロビン方式で配分
        this.lastUsedExchangeIndex = (this.lastUsedExchangeIndex + 1) % activeExchanges.length;
        const selectedExchange = activeExchanges[this.lastUsedExchangeIndex];
        allocatedOrders.set(selectedExchange.id, { ...order });
        break;

      case AllocationStrategy.SPLIT_EQUAL:
        // 均等分割
        const splitAmount = order.amount / activeExchanges.length;
        activeExchanges.forEach((ex) => {
          allocatedOrders.set(ex.id, { ...order, amount: splitAmount });
        });
        break;

      case AllocationStrategy.CUSTOM:
        // カスタム配分率
        if (!this.allocationConfig.customRatios || this.allocationConfig.customRatios.size === 0) {
          logger.error('[UnifiedOrderManager] カスタム配分率が設定されていません');
          // フォールバック：優先度の最も高い取引所に全量配分
          allocatedOrders.set(activeExchanges[0].id, { ...order });
        } else {
          let remainingAmount = order.amount;

          // 登録されている取引所のうち、カスタム配分率が設定されているものだけを処理
          for (const exchange of activeExchanges) {
            const ratio = this.allocationConfig.customRatios.get(exchange.id);
            if (ratio !== undefined && ratio > 0) {
              const allocationAmount = order.amount * ratio;
              allocatedOrders.set(exchange.id, { ...order, amount: allocationAmount });
              remainingAmount -= allocationAmount;
            }
          }

          // 配分率の合計が1未満の場合、残りを優先度最高の取引所に割り当て
          if (remainingAmount > 0.00001) {
            // 浮動小数点の誤差を考慮
            const highestPriorityExchange = activeExchanges[0];
            const existingOrder = allocatedOrders.get(highestPriorityExchange.id);

            if (existingOrder) {
              existingOrder.amount += remainingAmount;
            } else {
              allocatedOrders.set(highestPriorityExchange.id, {
                ...order,
                amount: remainingAmount
              });
            }
          }
        }
        break;
    }

    return allocatedOrders;
  }

  /**
   * 注文を作成
   * @param order 注文情報
   * @returns 作成された注文IDのマップ（取引所ID -> 注文ID）
   */
  public createOrder(order: Order): Map<string, string> {
    const allocatedOrders = this.allocateOrder(order);
    const orderIds = new Map<string, string>();

    for (const [exchangeId, allocatedOrder] of allocatedOrders.entries()) {
      const exchange = this.exchanges.get(exchangeId);
      if (!exchange) continue;

      try {
        const orderId = exchange.oms.createOrder(allocatedOrder);
        orderIds.set(exchangeId, orderId);
        logger.info(
          `[UnifiedOrderManager] 取引所 ${exchangeId} で注文作成: ${orderId}, ${allocatedOrder.side} ${allocatedOrder.amount} ${allocatedOrder.symbol}`
        );
      } catch (error) {
        logger.error(
          `[UnifiedOrderManager] 取引所 ${exchangeId} での注文作成エラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return orderIds;
  }

  /**
   * 注文をキャンセル
   * @param exchangeId 取引所ID
   * @param orderId 注文ID
   * @returns キャンセルが成功したかどうか
   */
  public cancelOrder(exchangeId: string, orderId: string): boolean {
    const exchange = this.exchanges.get(exchangeId);
    if (!exchange) {
      logger.warn(`[UnifiedOrderManager] 取引所 ${exchangeId} は登録されていません`);
      return false;
    }

    return exchange.oms.cancelOrder(orderId);
  }

  /**
   * すべての取引所の特定のシンボルの注文をキャンセル
   * @param symbol シンボル名（例: 'SOL/USDT'）
   * @returns キャンセルされた注文の数
   */
  public cancelAllOrders(symbol?: string): number {
    let cancelCount = 0;

    for (const exchange of this.getActiveExchanges()) {
      const orders = exchange.oms
        .getOrders()
        .filter(
          (order) =>
            (order.status === OrderStatus.OPEN || order.status === OrderStatus.PLACED) &&
            (!symbol || order.symbol === symbol)
        );

      for (const order of orders) {
        if (order.id && exchange.oms.cancelOrder(order.id)) {
          cancelCount++;
        }
      }
    }

    logger.info(
      `[UnifiedOrderManager] ${symbol ? symbol + 'の' : ''}全注文キャンセル: ${cancelCount}件`
    );
    return cancelCount;
  }

  /**
   * 特定のシンボルの全ポジションを取得
   * @param symbol シンボル名（例: 'SOL/USDT'）
   * @returns 取引所ごとのポジションマップ
   */
  public getAllPositions(symbol?: string): Map<string, Position[]> {
    const result = new Map<string, Position[]>();

    for (const [exchangeId, exchange] of this.exchanges.entries()) {
      if (!exchange.active) continue;

      const positions = exchange.oms.getPositions();
      const filteredPositions = symbol
        ? positions.filter((pos) => pos.symbol === symbol)
        : positions;

      if (filteredPositions.length > 0) {
        result.set(exchangeId, filteredPositions);
      }
    }

    return result;
  }

  /**
   * 特定のシンボルの合計ポジションを計算
   * @param symbol シンボル名（例: 'SOL/USDT'）
   * @returns 合計ポジション、または見つからない場合はnull
   */
  public getTotalPosition(symbol: string): Position | null {
    let totalAmount = 0;
    let totalValue = 0;
    let entryPrice = 0;
    let currentPrice = 0;
    let unrealizedPnl = 0;
    let count = 0;
    let side: OrderSide | null = null;

    for (const exchange of this.getActiveExchanges()) {
      const positions = exchange.oms.getPositionsBySymbol(symbol);
      if (positions.length > 0) {
        for (const position of positions) {
          // サイド（BUY/SELL）の調整
          if (side === null) {
            side = position.side;
          } else if (side !== position.side) {
            // 異なるサイドのポジションがある場合、相殺して計算
            // この実装はシンプルな例で、実際には通貨ペアごとの詳細な計算が必要
            logger.warn(`[UnifiedOrderManager] 異なるサイドのポジションが存在します: ${symbol}`);
            continue;
          }

          totalAmount += position.amount;
          totalValue += position.amount * position.entryPrice;
          unrealizedPnl += position.unrealizedPnl;

          // 最新の価格を使用
          if (position.currentPrice > 0) {
            currentPrice = position.currentPrice;
          }

          count++;
        }
      }
    }

    if (count === 0 || totalAmount === 0) return null;

    // 加重平均エントリー価格を計算
    entryPrice = totalAmount !== 0 ? totalValue / totalAmount : 0;

    return {
      symbol,
      side: side || OrderSide.BUY, // デフォルト値
      amount: totalAmount,
      entryPrice,
      currentPrice,
      unrealizedPnl,
      timestamp: Date.now(),
      stopPrice: 0 // これは別途計算または設定する必要がある
    };
  }

  /**
   * 配分戦略を設定
   * @param config 配分設定
   */
  public setAllocationStrategy(config: AllocationConfig): void {
    this.allocationConfig = config;
    logger.info(`[UnifiedOrderManager] 配分戦略を ${config.strategy} に設定しました`);
  }

  /**
   * すべての取引所の注文を同期
   */
  public async syncAllOrders(): Promise<void> {
    for (const exchange of this.getActiveExchanges()) {
      try {
        // OMSに注文の同期を指示
        // この実装はOrderManagementSystemに同期メソッドが必要
        if ('syncOrders' in exchange.oms) {
          await (exchange.oms as any).syncOrders();
        }
      } catch (error) {
        logger.error(
          `[UnifiedOrderManager] 取引所 ${exchange.id} の注文同期エラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    logger.info('[UnifiedOrderManager] すべての取引所の注文を同期しました');
  }
}
