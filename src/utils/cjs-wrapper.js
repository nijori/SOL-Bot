/**
 * cjs-wrapper.js
 * CommonJS環境からESMモジュールを使用するためのラッパーユーティリティ
 * 
 * REF-033: ESMとCommonJSの共存基盤構築
 */

/**
 * ESMモジュール用のラッパー関数を作成
 * 
 * @param {string} esmModulePath ESMモジュールのパス
 * @returns {Function} ラッパー関数
 */
const createESMWrapper = (esmModulePath) => {
  return async function() {
    try {
      // 動的インポートを使用してESMモジュールをロード
      const imported = await import(esmModulePath);
      return imported;
    } catch (err) {
      console.error(`Error importing ESM module ${esmModulePath}:`, err);
      throw err;
    }
  };
};

/**
 * ESMモジュールをCommonJSスタイルに変換
 * 
 * @param {Object} esmModule ESMモジュール
 * @returns {Object} CommonJS形式に変換されたモジュール
 */
const convertESMtoCJS = (esmModule) => {
  if (!esmModule) return null;
  
  // デフォルトエクスポートがある場合はそれを優先
  if (esmModule.default) {
    const result = { ...esmModule };
    Object.defineProperty(result, '__esModule', { value: true });
    return result;
  }
  
  return esmModule;
};

/**
 * ESMモジュールをCommonJSからプロキシ経由でアクセスするためのラッパーを作成
 * 
 * @param {string} esmModulePath ESMモジュールのパス
 * @param {Function} transformFn 変換関数（オプション）
 * @returns {Object} プロキシオブジェクト
 */
const createESMProxy = (esmModulePath, transformFn = null) => {
  let moduleCache = null;
  let loading = false;
  const pendingRequests = [];

  const loadModule = async () => {
    if (loading) {
      return new Promise((resolve) => {
        pendingRequests.push(resolve);
      });
    }
    
    try {
      loading = true;
      const imported = await import(esmModulePath);
      moduleCache = transformFn ? transformFn(imported) : convertESMtoCJS(imported);
      
      // 保留中のリクエストを解決
      pendingRequests.forEach(resolve => resolve(moduleCache));
      pendingRequests.length = 0;
      
      return moduleCache;
    } catch (err) {
      console.error(`Error loading ESM module ${esmModulePath}:`, err);
      throw err;
    } finally {
      loading = false;
    }
  };

  // プロキシを返す
  return new Proxy({}, {
    get: (target, prop) => {
      if (!moduleCache) {
        throw new Error(`Module ${esmModulePath} is not loaded yet. You must await the module loader first.`);
      }
      
      if (prop === 'default' && !moduleCache.default) {
        return moduleCache;
      }
      
      return moduleCache[prop];
    },
    
    // ロードメソッドを追加
    apply: (target, thisArg, args) => {
      return loadModule();
    }
  });
};

module.exports = {
  createESMWrapper,
  createESMProxy,
  convertESMtoCJS
}; 