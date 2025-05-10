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
    [key: string]: unknown;
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
    [key: string]: unknown;
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
    [key: string]: unknown;
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
    status?: 'open' | 'closed' | 'canceled' | 'expired' | 'rejected' | 'filled' | string;
    fee?: {
      cost: number;
      currency: string;
    };
    trades?: Trade[];
    [key: string]: unknown;
  }

  export interface Balance {
    free: { [currency: string]: number };
    used: { [currency: string]: number };
    total: { [currency: string]: number };
    [key: string]: unknown;
  }

  export interface ExchangeFeatures {
    [feature: string]: boolean;
  }

  export interface MarketInfo {
    id: string;
    symbol: string;
    base: string;
    quote: string;
    baseId: string;
    quoteId: string;
    active: boolean;
    precision: {
      price: number;
      amount: number;
      cost?: number;
    };
    limits: {
      price?: { min?: number; max?: number };
      amount?: { min?: number; max?: number };
      cost?: { min?: number; max?: number };
    };
    [key: string]: unknown;
  }

  export interface CurrencyInfo {
    id: string;
    code: string;
    name?: string;
    precision: number;
    fee?: number;
    active: boolean;
    limits?: {
      withdraw?: { min?: number; max?: number };
      deposit?: { min?: number; max?: number };
    };
    [key: string]: unknown;
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
    has: ExchangeFeatures;
    markets: { [symbol: string]: MarketInfo };
    symbols: string[];
    currencies: { [currency: string]: CurrencyInfo };
    apiKey: string;
    secret: string;
    password: string;

    loadMarkets(): Promise<{ [symbol: string]: MarketInfo }>;
    fetchOrderBook(
      symbol: string,
      limit?: number,
      params?: Record<string, unknown>
    ): Promise<OrderBook>;
    fetchTicker(symbol: string, params?: Record<string, unknown>): Promise<Ticker>;
    fetchOHLCV(
      symbol: string,
      timeframe?: string,
      since?: number,
      limit?: number,
      params?: Record<string, unknown>
    ): Promise<number[][]>;
    fetchTrades(
      symbol: string,
      since?: number,
      limit?: number,
      params?: Record<string, unknown>
    ): Promise<Trade[]>;
    createOrder(
      symbol: string,
      type: string,
      side: string,
      amount: number,
      price?: number,
      params?: Record<string, unknown>
    ): Promise<Order>;
    createOCOOrder?(
      symbol: string,
      side: string,
      amount: number,
      price: number,
      stopPrice: number,
      stopLimitPrice?: number,
      params?: Record<string, unknown>
    ): Promise<Order>;
    cancelOrder(id: string, symbol?: string, params?: Record<string, unknown>): Promise<Order>;
    fetchOrder(id: string, symbol?: string, params?: Record<string, unknown>): Promise<Order>;
    fetchOrders(
      symbol?: string,
      since?: number,
      limit?: number,
      params?: Record<string, unknown>
    ): Promise<Order[]>;
    fetchOpenOrders(
      symbol?: string,
      since?: number,
      limit?: number,
      params?: Record<string, unknown>
    ): Promise<Order[]>;
    fetchClosedOrders(
      symbol?: string,
      since?: number,
      limit?: number,
      params?: Record<string, unknown>
    ): Promise<Order[]>;
    fetchBalance(params?: Record<string, unknown>): Promise<Balance>;
    withdraw(
      currency: string,
      amount: number,
      address: string,
      tag?: string,
      params?: Record<string, unknown>
    ): Promise<{
      id: string;
      info: unknown;
      txid?: string;
      [key: string]: unknown;
    }>;
    fetchDepositAddress(
      currency: string,
      params?: Record<string, unknown>
    ): Promise<{
      currency: string;
      address: string;
      tag?: string;
      info: unknown;
      [key: string]: unknown;
    }>;

    [key: string]: unknown;
  }

  export const exchanges: string[];

  export class binance extends Exchange {}
  export class bybit extends Exchange {}
  export class kucoin extends Exchange {}
  // その他の取引所クラスも同様に定義
}
