/**
 * SymbolInfoService
 *
 * 複数の通貨ペア情報を一括取得し、キャッシュするユーティリティ
 * 取引所APIへの過剰なリクエストを避けるための設計
 *
 * UTIL-002: 通貨ペア情報取得ユーティリティ
 */

// @ts-nocheck
const { ExchangeService } = require('./exchangeService');
const logger = require('../utils/logger');

/**
 * 通貨ペア情報のインターフェース
 */
// export interface SymbolInfo {
//   // 基本情報
//   symbol: string; // 通貨ペアシンボル (例: 'BTC/USDT')
//   base: string; // 基本通貨 (例: 'BTC')
//   quote: string; // 見積通貨 (例: 'USDT')
//   active: boolean; // アクティブかどうか
//
//   // 精度情報
//   pricePrecision: number; // 価格精度 (小数点以下の桁数)
//   amountPrecision: number; // 数量精度 (小数点以下の桁数)
//   costPrecision?: number; // コスト精度 (小数点以下の桁数)
//
//   // 上限/下限情報
//   minPrice?: number; // 最小価格
//   maxPrice?: number; // 最大価格
//   minAmount: number; // 最小注文量
//   maxAmount?: number; // 最大注文量
//   minCost?: number; // 最小注文金額
//
//   // ティック情報
//   tickSize?: number; // 最小価格変動幅
//   stepSize?: number; // 最小数量変動幅
//
//   // 手数料情報
//   makerFee?: number; // メイカー手数料
//   takerFee?: number; // テイカー手数料
//
//   // メタデータ
//   fetchTimestamp: number; // 取得タイムスタンプ
//   exchangeSpecific?: any; // 取引所固有の情報
// }

/**
 * キャッシュ有効期限設定
 */
// export interface CacheOptions {
//   /** キャッシュの有効期間（ミリ秒） */
//   ttl: number;
//   /** 強制的に再取得するかどうか */
//   forceRefresh?: boolean;
// }

/**
 * 通貨ペア情報取得サービス
 */
class SymbolInfoService {
  /**
   * コンストラクタ
   * @param exchangeService 取引所サービスのインスタンス
   * @param defaultCacheTTL デフォルトのキャッシュ有効期間（ミリ秒）
   */
  constructor(exchangeService, defaultCacheTTL = 3600000) {
    this.exchangeService = exchangeService;
    this.defaultCacheTTL = defaultCacheTTL;
    this.cache = new Map();
    this.fetchPromises = new Map();
  }

  /**
   * 単一の通貨ペア情報を取得する
   * @param symbol 通貨ペアシンボル
   * @param options キャッシュオプション
   * @returns 通貨ペア情報
   */
  async getSymbolInfo(symbol, options = { ttl: this.defaultCacheTTL }) {
    // キャッシュチェック（強制的な再取得が指定されていない場合）
    if (!options.forceRefresh) {
      const cachedInfo = this.cache.get(symbol);
      if (cachedInfo && Date.now() - cachedInfo.fetchTimestamp < options.ttl) {
        logger.debug(`キャッシュから通貨ペア情報を使用: ${symbol}`);
        return cachedInfo;
      }
    }

    // 同じシンボルの並行リクエストを防止
    if (this.fetchPromises.has(symbol)) {
      logger.debug(`既存のリクエストを待機中: ${symbol}`);
      try {
        return await this.fetchPromises.get(symbol);
      } catch (error) {
        // 前のリクエストが失敗した場合は新しく取得を試みる
        this.fetchPromises.delete(symbol);
      }
    }

    // 新しいリクエストを作成し、プロミスマップに保存
    const fetchPromise = this.fetchSymbolInfo(symbol);
    this.fetchPromises.set(symbol, fetchPromise);

    try {
      // 通貨ペア情報を取得
      const info = await fetchPromise;

      // キャッシュに保存
      this.cache.set(symbol, info);

      // 完了したプロミスをマップから削除
      this.fetchPromises.delete(symbol);

      return info;
    } catch (error) {
      // エラー発生時はプロミスマップから削除
      this.fetchPromises.delete(symbol);

      // エラーを再スロー
      throw error;
    }
  }

