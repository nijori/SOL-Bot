const { Order, OrderSide, OrderStatus, OrderType, Position, Fill } = require('./types');
const logger = require('../utils/logger').default;
const { OrderOptions, OcoOrderParams } = require('../services/exchangeService');
const { ExchangeService } = require('../services/exchangeService');
const { updateOrderStatus, syncFillWithOrder } = require('../utils/orderUtils');
// node-cronの型定義
// @ts-ignore - node-cronの型定義が不完全なため
const cron = require('node-cron');

// node-cronのScheduledTaskインターフェース
interface ScheduledTask {
  stop: () => void;
  start: () => void;
  destroy?: () => void; // optional: node-cron v3.0.0以降で利用可能
}

/**
 * 注文管理システム（OMS）
 * 注文の作成、管理、追跡を行うクラス
 */
class OrderManagementSystem {
  constructor() {
    this.orders = new Map();
    this.positions = new Map();
    this.nextOrderId = 1;
    this.exchangeService = null;
    this.fillMonitorTask = null;
    
    logger.info('[OMS] 注文管理システムを初期化しました');
  }

  /**
   * 取引所サービスを設定する
   * @param {object} service ExchangeServiceのインスタンス
   */
  setExchangeService(service) {
    this.exchangeService = service;
    logger.info('[OMS] 取引所サービスが設定されました');

    // 取引所サービスが設定されたら未決済注文の監視を開始
    this.startOrderMonitoring();
  }

