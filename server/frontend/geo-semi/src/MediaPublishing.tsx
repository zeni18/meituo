import {useEffect,useId,useRef,useState} from 'react';
import {Banner,Button,Checkbox,Empty,Form,Input,Modal,Select,Space,Table,Tag} from '@douyinfe/semi-ui';
import type {SelectProps} from '@douyinfe/semi-ui/lib/es/select';
import {IconArrowRight,IconChevronDown,IconChevronUp,IconClose,IconPlus,IconSearch,IconStar,IconStarStroked} from '@douyinfe/semi-icons';
import {api,brand,popup,Row,tenant} from './api';
import {FieldNote,Loading,Pager,useGeo,useLoad} from './shared';
import {Media} from './Media';
import './media-publishing.css';

const press=(action:string,p:Row={},body?:Row)=>api(action,p,body,'mediaPress');
const caseHref=(id:number)=>'/api/mediaPress/caseOpen?'+new URLSearchParams({media_id:String(id),tenant_id:tenant(),...(brand()?{brand_id:brand()}:{})});
const money=(n:number)=>'¥'+(Number(n||0)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const mediaKinds:Row={1:'国内软文',2:'自媒体',3:'海外发稿',4:'海外社媒',5:'贴吧',6:'论坛',7:'问答',8:'友链',9:'文案',10:'小红书',11:'百科',12:'短视频',13:'微信',14:'微博',15:'母语'};
const prices=[['','不限'],['low','¥0–100'],['mid','¥100–300'],['high','¥300以上']];
const indexingChoices=[['','不限'],['1','包收录'],['0','不包收录']];
type FilterSpec={key:string;label:string;options:(string|number)[][]};
const websiteFilters:FilterSpec[]=[
 {key:'pcweight',label:'PC权重',options:[[0,'0及以上'],[1,'1及以上'],[2,'2及以上'],[3,'3及以上'],[5,'5及以上']]},
 {key:'wapweight',label:'移动权重',options:[[0,'0及以上'],[1,'1及以上'],[2,'2及以上'],[3,'3及以上'],[5,'5及以上']]},
 {key:'publishtime',label:'出稿参考',options:[[1,'1小时内'],[2,'2小时内'],[12,'半天'],[24,'当天'],[48,'隔天'],[49,'2天以上']]},
 {key:'weekendpublish',label:'周末可发',options:[[1,'可发'],[0,'不可发']]},
 {key:'linktype',label:'正文网址',options:[[2,'可带网址'],[0,'不可带网址']]},
 {key:'newsresource',label:'新闻源',options:[[1,'百度新闻源'],[0,'非百度新闻源']]}
];
const influencerFilters:FilterSpec[]=[
 {key:'authint',label:'账号认证',options:[[1,'已认证'],[0,'未认证']]},
 {key:'fans',label:'粉丝区间',options:[[1,'0–1千'],[5,'1千–5千'],[10,'5千–1万'],[50,'1万–5万'],[100,'5万–10万'],[1000,'10万–100万'],[1001,'100万以上']]},
 {key:'readnumber',label:'阅读区间',options:[[1,'0–1千'],[5,'1千–5千'],[10,'5千–1万'],[50,'1万–5万'],[100,'5万–10万'],[101,'10万']]},
 {key:'weekendpublish',label:'周末可发',options:[[1,'可发'],[0,'不可发']]},
 {key:'isvideo',label:'视频投稿',options:[[1,'支持'],[0,'不支持']]},
 {key:'recommend',label:'供方推荐',options:[[1,'推荐'],[0,'普通']]}
];
function Chips({label,value,items,onChange,extra,collapsedCount}:{label:string;value:string;items:string[][];onChange:(v:string)=>void;extra?:React.ReactNode;collapsedCount?:number}){
 const [expanded,setExpanded]=useState(false),id=useId();
 const collapsible=collapsedCount!==undefined&&items.length>collapsedCount;
 // Keep an uncommon selected option visible when the remaining choices are folded.
 const visible=items.filter(([v],index)=>!collapsible||expanded||index<collapsedCount!||v===value);
 return <div className="mpp-filter-row"><span className="mpp-filter-label">{label}</span><div id={id} className="mpp-chips" role="group" aria-label={label}>{visible.map(([v,name])=><button key={v} type="button" className={value===v?'is-active':''} aria-pressed={value===v} onClick={()=>onChange(v)}>{name}</button>)}{extra}{collapsible&&<button type="button" className="mpp-filter-toggle" aria-label={(expanded?'收起':'展开')+label} aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(v=>!v)}>{expanded?'收起':'展开'}<span aria-hidden="true">{expanded?<IconChevronUp/>:<IconChevronDown/>}</span></button>}</div></div>;
}
function MediaSelect({label,...props}:SelectProps&{label:string}){const id=useId();return <><span id={id} className="mpp-visually-hidden">{label}</span><Select {...props} aria-labelledby={id}/></>;}
function Metric({value,hint,zeroAsDash=false}:{value:any;hint?:string;zeroAsDash?:boolean}){return <><span>{zeroAsDash&&value===0?'—':value??'—'}</span>{(value===null||value===undefined||hint)&&<small>{value===null||value===undefined?'未提供':hint}</small>}</>;}

