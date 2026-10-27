/* d-events：渲染调度、事件分发、播放、拖拽排序、模拟剪辑任务、初始化 */
const DEF_STY=JSON.parse(JSON.stringify(S.sty));
const colFns={A:colA,B:colB,C:colC};
const narrow=()=>innerWidth<1100;
function renderCol(x){const el=$('#col'+x);if(!el)return;const cb=el.querySelector('.cb'),top=cb?cb.scrollTop:0;el.innerHTML=colFns[x]();const nb=el.querySelector('.cb');if(nb)nb.scrollTop=top;if(x==='C'){frameSig='';paint();}}
function demoBtn(){const d=$('#demo');d.className='demo'+(S.cloudAll?' all':'');d.innerHTML='<i></i>原型演示 · 云能力'+(S.cloudAll?'全部已接入':'部分待配置');}
function renderAll(){
 $('#app').classList.toggle('rail',S.rail);
 shell();header();pagebar();$('#ed').dataset.pane=S.pane;
 renderCol('A');renderCol('B');renderCol('C');renderT();frameSig='';paint();layer();pop();demoBtn();sums();}
function keepFocus(fn){const a=document.activeElement;let sel=null;
 if(a&&a!==document.body&&a.dataset){const q=(n,v)=>v==null?'':'[data-'+n+'="'+CSS.escape(v)+'"]';
  if(a.dataset.k)sel='[data-k="'+CSS.escape(a.dataset.k)+'"]'+q('v',a.dataset.v);else if(a.dataset.act)sel='[data-act="'+a.dataset.act+'"]'+q('v',a.dataset.v)+q('i',a.dataset.i);}
 fn();if(sel){const n=$(sel);if(n&&n!==document.activeElement)n.focus({preventScroll:true});}}

/* ---------- 局部刷新：不重绘正在输入的栏 ---------- */
const SUMX={rule:SUM.rule,text:SUM.text,sound:SUM.sound,fx:SUM.fx,
 oralMeta:()=>S.oral.text.replace(/\s/g,'').length+' 字 · '+sentences(S.oral.text).length+' 句 · 约 '+oralDur()+' 秒',
 oralDur:()=>'约 '+oralDur()+' 秒',oralVoice:()=>S.voice?'AI 配音 · '+VN[S.voice]:'口播视频原声',mixNote:()=>mixNote(),
 scriptSubs:()=>'按口播文案自动断句，共 '+sentences(S.oral.text).length+' 句，时间跟着语速走。',
 startN:()=>String(S.gen[S.mode]),scChars:()=>S.scriptDraft.text.replace(/\s/g,'').length+' 字'};
const SUMH={cost:()=>TP(cost()),costNote:()=>sec(unitDur())+' 秒 × '+S.gen[S.mode]+' 条，按成片时长估算<br>现阶段由云服务账号结算，暂不扣 TP'};
function sums(){$$('[data-sum]').forEach(el=>{const k=el.dataset.sum;if(SUMX[k])el.textContent=SUMX[k]();else if(SUMH[k])el.innerHTML=SUMH[k]();});}
function refresh(){
 sums();const g=$('#gen');if(g)g.innerHTML=genLabel();
 renderT();paint();
 const v=$('#vars');if(v)v.innerHTML=varsHtml();
 const b=$('#blk');if(b){b.innerHTML=blkHtml();const s=$('#startBtn');if(s)s.disabled=!!blockers().length;}}

/* ---------- 保存 ---------- */
let saveT=0;
const now=()=>new Date().toTimeString().slice(0,5);
function dirty(){S.dirty=true;updSave();clearTimeout(saveT);saveT=setTimeout(()=>{S.dirty=false;S.auto=true;S.savedAt=now();updSave();},2500);}
function save(quiet){clearTimeout(saveT);S.dirty=false;S.auto=false;S.rev++;S.savedAt=now();updSave();if(!quiet)toast('已保存为第 '+S.rev+' 版');}

