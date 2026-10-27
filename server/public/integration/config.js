/* Shared capability settings shell. Each service retains its own authorization and API. */
(() => {
  'use strict';
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
  const labels={missing:'未配置',configured:'配置齐全，待联调',disabled:'已停用',incomplete:'配置不完整',unreadable:'凭证无法读取'};
  let root=null,host=null,scope='',current='',generation=0;
  function stored(key){try{return JSON.parse(localStorage.getItem('__like_admin_saas_'+scope+'__'+key)||'null')?.value||'';}catch{return '';}}
  async function api(action,body){
    const tenant=scope==='tenant'?(new URLSearchParams(location.search).get('tenant_id')||stored('tenant_id')):'';
    const query=tenant?'?tenant_id='+encodeURIComponent(tenant):'';
    const response=await fetch('/'+(scope==='platform'?'platformapi':'tenantapi')+'/integration.config/'+action+query,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{token:stored('token'),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    const data=await response.json();if(data.code!==1)throw Error(data.msg||'配置操作失败');return data.data;
  }
  function button(text,work,primary=false){const b=node('button','ci-button'+(primary?' ci-primary':''),text);b.type='button';if(work)b.addEventListener('click',work);return b;}
  let destroyPanel=()=>{};
  function cleanup(){generation++;destroyPanel();destroyPanel=()=>{};root?.querySelector('dialog[open]')?.close();root?.remove();host?.classList.remove('clip-integration-active');root=null;host=null;current='';}
  function mount(){
    host=document.querySelector('main')||document.querySelector('.el-main');if(!host)return;host.classList.add('clip-integration-active');root=node('section','ci-page');root.id='clip-integration';root.setAttribute('aria-label','接入能力配置');host.append(root);current=scope;
    const own=root,notice=node('div','ci-note'),status=node('p','ci-status'),error=node('p','ci-error'),layout=node('div','ci-layout'),tabs=node('nav','ci-tabs'),content=node('div');tabs.setAttribute('aria-label','接入能力');tabs.setAttribute('role','tablist');status.setAttribute('role','status');status.setAttribute('aria-live','polite');error.setAttribute('role','alert');layout.append(tabs,content);own.append(notice,status,error,layout);
    const state={data:null,geo:null,press:null,geoError:'',clipError:'',pressError:'',active:location.hash.slice(1)||'aliyun',dirty:false,pending:false,sequence:0,canWrite:false,child:null,tracker:null};
    const markDirty=dirty=>{state.dirty=dirty;status.textContent=dirty?'当前改动尚未保存':'';};
    const isDirty=()=>state.tracker?.isDirty()??state.child?.isDirty?.()??state.dirty;
    const track=panel=>{state.tracker=window.IntegrationFormState.track(panel,markDirty);};
    const stopGuides=window.IntegrationGuides.observe(content,()=>state.active);
    destroyPanel=()=>{stopGuides();state.sequence++;state.tracker?.destroy();state.child?.destroy();};
    function ask(text){const d=node('dialog','ci-dialog'),title=node('h2','','确认操作'),copy=node('p','',text),actions=node('div','ci-actions');title.id='ci-confirm-title';d.setAttribute('aria-labelledby',title.id);d.append(title,copy,actions);own.append(d);let yes=false;return new Promise(resolve=>{actions.append(button('取消',()=>d.close()),button('确认',()=>{yes=true;d.close();},true));d.addEventListener('close',()=>{d.remove();resolve(yes);},{once:true});d.showModal();});}
    async function load(){const seq=++state.sequence;own.setAttribute('aria-busy','true');error.textContent='';try{const results=await Promise.allSettled([api('lists'),window.MerchantGeoAdmin?window.MerchantGeoAdmin.listConfig(scope):Promise.reject(Error('GEO配置组件正在加载')),scope==='platform'?window.PressIntegration.listConfig():Promise.resolve(null)]);if(seq!==state.sequence||!own.isConnected)return;state.data=results[0].status==='fulfilled'?results[0].value:null;state.geo=results[1].status==='fulfilled'?results[1].value:null;state.clipError=results[0].status==='rejected'?results[0].reason.message:'';state.geoError=results[1].status==='rejected'?results[1].reason.message:'';state.press=results[2].status==='fulfilled'?results[2].value:null;state.pressError=results[2].status==='rejected'?results[2].reason.message:'';state.canWrite=state.data?.can_write===true;state.dirty=false;render();}catch(e){if(own.isConnected)error.textContent=e.message;}finally{if(seq===state.sequence)own.removeAttribute('aria-busy');}}
    const entries=()=>[...(state.data?.aliyun?[{id:'aliyun',shared:true,row:{name:'阿里云公共凭证',local_state:state.data.aliyun.state,effective:{}}}]:[]),...(state.data?.lists||[]).map(row=>({id:row.code,row,geo:false})),...(state.geo?.lists||[]).map(row=>({id:'geo-'+row.code,row,geo:true})),...(state.press?[{id:'haipress',row:{...state.press,name:'海讯社媒体发布'},press:true}]:[])];
    async function select(id){if(state.pending||id===state.active)return;if(isDirty()&&!(await ask('当前配置尚未保存，切换后会丢弃这些改动。')))return;state.active=id;state.dirty=false;status.textContent='';error.textContent='';history.replaceState(history.state,'',location.pathname+location.search+'#'+id);render();}
    function renderAliyun(){
      const data=state.data.aliyun,panel=node('form','ci-panel'),head=node('div','ci-toolbar'),title=node('div');
      panel.id='ci-active-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','ci-tab-aliyun');
      title.append(node('h2','','阿里云公共凭证'),node('p','ci-muted','填写一次，素材云存储、视频合成、批量打包下载共用'));
      head.append(title,button('刷新',async()=>{if(state.pending||isDirty()&&!(await ask('刷新将丢弃当前未保存内容。')))return;await load();}));
      panel.append(head,node('p','ci-muted','各项服务只需填写地域、Bucket、项目等专属参数。已使用独立凭证的服务，可在对应配置中切换为“使用公共凭证”。'));
      const grid=node('div','ci-grid'),controls={};
      for(const [key,label]of [['access_key_id','AccessKey ID'],['access_key_secret','AccessKey Secret']]){
        const wrap=node('label','ci-field'),input=node('input');input.type='text';input.name=key;input.autocomplete='off';input.spellcheck=false;input.maxLength=2048;input.value=data.secrets?.[key]||'';input.disabled=!state.canWrite;wrap.append(node('span','',label+' *'),input);grid.append(wrap);controls[key]=input;
      }
      panel.append(grid);
      const candidates=(state.data.lists||[]).filter(r=>['oss','ims','imm'].includes(r.code)&&r.secrets?.access_key_id&&r.secrets?.access_key_secret);
      if(state.canWrite&&candidates.length){
        const imports=node('div','ci-imports');imports.append(node('span','ci-muted','也可导入已保存的凭证：'));
        for(const row of candidates)imports.append(button(row.name,()=>{for(const key of Object.keys(controls))controls[key].value=row.secrets[key];state.tracker.refresh();}));
        panel.append(imports);
      }
      panel.append(node('p','ci-muted','自有凭证明文显示，保存后可直接查看和修改。借用平台能力不会下发平台凭证。'));
      const actions=node('div','ci-actions'),save=button('保存公共凭证',()=>panel.requestSubmit(),true);save.disabled=!state.canWrite;actions.append(save);panel.append(actions);content.append(panel);track(panel);
      panel.addEventListener('submit',async e=>{e.preventDefault();if(state.pending||!state.canWrite)return;const secrets=Object.fromEntries(Object.entries(controls).map(([key,input])=>[key,input.value]));await mutate(()=>api('aliyun',{revision:data.revision,secrets}));});
    }
    function renderTabs(){tabs.replaceChildren();const all=entries();let section='';all.forEach((entry,index)=>{const group=entry.shared?'公共凭证':entry.press?'媒体发布':entry.geo?'GEO营销':'剪辑与通知';if(group!==section){const heading=node('div','ci-group-title',group);heading.setAttribute('role','presentation');tabs.append(heading);section=group;}const row=entry.row,b=button('',()=>select(entry.id));b.className='ci-tab';b.id='ci-tab-'+entry.id;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(entry.id===state.active));b.tabIndex=entry.id===state.active?0:-1;b.setAttribute('aria-controls','ci-active-panel');const badge=entry.press?(!row.revision?'未配置':row.enabled?'已配置':'已停用'):entry.geo?(!row.ready?'待适配':row.mode==='off'?(row.revision?'已停用':'未配置'):row.state?.includes('借用平台')?'借用平台':row.mode==='own'?({configured:'已配置',incomplete:'不完整',unreadable:'读取失败'}[row.local_state]||'未配置'):row.state?.includes('自配')?'已配置':'未配置'):(row.effective.borrowed?'借用平台':({configured:'已配置',incomplete:'不完整',unreadable:'读取失败'}[row.local_state]||labels[row.local_state]||row.local_state));b.append(node('span','',row.name),node('small','',badge));b.addEventListener('keydown',async e=>{let next;if(e.key==='ArrowDown'||e.key==='ArrowRight')next=(index+1)%all.length;else if(e.key==='ArrowUp'||e.key==='ArrowLeft')next=(index+all.length-1)%all.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=all.length-1;else return;e.preventDefault();await select(all[next].id);tabs.querySelector('[aria-selected=true]')?.focus();});tabs.append(b);});if(state.clipError)tabs.append(node('p','ci-muted','剪辑配置：'+state.clipError));if(state.geoError)tabs.append(node('p','ci-muted','GEO配置：'+state.geoError));if(state.pressError)tabs.append(node('p','ci-muted','媒体配置：'+state.pressError));requestAnimationFrame(()=>{const selected=tabs.querySelector('[aria-selected=true]');if(!selected||!tabs.isConnected)return;const box=selected.getBoundingClientRect(),area=tabs.getBoundingClientRect();if(box.bottom>area.bottom)tabs.scrollTop+=box.bottom-area.bottom+12;else if(box.top<area.top)tabs.scrollTop-=area.top-box.top+12;if(box.right>area.right)tabs.scrollLeft+=box.right-area.right+12;else if(box.left<area.left)tabs.scrollLeft-=area.left-box.left+12;});}
    function render(){
      state.tracker?.destroy();state.tracker=null;state.child?.destroy();state.child=null;content.replaceChildren();notice.replaceChildren();
      if(scope==='platform'){notice.append(node('strong','','平台接入能力配置。'),node('span','',' 统一维护剪辑、员工任务通知、GEO 与海讯社媒体发布。剪辑借权在 OEM 创建／编辑表单中设置，GEO 借权在对应能力内逐项授权。'));}
      else{notice.append(node('strong','','OEM接入能力配置。'),node('span','',' 剪辑可使用自有配置或按许可借用平台；GEO 在每项能力内选择自配或借用平台，并维护代理授权。'));}
      notice.append(node('div','','原系统已有应用接口和存储配置保持原逻辑。配置齐全仅表示字段已保存，实际服务还需开通与联调。'));
      const all=entries();if(!all.some(entry=>entry.id===state.active))state.active=all[0]?.id||'oss';renderTabs();
      const selected=all.find(entry=>entry.id===state.active);if(!selected){content.append(node('p','ci-error','没有可查看的配置。'),button('重新加载',load));return;}
      if(selected.shared){renderAliyun();return;}
      if(selected.press){const panel=node('div');panel.id='ci-active-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','ci-tab-'+selected.id);content.append(panel);state.child=window.PressIntegration.mountConfig(panel,{data:state.press,onDirty:dirty=>{state.dirty=dirty;status.textContent=dirty?'当前改动尚未保存':'';},onBusy:busy=>{state.pending=busy;},onData:data=>{state.press=data;renderTabs();},confirmDiscard:()=>!isDirty()||ask('刷新将丢弃当前未保存内容。')});return;}
      if(selected.geo){const panel=node('div');panel.id='ci-active-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','ci-tab-'+selected.id);content.append(panel);state.child=window.MerchantGeoAdmin.mountConfig(panel,{scope,capability:selected.row.code,data:state.geo,onDirty:dirty=>{state.dirty=dirty;status.textContent=dirty?'当前改动尚未保存':'';},onBusy:busy=>{state.pending=busy;},onData:data=>{state.geo=data;renderTabs();},confirmDiscard:()=>!isDirty()||ask('刷新将丢弃当前未保存内容。')});return;}
      const row=selected.row;const panel=node('form','ci-panel');panel.id='ci-active-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','ci-tab-'+selected.id);const head=node('div','ci-toolbar'),title=node('div');title.append(node('h2','',row.name),node('p','ci-muted',row.provider));head.append(title,button('刷新',async()=>{if(state.pending)return;if(isDirty()&&!(await ask('刷新将丢弃当前未保存内容。')))return;await load();}));panel.append(head);
      const source=node('div','ci-source');source.append(node('span','','当前来源：'+({platform:row.effective.borrowed?'借用平台':'平台自有',oem:'OEM自有',none:'未配置'}[row.effective.source])),node('span','ci-badge',labels[row.effective.state]||row.effective.state));if(row.effective.borrowed)source.append(node('span','ci-muted','平台凭证由服务端使用，本页不展示。'));panel.append(source);
      const enabled=node('label','ci-check'),toggle=node('input');toggle.type='checkbox';toggle.checked=row.enabled;toggle.name='enabled';enabled.append(toggle,node('span','','启用自有配置'));panel.append(enabled);const grid=node('div','ci-grid'),controls={};
      const aliyun=['oss','ims','imm'].includes(row.code);let credentialMode=null;
      if(aliyun){
        const wrap=node('label','ci-field ci-credential-mode');credentialMode=node('select');credentialMode.name='credential_mode';
        for(const [value,label]of [['shared','使用公共凭证'],['own','使用本服务独立凭证']]){const option=node('option','',label);option.value=value;credentialMode.append(option);}
        credentialMode.value=row.credential_mode||'shared';wrap.append(node('span','','阿里云凭证来源'),credentialMode);panel.append(wrap);
      }
      const sharedNote=node('div','ci-source');if(aliyun){sharedNote.append(node('span','',state.data.aliyun?.state==='configured'?'已使用本级阿里云公共凭证，无需重复填写。':'请先填写并保存阿里云公共凭证，再启用本服务。'),button('管理公共凭证',()=>select('aliyun')));panel.append(sharedNote);}
      function updateCredentials(){if(!aliyun)return;const shared=credentialMode.value==='shared';sharedNote.hidden=!shared;grid.querySelectorAll('.ci-secret-field').forEach(wrap=>{wrap.hidden=shared;wrap.querySelectorAll('input').forEach(input=>input.disabled=shared||!state.canWrite);});}
      credentialMode?.addEventListener('change',updateCredentials);
      row.fields.forEach(field=>{const wrap=node('div',field.secret?'ci-secret-field':''),label=node('label','ci-field'),control=node(field.key==='clone_mode'?'select':['speaker_ids','data_map','template_ids'].includes(field.key)?'textarea':'input');if(control.tagName==='INPUT')control.type='text';control.name=field.key;control.maxLength=field.key==='speaker_ids'?8000:2048;control.autocomplete='off';control.spellcheck=false;
        if(field.key==='clone_mode')for(const [value,text]of [['','仅使用已有公共音色'],['postpaid','开启用户上传复刻（后付费音色）']]){const option=node('option','',text);option.value=value;control.append(option);}
        control.value=field.secret?(row.secrets?.[field.key]||''):row.settings[field.key]||'';
        if(field.key==='public_base')control.placeholder='例如 https://tasks.your-domain.com';if(field.key==='data_map')control.placeholder='{"thing1":"title","thing2":"store","time3":"time"}';if(field.secret)control.placeholder=row.secret_configured[field.key]?'已保存，留空保留原值':'请输入完整凭证';else if(field.key==='region')control.placeholder='例如 cn-shanghai';else if(field.key==='resource_id')control.placeholder=({tts:'seed-tts-2.0',icl:'seed-icl-2.0',asr:'volc.seedasr.auc'}[row.code]||'');
        label.append(node('span','',field.label+(field.required?' *':'')),control);wrap.append(label);controls[field.key]=control;
        if(field.secret&&row.secret_configured[field.key]){const clear=node('label','ci-check ci-clear'),box=node('input');box.type='checkbox';box.name='clear_'+field.key;clear.append(box,node('span','','清除已保存凭证'));wrap.append(clear);}
        grid.append(wrap);});panel.append(grid,node('p','ci-muted','自有凭证明文显示。留空保留已存值，勾选清除后才会删除。借用平台不会展示平台凭证。'));
      if(row.code==='task_notify')panel.append(node('p','ci-muted','请在微信公众平台配置网页授权域名及服务器IP白名单，并申请与员工任务匹配的模板。回调路径：/employee/wechat-callback。字段映射须与实际模板一致，员工关注并绑定后才可发送。填写送达回调 Token 和 EncodingAESKey 后，在微信服务器配置安全模式，消息回调地址为 '+(row.settings.public_base||'HTTPS任务域名')+row.callback_path+'。送达回执会显示在任务执行情况中。'));
      const actions=node('div','ci-actions');if(row.exists)actions.append(button('移除自有配置',async()=>{if(state.pending||!(await ask(scope==='tenant'?'移除后，本能力按平台借权许可重新选择来源。原配置可恢复。':'移除后，借用此平台配置的 OEM 将无法使用该能力。原配置可恢复。')))return;await mutate(()=>api('reset',{capability:row.code,revision:row.revision,restore:false}));}));
      if(row.recoverable)actions.append(button('恢复原自有配置',async()=>{if(state.pending||!(await ask('恢复已移除的自有配置及其启用状态？')))return;await mutate(()=>api('reset',{capability:row.code,revision:row.revision,restore:true}));}));const save=button('保存配置',()=>panel.requestSubmit(),true);actions.append(save);panel.append(actions);content.append(panel);panel.querySelectorAll('input,textarea,select').forEach(input=>{input.disabled=!state.canWrite;});actions.querySelectorAll('button').forEach(b=>b.disabled=!state.canWrite);updateCredentials();track(panel);
      panel.addEventListener('submit',async e=>{e.preventDefault();if(state.pending||!state.canWrite)return;const settings={},secrets={},clear=[];row.fields.forEach(f=>{if(f.secret){if(aliyun&&credentialMode.value==='shared')return;secrets[f.key]=controls[f.key].value;const box=panel.elements['clear_'+f.key];if(box?.checked)clear.push(f.key);}else settings[f.key]=controls[f.key].value;});await mutate(()=>api('save',{capability:row.code,revision:row.revision,enabled:toggle.checked,...(aliyun?{credential_mode:credentialMode.value}:{}),settings,secrets,clear_secrets:clear}));});
    }
    async function mutate(work){state.pending=true;error.textContent='';status.textContent='正在保存…';content.inert=true;try{await work();if(!own.isConnected)return;await load();status.textContent='配置已保存，实际服务状态以开通及联调结果为准。';}catch(e){error.textContent=e.message;status.textContent='';}finally{state.pending=false;content.inert=false;}}
    const ready=()=>{if(own.isConnected&&!state.dirty&&!state.pending)load();};window.addEventListener('geo-admin-ready',ready,{once:true});const dispose=destroyPanel;destroyPanel=()=>{window.removeEventListener('geo-admin-ready',ready);dispose();};load();
  }
  function check(){const target=location.pathname.replace(/\/+$/,'');scope=target.startsWith('/platform/')?'platform':'tenant';if(!['/platform/integration/config','/admin/integration/config'].includes(target)){if(root)cleanup();return;}if(!root?.isConnected||current!==scope){cleanup();mount();}}
  const css=document.createElement('link');css.rel='stylesheet';css.href='/integration/config.css?v=20261020-guides1';document.head.append(css);
  for(const method of ['pushState','replaceState']){const original=history[method];history[method]=function(...args){const value=original.apply(this,args);queueMicrotask(check);return value;};}
  window.addEventListener('popstate',check);new MutationObserver(()=>{if(!root?.isConnected)check();}).observe(document.documentElement,{subtree:true,childList:true});document.addEventListener('DOMContentLoaded',check);check();
})();
