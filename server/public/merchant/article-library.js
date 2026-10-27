/* Article assets use GEO's existing rows, ownership checks and optimistic saves. */
(() => {
  'use strict';
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
  const icon=name=>{const e=node('span','fc-icon');e.style.setProperty('--fc-icon',`url('/merchant/icons/${name}.svg')`);e.setAttribute('aria-hidden','true');return e;};
  const button=(text,fn,cls='fc-button')=>{const b=node('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
  const field=(label,name,tag='input')=>{const l=node('label','fc-field'),input=node(tag);input.name=name;l.append(node('span','',label),input);return {label:l,input};};
  const date=value=>value?new Date(Number(value)*1000).toLocaleString('zh-CN',{hour12:false}):'—';
  window.MerchantArticleLibrary={mount(host,{api,navigate}){
    const root=node('section','fc-page mw-workspace ma-article-library');root.setAttribute('aria-label','文章库');host.append(root);
    let dead=false,seq=0,choiceSeq=0,brands=[],page=1,size=10,total=0,saving=false,dialogSeq=0;
    const filters=node('form','fc-filters'),search=field('文章标题','keyword'),brand=field('所属品牌','brand_id','select'),category=field('文章分类','category_id','select');search.input.placeholder='搜索 GEO 软文标题';search.input.maxLength=80;
    brand.input.add(new Option('全部品牌',''));category.input.add(new Option('全部分类',''));category.input.disabled=true;
    const find=button('搜索',()=>filters.requestSubmit(),'fc-button fc-primary');find.prepend(icon('search'));
    const reset=button('重置',()=>{search.input.value='';brand.input.value='';category.input.value='';page=1;refreshChoices();load();});filters.append(search.label,brand.label,category.label,find,reset);
    const tools=node('div','fc-tools'),help=node('span','fc-context','统一管理 GEO 软文，支持查看正文与编辑入库。'),actions=node('div','fc-actions');
    const create=button('新增文章',()=>edit(),'fc-button fc-primary');create.prepend(icon('plus'));create.disabled=true;
    const go=button('GEO 创作',()=>navigate(geoHref(brand.input.value||defaultBrand())));go.prepend(icon('edit-2'));const refresh=button('刷新',()=>load());actions.append(refresh,go,create);tools.append(help,actions);
    const error=node('p','fc-error');error.setAttribute('role','alert');const notice=node('p','fc-notice');notice.setAttribute('role','status');
    const wrap=node('div','fc-table-wrap ma-article-table'),table=node('table','fc-table'),head=node('thead'),header=node('tr'),body=node('tbody');
    for(const text of ['文章标题','所属品牌','分类','字数','更新时间','操作']){const th=node('th','',text);th.scope='col';header.append(th);}head.append(header);table.append(head,body);wrap.append(table);
    const pager=node('div','fc-pagination'),count=node('span'),sizes=node('select'),prev=button('上一页',()=>{if(page>1){page--;load();}}),current=node('span','fc-current-page','1'),next=button('下一页',()=>{if(page*size<total){page++;load();}});
    sizes.setAttribute('aria-label','每页数量');for(const n of [10,20,50])sizes.add(new Option(n+'条/页',String(n)));pager.append(count,sizes,prev,current,next);pager.dataset.pageCapacity=String(size);
    const dialog=node('dialog','ma-article-dialog');dialog.setAttribute('aria-label','文章详情');root.append(filters,tools,error,notice,wrap,pager,dialog);
    const defaultBrand=()=>String((brands.find(b=>Number(b.legacy)===1)||brands[0])?.id||'');
    function geoHref(id){const q=new URLSearchParams(),tenant=new URLSearchParams(location.search).get('tenant_id');if(tenant)q.set('tenant_id',tenant);if(id)q.set('brand_id',id);return '/ai/geo'+(q.size?'?'+q:'')+'#articles';}
    const geo=(action,params={},payload,id)=>api(action,{...params,...id?{brand_id:id}:{}},payload,'merchantGeo');
    function empty(title,hint){const tr=node('tr'),td=node('td'),box=node('div','fc-empty');td.colSpan=6;box.append(icon('file-text'),node('strong','',title));if(hint)box.append(node('span','',hint));td.append(box);tr.append(td);body.replaceChildren(tr);}
    async function refreshChoices(){
      const token=++choiceSeq,id=brand.input.value;category.input.replaceChildren(new Option('全部分类',''));category.input.disabled=true;
      if(!id)return;
      try{const data=await geo('resources',{kind:'category',page_size:500},undefined,id);if(dead||token!==choiceSeq)return;for(const row of data.lists)category.input.add(new Option(row.title,String(row.id)));category.input.disabled=false;}
      catch(e){if(!dead&&token===choiceSeq)error.textContent=e.message;}
    }
    async function load(){
      const run=++seq;error.textContent='';wrap.setAttribute('aria-busy','true');prev.disabled=next.disabled=true;refresh.disabled=true;empty('正在加载文章…');
      try{const data=await api('articleLibrary',{brand_id:brand.input.value,category_id:category.input.value||0,keyword:search.input.value.trim(),page,page_size:size});if(dead||run!==seq)return;
        total=Number(data.count);if(page>1&&(page-1)*size>=total){page=Math.max(1,Math.ceil(total/size));return load();}body.replaceChildren();
        for(const row of data.lists){const tr=node('tr'),title=node('td','ma-article-title'),link=button(row.title,()=>preview(row),'fc-link');link.title=row.title;title.append(link,node('p','fc-muted ma-article-excerpt',(row.content||'').replace(/\s+/g,' ').slice(0,80)));tr.append(title,node('td','',row.brand_name),node('td','',row.category_name),node('td','',Number(row.word_count).toLocaleString()),node('td','',date(row.update_time||row.create_time)));
          const td=node('td'),rowActions=node('div','fc-row-actions');rowActions.append(button('查看',()=>preview(row),'fc-link'),button('编辑',()=>edit(row),'fc-link'));td.append(rowActions);tr.append(td);body.append(tr);}
        if(!data.lists.length)empty(total?'本页暂无文章':'暂无文章',search.input.value||category.input.value?'试试调整搜索条件。':'GEO 创作入库的软文会显示在这里，也可点击“新增文章”保存正文。');
        count.textContent='共 '+total+' 篇';current.textContent=page;prev.disabled=page<=1;next.disabled=page*size>=total;
      }catch(e){if(!dead&&run===seq){error.textContent=e.message;empty('文章加载失败','点击“刷新”重试。');}}
      finally{if(!dead&&run===seq){refresh.disabled=false;wrap.removeAttribute('aria-busy');}}
    }
    function open(title){dialogSeq++;dialog.replaceChildren();dialog.setAttribute('aria-label',title);const header=node('header'),h=node('h2','',title),close=button('关闭',()=>{if(!saving)dialog.close();});header.append(h,close);dialog.append(header);dialog.showModal();return dialogSeq;}
    function preview(row){if(saving)return;open(row.title);const meta=node('p','fc-muted',row.brand_name+' · '+row.category_name+' · '+row.word_count+' 字 · '+date(row.update_time||row.create_time)),content=node('div','ma-article-prose',row.content||'');dialog.append(meta,content);const foot=node('footer');foot.append(button('关闭',()=>dialog.close()),button('编辑文章',()=>{dialog.close();edit(row);},'fc-button fc-primary'));dialog.append(foot);}
    function edit(row={}){
      if(!brands.length||saving)return;const token=open(row.id?'编辑文章':'新增文章'),form=node('form','ma-article-form'),owner=field('所属品牌 *','brand_id','select'),title=field('文章标题 *','title'),cat=field('文章分类','category_id','select'),key=field('关联关键词','keyword_group_id','select'),question=field('关联写作标题','question'),content=field('文章正文 *','content','textarea');
      for(const b of brands)owner.input.add(new Option(b.name,String(b.id)));owner.input.value=String(row.owner_brand_id||brand.input.value||defaultBrand());owner.input.disabled=!!row.id;title.input.required=true;title.input.maxLength=255;title.input.value=row.title||'';question.input.maxLength=500;question.input.value=row.question||'';content.input.required=true;content.input.maxLength=100000;content.input.rows=14;content.input.value=row.content||'';cat.input.add(new Option('未分类','0'));key.input.add(new Option('不关联','0'));
      const fields=node('div','ma-article-fields');fields.append(owner.label,cat.label,key.label,question.label);const failure=node('p','fc-error');failure.setAttribute('role','alert');const footer=node('footer'),cancel=button('取消',()=>{if(!saving)dialog.close();}),save=node('button','fc-button fc-primary','保存文章');save.type='submit';save.disabled=true;footer.append(cancel,save);form.append(title.label,fields,content.label,failure,footer);dialog.append(form);let loading=true,editorChoiceSeq=0;
      async function choices(){const request=++editorChoiceSeq,id=owner.input.value;loading=true;save.disabled=true;failure.textContent='';cat.input.disabled=key.input.disabled=true;
        try{const [cats,keys]=await Promise.all([geo('resources',{kind:'category',page_size:500},undefined,id),geo('resources',{kind:'keyword',page_size:500},undefined,id)]);if(dead||token!==dialogSeq||request!==editorChoiceSeq)return;
          for(const [input,rows,initial,label] of [[cat.input,cats.lists,Number(row.metadata_json?.category_id||0),'未分类'],[key.input,keys.lists,Number(row.metadata_json?.keyword_group_id||0),'不关联']]){input.replaceChildren(new Option(label,'0'));for(const r of rows)input.add(new Option(r.title,String(r.id)));if(row.id&&initial&&!rows.some(r=>Number(r.id)===initial))input.add(new Option('原关联 #'+initial,String(initial)));input.value=String(row.id?initial:0);input.disabled=false;}
          loading=false;save.disabled=false;
        }catch(e){if(!dead&&token===dialogSeq&&request===editorChoiceSeq)failure.textContent=e.message+'，请关闭后重试。';}
      }
      owner.input.addEventListener('change',choices);form.addEventListener('submit',async event=>{event.preventDefault();if(saving||loading)return;saving=true;save.disabled=cancel.disabled=true;failure.textContent='';const id=owner.input.value;owner.input.disabled=true;
        try{await geo('contentSave',{}, {kind:'articles',id:row.id||0,title:title.input.value,content:content.input.value,question:question.input.value,category_id:Number(cat.input.value),keyword_group_id:Number(key.input.value),expected_update:row.update_time,expected_hash:row.expected_hash},id);if(dead)return;notice.textContent='文章已保存';dialog.close();await load();window.dispatchEvent(new Event('merchant-articles-changed'));}
        catch(e){if(!dead)failure.textContent=e.message;}
        finally{saving=false;if(!dead){save.disabled=cancel.disabled=false;owner.input.disabled=!!row.id;}}
      });choices();title.input.focus({preventScroll:true});
    }
    dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});dialog.addEventListener('close',()=>{if(!dialog.open)dialogSeq++;});
    filters.addEventListener('submit',event=>{event.preventDefault();page=1;load();});brand.input.addEventListener('change',()=>{page=1;refreshChoices();load();});category.input.addEventListener('change',()=>{page=1;load();});sizes.addEventListener('change',()=>{size=Number(sizes.value);page=1;pager.dataset.pageCapacity=String(size);load();});
    async function init(){try{const result=await api('brandChoices');if(dead)return;brands=result.lists;for(const b of brands)brand.input.add(new Option(b.name,String(b.id)));create.disabled=go.disabled=!brands.length;if(!brands.length)help.textContent='请先创建品牌，再保存 GEO 软文。';const initial=new URLSearchParams(location.search).get('brand_id');if(initial&&brands.some(b=>String(b.id)===initial))brand.input.value=initial;refreshChoices();load();}catch(e){if(!dead){error.textContent=e.message;empty('品牌读取失败','请刷新页面重试。');}}}
    root.destroy=()=>{dead=true;seq++;choiceSeq++;dialogSeq++;if(dialog.open)dialog.close();root.remove();};init();return root;
  }};
})();
