/**
 * リアルタイムデータ処理クラス
 *
 * WebSocketストリームからのリアルタイムデータを効率的に処理し、
 * バッファリングと通知機能を提供します。
 *
 * DAT-008: リアルタイムデータ処理の改善
 * PERF-006: RealTimeDataProcessor最適化（LRUキャッシュ実装とメモリ使用量監視）
 */

import EventEmitter from 'events';
import { Candle } from '../core/types.js';
import logger from '../utils/logger.js';
import { LRUCache } from 'lru-cache';

// デフォルト設定
const DEFAULT_BUFFER_SIZE = 1000; // バッファの最大サイズ
const DEFAULT_THROTTLE_MS = 200; // イベント通知のスロットリング間隔 (ms)
const DEFAULT_BATCH_SIZE = 10; // バッチ処理のサイズ
const DEFAULT_MAX_MEMORY_MB = 100; // デフォルトの最大メモリ使用量（MB）
const DEFAULT_BACK_PRESSURE_THRESHOLD = 0.8; // 80%のメモリ使用率でバックプレッシャー開始
const DEFAULT_MEMORY_CHECK_INTERVAL_MS = 5000; // メモリ使用量チェック間隔（ミリ秒）
const DEFAULT_LRU_CACHE_TTL = 3600000; // LRUキャッシュのTTL（ミリ秒）

/**
 * リアルタイムデータ型
 */
export interface RealTimeData {
  symbol: string;
  timestamp: number;
  data: any;
  type: RealTimeDataType;
}

/**
 * リアルタイムデータの種類
 */
export enum RealTimeDataType {
  TRADE = 'trade',
  TICKER = 'ticker',
  ORDERBOOK = 'orderbook',
  CANDLE = 'candle',
  LIQUIDATION = 'liquidation',
  OTHER = 'other'
}

/**
 * リアルタイムデータ処理オプション
 */
export interface RealTimeDataProcessorOptions {
  bufferSize?: number; // データバッファの最大サイズ
  throttleMs?: number; // イベント通知のスロットリング間隔
  batchSize?: number; // 一度に処理するバッチサイズ
  enableCompression?: boolean; // データ圧縮を有効にするかどうか
  enableFiltering?: boolean; // ノイズフィルタリングを有効にするかどうか
  symbols?: string[]; // 監視する通貨ペア
  dataTypes?: RealTimeDataType[]; // 監視するデータタイプ
  maxMemoryMB?: number; // 最大メモリ使用量（MB）
  backPressureThreshold?: number; // バックプレッシャーを適用する閾値（0.0～1.0）
  enableLRUCache?: boolean; // LRUキャッシュを有効にするかどうか
  lruCacheTTL?: number; // LRUキャッシュのTTL（ミリ秒）
  memoryCheckIntervalMs?: number; // メモリ使用量チェック間隔（ミリ秒）
  priorityDataTypes?: RealTimeDataType[]; // 優先度の高いデータタイプ（バックプレッシャー時でも処理）
  dynamicBufferSizeEnabled?: boolean; // 動的バッファサイズ調整を有効にするかどうか
  initialBufferFactor?: number; // 初期バッファサイズの倍率（maxBufferSizeに対する比率）
}

/**
 * リアルタイムデータから作成されたローソク足
 */
export interface RealTimeCandleData {
  symbol: string;
  timeframe: string;
  candle: Candle;
  isComplete: boolean;
}

/**
 * メモリ使用量情報
 */
export interface MemoryUsageInfo {
  totalHeapSize: number; // 合計ヒープサイズ（MB）
  usedHeapSize: number; // 使用中ヒープサイズ（MB）
  memoryUsageRatio: number; // メモリ使用率（0～1）
  isBackPressureActive: boolean; // バックプレッシャーが適用されているか
  dynamicBufferSizes: Record<string, number>; // 動的に計算されたバッファサイズ
  rss: number; // 常駐セットサイズ（MB）
  externalMemory: number; // 外部メモリ（MB）
  gcEnabled: boolean; // GCが有効かどうか
  lastGCDuration?: number; // 最後のGC実行時間（ミリ秒）
  peakMemoryUsage: number; // ピークメモリ使用量（MB）
  dataProcessingRate: number; // データ処理速度（件/秒）
  throttledEvents: number; // スロットリングされたイベント数
  skippedLowPriorityData: number; // スキップされた低優先度データ数
}

/**
 * リアルタイムデータ処理クラス
 */
export class RealTimeDataProcessor extends EventEmitter {
  private buffers: Map<string, RealTimeData[]> = new Map();
  private lruCaches: Map<string, LRUCache<number, RealTimeData>> = new Map();
  private maxBufferSize: number;
  private throttleInterval: number;
  private batchSize: number;
  private throttleTimers: Map<string, NodeJS.Timeout> = new Map();
  private enableCompression: boolean;
  private enableFiltering: boolean;
  private symbols: Set<string>;
  private dataTypes: Set<RealTimeDataType>;
  private candleBuilders: Map<string, Map<string, Partial<Candle>>> = new Map();
  private isStarted: boolean = false;
  private dataCount: number = 0;
  private lastProcessTime: number = 0;
  private maxMemoryMB: number;
  private backPressureThreshold: number;
  private enableLRUCache: boolean;
  private dynamicBufferSizes: Map<string, number> = new Map();
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private backPressureActive: boolean = false;
  private lastMemoryCheck: number = 0;
  private memoryCheckIntervalMs: number;
  private lruCacheTTL: number;
  private priorityDataTypes: Set<RealTimeDataType>;
  private dynamicBufferSizeEnabled: boolean;
  private initialBufferFactor: number;
  private peakMemoryUsage: number = 0;
  private throttledEventCount: number = 0;
  private skippedLowPriorityCount: number = 0;
  private lastGCDuration: number = 0;
  private processingStartTime: number = 0;