  /**
   * 複数の通貨ペア情報を一括取得する
   * @param symbols 通貨ペアシンボルの配列
   * @param options キャッシュオプション
   * @returns 通貨ペア情報のマップ
   */
  async getMultipleSymbolInfo(symbols, options = { ttl: this.defaultCacheTTL }) {
    const result = new Map();

    // 重複を除去した一意なシンボルのセット
    const uniqueSymbols = [...new Set(symbols)];

    // 並列処理でシンボル情報を取得
    const promises = uniqueSymbols.map(async (symbol) => {
      try {
        const info = await this.getSymbolInfo(symbol, options);
        result.set(symbol, info);
      } catch (error) {
        logger.error(`通貨ペア情報の取得に失敗: ${symbol}`, error);
        // エラーが発生しても処理を続行（部分的な成功を許容）
      }
    });

    // すべてのリクエストが完了するのを待つ
    await Promise.all(promises);

    return result;
  }

  /**
   * キャッシュをクリアする
   * @param symbol 特定の通貨ペアのみクリアする場合は指定（省略時は全キャッシュをクリア）
   */
  clearCache(symbol) {
    if (symbol) {
      this.cache.delete(symbol);
      logger.debug(`通貨ペア情報のキャッシュをクリア: ${symbol}`);
    } else {
      this.cache.clear();
      logger.debug(`通貨ペア情報のキャッシュをすべてクリア`);
    }
  }

  /**
   * キャッシュを更新する（期限切れのもののみ）
   * @param symbols 更新する通貨ペアのリスト（省略時はキャッシュ内のすべて）
   * @param ttl キャッシュの有効期間（省略時はデフォルト値）
   */
  async refreshCache(symbols, ttl = this.defaultCacheTTL) {
    const toRefresh = symbols || Array.from(this.cache.keys());

    // 期限切れのシンボルだけをフィルタリング
    const expiredSymbols = toRefresh.filter((symbol) => {
      const info = this.cache.get(symbol);
      return !info || Date.now() - info.fetchTimestamp > ttl;
    });

    if (expiredSymbols.length === 0) {
      logger.debug('更新が必要な通貨ペア情報はありません');
      return;
    }

    logger.info(`期限切れの通貨ペア情報を更新します (${expiredSymbols.length}件)`);

    // 期限切れのシンボル情報を一括取得
    await this.getMultipleSymbolInfo(expiredSymbols, { ttl, forceRefresh: true });
  }

