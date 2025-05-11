/**
 * CommonJSからESMモジュールを使用するためのラッパーユーティリティ
 * 
 * このモジュールを使用することで、CommonJS環境からESMモジュールを簡単に利用できます。
 * 動的インポートを使用してESMモジュールをロードし、CommonJSモジュールから使用可能な形式に変換します。
 */

/**
 * ESMモジュール用のラッパー関数を作成
 * 
 * @param {string} esmModulePath - ESMモジュールのパス
 * @return {Function} ESMモジュールを非同期ロードする関数
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
 * ESMモジュールをCommonJSからプロキシ経由でアクセスするためのユーティリティ
 * 
 * @param {string} esmModulePath - ESMモジュールのパス
 * @param {Function} transformFn - オプションの変換関数（モジュールの変換方法をカスタマイズする場合）
 * @return {Object} ESMモジュールへのプロキシオブジェクト
 */
const createESMProxy = (esmModulePath, transformFn = null) => {
  let cachedModule = null;
  let loading = false;
  let loadPromise = null;
  
  const loadModule = async () => {
    if (cachedModule) return cachedModule;
    if (loading) return loadPromise;
    
    loading = true;
    loadPromise = import(esmModulePath)
      .then(imported => {
        cachedModule = transformFn ? transformFn(imported) : imported;
        loading = false;
        return cachedModule;
      })
      .catch(err => {
        loading = false;
        console.error(`Error importing ESM module ${esmModulePath}:`, err);
        throw err;
      });
    
    return loadPromise;
  };
  
  // プロキシオブジェクトを返す
  return new Proxy({}, {
    get: function(target, prop) {
      // 特殊メソッド（then等）はプロミスとして動作するために必要
      if (prop === 'then') {
        return loadModule().then.bind(loadModule());
      }
      
      // その他のプロパティアクセスはモジュールロード後に転送
      return async function(...args) {
        const module = await loadModule();
        if (typeof module[prop] === 'function') {
          return module[prop](...args);
        } else {
          return module[prop];
        }
      };
    },
    apply: function(target, thisArg, args) {
      return loadModule().then(module => {
        if (typeof module === 'function') {
          return module.apply(thisArg, args);
        } else if (typeof module.default === 'function') {
          return module.default.apply(thisArg, args);
        } else {
          throw new Error(`Module ${esmModulePath} is not a function`);
        }
      });
    }
  });
};

/**
 * ESMモジュールをCommonJSフォーマットに変換するヘルパー関数
 * 
 * @param {Object} esmModule - ESMからインポートされたモジュール
 * @return {Object} CommonJS形式に変換されたモジュール
 */
const convertESMtoCJS = (esmModule) => {
  // defaultエクスポートがある場合は、それをメインのエクスポートとして使用
  if (esmModule.default) {
    const converted = typeof esmModule.default === 'function' 
      ? function(...args) { return esmModule.default(...args); }
      : Object.assign({}, esmModule.default);
    
    // 他の名前付きエクスポートも追加
    Object.keys(esmModule).forEach(key => {
      if (key !== 'default') {
        converted[key] = esmModule[key];
      }
    });
    
    return converted;
  }
  
  // defaultエクスポートがない場合はそのまま返す
  return esmModule;
};

module.exports = {
  createESMWrapper,
  createESMProxy,
  convertESMtoCJS
}; 