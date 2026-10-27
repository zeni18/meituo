/* Platform-owned Haipress settings, embedded in the shared capability shell. */
(() => {
  'use strict';
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
  async function api(action,body){
    let token='';try{token=JSON.parse(localStorage.getItem('__like_admin_saas_platform__token')||'null')?.value||'';}catch{}
    const response=await fetch('/platformapi/media.press/'+action,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    const result=await response.json();if(result.code!==1)throw Error(result.msg||'海讯社配置操作失败');return result.data;
  }
  function mountConfig(container,options={}){
    const own=node('section','ci-press-panel'),error=node('p','ci-error'),status=node('p','ci-muted');
    error.setAttribute('role','alert');status.setAttribute('role','status');status.setAttribute('aria-live','polite');container.append(own);
    let data=options.data,pending=false,sequence=0,syncTimer=0,syncSequence=0,tracker=null;
    const button=(text,work,primary=false)=>{const b=node('button','ci-button'+(primary?' ci-primary':''),text);b.type='button';b.addEventListener('click',()=>Promise.resolve().then(work).catch(e=>{if(own.isConnected)error.textContent=e.message;}));return b;};
    const field=(name,label,type='text',value='')=>{const wrap=node('label','ci-field'),input=node('input');input.name=name;input.type=type;input.value=value;wrap.append(node('span','',label),input);return wrap;};
    async function busy(work){if(pending)return;pending=true;options.onBusy?.(true);own.inert=true;error.textContent='';try{await work();}catch(e){if(own.isConnected)error.textContent=e.message;}finally{pending=false;options.onBusy?.(false);own.inert=false;}}
    async function load(){const seq=++sequence,next=await api('config');if(seq!==sequence||!own.isConnected)return;data=next;render();options.onDirty?.(false);options.onData?.(data);}
    function render(){
      tracker?.destroy();tracker=null;clearTimeout(syncTimer);const syncVersion=++syncSequence;
      const panel=node('form','ci-panel'),head=node('div','ci-toolbar'),title=node('div'),grid=node('div','ci-grid');
      title.append(node('h2','','海讯社媒体发布'),node('p','ci-muted','海讯社 · 15 类媒体与服务资源'));
      head.append(title,button('刷新',async()=>{if(pending)return;if(options.confirmDiscard&&!(await options.confirmDiscard()))return;await busy(load);}));
      const source=node('div','ci-source');source.append(node('span','','当前来源：平台自有'),node('span','ci-badge',!data.revision?'未配置':!data.enabled?'已停用':!data.public_base?'接口已启用，发稿待配置':'已配置，待联调'));
      const enabled=node('label','ci-check'),toggle=node('input');toggle.type='checkbox';toggle.checked=data.enabled;toggle.name='enabled';enabled.append(toggle,node('span','','启用海讯社接口'));
      const token=field('token','海讯社 Token','text',data.token||''),key=field('key','海讯社 Key','text',data.key||''),base=field('public_base','本站公网访问域名（正式发稿时必填）','url',data.public_base),markup=field('markup','零售加价比例（%）','number',data.markup_bps/100);
      for(const [wrap,configured] of [[token,data.token_configured],[key,data.key_configured]]){const input=wrap.querySelector('input');input.autocomplete='off';input.spellcheck=false;input.placeholder=!data.can_write&&configured?'当前账号无凭证查看权限':'请输入完整凭证';}
      base.querySelector('input').placeholder='https://ai.example.com';base.append(node('small','ci-muted','先验证接口、同步媒体资源时可留空。正式发稿前填写部署本中台的 HTTPS 域名，由您配置，海讯社不提供；本地 localhost / 127.0.0.1 不可用。'));markup.querySelector('input').step='0.01';markup.querySelector('input').min='0';markup.querySelector('input').max='1000';
      grid.append(token,key,base,markup);const actions=node('div','ci-actions');actions.append(button('保存配置',()=>panel.requestSubmit(),true));
      panel.append(head,source,node('p','ci-muted','凭证由总后台维护，输入框显示已保存内容，保存时按当前填写内容更新。'),enabled,grid,node('p','ci-muted','客户费用按媒体报价及加价计算，1元=100算力。供方预存余额在海讯社账户维护，保存配置不会自动发稿或充值。'),actions);
      panel.querySelectorAll('input,.ci-actions button').forEach(e=>e.disabled=!data.can_write);
      tracker=window.IntegrationFormState.track(panel,dirty=>options.onDirty?.(dirty));
      panel.addEventListener('submit',e=>{e.preventDefault();if(pending||!data.can_write)return;busy(async()=>{
        const next=await api('save',{enabled:toggle.checked,revision:data.revision,replace_credentials:true,token:token.querySelector('input').value,key:key.querySelector('input').value,public_base:base.querySelector('input').value,markup_bps:Math.round(Number(markup.querySelector('input').value)*100)});
        if(!own.isConnected)return;data={...data,...next,token:token.querySelector('input').value,key:key.querySelector('input').value};render();options.onDirty?.(false);options.onData?.(data);status.textContent='配置已保存。实际联调状态以供方响应为准。';
      });});
      const sync=node('section','ci-panel ci-press-sync ci-resource-sync'),syncHead=node('div','ci-toolbar'),syncSummary=node('p','ci-sync-summary','正在读取同步状态…'),syncNotice=node('p','ci-muted'),syncRows=node('div','ci-sync-grid'),syncError=node('p','ci-error');
      syncSummary.setAttribute('role','status');syncSummary.setAttribute('aria-live','polite');syncError.setAttribute('role','alert');
      const syncLabels={idle:'尚未同步',queued:'等待后台同步',running:'正在同步',partial:'部分失败，可续传',blocked:'同步已暂停',completed:'全部同步完成',pending:'待同步',retrying:'等待重试',failed:'同步失败'};
      const syncAllowed=()=>data.can_sync&&data.enabled&&data.token_configured&&data.key_configured;
      const syncButton=button('一键同步全部',()=>busy(async()=>{
        clearTimeout(syncTimer);syncError.textContent='';
        try{const result=await api('syncAll',{revision:data.revision});if(syncVersion===syncSequence&&own.isConnected)showSync(result);}
        finally{if(syncVersion===syncSequence&&own.isConnected)syncTimer=setTimeout(pollSync,3000);}
      }),true);syncButton.disabled=true;
      syncHead.append(node('h2','','媒体资源同步'),syncButton);
      function showSync(result){
        sync.dataset.syncState=result.state;const active=['queued','running'].includes(result.state),stale=result.config_revision!==data.revision;
        syncButton.textContent=active&&!stale?'同步进行中':result.state==='partial'&&!stale?'重试失败类别':'一键同步全部';syncButton.disabled=!syncAllowed()||(active&&!stale);
        syncSummary.textContent=`${syncLabels[result.state]||result.state} · 已同步 ${result.synced.toLocaleString('zh-CN')} 条 · 完成 ${result.completed}/15 类`+(result.failed?` · ${result.failed} 类失败`:'');
        syncNotice.textContent=result.message||(active?(result.worker_online?'任务在服务器后台执行，关闭页面后仍会继续。':'任务已保存，正在等待服务器同步服务处理。请确认同步服务已启动。'):result.finished_at?'最近结束：'+new Date(result.finished_at*1000).toLocaleString('zh-CN'):'同步名称、分类、报价、发布要求和上架状态，重复同步会更新现有资源。');
        syncRows.replaceChildren();for(const item of result.categories){
          const card=node('div','ci-sync-category'),heading=node('div','ci-sync-category-head');heading.append(node('strong','',item.name),node('span','ci-badge',item.state==='completed'?'已完成':syncLabels[item.state]||item.state));
          card.append(heading,node('p','ci-muted',`${item.synced.toLocaleString('zh-CN')} / ${item.total===null?'待获取':item.total.toLocaleString('zh-CN')} 条`));
          const bar=node('progress');bar.max=Math.max(1,item.total||1);bar.value=item.state==='completed'?bar.max:Math.min(item.synced,bar.max);bar.setAttribute('aria-label',item.name+'同步进度');card.append(bar);
          if(item.error)card.append(node('small','ci-error',item.error));syncRows.append(card);
        }
      }
      async function pollSync(){
        if(syncVersion!==syncSequence||!own.isConnected)return;let delay=15000;
        try{const result=await api('syncStatus');if(syncVersion!==syncSequence||!own.isConnected)return;syncError.textContent='';showSync(result);if(['queued','running'].includes(result.state))delay=5000;}
        catch(e){if(syncVersion!==syncSequence||!own.isConnected)return;syncError.textContent='无法读取同步进度：'+e.message;syncButton.disabled=true;}
        syncTimer=setTimeout(pollSync,delay);
      }
      const schedule=node('details','ci-sync-schedule');schedule.append(node('summary','','服务器定时同步说明'),node('p','ci-muted','后台手动同步需要运行资源同步服务；定时任务可每日执行一次全量同步。两种方式共享任务，重复触发不会并行重复导入。'));
      schedule.append(node('p','ci-muted','常驻同步服务（在项目目录执行）：'),node('code','','php think media-press:sync --work'),node('p','ci-muted','服务器定时任务命令（在项目目录执行，建议每日凌晨）：'),node('code','','php think media-press:sync --all'));
      sync.append(syncHead,node('p','ci-muted','一键同步全部 15 类资源，无需填写公网域名。国内软文、自媒体支持现有发稿流程，其余类别先保存资源目录；同步不会创建发稿订单。'),syncSummary,syncNotice,syncError,syncRows,schedule);
      const inspect=node('section','ci-panel ci-press-sync ci-press-inspect'),inspectHead=node('div','ci-toolbar'),progress=node('p','ci-muted'),results=node('div','ci-probe-results');
      inspectHead.append(node('h2','','接口连通与能力检查'));
      const catalog=['国内软文','自媒体','海外发稿','海外社媒','贴吧','论坛','问答','友链','文案','小红书','百科','短视频','微信','微博','母语'];
      const test=button('测试连接并查看能力',()=>busy(async()=>{
        results.replaceChildren();let connected=0,checked=0;
        for(let index=0;index<catalog.length;index++){
          if(!own.isConnected)return;progress.textContent=`正在检查 ${index+1}/${catalog.length}：${catalog[index]}…`;
          const item=node('div','ci-probe-row'),name=node('strong','',catalog[index]),summary=node('div'),state=node('span','ci-badge','检测中');item.append(name,summary,state);results.append(item);
          let result;try{result=await api('inspect',{kind:index+1,revision:data.revision});}catch(e){if(!own.isConnected)return;state.textContent='检查中断';summary.textContent=e.message;progress.textContent='检查已停止，请处理提示后重新测试。';return;}if(!own.isConnected)return;checked++;
          if(!result.authenticated){state.textContent='认证未通过';summary.textContent=result.message;progress.textContent='账号认证未通过，资源检查已停止。';return;}
          if(result.connected){connected++;state.textContent='已接通';summary.append(node('div','',`共 ${result.total.toLocaleString('zh-CN')} 条资源`));for(const sample of result.samples)summary.append(node('small','ci-muted',sample.name+(sample.prices.length?' · 供方报价 ¥'+sample.prices.join(' / ¥'):'')));}
          else{state.textContent='未接通';summary.textContent=result.message;}
          progress.textContent=`已检查 ${checked}/${catalog.length} 类，${connected} 类已接通。`;
        }
        progress.textContent+= ' 全部类别均可同步资源目录；国内软文、自媒体已接入现有发稿流程。';
      }));test.disabled=!data.can_sync||!data.token_configured||!data.key_configured;inspectHead.append(test);
      inspect.append(inspectHead,node('p','ci-muted','使用已保存的凭证检查账号与15类资源，每类读取3条样本。无需开启发稿或填写公网域名，不创建订单。'),progress,results);
      own.replaceChildren(error,status,panel,sync,inspect);pollSync();
    }
    if(data)render();else busy(load);
    return {isDirty(){return tracker?.isDirty()||false;},destroy(){tracker?.destroy();sequence++;syncSequence++;clearTimeout(syncTimer);own.remove();}};
  }
  window.PressIntegration={listConfig:()=>api('config'),mountConfig};
})();
