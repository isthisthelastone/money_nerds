/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS tooling, not app code. */
/* One-time bounded syntax migration for the two remaining English pages. */
const fs=require('node:fs');
const ts=require('typescript');
for (const file of ['src/app/page.tsx','src/app/how-it-works/page.tsx']) {
 const text=fs.readFileSync(file,'utf8');
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const edits=[];
 const quote=JSON.stringify;
 const attrs=new Set(['aria-label','aria-valuetext','title','placeholder','alt','label','introduction']);
 function visible(node) {
   if(ts.isStringLiteral(node)&&/[A-Za-z]/.test(node.text))return `t(${quote(node.text)})`;
   if(ts.isTemplateExpression(node)){
     let key=node.head.text;const args=[];
     node.templateSpans.forEach((span,i)=>{key+=`{value${i}}`+span.literal.text;args.push(`value${i}: ${span.expression.getText(source)}`)});
     if(!/[A-Za-z]/.test(node.head.text+node.templateSpans.map(s=>s.literal.text).join('')))return node.getText(source);
     return `t(${quote(key)}, {${args.join(',')}})`;
   }
   if(ts.isConditionalExpression(node))return `${node.condition.getText(source)} ? ${visible(node.whenTrue)} : ${visible(node.whenFalse)}`;
   return node.getText(source);
 }
 function visit(node){
   if(ts.isJsxText(node)){
     const raw=node.getText(source),s=raw.replace(/\s+/g,' ').trim();
     if(/[A-Za-z]/.test(s)&&!['Money Nerds','SOL'].includes(s))edits.push([node.getStart(source),node.end,(/^\s/.test(raw)&&!/^\s*\n/.test(raw)?'{" "}':'')+`{t(${quote(s)})}`+(/\s$/.test(raw)&&!/\n\s*$/.test(raw)?'{" "}':'')]);
     return;
   }
   if(ts.isJsxAttribute(node)&&attrs.has(node.name.getText(source))&&node.initializer&&ts.isStringLiteral(node.initializer)){
     edits.push([node.initializer.getStart(source),node.initializer.end,`{t(${quote(node.initializer.text)})}`]);return;
   }
   if(ts.isJsxExpression(node)&&node.expression&&!ts.isJsxAttribute(node.parent)){
     const e=node.expression,next=visible(e);if(next!==e.getText(source)){edits.push([e.getStart(source),e.end,next]);return;}
   }
   ts.forEachChild(node,visit);
 }
 visit(source);
 let next=text;for(const [start,end,value]of edits.sort((a,b)=>b[0]-a[0]))next=next.slice(0,start)+value+next.slice(end);
 if(file.endsWith('how-it-works/page.tsx'))next=next.replace('export default function HowItWorksPage() {','export default async function HowItWorksPage() {\n  const t = await getTranslator();\n  const { locale } = await getRequestPreferences();').replace('<GuideLanguages locale="en" />','<GuideLanguages locale={locale} />');
 else next=next.replace('  const params = parseFeedParams(await searchParams);','  const t = await getTranslator();\n  const { locale } = await getRequestPreferences();\n  const params = parseFeedParams(await searchParams);');
 next='import { getTranslator, getRequestPreferences } from "@/lib/i18n/server";\n'+next;
 fs.writeFileSync(file,next);
}
