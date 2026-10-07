/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS tooling, not app code. */
/* One-time public-copy translation aid. Saves nothing; root applies reviewed results.
   Only interface text is sent. Never posts, profile data, credentials or source code.
   Catalogs are deployed locally; there is no translation request at runtime. */
const {collect,loadCatalogs}=require('./i18n-sources.cjs');
const locale=process.argv[2];if(!['es','zh','ru','vi'].includes(locale))throw new Error('Pass one locale');
const existing=loadCatalogs()[locale];const sources=collect().filter(key=>!Object.hasOwn(existing,key));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function translate(batch){
 const slots=[];
 const protect=s=>s.replace(/Money Nerds|\{\w+\}/g,value=>{const id=slots.push(value)-1;return `ZXPH${id}ZX`;});
 const q=batch.map((key,i)=>`[[MNI${i}]] ${protect(key)}`).join('\n');
 const url=new URL('https://translate.googleapis.com/translate_a/single');for(const [k,v]of Object.entries({client:'gtx',sl:'en',tl:locale==='zh'?'zh-CN':locale,dt:'t',q}))url.searchParams.set(k,v);
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`Translation response ${response.status}`);
 const data=await response.json();const text=data[0].map(item=>item[0]||'').join('');
 const chunks=[...text.matchAll(/\[\[\s*MNI\s*(\d+)\s*\]\]\s*([\s\S]*?)(?=\[\[\s*MNI|$)/gi)];
 if(chunks.length!==batch.length)throw new Error('Translation markers changed');
 const out={};for(const chunk of chunks){const index=Number(chunk[1]);let value=chunk[2].trim().replace(/ZXPH\s*(\d+)\s*ZX/gi,(_,i)=>slots[Number(i)]);const key=batch[index];if(!key||/ZXPH/i.test(value))throw new Error('Unrestored placeholder');if((value.match(/\{\w+\}/g)||[]).sort().join()!==(key.match(/\{\w+\}/g)||[]).sort().join())throw new Error('Placeholder mismatch');out[key]=value;}
 return out;
}
(async()=>{let batch=[],length=0,count=0;const result={};
 for(const key of [...sources,null]){if(key===null||length+(key?.length||0)>3500){if(batch.length){let output;try{output=await translate(batch);}catch(error){if(batch.length===1)throw error;output={};for(const item of batch){Object.assign(output,await translate([item]));await sleep(300);}}
 Object.assign(result,Object.fromEntries(Object.entries(output).map(([key,value])=>[sources.indexOf(key),value])));count+=batch.length;console.error(JSON.stringify({locale,progress:count}));await sleep(400);batch=[];length=0;}if(key===null)break;}
 batch.push(key);length+=key.length+20;}
 console.log(JSON.stringify({locale,messages:result,count,done:true}));})().catch(error=>{console.error(error.message);process.exitCode=1;});