  /**
   * 未決済注文の監視を開始する
   * 1分ごとに未決済注文のステータスを確認する
   */
  startOrderMonitoring() {
    if (this.fillMonitorTask) {
      // 多重起動対策: 既存のタスクを確実に停止
      if (typeof this.fillMonitorTask.destroy === 'function') {
        this.fillMonitorTask.destroy();
      } else {
        this.fillMonitorTask.stop();
      }
      this.fillMonitorTask = null;
    }

    // cronジョブで1分ごとに実行（タイムゾーン設定を追加）
    this.fillMonitorTask = cron.schedule(
      '* * * * *',
      async () => {
        try {
          await this.checkPendingOrders();
        } catch (error) {
          logger.error(
            `[OMS] 未決済注文監視エラー: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      },
      {
        timezone: 'UTC' // UTCタイムゾーンを使用
      }
    );

    logger.info('[OMS] 未決済注文の監視を開始しました（1分間隔、UTC）');
  }

  /**
   * 未決済注文のステータスを確認する
   * @param {boolean} forceCheck 強制的に全注文をチェックするかどうか
   */
  async checkPendingOrders(forceCheck = false) {
    if (!this.exchangeService) {
      return;
    }

    // 未決済（PLACED）状態の注文を取得
    const pendingOrders = forceCheck
      ? [...this.getOrdersByStatus(OrderStatus.OPEN), ...this.getOrdersByStatus(OrderStatus.PLACED)]
      : this.getOrdersByStatus(OrderStatus.PLACED);

    if (pendingOrders.length === 0) {
      return;
    }

    logger.debug(
      `[OMS] 未決済注文を確認中: ${pendingOrders.length}件${forceCheck ? ' (強制チェック)' : ''}`
    );

    // 約定情報のバッチ
    const fillBatch = [];

    for (const order of pendingOrders) {
      if (!order.exchangeOrderId || !order.symbol) {
        continue;
      }

      try {
        // 取引所から注文情報を取得
        const exchangeOrderId = order.exchangeOrderId; // TypeScriptの制約回避のために変数に格納
        const symbol = order.symbol; // TypeScriptの制約回避のために変数に格納
        const orderInfo = await this.exchangeService.fetchOrder(exchangeOrderId, symbol);

        if (!orderInfo) {
          logger.warn(`[OMS] 注文情報が取得できませんでした: ${order.id}, ${exchangeOrderId}`);
          continue;
        }

        // 注文ステータスに基づいて更新
        if (orderInfo.status === 'closed' || orderInfo.status === 'filled') {
          // 注文状態を更新
          const updatedOrder = updateOrderStatus(order, orderInfo.status);
          if (order.id) {
            this.orders.set(order.id, updatedOrder);
          }

          // 約定情報を作成
          const fill = syncFillWithOrder(updatedOrder, {
            price: orderInfo.price || order.price || 0,
            amount: orderInfo.amount || order.amount,
            timestamp: Date.now()
          });

          // 約定バッチに追加
          fillBatch.push(fill);

          // 約定として処理
          this.processFill(fill);

          // 約定履歴を保存
          this.saveFillHistory(fill);

          logger.info(`[OMS] 注文が約定しました: ${order.id}, 価格: ${fill.price}`);
        } else if (orderInfo.status === 'canceled' || orderInfo.status === 'expired') {
          // 注文状態を更新
          const updatedOrder = updateOrderStatus(order, orderInfo.status);
          if (order.id) {
            this.orders.set(order.id, updatedOrder);
            logger.info(`[OMS] 注文がキャンセルされました: ${order.id}`);
          } else {
            logger.warn(`[OMS] ID不明の注文がキャンセルされました`);
          }
        } else {
          // その他のステータス（open, partiallyFilled など）
          const updatedOrder = updateOrderStatus(order, orderInfo.status);
          if (order.id) {
            this.orders.set(order.id, updatedOrder);
          }
          logger.debug(`[OMS] 注文 ${order.id} のステータス: ${orderInfo.status}`);
        }
      } catch (error) {
        logger.warn(
          `[OMS] 注文状態の確認エラー: ${order.id}, ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // バッチ処理の結果をログに出力
    if (fillBatch.length > 0) {
      logger.info(`[OMS] 約定確認バッチ処理: ${fillBatch.length}件の注文が約定しました`);
    }
  }

  /**
   * WebhookからのFill通知を処理する
   * @param {object} fill 約定情報
   */
  processFill(fill) {
    // 注文IDから注文を検索
    let order = this.orders.get(fill.orderId);

    if (!order) {
      logger.warn(
        `[OMS] 約定処理失敗: 注文が見つかりません, exchangeOrderId: ${fill.exchangeOrderId || 'unknown'}`
      );
      return;
    }

    // すでに約定済みの場合は処理しない
    if (order.status === OrderStatus.FILLED) {
      logger.debug(`[OMS] 注文 ${order.id} は既に約定済みです`);
      return;
    }

    // 注文のステータスを更新
    order.status = OrderStatus.FILLED;
    if (order.id) {
      this.orders.set(order.id, order);
    } else {
      logger.warn(`[OMS] ID不明の注文が約定しました`);
    }

    // ポジションを更新
    this.updatePosition(order, fill.price);

    logger.info(
      `[OMS] Webhook通知による約定処理: ${order.id}, ${order.side} ${order.amount} ${order.symbol} @ ${fill.price}`
    );
  }

  /**
   * 注文を作成して追跡する
   * @param {object} order 注文情報
   * @param {object} options 注文オプション
   * @returns {string} 生成された注文ID
   */
  createOrder(order, options) {
    // 注文IDを生成（実際の取引所APIを使用する場合は、APIからのレスポンスでIDを取得）
    const orderId = `order-${Date.now()}-${this.nextOrderId++}`;

    // 注文に必要な情報を追加
    const newOrder = {
      ...order,
      id: orderId,
      status: OrderStatus.OPEN, // 初期状態はOPEN
      timestamp: Date.now()
    };

    // 注文を追跡リストに追加
    this.orders.set(orderId, newOrder);

    // ストップ注文の場合、関連するポジションのストップ価格を更新
    if (newOrder.type === OrderType.STOP && newOrder.stopPrice) {
      this.updatePositionStopPrice(
        newOrder.symbol,
        newOrder.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY,
        newOrder.stopPrice
      );
    }

    // オプション情報をログに出力
    const optionsLog = options
      ? `, オプション: ${options.postOnly ? 'Post-Only' : ''}${options.hidden ? ' Hidden' : ''}${options.iceberg ? ` Iceberg(${options.iceberg})` : ''}`
      : '';

    logger.info(
      `[OMS] 注文を作成しました: ${orderId}, ${newOrder.side} ${newOrder.amount} ${newOrder.symbol} @ ${newOrder.type}${optionsLog}`
    );

    // 取引所サービスが設定されている場合、実際に注文を送信
    if (this.exchangeService) {
      this.exchangeService
        .executeOrder(newOrder, options)
        .then((exchangeOrderId) => {
          if (exchangeOrderId) {
            // 取引所送信成功時、ステータスをPLACEDに更新
            newOrder.status = OrderStatus.PLACED;
            // 取引所から返されたIDを保存
            newOrder.exchangeOrderId = exchangeOrderId;
            this.orders.set(orderId, newOrder);
            logger.info(
              `[OMS] 取引所への注文送信成功: ${exchangeOrderId}, ステータスをPLACEDに更新`
            );
          } else {
            logger.error(`[OMS] 取引所への注文送信失敗: ${orderId}`);
            newOrder.status = OrderStatus.REJECTED;
            this.orders.set(orderId, newOrder);
          }
        })
        .catch((error) => {
          logger.error(`[OMS] 取引所への注文送信エラー: ${error.message}`);
          newOrder.status = OrderStatus.REJECTED;
          this.orders.set(orderId, newOrder);
        });
    }

    return orderId;
  }

  /**
   * OCO注文（One-Cancels-the-Other）を作成する
   * @param {object} params OCO注文のパラメータ
   * @returns {string} OCO注文のID（複数の場合はカンマ区切り）
   */
  async createOcoOrder(params) {
    // 2つの注文IDを記録するための配列
    const orderIds = [];

    // 取引所サービスが設定されている場合、実際に注文を送信
    if (this.exchangeService) {
      const exchangeOrderId = await this.exchangeService.createOcoOrder(params);

      if (exchangeOrderId) {
        logger.info(`[OMS] 取引所へのOCO注文送信成功: ${exchangeOrderId}`);

        // リスト形式の場合（カンマ区切りでIDが返される場合）
        if (exchangeOrderId.includes(',')) {
          const ids = exchangeOrderId.split(',');
          ids.forEach((id, index) => {
            const ocoType = index === 0 ? '利確' : '損切';
            const ocoOrder = {
              id,
              exchangeOrderId: id, // 取引所の注文IDを保存
              symbol: params.symbol,
              side: params.side,
              amount: params.amount,
              type: index === 0 ? OrderType.LIMIT : OrderType.STOP,
              price: index === 0 ? params.limitPrice : params.stopLimitPrice || params.stopPrice,
              stopPrice: index === 1 ? params.stopPrice : undefined,
              status: OrderStatus.PLACED, // 取引所送信成功時はPLACEDステータス
              timestamp: Date.now()
            };
            this.orders.set(id, ocoOrder);
            orderIds.push(id);
            logger.info(`[OMS] OCO注文追跡 (${ocoType}): ${id}, ステータス: PLACED`);
          });
        } else {
          // 単一IDの場合（取引所側でOCOをサポートしている場合）
          const ocoOrder = {
            id: exchangeOrderId,
            exchangeOrderId: exchangeOrderId, // 取引所の注文IDを保存
            symbol: params.symbol,
            side: params.side,
            amount: params.amount,
            type: OrderType.LIMIT, // OCO注文は基本的に指値として扱う
            price: params.limitPrice,
            stopPrice: params.stopPrice,
            status: OrderStatus.PLACED, // 取引所送信成功時はPLACEDステータス
            timestamp: Date.now()
          };
          this.orders.set(exchangeOrderId, ocoOrder);
          orderIds.push(exchangeOrderId);
        }

        return orderIds.join(',');
      } else {
        logger.error(`[OMS] 取引所へのOCO注文送信失敗`);
        return '';
      }
    }

    // 取引所サービスが設定されていない場合は空文字を返す
    logger.warn(`[OMS] 取引所サービスが設定されていないため、OCO注文を送信できません`);
    return '';
  }

  /**
   * 注文をキャンセルする
   * @param {string} orderId 注文ID
   * @returns {boolean} キャンセルが成功したかどうか
   */
  cancelOrder(orderId) {
    const order = this.orders.get(orderId);

    if (!order) {
      logger.warn(`[OMS] キャンセル失敗: 注文 ${orderId} が見つかりません`);
      return false;
    }

    if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.PLACED) {
      logger.warn(`[OMS] キャンセル失敗: 注文 ${orderId} は既に ${order.status} 状態です`);
      return false;
    }

    // 注文のステータスを更新
    order.status = OrderStatus.CANCELED;
    this.orders.set(orderId, order);

    logger.info(`[OMS] 注文 ${orderId} をキャンセルしました`);

    return true;
  }

  /**
   * 注文が約定したことを処理する
   * @param {string} orderId 注文ID
   * @param {number} executionPrice 約定価格
   * @returns {boolean} 処理が成功したかどうか
   */
  fillOrder(orderId, executionPrice) {
    const order = this.orders.get(orderId);

    if (!order) {
      logger.warn(`[OMS] 約定処理失敗: 注文 ${orderId} が見つかりません`);
      return false;
    }

    // OPEN状態またはPLACED状態の注文のみ約定処理を行う
    if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.PLACED) {
      logger.warn(`[OMS] 約定処理失敗: 注文 ${orderId} は既に ${order.status} 状態です`);
      return false;
    }

    // 注文のステータスを更新
    order.status = OrderStatus.FILLED;
    this.orders.set(orderId, order);

    // ポジションを更新
    this.updatePosition(order, executionPrice);

    logger.info(
      `[OMS] 注文 ${orderId} が約定しました: ${order.side} ${order.amount} ${order.symbol} @ ${executionPrice}`
    );

    return true;
  }

  /**
   * 取引所の注文IDから内部注文を検索する
   * @param {string} exchangeOrderId 取引所の注文ID
   * @returns {object} 注文オブジェクト、見つからない場合はundefined
   */
  findOrderByExchangeId(exchangeOrderId) {
    for (const order of this.orders.values()) {
      if (order.exchangeOrderId === exchangeOrderId) {
        return order;
      }
    }
    return undefined;
  }

  /**
   * Webhookからの約定通知を処理する
   * @param {string} exchangeOrderId 取引所の注文ID
   * @param {number} executionPrice 約定価格
   * @param {number} executionAmount 約定数量（省略可）
   * @returns {boolean} 処理が成功したかどうか
   */
  handleWebhookFill(
    exchangeOrderId,
    executionPrice,
    executionAmount
  ) {
    if (!exchangeOrderId) {
      logger.error(`[OMS] Webhook約定処理失敗: 取引所注文IDが指定されていません`);
      return false;
    }

    try {
      const order = this.findOrderByExchangeId(exchangeOrderId);

      if (!order) {
        logger.warn(
          `[OMS] Webhook約定処理失敗: 取引所注文ID ${exchangeOrderId} に対応する注文が見つかりません`
        );
        return false;
      }

      // 約定情報オブジェクトを作成
      const fill = {
        orderId: order.id,
        exchangeOrderId,
        symbol: order.symbol,
        side: order.side,
        amount: executionAmount || order.amount,
        price: executionPrice,
        timestamp: Date.now()
      };

      // 約定処理を実行
      this.processFill(fill);

      // 約定履歴を保存
      this.saveFillHistory(fill);

      logger.info(`[OMS] Webhook通知による約定処理完了: ${order.id}, 価格: ${executionPrice}`);
      return true;
    } catch (error) {
      logger.error(
        `[OMS] Webhook約定処理エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * 注文履歴を保存する
   * @param {object} fill 約定情報
   * @private
   */
  saveFillHistory(fill) {
    try {
      // 履歴保存のロジックを実装（例：ファイルやデータベースに保存）
      // ここではログに出力するのみ
      logger.info(
        `[OMS] 約定履歴保存: ${fill.symbol} ${fill.side} ${fill.amount}@${fill.price} (${fill.exchangeOrderId})`
      );

      // TODO: 実際の永続化処理を実装
      // ファイルシステムやデータベースに保存するコードをここに追加
    } catch (error) {
      logger.error(
        `[OMS] 約定履歴保存エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 未決済注文の監視間隔を設定する
   * @param {number} intervalMinutes 監視間隔（分）
   */
  setOrderMonitoringInterval(intervalMinutes) {
    if (this.fillMonitorTask) {
      // 多重起動対策: 既存のタスクを確実に停止
      if (typeof this.fillMonitorTask.destroy === 'function') {
        this.fillMonitorTask.destroy();
      } else {
        this.fillMonitorTask.stop();
      }
      this.fillMonitorTask = null;
    }

    if (intervalMinutes <= 0) {
      logger.info(`[OMS] 未決済注文の監視を停止しました`);
      return;
    }

    // cronジョブのスケジュール設定
    const cronSchedule = intervalMinutes === 1 ? '* * * * *' : `*/${intervalMinutes} * * * *`;

    this.fillMonitorTask = cron.schedule(
      cronSchedule,
      async () => {
        try {
          await this.checkPendingOrders();
        } catch (error) {
          logger.error(
            `[OMS] 未決済注文監視エラー: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      },
      {
        timezone: 'UTC' // UTCタイムゾーンを使用
      }
    );

    logger.info(`[OMS] 未決済注文の監視を開始しました（${intervalMinutes}分間隔、UTC）`);
  }

  /**
   * ポジションを更新する
   * @param {object} order 約定した注文
   * @param {number} executionPrice 約定価格
   */
  updatePosition(order, executionPrice) {
    const positionKey = `${order.symbol}:${order.side}`;
    const oppositeKey = `${order.symbol}:${order.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY}`;

    // 反対側のポジションを確認
    const oppositePosition = this.positions.get(oppositeKey);

    if (oppositePosition && oppositePosition.amount >= order.amount) {
      // 反対側のポジションを減らす（相殺）
      oppositePosition.amount -= order.amount;

      if (oppositePosition.amount === 0) {
        // ポジションが0になった場合は削除
        this.positions.delete(oppositeKey);
        logger.info(`[OMS] ポジションをクローズしました: ${oppositeKey}`);
      } else {
        // ポジションを更新
        this.positions.set(oppositeKey, oppositePosition);
        logger.info(
          `[OMS] ポジションを減少させました: ${oppositeKey}, 残り: ${oppositePosition.amount}`
        );
      }
    } else {
      // 同じ方向のポジションを追加または更新
      const currentPosition = this.positions.get(positionKey) || {
        symbol: order.symbol,
        side: order.side,
        amount: 0,
        entryPrice: 0,
        currentPrice: executionPrice,
        unrealizedPnl: 0,
        timestamp: Date.now()
      };

      // 平均エントリー価格を計算
      const totalValue =
        currentPosition.entryPrice * currentPosition.amount + executionPrice * order.amount;
      const totalAmount = currentPosition.amount + order.amount;
      const newEntryPrice = totalValue / totalAmount;

      // ポジションを更新
      currentPosition.amount = totalAmount;
      currentPosition.entryPrice = newEntryPrice;
      currentPosition.currentPrice = executionPrice;
      currentPosition.timestamp = Date.now();

      // 未実現損益を計算
      this.calculateUnrealizedPnl(currentPosition);

      // ポジションを保存
      this.positions.set(positionKey, currentPosition);

      logger.info(
        `[OMS] ポジションを更新しました: ${positionKey}, 数量: ${currentPosition.amount}, エントリー価格: ${currentPosition.entryPrice}`
      );
    }
  }

  /**
   * 未実現損益を計算する
   * @param {object} position ポジション情報
   */
  calculateUnrealizedPnl(position) {
    if (position.side === OrderSide.BUY) {
      // ロングポジションの場合
      position.unrealizedPnl = (position.currentPrice - position.entryPrice) * position.amount;
    } else {
      // ショートポジションの場合
      position.unrealizedPnl = (position.entryPrice - position.currentPrice) * position.amount;
    }
  }

  /**
   * 現在のポジションを取得する
   * @returns {array} ポジションの配列
   */
  getPositions() {
    return Array.from(this.positions.values());
  }

  /**
   * 特定のシンボルのポジションを取得する
   * @param {string} symbol シンボル
   * @returns {array} ポジションの配列
   */
  getPositionsBySymbol(symbol) {
    return Array.from(this.positions.values()).filter((position) => position.symbol === symbol);
  }

  /**
   * 注文リストを取得する
   * @returns {array} 注文の配列
   */
  getOrders() {
    return Array.from(this.orders.values());
  }

  /**
   * 特定のステータスの注文を取得する
   * @param {string} status 注文ステータス
   * @returns {array} 注文の配列
   */
  getOrdersByStatus(status) {
    return Array.from(this.orders.values()).filter((order) => order.status === status);
  }

  /**
   * 市場価格の更新に基づいてポジションを更新する
   * @param {string} symbol シンボル
   * @param {number} currentPrice 現在の価格
   */
  updatePrices(symbol, currentPrice) {
    // シンボルに関連するすべてのポジションを取得
    const symbolPositions = Array.from(this.positions.values()).filter(
      (position) => position.symbol === symbol
    );

    // 各ポジションの現在価格と未実現損益を更新
    for (const position of symbolPositions) {
      position.currentPrice = currentPrice;
      this.calculateUnrealizedPnl(position);

      // ポジションを更新
      const positionKey = `${position.symbol}:${position.side}`;
      this.positions.set(positionKey, position);
    }
  }

  /**
   * 特定のシンボルの未実現損益合計を取得する
   * @param {string} symbol シンボル
   * @returns {number} 未実現損益
   */
  getTotalUnrealizedPnl(symbol) {
    const positions = symbol
      ? Array.from(this.positions.values()).filter((position) => position.symbol === symbol)
      : Array.from(this.positions.values());

    return positions.reduce((total, position) => total + position.unrealizedPnl, 0);
  }

  /**
   * 全注文のステータスを強制的に確認する
   * 取引所との同期が必要な場合などに使用
   */
  async forceCheckAllOrders() {
    logger.info(`[OMS] 全注文のステータスを強制確認します`);
    await this.checkPendingOrders(true);
  }

  /**
   * ポジションのストップ価格を更新する
   * @param {string} symbol シンボル
   * @param {string} positionSide ポジションの方向
   * @param {number} stopPrice ストップ価格
   */
  updatePositionStopPrice(
    symbol,
    positionSide,
    stopPrice
  ) {
    const positionKey = `${symbol}:${positionSide}`;
    const position = this.positions.get(positionKey);

    if (position) {
      position.stopPrice = stopPrice;
      this.positions.set(positionKey, position);
      logger.info(
        `[OMS] ポジションのストップ価格を更新しました: ${positionKey}, ストップ価格: ${stopPrice}`
      );
    }
  }

  /**
   * 取引所から注文情報を同期する
   * オープン/プレイス状態の注文の最新状態を取得して更新
   * @param {string} symbol 特定のシンボルのみ同期する場合は指定（省略可）
   * @returns {number} 同期された注文の数
   */
  async syncOrders(symbol) {
    if (!this.exchangeService) {
      logger.warn('[OMS] 取引所サービスが設定されていないため、注文を同期できません');
      return 0;
    }

    // 同期対象の注文を取得
    const ordersToSync = Array.from(this.orders.values()).filter(
      (order) =>
        (order.status === OrderStatus.OPEN || order.status === OrderStatus.PLACED) &&
        (!symbol || order.symbol === symbol) &&
        !!order.exchangeOrderId // 取引所IDがある注文のみ
    );

    if (ordersToSync.length === 0) {
      logger.debug('[OMS] 同期する注文がありません');
      return 0;
    }

    logger.info(`[OMS] ${ordersToSync.length}件の注文を同期中...`);
    let syncCount = 0;

    for (const order of ordersToSync) {
      try {
        if (!order.exchangeOrderId || !order.symbol) {
          continue;
        }

        // 取引所から注文情報を取得
        const orderInfo = await this.exchangeService.fetchOrder(
          order.exchangeOrderId,
          order.symbol
        );
        if (!orderInfo) {
          continue;
        }

        if (orderInfo.status === 'filled') {
          // 約定した注文の処理
          order.status = OrderStatus.FILLED;
          if (order.id) {
            this.orders.set(order.id, order);
          }

          // 約定価格が取得できる場合はポジションを更新
          if (orderInfo.price !== undefined && orderInfo.price > 0) {
            this.updatePosition(order, orderInfo.price);
          }

          logger.info(`[OMS] 注文が約定しました: ${order.id}, ${order.symbol}`);
          syncCount++;
        } else if (orderInfo.status === 'canceled' || orderInfo.status === 'expired') {
          // キャンセル/期限切れの注文
          order.status = OrderStatus.CANCELED;
          if (order.id) {
            this.orders.set(order.id, order);
          }
          logger.info(`[OMS] 注文がキャンセルされました: ${order.id}, ${order.symbol}`);
          syncCount++;
        } else if (orderInfo.status === 'rejected') {
          // 拒否された注文
          order.status = OrderStatus.REJECTED;
          if (order.id) {
            this.orders.set(order.id, order);
          }
          logger.info(`[OMS] 注文が拒否されました: ${order.id}, ${order.symbol}`);
          syncCount++;
        }
      } catch (error) {
        logger.error(
          `[OMS] 注文同期エラー: ${order.id}, ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    logger.info(`[OMS] 注文同期完了: ${syncCount}件の注文を更新`);
    return syncCount;
  }
}

// CommonJS export
module.exports = {
  OrderManagementSystem
};
