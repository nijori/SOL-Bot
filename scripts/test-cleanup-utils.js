/**
 * ESMテスト用クリーンアップユーティリティ
 * REF-025: ESMテスト安定性の向上
 */

// ESMモジュール対応のためjestをインポート
import { jest } from '@jest/globals';

/**
 * 非同期処理のクリーンアップヘルパー
 *
 * Jest did not exitエラーの根本的解決のためのユーティリティ
 * afterAllフックで使用することで、テスト完了後に未解決のプロミスやタイマーをクリーンアップします
 */
export const cleanupAsyncOperations = async (timeout = 200) => {
  // すべてのモックをリセット
  jest.clearAllMocks();

  // タイマーをリセット
  jest.clearAllTimers();
  jest.useRealTimers();

  // グローバルタイマーをクリア
  if (global.setInterval && global.setInterval.mockClear) {
    global.setInterval.mockClear();
  }

  if (global.clearInterval && global.clearInterval.mockClear) {
    global.clearInterval.mockClear();
  }

  // 未解決のプロミスやタイマーを終了させるための遅延
  return new Promise((resolve) => {
    setTimeout(() => {
      // イベントリスナーを削除して潜在的なメモリリークを防止
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('uncaughtException');
      resolve();
    }, timeout);
  });
};

/**
 * テスト間でリソースをクリーンアップするためのヘルパー
 * afterEachフックで使用することで、各テスト間の分離を強化します
 */
export const cleanupTestResources = () => {
  // すべてのモックタイマーをクリア
  jest.clearAllTimers();

  // モック関数のリセット
  jest.clearAllMocks();

  // 明示的なガベージコレクションの提案（Node.jsの場合）
  if (global.gc) {
    global.gc();
  }
};

/**
 * テスト用モック対象の初期化
 */
export const setupTestMocks = () => {
  // よく使用されるモックをセットアップ
  jest.useFakeTimers();

  // グローバルなネットワークリクエストをモック
  if (global.fetch) {
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('')
      })
    );
  }
};

/**
 * リソース追跡クラス
 * メモリリークの追跡に役立つユーティリティクラス
 */
export class ResourceTracker {
  constructor() {
    this.resources = new Set();
  }

  // リソースを追跡対象に追加
  track(resource) {
    this.resources.add(resource);
    return resource;
  }

  // すべての追跡リソースをクリーンアップ
  cleanup() {
    for (const resource of this.resources) {
      if (resource.destroy && typeof resource.destroy === 'function') {
        resource.destroy();
      } else if (resource.close && typeof resource.close === 'function') {
        resource.close();
      } else if (resource.stop && typeof resource.stop === 'function') {
        resource.stop();
      }
    }
    this.resources.clear();
  }
}

/**
 * オブジェクト破棄ヘルパー
 * クラスインスタンスの適切な破棄を支援
 */
export const disposeObject = (obj) => {
  if (!obj) return;

  // 破棄メソッドがある場合は呼び出す
  if (obj.destroy && typeof obj.destroy === 'function') {
    obj.destroy();
  } else if (obj.close && typeof obj.close === 'function') {
    obj.close();
  } else if (obj.stop && typeof obj.stop === 'function') {
    obj.stop();
  } else if (obj.dispose && typeof obj.dispose === 'function') {
    obj.dispose();
  }

  // 循環参照を防ぐためにプロパティをクリア
  for (const prop in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, prop)) {
      obj[prop] = null;
    }
  }
};
