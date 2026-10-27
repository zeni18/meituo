/* Platform channel directory: OEMs and both agent levels, outside compiled UI. */
(() => {
  const label={oem:'OEM',first:'一级代理',second:'二级代理'};
  let root=null,host=null;
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;};
  function token(){try{return JSON.parse(localStorage.getItem('__like_admin_saas_platform__token')||'null')?.value||'';}catch{return '';}}
  async function api(action,params,body){
    const query=new URLSearchParams(params||{});
    const response=await fetch('/platformapi/channel.directory/'+action+(query.size?'?'+query:''),{method:body?'POST':'GET',credentials:'same-origin',headers:{token:token(),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const result=await response.json();if(result.code!==1)throw new Error(result.msg||'请求失败，请稍后重试');return result.data;
  }
  function cleanup(){root?.querySelector('dialog[open]')?.close();root?.remove();host?.classList.remove('oem-directory-active');root=null;host=null;}
  function mount(){
    host=document.querySelector('main')||document.querySelector('.el-main');if(!host)return;
    host.classList.add('oem-directory-active');root=node('section','oem-directory platform-agent-counts');root.id='oem-directory';host.append(root);
    root.innerHTML='<div class="oem-stats"><article><span>OEM</span><strong data-stat="oem">—</strong></article><article><span>一级代理</span><strong data-stat="first">—</strong></article><article><span>二级代理</span><strong data-stat="second">—</strong></article></div><div class="oem-panel"><form class="oem-filter platform-agent-filters"><label class="oem-search"><span class="sr-only">搜索名称、账号或电话</span><input name="keyword" maxlength="80" placeholder="搜索名称、账号或电话"></label><label><span class="sr-only">代理类型</span><select name="kind"><option value="">全部类型</option><option value="oem">OEM</option><option value="first">一级代理</option><option value="second">二级代理</option></select></label><label><span class="sr-only">所属 OEM</span><select name="oem_id"><option value="">全部 OEM</option></select></label><label><span class="sr-only">状态</span><select name="status"><option value="">全部状态</option><option value="1">已启用</option><option value="0">已停用</option></select></label><button type="submit" class="oem-secondary">查询</button><button type="reset" class="oem-text">重置</button></form><div class="oem-toolbar"><button type="button" class="oem-primary" data-add>＋ 开通代理</button></div><p data-error class="oem-error" role="alert"></p><div class="oem-table-wrap"><table class="platform-agent-table"><thead><tr><th>名称 / 登录账号</th><th>代理类型</th><th>所属 OEM</th><th>上级关系</th><th>联系电话</th><th>状态</th><th>操作</th></tr></thead><tbody></tbody></table><p data-empty class="oem-empty">正在读取数据…</p></div><div class="oem-pagination"><span data-count>—</span><div><button class="oem-secondary" data-prev>上一页</button><span data-page>1</span><button class="oem-secondary" data-next>下一页</button></div></div></div><dialog class="oem-dialog" aria-labelledby="platform-agent-dialog-title"><form class="oem-dialog-form platform-agent-form"><div class="oem-dialog-title"><h2 id="platform-agent-dialog-title"></h2><button type="button" class="oem-close" data-close aria-label="关闭">×</button></div><div class="platform-agent-fields" data-fields></div><p data-form-error class="oem-error" role="alert" aria-live="polite"></p><div class="oem-dialog-actions"><button type="button" class="oem-secondary" data-close>取消</button><button type="submit" class="oem-primary">保存</button></div></form></dialog>';
    const own=root,q=s=>own.querySelector(s),filters=q('.oem-filter'),dialog=q('dialog'),form=q('.platform-agent-form');
    const state={page:1,oems:[],parents:[],seq:0,pending:false,row:null,canBorrow:false};
    async function load(){
      const seq=++state.seq;q('[data-error]').textContent='';
      try{
        const data=await api('lists',{...Object.fromEntries(new FormData(filters)),page:state.page});if(seq!==state.seq||!own.isConnected)return;
        state.oems=data.oems;state.parents=data.parents;state.canBorrow=Boolean(data.can_manage_clip_borrow);
        for(const key of Object.keys(label))q('[data-stat="'+key+'"]').textContent=data.stats[key];
        const selected=filters.elements.oem_id.value;filters.elements.oem_id.replaceChildren(new Option('全部 OEM',''));for(const oem of state.oems)filters.elements.oem_id.add(new Option(oem.name,String(oem.id)));filters.elements.oem_id.value=selected;
        q('tbody').replaceChildren();
        for(const row of data.lists){
          const tr=node('tr'),identity=node('td');identity.append(node('strong','',row.name),node('small','',row.account||'尚未开通登录'));tr.append(identity);
          const type=node('td');type.append(node('span','platform-agent-kind '+(row.kind==='oem'?'is-oem':''),label[row.kind]));tr.append(type);
          for(const value of [row.oem_name,row.parent_name,row.mobile||'—'])tr.append(node('td','',value));
          const status=node('td');status.append(node('span','oem-status '+(Number(row.status)===1?'is-active':''),Number(row.status)===1?'已启用':'已停用'));tr.append(status);
          const actions=node('td'),wrap=node('div','platform-agent-actions'),edit=node('button','oem-text','编辑');edit.type='button';edit.addEventListener('click',()=>open(row));wrap.append(edit);
          const login=node('a','','登录入口');login.href='/admin/login?tenant_id='+Number(row.tenant_id);login.target='_blank';login.rel='noopener';wrap.append(login);actions.append(wrap);tr.append(actions);q('tbody').append(tr);
        }
        q('[data-empty]').hidden=data.lists.length>0;q('[data-empty]').textContent='暂无匹配的代理记录';q('[data-count]').textContent='共 '+data.count+' 条';q('[data-page]').textContent=state.page;q('[data-prev]').disabled=state.page<=1;q('[data-next]').disabled=state.page*15>=data.count;
      }catch(error){if(seq===state.seq&&own.isConnected)q('[data-error]').textContent=error.message;}
    }
    function field(key,title,{value='',required=false,type='text',max=80}={}){const label=node('label','oem-field');label.append(node('span','',title+(required?' *':'')));const input=node('input');Object.assign(input,{name:key,type,required,maxLength:max,value:value??''});if(type==='password')input.autocomplete='new-password';label.append(input);return label;}
    function select(key,title,items,value,required=false){const label=node('label','oem-field');label.append(node('span','',title+(required?' *':'')));const input=node('select');input.name=key;input.required=required;for(const [id,text]of items)input.add(new Option(text,String(id)));input.value=String(value??'');label.append(input);return label;}
    function open(row=null){
      state.row=row;form.reset();q('[data-fields]').replaceChildren();q('[data-form-error]').textContent='';q('h2').textContent=row?'编辑'+label[row.kind]:'开通代理';
      const fields=q('[data-fields]');const kind=select('kind','代理类型',Object.entries(label),row?.kind||'oem',true);kind.querySelector('select').disabled=!!row;fields.append(kind);
      const oems=[['','请选择所属 OEM'],...state.oems.filter(t=>!Number(t.disable)||Number(t.id)===Number(row?.tenant_id)).map(t=>[t.id,t.name])];const oem=select('oem_id','所属 OEM',oems,row?.tenant_id||'',true);oem.querySelector('select').disabled=!!row;fields.append(oem);
      fields.append(select('parent_id','上级一级代理',[['','请选择上级一级代理']],row?.parent_id||'',true));
      fields.append(field('name','名称',{required:true,value:row?.name}),field('account','登录账号',{required:true,max:30,value:row?.account}));
      const password=field('password',row?'重置登录密码':'初始密码',{required:!row,type:'password',max:20});if(row)password.querySelector('input').placeholder='留空则保留当前密码';fields.append(password);
      const hint=node('p','oem-hint','8–20 位，包含字母和数字。所有账号使用统一后台登录入口。');fields.append(hint);
      fields.append(field('contact','联系人',{max:50,value:row?.contact}),field('mobile','联系电话',{type:'tel',max:32,value:row?.mobile}));
      const domain=field('domain_alias','OEM 绑定域名',{required:!row,max:190,value:row?.domain_alias});if(row)domain.querySelector('input').readOnly=true;fields.append(domain);
      const days=field('valid_days','OEM 有效天数',{required:true,type:'number',value:365});days.querySelector('input').min='1';days.querySelector('input').max='3650';fields.append(days);
      fields.append(select('status','状态',[[1,'已启用'],[0,'已停用']],row?.status??1));
      const borrow=node('label','clip-borrow-option'),box=node('input');box.type='checkbox';box.name='clip_borrow_platform';box.checked=Boolean(row?.clip_borrow?.allow_platform);box.disabled=!state.canBorrow;
      const copy=node('span');copy.append(node('strong','','允许借用平台新增能力配置'),node('small','','仅新增剪辑和员工任务通知能力：OEM 未配置时按授权使用平台配置，原系统已有接口保持原逻辑。'));borrow.append(box,copy);fields.append(borrow);
      const notes=node('label','oem-field');notes.append(node('span','','备注'));const textarea=node('textarea');textarea.name='notes';textarea.rows=3;textarea.maxLength=500;textarea.value=row?.notes||'';notes.append(textarea);fields.append(notes);
      const setVisibility=(key,visible)=>{const el=form.elements[key];el.closest('label').hidden=!visible;el.disabled=!visible||(!!row&&['kind','oem_id'].includes(key));if(['oem_id','parent_id','domain_alias','valid_days'].includes(key))el.required=visible;};
      const refreshParents=()=>{const selected=form.elements.parent_id.value;form.elements.parent_id.replaceChildren(new Option('请选择上级一级代理',''));for(const agent of state.parents.filter(a=>String(a.tenant_id)===form.elements.oem_id.value&&Number(a.id)!==Number(row?.id)))form.elements.parent_id.add(new Option(agent.name,String(agent.id)));form.elements.parent_id.value=selected||String(row?.parent_id||'');};
      const toggle=()=>{const kind=form.elements.kind.value;setVisibility('oem_id',kind!=='oem');setVisibility('parent_id',kind==='second');setVisibility('contact',kind!=='oem');setVisibility('domain_alias',kind==='oem');setVisibility('valid_days',kind==='oem'&&!row);borrow.hidden=kind!=='oem';box.disabled=kind!=='oem'||!state.canBorrow;form.elements.name.maxLength=kind==='oem'?32:80;refreshParents();};
      form.elements.kind.addEventListener('change',toggle);form.elements.oem_id.addEventListener('change',refreshParents);toggle();dialog.showModal();form.elements.name.focus();
    }
    q('[data-add]').addEventListener('click',()=>open());form.addEventListener('submit',async event=>{event.preventDefault();if(state.pending)return;state.pending=true;const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='正在保存…';q('[data-form-error]').textContent='';try{const payload={...Object.fromEntries(new FormData(form)),kind:form.elements.kind.value};if(state.row){payload.id=state.row.id;payload.oem_id=state.row.tenant_id;}if(payload.kind==='oem'&&state.canBorrow){payload.clip_borrow_platform=form.elements.clip_borrow_platform.checked;payload.clip_borrow_revision=Number(state.row?.clip_borrow?.revision||0);}await api('save',null,payload);dialog.close();await load();}catch(error){q('[data-form-error]').textContent=error.message;}finally{state.pending=false;button.disabled=false;button.textContent='保存';}});
    own.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>{if(!state.pending)dialog.close();}));dialog.addEventListener('cancel',event=>{if(state.pending)event.preventDefault();});
    filters.addEventListener('submit',event=>{event.preventDefault();state.page=1;load();});filters.addEventListener('reset',()=>setTimeout(()=>{if(own.isConnected){state.page=1;load();}},0));q('[data-prev]').addEventListener('click',()=>{if(state.page>1){state.page--;load();}});q('[data-next]').addEventListener('click',()=>{state.page++;load();});load();
  }
  function check(){const active=location.pathname.replace(/\/+$/,'')==='/platform/tenant/lists';if(!active){if(root)cleanup();return;}if(!root?.isConnected){cleanup();mount();}}
  for(const href of ['/oem/directory.css','/platform-agents/directory.css']){const css=document.createElement('link');css.rel='stylesheet';css.href=href;document.head.append(css);}
  for(const key of ['pushState','replaceState']){const original=history[key];history[key]=function(...args){const result=original.apply(this,args);queueMicrotask(check);return result;};}
  window.addEventListener('popstate',check);new MutationObserver(()=>{if(!root?.isConnected)check();}).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',check);check();
})();