  /**
   * コンストラクタ
   * @param options 初期化オプション
   */
  constructor(options: RealTimeDataProcessorOptions = {}) {
    super();

    this.maxBufferSize = options.bufferSize || DEFAULT_BUFFER_SIZE;
    this.throttleInterval = options.throttleMs || DEFAULT_THROTTLE_MS;
    this.batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
    this.enableCompression = options.enableCompression || false;
    this.enableFiltering = options.enableFiltering || false;
    this.symbols = new Set(options.symbols || []);
    this.dataTypes = new Set(
      options.dataTypes || [
        RealTimeDataType.TRADE,
        RealTimeDataType.TICKER,
        RealTimeDataType.CANDLE
      ]
    );
    this.maxMemoryMB = options.maxMemoryMB || DEFAULT_MAX_MEMORY_MB;
    this.backPressureThreshold = options.backPressureThreshold || DEFAULT_BACK_PRESSURE_THRESHOLD;
    this.enableLRUCache = options.enableLRUCache !== undefined ? options.enableLRUCache : true;
    this.memoryCheckIntervalMs = options.memoryCheckIntervalMs || DEFAULT_MEMORY_CHECK_INTERVAL_MS;
    this.lruCacheTTL = options.lruCacheTTL || DEFAULT_LRU_CACHE_TTL;
    this.priorityDataTypes = new Set(
      options.priorityDataTypes || [RealTimeDataType.CANDLE, RealTimeDataType.TRADE]
    );
    this.dynamicBufferSizeEnabled =
      options.dynamicBufferSizeEnabled !== undefined ? options.dynamicBufferSizeEnabled : true;
    this.initialBufferFactor = options.initialBufferFactor || 1.0;

    // バッファとLRUキャッシュを初期化
    this.initializeBuffers();

    logger.info(
      `RealTimeDataProcessorを初期化しました（バッファサイズ: ${this.maxBufferSize}, 最大メモリ: ${this.maxMemoryMB}MB, LRUキャッシュ: ${this.enableLRUCache ? '有効' : '無効'}, 動的バッファサイズ: ${this.dynamicBufferSizeEnabled ? '有効' : '無効'}）`
    );
  }

  /**
   * バッファを初期化する
   */
  private initializeBuffers(): void {
    // すべてのシンボルとデータタイプの組み合わせに対応するバッファとLRUキャッシュを作成
    for (const symbol of this.symbols) {
      for (const dataType of this.dataTypes) {
        const key = this.getBufferKey(symbol, dataType);
        this.buffers.set(key, []);

        // 初期バッファサイズを計算（データタイプの優先度に基づいて調整）
        let initialSize = this.maxBufferSize * this.initialBufferFactor;

        // 優先度の高いデータタイプには大きめのバッファを割り当て
        if (this.priorityDataTypes.has(dataType)) {
          initialSize = Math.ceil(initialSize * 1.5); // 50%増加
        }

        this.dynamicBufferSizes.set(key, initialSize);

        if (this.enableLRUCache) {
          let ttlValue = this.lruCacheTTL;

          // 優先度の高いデータタイプにはTTLを長く設定
          if (this.priorityDataTypes.has(dataType)) {
            ttlValue = this.lruCacheTTL * 1.5; // 50%長いTTL
          }

          // LRUCache v11向けにコンストラクタの使用法を変更
          const cache = new LRUCache<number, RealTimeData>({
            max: initialSize,
            ttl: ttlValue,
            updateAgeOnGet: true,
            allowStale: false
          });

          this.lruCaches.set(key, cache);
        }
      }
    }

    logger.debug(
      `バッファを初期化しました: ${this.buffers.size}バッファ, ${this.lruCaches.size}キャッシュ`
    );
  }

  /**
   * バッファのキーを取得する
   * @param symbol 通貨ペア
   * @param dataType データタイプ
   * @returns バッファキー
   */
  private getBufferKey(symbol: string, dataType: RealTimeDataType): string {
    return `${symbol}_${dataType}`;
  }