/* ---------- 数据写入 ---------- */
function setPath(k,v){const p=k.split('.');let o=S;for(let i=0;i<p.length-1;i++)o=o[p[i]];o[p[p.length-1]]=v;}
const syncInput=k=>{const n=$('[data-k="'+k+'"]');if(n&&n!==document.activeElement)n.value=get(k);};
const PAIRS=[['quick.min','quick.max'],['mix.kMin','mix.kMax'],['mix.dMin','mix.dMax'],['sty.ttl.start','sty.ttl.end']];
function fixPairs(k){
 for(const [a,b] of PAIRS){if(k===a&&get(a)>get(b)){setPath(b,get(a));syncInput(b);}if(k===b&&get(b)<get(a)){setPath(a,get(b));syncInput(a);}}
 const m=k.match(/^sent\.(\d+)\.(s|e)$/);if(m){const x=S.sent[m[1]];if(x.e<x.s){if(m[2]==='s'){x.e=x.s;syncInput('sent.'+m[1]+'.e');}else{x.s=x.e;syncInput('sent.'+m[1]+'.s');}}}}
function parseVal(el){if(el.dataset.t==='b')return el.checked;if(el.dataset.t==='n'){const n=parseFloat(el.value);return isNaN(n)?null:n;}return el.value;}
const bounds=el=>[parseFloat(el.min||el.dataset.min),parseFloat(el.max||el.dataset.max)];
function apply(k,v,el,isChange){
 setPath(k,v);if(isChange)fixPairs(k);
 if(!k.startsWith('scriptDraft'))dirty();
 if(k==='name')return;
 if(k.startsWith('sty.')||k==='fillColor')frameSig='';
 const rr=el&&el.dataset.rr;
 if(isChange&&rr){if(rr==='ov')keepFocus(layer);else keepFocus(()=>renderCol(rr.toUpperCase()));}
 else if(isChange&&k==='voice')keepFocus(()=>renderCol('B'));
 if(k.startsWith('shots.')&&S.mode==='script')renderCol('A');
 refresh();}
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset||!el.dataset.k||el.tagName==='SELECT'||el.type==='checkbox')return;
 const v=parseVal(el);if(v===null)return;
 if(el.type==='range'){const o=el.parentElement.querySelector('output');if(o){const u=o.dataset.u;o.textContent=u==='x'?(+v).toFixed(2).replace(/0$/,'')+'x':v+u;}}
 if(el.dataset.t==='n'&&el.type!=='range'){const [mn,mx]=bounds(el);if(v<mn||v>mx)return;}
 apply(el.dataset.k,v,el,false);});
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset||!el.dataset.k)return;let v=parseVal(el);
 if(el.dataset.t==='n'&&el.type!=='range'){const [mn,mx]=bounds(el);if(v===null)v=get(el.dataset.k);if(!isNaN(mn))v=Math.max(mn,v);if(!isNaN(mx))v=Math.min(mx,v);el.value=v;}
 if(el.dataset.k==='voice'&&v){const c=v.startsWith('my')?'icl':'tts';if(!okCap(c)){el.value=S.voice;openOv({type:'notice',cap:c},el);return;}}
 apply(el.dataset.k,v,el,true);});

/* ---------- 播放 ---------- */
let raf=0,last=0;
function stop(){S.playing=false;cancelAnimationFrame(raf);}
function play(){const T=total();if(!T)return;S.playing=!S.playing;if(S.playing){if(S.t>=T-.05)S.t=0;last=performance.now();raf=requestAnimationFrame(loop);}else cancelAnimationFrame(raf);paint();}
function loop(t){const T=total();S.t+=(t-last)/1000;last=t;if(S.t>=T){S.t=Math.max(0,T-.01);S.playing=false;paint();return;}paint();raf=requestAnimationFrame(loop);}
function seekTo(t){S.t=clamp(t,0,Math.max(0,total()-.01));paint();}
function segStart(i){const L=segs();let a=0;for(let k=0;k<i&&k<L.length;k++)a+=L[k].d;return a;}
const seekFrom=(el,e)=>{const r=el.getBoundingClientRect();seekTo((e.clientX-r.left)/r.width*total());};

