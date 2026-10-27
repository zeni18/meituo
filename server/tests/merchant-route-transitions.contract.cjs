'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const kit=fs.readFileSync('public/merchant/ui-kit.js','utf8');
const go=kit.slice(kit.indexOf('  function go(p, e) {'),kit.indexOf('  const token ='));
function navigation(){
 const location=new URL('https://example.test/ai/materials/video?tenant_id=1'),calls=[];
 const current={def:{inPlace:true,match:p=>p.startsWith('/ai/materials/')},root:{isConnected:true}};
 const context={URL,current,location,tenant:()=> '1',withTenant:p=>p.includes('tenant_id=')?p:p+(p.includes('?')?'&':'?')+'tenant_id=1',router:()=>({push:p=>{calls.push(['router',p]);return Promise.resolve();}}),setView:(p,opt)=>{calls.push(['view',p,opt.push]);Object.assign(location,new URL(p,location));},sync:()=>calls.push(['sync']),toast(){}};
 vm.runInNewContext(go+';this.navigate=go;',context);return {context,calls};
}
let n=navigation();n.context.navigate('/ai/materials/voiceover');assert.deepEqual(n.calls.map(c=>c[0]),['view','sync']);assert.equal(n.calls[0][2],true);
n=navigation();n.context.navigate('/ai/assets');assert.equal(n.calls[0][0],'router');
n=navigation();n.context.navigate('/ai/materials/images?tenant_id=2');assert.equal(n.calls[0][0],'router');
n=navigation();n.context.navigate('/ai/materials/video?tenant_id=1');assert.equal(n.calls.length,0);
n=navigation();n.context.navigate('/ai/materials/images',{button:0,ctrlKey:true});assert.equal(n.calls.length,0);

class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attrs={};this.events={};this.parent=null;this.isConnected=true;this.classList={toggle(){},add(){},remove(){}};}
 append(child){child.parent=this;this.children.push(child);}
 insertBefore(child,anchor){child.remove();child.parent=this;const index=this.children.indexOf(anchor);if(index<0)this.children.push(child);else this.children.splice(index,0,child);}
 remove(){if(this.parent){const index=this.parent.children.indexOf(this);if(index>=0)this.parent.children.splice(index,1);this.parent=null;}}
 contains(child){return this===child||this.children.some(c=>c.contains(child));}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,fn){this.events[k]=fn;}
 querySelector(selector){return selector==='.ia-header-spacer'?this.children.find(c=>c.className==='ia-header-spacer'):null;}
 focus(){this.focused=true;}
 click(){return this.events.click?.({});}
}
const header=new Element('header'),spacer=new Element('div');spacer.className='ia-header-spacer';header.append(spacer);
const pushes=[],location={pathname:'/ai/video-editor',search:'?tenant_id=1&mode=onekey',origin:'https://example.test',href:'https://example.test/ai/video-editor?tenant_id=1&mode=onekey'};
const document={documentElement:new Element('html'),createElement:tag=>new Element(tag),querySelector:s=>s==='.ia-header'?header:null,addEventListener(){},getElementById:()=>({__vue_app__:{config:{globalProperties:{$router:{push:p=>{pushes.push(p);return Promise.resolve();}}}}}})};
const context={window:{},document,location,URL,URLSearchParams,history:{pushState(){},replaceState(){}},addEventListener(){},requestAnimationFrame:()=>1,MutationObserver:class{observe(){}},console};
vm.runInNewContext(fs.readFileSync('public/merchant/entries-v2.js','utf8'),context);
const owner=new Element('section'),selected=[],nav=context.window.MerchantClipNavigation;
const bar=nav.bind(owner,'quick',m=>selected.push(m)),buttons=[...bar.children];
assert.deepEqual(buttons.map(b=>b.dataset.key),['quick','mix','storyboard','oral']);
assert.equal(buttons[0].attrs['aria-selected'],'true');assert.equal(buttons[0].tabIndex,0);
assert.equal(nav.bind(owner,'mix',m=>selected.push(m)),bar);assert.deepEqual(bar.children,buttons);assert.equal(buttons[1].attrs['aria-selected'],'true');
buttons[2].click();assert.deepEqual(selected,['storyboard']);
location.pathname='/ai/smart_clip';location.search='?tenant_id=1';nav.release(owner);
assert.ok(header.contains(bar),'oral transition retains the same mode-bar node');assert.equal(buttons[3].attrs['aria-selected'],'true');
assert.equal(header.children.filter(c=>c.dataset.sharedClipModes!==undefined).length,1);
const nextOwner=new Element('section');location.pathname='/ai/video-editor';nav.bind(nextOwner,'storyboard',m=>selected.push(m));nav.release(owner);assert.equal(buttons[2].attrs['aria-selected'],'true','late old cleanup cannot clear current owner');
location.pathname='/ai/materials/video';nav.release(nextOwner);assert.ok(!header.contains(bar),'leaving clipping removes the shared bar');

const material=fs.readFileSync('public/merchant/materials-v2.js','utf8');
const refresh=material.slice(material.indexOf('      let refreshController = null;'),material.indexOf('      /* ---------- actions ---------- */'));
const signals=[],toasts=[];
const refreshScope={AbortController,S:{rows:[],dead:false},skeleton(){},loadMeta:s=>{signals.push(s);return new Promise(resolve=>s.addEventListener('abort',resolve,{once:true}));},load:s=>new Promise(resolve=>s.addEventListener('abort',resolve,{once:true})),UK:{toast:(...a)=>toasts.push(a)}};
vm.runInNewContext(refresh+';this.start=refresh;this.stop=()=>refreshController.abort();',refreshScope);
refreshScope.start();refreshScope.start();assert.equal(signals.length,2);assert.equal(signals[0].aborted,true);assert.equal(signals[1].aborted,false);refreshScope.stop();assert.equal(toasts.length,0);
console.log('PASS merchant transitions: in-place material navigation, history flags, tenant isolation, native fallback, stable shared clip bar, oral-last order, stale cleanup guard, request cancellation.');
