/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS tooling, not app code. */
/* One-time bounded mechanical migration. UI syntax only; no DOM rewriting. */
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dirs = ['src/components/features', 'src/components/auth'];
const files = dirs.flatMap(dir => fs.readdirSync(path.join(root,dir), {recursive:true}).filter(f=>f.endsWith('.tsx')).map(f=>dir+'/'+f));
const messages = new Set();
const normalize = s => s.replace(/\s+/g,' ').trim();
for (const file of files) {
 const text = fs.readFileSync(path.join(root,file),'utf8');
 if (text.includes('useI18n')) continue;
 const source = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const edits = [];
 const quote = s => JSON.stringify(s);
 const tr = s => { messages.add(s); return `t(${quote(s)})`; };
 function visible(node) {
   if (ts.isStringLiteral(node) && /[A-Za-z]/.test(node.text)) return tr(node.text);
   if (ts.isTemplateExpression(node)) {
     let key = node.head.text; const args=[];
     node.templateSpans.forEach((span,i)=>{key+=`{value${i}}`+span.literal.text; args.push(`value${i}: ${span.expression.getText(source)}`)});
     if (!/[A-Za-z]/.test(node.head.text+node.templateSpans.map(s=>s.literal.text).join(''))) return node.getText(source);
     messages.add(key); return `t(${quote(key)}, { ${args.join(', ')} })`;
   }
   if (ts.isConditionalExpression(node)) return `${node.condition.getText(source)} ? ${visible(node.whenTrue)} : ${visible(node.whenFalse)}`;
   if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) return `${node.left.getText(source)} ${node.operatorToken.getText(source)} ${visible(node.right)}`;
   if (ts.isIdentifier(node) && ['error','success','message','action'].includes(node.text)) return `t(${node.text})`;
   return node.getText(source);
 }
 const attrs = new Set(['aria-label','aria-valuetext','title','placeholder','alt','label']);
 function visit(node) {
   if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text) && node.body) edits.push([node.body.getStart(source)+1,node.body.getStart(source)+1,'\n  const { locale, t } = useI18n();']);
   if (ts.isJsxText(node)) {
      const raw=node.getText(source), value=normalize(raw);
      if (/[A-Za-z]/.test(value) && !['Phantom','MetaMask','Money Nerds'].includes(value)) {
        const spaceBefore = /^\s/.test(raw) && !/^\s*\n/.test(raw) ? '{" "}' : '';
        const spaceAfter = /\s$/.test(raw) && !/\n\s*$/.test(raw) ? '{" "}' : '';
        edits.push([node.getStart(source),node.end,spaceBefore+'{'+tr(value)+'}'+spaceAfter]);
      }
      return;
   }
   if (ts.isJsxAttribute(node) && attrs.has(node.name.getText(source)) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) { const s=node.initializer.text; if(/[A-Za-z]/.test(s)) edits.push([node.initializer.getStart(source),node.initializer.end,'{'+tr(s)+'}']); return; }
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) { const e=node.initializer.expression; const val=visible(e); if(val!==e.getText(source)) edits.push([e.getStart(source),e.end,val]); return; }
   }
   if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) { const e=node.expression; const val=visible(e); if(val!==e.getText(source)) { edits.push([e.getStart(source),e.end,val]); return; } }
   ts.forEachChild(node,visit);
 }
 visit(source);
 let next=text;
 for (const [start,end,replacement] of edits.sort((a,b)=>b[0]-a[0])) next=next.slice(0,start)+replacement+next.slice(end);
 const importLine='import { useI18n } from "@/components/providers/I18nProvider";\n';
 next = next.startsWith('"use client";') ? next.replace('"use client";','"use client";\n\n'+importLine.trim()) : '"use client";\n\n'+importLine+next;
 fs.writeFileSync(path.join(root,file),next);
}
fs.writeFileSync(path.join(root,'docs/i18n-interactive-strings.json'),JSON.stringify([...messages].sort(),null,2)+'\n');
console.log(`${files.length} components instrumented; ${messages.size} UI phrases extracted.`);
