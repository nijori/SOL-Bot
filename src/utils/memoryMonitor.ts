/**
 * メモリ使用量モニタリングユーティリティ
 * バックテストなどの大量のデータを扱う処理でメモリ使用状況を追跡
 * INF-032: CommonJS形式への変換
 */
// @ts-nocheck
// 循環参照を避けるため、型チェックを一時的に無効化

// ====== 型定義 ======
/**
 * メモリ使用情報の型定義
 */
interface MemoryUsageInfo {
  heapTotal: number;
  heapUsed: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  timestamp: number;
}

/**
 * メモリピーク情報の型定義
 */
interface MemoryPeaks {
  heapTotal: number;
  heapUsed: number;
  external: number;
  rss: number;
  timestamp?: number;
}

// ====== 依存モジュール ======
var moduleHelperRef = require('./moduleHelper');
var loggerRef = moduleHelperRef.hasModule('logger') 
  ? moduleHelperRef.getModule('logger') 
  : require('./logger').default;

// ====== 実装 ======
/**
 * メモリ使用量モニタリングクラス
 */
class MemoryMonitor {
  private snapshots: MemoryUsageInfo[];
  private maxHeapUsed: number;
  private enabled: boolean;
  private label: string;
  private intervalId: NodeJS.Timeout | null;
  private startTime: number;
  private memoryPeaks: MemoryPeaks;

  /**
   * コンストラクタ
   * @param {string} [label='default'] モニタリングラベル
   * @param {boolean} [enabled=true] 有効かどうか（falseの場合は動作しない）
   */
  constructor(label = 'default', enabled = true) {
    this.snapshots = [];
    this.maxHeapUsed = 0;
    this.enabled = enabled;
    this.label = label;
    this.intervalId = null;
    this.startTime = 0;
    this.memoryPeaks = {
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      rss: 0
    };
  }

  /**
   * メモリスナップショットを取得
   * @returns {MemoryUsageInfo|null} メモリ使用情報
   */
  takeSnapshot() {
    if (!this.enabled) return null;

    const memUsage = process.memoryUsage();
    const snapshot = {
      heapTotal: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100, // MB単位に変換、小数点2桁
      heapUsed: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
      external: Math.round((memUsage.external / 1024 / 1024) * 100) / 100,
      rss: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
      arrayBuffers: Math.round((memUsage.arrayBuffers / 1024 / 1024) * 100) / 100,
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
   * @param {NodeJS.MemoryUsage} memUsage 現在のメモリ使用状況
   */
  updateMemoryPeaks(memUsage) {
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
   * @returns {MemoryPeaks} メモリピーク情報
   */
  getMemoryPeaks() {
    return { ...this.memoryPeaks };
  }

  /**
   * 定期的なメモリ監視を開始
   * @param {number} [intervalMs=1000] 監視間隔（ミリ秒）
   */
  startMonitoring(intervalMs = 1000) {
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
        loggerRef.debug(
          `[MemoryMonitor:${this.label}] Heap: ${snapshot.heapUsed}MB / ${snapshot.heapTotal}MB, RSS: ${snapshot.rss}MB`
        );
      }
    }, intervalMs);
  }

  /**
   * 監視を停止
   */
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;

      const elapsedSec = (Date.now() - this.startTime) / 1000;
      loggerRef.info(`[MemoryMonitor:${this.label}] 監視終了 (${elapsedSec.toFixed(1)}秒間)`);
    }
  }

  /**
   * メモリ使用状況のサマリーを取得
   * @returns {string} 使用状況のサマリー文字列
   */
  getSummary() {
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
  logSummary() {
    if (!this.enabled) return;
    loggerRef.info(this.getSummary());
  }

  /**
   * すべてのスナップショットを取得
   * @returns {MemoryUsageInfo[]} メモリスナップショットの配列
   */
  getSnapshots() {
    return [...this.snapshots];
  }

  /**
   * 最大ヒープ使用量を取得
   * @returns {number} 最大ヒープ使用量（MB）
   */
  getMaxHeapUsed() {
    return this.maxHeapUsed;
  }
}

/**
 * 現在のヒープ使用率を取得
 * @returns {number} ヒープ使用率 (0-1の範囲)
 */
function getHeapUsageRatio() {
  const memUsage = process.memoryUsage();
  return memUsage.heapUsed / memUsage.heapTotal;
}

/**
 * メモリ問題のディープ分析
 * リーク疑いのある場合に呼び出す詳細分析
 */
function analyzeMemoryIssues() {
  // Node.jsはV8エンジンを使用しているため、V8のヒープスナップショット機能が利用可能
  try {
    // v8-profilerモジュールが必要（事前にインストールしておく必要あり）
    // この部分は実装の例示であり、実際に使用する場合は適切なモジュールのインストールが必要
    loggerRef.info('メモリ問題の詳細分析を開始します...');

    // 現在のメモリ使用状況をログ出力
    const memUsage = process.memoryUsage();
    loggerRef.info(`
詳細メモリ分析:
heapTotal: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB
heapUsed: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB
external: ${(memUsage.external / 1024 / 1024).toFixed(2)}MB
rss: ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB
arrayBuffers: ${(memUsage.arrayBuffers / 1024 / 1024).toFixed(2)}MB
ヒープ使用率: ${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1)}%
    `);

    // TODO: 将来的にはv8-profilerなどを使ったヒープダンプの実装を検討
  } catch (error) {
    loggerRef.error(`メモリ分析エラー: ${error.message}`);
  }
}

// メモリモニターインスタンスを作成
var globalMemoryMonitor = new MemoryMonitor('global');
// モジュールレジストリに登録
moduleHelperRef.registerModule('memoryMonitor', globalMemoryMonitor);

// CommonJSエクスポート
module.exports = {
  MemoryMonitor,
  getHeapUsageRatio,
  analyzeMemoryIssues,
  globalMemoryMonitor
};

// TypeScriptの型定義が必要な場合
// @ts-ignore
module.exports.MemoryUsageInfo = {};
// @ts-ignore
module.exports.MemoryPeaks = {};
