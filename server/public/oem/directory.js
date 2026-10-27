/* OEM extension follows the application's shipped independent-admin-page pattern. */
(() => {
  'use strict';
  let current='',root=null,host=null,view=null;
  let agentPortal=false;
  let actorAgentId=0;
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;};
  function stored(key){try{const value=JSON.parse(localStorage.getItem('__like_admin_saas_tenant__'+key)||'null');return value?.value||'';}catch{return '';}}
  async function api(action,params,body){
    const tenant=new URLSearchParams(location.search).get('tenant_id')||(agentPortal?'':stored('tenant_id'));
    const query=new URLSearchParams(params||{});if(tenant)query.set('tenant_id',String(tenant));
    const response=await fetch('/tenantapi/oem.directory/'+action+(query.size?'?'+query:''),{method:body?'POST':'GET',headers:{token:stored('token'),'Content-Type':'application/json'},credentials:'same-origin',body:body?JSON.stringify(body):undefined});
    const data=await response.json();if(data.code!==1){if(agentPortal&&data.code===-1)location.replace('/admin/login'+(tenant?'?tenant_id='+encodeURIComponent(tenant):''));else if(agentPortal&&action==='agents'&&data.code===0)location.replace('/admin/consumer/lists'+(tenant?'?tenant_id='+encodeURIComponent(tenant):''));throw new Error(data.msg||'请求失败，请稍后重试');}return data.data;
  }
  function cleanup(){if(view?.dialog?.open)view.dialog.close();root?.remove();host?.classList.remove('oem-directory-active');root=null;host=null;view=null;current='';}
  function mount(kind){
    cleanup();current=kind;
    host=document.querySelector('main')||document.querySelector('.el-main');
    if(!host){current='';return;}
    host.classList.add('oem-directory-active');root=node('section','oem-directory');root.id='oem-directory';host.append(root);
    const isAgent=kind==='agent',childManagement=isAgent&&agentPortal,name=isAgent?(childManagement?'二级代理':'代理'):'商家';
    root.innerHTML='<div class="oem-stats"><article><span>'+name+'总数</span><strong data-total>—</strong></article><article><span>已启用</span><strong data-active>—</strong></article><article><span>已停用</span><strong data-disabled>—</strong></article></div><div class="oem-panel"><form class="oem-filter"><label class="oem-search"><span class="sr-only">搜索名称、联系人或电话</span><input name="keyword" placeholder="搜索名称、联系人或电话" maxlength="80"></label><label><span class="sr-only">状态</span><select name="status"><option value="">全部状态</option><option value="1">已启用</option><option value="0">已停用</option></select></label><label><span class="sr-only">'+(isAgent?'代理级别':'归属代理')+'</span><select name="'+(isAgent?'level':'agent_id')+'"><option value="">'+(isAgent?'全部级别':'全部归属')+'</option>'+(isAgent?'<option value="1">一级代理</option><option value="2">二级代理</option>':(agentPortal?'':'<option value="0">OEM 直属</option>'))+'</select></label><button class="oem-secondary" type="submit">查询</button><button class="oem-text" type="reset">重置</button></form><div class="oem-toolbar"><button type="button" class="oem-primary" data-add>＋ 新增'+name+'</button></div><p class="oem-error" role="alert" data-error></p><div class="oem-table-wrap"><table><thead><tr>'+(isAgent?'<th>代理名称</th><th>级别 / 上级</th><th>联系人</th><th>联系电话</th><th>直属商家</th>':'<th>商家名称 / 登录账号</th><th>联系人</th><th>联系电话</th><th>所属代理</th><th>可用算力</th>')+'<th>状态</th><th>操作</th></tr></thead><tbody></tbody></table><div class="oem-empty" data-empty>正在读取数据…</div></div><div class="oem-pagination"><span data-count>—</span><div><button class="oem-secondary" data-prev>上一页</button><span data-page>1</span><button class="oem-secondary" data-next>下一页</button></div></div></div><dialog class="oem-dialog"><form method="dialog" class="oem-dialog-form"><div class="oem-dialog-title"><h2></h2><button class="oem-close" type="button" data-close aria-label="关闭">×</button></div><div data-fields></div><p class="oem-error" data-form-error role="alert" aria-live="polite"></p><div class="oem-dialog-actions"><button type="button" class="oem-secondary" data-close>取消</button><button type="submit" class="oem-primary">保存</button></div></form></dialog>';
    if(childManagement){root.querySelector('[data-add]').textContent='＋ 开通二级代理';root.querySelector('[name=level]').closest('label').remove();}
    const ownRoot=root;const q=s=>ownRoot.querySelector(s);const filters=q('.oem-filter');const dialog=q('dialog');const state={page:1,rows:[],agents:[],request:0,pending:false,dialog};view=state;
    const money=value=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(Number(value||0));
    if(!isAgent){const requests=node('button','oem-secondary','门店申请');requests.type='button';requests.addEventListener('click',openStoreRequests);q('.oem-toolbar').append(requests);}
    function openStoreRequests(){
      const d=node('dialog','oem-dialog'),wrap=node('div','oem-dialog-form'),title=node('h2','','门店申请'),close=node('button','oem-secondary','关闭'),status=selectField('request_status','申请状态',[['pending','待审核'],['','全部状态'],['approved','已办理'],['rejected','已驳回'],['cancelled','已撤回']],'pending'),list=node('div'),error=node('p','oem-error');error.setAttribute('role','alert');let busy=false,page=1;
      close.type='button';close.addEventListener('click',()=>{if(!busy)d.close();});wrap.append(title,status,error,list,close);d.append(wrap);ownRoot.append(d);d.addEventListener('close',()=>d.remove());d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});status.querySelector('select').addEventListener('change',()=>{page=1;loadRequests();});
      async function loadRequests(){try{const data=await api('storeRequests',{status:status.querySelector('select').value,page});if(!d.isConnected)return;list.replaceChildren();for(const r of data.lists){const card=node('section','oem-store-request');const names={pending:'待审核',approved:'已办理',rejected:'已驳回',cancelled:'已撤回'};card.append(node('strong','',r.merchant_name+' / '+r.store_name),node('p','',`#${r.id} · ${r.kind==='renewal'?'门店续期':'码牌激活'} · ${names[r.status]}`),node('p','',r.note));
          if(r.status==='pending'&&!Number(r.store_deleted)){const form=node('form'),decision=selectField('decision','审核结果',[['approved','通过并办理'],['rejected','驳回']],'approved'),details=node('div');form.append(decision,details,field('review_note','审核／办理说明',{required:true,max:500}));const redraw=()=>{details.replaceChildren();if(decision.querySelector('select').value==='approved'){details.append(r.kind==='renewal'?field('expire_date','办理后到期日期',{required:true,type:'date'}):field('activation_reference','线下办理码牌编号／凭证',{required:true,max:128}),node('p','oem-hint',r.kind==='renewal'?'确认后更新门店有效期，不自动扣费。':'请完成线下激活后登记凭证；此处不调用外部码牌服务。'));}};decision.querySelector('select').addEventListener('change',redraw);redraw();const submit=node('button','oem-primary','确认处理');submit.type='submit';form.append(submit);form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;submit.disabled=true;error.textContent='';try{await api('storeReview',null,{...Object.fromEntries(new FormData(form)),id:r.id});await loadRequests();}catch(e){error.textContent=e.message;}finally{busy=false;submit.disabled=false;}});card.append(form);}else card.append(node('p','oem-hint',r.review_note|| (Number(r.store_deleted)?'门店已移入回收站，恢复后可办理。':'')));list.append(card);}
        if(!data.count)list.append(node('p','oem-empty','暂无申请'));const paging=node('div','oem-pagination'),prev=node('button','oem-secondary','上一页'),next=node('button','oem-secondary','下一页');prev.type=next.type='button';prev.disabled=data.page<=1;next.disabled=data.page*15>=data.count;prev.addEventListener('click',()=>{page--;loadRequests();});next.addEventListener('click',()=>{page++;loadRequests();});paging.append(node('span','',`共 ${data.count} 条 · 第 ${data.page} 页`),prev,next);list.append(paging);
      }catch(e){error.textContent=e.message;}}
      d.showModal();loadRequests();
    }
    async function load(){
      const seq=++state.request;q('[data-error]').textContent='';
      try{
        const data=await api(isAgent?'agents':'merchants',{...Object.fromEntries(new FormData(filters)),page:state.page});
        if(seq!==state.request||!ownRoot.isConnected)return;
        state.rows=data.lists||[];state.agents=data.agents||[];if(agentPortal)actorAgentId=Number(data.actor_agent_id||0);
        q('[data-total]').textContent=data.stats.total;q('[data-active]').textContent=data.stats.active;q('[data-disabled]').textContent=data.stats.total-data.stats.active;
        const tbody=q('tbody');tbody.replaceChildren();
        for(const row of state.rows){
          const tr=node('tr');const identity=node('td');identity.append(node('strong','',row.name),node('small','',isAgent?'编号 #'+row.id+' · 登录：'+(row.account||'未开通'):row.account));tr.append(identity);
          const values=isAgent?[(row.level===1?'一级代理':'二级代理')+' · '+(row.parent_name||'OEM 直属'),row.contact||'—',row.mobile||'—',row.merchant_count]:[row.contact||'—',row.mobile||'—',row.agent_name||'OEM 直属',money(row.balance)];
          values.forEach(value=>tr.append(node('td','',value)));
          const status=node('td');status.append(node('span','oem-status '+(row.status===1?'is-active':''),row.status===1?'已启用':'已停用'));tr.append(status);
          const actions=node('td');const edit=node('button','oem-text','编辑');edit.type='button';edit.addEventListener('click',()=>editRow(row));actions.append(edit);tr.append(actions);tbody.append(tr);
          if(isAgent){identity.append(node('small','','可分配额度：'+money(row.quota_balance)));if((agentPortal||data.can_grant_quota)&&row.status===1){const quota=node('button','oem-text',agentPortal?'划拨额度':'授予额度');quota.type='button';quota.addEventListener('click',()=>quotaRow(row));actions.append(quota);}}
        }
        q('[data-empty]').hidden=state.rows.length>0;q('[data-empty]').textContent='暂无'+name+'，可通过列表上方按钮开通。';q('[data-count]').textContent='共 '+data.count+' 条';q('[data-page]').textContent=String(state.page);q('[data-prev]').disabled=state.page<=1;q('[data-next]').disabled=state.page*15>=data.count;
        if(!isAgent){const select=filters.elements.agent_id;const selected=select.value;select.querySelectorAll('[data-agent-option]').forEach(el=>el.remove());for(const agent of state.agents){const option=node('option','',agent.name);option.value=String(agent.id);option.dataset.agentOption='1';select.append(option);}select.value=selected;}
      }catch(error){if(seq!==state.request||!ownRoot.isConnected)return;q('[data-error]').textContent=error.message;q('[data-empty]').textContent='读取失败，请点击查询重试。';q('[data-empty]').hidden=false;}
    }
    function field(key,label,{required=false,max=80,type='text',value='',readOnly=false}={}){const wrapper=node('label','oem-field');wrapper.append(node('span','',label+(required?' *':'')));const input=node('input');input.name=key;input.type=type;input.required=required;input.maxLength=max;input.value=value??'';input.readOnly=readOnly;if(type==='password')input.autocomplete='new-password';wrapper.append(input);return wrapper;}
    function selectField(key,label,options,value){const wrapper=node('label','oem-field');wrapper.append(node('span','',label));const select=node('select');select.name=key;for(const [id,text] of options){const option=node('option','',text);option.value=String(id);select.append(option);}select.value=String(value);wrapper.append(select);return wrapper;}
    function editRow(row={}){
      const form=q('.oem-dialog-form'),fields=q('[data-fields]');form.reset();fields.replaceChildren();q('[data-form-error]').textContent='';q('.oem-dialog-title h2').textContent=(row.id?'编辑':childManagement?'开通':'新增')+name;
      form.dataset.quota='';
      fields.append(field('name',name+'名称',{required:true,value:row.name}));
      if(isAgent){
        fields.append(field('account','代理登录账号',{required:true,max:30,value:row.account}));
        const password=field('password',row.account?'重置登录密码':'初始密码',{required:!row.account,max:20,type:'password'});if(row.account)password.querySelector('input').placeholder='留空则保留当前密码';fields.append(password);
        fields.append(node('p','oem-hint','8–20 位，包含字母和数字。OEM 与代理共用后台登录入口，登录后按身份管理商家。'));
        if(childManagement){fields.append(node('p','oem-hint','代理级别：二级代理；上级自动绑定为当前一级代理。'));}else{
        fields.append(selectField('level','代理级别',[[1,'一级代理'],[2,'二级代理']],row.level||1));
        const parents=[[0,'请选择一级上级代理'],...state.agents.filter(a=>a.level===1&&a.status===1&&a.id!==row.id).map(a=>[a.id,a.name])];
        fields.append(selectField('parent_id','上级代理',parents,row.parent_id||0));
        const toggle=()=>{const parent=form.elements.parent_id.closest('label');parent.hidden=form.elements.level.value!=='2';form.elements.parent_id.required=form.elements.level.value==='2';};form.elements.level.addEventListener('change',toggle);toggle();
        }
      }else{
        fields.append(field('account','商家登录账号',{required:!row.id,max:30,value:row.account,readOnly:!!row.id}));
        if(!row.id){fields.append(field('password','初始密码',{required:true,max:20,type:'password'}));const hint=node('p','oem-hint','8–20 位，包含字母和数字。账号开通后可用于商家端登录。');fields.append(hint);}
        const agents=[...(agentPortal?[]:[[0,'OEM 直属']]),...state.agents.filter(a=>a.status===1||a.id===row.agent_id).map(a=>[a.id,a.name+(a.status===1?'':'（已停用）')])];
        fields.append(selectField('agent_id','所属代理',agents,row.agent_id||(agentPortal?actorAgentId:0)));fields.append(field('industry','所属行业',{max:50,value:row.industry}));
      }
      fields.append(field('contact','联系人',{max:50,value:row.contact}),field('mobile','联系电话',{max:32,type:'tel',value:row.mobile}),selectField('status',isAgent?'代理状态':'账号状态',[[1,'已启用'],[0,'已停用']],row.status??1));
      const notes=node('label','oem-field');notes.append(node('span','','备注'));const textarea=node('textarea');textarea.name='notes';textarea.maxLength=500;textarea.rows=3;textarea.value=row.notes||'';notes.append(textarea);fields.append(notes);
      form.dataset.id=row.id||'';dialog.showModal();form.elements.name.focus();
    }
    function quotaRow(row){
      const form=q('.oem-dialog-form'),fields=q('[data-fields]');form.reset();fields.replaceChildren();form.dataset.id=String(row.id);form.dataset.quota='1';form.dataset.requestKey=crypto.randomUUID();q('[data-form-error]').textContent='';q('.oem-dialog-title h2').textContent=(agentPortal?'划拨额度':'授予额度')+' · '+row.name;
      const amount=field('points','算力额度',{required:true,type:'number',max:12});amount.querySelector('input').min='0.01';amount.querySelector('input').step='0.01';fields.append(amount,field('note','备注',{max:200}),node('p','oem-hint',agentPortal?'从你的可分配额度扣减并转入该二级代理，额度不足时不会划拨。':'授予代理可分配的商家零售算力额度。该操作不代表现金收款，不改变 OEM 上游模型成本余额。'));
      dialog.showModal();form.elements.points.focus();
    }
    q('[data-add]').addEventListener('click',()=>editRow());
    q('.oem-dialog-form').addEventListener('submit',async event=>{
      event.preventDefault();if(state.pending)return;const form=event.currentTarget;const payload=Object.fromEntries(new FormData(form));if(form.dataset.id)payload.id=Number(form.dataset.id);state.pending=true;const save=form.querySelector('[type=submit]');save.disabled=true;save.textContent='正在保存…';q('[data-form-error]').textContent='';
      try{let action=isAgent?'saveAgent':'saveMerchant';if(form.dataset.quota){action='grantQuota';delete payload.id;payload.target_agent_id=Number(form.dataset.id);payload.request_key=form.dataset.requestKey;}await api(action,null,payload);dialog.close();await load();}catch(error){q('[data-form-error]').textContent=error.message;}finally{state.pending=false;save.disabled=false;save.textContent='保存';}
    });
    q('[data-prev]').addEventListener('click',()=>{if(state.page>1){state.page--;load();}});q('[data-next]').addEventListener('click',()=>{state.page++;load();});
    filters.addEventListener('submit',event=>{event.preventDefault();state.page=1;load();});filters.addEventListener('reset',()=>{setTimeout(()=>{if(ownRoot.isConnected){state.page=1;load();}},0);});
    q('dialog').addEventListener('cancel',event=>{if(state.pending)event.preventDefault();});q('dialog').querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>{if(!state.pending)dialog.close();}));load();
  }
  function check(){agentPortal=String(stored('token')).startsWith('agent_');const path=location.pathname.replace(/\/+$/,'');if(path==='/admin/workbench'){const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let text;const replacements={'用户总数':'商家总数','用户管理':'商家管理','本租户运营数据':'本 OEM 运营数据'};while(text=walker.nextNode()){if(text.parentElement?.closest('script,style'))continue;const next=replacements[text.textContent.trim()];if(next)text.textContent=next;}}const kind=/^\/admin\/oem\/agents$/.test(path)?'agent':/^\/admin\/consumer\/lists(?:\/detail)?$/.test(path)?'merchant':'';if(!kind){if(current)cleanup();return;}if(kind!==current||!root?.isConnected)mount(kind);}
  const css=document.createElement('link');css.rel='stylesheet';css.href='/oem/directory.css';document.head.append(css);
  for(const key of ['pushState','replaceState']){const original=history[key];history[key]=function(...args){const result=original.apply(this,args);queueMicrotask(check);return result;};}
  window.addEventListener('popstate',check);const observer=new MutationObserver(()=>{if(!root?.isConnected)check();});observer.observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',check);check();
})();