  /**
   * データを処理する
   * @param data リアルタイムデータ
   */
  public processData(data: RealTimeData): void {
    try {
      if (!this.isStarted) {
        logger.warn('データ処理が開始されていません。start()を呼び出してください。');
        return;
      }

      // 処理の開始時刻を記録（最初のデータ処理時のみ）
      if (this.processingStartTime === 0) {
        this.processingStartTime = Date.now();
      }

      // データの妥当性チェック
      if (!data || !data.symbol || !data.type) {
        logger.warn('無効なデータ形式です');
        return;
      }

      // バックプレッシャーが適用されている場合、優先度の低いデータをスキップ
      if (this.backPressureActive && this.isLowPriorityData(data)) {
        this.skippedLowPriorityCount++;
        return;
      }

      // 指定されたシンボルとデータタイプのみを処理
      if (
        (this.symbols.size === 0 || this.symbols.has(data.symbol)) &&
        (this.dataTypes.size === 0 || this.dataTypes.has(data.type))
      ) {
        // ノイズフィルタリングが有効な場合は不要なデータをスキップ
        if (this.enableFiltering && this.shouldFilterData(data)) {
          return;
        }

        // データを圧縮する（有効な場合）
        const processedData = this.enableCompression ? this.compressData(data) : data;

        // バッファキーを取得
        const bufferKey = this.getBufferKey(data.symbol, data.type);

        // データをLRUキャッシュに追加（有効な場合）
        if (this.enableLRUCache) {
          const cache = this.lruCaches.get(bufferKey);
          if (cache) {
            cache.set(data.timestamp, processedData);
          }
        }

        // データをバッファに追加
        let buffer = this.buffers.get(bufferKey);
        if (!buffer) {
          buffer = [];
          this.buffers.set(bufferKey, buffer);
        }

        buffer.push(processedData);
        this.dataCount++;

        // 動的バッファサイズ調整が有効な場合、バッファサイズを制限
        if (this.dynamicBufferSizeEnabled) {
          const dynamicSize = this.dynamicBufferSizes.get(bufferKey) || this.maxBufferSize;
          while (buffer.length > dynamicSize) {
            buffer.shift(); // 古いデータを削除
          }
        } else if (buffer.length > this.maxBufferSize) {
          // 動的調整が無効の場合も、最大バッファサイズは適用
          buffer.shift();
        }

        // スロットリングされたイベント通知
        this.throttleEmit(bufferKey);

        // データタイプが CANDLE または TRADE の場合、ローソク足を更新
        if (data.type === RealTimeDataType.CANDLE || data.type === RealTimeDataType.TRADE) {
          this.updateCandleData(data);
        }

        // 定期的にメモリ使用量を確認
        const now = Date.now();
        if (now - this.lastMemoryCheck > this.memoryCheckIntervalMs) {
          this.checkMemoryUsage();
          this.lastMemoryCheck = now;
        }
      }
    } catch (error) {
      // エラーをログに記録するが、例外は投げない
      logger.error(`データ処理エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 低優先度データかどうかを判定する
   * @param data リアルタイムデータ
   * @returns 低優先度データの場合はtrue
   */
  private isLowPriorityData(data: RealTimeData): boolean {
    // 優先度の高いデータタイプはスキップしない
    if (this.priorityDataTypes.has(data.type)) {
      return false;
    }

    // データタイプに基づく優先度判定
    switch (data.type) {
      case RealTimeDataType.CANDLE:
      case RealTimeDataType.TRADE:
        // ローソク足と取引は重要データなので常に処理
        return false;

      case RealTimeDataType.TICKER:
        // ティッカーは中程度の優先度
        // バックプレッシャーが強い場合のみスキップ
        return this.getMemoryUsageRatio() > 0.9;

      case RealTimeDataType.ORDERBOOK:
        // 板情報は頻度が高いため、バックプレッシャー時はスキップ
        return true;

      case RealTimeDataType.LIQUIDATION:
        // 清算情報は重要だが頻度は低い
        return this.getMemoryUsageRatio() > 0.95;

      case RealTimeDataType.OTHER:
      default:
        // その他のデータタイプは低優先度とみなす
        return true;
    }
  }

  /**
   * メモリ使用量を確認し、バックプレッシャー状態を更新する
   */
  private checkMemoryUsage(): void {
    try {
      const memUsage = process.memoryUsage();
      const totalHeapSize = memUsage.heapTotal / (1024 * 1024); // MB単位
      const usedHeapSize = memUsage.heapUsed / (1024 * 1024); // MB単位
      const memoryUsageRatio = usedHeapSize / this.maxMemoryMB;

      // ピークメモリ使用量を更新
      if (usedHeapSize > this.peakMemoryUsage) {
        this.peakMemoryUsage = usedHeapSize;
      }

      // バックプレッシャー状態を更新
      const wasPreviouslyActive = this.backPressureActive;
      this.backPressureActive = memoryUsageRatio > this.backPressureThreshold;

      // バックプレッシャー状態が変化した場合に通知
      if (this.backPressureActive !== wasPreviouslyActive) {
        logger.info(
          `バックプレッシャー状態変更: ${wasPreviouslyActive ? '無効' : '有効'} -> ${this.backPressureActive ? '有効' : '無効'} (メモリ使用率: ${(memoryUsageRatio * 100).toFixed(1)}%)`
        );

        // バックプレッシャーイベントを発行
        this.emit('backpressure', {
          active: this.backPressureActive,
          memoryUsageRatio,
          usedHeapSize,
          totalHeapSize
        });
      }

      // 動的バッファサイズを調整（有効な場合）
      if (this.dynamicBufferSizeEnabled) {
        this.adjustDynamicBufferSizes(memoryUsageRatio);
      }

      // 詳細なメモリ使用状況をデバッグログに出力
      logger.debug(
        `メモリ使用状況: ${usedHeapSize.toFixed(1)}MB / ${totalHeapSize.toFixed(1)}MB (${(memoryUsageRatio * 100).toFixed(1)}%), バックプレッシャー: ${this.backPressureActive ? '有効' : '無効'}`
      );

      // 高メモリ使用率の場合、明示的にGCを呼び出す（非推奨だが緊急時の対策）
      if (memoryUsageRatio > 0.95 && global.gc) {
        const startTime = Date.now();
        global.gc();
        this.lastGCDuration = Date.now() - startTime;
        logger.warn(
          `高メモリ使用率のため明示的にGCを実行: ${(memoryUsageRatio * 100).toFixed(1)}%, GC実行時間: ${this.lastGCDuration}ms`
        );
      }

      // メモリ使用量が極めて高い場合は警告ログを出力
      if (memoryUsageRatio > 0.9) {
        logger.warn(
          `メモリ使用量が危険レベルに達しています: ${usedHeapSize.toFixed(1)}MB / ${this.maxMemoryMB}MB (${(memoryUsageRatio * 100).toFixed(1)}%)`
        );
      }
    } catch (error) {
      logger.error(
        `メモリ使用量確認エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 現在のメモリ使用率を取得する
   * @returns メモリ使用率（0～1の範囲）
   */
  private getMemoryUsageRatio(): number {
    try {
      const memUsage = process.memoryUsage();
      const usedHeapSize = memUsage.heapUsed / (1024 * 1024); // MB単位
      return usedHeapSize / this.maxMemoryMB;
    } catch (error) {
      logger.error(
        `メモリ使用率取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return 0;
    }
  }

  /**
   * メモリ使用率に基づいて動的バッファサイズを調整する
   * @param memoryUsageRatio メモリ使用率
   */
  private adjustDynamicBufferSizes(memoryUsageRatio: number): void {
    try {
      // バッファサイズを調整する係数の計算（メモリ使用率が高いほど小さくなる）
      let scaleFactor = 1.0;

      if (memoryUsageRatio > 0.95) {
        // 95%以上のメモリ使用率では非常に厳しく制限（15%のサイズに）
        scaleFactor = 0.15;
      } else if (memoryUsageRatio > 0.9) {
        // 90-95%のメモリ使用率では25%のサイズに
        scaleFactor = 0.25;
      } else if (memoryUsageRatio > 0.8) {
        // 80-90%のメモリ使用率では50%のサイズに
        scaleFactor = 0.5;
      } else if (memoryUsageRatio > 0.7) {
        // 70-80%のメモリ使用率では75%のサイズに
        scaleFactor = 0.75;
      } else if (memoryUsageRatio < 0.3) {
        // 30%未満のメモリ使用率では拡大（ただし最大値は超えない）
        scaleFactor = 1.2;
      }

      // 各バッファのサイズを調整
      for (const [key, buffer] of this.buffers) {
        // バッファの使用状況を考慮して調整係数を微調整
        let bufferScaleFactor = scaleFactor;

        // データタイプとシンボルを抽出
        const [symbol, typeStr] = key.split('_');
        const dataType = typeStr as RealTimeDataType;

        // 優先度の高いデータタイプは縮小率を抑える
        if (this.priorityDataTypes.has(dataType)) {
          bufferScaleFactor = Math.min(1.0, bufferScaleFactor * 1.5);
        }

        // 使用中のバッファが少ない場合はさらに縮小
        const currentBufferSize = buffer.length;
        const currentMaxSize = this.dynamicBufferSizes.get(key) || this.maxBufferSize;
        const bufferUsageRatio = currentBufferSize / currentMaxSize;

        if (bufferUsageRatio < 0.3) {
          // バッファがあまり使われていない場合、より縮小
          bufferScaleFactor *= 0.8;
        }

        // 新しいバッファサイズを計算（最小サイズは10を保証）
        const baseSize = this.priorityDataTypes.has(dataType)
          ? this.maxBufferSize * 1.5
          : this.maxBufferSize;
        const newSize = Math.max(10, Math.floor(baseSize * bufferScaleFactor));

        // サイズが変わった場合のみ更新
        const currentSize = this.dynamicBufferSizes.get(key) || this.maxBufferSize;
        if (Math.abs(newSize - currentSize) > currentSize * 0.1) {
          // 10%以上変化した場合のみ更新
          this.dynamicBufferSizes.set(key, newSize);

          // バッファが新しいサイズよりも大きい場合は切り詰める
          while (buffer.length > newSize) {
            buffer.shift(); // 古いデータを削除
          }

          // LRUキャッシュも同様に調整
          if (this.enableLRUCache) {
            const oldCache = this.lruCaches.get(key);
            if (oldCache) {
              // 既存のキャッシュからデータを取得
              const entries = Array.from(oldCache.entries());

              // 新しいTTL値を決定
              let ttlValue = this.lruCacheTTL;
              if (this.priorityDataTypes.has(dataType)) {
                ttlValue = this.lruCacheTTL * 1.5;
              }

              // 新しいキャッシュを作成
              const newCache = new LRUCache<number, RealTimeData>({
                max: newSize,
                ttl: ttlValue,
                updateAgeOnGet: true,
                allowStale: false
              });

              // 古いキャッシュのデータを新しいキャッシュに転送
              // 新しいサイズに合わせるため、最新のデータから追加
              const sortedEntries = entries.sort(([a], [b]) => b - a);
              for (let i = 0; i < Math.min(newSize, sortedEntries.length); i++) {
                const [timestamp, data] = sortedEntries[i];
                newCache.set(timestamp, data);
              }

              // 古いキャッシュを置き換え
              this.lruCaches.set(key, newCache);
            }
          }

          logger.debug(
            `バッファサイズ調整: ${key} ${currentSize} -> ${newSize} (使用率: ${(bufferUsageRatio * 100).toFixed(1)}%, メモリ使用率: ${(memoryUsageRatio * 100).toFixed(1)}%)`
          );
        }
      }
    } catch (error) {
      logger.error(
        `バッファサイズ調整エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * バッチでデータを処理する
   * @param dataArray リアルタイムデータの配列
   */
  public processBatch(dataArray: RealTimeData[]): void {
    if (!this.isStarted) {
      logger.warn('データ処理が開始されていません。start()を呼び出してください。');
      return;
    }

    // メモリ効率のためにバッチサイズずつ処理
    const totalItems = dataArray.length;
    const batchCount = Math.ceil(totalItems / this.batchSize);

    for (let i = 0; i < batchCount; i++) {
      const start = i * this.batchSize;
      const end = Math.min(start + this.batchSize, totalItems);
      const batch = dataArray.slice(start, end);

      // バッチ内の各データを処理
      for (const data of batch) {
        this.processData(data);
      }
    }

    logger.debug(`${totalItems}件のデータをバッチ処理しました（${batchCount}バッチ）`);
  }

  /**
   * スロットリングされたイベント通知
   * @param bufferKey バッファキー
   */
  private throttleEmit(bufferKey: string): void {
    // 既存のタイマーがある場合は何もしない（スロットリング中）
    if (this.throttleTimers.has(bufferKey)) {
      return;
    }

    // 新しいタイマーを設定
    const timer = setTimeout(() => {
      try {
        // タイマーを削除
        this.throttleTimers.delete(bufferKey);

        // バッフ取得
        const buffer = this.buffers.get(bufferKey);
        if (!buffer || buffer.length === 0) {
          return;
        }

        // バックプレッシャーが適用されている場合、イベント通知の頻度を下げる
        if (this.backPressureActive) {
          // 送信するデータ量を減らす
          const dataToSend = buffer.slice(-Math.ceil(this.batchSize / 2));
          this.emit(bufferKey, dataToSend);
          this.throttledEventCount++;

          // バックプレッシャー時はイベント通知間隔を長くする
          const nextTimer = setTimeout(() => {
            this.throttleTimers.delete(bufferKey);
          }, this.throttleInterval * 2); // 通常の2倍の間隔

          this.throttleTimers.set(bufferKey, nextTimer);
        } else {
          // 通常動作時は全データをバッチサイズごとに送信
          for (let i = 0; i < buffer.length; i += this.batchSize) {
            const batch = buffer.slice(i, i + this.batchSize);
            if (batch.length > 0) {
              this.emit(bufferKey, batch);
              this.throttledEventCount++;
            }
          }
        }

        // キー部分を分解して対応するイベントも発行
        const [symbol, typeStr] = bufferKey.split('_');
        const dataType = typeStr as RealTimeDataType;

        // タイプ固有のイベントも発行
        this.emit(`${dataType}`, {
          symbol,
          type: dataType,
          data: buffer.slice(-1)[0] // 最新のデータ
        });
      } catch (error) {
        logger.error(
          `イベント通知エラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }, this.throttleInterval);

    this.throttleTimers.set(bufferKey, timer);
  }

  /**
   * データ処理を開始する
   */
  public start(): void {
    if (this.isStarted) {
      logger.warn('データ処理は既に開始されています');
      return;
    }

    this.isStarted = true;
    this.lastProcessTime = Date.now();
    this.lastMemoryCheck = Date.now();
    this.processingStartTime = Date.now();

    // 定期的なメモリ使用量チェックを開始
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.memoryCheckIntervalMs); // 設定された間隔でチェック

    // 初回のメモリ使用量チェック
    this.checkMemoryUsage();

    logger.info('リアルタイムデータ処理を開始しました');

    // 開始イベントを発行
    this.emit('start', {
      timestamp: Date.now(),
      memoryInfo: this.getMemoryUsageInfo()
    });
  }

  /**
   * データ処理を停止する
   */
  public stop(): void {
    if (!this.isStarted) {
      logger.warn('データ処理は既に停止しています');
      return;
    }

    // すべてのスロットリングタイマーをクリア
    for (const timer of this.throttleTimers.values()) {
      clearTimeout(timer);
    }
    this.throttleTimers.clear();

    // メモリチェックインターバルをクリア
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    this.isStarted = false;

    // 最終的なメモリ使用状況を記録
    const finalMemoryInfo = this.getMemoryUsageInfo();

    logger.info(
      `リアルタイムデータ処理を停止しました。処理データ数: ${this.dataCount}, ピークメモリ使用量: ${finalMemoryInfo.peakMemoryUsage.toFixed(1)}MB`
    );

    // 停止イベントを発行
    this.emit('stop', {
      timestamp: Date.now(),
      dataProcessed: this.dataCount,
      uptime: Date.now() - this.processingStartTime,
      memoryInfo: finalMemoryInfo
    });
  }

  /**
   * 現在の統計情報を取得する
   * @returns 統計情報オブジェクト
   */
  public getStats(): {
    isRunning: boolean;
    bufferCount: number;
    totalDataProcessed: number;
    symbolCount: number;
    dataTypeCount: number;
    bufferSizes: Record<string, number>;
    uptime: number;
    memoryUsage: MemoryUsageInfo;
    lruCacheEnabled: boolean;
    lruCacheSizes?: Record<string, number>;
    dynamicBufferSizeEnabled: boolean;
    backPressureCount: number;
    processingRate: number;
    priorityDataTypes: string[];
  } {
    // バッファサイズを集計
    const bufferSizes: Record<string, number> = {};
    for (const [key, buffer] of this.buffers.entries()) {
      bufferSizes[key] = buffer.length;
    }

    // LRUキャッシュサイズを集計（有効な場合）
    const lruCacheSizes: Record<string, number> = {};
    if (this.enableLRUCache) {
      for (const [key, cache] of this.lruCaches.entries()) {
        lruCacheSizes[key] = cache.size;
      }
    }

    // 処理速度を計算
    let processingRate = 0;
    if (this.processingStartTime > 0) {
      const elapsedSeconds = (Date.now() - this.processingStartTime) / 1000;
      if (elapsedSeconds > 0) {
        processingRate = this.dataCount / elapsedSeconds;
      }
    }

    return {
      isRunning: this.isStarted,
      bufferCount: this.buffers.size,
      totalDataProcessed: this.dataCount,
      symbolCount: this.symbols.size,
      dataTypeCount: this.dataTypes.size,
      bufferSizes,
      uptime: this.processingStartTime > 0 ? Date.now() - this.processingStartTime : 0,
      memoryUsage: this.getMemoryUsageInfo(),
      lruCacheEnabled: this.enableLRUCache,
      lruCacheSizes: this.enableLRUCache ? lruCacheSizes : undefined,
      dynamicBufferSizeEnabled: this.dynamicBufferSizeEnabled,
      backPressureCount: this.skippedLowPriorityCount,
      processingRate,
      priorityDataTypes: Array.from(this.priorityDataTypes)
    };
  }

  /**
   * バッファをクリアする
   * @param symbol 特定の通貨ペアのバッファのみをクリアする場合に指定
   * @param dataType 特定のデータタイプのバッファのみをクリアする場合に指定
   */
  public clearBuffers(symbol?: string, dataType?: RealTimeDataType): void {
    if (symbol && dataType) {
      // 特定のシンボルと特定のデータタイプのバッファをクリア
      const key = this.getBufferKey(symbol, dataType);
      if (this.buffers.has(key)) {
        this.buffers.set(key, []);
        // LRUキャッシュも同様にクリア
        if (this.enableLRUCache && this.lruCaches.has(key)) {
          this.lruCaches.get(key)?.clear();
        }
        logger.debug(`バッファをクリアしました: ${key}`);
      }
    } else if (symbol) {
      // 特定のシンボルのすべてのデータタイプのバッファをクリア
      for (const type of this.dataTypes) {
        const key = this.getBufferKey(symbol, type);
        if (this.buffers.has(key)) {
          this.buffers.set(key, []);
          // LRUキャッシュも同様にクリア
          if (this.enableLRUCache && this.lruCaches.has(key)) {
            this.lruCaches.get(key)?.clear();
          }
        }
      }
      logger.debug(`シンボル ${symbol} のすべてのバッファをクリアしました`);
    } else if (dataType) {
      // すべてのシンボルの特定のデータタイプのバッファをクリア
      
      // バッファエントリとキーのリストを取得
      const bufferEntries = Array.from(this.buffers.entries());

      // 各バッファをスキャンして、指定されたデータタイプのもののみをクリア
      for (const [key, _] of bufferEntries) {
        if (key.endsWith(`_${dataType}`)) {
          this.buffers.set(key, []);
          // LRUキャッシュも同様にクリア
          if (this.enableLRUCache && this.lruCaches.has(key)) {
            this.lruCaches.get(key)?.clear();
          }
        }
      }
      logger.debug(`データタイプ ${dataType} のすべてのバッファをクリアしました`);
    } else {
      // すべてのバッファをクリア
      for (const key of this.buffers.keys()) {
        this.buffers.set(key, []);
        // LRUキャッシュも同様にクリア
        if (this.enableLRUCache && this.lruCaches.has(key)) {
          this.lruCaches.get(key)?.clear();
        }
      }
      logger.debug('すべてのバッファをクリアしました');
    }
  }

  /**
   * データをフィルタリングすべきかどうかを判断する
   * @param data リアルタイムデータ
   * @returns フィルタリングすべきかどうか
   */
  private shouldFilterData(data: RealTimeData): boolean {
    try {
      // データの妥当性チェック
      if (!data || !data.data) {
        return false;
      }

      // ティッカータイプのデータで変化が少ない場合はフィルタリング
      if (data.type === RealTimeDataType.TICKER) {
        const bufferKey = this.getBufferKey(data.symbol, data.type);
        const buffer = this.buffers.get(bufferKey);

        if (buffer && buffer.length > 0) {
          const lastData = buffer[buffer.length - 1];

          // データの妥当性チェック
          if (
            !lastData ||
            !lastData.data ||
            !lastData.data.price ||
            !lastData.data.volume ||
            !data.data.price ||
            !data.data.volume
          ) {
            return false;
          }

          // 前回のデータとの差分が小さい場合はフィルタリング
          const priceChangeThreshold = 0.0001; // 0.01%の変化をしきい値とする
          const volumeChangeThreshold = 0.05; // 5%の変化をしきい値とする

          const priceDiff = Math.abs((data.data.price - lastData.data.price) / lastData.data.price);
          const volumeDiff = Math.abs(
            (data.data.volume - lastData.data.volume) / lastData.data.volume
          );

          return priceDiff < priceChangeThreshold && volumeDiff < volumeChangeThreshold;
        }
      }

      return false;
    } catch (error) {
      // エラーをログに記録するが、常にフィルタリングしないという判断を返す
      logger.error(
        `データフィルタリングエラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * データを圧縮する
   * @param data リアルタイムデータ
   * @returns 圧縮されたデータ
   */
  private compressData(data: RealTimeData): RealTimeData {
    try {
      // データの妥当性チェック
      if (!data || !data.data) {
        return data;
      }

      // データタイプによって圧縮方法を変える
      if (data.type === RealTimeDataType.ORDERBOOK && data.data.bids && data.data.asks) {
        // オーダーブックデータの場合は必要な情報のみを保持
        return {
          ...data,
          data: {
            bids: data.data.bids.slice(0, 5), // 上位5件のbidのみ保持
            asks: data.data.asks.slice(0, 5), // 上位5件のaskのみ保持
            timestamp: data.data.timestamp
          }
        };
      }

      // その他のデータタイプはそのまま返す
      return data;
    } catch (error) {
      // エラーをログに記録するが、元のデータをそのまま返す
      logger.error(`データ圧縮エラー: ${error instanceof Error ? error.message : String(error)}`);
      return data;
    }
  }

  /**
   * ローソク足データを更新する
   * @param data リアルタイムデータ
   */
  private updateCandleData(data: RealTimeData): void {
    try {
      // dataオブジェクトの妥当性をチェック
      if (!data || !data.data) {
        return;
      }

      // CANDLE タイプの場合は直接使用
      if (data.type === RealTimeDataType.CANDLE) {
        const candle = data.data;

        // キャンドルデータの妥当性をチェック
        if (!candle) {
          return;
        }

        // タイムフレームを抽出（例：'1m'）
        const timeframe = candle.timeframe || '1m';

        // 完成したローソク足をイベントとして通知
        if (candle.isComplete) {
          this.emit('candle-complete', {
            symbol: data.symbol,
            timeframe: timeframe,
            candle: {
              timestamp: candle.timestamp,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume
            },
            isComplete: true
          } as RealTimeCandleData);
        }
        return;
      }

      // TRADE タイプの場合はローソク足を構築
      if (data.type === RealTimeDataType.TRADE) {
        const trade = data.data;

        // トレードデータの妥当性をチェック
        if (!trade) {
          return;
        }

        const price = trade.price || 0;
        const volume = trade.amount || trade.volume || 0;
        const timestamp = trade.timestamp || data.timestamp;

        // 価格とタイムスタンプがない場合は処理しない
        if (!price || !timestamp) {
          return;
        }

        // 1分足用のタイムスタンプ（分の始まりにアライン）
        const candleTimestamp = Math.floor(timestamp / 60000) * 60000;

        // シンボルのビルダーマップを取得または作成
        let symbolBuilders = this.candleBuilders.get(data.symbol);
        if (!symbolBuilders) {
          symbolBuilders = new Map();
          this.candleBuilders.set(data.symbol, symbolBuilders);
        }

        // この時間枠のビルダーを取得または作成
        const timeframeKey = '1m';
        let builder = symbolBuilders.get(timeframeKey);

        if (!builder || builder.timestamp !== candleTimestamp) {
          // 前の足が完成していれば通知
          if (builder && builder.open !== undefined && builder.close !== undefined) {
            this.emit('candle-complete', {
              symbol: data.symbol,
              timeframe: timeframeKey,
              candle: {
                timestamp: builder.timestamp!,
                open: builder.open!,
                high: builder.high!,
                low: builder.low!,
                close: builder.close!,
                volume: builder.volume!
              },
              isComplete: true
            } as RealTimeCandleData);
          }

          // 新しい足を作成
          builder = {
            timestamp: candleTimestamp,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: volume
          };

          symbolBuilders.set(timeframeKey, builder);
        } else {
          // 既存の足を更新
          builder.high = Math.max(builder.high!, price);
          builder.low = Math.min(builder.low!, price);
          builder.close = price;
          builder.volume = (builder.volume || 0) + volume;
        }

        // 進行中のローソク足を通知 (テスト実行時には必ず発行するようにする)
        this.emit('candle-update', {
          symbol: data.symbol,
          timeframe: timeframeKey,
          candle: {
            timestamp: builder.timestamp!,
            open: builder.open!,
            high: builder.high!,
            low: builder.low!,
            close: builder.close!,
            volume: builder.volume!
          },
          isComplete: false
        } as RealTimeCandleData);
      }
    } catch (error) {
      // エラーをログに記録するが、例外は投げない
      logger.error(
        `ローソク足データ更新エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 指定したシンボルとデータタイプの最新データを取得する
   * @param symbol 通貨ペア
   * @param dataType データタイプ
   * @param count 取得するデータ数（デフォルト: 1）
   * @returns 最新データの配列
   */
  public getLatestData(
    symbol: string,
    dataType: RealTimeDataType,
    count: number = 1
  ): RealTimeData[] {
    const bufferKey = this.getBufferKey(symbol, dataType);

    // LRUキャッシュが有効で、キャッシュから取得できる場合
    if (this.enableLRUCache) {
      const cache = this.lruCaches.get(bufferKey);
      if (cache && cache.size > 0) {
        // 最新のタイムスタンプを降順で取得（型指定を追加）
        const timestamps = Array.from(cache.keys()).sort((a: number, b: number) => b - a);
        const result: RealTimeData[] = [];

        // 要求された数だけデータを取得
        for (let i = 0; i < Math.min(count, timestamps.length); i++) {
          const data = cache.get(timestamps[i]);
          if (data) {
            result.push(data);
          }
        }

        return result;
      }
    }

    // LRUキャッシュが無効またはキャッシュにデータがない場合はバッファから取得
    const buffer = this.buffers.get(bufferKey) || [];
    return buffer.slice(-count);
  }

  /**
   * 監視する通貨ペアを追加する
   * @param symbols 追加する通貨ペアの配列
   */
  public addSymbols(symbols: string[]): void {
    for (const symbol of symbols) {
      if (!this.symbols.has(symbol)) {
        this.symbols.add(symbol);

        // 新しいシンボルのバッファを初期化
        for (const dataType of this.dataTypes) {
          const key = this.getBufferKey(symbol, dataType);
          this.buffers.set(key, []);
        }
      }
    }

    logger.info(`監視対象シンボルを追加しました: ${symbols.join(', ')}`);
  }

  /**
   * 監視する通貨ペアを削除する
   * @param symbols 削除する通貨ペアの配列
   */
  public removeSymbols(symbols: string[]): void {
    for (const symbol of symbols) {
      if (this.symbols.has(symbol)) {
        this.symbols.delete(symbol);

        // シンボルのバッファを削除
        for (const dataType of this.dataTypes) {
          const key = this.getBufferKey(symbol, dataType);
          this.buffers.delete(key);
        }

        // ローソク足ビルダーも削除
        this.candleBuilders.delete(symbol);
      }
    }

    logger.info(`監視対象シンボルを削除しました: ${symbols.join(', ')}`);
  }

  /**
   * 現在のメモリ使用状況情報を取得する
   * @returns メモリ使用情報オブジェクト
   */
  public getMemoryUsageInfo(): MemoryUsageInfo {
    try {
      const memUsage = process.memoryUsage();
      const totalHeapSize = memUsage.heapTotal / (1024 * 1024); // MB単位
      const usedHeapSize = memUsage.heapUsed / (1024 * 1024); // MB単位
      const rss = memUsage.rss / (1024 * 1024); // MB単位
      const external = (memUsage.external || 0) / (1024 * 1024); // MB単位
      const memoryUsageRatio = usedHeapSize / this.maxMemoryMB;

      // 動的バッファサイズを集計
      const dynamicBufferSizes: Record<string, number> = {};
      for (const [key, size] of this.dynamicBufferSizes.entries()) {
        dynamicBufferSizes[key] = size;
      }

      // データ処理速度を計算
      let dataProcessingRate = 0;
      if (this.processingStartTime > 0) {
        const elapsedSeconds = (Date.now() - this.processingStartTime) / 1000;
        if (elapsedSeconds > 0) {
          dataProcessingRate = this.dataCount / elapsedSeconds;
        }
      }

      return {
        totalHeapSize,
        usedHeapSize,
        memoryUsageRatio,
        isBackPressureActive: this.backPressureActive,
        dynamicBufferSizes,
        rss,
        externalMemory: external,
        gcEnabled: typeof global.gc === 'function',
        lastGCDuration: this.lastGCDuration,
        peakMemoryUsage: this.peakMemoryUsage,
        dataProcessingRate,
        throttledEvents: this.throttledEventCount,
        skippedLowPriorityData: this.skippedLowPriorityCount
      };
    } catch (error) {
      logger.error(
        `メモリ使用情報取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        totalHeapSize: 0,
        usedHeapSize: 0,
        memoryUsageRatio: 0,
        isBackPressureActive: false,
        dynamicBufferSizes: {},
        rss: 0,
        externalMemory: 0,
        gcEnabled: false,
        peakMemoryUsage: 0,
        dataProcessingRate: 0,
        throttledEvents: 0,
        skippedLowPriorityData: 0
      };
    }
  }
}
