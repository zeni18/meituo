'use strict';
/* 视频剪辑 · 布局优化交互原型 —— 只演示前端布局与交互，不连接任何接口。
   a-core：工具函数、示例数据、状态、派生计算 */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ic=(n,c='')=>'<svg class="ic '+c+'" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
const nv=k=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+(NAV[k]||'')+'</svg>';
const TPI='<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8.71 9.005a.734.734 0 0 0 .295-.295l2.35-4.327a.734.734 0 0 1 1.29 0l2.35 4.327c.068.125.17.227.295.295l4.327 2.35a.734.734 0 0 1 0 1.29l-4.327 2.35a.735.735 0 0 0-.295.295l-2.35 4.327a.734.734 0 0 1-1.29 0l-2.35-4.327a.734.734 0 0 0-.294-.295l-4.327-2.35a.734.734 0 0 1 0-1.29l4.327-2.35Z"/></svg>';
const TP=n=>'<span class="tp">'+TPI+'<span class="num">'+n+'</span></span>';
const PLAY='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z"/></svg>';
const PAUSE='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/></svg>';
const fmt=t=>{t=Math.max(0,Math.round(t));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');};
const sec=t=>String(Math.round(t*10)/10);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

/* 图片转 blob 地址，避免在 DOM 里重复几十 KB 的 data URL */
for(const k in IMG){if(!/^data:/.test(IMG[k]))continue;try{const p=IMG[k].split(','),mime=p[0].slice(5,p[0].indexOf(';')),bin=atob(p[1]),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);IMG[k]=URL.createObjectURL(new Blob([u],{type:mime}));}catch(e){}}

/* 示例素材：图片取自真实后台 public/merchant/design-assets */
const ASSETS=[
 {id:1,name:'门头 · 白天',img:'bright',kind:'video',d:12,f:'store'},
 {id:2,name:'日落门店',img:'modern',kind:'video',d:18,f:'store'},
 {id:3,name:'夜景门头',img:'night',kind:'video',d:9,f:'store'},
 {id:4,name:'木门门店',img:'warm',kind:'video',d:14,f:'store'},
 {id:5,name:'讲解员 · 新品口播',img:'avatar',kind:'video',d:32,f:'people'},
 {id:6,name:'精华液 · 暖光',img:'product',kind:'image',f:'product'},
 {id:7,name:'衬衫上身',img:'wear',kind:'image',f:'product'},
 {id:8,name:'门头特写',img:'clip',kind:'video',d:8,f:'store'}];
const A=id=>ASSETS.find(a=>a.id===id);
const FOLDERS=[['all','全部素材'],['store','门店实拍'],['product','商品图'],['people','出镜人物'],['none','未分组']];
const MODES=[['quick','一键成片','onekey'],['mix','批量混剪','batch'],['oral','口播','oral'],['script','分镜脚本','script']];
const ML=Object.fromEntries(MODES.map(m=>[m[0],m[1]])),URLK=Object.fromEntries(MODES.map(m=>[m[2],m[0]])),KURL=Object.fromEntries(MODES.map(m=>[m[0],m[2]]));
const RT={quick:'时长规则',mix:'混剪规则',script:'当前镜头',oral:'口播节奏'};
const SUBMODES={quick:[['none','无需字幕'],['global','全局字幕'],['sentence','逐句字幕']],mix:[['none','无需字幕'],['global','全局字幕'],['sentence','逐句字幕']],
 script:[['none','无需字幕'],['shot','分镜字幕'],['global','全局字幕'],['sentence','逐句字幕']],oral:[['none','无需字幕'],['script','按口播文案'],['sentence','逐句字幕']]};
