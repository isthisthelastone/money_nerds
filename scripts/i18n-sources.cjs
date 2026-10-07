/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS tooling, not app code. */
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function loadCatalogs(){
 const files=fs.readdirSync(path.join(root,'src/lib/i18n')).filter(f=>/(?:messages|base)\.ts$/.test(f)&&f!=='messages.ts');
 const catalogs={en:{},es:{},zh:{},ru:{},vi:{}};
 for(const file of files){const exports={};const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/lib/i18n',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('exports','require',code)(exports,()=>({}));for(const value of Object.values(exports)){if(value&&typeof value==='object'&&'es'in value)for(const locale of Object.keys(catalogs))Object.assign(catalogs[locale],value[locale]);}}
 return catalogs;
}
function collect(){
 const sources=new Set();const copyKeys=new Set(['title','description','introduction','shortDescription','label','message','alt']);
 function candidate(s){return /[a-zA-Z]/.test(s)&&!/^https?:|^\/|^mailto:|^#[a-f\d]|@\/|\.(?:ts|tsx|js|png|svg)$/.test(s)&&!/[а-яё一-龯]/i.test(s);}
 function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory()){if(!file.includes('i18n'))walk(file);continue;}if(!/\.tsx?$/.test(file)||file.includes('how-it-works-translations'))continue;const source=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function visit(n){
   if(ts.isCallExpression(n)&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])){const name=n.expression.getText(source);if(name==='t'||['setError','setMessage','setSuccess','invalidateSession'].includes(name))sources.add(n.arguments[0].text);}
   if(ts.isNewExpression(n)&&n.expression.getText(source)==='Error'&&n.arguments?.[0]&&ts.isStringLiteral(n.arguments[0])&&n.arguments[0].text.includes(' '))sources.add(n.arguments[0].text);
   if(ts.isPropertyAssignment(n)&&copyKeys.has(n.name.getText(source).replace(/['"]/g,''))&&ts.isStringLiteral(n.initializer)&&candidate(n.initializer.text))sources.add(n.initializer.text);
   if(ts.isJsxAttribute(n)&&n.name.getText(source)==='text'&&n.initializer&&ts.isStringLiteral(n.initializer))sources.add(n.initializer.text);
   if(file.includes('lib/legal/')&&ts.isStringLiteral(n)&&candidate(n.text)&&(n.text.includes(' ')||ts.isArrayLiteralExpression(n.parent)))sources.add(n.text);
   if(file.endsWith('media/recording.ts')&&ts.isStringLiteral(n)&&candidate(n.text)&&n.text.includes(' '))sources.add(n.text);
   ts.forEachChild(n,visit);
 }visit(source);}}
 walk('src');
 for(const s of ['Fun','Memes','Mutual Aid','Build','Animal Support','Art','Crowdfunding','Other','Anything','SOL, USDC, and USDT on Solana','ETH and USDT on Ethereum (ERC-20)','BTC on Bitcoin','TRX and USDT on TRON (TRC-20)','TON on The Open Network','INJ on Injective'])sources.add(s);
 return [...sources].filter(candidate).sort();
}
module.exports={collect,loadCatalogs};
