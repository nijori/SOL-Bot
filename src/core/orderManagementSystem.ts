import { 
  Order, 
  OrderSide, 
  OrderStatus, 
  OrderType, 
  Position 
} from './types';
import logger from '../utils/logger';
import { OrderOptions, OcoOrderParams } from '../services/exchangeService';

/**
 * 注文管理システム（OMS）
 * 注文の作成、管理、追跡を行うクラス
 */
export class OrderManagementSystem {
  private orders: Map<string, Order> = new Map();
  private positions: Map<string, Position> = new Map();
  private nextOrderId: number = 1;
  private exchangeService: any; // 実際の実装では型を明確に
  
  constructor() {
    logger.info('[OMS] 注文管理システムを初期化しました');
  }
  
  /**
   * ExchangeServiceを設定
   * @param service 取引所サービス
   */
  public setExchangeService(service: any): void {
    this.exchangeService = service;
  }
  
  /**
   * 注文を作成して追跡する
   * @param order 注文情報
   * @param options 注文オプション
   * @returns 生成された注文ID
   */
  public createOrder(order: Order, options?: OrderOptions): string {
    // 注文IDを生成（実際の取引所APIを使用する場合は、APIからのレスポンスでIDを取得）
    const orderId = `order-${Date.now()}-${this.nextOrderId++}`;
    
    // 注文に必要な情報を追加
    const newOrder: Order = {
      ...order,
      id: orderId,
      status: OrderStatus.OPEN, // 初期状態はOPEN
      timestamp: Date.now()
    };
    
    // 注文を追跡リストに追加
    this.orders.set(orderId, newOrder);
    
    // オプション情報をログに出力
    const optionsLog = options ? 
      `, オプション: ${options.postOnly ? 'Post-Only' : ''}${options.hidden ? ' Hidden' : ''}${options.iceberg ? ` Iceberg(${options.iceberg})` : ''}` : 
      '';
    
    logger.info(`[OMS] 注文を作成しました: ${orderId}, ${newOrder.side} ${newOrder.amount} ${newOrder.symbol} @ ${newOrder.price || 'MARKET'}${optionsLog}`);
    
    // 取引所サービスが設定されている場合、実際に注文を送信
    if (this.exchangeService) {
      this.exchangeService.executeOrder(newOrder, options)
        .then((exchangeOrderId: string) => {
          if (exchangeOrderId) {
            logger.info(`[OMS] 取引所への注文送信成功: ${exchangeOrderId}`);
          } else {
            logger.error(`[OMS] 取引所への注文送信失敗: ${orderId}`);
            newOrder.status = OrderStatus.REJECTED;
            this.orders.set(orderId, newOrder);
          }
        })
        .catch((error: Error) => {
          logger.error(`[OMS] 取引所への注文送信エラー: ${error.message}`);
          newOrder.status = OrderStatus.REJECTED;
          this.orders.set(orderId, newOrder);
        });
    }
    
    return orderId;
  }
  
