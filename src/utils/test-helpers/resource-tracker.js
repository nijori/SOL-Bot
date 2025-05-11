/**
 * テストリソーストラッキングユーティリティ
 * REF-034: テスト実行環境の最終安定化
 * 
 * テスト実行中のリソース（タイマー、イベントリスナー、一時ファイル等）を追跡し、
 * テスト完了後に確実にクリーンアップするための仕組みを提供します。
 */

class ResourceTracker {
  constructor() {
    this.timers = new Set();
    this.intervals = new Set();
    this.listeners = new Map();
    this.tempFiles = new Set();
    this.tempDirs = new Set();
    this.customResources = new Set();
    
    // Node.jsのグローバルタイマー関数をオーバーライド
    this.originalSetTimeout = global.setTimeout;
    this.originalClearTimeout = global.clearTimeout;
    this.originalSetInterval = global.setInterval;
    this.originalClearInterval = global.clearInterval;
    
    this.setupOverrides();
  }
  
  /**
   * Node.jsのタイマー関数をオーバーライドして追跡可能にする
   */
  setupOverrides() {
    const self = this;
    
    // setTimeoutのオーバーライド
    global.setTimeout = function trackedSetTimeout(fn, delay, ...args) {
      const timerId = self.originalSetTimeout.call(this, fn, delay, ...args);
      self.timers.add(timerId);
      return timerId;
    };
    
    // clearTimeoutのオーバーライド
    global.clearTimeout = function trackedClearTimeout(timerId) {
      self.timers.delete(timerId);
      return self.originalClearTimeout.call(this, timerId);
    };
    
    // setIntervalのオーバーライド
    global.setInterval = function trackedSetInterval(fn, delay, ...args) {
      const intervalId = self.originalSetInterval.call(this, fn, delay, ...args);
      self.intervals.add(intervalId);
      return intervalId;
    };
    
    // clearIntervalのオーバーライド
    global.clearInterval = function trackedClearInterval(intervalId) {
      self.intervals.delete(intervalId);
      return self.originalClearInterval.call(this, intervalId);
    };
  }
  
  /**
   * イベントリスナーを追跡
   * @param {object} emitter - イベントエミッターオブジェクト
   * @param {string} event - イベント名
   * @param {function} listener - リスナー関数
   */
  trackListener(emitter, event, listener) {
    if (!this.listeners.has(emitter)) {
      this.listeners.set(emitter, new Map());
    }
    
    if (!this.listeners.get(emitter).has(event)) {
      this.listeners.get(emitter).set(event, new Set());
    }
    
    this.listeners.get(emitter).get(event).add(listener);
  }
  
  /**
   * 一時ファイルの追跡
   * @param {string} filePath - 一時ファイルのパス
   */
  trackTempFile(filePath) {
    this.tempFiles.add(filePath);
  }
  
  /**
   * 一時ディレクトリの追跡
   * @param {string} dirPath - 一時ディレクトリのパス
   */
  trackTempDir(dirPath) {
    this.tempDirs.add(dirPath);
  }
  
  /**
   * カスタムリソースの追跡
   * @param {object} resource - クリーンアップが必要なリソース（destroy/close/stopメソッドを持つオブジェクト）
   */
  trackResource(resource) {
    this.customResources.add(resource);
  }
  
  /**
   * すべてのリソースをクリーンアップ
   * @param {boolean} [restoreGlobals=true] - グローバル関数を元に戻すかどうか
   * @returns {Promise<void>}
   */
  async cleanup(restoreGlobals = true) {
    // タイマーをクリア
    for (const timerId of this.timers) {
      this.originalClearTimeout(timerId);
    }
    this.timers.clear();
    
    // インターバルをクリア
    for (const intervalId of this.intervals) {
      this.originalClearInterval(intervalId);
    }
    this.intervals.clear();
    
    // イベントリスナーを削除
    for (const [emitter, events] of this.listeners.entries()) {
      for (const [event, listeners] of events.entries()) {
        for (const listener of listeners) {
          emitter.removeListener(event, listener);
        }
      }
    }
    this.listeners.clear();
    
    // カスタムリソースをクリーンアップ
    for (const resource of this.customResources) {
      if (resource.destroy && typeof resource.destroy === 'function') {
        resource.destroy();
      } else if (resource.close && typeof resource.close === 'function') {
        resource.close();
      } else if (resource.stop && typeof resource.stop === 'function') {
        resource.stop();
      }
    }
    this.customResources.clear();
    
    // 一時ファイルを削除
    if (this.tempFiles.size > 0) {
      const fs = require('fs');
      for (const filePath of this.tempFiles) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.warn(`⚠️ 一時ファイルの削除に失敗しました: ${filePath}`);
        }
      }
      this.tempFiles.clear();
    }
    
    // 一時ディレクトリを削除
    if (this.tempDirs.size > 0) {
      const fs = require('fs');
      for (const dirPath of this.tempDirs) {
        try {
          if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
          }
        } catch (err) {
          console.warn(`⚠️ 一時ディレクトリの削除に失敗しました: ${dirPath}`);
        }
      }
      this.tempDirs.clear();
    }
    
    // グローバル関数を元に戻す
    if (restoreGlobals) {
      global.setTimeout = this.originalSetTimeout;
      global.clearTimeout = this.originalClearTimeout;
      global.setInterval = this.originalSetInterval;
      global.clearInterval = this.originalClearInterval;
    }
    
    // 少し待機して非同期処理が完全に終了することを保証
    return new Promise(resolve => {
      this.originalSetTimeout(() => {
        resolve();
      }, 100);
    });
  }
  
  /**
   * 追跡中のリソース数を取得
   * @returns {object} 各リソースタイプの数
   */
  getStats() {
    return {
      timers: this.timers.size,
      intervals: this.intervals.size,
      listeners: [...this.listeners.values()].reduce((acc, events) => 
        acc + [...events.values()].reduce((sum, listeners) => sum + listeners.size, 0), 0),
      tempFiles: this.tempFiles.size,
      tempDirs: this.tempDirs.size,
      customResources: this.customResources.size
    };
  }
  
  /**
   * 現在の状態をレポート
   */
  report() {
    const stats = this.getStats();
    const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
    
    if (total > 0) {
      console.warn(`⚠️ クリーンアップされていないリソース検出: ${JSON.stringify(stats)}`);
    }
    
    return stats;
  }
}

module.exports = ResourceTracker; 