const SUBDEF={quick:'global',mix:'global',script:'shot',oral:'script'};
const VOICES=[['','不配音'],['std-f','标准音色 · 清晰女声'],['std-m','标准音色 · 沉稳男声'],['pub-1','公共复刻音色 · 温柔店员'],['my-1','我的音色 · 小林']];
const VN=Object.fromEntries(VOICES);
const TRS=['无转场','渐隐','向左擦除','向右擦除','圆形溶解','放大消失'];
const FILTERS={'原始画面':'','清晰明亮':'brightness(1.08) contrast(1.06)','柔和自然':'saturate(.8) brightness(1.05)','鲜明色彩':'saturate(1.35) contrast(1.05)'};
const FONTS=['宋体','阿里巴巴普惠体','微软雅黑','楷体','思源黑体','思源宋体','站酷快乐体'];
const FONTCSS={'宋体':"'SimSun','Songti SC',serif",'阿里巴巴普惠体':"'Alibaba PuHuiTi','PingFang SC','Microsoft YaHei',sans-serif",'微软雅黑':"'Microsoft YaHei',sans-serif",'楷体':"'KaiTi','STKaiti',serif",'思源黑体':"'Source Han Sans SC','Noto Sans SC',sans-serif",'思源宋体':"'Source Han Serif SC','Noto Serif SC',serif",'站酷快乐体':"'ZCOOL KuaiLe','Microsoft YaHei',cursive"};
/* 花字只做近似示意，真实效果以云端成片为准 */
const FLW=['','color:#FFE14D;--sc:#E5484D','color:#fff;text-shadow:0 0 .35em #5B5CF6,0 0 .12em #5B5CF6','color:#16171D;background:#FFD43B;padding:0 .25em;border-radius:.18em','color:#fff;background:#E5484D;padding:0 .25em;border-radius:.18em','color:#7CF5C8;--sc:#0B5D44','color:#fff;--sc:#16171D;text-shadow:.06em .06em 0 #5B5CF6','color:#FFD1E8;--sc:#B4236B','color:#16171D;background:#fff;padding:0 .25em;border-radius:.18em','color:#FFB224;--sc:#3B2300','color:#fff;--sc:#0E7490;text-shadow:0 .08em 0 #0E7490','color:#C7F36B;--sc:#2B4300'];
const ANIMS=['无动画','淡入','上滑','打字机','弹入'];
const CAPS={oss:'素材云存储',ims:'视频合成',tts:'文本配音',icl:'自定义音色',llm:'AI 脚本',asr:'自动字幕',imm:'批量打包下载',avatar:'数字人口播'};
const CAP_USE={tts:'用标准音色或我的音色给视频配音',icl:'用自己录的声音克隆音色',llm:'用 AI 生成选题和口播文案',asr:'从素材语音自动识别字幕',imm:'把多条成片打包成 ZIP 下载',avatar:'直接选数字人形象出镜口播',ims:'提交云端合成成片',oss:'上传和存储素材'};
const CAP_DEP={oss:'几乎所有云端功能的前提',ims:'云合成、云端模板、素材智能处理',tts:'配音（标准音色、公共复刻音色）',icl:'我的音色',llm:'AI 生成选题、AI 写口播文案',asr:'识别音频字幕',imm:'打包下载、图片标签与文字识别',avatar:'口播模式里的数字人出镜'};
/* 演示用默认接入状态：对应本地环境“云合成配置已就绪”，其余待配置 */
const CAP_DEFAULT={oss:true,ims:true,tts:false,icl:false,llm:false,asr:false,imm:false,avatar:false};
const SOON={avatar:true};
const PKMAX={pool:100,shot:20,broll:20,host:1,cover:20};
const GEN_HINT={quick:'按素材顺序轮换组合，每条开头不同',mix:'每条随机抽取镜头，尽量不重复',script:'按镜头顺序生成；一个镜头有多个素材时每条随机取一个',oral:'按口播文案生成，穿插画面每条随机'};

const ORAL_TEXT='大家好，我是静安店的小林。今天给大家介绍春季新品精华液。它质地轻薄，上脸很快就吸收了。现在到店扫码，就能领取新人礼。周末还有限时体验价，欢迎来店里试试。';
const SCRIPT_TEXT='春天到了，静安店的新品也到了。\n这款精华液质地轻薄，上脸很快吸收，适合换季的皮肤。\n到店扫码就能领取新人礼，还能免费试用。\n周末两天限时体验价，等你来店里试试。';
const newShots=()=>[1,2,3].map(i=>({name:'镜头'+i,dur:5,items:[],cap:''}));
function initial(){return{
 mode:'quick',name:'春季新品推广',dirty:false,rev:3,savedAt:'20:41',
 pool:[1,2,4,6,8],quick:{min:10,max:15},mix:{kMin:3,kMax:4,dMin:3,dMax:5,seed:7,ex:0},
 shots:[{name:'开场 · 门头',dur:4,items:[1,3],cap:'春季新品到店，欢迎进店看看'},{name:'产品特写',dur:5,items:[6],cap:'新品精华液，限时体验价'},{name:'到店引导',dur:4,items:[4],cap:'到店扫码，领取新人礼'}],cur:0,cover:[],
 oral:{text:ORAL_TEXT,host:5,broll:[6,1,8],every:6,len:2,who:'video'},
 subMode:{...SUBDEF},lines:['春季新品上市，限时体验','到店扫码，领取新人礼','周末活动，等你来店'],
 sent:[{s:0,e:3,t:'春季新品上市'},{s:3,e:7,t:'到店扫码领取新人礼'},{s:7,e:11,t:'周末活动等你来'}],titles:['春季新品到店'],
 sty:{sub:{font:'宋体',fl:0,anim:'淡入',size:54,color:'#FFFFFF',stroke:'#000000',sw:2,pos:80,align:'center'},ttl:{font:'宋体',fl:3,anim:'弹入',size:76,color:'#FFFFFF',stroke:'#000000',sw:0,pos:16,align:'center',start:0,end:3}},
 keep:false,voice:'',bgm:[{name:'轻快 · 春日',d:136}],vVol:100,bVol:50,oVol:100,rate:1,fadeIn:1,fadeOut:1,
 tr:'渐隐',trD:.5,filters:['原始画面'],speed:1,stickers:[{name:'新品上市',shot:0}],adj:{c:0,s:0,b:0,h:0},adjOpen:false,
 ratio:'9:16',res:'720P',fps:25,fill:'拉伸模糊',fillColor:'#000000',durBy:'video',gen:{quick:3,mix:6,script:1,oral:1},lib:'未分组成片',
 open:{rule:true,text:true,sound:false,fx:false},t:0,playing:false,pane:'b',trackMin:false,rail:false,
 jobs:[],cloudAll:false,ov:null,pop:null,styTab:'sub',scriptStep:2,
 scriptDraft:{src:'brand',goal:'新品到店引流',style:'亲切口语',aud:'附近 25-40 岁女性',info:'',topic:'春季新品精华液到店体验',text:SCRIPT_TEXT},pk:null};}