export default function MediaPublishing({view}:{view:string}){
 const {run,navigate,extra,refresh}=useGeo();
 const orders=view==='website-orders',favorites=view==='website-favorites';
 const [catalogKind,setCatalogKind]=useState(1),[favoriteKind,setFavoriteKind]=useState(1),[tierChoices,setTierChoices]=useState<Record<number,number>>({}),[origin,setOrigin]=useState(''),[queries,setQueries]=useState<Record<string,Row>>({}),[searches,setSearches]=useState<Record<string,string>>({});
 const [customPrices,setCustomPrices]=useState<Record<string,{min:string;max:string;error:string}>>({});
 const kind=view==='influencer'?2:favorites?favoriteKind:catalogKind;
 const queryKey=favorites?'favorites-'+kind:String(kind),query=queries[queryKey]||{},search=searches[queryKey]||'';
 const customPrice=customPrices[queryKey]||{min:'',max:'',error:''};
 const [advanced,setAdvanced]=useState(false),[selected,setSelected]=useState<Record<number,Row>>({}),[selectedOpen,setSelectedOpen]=useState(false);
 const [checkout,setCheckout]=useState<Row[]|null>(null),[draft,setDraft]=useState(Number(extra.draftId||0)),[newDraft,setNewDraft]=useState(false),[busy,setBusy]=useState(false),[quote,setQuote]=useState<Row|null>(null),[accepted,setAccepted]=useState(false),[favoriteBusy,setFavoriteBusy]=useState<Record<number,boolean>>({});
 const request=useRef({input:'',key:''});
 const state=useLoad(()=>orders?Promise.resolve(null):press('media',{...query,kind,favorites:favorites?1:0,page:query.page||1,page_size:query.page_size||10}),[orders,kind,favorites,JSON.stringify(query)]);
 const options=useLoad(()=>orders?Promise.resolve(null):press('mediaOptions',{kind}),[orders,kind]);
 const drafts=useLoad(()=>press('drafts'),[]);
 const currentData=state.data?.kind===kind&&state.data?.favorites===favorites;
 const priceRow=(row:Row,type?:number)=>{const chosen=type??tierChoices[row.id]??row.price_type??row.price_options?.[0]?.price_type??1;const option=row.price_options?.find((o:Row)=>Number(o.price_type)===Number(chosen));return {...row,price_type:Number(chosen),retail_cents:option?.retail_cents??row.retail_cents,points:option?.points??row.points};};
 const changeTier=(row:Row,type:number)=>{setTierChoices(old=>({...old,[row.id]:type}));setSelected(old=>old[row.id]?{...old,[row.id]:priceRow(row,type)}:old);};
 const specs=kind===2?influencerFilters:kind===1?websiteFilters:[],rows:Row[]=currentData?state.data?.lists||[]:[],picked=Object.values(selected),total=picked.reduce((sum,r)=>sum+Number(r.retail_cents),0);
 useEffect(()=>{if(extra.draftId)setDraft(Number(extra.draftId));},[extra.draftId]);
 useEffect(()=>{if(!state.data)return;setSelected(old=>{const next={...old};for(const row of state.data!.lists)if(next[row.id])next[row.id]=priceRow(row,next[row.id].price_type);return next;});},[state.data]);
 const update=(patch:Row)=>setQueries(old=>({...old,[queryKey]:{...old[queryKey],page:1,...patch}}));
 const reset=()=>{setQueries(old=>({...old,[queryKey]:{page_size:query.page_size||10}}));setSearches(old=>({...old,[queryKey]:''}));setCustomPrices(old=>({...old,[queryKey]:{min:'',max:'',error:''}}));};
 function editCustomPrice(patch:Partial<typeof customPrice>){setCustomPrices(old=>({...old,[queryKey]:{...(old[queryKey]||{min:'',max:''}),error:'',...patch}}));}
 function applyCustomPrice(){
  const min=customPrice.min.trim(),max=customPrice.max.trim(),valid=/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/;
  const error=!min&&!max?'请填写最低价或最高价':(min&&!valid.test(min))||(max&&!valid.test(max))?'请输入有效金额，最多两位小数':min&&max&&Number(min)>Number(max)?'最低价不能高于最高价':'';
  editCustomPrice({min,max,error});if(!error)update({price:'custom',min_price:min,max_price:max});
 }
 function selectRows(changes:Row[],checked:boolean){
  const next={...selected};for(const r of changes){if(checked)next[r.id]=priceRow(r);else delete next[r.id];}
  if(Object.keys(next).length>20){void run(async()=>{throw Error('每次最多选择20家媒体，请先减少已选媒体。');});return;}setSelected(next);
 }
 const allChecked=rows.length>0&&rows.every(r=>selected[r.id]),someChecked=rows.some(r=>selected[r.id]);
 async function toggleFavorite(row:Row){if(favoriteBusy[row.id])return;setFavoriteBusy(v=>({...v,[row.id]:true}));try{const result=await run(()=>press('favorite',{}, {media_id:Number(row.id),favorite:!row.is_favorite}),row.is_favorite?'已取消收藏':'已加入我的收藏');if(result)state.reload();}finally{setFavoriteBusy(v=>({...v,[row.id]:false}));}}
 async function quoteOrder(){if(!draft||!checkout?.length)return;setBusy(true);try{await run(async()=>{const input={draft_id:draft,media_ids:checkout.map(r=>Number(r.id)).sort((a,b)=>a-b),price_types:Object.fromEntries(checkout.map(r=>[r.id,Number(r.price_type||1)])),origin};const serialized=JSON.stringify(input);if(request.current.input!==serialized)request.current={input:serialized,key:crypto.randomUUID().replaceAll('-','')};const result=await press('quote',{},input);setQuote({...result,...input});setAccepted(false);setCheckout(null);});}finally{setBusy(false);}}
 function filterLabel(key:string,value:any){if(key==='searchcollint')return '收录：'+(indexingChoices.find(v=>v[0]===String(value))?.[1]||value);if(key==='keyword')return '名称：'+value;if(key==='price')return value==='custom'?(query.min_price!==''&&query.max_price!==''?'¥'+query.min_price+'–'+query.max_price:query.min_price!==''?'¥'+query.min_price+'及以上':'¥'+query.max_price+'及以下'):prices.find(v=>v[0]===value)?.[1]||value;const spec=specs.find(s=>s.key===key);return spec?spec.label+'：'+(spec.options.find(v=>String(v[0])===String(value))?.[1]||value):String(value);}
 const activeFilters=Object.entries(query).filter(([key,value])=>!['page','page_size','sort','min_price','max_price'].includes(key)&&value!==''&&value!==null&&value!==undefined);
 const commonCategories=kind===2?['百家号','今日头条','搜狐网','网易']:kind===1?['IT科技','财经商业','新闻资讯','生活消费']:[];
 const commonRegions=['全国','北京','上海','广东','浙江','江苏'];
 const categoryChoices=[...new Set<string>([...commonCategories,...(options.data?.categories||[])])];
 const regionChoices=[...new Set<string>([...commonRegions,...(options.data?.regions||[])])];
 const openCheckout=(items:Row[])=>{if(items.length)setCheckout(items.map(r=>priceRow(r)));};
 return <div className="mpp-workspace">
 {orders?<Media channel="website" orders/>:<>
  <section className="mpp-filters" aria-label="媒体筛选">
   <form className="mpp-filter-row mpp-search" onSubmit={e=>{e.preventDefault();update({keyword:search});}}><label className="mpp-filter-label" htmlFor="mpp-keyword">媒体名称</label><Input id="mpp-keyword" aria-label="搜索媒体名称" maxLength={80} value={search} onChange={v=>setSearches(old=>({...old,[queryKey]:v}))} placeholder="输入媒体名称、关键词，如：商业、科技、生活" showClear/><Button htmlType="submit" theme="solid" icon={<IconSearch/>}>搜索</Button><Button theme="outline" onClick={reset}>重置</Button><MediaSelect label="媒体资源类型" getPopupContainer={popup} value={kind} optionList={Object.entries(mediaKinds).map(([value,label])=>({value:Number(value),label:String(label)}))} onChange={v=>{const id=Number(v);if(favorites)setFavoriteKind(id);else{setCatalogKind(id);if(id===2)navigate('influencer');else if(view==='influencer')navigate('website');}}}/></form>
   <Chips key={queryKey+'-category'} collapsedCount={commonCategories.length+1} label={kind===2?'所属平台':'行业领域'} value={query.category||''} items={[["","不限"],...categoryChoices.map(v=>[v,v])]} onChange={v=>update({category:v})}/>
   <Chips key={queryKey+'-region'} collapsedCount={commonRegions.length+1} label="所在地区" value={query.region||''} items={[["","不限"],...regionChoices.map(v=>[v,v])]} onChange={v=>update({region:v})}/>
   {kind===1&&<Chips label="收录要求" value={query.searchcollint??''} items={indexingChoices} onChange={v=>update({searchcollint:v})} extra={<span className="mpp-muted" title="按供方的搜索收录承诺筛选，具体范围以媒体说明为准；不代表 AI 平台已引用。">以媒体承诺为准</span>}/>}
   <div className="mpp-price-row"><Chips label="价格区间" value={query.price||''} items={prices} onChange={v=>{update({price:v,min_price:'',max_price:''});editCustomPrice({min:'',max:''});}} extra={<form className={'mpp-custom-price'+(query.price==='custom'?' is-active':'')} aria-label="自定义价格" onSubmit={e=>{e.preventDefault();applyCustomPrice();}}><span>自定义</span><Input aria-label="最低价格" inputMode="decimal" prefix="¥" placeholder="最低价" maxLength={11} value={customPrice.min} onChange={min=>editCustomPrice({min})}/><span>—</span><Input aria-label="最高价格" inputMode="decimal" prefix="¥" placeholder="最高价" maxLength={11} value={customPrice.max} onChange={max=>editCustomPrice({max})}/><Button htmlType="submit" theme={query.price==='custom'?'solid':'outline'}>确定</Button>{customPrice.error&&<span role="alert" className="mpp-price-error">{customPrice.error}</span>}</form>}/>{specs.length>0&&<Button theme="borderless" icon={advanced?<IconChevronUp/>:<IconChevronDown/>} iconPosition="right" aria-expanded={advanced} aria-controls="mpp-advanced" onClick={()=>setAdvanced(v=>!v)}>高级筛选（{specs.length}）</Button>}</div>
   {advanced&&<div className="mpp-advanced" id="mpp-advanced">{specs.map(s=><label key={s.key}><span>{s.label}</span><MediaSelect label={s.label} getPopupContainer={popup} value={query[s.key]??''} optionList={[{value:'',label:'不限'},...s.options.map(([value,label])=>({value:String(value),label:String(label)}))]} onChange={v=>update({[s.key]:v})}/></label>)}</div>}
   <div className="mpp-applied"><span className="mpp-filter-label">已选条件</span>{activeFilters.length?activeFilters.map(([key,v])=><Tag key={key} color="purple" closable onClose={()=>{update(key==='price'?{price:'',min_price:'',max_price:''}:{[key]:''});if(key==='price')editCustomPrice({min:'',max:''});if(key==='keyword')setSearches(old=>({...old,[queryKey]:''}));}}>{filterLabel(key,v)}</Tag>):<span className="mpp-muted">不限条件</span>}{activeFilters.length>0&&<Button theme="borderless" onClick={reset}>重置条件</Button>}</div>
  </section>
  {options.error&&<Banner type="warning" description={<span>行业与地区选项加载失败。<Button theme="borderless" onClick={options.reload}>重新加载</Button></span>}/>}
  <div className="mpp-list-heading"><h2><i/>{favorites?'我的收藏':mediaKinds[kind]+'资源与报价'}<span>{currentData?Number(state.data!.count).toLocaleString()+' 家媒体':'加载中'}</span></h2><div><MediaSelect label="媒体排序" getPopupContainer={popup} value={query.sort||''} optionList={[{value:'',label:'默认排序'},{value:'price_asc',label:'价格升序'},{value:'price_desc',label:'价格降序'},{value:'name',label:'名称排序'}]} onChange={v=>update({sort:v})}/></div></div>
  <div className="mpp-results" aria-busy={state.loading} data-list-space-managed><Loading state={{...state,data:currentData?state.data:null}}>{d=><>
   {!d.availability.enabled&&<Banner type="warning" closeIcon={null} description="媒体接口尚未启用，请联系平台管理员。"/>}
   <div className="mpp-table-space" style={{minHeight:d.lists.length?undefined:48+d.page_size*92}}><div className="mpp-table-scroll"><table className="mpp-media-table" aria-label="媒体资源报价"><colgroup><col style={{width:'4.5%'}}/><col style={{width:'21.5%'}}/><col style={{width:'14%'}}/><col style={{width:'8%'}}/><col style={{width:'8%'}}/><col style={{width:'10%'}}/><col style={{width:'7%'}}/><col style={{width:'10%'}}/><col style={{width:'17%'}}/></colgroup>
    <thead><tr><th><Checkbox aria-label="选择本页媒体" checked={allChecked} indeterminate={!allChecked&&someChecked} disabled={!rows.length||state.loading} onChange={e=>selectRows(rows,!!e.target.checked)}/></th><th>媒体名称</th><th>{kind===2?'平台':'行业'} / 地区</th><th>{kind===2?'粉丝区间':kind===1?'PC权重':'参考指标'}</th><th>{kind===2?'阅读区间':kind===1?'移动权重':'参考指标'}</th><th>{kind===2?'账号认证':kind===1?'出稿参考':'交付参考'}</th><th><span title="接口未提供实际出稿率">出稿率 ⓘ</span></th><th>价格 / 篇</th><th>操作</th></tr></thead>
    {d.lists.map((r:Row)=><tbody key={r.id} className={selected[r.id]?'is-selected':''}><tr className="mpp-media-main"><td><Checkbox aria-label={'选择媒体 '+r.name} checked={!!selected[r.id]} disabled={state.loading} onChange={e=>selectRows([r],!!e.target.checked)}/></td><td><div className="mpp-media-name"><strong>{r.name}</strong>{r.case_url&&<a href={caseHref(r.id)} target="_blank" rel="noopener noreferrer" aria-label={'查看 '+r.name+' 的案例原文'}>案例 ›</a>}</div></td><td className="mpp-category">{r.category||'未分类'} / {r.region==='综合全国'?'全国':r.region||'未提供'}</td><td><Metric value={kind===2?r.metrics.fans_label:r.metrics.pcweight} zeroAsDash={kind===1}/></td><td><Metric value={kind===2?r.metrics.read_label:r.metrics.wapweight} zeroAsDash={kind===1}/></td><td><Metric value={kind===2?(r.metrics.authint===1?'已认证':r.metrics.authint===0?'未认证':null):r.metrics.publish_time_label} hint={kind===1?'供方参考':undefined}/></td><td><Metric value={null}/></td><td><strong className="mpp-price">{money(priceRow(r).retail_cents)}</strong>{r.price_options?.length>1&&<MediaSelect label={'发布方式 '+r.name} getPopupContainer={popup} value={priceRow(r).price_type} optionList={r.price_options.map((o:Row)=>({value:Number(o.price_type),label:o.label}))} onChange={v=>changeTier(r,Number(v))}/>}</td><td><div className="mpp-row-actions"><Button theme="outline" onClick={()=>openCheckout([r])}>投稿</Button><Button theme="borderless" aria-label={(r.is_favorite?'取消收藏 ':'收藏 ')+r.name} icon={r.is_favorite?<IconStar/>:<IconStarStroked/>} loading={favoriteBusy[r.id]} onClick={()=>toggleFavorite(r)}>{r.is_favorite?'已收藏':'收藏'}</Button></div></td></tr><tr className="mpp-media-remark"><td/><td colSpan={8}><div><span>备注：</span><span title={r.remark||''}>{r.remark||'暂无特殊说明，以媒体审核要求为准。'}</span></div></td></tr></tbody>)}
   </table></div>{d.lists.length>0&&d.lists.length<d.page_size&&<div aria-hidden="true" className="mpp-missing-rows" style={{height:(d.page_size-d.lists.length)*92}}/>}{!d.lists.length&&<Empty className="mpp-empty" title={favorites?'暂无符合条件的收藏':'暂无符合条件的媒体'} description={favorites?'在媒体列表点击“收藏”，即可在这里集中查看。':'试试减少筛选条件或更换媒体名称。'}/>}</div>
   <div className="mpp-pagination"><MediaSelect label="每页媒体数量" value={query.page_size||10} getPopupContainer={popup} optionList={[10,20,50].map(v=>({value:v,label:v+'条 / 页'}))} onChange={v=>update({page_size:Number(v)})}/><Pager count={d.count} page={d.page} size={d.page_size} onChange={v=>update({page:v})}/></div>
  </>}</Loading></div>
  <footer className="mpp-selection-bar" aria-label="已选媒体与费用"><Checkbox aria-label="全选本页媒体" checked={allChecked} indeterminate={!allChecked&&someChecked} disabled={!rows.length||state.loading} onChange={e=>selectRows(rows,!!e.target.checked)}/><div className="mpp-selection-total" aria-live="polite"><span>已选 <b>{picked.length}</b> 家 <small> / 20</small></span><span>参考合计 <strong>{money(total)}</strong> <em>（{total.toLocaleString()}TP）</em></span></div><div className="mpp-selection-actions"><Button theme="borderless" disabled={!picked.length} onClick={()=>setSelectedOpen(true)}>查看已选（{picked.length}）</Button><Button theme="borderless" disabled={!picked.length} onClick={()=>setSelected({})}>清空</Button><Button theme="solid" size="large" icon={<IconArrowRight/>} iconPosition="right" disabled={!picked.length} onClick={()=>openCheckout(picked)}>核对费用</Button></div></footer>
 </>}
 <Modal centered className="mpp-dialog" title={'已选媒体（'+picked.length+' / 20）'} visible={selectedOpen} getPopupContainer={popup} width={760} onCancel={()=>setSelectedOpen(false)} footer={<Space><span>参考合计 {money(total)}</span><Button onClick={()=>setSelectedOpen(false)}>继续选择</Button><Button theme="solid" disabled={!picked.length} onClick={()=>{setSelectedOpen(false);openCheckout(picked);}}>核对费用</Button></Space>}><Table pagination={false} rowKey="id" dataSource={picked} empty={<Empty description="还没有选择媒体"/>} columns={[{title:'媒体',dataIndex:'name'},{title:'类型',render:(_:any,r:Row)=>mediaKinds[Number(r.kind)]||'媒体'},{title:'参考报价',dataIndex:'retail_cents',render:money},{title:'操作',render:(_:any,r:Row)=><Button theme="borderless" aria-label={'移除 '+r.name} icon={<IconClose/>} onClick={()=>selectRows([r],false)}>移除</Button>}]}/></Modal>
 <Modal centered className="mpp-dialog" title="选择投稿稿件" visible={!!checkout} getPopupContainer={popup} width={760} onCancel={()=>{if(!busy)setCheckout(null);}} okText="获取最新报价" cancelText="继续选媒体" okButtonProps={{loading:busy,disabled:!draft||!state.data?.availability.publishing_ready}} onOk={quoteOrder} maskClosable={false}>{checkout&&<>
  <div className="mpp-checkout-summary"><span>{checkout.length} 家媒体</span><strong>参考合计 {money(checkout.reduce((sum,r)=>sum+Number(r.retail_cents),0))}</strong></div><FieldNote>{checkout.map(r=>r.name).join('、')}</FieldNote>
  <label>来源白名单标识（选填）<Input aria-label="来源白名单标识" value={origin} maxLength={1000} onChange={setOrigin}/></label><Loading state={drafts}>{d=><div className="mpp-draft-select"><MediaSelect label="发稿稿件" getPopupContainer={popup} filter value={draft||undefined} optionList={d.lists.map((r:Row)=>({value:Number(r.id),label:r.title}))} onChange={v=>setDraft(Number(v))} placeholder="请选择当前品牌的稿件"/><Button icon={<IconPlus/>} onClick={()=>setNewDraft(true)}>新建稿件</Button></div>}</Loading>
  {draft>0&&drafts.data?.lists.find((r:Row)=>Number(r.id)===draft)&&<details className="mpp-draft-preview"><summary>预览已选稿件</summary><h3>{drafts.data.lists.find((r:Row)=>Number(r.id)===draft)?.title}</h3><pre>{drafts.data.lists.find((r:Row)=>Number(r.id)===draft)?.body}</pre></details>}
  {!state.data?.availability.publishing_ready&&<Banner type="warning" closeIcon={null} description="可浏览媒体、收藏和准备稿件。正式投稿前，请平台管理员配置本站公网访问域名。"/>}<FieldNote>参考合计仅作选媒预算。下一步将核对最新报价，确认后才会预扣TP并提交。</FieldNote>
 </>}</Modal>
 <Modal centered className="mpp-dialog" title="新建发稿稿件" visible={newDraft} onCancel={()=>{if(!busy)setNewDraft(false);}} footer={null} getPopupContainer={popup} width={760}>{newDraft&&<Form labelPosition="top" onSubmit={async v=>{setBusy(true);try{const d=await run(()=>press('draftSave',{},v),'稿件已保存');if(d){setDraft(Number(d.id));setNewDraft(false);drafts.reload();}}finally{setBusy(false);}}}><Form.Input field="title" label="稿件标题" maxLength={120} rules={[{required:true,message:'请填写标题'}]}/><Form.TextArea field="body" label="稿件正文" rows={12} maxCount={100000} rules={[{required:true,message:'请填写正文'}]}/><div className="gs-actions"><Button disabled={busy} onClick={()=>setNewDraft(false)}>取消</Button><Button htmlType="submit" theme="solid" loading={busy}>保存稿件</Button></div></Form>}</Modal>
 <Modal centered className="mpp-dialog" title="核对发稿费用" visible={!!quote} getPopupContainer={popup} width={760} maskClosable={false} onCancel={()=>{if(!busy)setQuote(null);}} cancelText="取消" okText="确认预扣并提交" okButtonProps={{disabled:!accepted,loading:busy}} onOk={async()=>{if(!accepted||busy)return;setBusy(true);try{const result=await run(()=>press('create',{}, {...quote,confirmed:true,remark:'',request_key:request.current.key}),'订单已提交，发布进度以供方回执为准');if(result){setSelected(old=>{const next={...old};for(const id of quote!.media_ids)delete next[id];return next;});setQuote(null);refresh();navigate('website-orders');}}finally{setBusy(false);}}}>{quote&&<><Table rowKey="id" pagination={false} dataSource={quote.items} columns={[{title:'媒体',dataIndex:'name'},{title:'发布方式',dataIndex:'price_label'},{title:'报价',dataIndex:'retail_cents',render:money},{title:'TP',dataIndex:'points'}]}/><h3>合计 {money(quote.total_cents)} · 预扣 {quote.points} TP</h3><FieldNote>提交后由媒体审核。结果不确定时保留预扣；媒体发布与AI收录分别核验。</FieldNote><Checkbox checked={accepted} onChange={e=>setAccepted(!!e.target.checked)}>我已核对稿件、媒体和费用，同意提交发稿</Checkbox></>}</Modal>
 </div>;
}
