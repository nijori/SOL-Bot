/**
 * jscodeshift transform:
 *  - import source が ".js.js" なら ".js" に置き換え
 *  - それ以外の相対パスで .js が付いていなければ、末尾に ".js" を追加
 */
const parser = require('@babel/parser');

module.exports = function(file, api) {
  const j = api.jscodeshift.withParser({
    parse(source) {
      return parser.parse(source, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'classProperties',
          'decorators-legacy',
        ],
      });
    }
  });

  return j(file.source)
    .find(j.ImportDeclaration)
    .filter(p =>
      /^\.{1,2}\//.test(p.value.source.value) &&     // 相対パス
      !p.value.source.value.endsWith('.js')          // 末尾に .js がないものだけ
    )
    .forEach(p => {
      p.value.source.value += '.js';
    })
    .toSource({ quote: 'single' });
}; 