const S=initial();
try{const q=new URLSearchParams(location.search).get('mode');if(q&&URLK[q])S.mode=URLK[q];}catch(e){}
const DATA_KEYS=['mode','name','pool','quick','mix','shots','cur','cover','oral','subMode','lines','sent','titles','sty','keep','voice','bgm','vVol','bVol','oVol','rate','fadeIn','fadeOut','tr','trD','filters','speed','stickers','adj','ratio','res','fps','fill','fillColor','durBy','gen','lib'];
const snap=()=>JSON.stringify(Object.fromEntries(DATA_KEYS.map(k=>[k,S[k]])));
const restore=j=>Object.assign(S,JSON.parse(j));
const okCap=c=>S.cloudAll||!!CAP_DEFAULT[c];
const badge=c=>okCap(c)?'':(SOON[c]?'<span class="bdg soon">即将上线</span>':'<span class="bdg cfg">配置中</span>');
const gated=c=>okCap(c)?'':' gated';

/* ---------- 派生计算 ---------- */
function rnd(seed){let a=seed>>>0||1;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function pick(arr,k,seed){const r=rnd(seed*9301+49297),a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,k);}
const sentences=t=>(String(t).match(/[^。！？!?；;\n]+[。！？!?；;]?/g)||[]).map(s=>s.trim()).filter(Boolean);
const oralDur=()=>{const n=S.oral.text.replace(/\s/g,'').length;return n?Math.max(3,Math.ceil(n/(4.5*S.rate))):0;};
function segs(){
 const m=S.mode;
 if(m==='quick'){const p=S.pool.slice(0,8);if(!p.length)return[];const T=S.quick.max,n=p.length,b=Math.floor(T/n),r=T-b*n;return p.map((id,i)=>({id,d:Math.max(1,b+(i<r?1:0))}));}
 if(m==='mix'){if(!S.pool.length)return[];const k=Math.min(S.mix.kMax,S.pool.length),d=Math.round((S.mix.dMin+S.mix.dMax)/2*10)/10;return pick(S.pool,k,S.mix.seed+S.mix.ex).map(id=>({id,d}));}
 if(m==='script')return S.shots.map((s,i)=>({id:s.items[0]||null,d:s.dur,cap:s.cap,shot:i}));
 const T=oralDur();if(!T)return[];const o=S.oral,host=o.who==='video'?o.host:(okCap('avatar')?5:null);
 if(!o.broll.length)return[{id:host,d:T,host:true}];
 const out=[];let t=0,b=0;
 while(t<T-.01){const h=Math.min(o.every,T-t);out.push({id:host,d:Math.round(h*10)/10,host:true});t+=h;if(t>=T-.01)break;const l=Math.min(o.len,T-t);out.push({id:o.broll[b++%o.broll.length],d:Math.round(l*10)/10});t+=l;}
 return out;}
const total=(L=segs())=>Math.round(L.reduce((a,s)=>a+s.d,0)*10)/10;
function at(t,L=segs()){let a=0;for(let i=0;i<L.length;i++){if(t<a+L[i].d)return{i,s:L[i],a};a+=L[i].d;}return L.length?{i:L.length-1,s:L[L.length-1],a:a-L[L.length-1].d}:null;}
function caps(){
 const md=S.subMode[S.mode],L=segs(),out=[];let a=0;
 if(md==='global'){if(!S.lines.length)return out;L.forEach((s,i)=>{out.push({s:a,e:a+s.d,t:S.lines[i%S.lines.length]});a+=s.d;});return out;}
 if(md==='sentence')return S.sent.filter(x=>x.t&&x.e>x.s).map(x=>({...x}));
 if(md==='shot'){L.forEach(s=>{if(s.cap)out.push({s:a,e:a+s.d,t:s.cap});a+=s.d;});return out;}
 if(md==='script'){const ss=sentences(S.oral.text),T=total(L),n=ss.reduce((x,y)=>x+y.length,0)||1;let t=0;ss.forEach(x=>{const d=T*x.length/n;out.push({s:t,e:t+d,t:x.replace(/[。！？!?；;]$/,'')});t+=d;});}
 return out;}
