/* Merchant UI v2 — entry consolidation (approved list, 2026-10-20).
   - AI 工具 page: remove duplicate cards and the non-AI "门店营销" section.
   - 视频剪辑: one entry; both editors get a shared title and a mode switch.
   Original pages and routes are untouched. Spec: docs/merchant-ui-v2.md */
(() => {
  'use strict';
  const tenant = () => { const v = new URLSearchParams(location.search).get('tenant_id'); return v && /^\d+$/.test(v) ? v : ''; };
  const withTenant = (p) => p + (tenant() ? (p.includes('?') ? '&' : '?') + 'tenant_id=' + tenant() : '');
  const router = () => document.getElementById('__nuxt')?.__vue_app__?.config?.globalProperties?.$router;
  const path = () => location.pathname.replace(/^\/t\/\d+/, '');
  const push = (p) => { const r = router(); if (r) r.push(withTenant(p)); else location.href = withTenant(p); };

  /* ---------- AI 工具 ---------- */
  const HIDE_TOOLS = new Set(['视频生成', '图片生成', '图片数字人', '全驱数字人', 'GEO营销优化系统']);
  const RENAME_TOOLS = { '数字人视频': '数字人', 'AI短视频': '视频剪辑', 'AI视频剪辑': '视频剪辑' };
  const TOOL_DETAILS = {
    '视频剪辑': '选择素材与模板，完成混剪、分镜或口播',
    '数字人': '组合形象、音色与文案，制作讲解视频',
    'AI音乐生成': '从歌词或参考音频创作音乐',
    '无限画布': '在画布中编排多节点创作流程',
    'AIGC 对话': '支持上下文的多轮 AI 对话',
    'AI短剧': '从剧本、分镜到短剧成片',
    '动作迁移': '把参考视频的动作迁移到人物图片',
    '动作替换': '将视频中的人物替换为指定形象',
    '音乐翻唱': '用参考音色重新演唱歌曲',
    '短视频去水印': '解析分享链接，获取无水印视频',
    '局部重绘': '选择区域，按提示词修改图片',
    '无缝扩图': '向画面外延展，自然补全背景',
    '图片风格化': '按风格模板转换图片',
    '图片去背景': '提取主体，导出透明背景图片',
    '图片翻译': '翻译画面文字并保留原有排版',
    '一键消除': '清理图片中的文字、贴纸和杂物',
    'AI换发型': '用参考发型预览人物造型',
    '老照片修复': '修复老照片，恢复清晰度与细节',
    'AI试衣': '将服装图片穿到选定模特身上',
    'AI商品图': '为商品搭配场景，制作展示图片',
    '模特穿戴': '组合模特与穿戴物，制作效果图',
    'AI商品套图': '用一张商品图生成多张场景图',
    '服饰套图': '组合服饰与模特，制作陈列套图',
    '商品多角度': '补充商品正面、侧面等展示视角',
    '产品宣传视频': '将产品图片与脚本制成宣传视频'
  };
  const TOOL_COVERS = { '视频剪辑': 'clip', '数字人': 'avatar', 'AI商品图': 'product', '模特穿戴': 'wear' };
  function tools() {
    if (path().replace(/\/$/, '') !== '/ai/tools') return;
    const catalog = document.querySelector('.it-catalog');
    if (!catalog) return;
    catalog.querySelectorAll('section.mw-marketing-section').forEach((s) => s.classList.add('v2-hidden'));
    catalog.querySelectorAll('[data-merchant-category]').forEach((b) => b.classList.add('v2-hidden'));
    const seen = new Set();
    catalog.querySelectorAll('a.it-card').forEach((card) => {
      const h = card.querySelector('.it-card-body h3');
      if (!h) return;
      const name = h.dataset.v2Name || h.textContent.trim();
      h.dataset.v2Name = name;
      const section = card.closest('section')?.querySelector('h2')?.textContent.trim() || '';
      const key = section + '|' + (RENAME_TOOLS[name] || name);
      const dup = seen.has(key);
      seen.add(key);
      card.classList.toggle('v2-hidden', HIDE_TOOLS.has(name) || dup);
      if (RENAME_TOOLS[name] && h.textContent !== RENAME_TOOLS[name]) h.textContent = RENAME_TOOLS[name];
      const title = RENAME_TOOLS[name] || name, detail = card.querySelector('.it-card-body p');
      if (detail && TOOL_DETAILS[title] && detail.textContent !== TOOL_DETAILS[title]) detail.textContent = TOOL_DETAILS[title];
      const cover = TOOL_COVERS[title], image = card.querySelector('.it-image img');
      card.classList.toggle('audit-tool-featured', !!cover);
      if (cover && image) {
        const src = '/merchant/design-assets/v2/tool-' + cover + '.webp';
        if (image.getAttribute('src') !== src) image.setAttribute('src', src);
      }

      if ((name === 'AI短视频' || name === '视频剪辑' || /\/ai\/smart_clip(?:[?#]|$)/.test(card.getAttribute('href') || '')) && !card.dataset.v2Clip) {
        card.dataset.v2Clip = '1'; card.href = withTenant('/ai/video-editor');
        card.addEventListener('click', (e) => { if (e.button || e.ctrlKey || e.metaKey) return; e.preventDefault(); e.stopImmediatePropagation(); push('/ai/video-editor'); }, true);
      }
    });
    // A section left without visible cards is hidden too.
    catalog.querySelectorAll('section.it-section').forEach((s) => {
      const any = [...s.querySelectorAll('a.it-card')].some((c) => !c.classList.contains('v2-hidden'));
      s.classList.toggle('v2-hidden', !any);
      const heading = s.querySelector('h2'), count = [...s.querySelectorAll('a.it-card:not(.v2-hidden)')].length;
      if (heading && heading.dataset.auditCount !== String(count)) heading.dataset.auditCount = String(count);
      s.querySelectorAll('.it-grid').forEach((grid) => { if (grid.getAttribute('tabindex') !== '-1') grid.setAttribute('tabindex', '-1'); });

    });
  }

  /* ---------- 视频剪辑 ---------- */
  // One editor, one mode bar. 一键成片 / 批量混剪 / 分镜脚本 live in clip-studio.js on /ai/video-editor;
  // 口播 is the native smart_clip page, which gets the same mode bar injected above its content.
  const CLIP_MODES = [
    { key: 'quick', label: '一键成片' },
    { key: 'mix', label: '批量混剪' },
    { key: 'storyboard', label: '分镜脚本' },
    { key: 'oral', label: '口播' }
  ];
  let clipModeOwner=null,clipModeBar=null;
  const clipRoute=()=>/^\/ai\/(?:video-editor|smart_clip)\/?$/.test(path());
  function selectedClipMode(){
    if(onOral())return 'oral';
    if(clipModeOwner?.owner.isConnected)return clipModeOwner.mode;
    const mode=new URLSearchParams(location.search).get('mode');
    return ({onekey:'quick',batch:'mix',script:'storyboard',oral:'oral'})[mode]||CLIP_MODES.find(m=>m.key===mode)?.key||'quick';
  }
  function selectClipMode(mode){
    if(mode===selectedClipMode())return;
    const target=mode==='oral'?'/ai/smart_clip':'/ai/video-editor?mode='+({quick:'onekey',mix:'batch',storyboard:'script'})[mode];
    if(onOral())void leaveOral(target);
    else if(clipModeOwner?.owner.isConnected)void clipModeOwner.select(mode);
    else push(target);
  }
  function syncClipModes(){
    const active=clipRoute(),header=document.querySelector('.ia-header');
    document.documentElement.classList.toggle('v2-clip-page',active);
    if(!active){clipModeBar?.remove();clipModeBar=null;clipModeOwner=null;return null;}
    if(!header)return null;
    if(!clipModeBar||!header.contains(clipModeBar)){
      clipModeBar?.remove();clipModeBar=document.createElement('div');clipModeBar.className='mc-modes mc-approved-modes';clipModeBar.dataset.sharedClipModes='';
      clipModeBar.setAttribute('role','tablist');clipModeBar.setAttribute('aria-label','剪辑模式');
      CLIP_MODES.forEach(mode=>{const tab=document.createElement('button');tab.type='button';tab.className='mc-mode';tab.dataset.key=mode.key;tab.textContent=mode.label;tab.setAttribute('role','tab');tab.addEventListener('click',()=>selectClipMode(mode.key));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...clipModeBar.children],index=tabs.indexOf(tab),next=tabs[event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowLeft'?tabs.length-1:1))%tabs.length];next.focus();next.click();});clipModeBar.append(tab);});
      header.insertBefore(clipModeBar,header.querySelector('.ia-header-spacer'));
    }
    const selected=selectedClipMode();
    [...clipModeBar.children].forEach(tab=>{const on=tab.dataset.key===selected;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;});
    return clipModeBar;
  }
  window.MerchantClipNavigation={
    bind(owner,mode,select){clipModeOwner={owner,mode:mode==='script'?'oral':mode,select};return syncClipModes();},
    release(owner){if(clipModeOwner?.owner===owner)clipModeOwner=null;syncClipModes();}
  };
  // The native sidebar toggle owns this preference; entering or leaving an editor never changes it.
  let oralRoot=null,oralDirty=false,oralLeaving=false;
  const onOral=()=>path().replace(/\/$/,'')==='/ai/smart_clip';
  function noteOralChange(event){if(onOral()&&oralRoot?.contains(event.target))oralDirty=true;}
  document.addEventListener('input',noteOralChange,true);
  document.addEventListener('change',noteOralChange,true);
  async function leaveOral(target){
    if(oralLeaving)return;
    oralLeaving=true;
    const current=oralRoot;
    try{
      if(oralDirty){
        if(!window.UK?.confirm)return;
        const allowed=await window.UK.confirm({title:'口播设置尚未提交',text:'当前填写的口播内容尚未提交，离开后不会保留。',cancelText:'继续编辑',okText:'放弃并切换',danger:true});
        if(!allowed||!onOral()||oralRoot!==current)return;
      }
      oralDirty=false;
      const next=new URL(target,location.origin),t=tenant();
      if(t)next.searchParams.set('tenant_id',t);
      const destination=next.pathname+next.search+next.hash,r=router();
      if(r)await r.push(destination);else location.href=destination;
    }finally{oralLeaving=false;}
  }
  // Protect the native form when leaving through the sidebar as well as its mode bar.
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href]');
    if(!onOral()||!oralDirty||!link||event.defaultPrevented||event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('download'))return;
    const next=new URL(link.href,location.href);
    if(next.origin!==location.origin||next.pathname===location.pathname)return;
    event.preventDefault();event.stopImmediatePropagation();leaveOral(next.pathname+next.search+next.hash);
  },true);
  function labelOralRules(form){
    const duration=form.querySelector('input[role="spinbutton"][min="5"][max="300"]');
    if(!duration){form.querySelectorAll('.v2-oral-rule-labels').forEach(label=>label.remove());return;}
    duration.setAttribute('aria-label','视频时长（秒）');
    const control=duration.closest('.el-input-number'),row=control?.closest('.two-grid');
    if(!row)return;
    if(!row.previousElementSibling?.classList.contains('v2-oral-rule-labels')){
      const labels=document.createElement('div');labels.className='v2-oral-rule-labels';
      const title=document.createElement('label');title.htmlFor=duration.id;title.textContent='视频时长（秒）';
      const order=document.createElement('span');order.textContent='素材排列';order.id=duration.id+'-order';labels.append(title,order);row.before(labels);
      row.querySelector('[role="group"]')?.setAttribute('aria-labelledby',order.id);
    }
    const less=control.querySelector('.el-input-number__decrease'),more=control.querySelector('.el-input-number__increase');
    less?.setAttribute('aria-label','减少视频时长');more?.setAttribute('aria-label','增加视频时长');
  }
  function oralBar() {
    const form=document.querySelector('.smart-clip-page'),main=form?.parentElement;
    const existing=document.querySelector('.v2-oral-top');
    if(!onOral()||!main){existing?.remove();oralRoot=null;oralDirty=false;return;}
    if(oralRoot!==form){oralRoot=form;oralDirty=false;}
    labelOralRules(form);
    if(existing&&main.contains(existing))return;
    existing?.remove();
    const bar=document.createElement('div');bar.className='v2-oral-top';
    bar.innerHTML='<button type="button" class="v2-oral-script" data-oral-script>文案与分镜 <span aria-hidden="true">→</span></button>';
    bar.addEventListener('click',event=>{
      if(event.target.closest('[data-oral-script]')){leaveOral('/ai/video-editor?mode=oral');return;}
      const button=event.target.closest('button[data-key]');
      if(button&&button.dataset.key!=='oral')leaveOral('/ai/video-editor?mode='+button.dataset.key);
    });
    main.prepend(bar);
  }
  function clip() {
    const p = path();
    const onClip = p.startsWith('/ai/video-editor') || p.startsWith('/ai/smart_clip');
    const header = document.querySelector('.ia-header');
    const existing = document.querySelector('.v2-clip-head');
    syncClipModes();
    oralBar();
    if (!onClip || !header) { existing?.remove(); document.documentElement.classList.remove('v2-clip-page'); return; }
    document.documentElement.classList.add('v2-clip-page');
    if(header.querySelector('.uk-crumb')){existing?.remove();return;}
    if (!existing || !header.contains(existing)) {
      existing?.remove();
      const head = document.createElement('div');
      head.className = 'v2-clip-head';
      head.innerHTML = '<h1 class="v2-page-title">视频剪辑</h1>';
      const spacer = header.querySelector('.ia-header-spacer');
      header.insertBefore(head, spacer || header.firstChild);
    }
  }

  let timer = 0;
  function run() { if(timer)return;timer=requestAnimationFrame(() => {timer=0;try { tools(); clip(); } catch (e) { console.warn('[entries-v2]', e); }}); }
  ['pushState', 'replaceState'].forEach((m) => { const o = history[m]; history[m] = function () { const r = o.apply(this, arguments); run(); return r; }; });
  addEventListener('popstate', run);
  new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true });
  run();
})();
