/**
 * メモリ使用量モニタリングユーティリティ
 * バックテストなどの大量のデータを扱う処理でメモリ使用状況を追跡
 */
import logger from './logger.js';

/**
 * メモリ使用情報
 */
export interface MemoryUsageInfo {
  heapTotal: number; // 合計ヒープサイズ (MB)
  heapUsed: number; // 使用中ヒープサイズ (MB)
  external: number; // 外部メモリ (MB)
  rss: number; // Resident Set Size (MB)
  arrayBuffers: number; // ArrayBufferのメモリ使用量 (MB)
  timestamp: number; // タイムスタンプ
}

/**
 * メモリピーク情報
 */
export interface MemoryPeaks {
  heapTotal: number; // ピーク時の合計ヒープサイズ (bytes)
  heapUsed: number; // ピーク時の使用中ヒープサイズ (bytes)
  external: number; // ピーク時の外部メモリ (bytes)
  rss: number; // ピーク時のResident Set Size (bytes)
  timestamp?: number; // ピーク時のタイムスタンプ
}

/**
 * メモリ使用量モニタリングクラス
 */
export class MemoryMonitor {
  private snapshots: MemoryUsageInfo[] = [];
  private maxHeapUsed: number = 0;
  private enabled: boolean = true;
  private label: string;
  private intervalId: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private memoryPeaks: MemoryPeaks = {
    heapTotal: 0,
    heapUsed: 0,
    external: 0,
    rss: 0
  };

  /**
   * コンストラクタ
   * @param label モニタリングラベル
   * @param enabled 有効かどうか（falseの場合は動作しない）
   */
  constructor(label: string = 'default', enabled: boolean = true) {
    this.label = label;
    this.enabled = enabled;
  }

  /**
   * メモリスナップショットを取得
   * @returns メモリ使用情報
   */
  public takeSnapshot(): MemoryUsageInfo | null {
    if (!this.enabled) return null;

    const memUsage = process.memoryUsage();
    const snapshot: MemoryUsageInfo = {
      heapTotal: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100, // MB単位に変換、小数点2桁
      heapUsed: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
      external: Math.round((memUsage.external / 1024 / 1024) * 100) / 100,
      rss: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
      arrayBuffers: Math.round(((memUsage as any).arrayBuffers / 1024 / 1024) * 100) / 100,
      timestamp: Date.now()
    };

    this.snapshots.push(snapshot);

    // 最大使用メモリを更新
    if (snapshot.heapUsed > this.maxHeapUsed) {
      this.maxHeapUsed = snapshot.heapUsed;
    }

    // ピーク値を更新
    this.updateMemoryPeaks(memUsage);

    return snapshot;
  }

  /**
   * メモリ使用量のピーク値を更新
   * @param memUsage 現在のメモリ使用状況
   */
  private updateMemoryPeaks(memUsage: NodeJS.MemoryUsage): void {
    const now = Date.now();
    let updated = false;

    if (memUsage.heapTotal > this.memoryPeaks.heapTotal) {
      this.memoryPeaks.heapTotal = memUsage.heapTotal;
      updated = true;
    }

    if (memUsage.heapUsed > this.memoryPeaks.heapUsed) {
      this.memoryPeaks.heapUsed = memUsage.heapUsed;
      updated = true;
    }

    if (memUsage.external > this.memoryPeaks.external) {
      this.memoryPeaks.external = memUsage.external;
      updated = true;
    }

    if (memUsage.rss > this.memoryPeaks.rss) {
      this.memoryPeaks.rss = memUsage.rss;
      updated = true;
    }

    if (updated) {
      this.memoryPeaks.timestamp = now;
    }
  }

  /**
   * メモリ使用量のピーク値を取得
   * @returns メモリピーク情報
   */
  public getMemoryPeaks(): MemoryPeaks {
    return { ...this.memoryPeaks };
  }

  /**
   * 定期的なメモリ監視を開始
   * @param intervalMs 監視間隔（ミリ秒）
   */
  public startMonitoring(intervalMs: number = 1000): void {
    if (!this.enabled) return;

    this.startTime = Date.now();
    // 既存の監視がある場合は停止
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // 初期スナップショット
    this.takeSnapshot();

    // 定期的にスナップショットを取得
    this.intervalId = setInterval(() => {
      const snapshot = this.takeSnapshot();
      if (snapshot) {
        logger.debug(
          `[MemoryMonitor:${this.label}] Heap: ${snapshot.heapUsed}MB / ${snapshot.heapTotal}MB, RSS: ${snapshot.rss}MB`
        );
      }
    }, intervalMs);
  }

  /**
   * 監視を停止
   */
  public stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;

