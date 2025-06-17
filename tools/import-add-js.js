module.exports = function (file, api) {
  const j = api.jscodeshift;
  return j(file.source)
    .find(j.ImportDeclaration)
    .filter(
      (p) =>
        /^\.{1,2}\//.test(p.value.source.value) && // 相対パス
        !p.value.source.value.endsWith('.js')
    ) // 末尾 .js 無し
    .forEach((p) => (p.value.source.value += '.js'))
    .toSource();
};
