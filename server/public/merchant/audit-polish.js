/* Small, scoped repairs to retained native screens. No model or billing state is fabricated. */
(() => {
  'use strict';
  let frame=0;
  const text=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
  const label=(el,value)=>{if(el&&!el.getAttribute('aria-label')&&!el.labels?.length)el.setAttribute('aria-label',value);};
  function run(){
    frame=0;
    const p=location.pathname.replace(/^\/t\/\d+/,'').replace(/\/$/,'');
    const studio=p==='/ai/create'&&document.querySelector('.video-studio');
    if(studio){
      const model=studio.querySelector('.vs-model button');
      const unselected=!!model&&/^(通道选择|请选择.*模型|暂无可用.*模型)$/.test((model.getAttribute('title')||model.textContent).trim());
      if(studio.classList.contains('has-no-model')!==unselected)studio.classList.toggle('has-no-model',unselected);
      const unavailable = !!model && /^暂无可用/.test(model.textContent.trim());
      let notice = studio.querySelector('.audit-model-status');
      if (unavailable && !notice) {
        notice=document.createElement('p');notice.className='audit-model-status';notice.setAttribute('role','status');notice.textContent='视频模型待开通，请联系服务商。';studio.querySelector('.vs-model').append(notice);
      } else if (!unavailable && notice) notice.remove();
      const footer=studio.querySelector('.vs-generate');
      if(footer&&!footer.querySelector('.audit-cost-pending')){
        const status=document.createElement('small');status.className='audit-cost-pending';status.setAttribute('role','status');status.textContent='选择模型后显示费用';footer.prepend(status);
      }
      label(studio.querySelector('textarea'),'创作提示词');
    }
    if(p==='/ai/tools'){
      const sub=document.querySelector('.it-catalog h1')?.nextElementSibling;
      if(sub?.tagName==='P'&&/发现适合你的创作工具/.test(sub.textContent)&&!sub.classList.contains('audit-redundant'))sub.classList.add('audit-redundant');
    }
    const toolRoute=p.startsWith('/ai/tools/');
    if(document.documentElement.classList.contains('audit-tool-route')!==toolRoute)document.documentElement.classList.toggle('audit-tool-route',toolRoute);
    if(!toolRoute)document.querySelectorAll('main[data-audit-busy]').forEach(main=>{main.removeAttribute('aria-busy');delete main.dataset.auditBusy;});
    if(toolRoute){
      const main=document.querySelector('main.ia-content'),loading=!document.querySelector('main .im-tool-cover');
      if(main){
        if(loading&&!main.hasAttribute('aria-busy')){main.setAttribute('aria-busy','true');main.dataset.auditBusy='1';}
        else if(!loading&&main.dataset.auditBusy){main.removeAttribute('aria-busy');delete main.dataset.auditBusy;}
      }
    }
    if(toolRoute || p==='/ai/smart_clip'){
      document.querySelectorAll('main textarea,main input:not([type=file]):not([type=checkbox]):not([type=radio])').forEach(el=>{
        const field=el.closest('.field-block,.form-item');
        const placeholder=el.getAttribute('placeholder')||'';
        const oral=p==='/ai/smart_clip' ? (placeholder.includes('新闻体视频')?'标题':placeholder==='名称'?'身份栏名称':placeholder==='描述'?'身份栏描述':'') : '';
        label(el,oral||field?.querySelector('.field-label,label')?.textContent.trim()||placeholder||'创作参数');
      });
      document.querySelectorAll('main .template-card').forEach((el,i)=>{label(el,'选择场景模板 '+(i+1));el.setAttribute('aria-pressed',String(el.classList.contains('is-active')));});
      document.querySelectorAll('main strong').forEach(fee=>{
        if(fee.previousElementSibling?.textContent.trim()!=='预计消耗')return;
        const bar=fee.parentElement.parentElement,submit=bar.querySelector('button');
        if(!submit)return;
        const zero=/^0(?:\.0+)?$/.test(fee.textContent.replace(/[^\d.]/g,''));
        const pending=submit.disabled&&zero;
        if(bar.classList.contains('audit-estimate-pending')!==pending)bar.classList.toggle('audit-estimate-pending',pending);
        if(pending&&!fee.parentElement.querySelector('.audit-estimate')){
          const note=document.createElement('small');note.className='audit-estimate';note.setAttribute('role','status');note.textContent='待估算';fee.parentElement.append(note);
        }
      });
    }
    if(p==='/ai/avatar'){
      document.querySelectorAll('main textarea,main input:not([type=file])').forEach(el=>label(el,el.getAttribute('placeholder')||'作品名称'));
    }
    // Empty model search has no visible label in the compiled native dialog.
    document.querySelectorAll('[role=dialog] input[type=search],.vs-model-dialog input,.vs-model-modal input').forEach(el=>label(el,'搜索模型'));
    if(document.documentElement.dataset.merchantWhite === 'true') {
      document.querySelectorAll('[aria-label="el.dialog.close"]').forEach(close=>{const title=close.closest('[role=dialog]')?.getAttribute('aria-label')||'窗口';close.setAttribute('aria-label','关闭'+title);});
      const results=document.querySelector('[aria-label="搜索结果"]');
      if(results){
        const seen=new Set();
        results.querySelectorAll('button').forEach(row=>{
          // Read the title node: innerText changes when a duplicate is hidden.
          const title=row.querySelector('strong')?.textContent.trim()||'';
          const clip=['视频剪辑','AI视频剪辑','AI短视频'].includes(title),key=clip?'视频剪辑':title;
          const duplicate=!!key&&seen.has(key);
          if(key)seen.add(key);
          if(row.hasAttribute('data-audit-duplicate')!==duplicate)row.toggleAttribute('data-audit-duplicate',duplicate);
          const description=row.querySelector('small');
          if(clip&&description&&!duplicate)text(description,'选择素材与模板，完成混剪、分镜或口播');
        });
      }
    }
    if(document.documentElement.dataset.merchantWhite === 'true') {
      document.querySelectorAll('.account-menu').forEach(menu => {
        if(!menu.getBoundingClientRect().width)return;
        const nav=menu.querySelector('nav');
        if(nav && ![...nav.querySelectorAll('button')].some(b=>b.textContent.trim()==='会员与充值')) {
          const billing=document.createElement('button');billing.type='button';billing.className='audit-account-billing';billing.innerHTML=(window.UK?.icon('coin')||'')+'<span>会员与充值</span>';
          billing.onclick=()=>{document.querySelector('.ia-account-trigger')?.click();window.UK?.openRecharge();};nav.prepend(billing);
        }
        const mobile=[...menu.querySelectorAll('nav button')].find(b=>b.textContent.trim().startsWith('手机端'));
        if(mobile&&!mobile.disabled){mobile.disabled=true;mobile.setAttribute('aria-label','手机端，即将上线');const hint=document.createElement('small');hint.className='audit-soon';hint.textContent='即将上线';mobile.append(hint);}
      });
    }
    if(p==='/ai/seedcards'){
      const empty=document.querySelector('#merchant-workspace .mw-empty');
      if(empty&&/暂无记录/.test(empty.textContent))text(empty,'还没有种草卡');
    }
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(run);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('popstate',schedule);document.addEventListener('uk:navigate',schedule);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
