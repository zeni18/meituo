/* One finished-content workspace, embedded in the native asset page.
   Video references and text/topic folders retain their existing scoped IDs. */
(() => {
  'use strict';
  const types=Object.freeze({video:'成片库',image_text:'图文库',topic:'话题库',article:'文章库',keyword:'拓词库'}),valid=kind=>Object.prototype.hasOwnProperty.call(types,kind),node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const params=()=>new URLSearchParams(location.search),client=()=>document.getElementById('__nuxt')?.__vue_app__?.config?.globalProperties?.$router;
  const href=kind=>{const q=new URLSearchParams(),tenant=params().get('tenant_id');if(tenant)q.set('tenant_id',tenant);if(valid(kind))q.set('finished',kind);return '/ai/assets'+(q.size?'?'+q:'');};
  let localKind=null,lastLocation=location.href;
  function currentKind(){
    if(lastLocation!==location.href){lastLocation=location.href;localKind=null;}
    if(location.pathname!=='/ai/assets')return '';
    const saved=history.state?.merchantFinished;
    const kind=localKind??(saved?.href===location.href?saved.kind:params().get('finished'))??'';return valid(kind)?kind:'';
  }
  function open(kind){
    if(location.pathname!=='/ai/assets'){client()?.push(href(kind));return;}
    localKind=valid(kind)?kind:'';lastLocation=location.href;
    history.replaceState({...history.state,merchantFinished:{href:location.href,kind:localKind}},'',location.href);check();
  }
  const navigate=kind=>open(kind);
  const api=async(action,values={},body,controller='merchantWorkspace')=>{
    const q=new URLSearchParams(values),tenant=params().get('tenant_id');if(tenant)q.set('tenant_id',tenant);
    const response=await fetch('/api/'+controller+'/'+action+'?'+q,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),result=await response.json();
    if(result.code!==1)throw Error(result.msg||'成片库读取失败，请重试');return result.data;
  };
  function mount(host,kind){
    const root=node('section','mf-collection');root.setAttribute('aria-label','AI成品库');const tabs=node('div','mf-collection-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','成片内容类型');const content=node('div','mf-collection-content');root.append(tabs,content);host.append(root);let child=null,current='';
    for(const [key,label]of Object.entries(types)){const b=node('button','mf-collection-tab',label);b.type='button';b.setAttribute('role','tab');b.dataset.finishedKind=key;b.addEventListener('click',()=>navigate(key));tabs.append(b);}
    const show=type=>{
      if(!valid(type))type='video';if(current===type)return;current=type;child?.destroy?.();content.replaceChildren();content.classList.remove('ml-library-host');
      for(const b of tabs.children){const selected=b.dataset.finishedKind===type;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;}
      tabs.hidden=true;child=type==='keyword'?window.MerchantGeoAssetLibrary.mount(content):type==='article'?window.MerchantArticleLibrary.mount(content,{api,navigate:path=>client()?.push(path)}):window.MerchantFinishedCatalog.mount(content,{kind:type,api:(a,p,b,c='merchantPublishing')=>api(a,p,b,c),navigate:path=>client()?.push(path)});
    };
    tabs.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const keys=Object.keys(types),index=keys.indexOf(current),next=event.key==='Home'?0:event.key==='End'?keys.length-1:(index+(event.key==='ArrowRight'?1:keys.length-1))%keys.length;navigate(keys[next]);tabs.children[next].focus();
    });
    root.setKind=show;root.destroy=()=>{child?.destroy?.();child=null;root.remove();};show(kind);return root;
  }
  let asset=null,pane=null,tabs=null,contents=null,scheduled=false;
  function close(){pane?.destroy?.();pane=null;asset?.classList.remove('mf-inline-active');}
  function check(){
    if(window.UK_OWNS&&window.UK_OWNS()){if(asset||pane||tabs||contents){close();tabs?.remove();contents?.destroy?.();contents=null;asset=null;tabs=null;}return;} // page rebuilt on ui-kit (assets-v2.js)
    const next=location.pathname==='/ai/assets'?document.querySelector('.asset-library'):null;
    if(asset!==next){close();tabs?.remove();contents?.destroy?.();contents=null;asset=next;tabs=null;}
    if(!asset)return;const main=asset.querySelector('.al-main');if(!main)return;
    if(!tabs?.isConnected){
      tabs=node('nav','mf-hub-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','资产内容分类');
      for(const [key,label] of [['','全部作品'],['video','成片'],['image_text','图文'],['article','文章']]){
        const tab=node('button','mf-hub-tab',label);tab.type='button';tab.setAttribute('role','tab');tab.dataset.finishedKind=key;
        tab.addEventListener('click',()=>open(key));tabs.append(tab);
      }
      tabs.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...tabs.children],i=buttons.findIndex(b=>b.dataset.finishedKind===currentKind()),index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:buttons.length-1))%buttons.length;
        open(buttons[index].dataset.finishedKind);buttons[index].focus({preventScroll:true});
      });
      main.prepend(tabs);
    }
    asset.querySelector('.mf-assets-entry')?.remove();
    const scroll=main.querySelector('.al-scroll');
    if(scroll&&!contents?.isConnected&&window.MerchantAssetContents){contents?.destroy?.();contents=window.MerchantAssetContents.mount(scroll,{api,open,navigate:path=>client()?.push(path)});}
    if(contents){const all=asset.querySelector('.al-navigation>button');contents.setVisible(!currentKind()&&Boolean(all?.classList.contains('active')));}

    const kind=currentKind();for(const tab of tabs.children){const active=tab.dataset.finishedKind===kind;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
    asset.classList.toggle('mf-inline-active',valid(kind));
    if(!valid(kind)){if(pane)pane.hidden=true;return;}
    if(!pane?.isConnected){pane?.destroy?.();pane=mount(main,kind);pane.classList.add('mf-inline-finished');}else pane.setKind(kind);
    pane.hidden=false;
  }
  const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;check();});};
  window.MerchantFinishedLibrary={types,href,mount,open,currentKind};
  for(const method of ['pushState','replaceState']){const original=history[method];history[method]=function(...args){const result=original.apply(this,args);schedule();return result;};}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('popstate',schedule);document.addEventListener('DOMContentLoaded',check);check();
})();
