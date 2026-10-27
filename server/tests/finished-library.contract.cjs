const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/merchant/finished-library.js','utf8');
function runtime(url='http://localhost:8090/ai/assets?tenant_id=1',saved=null){
  const location=new URL(url),calls=[],queue=[];
  const history={state:saved,replaceState(state,_,target){this.state=state;if(target)location.href=new URL(target,location).href;},pushState(state,_,target){this.state=state;location.href=new URL(target,location).href;}};
  const router={push:path=>calls.push(path)};
  const context={window:{addEventListener(){}},document:{documentElement:{},querySelector:()=>null,addEventListener(){},getElementById:()=>({__vue_app__:{config:{globalProperties:{$router:router}}}})},location,history,URLSearchParams,MutationObserver:class{observe(){}},queueMicrotask:fn=>queue.push(fn)};
  vm.runInNewContext(source,context);return {library:context.window.MerchantFinishedLibrary,history,location,calls};
}
const r=runtime(),url=r.location.href;
r.library.open('video');assert.equal(r.location.href,url);assert.equal(r.calls.length,0,'opening finished contents in assets never invokes a page navigation');assert.equal(r.library.currentKind(),'video');
r.library.open('image_text');assert.equal(r.location.href,url);assert.equal(r.library.currentKind(),'image_text');assert.equal(r.calls.length,0,'switching tabs stays in the same native asset component');
const reload=runtime(url,JSON.parse(JSON.stringify(r.history.state)));assert.equal(reload.library.currentKind(),'image_text','reloading preserves the selected asset category');
reload.library.open('');assert.equal(reload.library.currentKind(),'');assert.equal(reload.location.href,url,'returning to native assets does not navigate either');
assert.equal(runtime(url,JSON.parse(JSON.stringify(reload.history.state))).library.currentKind(),'','the all-assets selection remains cleared on reload');
assert.equal(r.library.href('topic'),'/ai/assets?tenant_id=1&finished=topic','deep links retain the tenant context');
assert.equal(runtime('http://localhost:8090/ai/assets?tenant_id=1&finished=topic').library.currentKind(),'topic');
assert.equal(runtime('http://localhost:8090/ai/assets?tenant_id=2',r.history.state).library.currentKind(),'','view state from another URL / tenant cannot override this category');
for(const bad of ['__proto__','constructor','unknown']){const q=runtime('http://localhost:8090/ai/assets?tenant_id=1&finished='+bad);assert.equal(q.library.currentKind(),'');q.library.open(bad);assert.equal(q.library.currentKind(),'');assert.equal(q.library.href(bad),'/ai/assets?tenant_id=1');}
const outside=runtime('http://localhost:8090/ai/stores?tenant_id=1');outside.library.open('video');assert.deepEqual(outside.calls,['/ai/assets?tenant_id=1&finished=video'],'entry from another page uses the existing SPA route');
const article=runtime();article.library.open('article');assert.equal(article.library.currentKind(),'article');assert.equal(runtime(article.location.href,article.history.state).library.currentKind(),'article','article category survives reload');assert.equal(article.library.href('article'),'/ai/assets?tenant_id=1&finished=article');
console.log('Finished library: in-place switching, reload state, native asset return, tenant URLs and invalid category checks passed.');
const words=runtime();words.library.open('keyword');assert.equal(words.library.currentKind(),'keyword','word library is an asset category');assert.equal(words.library.href('keyword'),'/ai/assets?tenant_id=1&finished=keyword');assert.equal(runtime(words.location.href,words.history.state).library.currentKind(),'keyword','word library selection survives asset refresh');
