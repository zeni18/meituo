/* Isolated fixture only. This file is never injected into 8090. */
(() => {
  if(location.hostname!=='127.0.0.1'||location.port!=='8765')return;
  const previous=window.fetch.bind(window),q=new URLSearchParams(location.search),now=Math.floor(Date.now()/1000),empty=q.get('fx')==='empty',off=q.get('press')==='off';
  let next=7000,loseNext=false,rejectNext=false;
  const calls=[],scopes=new Map(),accepted=new Map(JSON.parse(sessionStorage.getItem('publish-fixture-accepted')||'[]'));const persistAccepted=()=>sessionStorage.setItem('publish-fixture-accepted',JSON.stringify([...accepted]));
  const media=Array.from({length:46},(_,i)=>{const kind=i<28?1:2,id=i+1,price=2800+(i%9)*1900;return {id,kind,name:'验收示例 · '+(kind===1?['财经观察','产业日报','城市生活','科创报道'][i%4]:['头条商业号','百家专栏','城市记录'][i%3])+' '+(i+1),region:['北京','上海','全国','广东'][i%4],category:kind===1?['财经商业','IT科技','生活消费'][i%3]:['今日头条','百家号','搜狐网'][i%3],retail_cents:price,points:String(price),remark:i%3===0?'标题不超过 30 字，正文可带一个来源链接。':'',case_url:i%4===0?'https://example.com/case/'+id:'',sync_time:now,price_options:[{price_type:1,label:'标准发布',retail_cents:price,points:String(price)},...(i%5===0?[{price_type:2,label:'推荐发布',retail_cents:price+2000,points:String(price+2000)}]:[])],metrics:{pcweight:i%6,wapweight:(i+1)%5,publishtime:[1,2,24][i%3],publish_time_label:['1 小时内','2 小时内','当天'][i%3],searchcollint:i%2,weekendpublish:1,linktype:2,newsresource:0,authint:1,fans_label:'1–5 万',read_label:'1–5 千',publication_rate:null}};});
  // An explicit local fixture exercises the long industry list without real business data.
  if(q.get('categories')==='long'){
    const industries=['IT科技','财经商业','新闻资讯','生活消费','健康医疗','体育运动','文化艺术','教育培训','汽车交通','家居房产','旅游出行','餐饮美食'];
    media.forEach((row,index)=>{if(row.kind===1)row.category=industries[index%industries.length];});
  }
  function scope(id){if(!scopes.has(id))scopes.set(id,{drafts:empty?[]:[{id:301,title:'验收稿件 · 连锁门店的会员经营',body:'这是隔离验收稿件，不是真实商业发布。\n\n从一次到店到持续复购，需要可核实的经营事实。\n\n每次创作引用品牌事实，提交之前由运营核对。',create_time:now-3600},{id:302,title:'验收稿件 · 新店开业选购指南',body:'第二篇验收稿件。\n门店信息、产品信息和使用场景。',create_time:now-7200}],resources:empty?[]:[{id:601,kind:'favorite_group',title:'重点行业',revision:1,content:'',data:{channel:'website'},create_time:now,delete_time:0},{id:602,kind:'favorite',title:media[0].name,content:media[0].remark,revision:1,data:{channel:'website',group_id:601,media_id:1},create_time:now,delete_time:0}],orders:empty?[]:Array.from({length:24},(_,i)=>({id:100+i,sn:'HP-TEST-'+(100+i),title:'验收稿件 '+(i+1)+' · 门店经营',media_name:media[i%media.length].name,state:['submitted','published','unknown','completed','refunded','rejected'][i%6],billing_status:i%6===4?'refunded':i%6===3?'captured':'reserved',retail_cents:8800+i*100,points:String(8800+i*100),published_url:i%6===1?'https://example.com/published/'+i:'',failure_reason:i%6===5?'媒体退稿，返还结果待核实。':'',process_state:'',draft_id:301,price_type:1,create_time:now-i*5000,update_time:now-i*1000}))});return scopes.get(id);}
  const availability={enabled:!off,publishing_ready:!off,points_per_yuan:100,provider:'海讯社'};
  const paginate=(list,p,size=20)=>({lists:list.slice((Math.max(1,Number(p.page||1))-1)*size,Math.max(1,Number(p.page||1))*size),count:list.length,page:Number(p.page||1),page_size:size});
  function resourceList(s,p){let rows=s.resources.filter(r=>r.kind===p.kind&&!!r.delete_time===!!Number(p.trash||0)&&r.data.channel===p.channel);if(Number(p.group_id)>0)rows=rows.filter(r=>Number(r.data.group_id)===Number(p.group_id));if(p.keyword)rows=rows.filter(r=>r.title.includes(p.keyword));return paginate(rows,p,Number(p.page_size||20));}
  const reply=(data,code=1,msg='')=>new Response(JSON.stringify({code,msg,data}),{headers:{'Content-Type':'application/json'}});
  window.__publishMock={calls,scopes,accepted,loseNext(){loseNext=true;},rejectNext(){rejectNext=true;},setBalance(n){this.balance=n;},balance:1000000};
  window.fetch=async(input,init={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href),p=Object.fromEntries(url.searchParams),key=url.pathname.slice(5);let b={};if(init.body)try{b=JSON.parse(init.body);}catch{}
    if(key==='user/center')return reply({user_money:window.__publishMock.balance});
    const resource=key.startsWith('merchantGeo/')&&['favorite','favorite_group'].includes(p.kind||b.kind),press=key.startsWith('mediaPress/');
    if(!press&&!resource)return previous(input,init);
    const action=key.split('/')[1],s=scope(String(p.brand_id||'11'));calls.push({action,controller:key.split('/')[0],brand:p.brand_id,params:p,body:b});
    await new Promise(r=>setTimeout(r,(p.keyword==='慢'||action==='quote'&&q.get('delayquote')==='1')?300:25));
    try{
      if(resource){
        if(action==='resources')return reply(resourceList(s,p));
        if(action==='resourceSave'){let row=b.id?s.resources.find(x=>x.id===Number(b.id)&&!x.delete_time):null;if(b.id&&(!row||Number(row.revision)!==Number(b.revision)))throw Error('资料已更新，请刷新后重试');if(!row){row={id:++next,create_time:now,revision:0,delete_time:0};s.resources.push(row);}Object.assign(row,{kind:b.kind,title:b.title,content:b.content||'',revision:row.revision+1,data:{channel:b.channel,...(b.kind==='favorite'?{media_id:Number(b.media_id),group_id:Number(b.group_id||0)}:{})}});return reply({id:row.id,revision:row.revision});}
        if(action==='resourceRecycle'){const row=s.resources.find(x=>x.id===Number(b.id));if(!row||row.revision!==Number(b.revision))throw Error('资料已更新，请刷新后重试');row.delete_time=b.restore?0:now;row.revision++;return reply({id:row.id});}
      }
      if(action==='mediaOptions'){const rows=media.filter(r=>r.kind===Number(p.kind));return reply({categories:[...new Set(rows.map(r=>r.category))],regions:[...new Set(rows.map(r=>r.region))]});}
      if(action==='media'){
        let list=empty?[]:media.filter(r=>r.kind===Number(p.kind));if(p.keyword)list=list.filter(r=>r.name.includes(p.keyword));if(p.category)list=list.filter(r=>r.category===p.category);if(p.region)list=list.filter(r=>r.region===p.region);if(p.favorites)list=list.filter(r=>s.resources.some(f=>f.kind==='favorite'&&!f.delete_time&&f.data.media_id===r.id));if(p.searchcollint!=='undefined'&&p.searchcollint!=null&&p.searchcollint!=='')list=list.filter(r=>r.metrics.searchcollint===Number(p.searchcollint));if(p.price==='low')list=list.filter(r=>r.retail_cents<=10000);if(p.price==='mid')list=list.filter(r=>r.retail_cents>10000&&r.retail_cents<=30000);if(p.price==='high')list=list.filter(r=>r.retail_cents>30000);if(p.price==='custom')list=list.filter(r=>(!p.min_price||r.retail_cents>=Number(p.min_price)*100)&&(!p.max_price||r.retail_cents<=Number(p.max_price)*100));if(p.sort==='price_asc')list=list.toSorted((a,b)=>a.retail_cents-b.retail_cents);if(p.sort==='price_desc')list=list.toSorted((a,b)=>b.retail_cents-a.retail_cents);
        const result=paginate(list,p,Number(p.page_size||20));result.lists=result.lists.map(r=>({...r,is_favorite:s.resources.some(f=>f.kind==='favorite'&&!f.delete_time&&f.data.media_id===r.id)}));return reply({...result,availability,kind:Number(p.kind),favorites:!!p.favorites});
      }
      if(action==='favorite'){if(!b.favorite){s.resources.filter(r=>r.kind==='favorite'&&r.data.media_id===Number(b.media_id)).forEach(r=>{r.delete_time=now;r.revision++;});}else if(!s.resources.some(r=>r.kind==='favorite'&&!r.delete_time&&r.data.media_id===Number(b.media_id))){const m=media.find(r=>r.id===Number(b.media_id));s.resources.push({id:++next,kind:'favorite',title:m.name,content:m.remark,revision:1,data:{media_id:m.id,group_id:0,channel:m.kind===2?'influencer':'website'},create_time:now,delete_time:0});}return reply({is_favorite:b.favorite,media_id:b.media_id});}
      if(action==='drafts')return reply({lists:s.drafts});
      if(action==='draftSave'){const row={...b,id:++next,create_time:now};s.drafts.unshift(row);return reply(row);}
      if(action==='quote'){if(off)throw Error('发稿服务待开通');const items=b.media_ids.map(id=>{const m=media.find(x=>x.id===Number(id)),price=m.price_options.find(x=>x.price_type===Number(b.price_types[id]||1));return {id:m.id,name:m.name,price_type:price.price_type,price_label:price.label,retail_cents:price.retail_cents,points:price.points};});const total=items.reduce((n,r)=>n+r.retail_cents,0);return reply({items,total_cents:total,points:String(total),quote_hash:'fixture-quote-'+next,expires_at:now+(q.get('quote')==='expired'?-60:600)});}
      if(action==='create'){if(rejectNext){rejectNext=false;return reply({},0,'授权暂不可用，请稍后核查');}if(accepted.has(b.request_key))return reply({ids:accepted.get(b.request_key),replayed:true});const ids=b.media_ids.map(()=>++next);accepted.set(b.request_key,ids);persistAccepted();if(loseNext){loseNext=false;throw new TypeError('NetworkError fixture after acceptance');}return reply({ids});}
      if(action==='orders'){let list=s.orders;if(p.state)list=list.filter(r=>r.state===p.state);if(p.keyword)list=list.filter(r=>r.title.includes(p.keyword)||r.media_name.includes(p.keyword)||r.sn.includes(p.keyword));const sum=type=>list.filter(r=>r.billing_status===type).reduce((n,r)=>n+r.retail_cents,0);return reply({...paginate(list,p),summary:{count:list.length,reserved_cents:sum('reserved'),consumed_cents:sum('captured'),refunded_cents:sum('refunded')},availability});}
      if(action==='detail'){const row=s.orders.find(r=>r.id===Number(p.id));return reply({...row,draft:s.drafts[0]});}
      if(action==='process'){const row=s.orders.find(r=>r.id===Number(b.id));row.process_state='queued';return reply({queued:true});}
      if(action==='export')return reply({csv:'\uFEFF订单号,媒体,算力\r\nHPTEST,验收媒体,8800',count:s.orders.length,truncated:false});
      return reply({},0,'未模拟：'+key);
    }catch(e){if(e instanceof TypeError)throw e;return reply({},0,e.message);}
  };
})();
