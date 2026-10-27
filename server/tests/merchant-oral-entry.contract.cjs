/* Exercise the production navigation guard; no server or provider is called. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../public/merchant/clip-studio.js'),'utf8');
const begin=source.indexOf('    let oralNavigation=false;'),end=source.indexOf('    async function switchMode(mode){',begin);
assert.ok(begin>=0&&end>begin,'one production oral guard');
const guard=source.slice(begin,end);let passed=0;
function fixture(overrides={},answer=true,search='?tenant_id=7'){
 const calls=[],questions=[],state={dirty:false,busy:false,saving:false,dead:false,...overrides},root={isConnected:true};
 const ctx={state,root,URLSearchParams,encodeURIComponent,location:{search},navigate:route=>calls.push(route),ask:text=>{questions.push(text);return typeof answer==='function'?answer():Promise.resolve(answer);}};
 vm.createContext(ctx);vm.runInContext(guard+';globalThis.goOral=openOralTemplates;',ctx);return {ctx,state,root,calls,questions};
}
(async()=>{
 let f=fixture();await f.ctx.goOral();assert.deepEqual(f.calls,['/ai/smart_clip?tenant_id=7']);passed++;
 f=fixture({dirty:true},false);await f.ctx.goOral();assert.equal(f.calls.length,0);assert.equal(f.state.dirty,true);assert.equal(f.questions.length,1);passed++;
 f=fixture({dirty:true},true);await f.ctx.goOral();assert.equal(f.calls.length,1);assert.equal(f.state.dirty,false);passed++;
 for(const flag of ['busy','saving','dead']){f=fixture({[flag]:true});await f.ctx.goOral();assert.equal(f.calls.length,0);passed++;}
 let resolve;f=fixture({dirty:true},()=>new Promise(r=>resolve=r));let pending=f.ctx.goOral();f.root.isConnected=false;resolve(true);await pending;assert.equal(f.calls.length,0);assert.equal(f.state.dirty,true);passed++;
 f=fixture({dirty:true},()=>new Promise(r=>resolve=r));pending=f.ctx.goOral();await f.ctx.goOral();assert.equal(f.questions.length,1);resolve(true);await pending;assert.equal(f.calls.length,1);passed++;
 f=fixture({},true,'');await f.ctx.goOral();assert.deepEqual(f.calls,['/ai/smart_clip']);passed++;
 console.log('Oral entry: '+passed+' production-guard checks passed (tenant, cancel, confirm, busy/save/dead, stale view, double click).');
})().catch(error=>{console.error(error);process.exitCode=1;});
