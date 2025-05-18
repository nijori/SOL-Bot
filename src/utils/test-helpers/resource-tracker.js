/**
 * テストリソーストラッキングユーティリティ
 * REF-034: テスト実行環境の最終安定化
 * TST-058: リソーストラッカーの無限ループ問題修正
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
    this.isTracking = true; // トラッキング状態フラグ追加
    
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
      // トラッキング中のみ追加
      const timerId = self.originalSetTimeout.call(this, fn, delay, ...args);
      if (self.isTracking) {
        self.timers.add(timerId);
      }
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
      if (self.isTracking) {
        self.intervals.add(intervalId);
      }
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
    if (!this.isTracking) return; // トラッキング中でなければ何もしない
    
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
    if (!this.isTracking) return; // トラッキング中でなければ何もしない
    this.tempFiles.add(filePath);
  }
  
  /**
   * 一時ディレクトリの追跡
   * @param {string} dirPath - 一時ディレクトリのパス
   */
  trackTempDir(dirPath) {
    if (!this.isTracking) return; // トラッキング中でなければ何もしない
    this.tempDirs.add(dirPath);
  }
  
  /**
   * カスタムリソースの追跡
   * @param {object} resource - クリーンアップが必要なリソース（destroy/close/stopメソッドを持つオブジェクト）
   */
  trackResource(resource) {
    if (!this.isTracking) return; // トラッキング中でなければ何もしない
    this.customResources.add(resource);
  }
  
  /**
   * トラッキングを無効化
   */
  disableTracking() {
    this.isTracking = false;
  }
  
  /**
   * トラッキングを有効化
   */
  enableTracking() {
    this.isTracking = true;
  }
  
  /**
   * すべてのリソースをクリーンアップ
   * @param {boolean} [restoreGlobals=true] - グローバル関数を元に戻すかどうか
   * @returns {Promise<void>}
   */
  async cleanup(restoreGlobals = true) {
    // トラッキングを停止（無限ループを防ぐため）
    this.disableTracking();
    
    // TST-058: 安全なタイマー関数を先にバックアップ
    const safeSetTimeout = this.originalSetTimeout;
    const safeSetImmediate = global.setImmediate;
    
    // グローバル関数を元に戻す（先に実行して後続の処理でトラッキングが発生しないようにする）
    if (restoreGlobals) {
      try {
        global.setTimeout = this.originalSetTimeout;
        global.clearTimeout = this.originalClearTimeout;
        global.setInterval = this.originalSetInterval;
        global.clearInterval = this.originalClearInterval;
      } catch (err) {
        console.warn(`⚠️ グローバル関数リストア中にエラー: ${err.message}`);
      }
    }
    
    // タイマーをクリア - TST-058: エラーハンドリングを追加
    try {
      const timerIds = [...this.timers]; // Set内容の先コピーして反復中に変更を防止
      for (const timerId of timerIds) {
        try {
          this.originalClearTimeout(timerId);
        } catch (err) {
          // 個別のタイマークリアエラーを無視
        }
      }
      this.timers.clear();
    } catch (err) {
      console.warn(`⚠️ タイマークリア中にエラー: ${err.message}`);
    }
    
    // インターバルをクリア - TST-058: エラーハンドリングを追加
    try {
      const intervalIds = [...this.intervals]; // Set内容を先コピー
      for (const intervalId of intervalIds) {
        try {
          this.originalClearInterval(intervalId);
        } catch (err) {
          // 個別のインターバルクリアエラーを無視
        }
      }
      this.intervals.clear();
    } catch (err) {
      console.warn(`⚠️ インターバルクリア中にエラー: ${err.message}`);
    }
    
    // イベントリスナーを削除
    try {
      // Map内容をコピーして反復中の変更を防止
      const listenerEntries = [...this.listeners.entries()];
      for (const [emitter, events] of listenerEntries) {
        const eventEntries = [...events.entries()];
        for (const [event, listeners] of eventEntries) {
          const listenersCopy = [...listeners];
          for (const listener of listenersCopy) {
            try {
              // removeListenerがない場合のエラーを防止
              if (emitter && typeof emitter.removeListener === 'function') {
                emitter.removeListener(event, listener);
              }
            } catch (err) {
              // 個別リスナー削除エラーを無視
            }
          }
        }
      }
      this.listeners.clear();
    } catch (err) {
      console.warn(`⚠️ リスナー削除中にエラー: ${err.message}`);
    }
    
    // カスタムリソースをクリーンアップ - TST-058: 改善されたエラーハンドリング
    try {
      const resources = [...this.customResources]; // コピーして反復中の変更を防止
      for (const resource of resources) {
        try {
          if (resource.destroy && typeof resource.destroy === 'function') {
            resource.destroy();
          } else if (resource.close && typeof resource.close === 'function') {
            resource.close();
          } else if (resource.stop && typeof resource.stop === 'function') {
            resource.stop();
          }
        } catch (err) {
          // 個別リソースクリーンアップエラーを無視
        }
      }
      this.customResources.clear();
    } catch (err) {
      console.warn(`⚠️ リソースクリーンアップ中にエラー: ${err.message}`);
    }
    
    // 一時ファイルを削除
    if (this.tempFiles.size > 0) {
      try {
        const fs = require('fs');
        const filePaths = [...this.tempFiles]; // コピー
        for (const filePath of filePaths) {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (err) {
            // 個別ファイル削除エラーを無視
          }
        }
        this.tempFiles.clear();
      } catch (err) {
        console.warn(`⚠️ 一時ファイル削除中にエラー: ${err.message}`);
      }
    }
    
    // 一時ディレクトリを削除
    if (this.tempDirs.size > 0) {
      try {
        const fs = require('fs');
        const dirPaths = [...this.tempDirs]; // コピー
        for (const dirPath of dirPaths) {
          try {
            if (fs.existsSync(dirPath)) {
              fs.rmSync(dirPath, { recursive: true, force: true });
            }
          } catch (err) {
            // 個別ディレクトリ削除エラーを無視
          }
        }
        this.tempDirs.clear();
      } catch (err) {
        console.warn(`⚠️ 一時ディレクトリ削除中にエラー: ${err.message}`);
      }
    }
    
    // TST-058: 無限ループを防ぐために段階的に待機
    // クリーンアップの完了を保証し、新たなトラッキングを防止
    try {
      await new Promise(resolve => safeSetTimeout(resolve, 25));
      await new Promise(resolve => safeSetImmediate(resolve));
    } catch (err) {
      console.warn(`⚠️ クリーンアップ待機中にエラー: ${err.message}`);
    }
    
    // クリーンアップが完了したらトラッキングを再開（オプション）
    if (!restoreGlobals) {
      this.enableTracking();
    }
    
    return true;
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