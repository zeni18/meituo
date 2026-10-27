const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/_nuxt/entry.ef871ac3.js','utf8');
const implementation=source.split('/* merchant-css-preload-v3 */')[1]?.split('/* /merchant-css-preload-v3 */')[0];
assert.ok(implementation,'production CSS preloader is marked for contract tests');
function harness(){
 const links=[],created=[];
 class Link{
  constructor(){this.events={};this.sheet=null;}
  addEventListener(type,fn){this.events[type]=fn;}
  emit(type){if(type==='load')this.sheet={};this.events[type]?.();}
  remove(){const i=links.indexOf(this);if(i>=0)links.splice(i,1);}
 }
 const document={getElementsByTagName(){return links;},createElement(){return new Link();},head:{appendChild(link){links.push(link);created.push(link);}}};
 const scope={document,URL};vm.runInNewContext('const cz="modulepreload",uz=(value,base)=>new URL(value,base).href,Z2={};let '+implementation+';this.preload=dz;',scope);
 return {run:fn=>scope.preload(fn,['./shared.css'],'http://127.0.0.1:8090/_nuxt/page.js'),links,created,Link,scope};
}
(async()=>{
 let h=harness(),imports=0;
 const first=h.run(()=>++imports),second=h.run(()=>++imports);
 assert.equal(h.created.length,1,'concurrent views share one stylesheet request');assert.equal(imports,0,'neither view imports before the stylesheet loads');
 h.created[0].emit('load');await Promise.all([first,second]);assert.equal(imports,2,'both views proceed after the same load');
 await h.run(()=>++imports);assert.equal(h.created.length,1,'already loaded shared CSS is not requested again');
 h=harness();imports=0;const recovered=h.run(()=>++imports);h.created[0].emit('error');
 assert.equal(h.created.length,2,'a transient style failure retries once');assert.ok(h.created[1].href.endsWith('mw_css_retry=1'),'retry bypasses a failed cached response');assert.equal(imports,0,'view waits through the retry');
 h.created[1].emit('load');await recovered;assert.equal(imports,1,'recovered CSS permits the requested view to open');
 h=harness();imports=0;const failed=h.run(()=>++imports);const rejection=assert.rejects(failed,/Unable to preload CSS/);h.created[0].emit('error');h.created[1].emit('error');await rejection;
 assert.equal(h.created.length,2,'persistent failure does not retry indefinitely');assert.equal(imports,0,'a failed stylesheet never counts as loaded');
 const retry=h.run(()=>++imports);assert.equal(h.created.length,3,'failed cache entry is cleared for the next navigation');h.created[2].emit('load');await retry;assert.equal(imports,1);
 h=harness();const existing=new h.Link();existing.rel='stylesheet';existing.href='http://127.0.0.1:8090/_nuxt/shared.css';existing.sheet={};h.links.push(existing);await h.run(()=>true);assert.equal(h.created.length,0,'ready document-owned styles are reused');
 console.log('Merchant CSS preload: shared waiting, bounded retry, failure eviction and loaded-style reuse passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