function unitDur(){const m=S.mode;if(m==='quick')return S.quick.max;if(m==='mix')return Math.round((S.mix.kMin+S.mix.kMax)/2*(S.mix.dMin+S.mix.dMax)/2*10)/10;if(m==='script')return Math.round(S.shots.reduce((a,s)=>a+s.dur,0)*10)/10;return oralDur();}
const cost=()=>Math.round(unitDur()*S.gen[S.mode]*2); /* 示例费率 2 TP/秒，实际以后台定价为准 */
function combos(){const n=S.pool.length;let c=0;for(let k=S.mix.kMin;k<=Math.min(S.mix.kMax,n);k++){let p=1;for(let i=0;i<k;i++)p*=n-i;c+=p;}return c;}
function variant(i){const m=S.mode;
 if(m==='quick'){const p=S.pool.slice(0,8);if(!p.length)return[];const r=i%p.length;return p.slice(r).concat(p.slice(0,r));}
 if(m==='mix')return pick(S.pool,Math.min(S.mix.kMax,S.pool.length),S.mix.seed+i);
 if(m==='script')return S.shots.map(s=>s.items.length?s.items[(i)%s.items.length]:null);
 return segs().map(s=>s.id);}
function blockers(){const m=S.mode,B=[];
 if(m==='quick'||m==='mix'){if(!S.pool.length)B.push({msg:'还没有镜头素材',act:'pick',v:'pool',label:'去添加'});else if(m==='mix'&&S.pool.length<S.mix.kMin)B.push({msg:'每条至少抽 '+S.mix.kMin+' 个镜头，现在只有 '+S.pool.length+' 个素材',act:'pick',v:'pool',label:'去添加'});}
 if(m==='script'){if(!S.shots.length)B.push({msg:'还没有镜头',act:'addShot',label:'添加镜头'});S.shots.forEach((s,i)=>{if(!s.items.length)B.push({msg:'镜头 '+(i+1)+'「'+(s.name||'未命名')+'」还没有素材',act:'gotoShot',v:i,label:'去添加'});});}
 if(m==='oral'){if(!S.oral.text.trim())B.push({msg:'还没有口播文案',act:'focusText',label:'去填写'});if(S.oral.who==='video'&&!S.oral.host)B.push({msg:'还没有选择口播视频',act:'pick',v:'host',label:'去选择'});if(S.oral.who==='avatar'&&!okCap('avatar'))B.push({msg:'数字人口播即将上线，请先用口播视频',act:'who',v:'video',label:'改用口播视频'});}
 return B;}
const subLabel=()=>({none:'无需字幕',global:'全局字幕 '+S.lines.length+' 条',sentence:'逐句字幕 '+S.sent.length+' 句',shot:'分镜字幕',script:'按口播文案 · '+sentences(S.oral.text).length+' 句'}[S.subMode[S.mode]]);
const SUM={
 rule:()=>{const m=S.mode;if(m==='quick')return S.quick.min+'～'+S.quick.max+' 秒/条';if(m==='mix')return '每条 '+S.mix.kMin+'～'+S.mix.kMax+' 个镜头 · 每镜 '+sec(S.mix.dMin)+'～'+sec(S.mix.dMax)+' 秒';
  if(m==='script'){const s=S.shots[S.cur];return s?'镜头 '+(S.cur+1)+'/'+S.shots.length+' · '+sec(s.dur)+' 秒 · '+s.items.length+' 个素材':'还没有镜头';}return '约 '+oralDur()+' 秒 · 每 '+S.oral.every+' 秒穿插 '+S.oral.len+' 秒画面';},
 text:()=>subLabel()+(S.titles.length?' · 标题 '+S.titles.length+' 条':'')+' · '+S.sty.sub.font,
 sound:()=>[S.mode==='oral'?(S.voice?'AI 配音':'口播原声'):(S.keep?'保留原声':'消除原声'),S.voice?VN[S.voice]:'不配音',S.bgm.length?'背景音乐 '+S.bgm.length+' 首':'无背景音乐'].join(' · '),
 fx:()=>[S.tr,S.filters.join('/'),S.mode!=='quick'&&S.speed!==1?S.speed+'x 速度':'',S.stickers.length?'贴纸 '+S.stickers.length+' 个':''].filter(Boolean).join(' · ')};
