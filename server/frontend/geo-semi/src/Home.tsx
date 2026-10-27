import {useState} from 'react';
import {Button,Card,Progress,Radio,RadioGroup,Space,Table,Tag} from '@douyinfe/semi-ui';
import {IconArrowRight,IconBook,IconEdit,IconHistogram,IconSearch,IconSend,IconTickCircle} from '@douyinfe/semi-icons';
import {api,date,labels,Row} from './api';
import {PlatformLabel} from './PlatformLogo';
import {blank,External,Loading,StateTag,useGeo,useLoad} from './shared';

const ranges=[['all','全部'],['today','今天'],['yesterday','昨天'],['7d','近7天'],['30d','近30天']];
const number=(v:unknown)=>v===null||v===undefined?'—':Number(v).toLocaleString('zh-CN');

export default function Home(){
 const {navigate}=useGeo();const [range,setRange]=useState('all');const state=useLoad(()=>api('dashboard',{range}),[range]);
 const platformColumns:any[]=[
  {title:'AI平台',dataIndex:'platform',width:190,render:(name:string)=><PlatformLabel name={name}/>},
  {title:'检测问题数',dataIndex:'questions',align:'right',width:140,render:(v:number,r:Row)=>r.samples?number(v):'—'},
  {title:'有效回答次数',dataIndex:'samples',align:'right',width:140,render:(v:number)=>v?number(v):'—'},
  {title:'品牌提及次数',dataIndex:'mentions',align:'right',width:140,render:number},
  {title:'最近检测',dataIndex:'latest_at',width:180,render:(v:number)=>v?date(v):<span className="gh-muted">尚未诊断</span>},
  {title:'操作',width:90,render:()=> <Button theme="borderless" onClick={()=>navigate('diagnostic-reports')}>查看记录</Button>}
 ];
 return <div className="gh-home">
  <div className="gh-heading"><div><h1>数据总览</h1><Button className="gh-report-link" theme="solid" onClick={()=>navigate('reports')}>数据报表</Button></div><Space wrap><Button onClick={()=>navigate('automation')}>自动化计划</Button><Button theme="solid" icon={<IconArrowRight/>} onClick={()=>navigate('diagnose',{start:1})}>开始诊断</Button></Space></div>
  <div className="gh-range-bar"><span>{state.data?.brand.name||'品牌内容与可见度概览'}</span><RadioGroup aria-label="首页统计时间范围" type="button" value={range} onChange={e=>setRange(String(e.target.value))}>{ranges.map(([value,label])=><Radio key={value} value={value}>{label}</Radio>)}</RadioGroup></div>
  <Loading state={state}>{d=>{
   const complete=Math.round(d.brand.complete/d.brand.total*100);
   const metrics=[{key:'articles',label:'内容文章',value:d.stats.articles,help:'已保存的内容资产',icon:<IconBook/>,target:'articles'},{key:'published',label:'发布成功订单',value:d.stats.published,help:'按订单创建时间统计',icon:<IconSend/>,target:'website-orders'},{key:'mentions',label:'品牌提及次数',value:d.stats.mentions,help:d.stats.samples?`来自 ${number(d.stats.samples)} 次有效自动采样`:'完成自动诊断后查看提及数据',icon:<IconHistogram/>,target:'diagnostic-reports'}];
   return <>
    <div className="gh-metrics">{metrics.map(m=><button className={'gh-metric is-'+m.key} key={m.key} onClick={()=>navigate(m.target)} aria-label={`${m.label}：${number(m.value)}，查看详情`}><span className="gh-metric-copy"><span>{m.label}</span><strong>{number(m.value)}</strong><small>{m.help}</small></span><span className="gh-metric-art" aria-hidden="true">{m.icon}</span></button>)}</div>
    <div className="gh-ready-bar"><div className="gh-ready-label"><IconTickCircle/><span>品牌资料</span><strong>{complete}%</strong><Progress percent={complete} showInfo={false}/><span className="gh-muted">{d.brand.complete}/{d.brand.total} 项已完善</span><Button theme="borderless" size="small" onClick={()=>navigate('brand')}>{complete===100?'查看资料':'完善资料'}<IconArrowRight/></Button></div><div className="gh-shortcuts"><Button icon={<IconEdit/>} theme="borderless" onClick={()=>navigate('create')}>AI内容创作</Button><Button icon={<IconSend/>} theme="borderless" onClick={()=>navigate('website')}>媒体发布</Button><Button icon={<IconSearch/>} theme="borderless" onClick={()=>navigate('diagnose')}>可见度诊断</Button></div></div>
    <section className="gh-section" aria-label="AI平台可见度统计"><div className="gh-section-heading"><h2>AI平台可见度统计</h2><Button theme="borderless" icon={<IconSearch/>} onClick={()=>navigate('diagnose')}>开始诊断</Button></div><Card className="gh-panel gh-platform-panel"><Table rowKey="platform" columns={platformColumns} dataSource={d.platforms} pagination={false} scroll={{x:880}}/><p className="gh-table-note">仅统计真实自动采样；尚未诊断显示“—”，不代表品牌未被提及。</p></Card></section>
    <div className="gh-two-columns">
     <section className="gh-section" aria-label="最新发布订单"><div className="gh-section-heading"><h2>最新发布订单</h2><Button theme="borderless" size="small" onClick={()=>navigate('website-orders')}>全部订单<IconArrowRight/></Button></div><Card className="gh-panel gh-list-panel">{d.latest_published.length?<div className="gh-published-list">{d.latest_published.map((r:Row)=><article key={r.id}><div><Button theme="borderless" className="gh-article-title" onClick={()=>navigate('website-orders')}>{r.title}</Button><span>{r.media_name}</span></div><div><time>{date(r.create_time)}</time>{r.published_url?<External url={r.published_url}>查看回链</External>:<Tag>已发布</Tag>}</div></article>)}</div>:<div className="gh-empty">{blank('暂无已发布订单')}<Button onClick={()=>navigate('website')}>选择媒体发布</Button></div>}</Card></section>
     <section className="gh-section" aria-label="近期检测问题"><div className="gh-section-heading"><h2>近期检测问题</h2><Button theme="borderless" size="small" onClick={()=>navigate('diagnostic-reports')}>诊断报告<IconArrowRight/></Button></div><Card className="gh-panel gh-list-panel"><Table rowKey={(r?:Row)=>r?r.platform+'-'+r.question:''} pagination={false} dataSource={d.recent_questions} empty={blank('暂无实际诊断问题')} columns={[{title:'检测问题',dataIndex:'question',ellipsis:true},{title:'平台',dataIndex:'platform',width:140,render:(name:string)=><PlatformLabel name={name}/>},{title:'提及 / 采样',width:110,align:'right',render:(_:any,r:Row)=>`${number(r.mentions)} / ${number(r.samples)}`}]} scroll={{x:420}}/></Card></section>
    </div>
    <section className="gh-section" aria-label="最近任务"><div className="gh-section-heading"><h2>最近任务</h2><Button theme="borderless" size="small" onClick={()=>navigate('jobs')}>全部任务<IconArrowRight/></Button></div><Card className="gh-panel"><Table rowKey="id" pagination={false} dataSource={d.recent_tasks} empty={blank('暂无任务，可从一键优化或独立创作开始')} columns={[{title:'任务主题',dataIndex:'subject',ellipsis:true},{title:'类型',dataIndex:'operation',width:160,render:(v:string)=>labels[v]||v},{title:'状态',dataIndex:'status',width:120,render:(v:string)=><StateTag value={v}/>},{title:'创建时间',dataIndex:'create_time',width:190,render:date}]} scroll={{x:720}}/></Card></section>
    <div className="gh-process" aria-label="GEO独立功能入口"><span>优化流程</span>{[['brand','品牌建档'],['diagnose','可见度诊断'],['automation','自动化计划'],['create','内容创作'],['website','媒体发布'],['diagnostic-reports','复测反馈']].map(([key,label],i)=><Button key={label} theme="borderless" onClick={()=>navigate(key)}><small>{String(i+1).padStart(2,'0')}</small>{label}{i<5&&<IconArrowRight/>}</Button>)}</div>
   </>;
  }}</Loading>
 </div>;
}
