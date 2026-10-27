/* GEO publishing: an editorial directory, a scoped submission desk and recoverable bookmarks.
   Uses existing mediaPress / merchantGeo contracts. No supplier credential or price calculation lives here. */
(() => {
  'use strict';
  const VIEWS = {website:['publish','website'],influencer:['publish','influencer'],'website-orders':['publish','orders'],'website-favorites':['publish','favorites']};
  const ALIAS = {'influencer-orders':'website-orders','influencer-favorites':'website-favorites','media-orders':'website-orders','media-favorites':'website-favorites'};
  const INTENTS = {'influencer-orders':'influencer','influencer-favorites':'influencer'};
  function create(G) {
    const U=window.UK,H=G.H,{esc,icon,btn,fmt,status,when}=H;
    const money=n=>fmt(Number(n||0))+' TP';
    const node=(tag,cls,html)=>{const n=document.createElement(tag);n.className=cls||'';if(html!=null)n.innerHTML=html;return n;};
    const button=(label,action,kind='secondary',extra={})=>btn({label,kind,size:'sm',attrs:{'data-gp-action':action,...extra}});
    const submitButton=label=>btn({kind:'ghost',icon:'search',iconOnly:true,label}).replace('type="button"','type="submit"');
    const field=(label,html)=>'<label class="gp-field"><span>'+esc(label)+'</span>'+html+'</label>';
    const input=(name,value='',attrs='')=>'<input class="uk-input" name="'+name+'" value="'+esc(value)+'" '+attrs+'>';
    const select=(name,label,choices,value='')=>'<select class="uk-select" name="'+name+'" aria-label="'+label+'">'+choices.map(([v,t])=>'<option value="'+esc(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select>';
    const websiteSpecs=[['pcweight','PC 权重',[[0,'0 及以上'],[1,'1 及以上'],[2,'2 及以上'],[3,'3 及以上'],[5,'5 及以上']]],['wapweight','移动权重',[[0,'0 及以上'],[1,'1 及以上'],[2,'2 及以上'],[3,'3 及以上'],[5,'5 及以上']]],['publishtime','出稿参考',[[1,'1 小时内'],[2,'2 小时内'],[12,'半天'],[24,'当天'],[48,'隔天'],[49,'2 天以上']]],['weekendpublish','周末发布',[[1,'可发'],[0,'不可发']]],['linktype','正文网址',[[2,'可带网址'],[0,'不可带网址']]],['newsresource','新闻源',[[1,'百度新闻源'],[0,'非新闻源']]]];
    const influencerSpecs=[['authint','账号认证',[[1,'已认证'],[0,'未认证']]],['fans','粉丝区间',[[1,'0–1 千'],[5,'1–5 千'],[10,'5 千–1 万'],[50,'1–5 万'],[100,'5–10 万'],[1000,'10–100 万'],[1001,'100 万以上']]],['readnumber','阅读区间',[[1,'0–1 千'],[5,'1–5 千'],[10,'5 千–1 万'],[50,'1–5 万'],[100,'5–10 万'],[101,'10 万']]],['weekendpublish','周末发布',[[1,'可发'],[0,'不可发']]],['isvideo','视频投稿',[[1,'支持'],[0,'不支持']]],['recommend','供方推荐',[[1,'推荐'],[0,'普通']]]];
    const STATES={queued:['wait','待提交'],preparing:['run','检查中'],submitting:['run','提交中'],submitted:['run','媒体处理中'],unknown:['wait','结果待核查'],published:['ok','已发布待确认'],completed:['ok','已完成'],feedback:['wait','反馈处理中'],rejected:['fail','已退稿'],refunded:['off','已退款'],failed:['fail','未受理'],blocked:['wait','待平台核查']};
    const BILLS={reserved:['run','已预扣'],captured:['ok','已结算'],refunded:['off','已返还']};
    const stateHtml=(map,key)=>{const v=map[key]||['off',key||'—'];return status(v[0],v[1]);};
    const body=()=>G.$('.gv-body');
    let dead=false,life=0,epoch=0,brand='',tenant=U.tenant(),selected=new Map(),rows=[],data=null,availability=null,drafts=null,draftId=0,queuedIntent=null,favChannel='website',group=0,groups=[],queryBy={},ordersQuery={},favoriteQuery='',pending=null;
    const optionCache=new Map();
    let expandedCategories={};
    const dialogs=new Set(),favoriteBusy=new Set();
    const here=b=>!dead&&String(G.S.brand)===String(b)&&G.root.isConnected&&U.path()==='/ai/geo'&&U.tenant()===tenant&&!!VIEWS[G.V];
    const valid=(b,l)=>here(b)&&l===life;
    const press=(action,params={},payload,b=G.S.brand)=>G.call('mediaPress',action,{...params,brand_id:b},payload);
    const geo=(action,params={},payload,b=G.S.brand)=>G.call('merchantGeo',action,{...params,brand_id:b},payload);
    const storageKey=b=>'gp-submit:'+tenant+':'+b;
    const persist=(b,tx)=>{try{tx?localStorage.setItem(storageKey(b),JSON.stringify(tx)):localStorage.removeItem(storageKey(b));}catch{}};
    function restore(b){try{const tx=JSON.parse(localStorage.getItem(storageKey(b))||'null');return tx&&String(tx.brand)===String(b)&&tx.payload?.request_key&&tx.payload?.media_ids?.length?tx:null;}catch{return null;}}
    function dialog(options){
      const b=brand,l=life,action=options.onAction,close=options.onClose;
      const c=U.dialog({...options,onAction:async(k,ctx)=>{if(!valid(b,l)){ctx.close();return false;}return action?await action(k,ctx):undefined;},onClose:v=>{dialogs.delete(c);close?.(v);}});
      dialogs.add(c);return c;
    }
    function error(c,message){H.setErr(c,message);}
    function guard(c,key,on){const b=c.el.querySelector('[data-act="'+key+'"]');if(b)b.disabled=!!on;}
    function showError(e){if(here(brand))U.toast(String(e?.message||e),'fail');}
    const currentKind=()=>G.V==='influencer'?2:1;
    const query=()=>queryBy[currentKind()]||(queryBy[currentKind()]={page:1,page_size:20});
    const allSelected=()=>rows.length>0&&rows.every(r=>selected.has(Number(r.id)));
    const rowPrice=r=>{const id=Number(r.id),old=selected.get(id),type=Number(old?.price_type||r.price_type||r.price_options?.[0]?.price_type||1),p=r.price_options?.find(x=>Number(x.price_type)===type);return {...r,price_type:type,retail_cents:p?.retail_cents??r.retail_cents,points:p?.points??r.points};};
    function serviceNote(){
      if(pending){G.notice('<div class="uk-notice">'+icon('info')+'<span>上次投稿结果尚未明确</span>'+button('核对上次提交','pending','secondary')+'</div>');return;}
      if(availability&&!availability.publishing_ready)G.notice('<div class="uk-notice">'+icon('info')+'<span>'+(!availability.enabled?'媒体发稿待开通':'发布环境待配置')+'</span>'+button('怎么开通','service','ghost')+'</div>');
    }
    function serviceDialog(){H.soonDialog('媒体发稿待开通','请联系 OEM 或代理开通媒体发稿，并由平台配置发布域名、同步媒体目录。开通前可以准备稿件、整理收藏和查看历史投稿。');}
    function ensureScope(){
      const next=String(G.S.brand);
      if(brand!==next){brand=next;selected.clear();drafts=null;draftId=0;queryBy={};ordersQuery={};groups=[];group=0;favoriteQuery='';availability=null;optionCache.clear();expandedCategories={};pending=restore(brand);}
    }
    function selectionBar(){
      if(!here(brand)||!['website','influencer'].includes(VIEWS[G.V]?.[1]))return U.batch(null);
      const items=[...selected.values()],total=items.reduce((n,r)=>n+Number(r.retail_cents||0),0),points=items.reduce((n,r)=>n+Number(r.points||0),0);
      if(!items.length||total<=0)return U.batch(null);
      U.batch({count:items.length,actions:[{key:'picked',label:'参考 '+fmt(points)+' TP'},{key:'checkout',label:draftId?'核对费用':'选择稿件',icon:'arrowRight'}],onClear:()=>{selected.clear();syncChecks();selectionBar();},onAction:k=>k==='picked'?pickedDialog():checkout(items)});
    }
    function syncChecks(){if(!body())return;body().querySelectorAll('[data-gp-select]').forEach(e=>{e.checked=selected.has(Number(e.dataset.gpSelect));});const all=body().querySelector('[data-gp-all]');if(all){all.checked=allSelected();all.indeterminate=!all.checked&&rows.some(r=>selected.has(Number(r.id)));}}
    function toggleRows(list,on){
      const next=new Map(selected);for(const row of list){if(on&&Number(row.retail_cents)>0)next.set(Number(row.id),rowPrice(row));else if(!on)next.delete(Number(row.id));}
      if(next.size>20){U.toast('每次最多选择 20 家媒体','fail');syncChecks();return;}selected=next;syncChecks();selectionBar();
    }
    function chips(q,specs=[]){
      const labels={keyword:'名称',category:'行业',region:'地区',price:'预算',searchcollint:'收录',favorites:'收藏'};
      const values={price:{low:'10,000 TP 以内',mid:'10,000–30,000 TP',high:'30,000 TP 以上',custom:(q.min_price?fmt(Number(q.min_price)*100):'0')+'–'+(q.max_price?fmt(Number(q.max_price)*100):'不限')+' TP'},searchcollint:{1:'包收录',0:'不包收录'},favorites:{1:'仅看收藏'}};
      const entries=Object.entries(q).filter(([k,v])=>!['page','page_size','sort','min_price','max_price'].includes(k)&&v!==''&&v!=null);
      return entries.length?'<div class="gp-chips">'+entries.map(([k,v])=>{const s=specs.find(x=>x[0]===k);const value=values[k]?.[v]??s?.[2].find(x=>String(x[0])===String(v))?.[1]??v;return '<button type="button" data-gp-action="remove-filter" data-filter="'+k+'">'+esc((s?.[1]||labels[k]||k)+'：'+value)+icon('close')+'</button>';}).join('')+button('清除筛选','clear-filters','ghost')+'</div>':'';
    }
    function pager(total,page,size,kind){return '<div data-gp-pager="'+kind+'">'+U.pager(total,page,size)+'</div>';}
    const blank=(title,action)=>'<div class="gp-empty">'+U.empty({icon:'search',title,compact:true,actions:action?[{label:action[0],kind:'secondary',attrs:{'data-gp-action':action[1]}}]:[]})+'</div>';
    function windowHTML(nav,title,tools,content,footer=''){return '<section class="uk-card gp-window"><div class="gp-filter-panel"><div class="gp-tools">'+tools+'</div><div class="gp-nav"><div class="gp-nav-head"><h2>'+esc(title)+'</h2></div><div class="gp-nav-list" role="group" aria-label="'+esc(title)+'">'+nav+'</div></div></div><div class="gp-content">'+content+footer+'</div></section>';}
    function navItem(text,active,attr,meta=''){return '<button type="button" class="gp-nav-item'+(active?' is-active':'')+'" '+attr+' aria-pressed="'+active+'"><span>'+esc(text)+'</span>'+meta+'</button>';}
    function categoryNavigation(categories,q,kind){
      const expanded=!!expandedCategories[kind],label=kind===1?'行业':'平台',id='gp-category-options-'+kind;
      const visible=expanded?categories:categories.filter((name,index)=>index<8||name===q.category);
      const choices=navItem('全部'+label,!q.category,'data-gp-category=""')+visible.map(c=>navItem(c,q.category===c,'data-gp-category="'+esc(c)+'"')).join('');
      return '<div class="gp-category-choices" id="'+id+'">'+choices+'</div>'+(categories.length>8?button(expanded?'收起':'全部'+label+' · '+fmt(categories.length),'categories-toggle','ghost',{'aria-expanded':expanded,'aria-controls':id}):'');
    }
    async function loadDrafts(b=brand,force=false){if(drafts&&!force)return drafts;const r=await press('drafts',{},undefined,b);if(here(b))drafts=r.lists||[];return r.lists||[];}
    function draftRibbon(){
      const d=drafts?.find(x=>Number(x.id)===draftId);
      return draftId?'<div class="gp-draft-ribbon">'+icon('article')+'<div><small>当前稿件</small><strong>'+esc(d?.title||'正在读取稿件')+'</strong></div>'+button('查看与更换','drafts','ghost')+'</div>':'';
    }
    async function drawCatalog(seq,refresh=false){
      const b=brand,token=++epoch,kind=currentKind(),q={...query()},specs=kind===1?websiteSpecs:influencerSpecs;
      if(!refresh||!body().querySelector('.gp-window'))body().innerHTML='<div class="gp-loading">'+U.skel('100%',520,16)+'</div>';else body().querySelector('.gp-window').setAttribute('aria-busy','true');
      try{
        const [list,opt]=await Promise.all([press('media',{...q,kind},undefined,b),optionCache.get(kind)||press('mediaOptions',{kind},undefined,b),draftId&&!drafts?loadDrafts(b):Promise.resolve()]);
        if(!here(b)||token!==epoch||!G.live(seq))return;
        optionCache.set(kind,opt);
        data=list;rows=(list.lists||[]).filter(r=>[1,2].includes(Number(r.kind)));availability=list.availability;query().page=Number(list.page||q.page||1);
        rows.forEach(r=>{if(selected.has(Number(r.id)))selected.set(Number(r.id),rowPrice(r));});
        const categories=opt.categories||[],nav=categoryNavigation(categories,q,kind);
        const tools='<form class="gp-search" data-gp-form="catalog">'+input('keyword',q.keyword||'','type="search" maxlength="80" aria-label="搜索媒体" placeholder="搜索媒体"')+submitButton('搜索媒体')+'</form>'+
          select('region','地区',[['','全部地区'],...(opt.regions||[]).map(x=>[x,x])],q.region)+
          select('price','预算',[['','全部预算'],['low','10,000 TP 以内'],['mid','10,000–30,000 TP'],['high','30,000 TP 以上'],['custom','自定义预算']],q.price)+
          (kind===1?select('searchcollint','收录要求',[['','收录不限'],['1','包收录'],['0','不包收录']],q.searchcollint):'')+
          button('更多筛选'+(specs.filter(x=>q[x[0]]!==''&&q[x[0]]!=null).length?' · '+specs.filter(x=>q[x[0]]!==''&&q[x[0]]!=null).length:''),'advanced','ghost')+
          '<span class="gp-grow"></span>'+select('sort','媒体排序',[['','默认排序'],['price_asc','价格升序'],['price_desc','价格降序'],['name','名称排序']],q.sort);
        const heading='<div class="gp-list-head"><span><b>'+fmt(list.count)+'</b> 家'+(kind===1?'网站媒体':'自媒体')+'</span><label class="gp-check"><input type="checkbox" data-gp-only-favorite '+(q.favorites?'checked':'')+'>仅看收藏</label></div>';
        const table='<div class="gp-table-wrap"><table class="gp-media-table" aria-label="'+(kind===1?'网站媒体':'自媒体')+'报价"><thead><tr><th class="gp-check-col"><input type="checkbox" data-gp-all aria-label="选择本页媒体" '+(!rows.length?'disabled':'')+'></th><th>媒体名称</th>'+(kind===1?'<th class="gp-metric-col">PC / 移动</th>':'<th class="gp-metric-col">粉丝 / 阅读</th>')+'<th class="gp-speed-col">出稿参考</th><th class="gp-price-col">预计 TP / 篇</th><th class="gp-action-col">操作</th></tr></thead><tbody>'+
          rows.map(r=>{const p=rowPrice(r),m=r.metrics||{};const hints=[Number(m.searchcollint)===1&&m.searchcollint!=null?'包收录':null,m.authint===1?'已认证':null].filter(Boolean);
            return '<tr data-gp-row="'+r.id+'"><td><input type="checkbox" data-gp-select="'+r.id+'" aria-label="选择 '+esc(r.name)+'" '+(selected.has(Number(r.id))?'checked':'')+(Number(p.retail_cents)>0?'':' disabled')+'></td><td><div class="gp-media-name"><strong>'+esc(r.name)+'</strong>'+hints.map(x=>'<span class="gp-badge">'+x+'</span>').join('')+'</div><div class="gp-media-meta">'+esc([r.category,r.region].filter(Boolean).join(' · '))+(r.case_url?' · <a href="/api/mediaPress/caseOpen?media_id='+r.id+'&tenant_id='+encodeURIComponent(tenant)+'&brand_id='+encodeURIComponent(brand)+'" target="_blank" rel="noopener noreferrer">案例'+icon('external')+'</a>':'')+'</div>'+(r.remark?'<button class="gp-remark" type="button" data-gp-action="media-detail" data-id="'+r.id+'" title="'+esc(r.remark)+'">'+esc(r.remark)+'</button>':'')+'</td><td class="gp-metrics">'+(kind===1?'<b class="num">'+(m.pcweight??'—')+' <i>/</i> '+(m.wapweight??'—')+'</b>':'<b>'+esc(m.fans_label||'—')+'</b><small>'+esc(m.read_label||'—')+'</small>')+'</td><td>'+esc(m.publish_time_label||'—')+'</td><td><div class="gp-price" data-gp-price="'+r.id+'"><b class="num">'+U.tp(p.points)+'</b></div>'+((r.price_options||[]).length>1?select('tier-'+r.id,'发布方式 '+r.name,r.price_options.map(x=>[x.price_type,x.label]),p.price_type):'')+'</td><td><div class="gp-row-actions">'+btn({kind:'ghost',icon:'bookmark',iconOnly:true,label:(r.is_favorite?'取消收藏 ':'收藏 ')+r.name,attrs:{'data-gp-action':'favorite','data-id':r.id,'aria-pressed':!!r.is_favorite}})+button('送稿','one','secondary',{'data-id':r.id,...(Number(p.retail_cents)>0?{}:{disabled:true})})+'</div></td></tr>';}).join('')+'</tbody></table></div>';
        body().innerHTML=draftRibbon()+windowHTML(nav,kind===1?'行业领域':'所属平台',tools,chips(q,specs)+heading+table+(!rows.length?blank(!availability?.enabled?'媒体目录待开通':Object.keys(q).some(k=>!['page','page_size'].includes(k)&&q[k]!==''&&q[k]!=null)?'没有符合条件的媒体':'媒体目录暂时没有资源',!availability?.enabled?['怎么开通','service']:Object.keys(q).some(k=>!['page','page_size','sort'].includes(k)&&q[k]!==''&&q[k]!=null)?['清除筛选','clear-filters']:['刷新目录','refresh']):''),pager(list.count,list.page,list.page_size,'catalog'));
        syncChecks();selectionBar();serviceNote();
      }catch(e){if(here(b)&&token===epoch)body().innerHTML=G.errBox(e.message);}
    }
    function applyFilter(patch){Object.assign(query(),{page:1},patch);drawCatalog(G.S.seq,true);}
    function advancedDialog(){
      const q={...query()},specs=currentKind()===1?websiteSpecs:influencerSpecs;
      const f=node('form','gp-form',specs.map(([k,label,items])=>field(label,select(k,label,[['','不限'],...items],q[k]))).join('')+'<div class="gp-form-span gp-budget"><h3>自定义预算</h3>'+field('最低预算（TP）',input('min_price',q.min_price?String(Number(q.min_price)*100):'','inputmode="decimal" maxlength="11" placeholder="不限"'))+field('最高预算（TP）',input('max_price',q.max_price?String(Number(q.max_price)*100):'','inputmode="decimal" maxlength="11" placeholder="不限"'))+'</div>');
      const c=dialog({title:'媒体筛选',width:640,body:f,actions:[{key:'reset',label:'清空',kind:'ghost'},{key:'cancel',label:'取消',kind:'secondary'},{key:'apply',label:'应用筛选',kind:'primary'}],onAction(k,ctx){
        if(k==='reset'){f.reset();f.querySelectorAll('input,select').forEach(e=>e.value='');return false;}if(k!=='apply')return;
        const form=new FormData(f),patch=Object.fromEntries(specs.map(([key])=>[key,form.get(key)||''])),min=String(form.get('min_price')||'').trim(),max=String(form.get('max_price')||'').trim(),re=/^(0|[1-9]\d{0,9})$/;
        if(min&&!re.test(min)||max&&!re.test(max)){error(ctx,'预算请输入整数 TP');return false;}
        if(min&&max&&Number(min)>Number(max)){error(ctx,'最低预算不能高于最高预算');return false;}
        if(min||max)Object.assign(patch,{price:'custom',min_price:min?(Number(min)/100).toFixed(2):'',max_price:max?(Number(max)/100).toFixed(2):''});else if(q.price==='custom')Object.assign(patch,{price:'',min_price:'',max_price:''});
        ctx.close();applyFilter(patch);return false;
      }});f.onsubmit=e=>{e.preventDefault();c.el.querySelector('[data-act="apply"]').click();};
    }
    function pickedDialog(){
      const box=node('div','gp-picked');
      const draw=()=>{box.innerHTML=[...selected.values()].map(r=>'<div><span><strong>'+esc(r.name)+'</strong><small>'+fmt(r.points)+' TP</small></span>'+button('移除','remove-picked','ghost',{'data-id':r.id})+'</div>').join('')||'<p class="uk-meta">还没有选择媒体</p>';};
      draw();box.onclick=e=>{const b=e.target.closest('[data-id]');if(!b)return;selected.delete(Number(b.dataset.id));draw();syncChecks();selectionBar();};
      dialog({title:'已选媒体 · '+selected.size+' / 20',width:560,body:box,actions:[{key:'close',label:'继续选媒体',kind:'secondary'},{key:'next',label:'选择稿件与核对',kind:'primary'}],onAction(k,c){if(k==='next'){if(!selected.size){error(c,'请先选择媒体');return false;}c.close();checkout([...selected.values()]);return false;}}});
    }
    async function chooseDraft(onPick){
      const b=brand,l=life,box=node('div','gp-draft-picker',U.skel('100%',360,16)),c=dialog({title:'发稿稿件',width:940,body:box,actions:[{key:'new',label:'新建稿件',kind:'secondary'},{key:'use',label:'使用这篇稿件',kind:'primary'}],onAction(k,ctx){
        if(k==='new'){newDraft(row=>{if(!valid(b,l))return;draftId=Number(row.id);ctx.close();onPick?.(row);G.drawHead();});return false;}
        if(k==='use'){const row=drafts?.find(x=>Number(x.id)===pick);if(!row){error(ctx,'请选择一篇稿件');return false;}draftId=Number(row.id);ctx.close();onPick?.(row);if(body().querySelector('.gp-window')&&['website','influencer'].includes(VIEWS[G.V]?.[1]))drawCatalog(G.S.seq,true);G.drawHead();selectionBar();return false;}
      }});
      let pick=draftId;guard(c,'use',true);
      const paint=()=>{box.innerHTML='<div class="gp-draft-list">'+(drafts.length?drafts.map(r=>'<button type="button" data-draft="'+r.id+'" class="'+(Number(r.id)===pick?'is-active':'')+'"><strong>'+esc(r.title)+'</strong><small>'+when(r.create_time)+'</small></button>').join(''):blank('这个品牌还没有发稿稿件'))+'</div><article class="gp-paper" tabindex="0"></article>';preview();};
      const preview=()=>{const r=drafts.find(x=>Number(x.id)===pick),paper=box.querySelector('.gp-paper');paper.innerHTML=r?'<div class="gp-paper-meta">'+fmt(String(r.body||'').length)+' 字 · '+when(r.create_time)+'</div><h2>'+esc(r.title)+'</h2><div class="gp-prose">'+esc(r.body)+'</div>':blank('选择稿件后在这里阅读');guard(c,'use',!r);box.querySelectorAll('[data-draft]').forEach(e=>e.classList.toggle('is-active',Number(e.dataset.draft)===pick));};
      box.onclick=e=>{const a=e.target.closest('[data-draft]');if(a){pick=Number(a.dataset.draft);preview();}};
      try{await loadDrafts(b,true);if(!valid(b,l)||!c.el.isConnected)return;if(!drafts.some(r=>Number(r.id)===pick))pick=Number(drafts[0]?.id||0);paint();}catch(e){if(valid(b,l)&&c.el.isConnected)error(c,e.message);}
    }
    function newDraft(onSaved,old={}){
      const b=brand,l=life,f=node('form','gp-form gp-draft-form',field('稿件标题',input('title',old.title||'','required maxlength="120" autofocus'))+field('稿件正文','<textarea class="uk-textarea" name="body" required maxlength="100000" rows="14">'+esc(old.body||'')+'</textarea>'));
      const c=dialog({title:old.id?'另存稿件':'新建发稿稿件',width:800,body:f,actions:[{key:'cancel',label:'取消',kind:'secondary'},{key:'save',label:'保存稿件',kind:'primary'}],async onAction(k,ctx){
        if(k!=='save')return;if(!f.reportValidity())return false;const title=f.elements.title.value.trim(),text=f.elements.body.value.trim();if(!title||!text){error(ctx,'请填写标题和正文');return false;}ctx.busy('save',true);
        try{const row=await press('draftSave',{}, {title,body:text},b);if(!valid(b,l))return false;drafts=[row,...(drafts||[])];draftId=Number(row.id);ctx.close();U.toast('稿件已保存');onSaved?.(row);selectionBar();if(!onSaved&&['website','influencer'].includes(G.V)){G.drawHead();drawCatalog(G.S.seq,true);}return false;}catch(e){if(valid(b,l)){error(ctx,e.message);ctx.busy('save',false);}return false;}
      }});f.onsubmit=e=>{e.preventDefault();c.el.querySelector('[data-act="save"]').click();};
    }
    async function checkout(items){
      if(pending)return confirmQuote(pending);
      if(!items.length)return;
      const b=brand,l=life,frozen=items.map(r=>({...rowPrice(r)}));
      if(frozen.length>20)return U.toast('每次最多选择 20 家媒体','fail');
      const box=node('div','gp-checkout','<div class="gp-step"><b>01</b><span>核对媒体</span><i></i><b>02</b><span>选择稿件</span><i></i><b>03</b><span>获取报价</span></div><div class="gp-checkout-media">'+frozen.map(r=>'<div><strong>'+esc(r.name)+'</strong><span class="num">'+money(r.retail_cents)+'</span></div>').join('')+'</div><div class="gp-draft-chosen"></div><div class="gp-origin">'+field('来源白名单标识（选填）',input('origin','','maxlength="1000" placeholder="有媒体要求时填写"'))+'</div>');
      const c=dialog({title:'准备投稿 · '+frozen.length+' 家媒体',width:760,drawer:true,body:box,actions:[{key:'cancel',label:'继续选媒体',kind:'secondary'},{key:'quote',label:'核对最新费用',kind:'primary'}],async onAction(k,ctx){
        if(k!=='quote')return;
        if(!availability?.publishing_ready){error(ctx,'发布环境待开通，暂时不能获取有效报价');return false;}
        const d=drafts?.find(r=>Number(r.id)===draftId);if(!d){error(ctx,'请先选择一篇发稿稿件');return false;}ctx.busy('quote',true);
        const payload={draft_id:Number(draftId),media_ids:frozen.map(r=>Number(r.id)).sort((a,b)=>a-b),price_types:Object.fromEntries(frozen.map(r=>[r.id,Number(r.price_type||1)])),origin:box.querySelector('[name="origin"]').value.trim()};
        try{const quote=await press('quote',{},payload,b);if(!valid(b,l)||!c.el.isConnected)return false;ctx.close();confirmQuote({brand:b,draftTitle:d.title,quote,payload:{...payload,quote_hash:quote.quote_hash,expires_at:quote.expires_at,request_key:H.key('press'),confirmed:true,remark:''},unknown:false});}catch(e){if(valid(b,l)){error(ctx,e.message);ctx.busy('quote',false);}}return false;
      }});
      const renderDraft=()=>{if(!valid(b,l)||!c.el.isConnected)return;const r=drafts?.find(x=>Number(x.id)===draftId),el=box.querySelector('.gp-draft-chosen');el.innerHTML='<div><small>发稿稿件</small><strong>'+esc(r?.title||'还没有选择稿件')+'</strong></div>'+button(r?'查看与更换':'选择稿件','pick-draft','secondary')+(r?'<details><summary>阅读正文</summary><div class="gp-prose">'+esc(r.body)+'</div></details>':'');guard(c,'quote',!r||!availability?.publishing_ready);};
      box.onclick=e=>{if(e.target.closest('[data-gp-action="pick-draft"]'))chooseDraft(renderDraft);};
      if(!availability?.publishing_ready)box.append(node('div','uk-notice',icon('info')+'<span>可准备稿件，媒体发稿'+(!availability?.enabled?'待开通':'环境待配置')+'</span>'));
      renderDraft();try{await loadDrafts(b);if(valid(b,l))renderDraft();}catch(e){if(valid(b,l))error(c,e.message);}
    }
    function confirmQuote(tx){
      const b=String(tx.brand),l=life,q=tx.quote;if(!valid(b,l))return;
      const box=node('div','gp-quote','<div class="gp-quote-heading"><small>发稿稿件</small><h3>'+esc(tx.draftTitle)+'</h3></div><div class="gp-quote-lines">'+(q.items||[]).map(r=>'<div><span><strong>'+esc(r.name)+'</strong><small>'+esc(r.price_label||'标准发布')+'</small></span><span><b class="num">'+U.tp(r.points)+'</b></span></div>').join('')+'</div><div class="gp-quote-total"><span>合计 / 预扣</span><strong class="num">'+U.tp(q.points)+'</strong>'+'</div><p class="gp-small" data-gp-expiry>报价有效至 '+when(q.expires_at)+'</p><label class="gp-consent"><input type="checkbox" '+(tx.unknown?'checked':'')+'>我已核对稿件、媒体和费用，同意预扣并提交</label><p class="gp-small">媒体发布与 AI 收录分别核验，发布结果以真实回链为准。</p>');
      const c=dialog({title:tx.unknown?'核对上次投稿':'核对发稿费用',width:760,body:box,onClose(){document.removeEventListener('uk:balance',balanceChanged);},actions:[{key:'cancel',label:'暂不提交',kind:'secondary'},{key:'submit',label:tx.unknown?'核对上次提交':'确认预扣并提交',kind:'primary'}],async onAction(k,ctx){
        if(k!=='submit')return;if(tx.rejected){ctx.close();checkout((q.items||[]).map(r=>({...r,price_options:[{...r,label:r.price_label}]})));return false;}
        if(!box.querySelector('input').checked)return false;
        if(!tx.unknown&&Number(q.expires_at)*1000<=Date.now()){error(ctx,'报价已过期，请重新核对费用');tx.rejected=true;ctx.el.querySelector('[data-act="submit"] span').textContent='重新核对费用';guard(ctx,'submit',false);return false;}
        const retrying=tx.unknown,frozen=JSON.parse(JSON.stringify(tx.payload));tx.unknown=true;pending=tx;persist(b,tx);ctx.busy('submit',true);
        try{await press('create',{},frozen,b);persist(b,null);if(valid(b,l)){pending=null;(tx.payload.media_ids||[]).forEach(id=>selected.delete(Number(id)));ctx.close();U.toast('投稿已受理，等待媒体回执');G.go('website-orders',true);} }
        catch(e){if(!valid(b,l))return false;if(e.answered&&!retrying&&e.message!=='媒体发稿操作失败，请稍后重试'){pending=null;persist(b,null);tx.unknown=false;tx.rejected=true;error(ctx,String(e.message).replace(/算力/g,'TP'));ctx.el.querySelector('[data-act="submit"] span').textContent='重新核对费用';}else{error(ctx,'上次提交仍需核查。请稍后沿用原请求核对，或查看投稿记录；请勿重复下单。');ctx.el.querySelector('[data-act="submit"] span').textContent='核对上次提交';}ctx.busy('submit',false);serviceNote();}return false;
      }});
      let balance=null;
      const accept=box.querySelector('input'),refresh=()=>guard(c,'submit',!accept.checked||(!tx.unknown&&balance!==null&&balance<Number(q.points)));
      accept.onchange=refresh;refresh();
      function balanceChanged(event){const value=typeof event==='object'?event.detail:event;if(!valid(b,l)||!c.el.isConnected||value==null)return;balance=Number(value);box.querySelector('.gp-balance')?.remove();const info=node('div','gp-balance');info.innerHTML='<span>可用 '+U.tp(balance)+'</span>'+(!tx.unknown&&balance<Number(q.points)?'<span class="gp-shortage">还差 '+U.tp(Number(q.points)-balance)+'</span>'+button('充值','recharge','secondary'):'');box.insertBefore(info,box.querySelector('.gp-consent'));info.onclick=e=>{if(e.target.closest('[data-gp-action="recharge"]'))U.openRecharge();};refresh();}
      document.addEventListener('uk:balance',balanceChanged);U.loadBalance().then(balanceChanged).catch(()=>{});
      if(tx.unknown)error(c,'上次提交结果尚未明确，请沿用原请求核对。');
    }
    async function mediaDetail(row){
      const m=row.metrics||{},values=currentKind()===1?[['PC 权重',m.pcweight],['移动权重',m.wapweight],['出稿参考',m.publish_time_label],['周末可发',m.weekendpublish==null?null:m.weekendpublish?'可发':'不可发']]:[['粉丝区间',m.fans_label],['阅读区间',m.read_label],['账号认证',m.authint==null?null:m.authint?'已认证':'未认证']];
      dialog({title:row.name,width:600,drawer:true,body:'<div class="gp-detail"><div class="gp-detail-price"><strong>'+U.tp(row.points)+'</strong>'+'</div><dl>'+[['行业 / 地区',[row.category,row.region].filter(Boolean).join(' / ')],...values].map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v??'未提供')+'</dd></div>').join('')+'</dl>'+(row.remark?'<h3>媒体要求</h3><p class="gp-prose">'+esc(row.remark)+'</p>':'')+'</div>',actions:[{key:'close',label:'关闭',kind:'secondary'},{key:'use',label:'选择这家媒体',kind:'primary'}],onAction(k){if(k==='use')toggleRows([row],true);}});
    }
    async function toggleFavorite(row,control){
      const b=brand,l=life,id=Number(row.id);if(favoriteBusy.has(id))return;favoriteBusy.add(id);control.disabled=true;
      try{const r=await press('favorite',{}, {media_id:id,favorite:!row.is_favorite},b);if(valid(b,l)){row.is_favorite=!!r.is_favorite;control.setAttribute('aria-pressed',String(row.is_favorite));control.setAttribute('aria-label',(row.is_favorite?'取消收藏 ':'收藏 ')+row.name);U.toast(row.is_favorite?'已加入收藏':'已移入收藏回收站');}}
      catch(e){if(valid(b,l))showError(e);}finally{favoriteBusy.delete(id);if(control.isConnected)control.disabled=false;}
    }
    const orderStates=[['','全部投稿'],['submitted','媒体处理中'],['published','待确认发布'],['unknown','结果待核查'],['feedback','反馈处理中'],['completed','已完成'],['rejected','已退稿'],['refunded','已退款'],['failed','未受理'],['blocked','待平台核查']];
    async function drawOrders(seq,refresh=false){
      const b=brand,token=++epoch,q={...ordersQuery};if(!refresh||!body().querySelector('.gp-window'))body().innerHTML='<div class="gp-loading">'+U.skel('100%',500,16)+'</div>';else body().querySelector('.gp-window').setAttribute('aria-busy','true');
      try{const r=await press('orders',{...q,page:q.page||1},undefined,b);if(!here(b)||token!==epoch||!G.live(seq))return;data=r;rows=r.lists||[];availability=r.availability;
        const nav=orderStates.map(([v,t])=>navItem(t,(q.state||'')===v,'data-gp-state="'+v+'"')).join('');
        const tools='<form class="gp-search" data-gp-form="orders">'+input('keyword',q.keyword||'','type="search" maxlength="80" aria-label="搜索投稿记录" placeholder="稿件、媒体或订单号"')+submitButton('搜索投稿记录')+'</form>'+select('order-kind','媒体类型',[['','全部媒体'],['1','国内软文'],['2','自媒体']],q.kind)+button('日期筛选','dates','ghost')+'<span class="gp-grow"></span>'+button('重置','clear-orders','ghost')+button('刷新','refresh','ghost');
        const s=r.summary||{},stats='<div class="gp-ledger">'+[['投稿',s.count,'条'],['预扣中',s.reserved_cents,'TP'],['已结算',s.consumed_cents,'TP'],['已返还',s.refunded_cents,'TP']].map(([k,v,unit])=>'<div><span>'+k+'</span><strong class="num">'+fmt(v)+'</strong><small>'+unit+'</small></div>').join('')+'</div>';
        const table='<div class="gp-table-wrap"><table class="gp-orders-table" aria-label="投稿记录"><thead><tr><th>稿件 / 订单</th><th>媒体</th><th>金额 / TP</th><th>发布 / 结算</th><th>时间</th><th>操作</th></tr></thead><tbody>'+rows.map(x=>'<tr><td><strong class="gp-title">'+esc(x.title)+'</strong><small class="gp-order-sn">'+esc(x.sn)+'</small></td><td>'+esc(x.media_name)+'</td><td><b class="num">'+U.tp(x.points)+'</b></td><td><div class="gp-order-status">'+stateHtml(STATES,x.state)+stateHtml(BILLS,x.billing_status)+'</div></td><td class="gp-time">'+when(x.create_time)+'</td><td>'+button('详情','order-detail','ghost',{'data-id':x.id})+'</td></tr>').join('')+'</tbody></table></div>';
        body().innerHTML=windowHTML(nav,'投稿状态',tools,stats+(q.date_from||q.date_to?'<div class="gp-chips"><span>'+esc(q.date_from||'不限')+' — '+esc(q.date_to||'不限')+'</span></div>':'')+table+(!rows.length?blank('还没有符合条件的投稿记录',['选择媒体','catalog']):''),pager(r.count,r.page,r.page_size,'orders'));U.batch(null);serviceNote();
      }catch(e){if(here(b)&&token===epoch)body().innerHTML=G.errBox(e.message);}
    }
    function dateDialog(){
      const f=node('form','gp-form',field('开始日期',input('date_from',ordersQuery.date_from||'','type="date"'))+field('结束日期',input('date_to',ordersQuery.date_to||'','type="date"')));
      dialog({title:'投稿日期',width:520,body:f,actions:[{key:'clear',label:'清除日期',kind:'ghost'},{key:'cancel',label:'取消',kind:'secondary'},{key:'apply',label:'应用',kind:'primary'}],onAction(k,c){if(k==='cancel')return;const values=k==='clear'?{date_from:'',date_to:''}:Object.fromEntries(new FormData(f));if(values.date_from&&values.date_to&&values.date_from>values.date_to){error(c,'结束日期不能早于开始日期');return false;}Object.assign(ordersQuery,values,{page:1});c.close();drawOrders(G.S.seq,true);return false;}});
    }
    async function orderDetail(id){
      const b=brand,l=life,c=dialog({title:'投稿详情',width:760,drawer:true,body:U.skel('100%',420,16),actions:[{key:'close',label:'关闭',kind:'secondary'}]});
      try{const r=await press('detail',{id},undefined,b);if(!valid(b,l)||!c.el.isConnected)return;const safe=H.isUrl(r.published_url),can=r.state==='published'&&['','failed'].includes(r.process_state||'')&&r.billing_status!=='refunded';
        c.body.innerHTML='<div class="gp-order-detail"><div class="gp-order-status">'+stateHtml(STATES,r.state)+stateHtml(BILLS,r.billing_status)+'</div><h2>'+esc(r.media_name)+'</h2><small class="gp-order-sn">'+esc(r.sn)+'</small><div class="gp-detail-price"><strong>'+U.tp(r.points)+'</strong>'+'</div><dl><div><dt>创建</dt><dd>'+when(r.create_time)+'</dd></div><div><dt>更新</dt><dd>'+when(r.update_time)+'</dd></div><div><dt>发布方式</dt><dd>'+esc(Number(r.price_type)===1?'标准发布':String(r.price_type||'—'))+'</dd></div></dl>'+(r.failure_reason?'<div class="uk-notice">'+icon('info')+'<span>'+esc(r.failure_reason)+'</span></div>':'')+(safe?'<a class="gp-receipt" target="_blank" rel="noopener noreferrer" href="'+esc(r.published_url)+'">'+icon('external')+'查看发布回链</a>':'')+(r.refund_evidence?'<p class="gp-small">返还凭证：'+esc(r.refund_evidence)+'</p>':'')+(can?'<div class="gp-detail-actions">'+button('向媒体反馈','feedback')+button('确认发布完成','complete','primary')+'</div>':'')+(['queued','unknown','accepted'].includes(r.process_state)?'<p class="gp-small">处理已提交，等待媒体回执。</p>':'')+'<details class="gp-draft-details"><summary>投稿稿件</summary><article class="gp-paper"><h2>'+esc(r.draft?.title||r.title)+'</h2><div class="gp-prose">'+esc(r.draft?.body||'')+'</div></article></details></div>';
        c.body.onclick=e=>{if(e.target.closest('[data-gp-action="feedback"]'))processDialog(r,4,c);if(e.target.closest('[data-gp-action="complete"]'))processDialog(r,5,c);};
      }catch(e){if(valid(b,l)&&c.el.isConnected)error(c,e.message);}
    }
    function processDialog(row,flag,parent){
      const b=brand,l=life,f=node('form','gp-form gp-draft-form','<p>'+esc(row.media_name)+' · '+esc(row.title)+'</p>'+field(flag===4?'反馈内容':'备注（选填）','<textarea class="uk-textarea" name="note" rows="5" maxlength="1000" '+(flag===4?'required':'')+'></textarea>')+'<p class="gp-small">'+(flag===4?'反馈将交给媒体服务商处理。':'请先打开回链核对稿件，确认后更新订单状态。')+'</p>');
      dialog({title:flag===4?'向媒体反馈':'确认发布完成',width:580,body:f,actions:[{key:'cancel',label:'取消',kind:'secondary'},{key:'send',label:flag===4?'提交反馈':'确认完成',kind:'primary'}],async onAction(k,c){if(k!=='send')return;if(!f.reportValidity())return false;c.busy('send',true);try{await press('process',{}, {id:Number(row.id),flag,note:f.elements.note.value.trim()},b);if(valid(b,l)){c.close();parent.close();U.toast('处理已提交，等待媒体回执');drawOrders(G.S.seq,true);}}catch(e){if(valid(b,l)){error(c,e.message);c.busy('send',false);}}return false;}});
    }
    async function exportOrders(){
      const b=brand,l=life;try{const r=await press('export',{...ordersQuery},undefined,b);if(!valid(b,l))return;const parts=String(r.csv||'').split('\r\n');parts[0]=parts[0].replace(/算力/g,'TP');download('投稿记录.csv',parts.join('\r\n'));U.toast('已导出 '+r.count+' 条'+(r.truncated?'（最多 5000 条，请缩小日期范围）':''));}catch(e){if(valid(b,l))showError(e);}
    }
    function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    async function allGroups(channel,b=brand,trash=false){
      const result=[];let page=1,count=Infinity;while(result.length<count){const r=await geo('resources',{kind:'favorite_group',channel,trash:trash?1:0,page,page_size:500},undefined,b);if(!here(b))return [];result.push(...(r.lists||[]));count=Number(r.count);if(!r.lists?.length)break;page++;}return result;
    }
    async function drawFavorites(seq,refresh=false){
      const b=brand,token=++epoch,channel=favChannel;if(!refresh||!body().querySelector('.gp-window'))body().innerHTML='<div class="gp-loading">'+U.skel('100%',500,16)+'</div>';else body().querySelector('.gp-window').setAttribute('aria-busy','true');
      try{const [f,gs]=await Promise.all([geo('resources',{kind:'favorite',channel,group_id:group,keyword:favoriteQuery,page:queryBy.favPage||1,page_size:20},undefined,b),allGroups(channel,b)]);if(!here(b)||token!==epoch||!G.live(seq))return;rows=f.lists||[];data=f;groups=gs;
        const nav=navItem('全部收藏',!group,'data-gp-group="0"')+groups.map(r=>navItem(r.title,group===Number(r.id),'data-gp-group="'+r.id+'"')).join('')+button('管理分组','groups','ghost');
        const tools='<form class="gp-search" data-gp-form="favorites">'+input('keyword',favoriteQuery,'type="search" maxlength="80" aria-label="搜索收藏" placeholder="搜索收藏"')+submitButton('搜索收藏')+'</form>'+select('favorite-channel','收藏类型',[['website','网站媒体'],['influencer','自媒体']],channel)+'<span class="gp-grow"></span>'+button('回收站','trash','ghost')+button('查看实时报价','favorite-prices');
        const table='<div class="gp-list-head"><span><b>'+fmt(f.count)+'</b> 个收藏</span>'+button('新增分组','new-group','ghost')+'</div><div class="gp-table-wrap"><table class="gp-favorites-table" aria-label="媒体收藏"><thead><tr><th>媒体</th><th>分组</th><th>收藏时间</th><th>操作</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><strong>'+esc(r.title)+'</strong>'+(r.content?'<small class="gp-favorite-note">'+esc(r.content)+'</small>':'')+'</td><td>'+esc(groups.find(g=>Number(g.id)===Number(r.data?.group_id))?.title||(r.data?.group_id?'已移除的分组':'未分组'))+'</td><td class="gp-time">'+when(r.create_time)+'</td><td><div class="gp-row-actions">'+button('查看报价','locate-favorite','ghost',{'data-id':r.id})+btn({kind:'ghost',icon:'more',iconOnly:true,label:'管理 '+r.title,attrs:{'data-gp-action':'favorite-more','data-id':r.id}})+'</div></td></tr>').join('')+'</tbody></table></div>';
        body().innerHTML=windowHTML(nav,'收藏分组',tools,table+(!rows.length?blank(favoriteQuery?'没有符合条件的收藏':'这个分组还没有收藏',['选择媒体','catalog']):''),pager(f.count,f.page,f.page_size,'favorites'));U.batch(null);serviceNote();
      }catch(e){if(here(b)&&token===epoch)body().innerHTML=G.errBox(e.message);}
    }
    function editGroup(row={}){
      const b=brand,l=life,channel=favChannel,f=node('form','gp-form gp-draft-form',field('分组名称',input('title',row.title||'','required maxlength="255" autofocus')));
      const c=dialog({title:row.id?'重命名分组':'新建收藏分组',width:480,body:f,actions:[{key:'cancel',label:'取消',kind:'secondary'},{key:'save',label:'保存',kind:'primary'}],async onAction(k,ctx){if(k!=='save')return;if(!f.reportValidity())return false;const title=f.elements.title.value.trim();if(!title){error(ctx,'请填写分组名称');return false;}ctx.busy('save',true);try{await geo('resourceSave',{}, {kind:'favorite_group',id:Number(row.id||0),revision:Number(row.revision||0),title,channel},b);if(valid(b,l)){ctx.close();U.toast('分组已保存');drawFavorites(G.S.seq,true);}}catch(e){if(valid(b,l)){error(ctx,e.message);ctx.busy('save',false);}}return false;}});f.onsubmit=e=>{e.preventDefault();c.el.querySelector('[data-act="save"]').click();};
    }
    function manageGroups(){
      const box=node('div','gp-group-manager',groups.map(r=>'<div><strong>'+esc(r.title)+'</strong>'+button('重命名','rename-group','ghost',{'data-id':r.id})+button('移入回收站','recycle-group','ghost',{'data-id':r.id})+'</div>').join('')||blank('还没有收藏分组'));
      const c=dialog({title:'收藏分组',width:600,body:box,actions:[{key:'close',label:'关闭',kind:'secondary'},{key:'new',label:'新增分组',kind:'primary'}],onAction(k,ctx){if(k==='new'){ctx.close();editGroup();return false;}}});
      box.onclick=e=>{const a=e.target.closest('[data-gp-action]');if(!a)return;const r=groups.find(x=>Number(x.id)===Number(a.dataset.id));if(!r)return;c.close();if(a.dataset.gpAction==='rename-group')editGroup(r);else recycleResource('favorite_group',r);};
    }
    async function recycleResource(kind,row,restore=false){
      const b=brand,l=life;try{await geo('resourceRecycle',{}, {kind,id:Number(row.id),revision:Number(row.revision),restore:restore?1:0},b);if(valid(b,l)){if(kind==='favorite_group'&&group===Number(row.id))group=0;U.toast(restore?'已恢复':'已移入回收站');drawFavorites(G.S.seq,true);}}catch(e){if(valid(b,l))showError(e);}
    }
    function moveFavorite(row){
      const b=brand,l=life,f=node('form','gp-form gp-draft-form',field('目标分组',select('group_id','目标分组',[[0,'未分组'],...groups.map(r=>[r.id,r.title])],row.data?.group_id||0)));
      dialog({title:'移动收藏 · '+row.title,width:500,body:f,actions:[{key:'cancel',label:'取消',kind:'secondary'},{key:'save',label:'移动',kind:'primary'}],async onAction(k,c){if(k!=='save')return;c.busy('save',true);try{await geo('resourceSave',{}, {kind:'favorite',id:Number(row.id),revision:Number(row.revision),title:row.title,content:row.content||'',media_id:Number(row.data.media_id),channel:favChannel,group_id:Number(f.elements.group_id.value)},b);if(valid(b,l)){c.close();U.toast('收藏已移动');drawFavorites(G.S.seq,true);}}catch(e){if(valid(b,l)){error(c,e.message);c.busy('save',false);}}return false;}});
    }
    async function trashDialog(){
      const b=brand,l=life,box=node('div','gp-trash',U.skel('100%',260,16)),c=dialog({title:'收藏回收站',width:660,body:box,actions:[{key:'close',label:'关闭',kind:'secondary'}]});let list=[],kind='favorite',page=1;
      async function paint(){box.setAttribute('aria-busy','true');try{const r=await geo('resources',{kind,channel:favChannel,trash:1,page,page_size:20},undefined,b);if(!valid(b,l)||!c.el.isConnected)return;list=r.lists||[];box.innerHTML='<div class="gp-trash-tabs"><button type="button" data-trash-kind="favorite" aria-pressed="'+(kind==='favorite')+'">媒体收藏</button><button type="button" data-trash-kind="favorite_group" aria-pressed="'+(kind==='favorite_group')+'">收藏分组</button></div>'+list.map(x=>'<div class="gp-trash-row"><strong>'+esc(x.title)+'</strong>'+button('恢复','restore','secondary',{'data-id':x.id})+'</div>').join('')+(!list.length?blank('回收站里没有'+(kind==='favorite'?'媒体收藏':'收藏分组')):'')+pager(r.count,page,r.page_size,'trash');}catch(e){if(valid(b,l))error(c,e.message);}finally{box.removeAttribute('aria-busy');}}
      box.onclick=async e=>{const tab=e.target.closest('[data-trash-kind]');if(tab){kind=tab.dataset.trashKind;page=1;paint();return;}const pg=e.target.closest('[data-page]');if(pg&&!pg.disabled){page=Number(pg.dataset.page);paint();return;}const a=e.target.closest('[data-gp-action="restore"]');if(!a)return;const row=list.find(x=>Number(x.id)===Number(a.dataset.id));a.disabled=true;try{await geo('resourceRecycle',{}, {kind,id:Number(row.id),revision:Number(row.revision),restore:1},b);if(valid(b,l)){U.toast('已恢复');await paint();drawFavorites(G.S.seq,true);}}catch(err){if(valid(b,l)){error(c,err.message);a.disabled=false;}}};paint();
    }
    function change(e){
      if(!here(brand))return;
      const t=e.target;if(t.matches('[data-gp-select]'))return toggleRows(rows.filter(r=>Number(r.id)===Number(t.dataset.gpSelect)),t.checked);
      if(t.matches('[data-gp-all]'))return toggleRows(rows,t.checked);
      if(t.matches('[data-gp-only-favorite]'))return applyFilter({favorites:t.checked?1:''});
      if(['region','price','searchcollint','sort'].includes(t.name)){if(t.name==='price'&&t.value==='custom'){advancedDialog();return;}applyFilter({[t.name]:t.value,...(t.name==='price'?{min_price:'',max_price:''}:{})});return;}
      if(t.name?.startsWith('tier-')){const id=Number(t.name.slice(5)),r=rows.find(x=>Number(x.id)===id),p=r.price_options.find(x=>Number(x.price_type)===Number(t.value));r.price_type=Number(t.value);if(selected.has(id))selected.set(id,{...r,price_type:Number(t.value),retail_cents:p.retail_cents,points:p.points});const el=body().querySelector('[data-gp-price="'+id+'"]');el.innerHTML='<b class="num">'+U.tp(p.points)+'</b>';selectionBar();return;}
      if(t.name==='order-kind'){ordersQuery.kind=t.value;ordersQuery.page=1;drawOrders(G.S.seq,true);return;}
      if(t.name==='favorite-channel'){favChannel=t.value;group=0;queryBy.favPage=1;drawFavorites(G.S.seq);return;}
    }
    function submit(e){if(!here(brand))return;const form=e.target.closest('[data-gp-form]');if(!form)return;e.preventDefault();const text=form.elements.keyword.value.trim();if(form.dataset.gpForm==='catalog')applyFilter({keyword:text});else if(form.dataset.gpForm==='orders'){ordersQuery.keyword=text;ordersQuery.page=1;drawOrders(G.S.seq,true);}else{favoriteQuery=text;queryBy.favPage=1;drawFavorites(G.S.seq,true);}}
    G.root.addEventListener('change',change);G.root.addEventListener('submit',submit);
    function click(e){
      if(!here(brand))return false;
      const target=e.target,a=target.closest('[data-gp-action]'),cat=target.closest('[data-gp-category]'),gr=target.closest('[data-gp-group]'),st=target.closest('[data-gp-state]'),pg=target.closest('[data-gp-pager] [data-page]');
      if(cat){applyFilter({category:cat.dataset.gpCategory});return true;}if(gr){group=Number(gr.dataset.gpGroup);queryBy.favPage=1;drawFavorites(G.S.seq,true);return true;}if(st){ordersQuery.state=st.dataset.gpState;ordersQuery.page=1;drawOrders(G.S.seq,true);return true;}
      if(pg&&!pg.disabled){const type=pg.closest('[data-gp-pager]').dataset.gpPager,n=Number(pg.dataset.page);if(type==='catalog'){query().page=n;drawCatalog(G.S.seq,true);}else if(type==='orders'){ordersQuery.page=n;drawOrders(G.S.seq,true);}else if(type==='favorites'){queryBy.favPage=n;drawFavorites(G.S.seq,true);}return true;}
      if(!a)return false;const k=a.dataset.gpAction,id=Number(a.dataset.id),r=rows.find(x=>Number(x.id)===id);
      if(k==='categories-toggle'){
        const kind=currentKind();expandedCategories[kind]=!expandedCategories[kind];
        const list=a.closest('.gp-nav-list');if(list){list.innerHTML=categoryNavigation(optionCache.get(kind)?.categories||[],query(),kind);list.querySelector('[data-gp-action="categories-toggle"]')?.focus();}return true;
      }
      if(k==='drafts')chooseDraft();else if(k==='new-draft')newDraft();else if(k==='service')serviceDialog();else if(k==='pending'&&pending)confirmQuote(pending);else if(k==='advanced')advancedDialog();
      else if(k==='clear-filters'){queryBy[currentKind()]={page:1,page_size:20};drawCatalog(G.S.seq,true);}
      else if(k==='remove-filter'){const key=a.dataset.filter;delete query()[key];if(key==='price'){delete query().min_price;delete query().max_price;}query().page=1;drawCatalog(G.S.seq,true);}
      else if(k==='one'&&r)checkout([r]);else if(k==='media-detail'&&r)mediaDetail(r);else if(k==='favorite'&&r)toggleFavorite(r,a);
      else if(k==='export')exportOrders();else if(k==='order-detail')orderDetail(id);else if(k==='dates')dateDialog();else if(k==='clear-orders'){ordersQuery={};drawOrders(G.S.seq,true);}
      else if(k==='refresh')G.render();else if(k==='catalog')G.go(favChannel==='influencer'?'influencer':'website');
      else if(k==='groups')manageGroups();else if(k==='new-group')editGroup();else if(k==='trash')trashDialog();
      else if(k==='favorite-prices'){const kind=favChannel==='influencer'?2:1;queryBy[kind]={page:1,page_size:20,favorites:1};G.go(kind===2?'influencer':'website');}
      else if(k==='locate-favorite'&&r){const kind=favChannel==='influencer'?2:1;queryBy[kind]={page:1,page_size:20,keyword:r.title,favorites:1};G.go(kind===2?'influencer':'website');}
      else if(k==='favorite-more'&&r){const b=brand,l=life;U.menu(a,[{key:'move',label:'移动分组',icon:'folder'},{key:'recycle',label:'移入回收站',icon:'delete'}],key=>{if(!valid(b,l))return;if(key==='move')moveFavorite(r);else recycleResource('favorite',r);});}
      else return false;return true;
    }
    function applyIntent(){if(!queuedIntent)return;const {name,params,from}=queuedIntent;queuedIntent=null;if(name==='influencer'||String(from||'').startsWith('influencer-')){favChannel='influencer';ordersQuery.kind=2;}const id=Number(params.draftId||params.draft_id||0);if(Number.isSafeInteger(id)&&id>0)draftId=id;}
    async function draw(sub,seq){ensureScope();applyIntent();if(!Number(brand)){body().innerHTML=blank('请先创建品牌');return;}if(sub==='orders')await drawOrders(seq);else if(sub==='favorites')await drawFavorites(seq);else await drawCatalog(seq);}
    const actions=sub=>sub==='orders'?btn({label:'导出记录',kind:'secondary',size:'lg',icon:'download',attrs:{'data-gp-action':'export'}})+btn({label:'选择媒体',kind:'primary',size:'lg',attrs:{'data-gp-action':'catalog'}}):btn({label:'稿件',kind:'secondary',size:'lg',icon:'article',attrs:{'data-gp-action':'drafts'}})+btn({label:'新建稿件',kind:'primary',size:'lg',icon:'plus',attrs:{'data-gp-action':'new-draft'}});
    function leave(){life++;epoch++;U.batch(null);[...dialogs].forEach(c=>c.close());dialogs.clear();}
    return {title:'GEO 发布',tabs:()=>[{key:'website',label:'网站媒体'},{key:'influencer',label:'自媒体'},{key:'website-orders',label:'投稿记录'},{key:'website-favorites',label:'收藏'}],actions,draw,click,more(){return {items:[{key:'knowledge',label:'企业知识',icon:'book'},{key:'service',label:'发稿服务',icon:'info'}],pick:k=>k==='knowledge'?G.openKnowledge():serviceDialog()};},intent(name,params={},from){
      queuedIntent={name,params,from};if(Number(G.S.brand)&&here(String(G.S.brand)))draw(VIEWS[G.V][1],G.S.seq);
    },leave,reset(changed){leave();if(changed){brand='';selected.clear();drafts=null;pending=null;draftId=0;}availability=null;},destroy(){leave();dead=true;G.root.removeEventListener('change',change);G.root.removeEventListener('submit',submit);}};
  }
  (window.GEO_AREAS||(window.GEO_AREAS={})).publish={views:VIEWS,alias:ALIAS,intents:INTENTS,create};
})();