      const elapsedSec = (Date.now() - this.startTime) / 1000;
      logger.info(`[MemoryMonitor:${this.label}] 監視終了 (${elapsedSec.toFixed(1)}秒間)`);
    }
  }

  /**
   * メモリ使用状況のサマリーを取得
   * @returns 使用状況のサマリー文字列
   */
  public getSummary(): string {
    if (!this.enabled || this.snapshots.length === 0) {
      return 'メモリモニタリングは無効または実行されていません';
    }

    const startSnapshot = this.snapshots[0];
    const endSnapshot = this.snapshots[this.snapshots.length - 1];
    const elapsedSec = (endSnapshot.timestamp - startSnapshot.timestamp) / 1000;
    const peaksMB = {
      heapTotal: (this.memoryPeaks.heapTotal / 1024 / 1024).toFixed(2),
      heapUsed: (this.memoryPeaks.heapUsed / 1024 / 1024).toFixed(2),
      external: (this.memoryPeaks.external / 1024 / 1024).toFixed(2),
      rss: (this.memoryPeaks.rss / 1024 / 1024).toFixed(2)
    };

    return `
メモリ使用状況サマリー (${this.label}):
実行時間: ${elapsedSec.toFixed(1)}秒
スナップショット数: ${this.snapshots.length}件
最大ヒープ使用量: ${this.maxHeapUsed.toFixed(2)}MB
ピーク値: ヒープ使用 ${peaksMB.heapUsed}MB, ヒープ合計 ${peaksMB.heapTotal}MB, RSS ${peaksMB.rss}MB
開始時ヒープ: ${startSnapshot.heapUsed.toFixed(2)}MB / ${startSnapshot.heapTotal.toFixed(2)}MB
終了時ヒープ: ${endSnapshot.heapUsed.toFixed(2)}MB / ${endSnapshot.heapTotal.toFixed(2)}MB
ヒープ増加量: ${(endSnapshot.heapUsed - startSnapshot.heapUsed).toFixed(2)}MB
RSS増加量: ${(endSnapshot.rss - startSnapshot.rss).toFixed(2)}MB
    `;
  }

  /**
   * メモリ使用状況をログに出力
   */
  public logSummary(): void {
    if (!this.enabled) return;
    logger.info(this.getSummary());
  }

  /**
   * すべてのスナップショットを取得
   * @returns メモリスナップショットの配列
   */
  public getSnapshots(): MemoryUsageInfo[] {
    return [...this.snapshots];
  }

  /**
   * 最大ヒープ使用量を取得
   * @returns 最大ヒープ使用量（MB）
   */
  public getMaxHeapUsed(): number {
    return this.maxHeapUsed;
  }
}

/**
 * 現在のヒープ使用率を取得
 * @returns ヒープ使用率 (0-1の範囲)
 */
export function getHeapUsageRatio(): number {
  const memUsage = process.memoryUsage();
  return memUsage.heapUsed / memUsage.heapTotal;
}

/**
 * メモリ問題のディープ分析
 * リーク疑いのある場合に呼び出す詳細分析
 */
export function analyzeMemoryIssues(): void {
  // Node.jsはV8エンジンを使用しているため、V8のヒープスナップショット機能が利用可能
  try {
    // v8-profilerモジュールが必要（事前にインストールしておく必要あり）
    // この部分は実装の例示であり、実際に使用する場合は適切なモジュールのインストールが必要
    logger.info('メモリ問題の詳細分析を開始します...');

    // 現在のメモリ使用状況をログ出力
    const memUsage = process.memoryUsage();
    logger.info(`
詳細メモリ分析:
heapTotal: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB
heapUsed: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB
external: ${(memUsage.external / 1024 / 1024).toFixed(2)}MB
rss: ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB
arrayBuffers: ${((memUsage as any).arrayBuffers / 1024 / 1024).toFixed(2)}MB
使用率: ${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1)}%
    `);

    // ガベージコレクションを強制実行
    if (global.gc) {
      logger.info('ガベージコレクションを強制実行...');
      global.gc();

      // GC後のメモリ使用状況
      const afterGcMemUsage = process.memoryUsage();
      logger.info(`
GC後のメモリ状況:
heapTotal: ${(afterGcMemUsage.heapTotal / 1024 / 1024).toFixed(2)}MB
heapUsed: ${(afterGcMemUsage.heapUsed / 1024 / 1024).toFixed(2)}MB
回収量: ${((memUsage.heapUsed - afterGcMemUsage.heapUsed) / 1024 / 1024).toFixed(2)}MB
      `);
    } else {
      logger.warn(
        'ガベージコレクションを強制実行できません。--expose-gc オプションでNode.jsを起動してください。'
      );
    }
  } catch (error) {
    logger.error(`メモリ分析エラー: ${error instanceof Error ? error.message : String(error)}`);
  }
}
