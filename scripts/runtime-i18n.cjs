/* Focused runtime checks. No accounts, public posts or transfers are created. */
const base = process.argv[2] || "http://localhost:3001";
function check(value, message) { if (!value) throw new Error(message); }
async function get(path, options) {
 const response = await fetch(new URL(path,base), {...options,signal:AbortSignal.timeout(20000)});
 return {response, html:await response.text()};
}
(async()=>{
 for(const locale of ['en','es','zh','ru','vi']) {
   const {response,html}=await get('/?ui='+locale);
   check(response.status===200,locale+' homepage failed');
   check(html.includes(`lang="${locale==='zh'?'zh-Hans':locale}"`),locale+' wrong HTML language');
   check(html.includes('name="language"'),locale+' language filter missing');
   check(html.includes('value="50"'),locale+' page sizes missing');
   console.log(locale+' homepage/metadata/filters: PASS');
 }
 for(const path of ['/legal','/legal/privacy','/legal/terms','/legal/cookies','/legal/regions?country=US','/legal/regions?country=RU','/legal/regions?country=SG','/legal/regions?country=MY','/legal/regions?country=DE','/legal/report','/vi/how-it-works','/settings','/u/BqzLRNsHraeahvfppDs9QmRDdYx3gUYt69pgA6UR9GQg','/?language=ru&size=25','/?language=untagged&size=50']){
   const {response,html}=await get(path,{headers:{'Accept-Language':'es-ES, en;q=0.5'}});
   check(response.status===200,path+' failed '+response.status);check(!html.includes('NEXT_HTTP_ERROR_FALLBACK;500'),path+' server error');console.log(path+': PASS');
 }
 const options={method:'PATCH',headers:{'Origin':base,'Content-Type':'application/json'},body:JSON.stringify({locale:'ru'})};
 const saved=(await get('/api/settings/preferences',options)).response;
 check(saved.status===200,'Guest preferences failed');check((saved.headers.get('set-cookie')||'').includes('mn_locale=ru'),'Locale cookie missing');
 const persisted=await get('/about',{headers:{cookie:'mn_locale=ru'}});check(persisted.html.includes('lang="ru"'),'Cookie persistence failed');
 const invalid=(await get('/api/settings/preferences',{...options,body:JSON.stringify({locale:'invalid'})})).response;check(invalid.status===400,'Invalid locale accepted');
 const foreign=(await get('/api/settings/preferences',{...options,headers:{...options.headers,Origin:'https://unrelated.example'}})).response;check(foreign.status===403,'Origin check failed');
 console.log('Preference validation, origin check, cookie persistence: PASS');
 for(const choice of ['all','necessary']) {
   const {response}=await get('/api/settings/privacy',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({choice})});
   const cookie=response.headers.get('set-cookie')||'';check(response.status===200&&cookie.includes('mn_privacy=v1.'+choice),'Privacy choice failed');
   if(choice==='necessary')check(cookie.includes('mn_viewer=;'),'Viewer revocation failed');
 }
 const gpc=await get('/api/settings/privacy',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','Sec-GPC':'1'},body:JSON.stringify({choice:'all'})});check(gpc.html.includes('necessary'),'GPC ignored');
 const view=(await get('/api/posts/102/view',{method:'POST',headers:{Origin:base,Cookie:'mn_privacy=v1.necessary'}})).response;check(view.status===204,'View tracking ran without consent');check(!view.headers.get('set-cookie'),'Unconsented tracking set a cookie');
 console.log('Consent/refusal/revocation/GPC/unconsented view endpoint: PASS');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