/* ---------- 排序（拖拽 + Alt 方向键） ---------- */
function reorder(type,i,j,refocus){
 const arr=type==='pool'?S.pool:S.shots;if(j<0||j>=arr.length||i===j)return;
 const [x]=arr.splice(i,1);arr.splice(j,0,x);
 if(type==='shot'){const map=k=>k===i?j:(i<j&&k>i&&k<=j)?k-1:(i>j&&k>=j&&k<i)?k+1:k;S.cur=map(S.cur);S.stickers.forEach(s=>{if(s.shot>0)s.shot=map(s.shot-1)+1;});renderCol('B');}
 dirty();renderCol('A');refresh();
 if(refocus){const n=$('[data-drag="'+type+'"][data-i="'+j+'"]');n&&n.focus();}}
let drag=null;
document.addEventListener('dragstart',e=>{const t=e.target.closest&&e.target.closest('[data-drag]');if(!t)return;drag={type:t.dataset.drag,i:+t.dataset.i};t.classList.add('drag');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',String(drag.i));}catch(_){}});
document.addEventListener('dragover',e=>{if(!drag)return;const t=e.target.closest&&e.target.closest('[data-drag="'+drag.type+'"]');if(!t)return;e.preventDefault();$$('.over').forEach(x=>x!==t&&x.classList.remove('over'));t.classList.add('over');});
document.addEventListener('drop',e=>{if(!drag)return;const t=e.target.closest&&e.target.closest('[data-drag="'+drag.type+'"]');if(t){e.preventDefault();const d=drag;drag=null;reorder(d.type,d.i,+t.dataset.i);}});
document.addEventListener('dragend',()=>{drag=null;$$('.drag,.over').forEach(x=>x.classList.remove('drag','over'));});

/* ---------- 浮层 ---------- */
let ovFrom=null;
function openOv(o,from){ovFrom=from||document.activeElement;S.ov=o;S.pop=null;pop();layer();}
function closeOv(){S.ov=null;layer();const f=ovFrom;ovFrom=null;if(f&&document.contains(f))f.focus({preventScroll:true});else{const g=$('#gen');g&&g.focus({preventScroll:true});}}
function openPick(t,back){
 if(t==='shot'&&!S.shots[S.cur])return;
 const cur={pool:S.pool,shot:t==='shot'?S.shots[S.cur].items:[],broll:S.oral.broll,host:S.oral.host?[S.oral.host]:[],cover:S.cover}[t];
 S.pk={target:t,folder:'all',type:t==='cover'?'image':t==='host'?'video':'all',sel:cur.slice(),back:back||''};openOv({type:'pick'});}
function setPane(p){S.pane=p;$('#ed').dataset.pane=p;$$('.pane-seg button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.v===p)));if(p==='c'){frameSig='';paint();}}
function openSec(k){
 if(k==='out'){if(narrow())setPane('c');const b=$('.pvbar');if(b){b.classList.remove('flash');void b.offsetWidth;b.classList.add('flash');}return;}
 S.open[k]=true;if(narrow())setPane('b');renderCol('B');
 const s=$('#sec-'+k);if(s){s.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});s.classList.add('flash');setTimeout(()=>s.classList.remove('flash'),1500);}}
function withUndo(msg,fn){const j=snap();fn();dirty();renderAll();toast(msg,()=>{restore(j);renderAll();dirty();});}
function setMode(m){if(m===S.mode)return;stop();S.mode=m;S.t=0;S.open.rule=true;
 try{const u=new URL(location.href);u.searchParams.set('mode',KURL[m]);history.replaceState(null,'',u.pathname+u.search+u.hash);}catch(e){}
 renderAll();const t=$('.hd .seg [aria-selected=true]');t&&t.focus({preventScroll:true});toast('已切换到「'+ML[m]+'」，素材、字幕和声音设置都保留');}
function blank(){S.name='未命名工程';S.pool=[];S.shots=newShots();S.cur=0;S.cover=[];S.oral=Object.assign({},S.oral,{text:'',host:null,broll:[]});S.lines=[];S.sent=[];S.titles=[];S.bgm=[];S.stickers=[];S.voice='';S.t=0;stop();}

/* ---------- 模拟剪辑任务 ---------- */
let jobT=0;
function updChip(){const c=$('#jobChip'),h=jobChip();if(c){if(h)c.outerHTML=h;else c.remove();}else if(h){const m=$('#moreBtn');m&&m.insertAdjacentHTML('beforebegin',h);}}
function startJobs(n){for(let k=n-1;k>=0;k--){const ids=variant(k).filter(Boolean);S.jobs.unshift({name:S.name+' · 第 '+(k+1)+' 条',img:ids[0]?A(ids[0]).img:'',st:'queue',p:0,lib:S.lib,wait:Math.floor(k/3)});}
 clearInterval(jobT);jobT=setInterval(tickJobs,700);updChip();}
function tickJobs(){
 S.jobs.forEach(j=>{if(j.st==='done')return;if(j.st==='queue'){if(j.wait--<=0)j.st='run';return;}j.p=Math.min(100,j.p+5+Math.random()*9);if(j.p>=100)j.st='done';});
 updChip();if(S.pop&&S.pop.type==='jobs')pop();
 if(!S.jobs.some(j=>j.st!=='done')){clearInterval(jobT);toast('剪辑完成，成片已存入作品库「'+S.lib+'」');}}

/* ---------- 点击动作 ---------- */
const MAXN={lines:100,titles:20,bgm:100,stickers:50,shots:30,sent:200};
const BGMS=[{name:'舒缓 · 午后',d:152},{name:'节奏 · 开业',d:98},{name:'轻快 · 春日',d:136}];
const STKS=['限时体验','到店有礼','新品上市','周末特惠'];
const ACT={
 mode:(el,v)=>setMode(v),
 nav:(el,v)=>{$('#app').classList.remove('nav-open');toast('原型只做了「视频剪辑」页，「'+v+'」不跳转');},
 navOpen:()=>$('#app').classList.toggle('nav-open'),
 rail:()=>{S.rail=!S.rail;$('#app').classList.toggle('rail',S.rail);},
 stub:(el,v)=>toast((v||'该功能')+' · 原型里未展开'),
 pane:(el,v)=>setPane(v),
 save:()=>save(false),
 more:()=>{S.pop=S.pop&&S.pop.type==='more'?null:{type:'more'};pop();const f=$('#popL .mi');f&&f.focus();},
 jobs:()=>{S.pop=S.pop&&S.pop.type==='jobs'?null:{type:'jobs'};pop();},
 clearDone:()=>{S.jobs=S.jobs.filter(j=>j.st!=='done');updChip();if(!S.jobs.length)S.pop=null;pop();},
 newProj:()=>withUndo('已新建空白工程',blank),
 saveTpl:()=>toast('已保存为模板「'+S.name+'」，在「更多 → 我的模板」里使用'),
 help:()=>openOv({type:'help'}),svc:()=>openOv({type:'svc'}),
 gen:el=>openOv({type:'gen'},el),
 genN:(el,v)=>{S.gen[S.mode]=clamp(S.gen[S.mode]+(+v),1,100);syncInput('gen.'+S.mode);dirty();refresh();},
 start:()=>{if(blockers().length)return;const n=S.gen[S.mode];save(true);closeOv();startJobs(n);toast('已提交 '+n+' 条剪辑，进度在右上角查看，可以离开本页');},
 editFrom:(el,v)=>{closeOv();openSec(v);},
 closeOv:()=>closeOv(),
 undo:()=>{if(UNDO){const f=UNDO;UNDO=null;$('#toast').innerHTML='';f();}},
 demo:()=>{S.cloudAll=!S.cloudAll;renderAll();toast(S.cloudAll?'演示：所有云能力都已接入':'演示：恢复为部分能力待配置');},
 /* 素材 */
 pick:(el,v)=>openPick(v||'pool',S.ov&&S.ov.type==='gen'?'gen':''),
 pkF:(el,v)=>{S.pk.folder=v;keepFocus(layer);},
 pkT:(el,v)=>{S.pk.type=v;keepFocus(layer);},
 pkI:el=>{const P=S.pk,id=+el.dataset.id,max=PKMAX[P.target],ix=P.sel.indexOf(id);
  if(max===1)P.sel=ix>=0?[]:[id];else if(ix>=0)P.sel.splice(ix,1);else if(P.sel.length<max)P.sel.push(id);else{toast('最多选 '+max+' 个');return;}keepFocus(layer);},
 pkClear:()=>{S.pk.sel=[];keepFocus(layer);},
 pkOk:()=>{const P=S.pk,sel=P.sel.slice();
  if(P.target==='pool')S.pool=sel;else if(P.target==='shot')S.shots[S.cur].items=sel;else if(P.target==='broll')S.oral.broll=sel;else if(P.target==='host')S.oral.host=sel[0]||null;else S.cover=sel;
  const back=P.back;S.pk=null;dirty();renderCol('A');renderCol('B');refresh();
  if(back){S.ov={type:'gen'};layer();}else closeOv();toast('已选择 '+sel.length+' 个素材');},
 rmPool:(el,v,i)=>{const a=A(S.pool[i]);withUndo('已移除「'+a.name+'」',()=>S.pool.splice(i,1));},
 rmBroll:(el,v,i)=>{S.oral.broll.splice(i,1);dirty();renderCol('A');refresh();},
 rmShotItem:(el,v,i)=>{S.shots[S.cur].items.splice(i,1);dirty();renderCol('A');renderCol('B');refresh();},
 seekAsset:el=>{const id=+el.dataset.id,L=segs(),ix=L.findIndex(s=>s.id===id);if(ix<0){toast('这个素材不在当前示例里，可以点镜头轨上的「换一组」');return;}seekTo(segStart(ix)+.01);},
 who:(el,v)=>{if(S.ov)closeOv();S.oral.who=v;dirty();renderCol('A');refresh();},
 focusText:()=>{if(S.ov)closeOv();if(narrow())setPane('a');const t=$('#oralText');t&&t.focus();},
 /* 镜头 */
 selShot:(el,v,i)=>{S.cur=i;S.open.rule=true;renderCol('A');renderCol('B');seekTo(segStart(i)+.01);if(narrow())setPane('b');const n=$('[data-drag="shot"][data-i="'+i+'"]');n&&!narrow()&&n.focus({preventScroll:true});},
 gotoShot:(el,v)=>{closeOv();ACT.selShot(null,null,+v);},
 addShot:()=>{if(S.ov)closeOv();if(S.shots.length>=MAXN.shots){toast('最多 30 个镜头');return;}S.shots.push({name:'镜头'+(S.shots.length+1),dur:5,items:[],cap:''});S.cur=S.shots.length-1;S.open.rule=true;dirty();renderCol('A');renderCol('B');refresh();},
 shotOp:(el,v)=>{const i=S.cur,s=S.shots[i];if(!s)return;
  if(v==='dup'){if(S.shots.length>=MAXN.shots){toast('最多 30 个镜头');return;}S.shots.splice(i+1,0,JSON.parse(JSON.stringify(s)));S.shots[i+1].name=s.name+' 副本';S.cur=i+1;dirty();renderCol('A');renderCol('B');refresh();}
  else if(v==='up'||v==='down')reorder('shot',i,i+(v==='up'?-1:1));
  else withUndo('已删除「'+s.name+'」',()=>{S.shots.splice(i,1);S.cur=clamp(i,0,Math.max(0,S.shots.length-1));});},
 script:el=>{S.scriptStep=2;openOv({type:'script'},el);},
 scStep:(el,v)=>{S.scriptStep=+v;layer();},
 scApply:()=>{const P=paras(S.scriptDraft.text);closeOv();withUndo('已按文案生成 '+P.length+' 个镜头',()=>{const old=S.shots;S.shots=P.map((p,i)=>({name:'镜头'+(i+1),dur:estDur(p),items:old[i]?old[i].items.slice():[],cap:p}));S.cur=0;S.subMode.script='shot';});},
 aiTopic:()=>{S.scriptDraft.topic='春季新品精华液：到店扫码领新人礼';layer();toast('已生成选题（示意）');},
 aiScript:()=>{S.scriptDraft.text=SCRIPT_TEXT;layer();toast('已生成口播文案（示意）');},
 aiText:()=>{S.oral.text=ORAL_TEXT;dirty();renderCol('A');refresh();toast('已生成口播文案（示意）');},
 /* 设置 */
 tog:(el,v)=>{S.open[v]=!S.open[v];const s=$('#sec-'+v);s.classList.toggle('open',S.open[v]);s.querySelector('header').setAttribute('aria-expanded',String(S.open[v]));const b=$('[data-act=togAll]');if(b)b.textContent=Object.values(S.open).every(Boolean)?'全部收起':'全部展开';},
 togAll:()=>{const all=Object.values(S.open).every(Boolean);for(const k in S.open)S.open[k]=!all;keepFocus(()=>renderCol('B'));},
 openSec:(el,v)=>openSec(v),
 set:el=>{const k=el.dataset.k;setPath(k,el.dataset.t==='n'?+el.dataset.v:el.dataset.v);if(!k.startsWith('scriptDraft'))dirty();
  if(k.startsWith('sty.')||k==='ratio')frameSig='';
  if(el.closest('#layer'))keepFocus(layer);else{const c=el.closest('.col');if(c)keepFocus(()=>renderCol(c.id.slice(3)));}
  refresh();},
 addLine:()=>{if(S.lines.length>=MAXN.lines)return toast('最多 100 条');S.lines.push('');dirty();renderCol('B');const n=$('[data-k="lines.'+(S.lines.length-1)+'"]');n&&n.focus();refresh();},
 rmLine:(el,v,i)=>{S.lines.splice(i,1);dirty();keepFocus(()=>renderCol('B'));refresh();},
 addSent:()=>{const l=S.sent[S.sent.length-1],s=l?l.e:0;S.sent.push({s,e:s+3,t:''});dirty();renderCol('B');const n=$('[data-k="sent.'+(S.sent.length-1)+'.t"]');n&&n.focus();refresh();},
 rmSent:(el,v,i)=>{S.sent.splice(i,1);dirty();renderCol('B');refresh();},
 addTitle:()=>{if(S.titles.length>=MAXN.titles)return toast('最多 20 条');S.titles.push('');dirty();renderCol('B');const n=$('[data-k="titles.'+(S.titles.length-1)+'"]');n&&n.focus();refresh();},
 rmTitle:(el,v,i)=>{S.titles.splice(i,1);dirty();renderCol('B');refresh();},
 addBgm:()=>{const b=BGMS.find(x=>!S.bgm.some(y=>y.name===x.name));if(!b)return toast('示例音乐已全部添加');S.bgm.push(Object.assign({},b));dirty();renderCol('B');refresh();toast('已添加「'+b.name+'」');},
 rmBgm:(el,v,i)=>{S.bgm.splice(i,1);dirty();renderCol('B');refresh();},
 addStk:()=>{if(S.stickers.length>=MAXN.stickers)return toast('最多 50 个');S.stickers.push({name:STKS[S.stickers.length%STKS.length],shot:0});dirty();renderCol('B');refresh();},
 rmStk:(el,v,i)=>{S.stickers.splice(i,1);dirty();renderCol('B');refresh();},
 flt:(el,v)=>{const f=S.filters,ix=f.indexOf(v);if(ix>=0){if(f.length===1)return toast('至少保留一种滤镜');f.splice(ix,1);}else f.push(v);frameSig='';dirty();keepFocus(()=>renderCol('B'));refresh();},
 adj:()=>{S.adjOpen=!S.adjOpen;keepFocus(()=>renderCol('B'));},
 listen:()=>toast('试听「'+VN[S.voice]+'」 · 原型里不播放声音'),
 myVoice:()=>toast('打开「我的音色」 · 原型里未展开'),
 asr:()=>toast('已从素材语音识别出 3 句字幕（示意）'),
 pack:()=>toast('已提交打包，完成后可下载 ZIP（示意）'),
 style:(el,v)=>{S.styTab=v||'sub';openOv({type:'style'},el);},
 styTab:(el,v)=>{S.styTab=v;keepFocus(layer);},
 styReset:()=>{S.sty[S.styTab]=JSON.parse(JSON.stringify(DEF_STY[S.styTab]));frameSig='';dirty();layer();refresh();},
 /* 预览与镜头轨 */
 play:()=>play(),
 seekBar:(el,v,i,e)=>seekFrom(el,e),
 seekRuler:(el,v,i,e)=>seekFrom(el,e),
 seg:(el,v,i)=>{if(S.mode==='script'){ACT.selShot(null,null,i);return;}seekTo(segStart(i)+.01);},
 trackMin:()=>{S.trackMin=!S.trackMin;renderT();paint();},
 mixEx:(el,v)=>{const n=Math.max(1,S.gen.mix);S.mix.ex=(S.mix.ex+(+v)+n)%n;S.t=0;refresh();},
 mixShuffle:()=>{S.mix.seed++;S.t=0;refresh();toast('已换一组随机组合');}};
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-act]'),act=el&&el.dataset.act;
 if(S.pop&&!e.target.closest('#popL')&&act!=='more'&&act!=='jobs'){S.pop=null;pop();}
 if($('#app').classList.contains('nav-open')&&!e.target.closest('.sb')&&act!=='navOpen')$('#app').classList.remove('nav-open');
 if(!el){if(e.target.classList&&e.target.classList.contains('ov'))closeOv();return;}
 if(el.disabled||el.getAttribute('aria-disabled')==='true')return;
 if(el.dataset.cap&&!okCap(el.dataset.cap)){openOv({type:'notice',cap:el.dataset.cap},el);return;}
 if(el.closest('#popL')&&act!=='clearDone'){S.pop=null;pop();}
 const h=ACT[act];if(!h)return;
 try{h(el,el.dataset.v,+el.dataset.i,e);}catch(err){console.error(err);toast('原型出错：'+err.message);}});