  /**
   * OCO注文（One-Cancels-the-Other）を作成する
   * 利確と損切りを同時に注文し、どちらかが約定すると他方はキャンセルされる
   * @param params OCO注文のパラメータ
   * @returns 注文ID
   */
  public createOcoOrder(params: OcoOrderParams): string {
    // 2つの注文IDを記録するための配列
    const orderIds: string[] = [];
    
    // OCO注文の基本情報をログに出力
    logger.info(`[OMS] OCO注文を作成: ${params.side} ${params.amount} ${params.symbol}, 利確=${params.limitPrice}, 損切=${params.stopPrice}`);
    
    // 取引所サービスが設定されている場合、実際にOCO注文を送信
    if (this.exchangeService) {
      return this.exchangeService.createOcoOrder(params)
        .then((exchangeOrderId: string) => {
          if (exchangeOrderId) {
            logger.info(`[OMS] 取引所へのOCO注文送信成功: ${exchangeOrderId}`);
            
            // リスト形式の場合（カンマ区切りでIDが返される場合）
            if (exchangeOrderId.includes(',')) {
              const ids = exchangeOrderId.split(',');
              ids.forEach((id, index) => {
                const ocoType = index === 0 ? '利確' : '損切';
                const ocoOrder: Order = {
                  id,
                  symbol: params.symbol,
                  side: params.side,
                  amount: params.amount,
                  type: index === 0 ? OrderType.LIMIT : OrderType.STOP,
                  price: index === 0 ? params.limitPrice : params.stopLimitPrice || params.stopPrice,
                  stopPrice: index === 1 ? params.stopPrice : undefined,
                  status: OrderStatus.OPEN,
                  timestamp: Date.now()
                };
                this.orders.set(id, ocoOrder);
                orderIds.push(id);
                logger.info(`[OMS] OCO注文追跡 (${ocoType}): ${id}`);
              });
            } else {
              // 単一IDの場合（取引所側でOCOをサポートしている場合）
              const ocoOrder: Order = {
                id: exchangeOrderId,
                symbol: params.symbol,
                side: params.side,
                amount: params.amount,
                type: OrderType.LIMIT, // OCO注文は基本的に指値として扱う
                price: params.limitPrice,
                stopPrice: params.stopPrice,
                status: OrderStatus.OPEN,
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
        })
        .catch((error: Error) => {
          logger.error(`[OMS] 取引所へのOCO注文送信エラー: ${error.message}`);
          return '';
        });
    }
    
    // 取引所サービスが設定されていない場合は空文字を返す
    logger.warn(`[OMS] 取引所サービスが設定されていないため、OCO注文を送信できません`);
    return '';
  }
  
  /**
   * 注文をキャンセルする
   * @param orderId 注文ID
   * @returns キャンセルが成功したかどうか
   */
  public cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    
    if (!order) {
      logger.warn(`[OMS] キャンセル失敗: 注文 ${orderId} が見つかりません`);
      return false;
    }
    
    if (order.status !== OrderStatus.OPEN) {
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
   * @param orderId 注文ID
   * @param executionPrice 約定価格
   * @returns 処理が成功したかどうか
   */
  public fillOrder(orderId: string, executionPrice: number): boolean {
    const order = this.orders.get(orderId);
    
    if (!order) {
      logger.warn(`[OMS] 約定処理失敗: 注文 ${orderId} が見つかりません`);
      return false;
    }
    
    if (order.status !== OrderStatus.OPEN) {
      logger.warn(`[OMS] 約定処理失敗: 注文 ${orderId} は既に ${order.status} 状態です`);
      return false;
    }
    
    // 注文のステータスを更新
    order.status = OrderStatus.FILLED;
    this.orders.set(orderId, order);
    
    // ポジションを更新
    this.updatePosition(order, executionPrice);
    
    logger.info(`[OMS] 注文 ${orderId} が約定しました: ${order.side} ${order.amount} ${order.symbol} @ ${executionPrice}`);
    
    return true;
  }
  
  /**
   * ポジションを更新する
   * @param order 約定した注文
   * @param executionPrice 約定価格
   */
  private updatePosition(order: Order, executionPrice: number): void {
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
        logger.info(`[OMS] ポジションを減少させました: ${oppositeKey}, 残り: ${oppositePosition.amount}`);
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
      const totalValue = (currentPosition.entryPrice * currentPosition.amount) + (executionPrice * order.amount);
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
      
      logger.info(`[OMS] ポジションを更新しました: ${positionKey}, 数量: ${currentPosition.amount}, エントリー価格: ${currentPosition.entryPrice}`);
    }
  }
  
  /**
   * 未実現損益を計算する
   * @param position ポジション情報
   */
  private calculateUnrealizedPnl(position: Position): void {
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
   * @returns ポジションの配列
   */
  public getPositions(): Position[] {
    return Array.from(this.positions.values());
  }
  
  /**
   * 特定のシンボルのポジションを取得する
   * @param symbol シンボル
   * @returns ポジションの配列
   */
  public getPositionsBySymbol(symbol: string): Position[] {
    return Array.from(this.positions.values()).filter(position => position.symbol === symbol);
  }
  
  /**
   * 注文リストを取得する
   * @returns 注文の配列
   */
  public getOrders(): Order[] {
    return Array.from(this.orders.values());
  }
  
  /**
   * 特定のステータスの注文を取得する
   * @param status 注文ステータス
   * @returns 注文の配列
   */
  public getOrdersByStatus(status: OrderStatus): Order[] {
    return Array.from(this.orders.values()).filter(order => order.status === status);
  }
  
  /**
   * 市場価格の更新に基づいてポジションを更新する
   * @param symbol シンボル
   * @param currentPrice 現在の価格
   */
  public updatePrices(symbol: string, currentPrice: number): void {
    // シンボルに関連するすべてのポジションを取得
    const symbolPositions = Array.from(this.positions.values())
      .filter(position => position.symbol === symbol);
    
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
   * @param symbol シンボル
   * @returns 未実現損益
   */
  public getTotalUnrealizedPnl(symbol?: string): number {
    const positions = symbol
      ? Array.from(this.positions.values()).filter(position => position.symbol === symbol)
      : Array.from(this.positions.values());
    
    return positions.reduce((total, position) => total + position.unrealizedPnl, 0);
  }
} 