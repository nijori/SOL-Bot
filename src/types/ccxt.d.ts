declare module 'ccxt' {
  /**
   * ccxtモジュールの型定義
   */

  export interface ExchangeOptions {
    apiKey?: string;
    secret?: string;
    password?: string;
    enableRateLimit?: boolean;
    timeout?: number;
    userAgent?: string;
    verbose?: boolean;
    proxy?: string;
    [key: string]: any;
  }

  export interface OrderBook {
    bids: [number, number][];
    asks: [number, number][];
    timestamp?: number;
    datetime?: string;
    nonce?: number;
  }

  export interface Ticker {
    symbol: string;
    timestamp?: number;
    datetime?: string;
    high?: number;
    low?: number;
    bid?: number;
    ask?: number;
    last?: number;
    close?: number;
    baseVolume?: number;
    quoteVolume?: number;
    [key: string]: any;
  }

  export interface Trade {
    id?: string;
    timestamp?: number;
    datetime?: string;
    symbol: string;
    order?: string;
    type?: string;
    side: string;
    price: number;
    amount: number;
    cost?: number;
    fee?: {
      cost: number;
      currency: string;
    };
    [key: string]: any;
  }

  export interface Order {
    id: string;
    timestamp?: number;
    datetime?: string;
    symbol: string;
    type?: string;
    side: string;
    price?: number;
    amount: number;
    filled?: number;
    remaining?: number;
    cost?: number;
    status?: string;
    fee?: {
      cost: number;
      currency: string;
    };
    trades?: Trade[];
    [key: string]: any;
  }

  export interface Balance {
    free: { [currency: string]: number };
    used: { [currency: string]: number };
    total: { [currency: string]: number };
    [key: string]: any;
  }

  export interface Exchange {
    id: string;
    version: string;
    name: string;
    countries: string[];
    urls: {
      api: string | { [key: string]: string };
      www: string | string[];
      doc: string | string[];
    };
    timeframes?: { [key: string]: string };
    timeout: number;
    rateLimit: number;
    enableRateLimit: boolean;
    userAgent: string | boolean;
    verbose: boolean;
    markets: { [symbol: string]: any };
    symbols: string[];
    currencies: { [currency: string]: any };
    apiKey: string;
    secret: string;
    password: string;
    fetchOrderBook(symbol: string, limit?: number, params?: {}): Promise<OrderBook>;
    fetchTicker(symbol: string, params?: {}): Promise<Ticker>;
    fetchOHLCV(symbol: string, timeframe?: string, since?: number, limit?: number, params?: {}): Promise<number[][]>;
    fetchTrades(symbol: string, since?: number, limit?: number, params?: {}): Promise<Trade[]>;
    createOrder(symbol: string, type: string, side: string, amount: number, price?: number, params?: {}): Promise<Order>;
    cancelOrder(id: string, symbol?: string, params?: {}): Promise<Order>;
    fetchOrder(id: string, symbol?: string, params?: {}): Promise<Order>;
    fetchOrders(symbol?: string, since?: number, limit?: number, params?: {}): Promise<Order[]>;
    fetchOpenOrders(symbol?: string, since?: number, limit?: number, params?: {}): Promise<Order[]>;
    fetchClosedOrders(symbol?: string, since?: number, limit?: number, params?: {}): Promise<Order[]>;
    fetchBalance(params?: {}): Promise<Balance>;
    withdraw(currency: string, amount: number, address: string, tag?: string, params?: {}): Promise<{}>;
    fetchDepositAddress(currency: string, params?: {}): Promise<{}>;
    [key: string]: any;
  }

  export const exchanges: string[];

  export class binance extends Exchange {}
  export class bybit extends Exchange {}
  export class kucoin extends Exchange {}
  // その他の取引所クラスも同様に定義
} 