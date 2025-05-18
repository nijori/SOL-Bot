/**
 * UnifiedOrderManager
 *
 * 複数取引所の注文を統合管理するクラス
 * OMS-009: 複数取引所対応
 */

// @ts-nocheck
const Types = require('../core/types');
const { Order, OrderStatus, OrderSide, OrderType, Position } = Types;
const { OrderManagementSystem } = require('../core/orderManagementSystem');
const { ExchangeService } = require('./exchangeService');
const logger = require('../utils/logger');

// 取引所情報の型定義
// export interface ExchangeInfo {
//   id: string;
//   name: string;
//   exchangeService: ExchangeService;
//   oms: OrderManagementSystem;
//   active: boolean;
//   priority: number; // 優先度（低いほど優先）
// }

// 注文配分方法
const AllocationStrategy = {
  PRIORITY: 'PRIORITY', // 優先度の高い取引所から順に
  ROUND_ROBIN: 'ROUND_ROBIN', // ラウンドロビン方式
  SPLIT_EQUAL: 'SPLIT_EQUAL', // 均等分割
  CUSTOM: 'CUSTOM' // カスタム配分（getAllocationRatioで定義）
};

// 注文配分設定
// export interface AllocationConfig {
//   strategy: AllocationStrategy;
//   customRatios?: Map<string, number>; // CUSTOM戦略の場合の取引所ごとの配分率
// }

/**
 * 複数取引所の注文を統合管理するクラス
 */
class UnifiedOrderManager {
  /**
   * コンストラクタ
   * @param allocationConfig 注文配分設定
   */
  constructor(allocationConfig = { strategy: AllocationStrategy.PRIORITY }) {
    this.exchanges = new Map();
    this.allocationConfig = allocationConfig;
    this.lastUsedExchangeIndex = 0;
    logger.info('[UnifiedOrderManager] 複数取引所対応の注文管理システムを初期化しました');
  }

  /**
   * 取引所を追加
   * @param exchangeId 取引所ID
   * @param exchangeService 取引所サービス
   * @param priority 優先度（低いほど優先）
   * @returns 追加が成功したかどうか
   */
  addExchange(exchangeId, exchangeService, priority = 100) {
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
  removeExchange(exchangeId) {
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
  setExchangeActive(exchangeId, active) {
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
  getActiveExchanges() {
    return Array.from(this.exchanges.values())
      .filter((ex) => ex.active)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * 注文を最適な取引所に配分
   * @param order 注文情報
   * @returns 配分された注文と取引所のマップ
   */
  allocateOrder(order) {
    const activeExchanges = this.getActiveExchanges();
    if (activeExchanges.length === 0) {
      logger.error('[UnifiedOrderManager] 有効な取引所がありません');
      return new Map();
    }

    const allocatedOrders = new Map();

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
  createOrder(order) {
    const allocatedOrders = this.allocateOrder(order);
    const orderIds = new Map();

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
  cancelOrder(exchangeId, orderId) {
    const exchange = this.exchanges.get(exchangeId);
    if (!exchange) {
      logger.warn(`[UnifiedOrderManager] 取引所 ${exchangeId} は登録されていません`);
      return false;
    }

    try {
      const result = exchange.oms.cancelOrder(orderId);
      logger.info(
        `[UnifiedOrderManager] 取引所 ${exchangeId} で注文キャンセル: ${orderId}, 結果: ${result}`
      );
      return result;
    } catch (error) {
      logger.error(
        `[UnifiedOrderManager] 取引所 ${exchangeId} での注文キャンセルエラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * 全ての注文をキャンセル
   * @param symbol 特定のシンボルのみキャンセルする場合に指定
   * @returns キャンセルされた注文の総数
   */
  cancelAllOrders(symbol) {
    let cancelledCount = 0;

    for (const exchange of this.exchanges.values()) {
      if (!exchange.active) continue;

      try {
        const count = exchange.oms.cancelAllOrders(symbol);
        cancelledCount += count;
        logger.info(
          `[UnifiedOrderManager] 取引所 ${exchange.id} で${symbol ? `${symbol}の` : '全'}注文をキャンセル: ${count}件`
        );
      } catch (error) {
        logger.error(
          `[UnifiedOrderManager] 取引所 ${exchange.id} での注文一括キャンセルエラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return cancelledCount;
  }

  /**
   * 全取引所のポジションを取得
   * @param symbol 特定のシンボルのみ取得する場合に指定
   * @returns 取引所ごとのポジションマップ
   */
  getAllPositions(symbol) {
    const positionsMap = new Map();

    for (const exchange of this.exchanges.values()) {
      if (!exchange.active) continue;

      try {
        const positions = exchange.oms.getPositions(symbol);
        // 空でない場合のみマップに追加
        if (positions.length > 0) {
          positionsMap.set(exchange.id, positions);
        }
      } catch (error) {
        logger.error(
          `[UnifiedOrderManager] 取引所 ${exchange.id} のポジション取得エラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return positionsMap;
  }

  /**
   * 指定シンボルの全取引所の合計ポジションを取得
   * @param symbol シンボル
   * @returns 合計ポジション（存在しない場合はnull）
   */
  getTotalPosition(symbol) {
    if (!symbol) {
      logger.error('[UnifiedOrderManager] シンボルが指定されていません');
      return null;
    }

    const positionsMap = this.getAllPositions(symbol);
    let totalSize = 0;
    let totalCost = 0;
    let totalUnrealizedPnl = 0;
    let totalEntryPrice = 0;
    let count = 0;

    // 各取引所のポジションを合算
    for (const positions of positionsMap.values()) {
      for (const position of positions) {
        if (position.symbol === symbol) {
          totalSize += position.size;
          totalCost += position.cost;
          totalUnrealizedPnl += position.unrealizedPnl || 0;
          count++;
        }
      }
    }

    // ポジションが存在しない場合はnullを返す
    if (count === 0 || Math.abs(totalSize) < 0.000001) {
      return null;
    }

    // 平均エントリー価格を計算
    if (totalSize !== 0) {
      totalEntryPrice = totalCost / Math.abs(totalSize);
    }

    // 合計ポジションを作成
    const totalPosition = {
      symbol,
      size: totalSize,
      entryPrice: totalEntryPrice,
      cost: totalCost,
      unrealizedPnl: totalUnrealizedPnl,
      side: totalSize > 0 ? OrderSide.BUY : OrderSide.SELL,
      timestamp: Date.now()
    };

    return totalPosition;
  }

  /**
   * 注文配分戦略を設定
   * @param config 配分設定
   */
  setAllocationStrategy(config) {
    this.allocationConfig = config;
    logger.info(`[UnifiedOrderManager] 注文配分戦略を変更: ${config.strategy}`);
  }

  /**
   * 全取引所の注文状態を同期
   */
  async syncAllOrders() {
    for (const exchange of this.exchanges.values()) {
      if (!exchange.active) continue;

      try {
        await exchange.oms.syncOrderStatus();
        logger.debug(`[UnifiedOrderManager] 取引所 ${exchange.id} の注文状態を同期しました`);
      } catch (error) {
        logger.error(
          `[UnifiedOrderManager] 取引所 ${exchange.id} の注文状態同期エラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
}

// CommonJS形式でエクスポート
module.exports = {
  UnifiedOrderManager,
  AllocationStrategy
};
