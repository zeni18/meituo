import {useEffect,useState,type ReactNode} from 'react';
import {Banner,Button,Modal,Space} from '@douyinfe/semi-ui';
import {IconArrowRight,IconSearch,IconRefresh,IconTickCircle,IconAlertTriangle,IconClock,IconHistogram} from '@douyinfe/semi-icons';
import {api,date,popup,Row} from './api';
import {Loading,useGeo,useLoad} from './shared';
import Visibility from './Visibility';
import {PlatformLogo} from './PlatformLogo';
import {diagnosisModel} from './diagnosis-model';
import './diagnosis.css';
const numeric=(n:unknown)=>n===null||n===undefined?'—':Number(n).toLocaleString('zh-CN');
export default function Diagnosis({tools}:{tools?:ReactNode}){
 const {navigate,extra}=useGeo(),[creating,setCreating]=useState(!!extra.start),[selected,setSelected]=useState('DeepSeek');
 const state=useLoad(async()=>{const [dashboard,options,records]=await Promise.all([api('dashboard',{range:'all'}),api('visibilityOptions'),api('visibilityRecords',{page:1})]);const latest=records.lists[0];const detail=latest?(await api('visibilityRecords',{id:latest.id})).lists[0]:null;return {dashboard,options,latest:detail};});
 useEffect(()=>{if(extra.start)setCreating(true);},[extra.start]);
 const model=diagnosisModel(state.data?.dashboard.platforms||[],state.data?.latest);
 useEffect(()=>{if(!model.pending)return;const timer=setInterval(state.reload,10000);return()=>clearInterval(timer);},[model.pending]);
 return <Loading state={state}>{d=>{
  const current=model.platforms.find(p=>p.platform===selected)||model.platforms[0],total=model.platforms.length;
  const rows=[{key:'success',label:'已完成',icon:<IconTickCircle/>},{key:'running',label:'检测中',icon:<IconRefresh/>},{key:'waiting',label:'待诊断',icon:<IconClock/>},{key:'alert',label:'异常待处理',icon:<IconAlertTriangle/>}];
  return <div className="gd-diagnosis">
   <div className="gd-heading"><div><h2>AI 平台可见度统计</h2><p>洞察品牌在各大 AI 平台的真实表现，持续跟踪优化结果。</p></div><div className="gd-heading-tools">{tools}<Button className="gd-start gd-history-button" theme="solid" icon={<IconClock/>} onClick={()=>navigate('diagnostic-reports')}>诊断记录</Button></div></div>
   <div className="gd-hero">
    <section className="gd-orbit" aria-label="品牌与AI平台诊断状态">
     <div className="gd-orbit-art" aria-hidden="true"><i/><i/><i/><i/></div>
     <svg className="gd-connections" viewBox="0 0 800 600" preserveAspectRatio="none" aria-hidden="true"><path d="M400 300 400 70M400 300 682 234M400 300 574 482M400 300 226 482M400 300 118 234"/></svg>
     <div className="gd-brand-core"><strong title={d.dashboard.brand.name}>{d.dashboard.brand.name||'当前品牌'}</strong><span>品牌可见度</span><b>{total}</b><small>AI 平台</small></div>
     {model.platforms.slice(0,5).map((p,i)=><button key={p.platform} className={'gd-platform-node gd-node-'+i+' is-'+p.status+(selected===p.platform?' is-selected':'')} aria-pressed={selected===p.platform} aria-label={p.platform+'，'+p.statusLabel+'，查看平台数据'} onClick={()=>setSelected(p.platform)}><span className="gd-node-logo"><PlatformLogo name={p.platform}/></span><span className="gd-node-copy"><strong>{p.platform}</strong><span className={'gd-status is-'+p.status}><i/>{p.statusLabel}</span></span></button>)}
     <span className="gd-orbit-caption">{d.latest?'最近一批 #'+d.latest.id+' · '+date(d.latest.create_time):'尚无诊断批次，开始建立品牌可见度基线'}</span>
    </section>
    <aside className="gd-progress" aria-label="平台诊断进度"><div className="gd-progress-heading"><h3>整体诊断进度</h3><span><b>{model.counts.success}</b> / {total} 已完成</span></div>
     <div className="gd-progress-rows">{rows.map(r=>{const count=model.counts[r.key],pct=Math.round(count/total*100);return <div className={'gd-progress-row is-'+r.key} key={r.key}><span className="gd-progress-icon">{r.icon}</span><span>{r.label}</span><strong>{count}</strong><span className="gd-progress-track" role="progressbar" aria-label={r.label+'平台占比'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{width:pct+'%'}}/></span><small>{pct}%</small></div>;})}</div>
     <p className="gd-progress-note">按最近一批的平台任务汇总；失败和待核对样本不会计为品牌未提及。</p>
     <div className="gd-callout"><div><span className="gd-callout-icon"><IconHistogram/></span><div><h4>全面诊断品牌在 AI 平台的可见度</h4><p>从客户问题出发，保存回答、引用与采样证据。</p></div></div><Button theme="solid" className="gd-start" icon={<IconSearch/>} onClick={()=>setCreating(true)}>开始诊断<IconArrowRight/></Button></div>
    </aside>
   </div>
   <Space wrap aria-label="其他平台诊断状态">{model.platforms.slice(5).map(p=><Button key={p.platform} type={selected===p.platform?'primary':'tertiary'} onClick={()=>setSelected(p.platform)}>{p.platform} · {p.statusLabel}</Button>)}</Space>
   <section className="gd-platform-detail" aria-label={current.platform+'诊断数据'}><div className="gd-detail-identity"><PlatformLogo name={current.platform}/><div><h3>{current.platform}</h3><span className={'gd-status is-'+current.status}><i/>{current.statusLabel}</span><p>{current.expected?`本批有效回答 ${current.success} / ${current.expected}${current.failed?' · 异常 '+current.failed:''}`:'尚未在最近一批中采样'}</p></div></div>
    {[['检测问题数',current.samples?current.questions:null],['有效回答次数',current.samples||null],['品牌提及次数',current.samples?current.mentions:null]].map(([label,value])=><div className="gd-detail-metric" key={String(label)}><span>{label}</span><strong>{numeric(value)}</strong><small>累计自动采样</small></div>)}
    <div className="gd-detail-time"><span>最近有效检测</span><time>{date(current.latest_at)}</time><small>{current.latest_at?'以实际采样时间为准':'尚无有效采样'}</small></div><Button className="gd-record-button" onClick={()=>navigate('diagnostic-reports')}>查看记录<IconArrowRight/></Button>
   </section>
   <div className="gd-footer"><span>未诊断显示“—”，不代表品牌未被提及。平台状态与累计指标分别统计。</span><Space><Button theme="borderless" onClick={()=>navigate('diagnostic-reports')}>全部诊断记录</Button><Button theme="borderless" onClick={()=>navigate('automation')}>自动化计划与定期复测<IconArrowRight/></Button></Space></div>
   {!d.options.available&&<Banner className="gd-service-notice" type="warning" closeIcon={null} description={d.options.notice}/>}
   <Modal className="gd-create-modal" title="开始 GEO 诊断" visible={creating} getPopupContainer={popup} width={820} footer={null} onCancel={()=>setCreating(false)} maskClosable={false} unmountOnClose><Visibility/></Modal>
  </div>;
 }}</Loading>;
}
