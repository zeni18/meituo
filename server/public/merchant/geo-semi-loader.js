/* Load the production Semi workspace only inside the existing GEO route. */
(() => {
  'use strict';
  let root=null,host=null,dispose=null,pending=null,loading=null,scheduled=false,key='';
  const tenant=()=>new URLSearchParams(location.search).get('tenant_id')||'';
  const href=path=>path+(tenant()?'?tenant_id='+encodeURIComponent(tenant()):'');
  const destinations=[
    ['diagnose','GEO诊断','M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM15 15l6 6M10 7v6M7 10h6'],
    ['website','媒体发布','m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2'],
    ['articles','AI创作','M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 3v4M18 5h4']
  ];
  const parents={diagnose:['diagnose','diagnostic-reports','overview','reports','evidence','query'],website:['website','influencer','website-orders','influencer-orders','website-favorites','influencer-favorites','website-tasks','b2b-sites','b2b-tasks','b2b-records','contacts','accounts','owned-tasks','owned-records','sites','seo-tasks','seo-records','press'],keywords:['keywords','keyword-library','keyword-index','questions','ai-keywords','manual-keywords'],articles:['articles','article-library','materials','images','create','replicate','batch-replicate','search','instructions','categories','brand','jobs','writing-jobs']};
  const pages=['diagnose','diagnostic-reports','overview','reports','evidence','website','influencer','website-orders','influencer-orders','articles','article-library','keywords','questions','materials','images','jobs'];
  function destinationFor(key,back){if(parents.keywords.includes(key))return 'keywords';back=back==='writing-jobs'?'jobs':back;const route=pages.includes(back)?back:key;return Object.keys(parents).find(k=>parents[k].includes(route))||'diagnose';}
  // Views removed in the GEO rebuild (R2): unopened channels land on 发布; geo-v2.js maps the rest (overview, reports, jobs …)
  const retired={optimize:'diagnose','b2b-sites':'website','b2b-tasks':'website','b2b-records':'website',contacts:'website',accounts:'website','owned-tasks':'website','owned-records':'website',sites:'website','seo-tasks':'website','seo-records':'website','website-tasks':'website'};
  function retiredTarget(){const k=location.hash.slice(1).split('?')[0];return location.pathname==='/ai/geo'&&retired[k]?location.pathname+location.search+'#'+retired[k]:'';}
  window.MerchantGeoNavigation={destinations,destinationFor,retiredTarget};
  function mark(path){const span=document.createElement('span');span.className='mw-nav-icon';span.setAttribute('aria-hidden','true');span.innerHTML='<svg viewBox="0 0 24 24" fill="none"><path d="'+path+'" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';return span;}
  function navigation(){
    const nav=document.querySelector('aside .ia-navigation');
    // The native shell may paint before workspace.js finishes downloading.
    // Mount only into the merchant block so the two startup paths cannot interleave.
    const block=nav?.querySelector('[data-merchant-navigation]');if(!block)return;
    let automation=nav.querySelector('[data-automation-link]');
    if(!automation){automation=document.createElement('a');automation.className='mw-nav-link';automation.dataset.automationLink='';automation.title='自动化计划';const label=document.createElement('span');label.className='mw-nav-label';label.textContent='自动化计划';automation.append(mark('M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'),label);}
    if(automation.parentElement!==block)block.insertBefore(automation,block.querySelector('.mw-finished-group'));
    const automationTarget=href('/ai/automation');if(automation.getAttribute('href')!==automationTarget)automation.href=automationTarget;
    automation.classList.toggle('geo-nav-active',location.pathname==='/ai/automation');if(location.pathname==='/ai/automation')automation.setAttribute('aria-current','page');else automation.removeAttribute('aria-current');
    for(const button of nav.querySelectorAll('button'))if(button.textContent.trim()==='GEO营销'&&!button.hasAttribute('data-geo-toggle'))button.classList.add('geo-legacy-navigation');
    let group=nav.querySelector('[data-geo-navigation]');const inGeo=location.pathname==='/ai/geo';
    if(!group){
      group=document.createElement('div');group.dataset.geoNavigation='';group.className='geo-primary-navigation';group.setAttribute('role','group');group.setAttribute('aria-label','GEO营销');
      const toggle=document.createElement('button');toggle.type='button';toggle.className='mw-nav-link geo-parent-toggle';toggle.dataset.geoToggle='';toggle.setAttribute('aria-label','GEO营销');toggle.title='GEO营销';toggle.setAttribute('aria-controls','merchant-geo-subnav');
      const title=document.createElement('span');title.className='mw-nav-label';title.textContent='GEO营销';const chevron=mark('m8 10 4 4 4-4');chevron.classList.add('geo-parent-chevron');toggle.append(mark('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c4 4 4 14 0 18M12 3c-4 4-4 14 0 18'),title,chevron);
      const submenu=document.createElement('nav');submenu.id='merchant-geo-subnav';submenu.className='geo-subnavigation';submenu.setAttribute('aria-label','GEO子页面');
      const expand=open=>{toggle.setAttribute('aria-expanded',String(open));submenu.hidden=!open;group.classList.toggle('is-expanded',open);};
      toggle.addEventListener('click',()=>expand(submenu.hidden));
      toggle.addEventListener('keydown',event=>{if(!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft'].includes(event.key))return;event.preventDefault();if(event.key==='ArrowLeft'){expand(false);return;}expand(true);if(event.key==='ArrowRight')return;const links=[...submenu.querySelectorAll('a')];(event.key==='ArrowUp'?links.at(-1):links.find(a=>a.hasAttribute('aria-current'))||links[0])?.focus({preventScroll:true});});
      for(const [key,label,path] of destinations){const a=document.createElement('a');a.className='geo-primary-link geo-child-link';a.dataset.geoKey=key;a.title=label;const text=document.createElement('span');text.className='mw-nav-label';text.textContent=label;a.append(mark(path),text);submenu.append(a);}
      submenu.addEventListener('keydown',event=>{const links=[...submenu.querySelectorAll('a')],index=links.indexOf(event.target.closest('a'));if(index<0)return;if(event.key==='Escape'){event.preventDefault();expand(false);toggle.focus({preventScroll:true});return;}if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?links.length-1:(index+(event.key==='ArrowDown'?1:links.length-1))%links.length;links[next].focus({preventScroll:true});});
      group.append(toggle,submenu);block.append(group);expand(inGeo);
    }
    if(group.parentElement!==block)block.append(group);
    const toggle=group.querySelector('[data-geo-toggle]'),submenu=group.querySelector('.geo-subnavigation');
    if(inGeo&&group.dataset.geoActive!=='1'){toggle.setAttribute('aria-expanded','true');submenu.hidden=false;group.classList.add('is-expanded');}
    group.dataset.geoActive=inGeo?'1':'0';toggle.classList.toggle('geo-parent-active',inGeo);
    const route=location.hash.slice(1).split('?')[0]||new URLSearchParams(location.search).get('view')||'diagnose',back=new URLSearchParams(location.hash.split('?')[1]||'').get('back'),active=destinationFor(route,back);
    for(const a of group.querySelectorAll('[data-geo-key]')){const p=new URLSearchParams();if(tenant())p.set('tenant_id',tenant());const brand=new URLSearchParams(location.search).get('brand_id');if(brand)p.set('brand_id',brand);const target='/ai/geo'+(p.size?'?'+p:'')+'#'+a.dataset.geoKey;if(a.getAttribute('href')!==target)a.href=target;const selected=inGeo&&a.dataset.geoKey===active;a.classList.toggle('geo-nav-active',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  }
  function assets(){if(window.MerchantGeoSemi)return Promise.resolve();if(loading)return loading;loading=new Promise((resolve,reject)=>{if(!document.querySelector('[data-geo-semi-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/merchant/geo-semi/style.css?v=20261021-capabilities4';css.dataset.geoSemiCss='';document.head.append(css);}const script=document.createElement('script');script.src='/merchant/geo-semi/workspace.js?v=20261021-capabilities4';script.onload=()=>{if(window.MerchantGeoSemi)resolve();else{script.remove();loading=null;reject(Error('GEO页面加载不完整'));}};script.onerror=()=>{script.remove();loading=null;reject(Error('GEO页面加载失败，请重试'));};document.head.append(script);});return loading;}
  window.MerchantGeoAssetLibrary={mount(host){const element=document.createElement('section');element.className='geo-semi geo-main ga-keyword-assets';element.setAttribute('aria-label','资产品牌拓词库');host.append(element);let dead=false,dispose=null;const load=()=>{element.textContent='正在加载拓词库…';assets().then(()=>{if(dead||!element.isConnected)return;element.replaceChildren();dispose=window.MerchantGeoSemi.mountAssetLibrary(element);}).catch(error=>{if(dead)return;element.textContent=error.message;const button=document.createElement('button');button.textContent='重新加载';button.type='button';button.onclick=load;element.append(button);});};element.destroy=()=>{dead=true;dispose?.();element.remove();};load();return element;}};
  function clear(){document.documentElement.classList.remove('geo-standalone','geo-embedded');pending=null;dispose?.();dispose=null;root?.remove();host?.classList.remove('geo-active');root=null;host=null;key='';}
  function check(){if(location.pathname==='/ai/assets'&&new URLSearchParams(location.search).get('finished')==='keyword'){const q=new URLSearchParams(location.search);q.delete('finished');location.replace('/ai/geo'+(q.size?'?'+q:'')+'#keywords');return;}const retired=retiredTarget();if(retired)history.replaceState(null,'',retired);navigation();if(window.UK_OWNS&&window.UK_OWNS()){if(root)clear();return;}if(/^\/app\/aigc_geo(?:\/|$)/.test(location.pathname)){location.replace(href('/ai/geo'));return;}if(!['/ai/geo','/ai/automation'].includes(location.pathname)){if(root)clear();return;}if(root?.isConnected&&key===location.pathname+location.search)return;if(root)clear();host=document.querySelector('main.ia-content');if(!host)return;key=location.pathname+location.search;host.classList.add('geo-active');document.documentElement.classList.remove('geo-standalone');document.documentElement.classList.add('geo-embedded');root=document.createElement('section');root.id='merchant-geo';root.className='geo-semi geo-main semi-always-light';root.setAttribute('aria-label',location.pathname==='/ai/automation'?'自动化计划':'GEO营销工作台');host.append(root);const own=root;pending=own;own.textContent=location.pathname==='/ai/automation'?'正在加载自动化计划…':'正在加载 GEO 工作空间…';assets().then(()=>{if(pending!==own||!own.isConnected)return;own.replaceChildren();dispose=window.MerchantGeoSemi.mount(own);document.title=location.pathname==='/ai/automation'?'自动化计划':'GEO营销';}).catch(e=>{if(pending!==own)return;own.textContent=e.message;const retry=document.createElement('button');retry.textContent='重新加载';retry.type='button';retry.addEventListener('click',()=>{clear();schedule();});own.append(retry);});}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;check();});}
  for(const method of ['pushState','replaceState']){const original=history[method];history[method]=function(...args){const result=original.apply(this,args);schedule();queueMicrotask(()=>dispatchEvent(new Event('geo-route-change')));return result;};}
  document.addEventListener('click',e=>{
    if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    const studio=e.target?.closest?.('aside button');
    const router=document.getElementById('__nuxt')?.__vue_app__?.config?.globalProperties?.$router;
    if(!router?.push)return;
    if(studio?.matches?.('[data-geo-toggle]'))return;
    if(studio?.textContent.trim()==='GEO营销'){
      e.preventDefault();e.stopImmediatePropagation();
      Promise.resolve(router.push(href('/ai/geo'))).catch(error=>console.error('GEO navigation failed',error));
      return;
    }
    const a=e.target?.closest?.('a[href]');
    if(!a||a.hasAttribute('download')||(a.target&&a.target!=='_self'))return;
    const legacy=/^\/app\/aigc_geo(?:[/?]|$)/.test(a.getAttribute('href'));
    if(!legacy&&!a.matches('.gs-suite-back,.gs-suite-footer a,[data-geo-key],[data-automation-link]'))return;
    const url=new URL(a.href,location.href);
    if(url.origin!==location.origin)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(a.matches('[data-geo-key]')&&location.pathname===url.pathname&&location.search===url.search){history.pushState(null,'',url.pathname+url.search+url.hash);return;}
    // Reuse the native session and app instance instead of replaying the startup screen.
    Promise.resolve(router.push(legacy?href('/ai/geo'):url.pathname+url.search+url.hash)).catch(error=>console.error('GEO navigation failed',error));
  },true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});addEventListener('popstate',schedule);document.addEventListener('DOMContentLoaded',schedule);schedule();
})();
