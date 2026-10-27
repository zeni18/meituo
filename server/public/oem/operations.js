/* Agent business pages use scoped APIs; the native OEM pages remain separate. */
(() => {
  'use strict';
  const routes={
    '/admin/agent-workbench':'overview','/admin/agent-services/packages':'packages',
    '/admin/agent-services/apps':'apps','/admin/agent-power/recharge':'recharge',
    '/admin/agent-power/ledger':'ledger','/admin/agent-power/quota':'quota','/admin/agent-orders':'orders'
  };
  let root=null,host=null,current='',state=null;
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;};
  const money=value=>new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0));
  const date=value=>!value?'—':Number(value)>=4294967295?'长期有效':new Date(Number(value)*1000).toLocaleString('zh-CN',{hour12:false});
  function token(){try{return JSON.parse(localStorage.getItem('__like_admin_saas_tenant__token')||'null')?.value||'';}catch{return '';}}
  async function api(action,params,body){
    const query=new URLSearchParams(params||{}),tenant=new URLSearchParams(location.search).get('tenant_id');if(tenant)query.set('tenant_id',tenant);
    const response=await fetch('/tenantapi/oem.operations/'+action+(query.size?'?'+query:''),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{token:token(),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    const result=await response.json();if(result.code!==1){if(result.code===-1)location.replace('/admin/login'+(tenant?'?tenant_id='+encodeURIComponent(tenant):''));throw Error(result.msg||'请求失败，请重试');}return result.data;
  }
  function cleanup(){root?.querySelector('dialog[open]')?.close();root?.remove();host?.classList.remove('oem-directory-active');root=null;host=null;current='';state=null;}
  function cards(container,items){container.replaceChildren();for(const [label,value]of items){const card=node('article');card.append(node('span','',label),node('strong','',value));container.append(card);}}
  function table(container,headers,rows){
    container.replaceChildren();const table=node('table'),thead=node('thead'),tr=node('tr'),tbody=node('tbody');headers.forEach(h=>tr.append(node('th','',h)));thead.append(tr);table.append(thead,tbody);container.append(table);
    for(const row of rows){const line=node('tr');for(const value of row){const td=node('td');if(value instanceof Node)td.append(value);else td.textContent=String(value??'—');line.append(td);}tbody.append(line);}
    if(!rows.length)container.append(node('p','oem-empty','暂无记录'));
  }
  function field(name,label,{value='',type='text',required=false,max=200}={}){const wrap=node('label','oem-field');wrap.append(node('span','',label+(required?' *':'')));const input=node('input');Object.assign(input,{name,type,required,maxLength:max,value});if(type==='number'){input.step='0.01';input.min='0';input.max='9999999.99';}wrap.append(input);return wrap;}
  function mount(kind){
    cleanup();host=document.querySelector('main')||document.querySelector('.el-main');if(!host)return;current=kind;
    root=node('section','oem-directory agent-operations');root.id='oem-directory';root.setAttribute('aria-label',({overview:'工作台',packages:'商家套餐',apps:'应用授权',recharge:'商家充值',ledger:'商家算力流水',quota:'我的额度流水',orders:'订单记录'})[kind]);host.classList.add('oem-directory-active');host.append(root);
    root.innerHTML='<div class="oem-stats agent-operation-stats" data-stats></div><div class="oem-panel"><form class="oem-filter"><label class="oem-search"><span class="sr-only">搜索商家名称或订单号</span><input name="keyword" placeholder="搜索商家名称" maxlength="80"></label><button class="oem-secondary" type="submit">查询</button><button class="oem-text" type="reset">重置</button><button class="oem-secondary" type="button" data-refresh>刷新</button></form><p class="oem-hint" data-hint></p><p class="oem-error" data-error role="alert"></p><div class="oem-table-wrap" data-table></div><div class="oem-pagination"><span data-count></span><div><button class="oem-secondary" data-prev>上一页</button><span data-page>1</span><button class="oem-secondary" data-next>下一页</button></div></div></div><div class="agent-dashboard-extra" data-extra></div><dialog class="oem-dialog" aria-labelledby="agent-operation-dialog-title"><form class="oem-dialog-form"><div class="oem-dialog-title"><h2 id="agent-operation-dialog-title"></h2><button class="oem-close" type="button" data-close aria-label="关闭">×</button></div><div data-fields></div><p class="oem-error" data-form-error role="alert" aria-live="polite"></p><div class="oem-dialog-actions"><button type="button" class="oem-secondary" data-close>取消</button><button class="oem-primary" type="submit">确认办理</button></div></form></dialog>';
    const own=root,q=selector=>own.querySelector(selector),filters=q('.oem-filter'),dialog=q('dialog'),form=q('.oem-dialog-form');
    const local={page:1,seq:0,pending:false,catalog:{plans:[],apps:[]},row:null,action:'',key:''};state=local;
    if(['ledger','orders'].includes(kind)){
      filters.prepend(field('date_from','开始日期',{type:'date'}),field('date_to','结束日期',{type:'date'}));
      if(kind==='orders'){const wrap=node('label','oem-field');wrap.append(node('span','','收款状态'));const select=node('select');select.name='payment_status';for(const v of ['','已支付','待支付','未登记收款','退款处理中/已退款'])select.add(new Option(v||'全部状态',v));wrap.append(select);filters.prepend(wrap);filters.elements.keyword.placeholder='搜索商家名称或订单号';}
    }
    if(kind==='overview'||kind==='quota'){filters.querySelector('.oem-search').remove();filters.querySelector('[type=submit]').remove();filters.querySelector('[type=reset]').remove();}
    if(kind==='overview')q('.oem-pagination').hidden=true;
    const hint={overview:'仅汇总你有权管理的商家。已支付金额按原支付订单累计，退款情况请结合订单状态核对；手工办理金额单独列示。',packages:'套餐由 OEM 上架；开通或续费写入真实商家权益，赠送算力扣减你的可分配额度。',apps:'只能授权 OEM 已启用且商家套餐允许的应用。取消授权后，商家调用相应功能会被拦截。',recharge:'充值从你的可分配额度扣减并转入商家余额。应收金额仅用于登记，不代表已经收款。',ledger:'显示所属商家的全部算力增减，包括充值、套餐赠送、消耗和退回。',quota:'额度由 OEM 或上级授予。一级代理可在代理列表向自己的二级代理划拨，双方额度同步增减。',orders:'合并所属商家的原套餐/充值支付订单及代理办理记录。代理办理显示未登记收款。已支付金额为累计支付金额，退款情况按订单状态单独核对。'};
    q('[data-hint]').textContent=hint[kind];
    function button(text,action,row){const el=node('button','oem-text',text);el.type='button';el.disabled=Number(row.status)!==1;el.addEventListener('click',()=>open(action,row));return el;}
    function orderRows(rows){return rows.map(row=>[row.sn,row.merchant_name,row.kind,row.item_name||'—','¥'+money(row.amount),'¥'+money(row.paid_amount),row.payment_status,row.delivery_status,date(row.create_time)]);}
    const orderHeaders=['订单号','商家','类型','项目','应收金额','已支付金额','收款状态','办理状态','创建时间'];
    async function load(){
      const seq=++local.seq;q('[data-error]').textContent='';
      try{
        const action=['packages','apps','recharge'].includes(kind)?'merchants':kind==='quota'?'walletLogs':kind;
        const data=await api(action,{...Object.fromEntries(new FormData(filters)),page:local.page});if(seq!==local.seq||!own.isConnected)return;
        if(kind==='overview'){
          const s=data.summary;cards(q('[data-stats]'),[['商家总数',s.merchants],['已启用商家',s.active],['今日新增',s.new_today],['7 天内到期',s.expiring],['可分配算力额度',money(s.balance)],['今日消耗算力',money(s.consumed_today)],['订单总数',s.orders],['已支付金额','¥'+money(s.paid_amount)],['未登记收款金额','¥'+money(s.unrecorded_amount)]]);
          q('[data-table]').replaceChildren(node('h2','agent-section-title','最近订单'));const recent=node('div','oem-table-wrap');q('[data-table]').append(recent);table(recent,orderHeaders,orderRows(data.recent_orders));
          const due=node('section','oem-panel');due.append(node('h2','agent-section-title','7 天内到期商家'));const wrap=node('div','oem-table-wrap');due.append(wrap);table(wrap,['商家','套餐','到期时间'],data.expiring_merchants.map(row=>[row.name,row.plan_name,date(row.expire_time)]));q('[data-extra]').replaceChildren(due);return;
        }
        if(['packages','apps','recharge'].includes(kind)){
          local.catalog=data.catalog;cards(q('[data-stats]'),[['匹配商家',data.count],['可分配算力额度',money(data.catalog.balance)],['可开通套餐',data.catalog.plans.length]]);
          table(q('[data-table]'),['商家 / 登录账号','所属代理','当前套餐','到期时间','可用算力','已授权应用','状态','操作'],data.lists.map(row=>{
            const identity=node('div');identity.append(node('strong','',row.name),node('small','',row.account));const actions=node('div','agent-row-actions');
            if(kind==='packages'){actions.append(button('开通套餐','assignPlan',row));if(row.plan_id&&Number(row.expire_time)<4294967295)actions.append(button('续费','renew',row));}
            else actions.append(button(kind==='apps'?'设置授权':'充值',kind==='apps'?'authorizeApps':'recharge',row));
            const status=node('span','oem-status '+(Number(row.status)===1?'is-active':''),Number(row.status)===1?'已启用':'已停用');
            return [identity,row.agent_name,row.plan_name||'未开通',date(row.expire_time),money(row.balance),row.allowed_codes.length,status,actions];
          }));
        }else if(kind==='ledger'){
          cards(q('[data-stats]'),[['查询范围增加算力',money(data.summary.increase)],['查询范围减少算力',money(data.summary.decrease)],['我的可分配额度',money(data.summary.balance)]]);
          table(q('[data-table]'),['流水号','商家','变动类型','变动算力','变动后余额','来源单号','说明','时间'],data.lists.map(row=>[row.sn,row.merchant_name,row.type_name,(Number(row.action)===1?'+':'−')+money(row.change_amount),money(row.left_amount),row.source_sn||'—',row.remark,date(row.create_time)]));
        }else if(kind==='quota'){
          cards(q('[data-stats]'),[['可分配算力额度',money(data.balance)],['额度流水',data.count]]);
          const names={quota_grant:'OEM 授予',allocation:'上下级划拨',recharge:'商家充值',membership:'套餐赠送'};
          table(q('[data-table]'),['来源单号','变动类型','变动额度','变动后额度','时间'],data.lists.map(row=>[row.sn,names[row.kind]||row.kind,(Number(row.delta)>0?'+':'−')+money(Math.abs(Number(row.delta))),money(row.balance),date(row.create_time)]));
        }else if(kind==='orders'){
          cards(q('[data-stats]'),[['匹配订单',data.summary.count],['已支付金额','¥'+money(data.summary.paid_amount)],['未登记收款金额','¥'+money(data.summary.unrecorded_amount)]]);table(q('[data-table]'),orderHeaders,orderRows(data.lists));
        }
        q('[data-count]').textContent='共 '+data.count+' 条';q('[data-page]').textContent=local.page;q('[data-prev]').disabled=local.page<=1;q('[data-next]').disabled=local.page*15>=data.count;
      }catch(error){if(seq===local.seq&&own.isConnected)q('[data-error]').textContent=error.message;}
    }
    function open(action,row){
      local.row=row;local.action=action;local.key=crypto.randomUUID();form.reset();q('[data-fields]').replaceChildren();q('[data-form-error]').textContent='';
      q('h2').textContent=({assignPlan:'开通套餐',renew:'套餐续费',authorizeApps:'设置应用授权',recharge:'商家算力充值'})[action]+' · '+row.name;
      const fields=q('[data-fields]');
      if(action==='assignPlan'||action==='renew'){
        const wrap=node('label','oem-field');wrap.append(node('span','','选择套餐 *'));const select=node('select');select.name='plan_id';select.required=true;select.add(new Option('请选择套餐',''));
        for(const plan of local.catalog.plans.filter(plan=>action!=='renew'||Number(plan.id)===Number(row.plan_id)))select.add(new Option(plan.name+' · '+(plan.permanent?'长期有效':plan.duration_months+'个月')+' · 应收 ¥'+money(plan.monthly_price)+' · 赠送 '+money(plan.monthly_bonus_points)+' 算力',String(plan.id)));
        select.value=String(row.plan_id||'');wrap.append(select);fields.append(wrap,node('p','oem-hint',action==='renew'?'续费延长当前套餐的有效期；已过期时从今日计时。赠送算力会扣减你的可分配额度。':'开通或更换套餐从今日计时。赠送算力会扣减你的可分配额度。该操作不代表已收款。'));
      }else if(action==='recharge'){
        const points=field('points','充值算力',{type:'number',required:true});points.querySelector('input').min='0.01';fields.append(points,field('amount','登记应收金额（元）',{type:'number',value:'0.00',required:true}),node('p','oem-hint','当前可分配额度：'+money(local.catalog.balance)+'。确认后立即扣减额度并增加商家余额，仅登记应收，不代表已收款。'));
      }else{
        const list=node('div','agent-app-options');for(const app of local.catalog.apps){const label=node('label','agent-app-option'),input=node('input');input.type='checkbox';input.name='app_codes';input.value=app.code;input.disabled=!row.eligible_codes.includes(app.code);input.checked=row.allowed_codes.includes(app.code);label.append(input,node('span','',app.name+(input.disabled?'（套餐未包含）':'')));list.append(label);}fields.append(list,node('p','oem-hint','未勾选的业务应用将停止授权；未包含在当前套餐中的应用不能开通。所有应用均未勾选时，该商家不能使用任何业务应用。'));
      }
      if(action!=='authorizeApps')fields.append(field('note','备注',{max:200}));dialog.showModal();const first=form.querySelector('input:not([disabled]),select');first?.focus();
    }
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(local.pending)return;local.pending=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;submit.textContent='正在办理…';q('[data-form-error]').textContent='';
      try{
        const payload={...Object.fromEntries(new FormData(form)),merchant_id:Number(local.row.id),request_key:local.key};let action=local.action;
        if(action==='assignPlan'||action==='renew'){payload.mode=action==='renew'?'renew':'open';action='assignPlan';}
        if(action==='authorizeApps')payload.app_codes=[...form.querySelectorAll('input[name=app_codes]:checked:not(:disabled)')].map(input=>input.value);
        await api(action,null,payload);dialog.close();await load();
      }catch(error){q('[data-form-error]').textContent=error.message;}finally{local.pending=false;submit.disabled=false;submit.textContent='确认办理';}
    });
    own.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',()=>{if(!local.pending)dialog.close();}));dialog.addEventListener('cancel',event=>{if(local.pending)event.preventDefault();});
    filters.addEventListener('submit',event=>{event.preventDefault();local.page=1;load();});filters.addEventListener('reset',()=>setTimeout(()=>{if(own.isConnected){local.page=1;load();}},0));q('[data-refresh]').addEventListener('click',load);q('[data-prev]').addEventListener('click',()=>{local.page--;load();});q('[data-next]').addEventListener('click',()=>{local.page++;load();});load();
  }
  function check(){const kind=token().startsWith('agent_')?routes[location.pathname.replace(/\/+$/,'')]:'';if(!kind){if(root)cleanup();return;}if(kind!==current||!root?.isConnected)mount(kind);}
  const css=document.createElement('link');css.rel='stylesheet';css.href='/oem/operations.css';document.head.append(css);
  for(const key of ['pushState','replaceState']){const original=history[key];history[key]=function(...args){const result=original.apply(this,args);queueMicrotask(check);return result;};}
  window.addEventListener('popstate',check);new MutationObserver(()=>{if(!root?.isConnected)check();}).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',check);check();
})();
