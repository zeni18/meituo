import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {Banner,ConfigProvider,LocaleProvider,Select} from '@douyinfe/semi-ui';
import HiTabs,{TabPane} from '@hi-ui/tabs';
import HiModal from '@hi-ui/modal';
import HiButton from '@hi-ui/button';
import {IconRefresh} from '@douyinfe/semi-icons';
import {api,href,brand,Row} from './api';
import {Context} from './shared';
import {itemTitle,sections,mainGroups,isTool,baseFor,groupFor,normalized} from './navigation';
import Records from './Records';
import {Brand,Creation,ManualKeywords} from './Creation';
import Jobs from './Jobs';
import Dashboard from './Dashboard';
import {Media,Favorites} from './Media';
import MediaPublishing from './MediaPublishing';
import Unavailable from './Unavailable';
import Visibility from './Visibility';
import Diagnosis from './Diagnosis';
import Automation from './Automation';
import CreationStudio from './CreationStudio';
import KeywordLibrary from './KeywordLibrary';
import zhCN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import './style.css';
declare global{interface Window{MerchantMaterialLibrary?:any;}}
const legacy:Row={brand:'brand',overview:'overview',materials:'materials',questions:'questions',create:'create',articles:'articles',jobs:'jobs',evidence:'evidence',press:'website'};
function readRoute(){if(location.pathname==='/ai/assets')return {key:'keywords',extra:{}};if(location.pathname==='/ai/automation')return {key:'automation',extra:{}};const [key,query]=location.hash.slice(1).split('?');const params=new URLSearchParams(query);const initial=legacy[new URLSearchParams(location.search).get('view')||'']||'diagnose';return {key:sections.some(s=>s.groups.some(g=>g.items.some(i=>i[0]===key)))?key:initial,extra:Object.fromEntries(params)};}
function Images(){const element=useRef<HTMLDivElement>(null);const[error,setError]=useState('');useEffect(()=>{if(!element.current)return;if(!window.MerchantMaterialLibrary){setError('素材管理尚未加载，请刷新重试');return;}const el=window.MerchantMaterialLibrary.mount(element.current,{kind:'image',api:(a:string,p:Row,b:Row)=>api(a,p,b,'merchantWorkspace'),href:()=>location.pathname+location.search+'#images',navigate:()=>{},typeKeys:['image'],title:'企业画像图库'});return()=>{el.destroy?.();el.remove();};},[]);return <>{error&&<Banner type="danger" description={error}/>}<div className="gs-image-library" ref={element}/></>;}
class Boundary extends React.Component<{children:React.ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true};}render(){return this.state.error?<Banner type="danger" description="页面暂时不可用，请刷新后重试。"/>:this.props.children;}}
function PageTabs({items,active,onChange,label}:{items:string[][];active:string;onChange:(key:string)=>void;label:string}){const ref=useRef<HTMLDivElement>(null);return <div ref={ref}><HiTabs className="gi-tabs" role="tablist" aria-label={label} activeId={active} onChange={key=>onChange(String(key))}>{items.map(([key,title],index)=><TabPane key={key} tabId={key} tabTitle={<span role="tab" aria-selected={active===key} tabIndex={active===key?0:-1} onKeyDown={e=>{let next=index;if(e.key==='ArrowRight')next=(index+1)%items.length;else if(e.key==='ArrowLeft')next=(index+items.length-1)%items.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=items.length-1;else if(!['Enter',' '].includes(e.key))return;e.preventDefault();onChange(items[next][0]);requestAnimationFrame(()=>(ref.current?.querySelectorAll('[role=tab]')[next] as HTMLElement)?.focus());}}>{title}</span>}/>)}</HiTabs></div>;}
function App({container,popupContainer}:{container:HTMLElement;popupContainer:HTMLDivElement}){
 const[route,setRoute]=useState(readRoute),[version,setVersion]=useState(0),[message,setMessage]=useState(''),[error,setError]=useState('');const[brands,setBrands]=useState<Row[]>([]);const portal=useRef<HTMLDivElement>(popupContainer);const active=normalized(route.key),tool=isTool(active),base=baseFor(active,route.extra.back),group=groupFor(base),creation=group.key==='articles';
 const[mediaHeader,setMediaHeader]=useState<HTMLElement|null>(null);
 useLayoutEffect(()=>{if(group.key!=='website'){setMediaHeader(null);return;}const header=container.closest('.imagine-aigc')?.querySelector('.ia-header');if(!header)return;const slot=document.createElement('div');slot.className='mpp-native-heading';header.insertBefore(slot,header.querySelector('.ia-header-spacer'));setMediaHeader(slot);return()=>slot.remove();},[container,group.key]);
 useEffect(()=>{let live=true;api('brandChoices',{},undefined,'merchantWorkspace').then(r=>{if(live)setBrands(r.lists);}).catch(()=>{});return()=>{live=false;};},[]);
 useEffect(()=>{const sync=()=>setRoute(current=>{const next=readRoute();if(next.key===current.key&&current.extra.questions)next.extra.questions=current.extra.questions;return next;});addEventListener('popstate',sync);addEventListener('hashchange',sync);addEventListener('geo-route-change',sync);return()=>{removeEventListener('popstate',sync);removeEventListener('hashchange',sync);removeEventListener('geo-route-change',sync);};},[]);
 useEffect(()=>{const sync=()=>{const dark=document.documentElement.getAttribute('data-pc-theme')==='dark';container.classList.toggle('semi-always-dark',dark);container.classList.toggle('semi-always-light',!dark);popupContainer.className='geo-semi geo-main gi-portals semi-always-'+(dark?'dark':'light');const style=getComputedStyle(container);for(const name of Array.from(style))if(/^--(?:ia-|semi-|hi-v5-)/.test(name))popupContainer.style.setProperty(name,style.getPropertyValue(name));};sync();const observer=new MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-pc-theme','class']});return()=>observer.disconnect();},[container,popupContainer]);
 function brandCenter(){const p=new URLSearchParams(location.search);const id=brand()||String((brands.find(b=>Number(b.legacy)===1)||brands[0])?.id||'');if(id)p.set('brand_id',id);const path='/ai/stores?'+p+'#knowledge';const router=(document.getElementById('__nuxt') as any)?.__vue_app__?.config?.globalProperties?.$router;if(router?.push)router.push(path);else location.assign(path);}
 useEffect(()=>{if(active==='brand')brandCenter();},[active,brands.length]);
 function navigate(key:string,extra:Row={}){const router=(document.getElementById('__nuxt') as any)?.__vue_app__?.config?.globalProperties?.$router;const go=(target:string)=>router?.push?router.push(target):location.assign(target);if(key==='automation'){go(href('/ai/automation'));return;}if(key==='optimize'){key='diagnose';extra={};}if(key==='brand'){brandCenter();return;}key=normalized(key);if(key==='keywords'){const q=new URLSearchParams(location.search);q.set('finished','keyword');q.delete('view');go('/ai/assets?'+q);return;}if(isTool(key))extra={...extra,back:base};const p=new URLSearchParams();for(const k of ['group','draftId','projectId','taskId','subject','step','back','start'])if(extra[k])p.set(k,String(extra[k]));const hash='#'+key+(p.size?'?'+p:'');if(location.pathname==='/ai/assets'){go(href('/ai/geo')+hash);return;}history.pushState(null,'',hash);setRoute({key,extra});setError('');setMessage('');}
 async function run(fn:()=>Promise<any>,success?:string){setError('');try{const result=await fn();if(success)setMessage(success);return result;}catch(e){setError(e instanceof Error?e.message:'操作失败，请重试');return undefined;}}
 const contentKinds:Row={keywords:'keyword',instructions:'instruction',categories:'category',contacts:'contact',sites:'site',questions:'questions','article-library':'articles',materials:'materials',evidence:'evidence'};
 function page(active:string){let content:React.ReactNode;
 if(active==='overview'||active==='reports')content=<Dashboard report={active==='reports'}/>;
 else if(active==='automation')content=<Automation/>;
 else if(active==='articles')content=<CreationStudio routeKey={route.key}/>;
 else if(active==='keywords')content=<KeywordLibrary initialGroup={Number(route.extra.group)||0}/>;
 else if(active==='diagnose')content=<Diagnosis tools={brandTools}/>;
 else if(active==='diagnostic-reports')content=<Visibility reports tools={brandTools}/>;
 else if(contentKinds[active])content=<Records kind={contentKinds[active]}/>;
 else if(active==='brand')content=<Brand/>;
 else if(active==='images')content=<Images/>;
 else if(['create','replicate','batch-replicate','ai-keywords','search'].includes(active))content=<Creation view={active}/>;
 else if(active==='manual-keywords'||active==='query')content=<ManualKeywords query={active==='query'}/>;
 else if(active==='jobs'||active==='writing-jobs')content=<Jobs/>;
 else if(['website','influencer','website-orders','website-favorites'].includes(active))content=<MediaPublishing view={active}/>;
 else if(active.endsWith('-favorites'))content=<Favorites channel={active.startsWith('influencer')?'influencer':'website'}/>;
 else content=<Unavailable view={active}/>;return content;}
 const activeBrandId=brand()||String((brands.find(b=>Number(b.legacy)===1)||brands[0])?.id||'');
 function switchBrand(value:any,destination=base){const p=new URLSearchParams(location.search);p.set('brand_id',String(value));p.delete('view');if(location.pathname==='/ai/assets'){if(destination!=='keywords'){p.delete('finished');const target='/ai/geo?'+p+'#'+destination;const router=(document.getElementById('__nuxt') as any)?.__vue_app__?.config?.globalProperties?.$router;if(router?.push)router.push(target);else location.assign(target);return;}p.set('finished','keyword');}history.pushState(null,'',location.pathname+'?'+p+'#'+destination);setRoute({key:destination,extra:{}});}
 const actions:Record<string,string[][]>={overview:[],articles:[['create','AI 写作'],['ai-keywords','AI 拓词'],['manual-keywords','手动拓词'],['replicate','爆文复刻'],['batch-replicate','批量复刻'],['search','网页检索'],['instructions','写作指令'],['categories','文章分类']],website:[['website-favorites','网站收藏'],['influencer-favorites','大V收藏'],['website-tasks','智能发布任务'],['b2b-sites','B2B发布'],['accounts','个人自媒体'],['sites','官网 SEO'],['contacts','联系方式']],reports:[['query','带截图查询'],['keyword-index','关键词指数']]};
 const pageActions=group.key==='website'||creation?[]:actions[base]||actions[group.key]||[];
 const related:Record<string,string[][]>={'b2b-sites':[['b2b-sites','行业网站'],['b2b-tasks','发布任务'],['b2b-records','发布记录'],['contacts','联系方式']],accounts:[['accounts','账号授权'],['owned-tasks','发布任务'],['owned-records','发布记录']],sites:[['sites','站点管理'],['seo-tasks','SEO任务'],['seo-records','发布记录']]};
 const toolTabs=Object.values(related).find(t=>t.some(i=>i[0]===active));
 const brandTools=<div className="gi-brand-tools">{brands.length>0&&<Select className="gs-brand-select" aria-label="选择品牌" value={activeBrandId} optionList={brands.map(b=>({value:String(b.id),label:b.name}))} onChange={v=>switchBrand(v)} getPopupContainer={()=>portal.current||container}/>}<HiButton onClick={()=>creation?dispatchEvent(new CustomEvent('geo-studio-open',{detail:{panel:'brand'}})):brandCenter()}>企业知识库</HiButton><HiButton icon={<IconRefresh/>} aria-label="刷新GEO数据" onClick={()=>setVersion(v=>v+1)}>刷新</HiButton></div>;
 return <LocaleProvider locale={zhCN}><ConfigProvider getPopupContainer={()=>portal.current||container}><Context.Provider value={{version,navigate,selectBrand:switchBrand,extra:{...route.extra,brandId:activeBrandId},refresh:()=>setVersion(v=>v+1),run}}>
  <div className={'gi-workspace '+(group.key==='website'?'is-media-publishing':creation?'is-creation-studio':base==='overview'?'is-geo-home':['diagnose','diagnostic-reports'].includes(base)?'is-geo-diagnosis':'')}>
   {group.key==='website'&&mediaHeader&&createPortal(<><h1>{group.title}</h1><span className="mpp-heading-tag">聚焦媒体列表</span></>,mediaHeader)}
   {!['diagnose','diagnostic-reports'].includes(base)&&(group.key!=='website'||!mediaHeader)&&<header className="gi-heading"><h1>{group.title}{group.key==='website'&&<span className="mpp-heading-tag">聚焦媒体列表</span>}</h1>{base!=='automation'&&group.key!=='website'&&brandTools}</header>}
   {!creation&&group.tabs.length>1&&<PageTabs items={group.tabs} active={base} label={group.title+'分类'} onChange={key=>navigate(key)}/>}
   {!!pageActions.length&&<div className="gi-actions" aria-label={group.title+'工具'}>{pageActions.map(([key,label],i)=><HiButton key={key} type={i===0?'primary':'default'} onClick={()=>navigate(key)}>{label}</HiButton>)}</div>}
   <section className={'gs-page-content '+(['overview','reports','diagnose'].includes(base)?'gs-desk-content':'')} aria-label={creation?'AI创作台内容':itemTitle(base)+'内容'} key={group.key==='website'?'media'+(brand()||'default'):(creation?'creation':base)+activeBrandId}><Boundary>{creation?<CreationStudio routeKey={active}/>:page(base)}</Boundary></section>
  </div>
  {tool&&!creation&&<HiModal visible={true} title={itemTitle(active)} aria-label={itemTitle(active)} container={portal.current||container} width="min(1120px, calc(100vw - 32px))" zIndex={900} className="gi-tool-modal" unmountOnClose maskClosable={false} footer={<HiButton onClick={()=>navigate(base,route.extra)}>关闭</HiButton>} onCancel={()=>navigate(base,route.extra)}>
   {tool&&<><div className="gi-tool-context">{group.title} / {itemTitle(active)}</div>{toolTabs&&<PageTabs items={toolTabs} active={active} label="渠道管理" onChange={key=>navigate(key,route.extra)}/>}<div key={active}><Boundary>{page(active)}</Boundary></div></>}
  </HiModal>}<div className="gs-live-status" aria-live="polite">{message&&<Banner type="success" description={message} onClose={()=>setMessage('')}/>}</div>{error&&<div className="gs-live-error" role="alert"><Banner type="danger" description={error} onClose={()=>setError('')}/></div>}
 </Context.Provider></ConfigProvider></LocaleProvider>;
}
export function mount(container:HTMLElement){const popupContainer=document.createElement('div');popupContainer.id='geo-semi-portals';document.body.append(popupContainer);const root=createRoot(container);root.render(<App container={container} popupContainer={popupContainer}/>);return()=>{root.unmount();popupContainer.remove();};}
export const mountAssetLibrary=mount;