  /**
   * 通貨ペア情報をAPIから取得する（内部メソッド）
   * @param symbol 通貨ペアシンボル
   * @returns 通貨ペア情報
   */
  async fetchSymbolInfo(symbol) {
    try {
      logger.debug(`取引所APIから通貨ペア情報を取得: ${symbol}`);

      // 取引所から市場情報を取得
      const marketInfo = await this.exchangeService.getMarketInfo(symbol);

      if (!marketInfo) {
        throw new Error(`通貨ペア情報を取得できませんでした: ${symbol}`);
      }

      // 通貨ペア情報を変換
      const symbolInfo = {
        symbol: marketInfo.symbol,
        base: marketInfo.base,
        quote: marketInfo.quote,
        active: marketInfo.active,

        pricePrecision: marketInfo.precision.price,
        amountPrecision: marketInfo.precision.amount,
        costPrecision: marketInfo.precision.cost,

        minPrice: marketInfo.limits.price?.min,
        maxPrice: marketInfo.limits.price?.max,
        minAmount: marketInfo.limits.amount?.min || 0,
        maxAmount: marketInfo.limits.amount?.max,
        minCost: marketInfo.limits.cost?.min,

        // ティック情報の取得（取引所によって場所が異なる場合がある）
        tickSize: this.extractTickSize(marketInfo),
        stepSize: this.extractStepSize(marketInfo),

        // 手数料情報（取得可能な場合）
        makerFee: this.extractFee(marketInfo, 'maker'),
        takerFee: this.extractFee(marketInfo, 'taker'),

        fetchTimestamp: Date.now(),
        exchangeSpecific: marketInfo.info || {}
      };

      return symbolInfo;
    } catch (error) {
      logger.error(`通貨ペア情報の取得に失敗: ${symbol}`, error);
      throw new Error(
        `通貨ペア情報の取得に失敗しました: ${symbol} - ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * ティックサイズの抽出（取引所によって場所が異なる）
   * @param marketInfo 市場情報
   * @returns ティックサイズまたはundefined
   */
  extractTickSize(marketInfo) {
    // CCXTのバージョンや取引所によって構造が異なる場合がある
    if (marketInfo.precision && typeof marketInfo.precision.price === 'number') {
      // 精度が小数点以下の桁数で指定されている場合
      return Math.pow(10, -marketInfo.precision.price);
    }

    // 精度がティックサイズ（最小変動幅）で直接指定されている場合
    if (marketInfo.precision && marketInfo.precision.price) {
      return marketInfo.precision.price;
    }

    // 一部の取引所では info フィールドに格納されている場合がある
    if (marketInfo.info && marketInfo.info.tickSize) {
      return parseFloat(marketInfo.info.tickSize);
    }

    return undefined;
  }

  /**
   * ステップサイズの抽出（数量の最小変動幅）
   * @param marketInfo 市場情報
   * @returns ステップサイズまたはundefined
   */
  extractStepSize(marketInfo) {
    // CCXTのバージョンや取引所によって構造が異なる場合がある
    if (marketInfo.precision && typeof marketInfo.precision.amount === 'number') {
      // 精度が小数点以下の桁数で指定されている場合
      return Math.pow(10, -marketInfo.precision.amount);
    }

    // 精度がステップサイズ（最小変動幅）で直接指定されている場合
    if (marketInfo.precision && marketInfo.precision.amount) {
      return marketInfo.precision.amount;
    }

    // 一部の取引所では info フィールドに格納されている場合がある
    if (marketInfo.info) {
      const stepSize = marketInfo.info.stepSize || marketInfo.info.lotSize;
      if (stepSize) {
        return parseFloat(stepSize);
      }
    }

    return undefined;
  }

  /**
   * 手数料情報の抽出
   * @param marketInfo 市場情報
   * @param feeType 手数料タイプ（'maker'または'taker'）
   * @returns 手数料率またはundefined
   */
  extractFee(marketInfo, feeType) {
    if (marketInfo.fees && marketInfo.fees[feeType] !== undefined) {
      return marketInfo.fees[feeType];
    }

    // デフォルトの取引所手数料
    if (marketInfo.fees && marketInfo.fees.trading && marketInfo.fees.trading[feeType] !== undefined) {
      return marketInfo.fees.trading[feeType];
    }

    return undefined;
  }

  /**
   * キャッシュされているすべての通貨ペア情報を取得
   * @returns キャッシュされている通貨ペア情報のマップ
   */
  getAllCachedSymbolInfo() {
    return new Map(this.cache);
  }

  /**
   * キャッシュの統計情報を取得
   * @returns キャッシュサイズと最古/最新のエントリのタイムスタンプ
   */
  getCacheStats() {
    if (this.cache.size === 0) {
      return {
        cacheSize: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }

    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;

    for (const info of this.cache.values()) {
      if (info.fetchTimestamp < oldestTimestamp) {
        oldestTimestamp = info.fetchTimestamp;
      }
      if (info.fetchTimestamp > newestTimestamp) {
        newestTimestamp = info.fetchTimestamp;
      }
    }

    return {
      cacheSize: this.cache.size,
      oldestEntry: new Date(oldestTimestamp),
      newestEntry: new Date(newestTimestamp)
    };
  }
}

// CommonJS形式でエクスポート
module.exports = {
  SymbolInfoService
};