document.addEventListener('keydown',e=>{
 const t=e.target,typing=t.matches&&t.matches('input,textarea,select');
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save(false);return;}
 if(e.key==='Escape'){if(S.pop){S.pop=null;pop();$('#moreBtn')&&$('#moreBtn').focus();return;}if(S.ov){closeOv();return;}$('#app').classList.remove('nav-open');return;}
 if(e.key==='Tab'&&S.ov){const box=$('#layer .drw, #layer .dlg');if(box){const f=$$('button:not([disabled]),input,select,textarea,[tabindex="0"]',box).filter(x=>x.offsetParent);if(f.length){const a=f[0],z=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}}}return;}
 if(e.altKey&&t.dataset&&t.dataset.drag&&/^Arrow/.test(e.key)){e.preventDefault();reorder(t.dataset.drag,+t.dataset.i,+t.dataset.i+(/Left|Up/.test(e.key)?-1:1),true);return;}
 if(t.id==='bar'&&/^Arrow(Left|Right)$/.test(e.key)){e.preventDefault();seekTo(S.t+(e.key==='ArrowLeft'?-1:1));return;}
 if(!typing&&t.tagName!=='BUTTON'&&t.id!=='bar'&&(e.key==='Enter'||e.key===' ')&&t.dataset&&t.dataset.act){e.preventDefault();t.click();return;}
 if(e.key===' '&&!typing&&!S.ov&&t.tagName!=='BUTTON'){e.preventDefault();play();}});
addEventListener('resize',()=>{if(S.pop){S.pop=null;pop();}});

/* ---------- 初始化 ---------- */
S.trackMin=innerHeight<820;
if(innerWidth<1100)S.pane='c';
renderAll();
