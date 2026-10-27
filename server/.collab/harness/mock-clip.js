/* Local fixture, never served by 8090. */
(()=>{
 if(location.hostname!=='127.0.0.1'||location.port!=='8765'||location.pathname!=='/ai/video-editor')return;
 const p=new URLSearchParams(location.search),ready=p.get('cloud')==='ready',calls=[],docs=new Map(),plans=[],jobs=[];let next=100;try{const previous=JSON.parse(sessionStorage.getItem('clip.qa.documents')||'[]');for(const row of previous)docs.set(row.id,row);next=Math.max(next,...previous.map(r=>r.id));}catch{}
 const copy=x=>JSON.parse(JSON.stringify(x)),wait=()=>new Promise(r=>setTimeout(r,25)),now=Math.floor(Date.now()/1000);
 const assets=[1,2].map(id=>({id,name:'隔离验收图片 '+id,kind:'image',labels:[],label_ids:[],used:false,file:{id,name:'验收图片.png',url:'/merchant/images/clip-empty-materials.png',size:10240}}));
 const capabilities={draft_scope:'1:99999',rendering:ready,editing:true,planning:true,billing:{merchant_points_per_output:0,unit:'TP',charged_to:'cloud_account'},notice:'隔离验收：费用由云账号承担，不扣商家 TP。',intelligence:[{id:'Cover',name:'封面产出',kind:'video'}],effects:{transitions:{'':'无转场',fade:'淡入淡出'},filters:{},fonts:{SimSun:'宋体'},flowers:{'':'无花字'},motions:{'':'无动画'}},services:['oss','ims','tts','icl','llm','asr','imm'].map(code=>({code,name:code,state:ready?'configured':'needs_configuration',adapter_ready:true,purpose:'隔离验收服务',configuration_source:'oem'}))};
 const api=async(action,params={},body)=>{calls.push({action,params:copy(params),body:body?copy(body):undefined});await wait();
  if(action==='capabilities')return copy(capabilities);
  if(action==='draftAssets')return {config:copy(body.config),assets:Object.fromEntries(assets.map(r=>[r.id,r]))};
  if(action==='save'){const id=Number(body.id)||++next,old=docs.get(id);if(old&&old.revision!==body.revision)throw Error('此工程已在其他窗口更新，请重新打开后保存');const row={...copy(body),id,mode:body.config.mode,revision:(old?.revision||0)+1,update_time:now,create_time:now,delete_time:0,assets:Object.fromEntries(assets.map(r=>[r.id,r]))};docs.set(id,row);sessionStorage.setItem('clip.qa.documents',JSON.stringify([...docs.values()]));return {id,revision:row.revision,kind:body.kind};}
  if(action==='detail'){const doc=docs.get(Number(params.id));if(!doc)throw Error('工程不存在');return copy(doc);}
  if(action==='lists'){const list=[...docs.values()].filter(r=>r.kind===params.kind&&!!r.delete_time===(params.trash==='1')&&(!params.keyword||r.name.includes(params.keyword)));return {lists:copy(list),count:list.length,page:params.page||1,page_size:12};}
  if(action==='recycle'){const doc=docs.get(Number(body.id));doc.delete_time=body.restore==='1'?0:now;return {};}
  if(action==='plan'){const doc=docs.get(body.id),c=doc.config,ids=[];for(let i=0;i<body.count;i++){const id=++next,grouped=['script','storyboard'].includes(c.mode),source=grouped?c.groups.map(g=>g.material_ids[0]):c.material_ids;let t=0;const shots=source.map((material_id,k)=>{const duration=grouped?c.groups[k].duration:5,row={material_id,duration,source_in:0,source_out:duration,timeline_in:t,group:grouped?k+1:0,text:grouped?c.groups[k].texts[0]||'':''};t+=duration;return row;});plans.push({id,project_id:body.id,revision:body.revision,plan:{shots,duration:t,ratio:c.ratio,fps:c.fps,title:'',subtitle:'',warnings:[]},outdated:false});ids.push(id);}return {ids,created:ids.length};}
  if(action==='plans')return {lists:copy(plans.filter(r=>r.project_id===params.project_id)),revision:docs.get(params.project_id)?.revision};
  if(action==='cloudJobs')return {lists:copy(jobs),count:jobs.length};
  if(action==='render'){if(!ready)throw Error('云合成配置中');const row={id:++next,project_id:body.id,revision:body.revision,operation:'render',state:'submitted',create_time:now};jobs.push(row);return {task_id:row.id};}
  if(action==='templates')return {lists:[],count:0};
  if(action==='voiceProfiles')return {lists:[],can_create:false};
  if(action==='speakers')return {lists:[]};
  if(action==='publicMusic')return {lists:[],count:0};
  throw Error('未模拟：'+action);
 };
 const materialApi=async(action,params={})=>{await wait();if(action==='folders')return {lists:[],total:0,unfiled:2};if(action==='labels')return [];if(action==='library'){const list=params.kind==='image'?assets.map(r=>({...r,files:[r.file]})):[];return {lists:list,count:list.length,page:1,page_size:20};}if(action==='choices')return [];throw Error('未模拟素材：'+action);};
 const previous=fetch.bind(window);window.fetch=async(input,init={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(!url.pathname.startsWith('/api/merchantPublishing/'))return previous(input,init);const action=url.pathname.split('/').pop(),body=init.body?JSON.parse(init.body):{};calls.push({action:'publishing/'+action,body});const data=action==='libraries'?{lists:[{id:8,name:'隔离验收成片组'},{id:9,name:'另一验收组'}]}:action==='intent'?{intent_key:'fixture-'+next}:action==='destination'?{library_id:8}:{};return new Response(JSON.stringify({code:1,data}),{headers:{'Content-Type':'application/json'}});};
 window.__clipMock={calls,docs,plans,jobs};
 document.documentElement.classList.add('v2-clip-page');document.querySelector('.imagine-aigc').classList.add('is-collapsed');const style=document.createElement('style');style.textContent='.ia-sidebar{width:64px}.ia-body{margin-left:64px}.ia-header{height:64px}.ia-brand{font-size:0;padding:12px}.ia-brand:after{content:"M";font-size:18px}.nv2-title,.nv2-label,.nv2-caret,.nv2-sub{display:none!important}.nv2-nav{padding-inline:6px}.ia-navigation{padding:0 6px}.nv2-link{justify-content:center;padding-inline:8px!important}.ia-header .mc-header-title h1{font-size:16px;margin:0}.ia-header .mc-header-title{display:flex;align-items:center}';document.head.append(style);
 window.clipFixtureRoot=window.MerchantClipStudio.mount(document.querySelector('main.ia-content'),{api,materialApi,navigate:target=>{calls.push({action:'navigate',target});location.href=target;}});
})();
