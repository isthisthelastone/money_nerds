/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS tooling, not app code. */
/* Read-only catalog coverage audit. No browser text mutation and no user data. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const locales = ['en', 'es', 'zh', 'ru', 'vi'];
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('exports', 'require', code)(exports, () => ({}));
  return Object.values(exports).find(value => value && typeof value === 'object' && 'es' in value) || {};
}
const files = fs.readdirSync(path.join(root, 'src/lib/i18n')).filter(f => /(?:messages|base)\.ts$/.test(f) && f !== 'messages.ts');
const catalogs = Object.fromEntries(locales.map(locale => [locale, Object.assign({}, ...files.map(file => load('src/lib/i18n/' + file)[locale] || {}))]));
const usages = new Map();
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(relative); continue; }
    if (!/\.tsx?$/.test(relative) || relative.includes('i18n/')) continue;
    const source = ts.createSourceFile(relative, fs.readFileSync(path.join(root,relative),'utf8'), ts.ScriptTarget.Latest,true,relative.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const value=node.arguments[0].text;
        usages.set(value,[...(usages.get(value)||[]),relative]);
      }
      if (ts.isJsxAttribute(node) && node.name.getText(source)==='text' && node.initializer && ts.isStringLiteral(node.initializer)) usages.set(node.initializer.text,[relative]);
      ts.forEachChild(node,visit);
    }
    visit(source);
  }
}
walk('src');
const missing = [...usages].filter(([key])=>locales.slice(1).some(locale=>!Object.hasOwn(catalogs[locale],key)||!catalogs[locale][key].trim())).sort((a,b)=>a[0].localeCompare(b[0]));
const mismatches=[];
for (const [key] of usages) {
  const parameters=(key.match(/\{\w+\}/g)||[]).sort().join(',');
  for(const locale of locales.slice(1)) {
    const value=catalogs[locale][key];
    if(value && (value.match(/\{\w+\}/g)||[]).sort().join(',')!==parameters) mismatches.push({key,locale});
  }
}
console.log(JSON.stringify({phrases:usages.size, translated:Object.keys(catalogs.es).length, missing:missing.map(([key,locations])=>({key,files:[...new Set(locations)]})), mismatches},null,2));
process.exitCode=missing.length||mismatches.length?1:0;
