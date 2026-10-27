export const sections=[
 {key:'desk',label:'工作台',groups:[{label:'总览',items:[['overview','工作台']]}]},
 {key:'library',label:'AI创作素材库',groups:[
  {label:'创作准备',items:[['keywords','拓词库'],['keyword-library','品牌拓词库'],['questions','写作标题'],['images','企业画像图库'],['brand','企业知识库'],['materials','事实素材']]},
  {label:'AI文章写作',items:[['instructions','写作指令'],['categories','文章分类'],['create','创建写作任务'],['writing-jobs','AI写作任务'],['articles','AI创作台'],['article-library','文章库']]},
  {label:'AI流量复刻',items:[['replicate','全网爆文复刻'],['batch-replicate','批量爆文复刻']]},
  {label:'AI工具助手',items:[['ai-keywords','AI拓词'],['manual-keywords','手动拓词工具'],['search','网页检索']]}]},
 {key:'publish',label:'媒体发布',groups:[
  {label:'B2B发布',items:[['b2b-sites','B2B行业网站'],['b2b-tasks','B2B自动发布任务'],['contacts','联系方式管理'],['b2b-records','发布记录']]},
  {label:'网站媒体',items:[['website','单条发布媒体'],['website-tasks','AI智能发布任务'],['website-orders','投稿记录'],['website-favorites','收藏分组']]},
  {label:'自媒体大V',items:[['influencer','发布自媒体'],['influencer-orders','投稿记录'],['influencer-favorites','收藏分组']]},
  {label:'个人自媒体',items:[['accounts','账号授权'],['owned-tasks','发布任务'],['owned-records','发布记录']]},
  {label:'AI官网SEO',items:[['sites','站点管理'],['seo-tasks','SEO发布任务'],['seo-records','发布记录']]}]},
 {key:'data',label:'数据中心',groups:[{label:'数据与效果',items:[['reports','数据报表'],['diagnose','AI可见度诊断'],['diagnostic-reports','诊断报告'],['query','查询（带截图）'],['evidence','查询记录'],['keyword-index','关键词指数'],['jobs','任务与算力明细']]}]}
];
export const itemTitle=(key:string)=>key==='automation'?'自动化计划':sections.flatMap(s=>s.groups.flatMap(g=>g.items)).find(i=>i[0]===key)?.[1]||'工作台';
export const sectionFor=(key:string)=>sections.find(s=>s.groups.some(g=>g.items.some(i=>i[0]===key)))||sections[0];

// GEO destinations; recurring execution lives in the independent automation page.
export const mainGroups=[
 {key:'diagnose',title:'GEO诊断',tabs:[['diagnose','平台可见度'],['overview','数据总览'],['reports','效果统计'],['evidence','人工观察']]},
 {key:'automation',title:'自动化计划',tabs:[['automation','自动化计划']]},
 {key:'website',title:'媒体发布',tabs:[['website','网站媒体'],['influencer','自媒体'],['website-orders','投稿记录'],['website-favorites','我的收藏']]},
 {key:'keywords',title:'拓词库',tabs:[['keywords','品牌词表']]},
 {key:'articles',title:'AI创作',tabs:[['articles','写稿创作'],['article-library','文章库'],['materials','事实素材'],['images','图片素材'],['jobs','任务与算力']]}
];
export const modalParents:Record<string,string>={create:'articles',replicate:'articles','batch-replicate':'articles','ai-keywords':'questions','manual-keywords':'questions',search:'materials',instructions:'articles',categories:'articles','influencer-favorites':'influencer',contacts:'website',sites:'website','b2b-sites':'website','b2b-tasks':'website','b2b-records':'website','website-tasks':'website',accounts:'website','owned-tasks':'website','owned-records':'website','seo-tasks':'website','seo-records':'website',query:'evidence','keyword-index':'reports'};
export const isTool=(key:string)=>Object.hasOwn(modalParents,normalized(key));
export const normalized=(key:string)=>['keyword-library','keyword-index','ai-keywords','manual-keywords','questions'].includes(key)?'keywords':key==='writing-jobs'?'jobs':key==='influencer-orders'?'website-orders':key;
export const baseFor=(key:string,back?:string)=>{key=normalized(key);if(['create','replicate','batch-replicate'].includes(key))return 'articles';return isTool(key)?(back&&mainGroups.some(g=>g.tabs.some(t=>t[0]===normalized(back)))?normalized(back):modalParents[key]):key;};
export const groupFor=(key:string)=>mainGroups.find(g=>g.tabs.some(t=>t[0]===key))||mainGroups[0];
