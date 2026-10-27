/* Merchant navigation and marketing features extend the shipped Nuxt shell. */
(() => {
  'use strict';
  const labels={films:'成片库',publishing:'任务发布',stores:'品牌列表',video:'视频库',image:'图片库',audio:'背景音频',voiceover:'旁白配音',image_text:'图文库',topic:'话题库',seedcard:'种草卡'};
  let root=null,host=null,current='',view=null,marketingOnly=false,scheduled=false;
  const nativeAssetBindings=new WeakSet();
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;};
  function icon(kind){const paths={films:'/ai/films',publishing:'/ai/publish-tasks',stores:'M3 10h18M4 10v11h16V10M2 10l3-7h14l3 7M9 21v-7h6v7',materials:'M3 6h7l2 3h9v11H3Z M3 6V4h7l2 2',video:'M4 4h16v16H4Z M10 8l6 4-6 4Z',image_text:'M3 3h18v18H3Z M3 16l5-5 4 4 3-3 6 6 M8 7h.01',topic:'M9 3 7 21M17 3l-2 18M3 9h18M2 15h18'};const span=node('span','mw-nav-icon');if(kind==='publishing'||kind==='films'){span.style.background='currentColor';span.style.mask="url('/merchant/icons/"+(kind==='films'?'film':'send')+".svg') center/contain no-repeat";return span;}span.setAttribute('aria-hidden','true');span.innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="'+paths[kind]+'" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';return span;}
  const context=()=>{const value=new URLSearchParams(location.search).get('tenant_id');return value&&/^\d+$/.test(value)?value:'';};
  const paths={films:'/ai/films',publishing:'/ai/publish-tasks',stores:'/ai/stores',video:'/ai/materials/video',image:'/ai/materials/images',audio:'/ai/materials/audio',voiceover:'/ai/materials/voiceover',image_text:'/ai/materials/image-text',topic:'/ai/materials/topics',seedcard:'/ai/seedcards'};
  const finishedHref=kind=>'/ai/assets?'+(context()?'tenant_id='+context()+'&':'')+'finished='+kind;
  const href=kind=>['films','image_text','topic'].includes(kind)?finishedHref(kind==='films'?'video':kind):paths[kind]+(context()?'?tenant_id='+context():'');
  const selectedView=()=>Object.keys(paths).find(key=>paths[key]===location.pathname)||'';
  const router=()=>document.getElementById('__nuxt')?.__vue_app__?.config?.globalProperties?.$router;
  async function api(action,params={},body,controller='merchantWorkspace'){
    const query=new URLSearchParams(params);if(context())query.set('tenant_id',context());
    const response=await fetch('/api/'+controller+'/'+action+'?'+query,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const result=await response.json();
    if(result.code!==1){if(result.code===-1)location.replace('/login'+(context()?'?tenant_id='+context():''));throw Error(result.msg||'请求失败，请重试');}return result.data;
  }
  let navigationObserver=null;
  function navigation(){
    const nav=document.querySelector('aside .ia-navigation');if(!nav||nav.querySelector('[data-merchant-navigation]'))return;
    navigationObserver?.disconnect();
    const block=node('div','mw-navigation');block.dataset.merchantNavigation='1';
    const link=kind=>{const a=node('a','mw-nav-link');a.href=href(kind);a.title=labels[kind];a.append(icon(kind),node('span','mw-nav-label',labels[kind]));return a;};
    block.append(link('stores'),link('publishing'));
    const raw=node('a','mw-nav-link mw-nav-raw');raw.href=href('video');raw.title='素材管理';raw.append(icon('materials'),node('span','mw-nav-label','素材管理'));block.append(raw);
    const editor=node('a','mw-nav-link');editor.href='/ai/video-editor'+(context()?'?tenant_id='+context():'');editor.title='AI视频剪辑';editor.append(icon('video'),node('span','mw-nav-label','AI视频剪辑'));block.append(editor);
    const group=node('div','mw-finished-group');group.setAttribute('role','group');group.setAttribute('aria-label','AI成品库');group.append(node('div','mw-finished-heading','AI成品库'));
    block.append(group);nav.prepend(block);
    const layout=block.closest('.imagine-aigc'),sync=()=>block.dataset.collapsed=String(Boolean(layout?.classList.contains('is-collapsed')));
    navigationObserver=new MutationObserver(sync);if(layout)navigationObserver.observe(layout,{attributes:true,attributeFilter:['class']});sync();
  }
  function shellControls(){
    const group=document.querySelector('.mw-finished-group'),header=document.querySelector('.ia-header'),notice=header?.querySelector('button[aria-label="通知"]');
    const assets=document.querySelector('.ia-navigation-fixed button[title="资产"]');
    if(group&&assets){group.querySelector('[data-native-assets]')?.remove();assets.dataset.nativeAssets='1';assets.classList.add('mw-nav-link');assets.querySelector(':scope>span:first-child')?.classList.add('mw-nav-icon');assets.querySelector(':scope>span:last-child')?.classList.add('mw-nav-label');if(!nativeAssetBindings.has(assets)){nativeAssetBindings.add(assets);assets.addEventListener('click',()=>{if(window.UK_OWNS&&window.UK_OWNS())return;if(location.pathname==='/ai/assets')window.MerchantFinishedLibrary?.open('');},true);}group.insertBefore(assets,group.children[1]||null);}
    const search=document.querySelector('.ia-navigation-fixed button[title="搜索"]');
    if(header&&notice&&search){header.querySelector('.merchant-top-search')?.remove();search.classList.remove('ia-nav-item','active');search.classList.add('ia-icon-button','merchant-top-search');search.setAttribute('aria-label','搜索');header.insertBefore(search,notice);}
  }
  function tools(){
    const catalog=document.querySelector('.it-catalog'),categories=catalog?.querySelector('[aria-label="工具分类"]');if(!categories)return;
    let button=categories.querySelector('[data-merchant-category]');
    if(!button){button=node('button','mw-category','门店营销');button.type='button';button.dataset.merchantCategory='1';button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{marketingOnly=true;updateTools();});categories.prepend(button);
      categories.addEventListener('click',event=>{if(event.target.closest('button')?.dataset.merchantCategory)return;marketingOnly=false;queueMicrotask(updateTools);},true);
      catalog.querySelector('input[type=search]')?.addEventListener('input',()=>queueMicrotask(updateTools));
    }
    let section=catalog.querySelector('[data-merchant-tool]');if(!section){
      section=node('section','mw-marketing-section');section.dataset.merchantTool='1';section.append(node('h2','','门店营销'));
      const card=node('a','mw-seed-tool');card.href=href('seedcard');card.setAttribute('aria-label','种草卡，管理门店营销内容');
      const cover=node('div','mw-seed-cover');cover.append(node('span','','种草卡'),node('span','mw-seed-stamp','门店营销'));const copy=node('div','mw-seed-copy');copy.append(node('h3','','种草卡'),node('p','','关联门店、视频、图文与话题，管理门店种草内容。'),node('span','mw-seed-arrow','进入 →'));card.append(cover,copy);section.append(card);catalog.insertBefore(section,catalog.querySelector('.it-section'));
    }
    let editor=catalog.querySelector('[data-clip-editor-tool]');if(!editor){editor=node('section','mw-marketing-section');editor.dataset.clipEditorTool='1';editor.append(node('h2','','视频创作'));const card=node('a','mw-seed-tool');card.href='/ai/video-editor'+(context()?'?tenant_id='+context():'');const cover=node('div','mw-seed-cover');cover.append(node('span','','AI视频剪辑'),node('span','mw-seed-stamp','一键成片 · 批量混剪'));const copy=node('div','mw-seed-copy');copy.append(node('h3','','AI视频剪辑'),node('p','','一键成片、批量混剪、分镜剪辑与脚本剪辑，连接商家素材库。'),node('span','mw-seed-arrow','进入 →'));card.append(cover,copy);editor.append(card);catalog.insertBefore(editor,catalog.querySelector('.it-section'));}
    const firstNative=catalog.querySelector('.it-section');if(firstNative&&(firstNative.compareDocumentPosition(section)&Node.DOCUMENT_POSITION_FOLLOWING))catalog.insertBefore(section,firstNative);
    updateTools();
    // The original static catalog contains two short-drama definitions.
    for(const grid of catalog.querySelectorAll('.it-grid')){const seen=new Set();for(const a of grid.querySelectorAll(':scope > a')){const duplicate=seen.has(a.getAttribute('href'));if(duplicate)a.setAttribute('data-mw-duplicate','');else a.removeAttribute('data-mw-duplicate');seen.add(a.getAttribute('href'));}}
  }
  function updateTools(){
    const catalog=document.querySelector('.it-catalog');if(!catalog)return;
    const section=catalog.querySelector('[data-merchant-tool]'),button=catalog.querySelector('[data-merchant-category]');if(!section||!button)return;
    const query=(catalog.querySelector('input[type=search]')?.value||'').trim().toLowerCase();
    const active=[...catalog.querySelectorAll('[aria-label="工具分类"] button:not([data-merchant-category])')].find(el=>el.classList.contains('active'));
    const visible=(marketingOnly||!active||active.textContent.trim()==='全部')&&(!query||'门店营销 种草卡 门店 视频 图文 话题'.includes(query));
    const editor=catalog.querySelector('[data-clip-editor-tool]');if(editor)editor.hidden=marketingOnly||(active&&!['全部','创意'].includes(active.textContent.trim()))||Boolean(query&&!'AI视频剪辑 一键成片 批量混剪 分镜剪辑 脚本剪辑'.toLowerCase().includes(query));
    section.hidden=!visible;catalog.classList.toggle('mw-marketing-selected',marketingOnly);catalog.classList.toggle('mw-marketing-visible',visible);button.setAttribute('aria-pressed',String(marketingOnly));
    for(const native of catalog.querySelectorAll('[aria-label="工具分类"] button:not([data-merchant-category])'))native.setAttribute('aria-pressed',String(!marketingOnly&&native.classList.contains('active')));
    for(const native of catalog.querySelectorAll(':scope > .it-section')){if(marketingOnly){native.hidden=true;native.dataset.mwFiltered='1';}else if(native.dataset.mwFiltered){native.hidden=false;delete native.dataset.mwFiltered;}}
  }
  function cleanup(){root?.destroy?.();root?.querySelector('dialog[open]')?.close();root?.remove();host?.classList.remove('mw-workspace-active');root=null;host=null;current='';view=null;}
  function field(name,title,{value='',required=false,max=200,type='text',multiline=false}={}){const label=node('label','mw-field');label.append(node('span','',title+(required?' *':'')));const input=node(multiline?'textarea':'input');if(!multiline)input.type=type;Object.assign(input,{name,value:value??'',required,maxLength:max});if(multiline)input.rows=4;label.append(input);return label;}
  function select(name,title,options,value,required=false){const label=node('label','mw-field');label.append(node('span','',title+(required?' *':'')));const input=node('select');input.name=name;input.required=required;options.forEach(([id,text])=>input.add(new Option(text,String(id))));input.value=String(value??'');label.append(input);return label;}
  function navigateMaterial(target){
    const destination=new URL(target,location.href);
    if(!root?.classList.contains('ml-library')||!['video','image','audio','voiceover'].some(key=>paths[key]===destination.pathname)){router()?.push(target);return;}
    if(destination.href===location.href||root.isBusy?.())return;
    // These are views of one library. A Nuxt route transition would remove its DOM.
    history.pushState({...history.state,back:location.pathname+location.search,current:destination.pathname+destination.search,forward:null,position:Number(history.state?.position||0)+1},'',destination.pathname+destination.search);
    check();
  }
  function mount(kind){
    if(window.UK_OWNS&&window.UK_OWNS()){if(root)cleanup();return;} // page rebuilt on ui-kit (materials-v2.js etc.)
    if(['films','publishing'].includes(kind)&&window.MerchantPublishing){cleanup();host=document.querySelector('main.ia-content');if(!host)return;current=kind;host.classList.add('mw-workspace-active');root=window.MerchantPublishing.mount(host,{kind,api:(a,p,b,c='merchantPublishing')=>api(a,p,b,c),navigate:target=>router()?.push(target)});return;}
    if(kind==='stores'&&(window.MerchantBrandDirectory||window.MerchantStoreDirectory)){cleanup();host=document.querySelector('main.ia-content');if(!host)return;current=kind;host.classList.add('mw-workspace-active');root=(window.MerchantBrandDirectory||window.MerchantStoreDirectory).mount(host,{api});return;}
    if(window.MerchantMaterialLibrary?.supports(kind)){if(root?.isConnected&&root.classList.contains('ml-library')&&root.setKind?.(kind)){current=kind;return;}cleanup();host=document.querySelector('main.ia-content');if(!host)return;current=kind;host.classList.add('mw-workspace-active');root=window.MerchantMaterialLibrary.mount(host,{kind,api,href,navigate:navigateMaterial});return;}
    cleanup();host=document.querySelector('main.ia-content');if(!host)return;current=kind;host.classList.add('mw-workspace-active');root=node('section','mw-workspace');root.id='merchant-workspace';root.setAttribute('aria-label',labels[kind]);host.append(root);
    root.innerHTML='<div class="mw-toolbar"><form><label class="mw-search"><span class="mw-sr">搜索名称</span><input name="keyword" placeholder="搜索名称" maxlength="80"></label><label><span class="mw-sr">记录状态</span><select name="trash"><option value="0">全部记录</option><option value="1">回收站</option></select></label><button class="mw-secondary" type="submit">查询</button><button class="mw-secondary" type="reset">重置</button></form><button class="mw-primary" data-add></button></div><p class="mw-error" role="alert" data-error></p><div class="mw-grid" data-list></div><div class="mw-pagination"><span data-count></span><div><button class="mw-secondary" data-prev>上一页</button><span data-page>1</span><button class="mw-secondary" data-next>下一页</button></div></div><dialog class="mw-dialog" aria-labelledby="mw-dialog-title"><form><header><h2 id="mw-dialog-title"></h2><button type="button" class="mw-close" data-close aria-label="关闭">×</button></header><div data-fields></div><p class="mw-error" role="alert" aria-live="polite" data-form-error></p><footer><button type="button" class="mw-secondary" data-close>取消</button><button type="submit" class="mw-primary">保存</button></footer></form></dialog>';
    const own=root,q=s=>own.querySelector(s),filters=q('.mw-toolbar form'),dialog=q('dialog'),form=dialog.querySelector('form');
    const directory=kind==='stores'?'store':kind==='seedcard'?'seedcard':'material';const state={page:1,seq:0,pending:false,uploads:0,opening:false,files:[],id:0};view=state;
    q('[data-add]').textContent='＋ '+(kind==='stores'?'新增门店':kind==='seedcard'?'新建种草卡':kind==='topic'?'新增话题':kind==='video'?'上传视频':'新增图文');
    async function load(){const seq=++state.seq;q('[data-error]').textContent='';q('[data-list]').setAttribute('aria-busy','true');if(!q('[data-list]').children.length)q('[data-list]').append(node('p','mw-empty','正在加载…'));try{
      const data=await api('lists',{directory,...directory==='material'?{kind}:{},...Object.fromEntries(new FormData(filters)),page:state.page});if(seq!==state.seq||!own.isConnected)return;
      const list=q('[data-list]');list.replaceChildren();
      for(const row of data.lists){const card=node('article','mw-record');
        if(directory==='material'&&row.files?.length){const file=row.files[0],media=node(kind==='video'?'video':'img','mw-preview');media.src=file.url;if(kind==='video'){media.controls=true;media.preload='metadata';}else media.alt=row.name;card.append(media);}
        else card.append(node('div','mw-record-symbol',kind==='stores'?'⌂':kind==='seedcard'?'种草卡':'#'));
        card.append(node('h3','',row.name));
        if(kind==='stores'){card.append(node('p','',row.address||'尚未填写地址'),node('p','',[row.contact,row.mobile].filter(Boolean).join(' · ')||'尚未填写联系人'),node('span','mw-muted',Number(row.status)===1?'营业中':'已停用'));}
        else if(kind==='seedcard'){card.append(node('p','',row.store_name),node('p','','素材：'+row.material_name),node('p','','话题：'+row.topic_name));}
        else card.append(node('span','mw-muted',row.store_name),node('p','mw-record-content',row.content||'—'),node('span','mw-muted',row.tags||''));
        const actions=node('div','mw-record-actions');if(filters.elements.trash.value!=='1'){const edit=node('button','mw-secondary','编辑');edit.type='button';edit.addEventListener('click',()=>open(row));actions.append(edit);}
        const remove=node('button','mw-text',filters.elements.trash.value==='1'?'恢复':'移入回收站');remove.type='button';remove.addEventListener('click',async()=>{remove.disabled=true;try{await api('recycle',{}, {directory,id:row.id,restore:filters.elements.trash.value==='1'?'1':'0'});await load();}catch(error){q('[data-error]').textContent=error.message;remove.disabled=false;}});actions.append(remove);card.append(actions);list.append(card);
      }
      if(!data.lists.length)list.append(node('p','mw-empty',filters.elements.trash.value==='1'?'回收站为空':'暂无记录，点击列表上方按钮添加。'));
      q('[data-count]').textContent='共 '+data.count+' 条';q('[data-page]').textContent=state.page;q('[data-prev]').disabled=state.page<=1;q('[data-next]').disabled=state.page*15>=data.count;
    }catch(error){if(seq===state.seq&&own.isConnected){q('[data-list]').replaceChildren();q('[data-error]').textContent=error.message;}}finally{if(seq===state.seq&&own.isConnected)q('[data-list]').removeAttribute('aria-busy');}}
    async function choiceField(name,title,choiceKind,value,required=false){
      const wrap=node('div','mw-choice'),search=field('', '搜索'+title,{max:80}),selectField=select(name,title,[['',required?'请选择':'不指定']],value,required);const refresh=node('button','mw-secondary','搜索');refresh.type='button';
      search.querySelector('input').placeholder='输入名称查找，最多显示 50 条';wrap.append(search,refresh,selectField);q('[data-fields]').append(wrap);
      const loadChoices=async()=>{const rows=await api('choices',{kind:choiceKind,keyword:search.querySelector('input').value});if(!wrap.isConnected)return;const input=selectField.querySelector('select');const selected=input.value||String(value||'');input.replaceChildren(new Option(required?'请选择':'不指定',''));for(const row of rows)input.add(new Option(row.name,String(row.id)));if(selected&&!rows.some(row=>String(row.id)===selected))input.add(new Option('已选记录 #'+selected,selected));input.value=selected;};
      refresh.addEventListener('click',()=>loadChoices().catch(error=>q('[data-form-error]').textContent=error.message));await loadChoices();return wrap;
    }
    async function open(row={}){
      if(state.opening||state.pending||state.uploads)return;state.opening=true;
      state.id=Number(row.id||0);state.files=row.files?[...row.files]:[];form.reset();q('[data-fields]').replaceChildren();q('[data-form-error]').textContent='';q('h2').textContent=(row.id?'编辑':'新增')+({stores:'门店',video:'视频',image_text:'图文',topic:'话题',seedcard:'种草卡'}[kind]);dialog.showModal();
      const fields=q('[data-fields]');fields.append(field('name',kind==='stores'?'门店名称':'名称',{value:row.name,required:true,max:kind==='stores'?80:100}));
      try{
        if(kind==='stores'){
          for(const [name,title,max] of [['address','详细地址',255],['contact','联系人',50],['mobile','联系电话',32],['business_hours','营业时间',100]])fields.append(field(name,title,{value:row[name],max}));fields.append(field('description','门店简介',{value:row.description,max:2000,multiline:true}),select('status','门店状态',[[1,'营业中'],[0,'已停用']],row.status??1));
        }else{
          await choiceField('store_id','门店','store',row.store_id,kind==='seedcard');
          if(kind==='seedcard'){
            await choiceField('material_id','视频或图文素材','material',row.material_id,true);await choiceField('topic_id','话题','topic',row.topic_id);fields.append(node('p','mw-hint','选择本门店或通用素材，保存门店种草内容组合。'));
          }else{
            fields.append(field('content',kind==='topic'?'话题内容':'正文 / 描述',{value:row.content,required:kind==='topic',max:10000,multiline:true}),field('tags','标签（用空格分隔）',{value:row.tags,max:255}));
            if(kind!=='topic'){
              const upload=field('','上传'+(kind==='video'?'视频':'图片'),{type:'file'}),input=upload.querySelector('input');input.accept=kind==='video'?'video/*':'image/*';input.multiple=kind!=='video';const files=node('div','mw-file-list');
              const renderFiles=()=>{files.replaceChildren();state.files.forEach((file,index)=>{const line=node('div','mw-file-row');line.append(node('span','',file.name));const remove=node('button','mw-text','移除');remove.type='button';remove.addEventListener('click',()=>{state.files.splice(index,1);renderFiles();});line.append(remove);files.append(line);});};renderFiles();
              input.addEventListener('change',async()=>{const selected=[...input.files];if(state.files.length+selected.length>(kind==='video'?1:9)){q('[data-form-error]').textContent='视频限一个文件，图文最多九张图片';input.value='';return;}state.uploads++;input.disabled=true;q('[data-form-error]').textContent='正在上传…';try{for(const file of selected){const body=new FormData();body.append('file',file);const response=await fetch('/api/upload/'+(kind==='video'?'video':'image')+(context()?'?tenant_id='+context():''),{method:'POST',credentials:'same-origin',body});const result=await response.json();if(result.code!==1)throw Error(result.msg||'上传失败');state.files.push({id:result.data.id,name:result.data.name||file.name,url:result.data.uri});}renderFiles();q('[data-form-error]').textContent='';}catch(error){q('[data-form-error]').textContent=error.message;}finally{state.uploads--;input.disabled=false;input.value='';}});
              fields.append(upload,files,node('p','mw-hint',kind==='video'?'每条视频素材支持一个视频文件。':'每条图文素材最多支持九张图片。'));
            }
          }
        }
        form.querySelector('[name=name]').focus();
      }catch(error){q('[data-form-error]').textContent=error.message;}finally{state.opening=false;}
    }
    form.addEventListener('submit',async event=>{event.preventDefault();if(state.pending||state.uploads||state.opening){q('[data-form-error]').textContent='请等待当前操作完成';return;}state.pending=true;const button=form.querySelector('[type=submit]');button.disabled=true;q('[data-form-error]').textContent='';try{await api('save',{}, {...Object.fromEntries(new FormData(form)),directory,id:state.id,...directory==='material'?{kind,file_ids:state.files.map(file=>Number(file.id))}:{}});dialog.close();await load();}catch(error){q('[data-form-error]').textContent=error.message;}finally{state.pending=false;button.disabled=false;}});
    q('[data-add]').addEventListener('click',()=>open());q('[data-prev]').addEventListener('click',()=>{state.page--;load();});q('[data-next]').addEventListener('click',()=>{state.page++;load();});filters.addEventListener('submit',event=>{event.preventDefault();state.page=1;load();});filters.addEventListener('reset',()=>setTimeout(()=>{if(own.isConnected){state.page=1;load();}},0));
    own.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>{if(!state.pending&&!state.uploads&&!state.opening)dialog.close();}));dialog.addEventListener('cancel',event=>{if(state.pending||state.uploads||state.opening)event.preventDefault();});load();
  }
  function nativeClipLabels(){for(const a of document.querySelectorAll('a[href*="/ai/smart_clip"]')){const walker=document.createTreeWalker(a,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const text=walker.currentNode;if(text.nodeValue.includes('AI视频剪辑'))text.nodeValue=text.nodeValue.replaceAll('AI视频剪辑','AI短视频');}for(const attr of ['title','aria-label'])if(a.getAttribute(attr)?.includes('AI视频剪辑'))a.setAttribute(attr,a.getAttribute(attr).replaceAll('AI视频剪辑','AI短视频'));}if(location.pathname==='/ai/smart_clip')for(const el of document.querySelectorAll('main h1,main h2,.ia-page-title,main .im-tool-cover strong'))if(el.textContent.trim()==='AI视频剪辑')el.textContent='AI短视频';}
  function check(){navigation();shellControls();tools();nativeClipLabels();const legacy=location.pathname==='/ai/assets'?new URLSearchParams(location.search).get('merchant_view'):'';if(labels[legacy]){if(router())router().replace(href(legacy));else location.replace(href(legacy));return;}const kind=selectedView();if(['films','image_text','topic'].includes(kind)){router()?.replace(href(kind));return;}const finished=window.MerchantFinishedLibrary?.currentKind()||'';const assetButton=document.querySelector('[data-native-assets]');if(assetButton){const active=location.pathname==='/ai/assets';assetButton.classList.toggle('active',active);if(active)assetButton.setAttribute('aria-current','page');else assetButton.removeAttribute('aria-current');}for(const link of document.querySelectorAll('.mw-nav-link[href]')){const active=link.dataset.finishedKind?link.dataset.finishedKind===finished:link.classList.contains('mw-nav-raw')?['video','image','audio','voiceover'].includes(kind):new URL(link.href).pathname===location.pathname;link.classList.toggle('mw-nav-active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
    if(location.pathname==='/ai/video-editor'&&window.MerchantClipStudio){if(current!=='clip'||!root?.isConnected){cleanup();host=document.querySelector('main.ia-content');if(!host)return;host.classList.add('mw-workspace-active');current='clip';root=window.MerchantClipStudio.mount(host,{api:(a,p,b)=>api(a,p,b,'merchantClip'),materialApi:api,navigate:target=>router()?.push(target)});}return;}
    if(!labels[kind]){if(root)cleanup();return;}if(current!==kind||!root?.isConnected)mount(kind);}
  function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;check();});}
  document.addEventListener('click',event=>{const a=event.target.closest('a.mw-nav-link,a.mw-seed-tool');if(!a||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;if(a.classList.contains('mw-nav-raw')&&root?.classList.contains('ml-library')){event.preventDefault();navigateMaterial(a.href);return;}if(a.dataset.finishedKind&&location.pathname==='/ai/assets'&&window.MerchantFinishedLibrary){event.preventDefault();window.MerchantFinishedLibrary.open(a.dataset.finishedKind);return;}const target=new URL(a.href,location.href),client=router();if(client&&target.origin===location.origin){event.preventDefault();client.push(target.pathname+target.search);}});
  for(const key of ['pushState','replaceState']){const original=history[key];history[key]=function(...args){const result=original.apply(this,args);schedule();return result;};}
  window.addEventListener('popstate',schedule);new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',check);check();
})();
