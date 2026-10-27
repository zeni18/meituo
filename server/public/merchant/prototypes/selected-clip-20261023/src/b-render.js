/* b-render：外壳（侧栏、页头）、工程条、三栏 */
const NAVS=[['',[['workbench','工作台']]],['创作',[['tools','AI 工具'],['image','图像创作'],['video','视频创作'],['avatar','数字人'],['clip','视频剪辑',1]]],['内容',[['materials','素材库'],['works','作品库']]],['营销',[['geo','GEO 营销',0,1],['store','门店营销',0,1],['automation','自动化计划']]],['品牌',[['brand','品牌与门店']]],['常用',[['pin','AI短视频']]]];
function shell(){
 $('#sb').innerHTML='<div class="brand"><b>美拓AI营销中台</b><button class="ibtn" data-act="rail" aria-label="收起侧栏" title="收起侧栏">'+ic('sidebar')+'</button></div>'+
  NAVS.map(([g,its])=>'<nav class="ngrp" aria-label="'+(g||'工作台')+'">'+(g?'<i>'+g+'</i>':'')+its.map(([k,l,on,sub])=>'<button class="nl'+(on?' on':'')+'"'+(on?' aria-current="page"':'')+' data-act="nav" data-v="'+l+'" title="'+l+'">'+nv(k)+'<span>'+l+'</span>'+(sub?'<svg class="chev" viewBox="0 0 24 24" aria-hidden="true">'+NAV.chevron+'</svg>':'')+'</button>').join('')+'</nav>').join('');}
function header(){
 $('#hd').innerHTML='<button class="ibtn menu-btn" data-act="navOpen" aria-label="打开菜单">'+ic('menu','l')+'</button><h1>视频剪辑</h1>'+
  '<div class="seg" role="tablist" aria-label="剪辑方式">'+MODES.map(([k,l])=>'<button role="tab" aria-selected="'+(S.mode===k)+'" data-act="mode" data-v="'+k+'">'+l+'</button>').join('')+'</div><span class="sp"></span>'+
  '<button class="search" data-act="stub" data-v="全局搜索">'+ic('search')+'<span>搜索</span></button><button class="ibtn" data-act="stub" data-v="通知" aria-label="通知" style="width:40px;height:40px">'+ic('bell','l')+'</button>'+
  '<button class="acct" data-act="stub" data-v="账户菜单" aria-label="账户"><img src="'+IMG.user+'" alt=""><span><strong>本地体验商家</strong><small>免费会员<span aria-hidden="true">|</span>'+TP(0)+'</small></span></button>';}
const genLabel=()=>'立即剪辑<span class="dotsep">·</span><span class="num">'+S.gen[S.mode]+'</span> 条<span class="dotsep">·</span>'+TP(cost());
const ring=p=>'<svg class="ring" viewBox="0 0 20 20" aria-hidden="true"><circle class="bgc" cx="10" cy="10" r="7.5"/><circle class="fg" cx="10" cy="10" r="7.5" stroke-dasharray="47.12" stroke-dashoffset="'+(47.12*(1-p/100)).toFixed(2)+'" transform="rotate(-90 10 10)"/></svg>';
function jobChip(){
 if(!S.jobs.length)return'';const run=S.jobs.filter(j=>j.st!=='done'),p=Math.round(S.jobs.reduce((a,j)=>a+j.p,0)/S.jobs.length);
 return '<button class="chip'+(run.length?'':' done')+'" id="jobChip" data-act="jobs" aria-haspopup="dialog">'+ring(run.length?p:100)+(run.length?'<span class="num">'+run.length+' 条剪辑中 · '+p+'%</span>':'<span class="num">'+S.jobs.length+' 条已完成</span>')+'</button>';}
const paneLabel=()=>({quick:'素材',mix:'素材',script:'镜头',oral:'文案'}[S.mode]);
function pagebar(){
 $('#pb').innerHTML='<input class="pname" data-k="name" value="'+esc(S.name)+'" aria-label="工程名称" maxlength="40" placeholder="未命名工程">'+
  '<span class="save" id="saveSt" role="status"></span><button class="btn sm" id="saveBtn" data-act="save" hidden>'+ic('save','s')+'保存</button><span class="sp"></span>'+
  '<div class="seg pane-seg" role="tablist" aria-label="编辑区">'+[['a',paneLabel()],['b','设置'],['c','预览']].map(([k,l])=>'<button role="tab" aria-selected="'+(S.pane===k)+'" data-act="pane" data-v="'+k+'">'+l+'</button>').join('')+'</div>'+
  jobChip()+'<button class="btn ghost" id="moreBtn" data-act="more" aria-label="更多操作" aria-haspopup="menu" style="width:36px;padding:0">'+ic('more-horizontal')+'</button><button class="btn pri gen" id="gen" data-act="gen">'+genLabel()+'</button>';
 updSave();}
/* 草稿自动保存（停止编辑 2.5 秒后）；点「保存」或提交剪辑才生成新版本 */
function updSave(){const s=$('#saveSt'),b=$('#saveBtn');if(!s)return;s.className='save'+(S.dirty?' dirty':'');s.textContent=S.dirty?'编辑中…':(S.auto?'已自动保存 · ':'已保存 · 第 '+S.rev+' 版 · ')+S.savedAt;b.hidden=!S.auto&&!S.dirty;b.innerHTML=ic('save','s')+'保存版本';}

/* ---------- 左栏 ---------- */
function tile(id,i,showIx){const a=A(id);return '<div class="mt" tabindex="0" draggable="true" data-drag="pool" data-i="'+i+'" data-id="'+id+'" data-act="seekAsset" aria-label="'+esc(a.name)+'，第 '+(i+1)+' 个。Alt 加方向键调整顺序"><img src="'+IMG[a.img]+'" alt="">'+(showIx?'<span class="ix num">'+(i+1)+'</span>':'')+(a.kind==='video'?'<span class="du num">'+ic('video','s')+fmt(a.d)+'</span>':'<span class="du img">图片</span>')+'<span class="ops"><button data-act="rmPool" data-i="'+i+'" aria-label="移除 '+esc(a.name)+'">'+ic('x','s')+'</button></span></div>';}
function colA(){
 const m=S.mode;if(m==='script')return colAScript();if(m==='oral')return colAOral();
 const n=S.pool.length,head='<div class="ch"><h2>'+ic('film')+'镜头素材 <span class="cnt num">'+n+'</span></h2><span class="sp"></span>'+(n?'<button class="btn sm" data-act="pick" data-v="pool">'+ic('plus','s')+'添加素材</button>':'')+'</div>';
 if(!n)return head+'<div class="cb"><div class="empty"><img src="'+IMG.empty+'" alt=""><b>添加镜头素材，开始'+ML[m]+'</b><p>选择视频或图片。弹窗里可以直接上传，也可以从素材库挑选。</p><button class="btn pri" data-act="pick" data-v="pool">'+ic('plus','s')+'添加素材</button></div></div>';
 return head+'<div class="cb"><p class="hint">'+(m==='quick'?'按顺序取用，拖动调整先后':'随机抽取组合，每条都不一样')+'</p><div class="mg" id="pool">'+S.pool.map((id,i)=>tile(id,i,m==='quick')).join('')+'<button class="mt add" data-act="pick" data-v="pool">'+ic('upload','l')+'上传或添加</button></div></div>';}
function shotRow(s,i){const a=s.items[0]?A(s.items[0]):null;return '<div class="sh'+(i===S.cur?' on':'')+'" tabindex="0" draggable="true" data-drag="shot" data-i="'+i+'" data-act="selShot" aria-label="镜头 '+(i+1)+' '+esc(s.name)+'。Alt 加方向键调整顺序"><span class="gr">'+ic('grip-vertical','s')+'</span><span class="th'+(a?'':' none')+'">'+(a?'<img src="'+IMG[a.img]+'" alt="">':ic('image','s'))+'<em class="num">'+(i+1)+'</em></span><span class="tx"><b>'+esc(s.name||'镜头 '+(i+1))+'</b><small class="num">'+sec(s.dur)+' 秒 · '+(s.items.length?s.items.length+' 个素材':'<span class="warn">还没有素材</span>')+'</small><p>'+esc(s.cap||'')+'</p></span></div>';}
function colAScript(){
 return '<div class="ch"><h2>'+ic('film')+'镜头 <span class="cnt num">'+S.shots.length+'</span></h2><span class="sp"></span><button class="btn sm" data-act="addShot">'+ic('plus','s')+'镜头组</button></div><div class="cb">'+
  '<button class="cover-row" data-act="pick" data-v="cover"><span class="cv">'+(S.cover.length?'<img src="'+IMG[A(S.cover[0]).img]+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px">':ic('image','s'))+'</span><span style="flex:1;text-align:left">视频封面 <span class="num">'+S.cover.length+'/20</span><br><small style="color:var(--text3)">不设置则截取首帧</small></span>'+ic('chevron-right','s')+'</button>'+
  '<div class="sl" id="shots">'+S.shots.map(shotRow).join('')+'</div>'+
  '<button class="btn ghost" style="width:100%;margin-top:10px" data-act="script">'+ic('file-text','s')+'从口播文案拆分镜</button></div>';}
function colAOral(){
 const o=S.oral,h=o.host?A(o.host):null;
 let who;
 if(o.who==='video')who=h?'<div class="host"><span class="th"><img src="'+IMG[h.img]+'" alt=""></span><span><b>'+esc(h.name)+'</b><small class="num">视频 · '+fmt(h.d)+'</small><button class="btn xs" data-act="pick" data-v="host">更换</button></span></div>':'<button class="mt add" style="width:100%;aspect-ratio:auto;height:84px" data-act="pick" data-v="host">'+ic('plus')+'选择口播视频</button>';
 else who='<div class="empty" style="padding:16px"><b style="font-size:13px">数字人口播'+(okCap('avatar')?'':' · 即将上线')+'</b><p>'+(okCap('avatar')?'从数字人形象库选择出镜形象，配音读文案。':'上线后可以直接选数字人形象出镜。现在可以先用口播视频，或到「数字人」生成视频后当口播视频用。')+'</p>'+(okCap('avatar')?'<button class="btn sm" data-act="stub" data-v="选择数字人形象">选择形象</button>':'<button class="btn sm" data-act="who" data-v="video">改用口播视频</button>')+'</div>';
 return '<div class="ch"><h2>'+ic('mic')+'口播文案</h2><span class="sp"></span><button class="btn sm'+gated('llm')+'" data-act="aiText" data-cap="llm">'+ic('sparkles','s')+'AI 写文案'+badge('llm')+'</button></div><div class="cb">'+
  '<textarea class="ta" id="oralText" data-k="oral.text" maxlength="10000" placeholder="写下要口播的内容，按句号自动断句生成字幕">'+esc(o.text)+'</textarea>'+
  '<div class="ta-meta"><span class="num" data-sum="oralMeta"></span><span class="sp"></span><button class="btn xs" data-act="stub" data-v="导入 TXT">导入 TXT</button></div>'+
  '<div class="sub-h">出镜画面</div><div class="seg" role="tablist" aria-label="出镜画面" style="margin-bottom:8px">'+[['video','口播视频'],['avatar','数字人']].map(([k,l])=>'<button role="tab" aria-selected="'+(o.who===k)+'" data-act="who" data-v="'+k+'">'+l+(k==='avatar'?badge('avatar'):'')+'</button>').join('')+'</div>'+who+
  '<div class="sub-h">穿插画面 <span class="num" style="font-weight:400;color:var(--text3)">'+o.broll.length+'</span><span class="sp"></span><button class="btn xs" data-act="pick" data-v="broll">'+ic('plus','s')+'添加</button></div><p class="hint">口播时按节奏插入这些画面；不添加则全程是口播视频。</p>'+
  '<div class="mg">'+o.broll.map((id,i)=>{const a=A(id);return '<div class="mt" style="cursor:default"><img src="'+IMG[a.img]+'" alt="'+esc(a.name)+'"><span class="ops" style="opacity:1"><button data-act="rmBroll" data-i="'+i+'" aria-label="移除 '+esc(a.name)+'">'+ic('x','s')+'</button></span></div>';}).join('')+'</div></div>';}

/* ---------- 中栏：剪辑设置 ---------- */
const chips=(k,opts,cur,t='',cap='')=>opts.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return '<button class="ch-btn" aria-pressed="'+(String(cur)===String(v))+'" data-act="set" data-k="'+k+'" data-v="'+esc(v)+'"'+(t?' data-t="'+t+'"':'')+'>'+esc(l)+'</button>';}).join('');
const num=(k,v,min,max,step=1,w='')=>'<input class="inp n num" type="number" inputmode="decimal" data-k="'+k+'" data-t="n" min="'+min+'" max="'+max+'" step="'+step+'" value="'+v+'" aria-label="'+(w||k)+'">';
const rngRaw=(k,v,min,max,step,u,lab)=>'<span class="rng"><input type="range" data-k="'+k+'" data-t="n" min="'+min+'" max="'+max+'" step="'+step+'" value="'+v+'" aria-label="'+(lab||k)+'"><output class="num" data-u="'+u+'">'+(u==='x'?Number(v).toFixed(2).replace(/0$/,'')+'x':v+u)+'</output></span>';
const rng=(lab,k,v,min,max,step,u)=>'<div class="rng" style="width:100%"><span style="width:56px;font-size:12px;color:var(--text2);flex:none">'+lab+'</span>'+rngRaw(k,v,min,max,step,u,lab)+'</div>';
const row=(lab,ctl,isLabel)=>'<div class="row">'+(isLabel?'<label>'+lab+'</label>':'<div class="lb">'+lab+'</div>')+'<div class="ctl">'+ctl+'</div></div>';
const get=k=>k.split('.').reduce((o,p)=>o==null?o:o[p],S);
function sec_(k,title,body){const open=S.open[k];return '<section class="sec'+(open?' open':'')+'" id="sec-'+k+'"><header role="button" tabindex="0" data-act="tog" data-v="'+k+'" aria-expanded="'+open+'" aria-controls="bd-'+k+'"><h3>'+title+'</h3><span class="sum" data-sum="'+k+'">'+esc(SUM[k]())+'</span>'+ic('chevron-down','s chev')+'</header><div class="bd" id="bd-'+k+'">'+body+'</div></section>';}
function colB(){
 const all=Object.values(S.open).every(Boolean);
 return '<div class="ch"><h2>'+ic('sliders')+'剪辑设置</h2><span class="sp"></span><button class="btn link" style="font-size:12px" data-act="togAll">'+(all?'全部收起':'全部展开')+'</button></div><div class="cb" id="cbB">'+
  sec_('rule',RT[S.mode],ruleBody())+sec_('text','字幕与标题',textBody())+sec_('sound','声音',soundBody())+sec_('fx','画面效果',fxBody())+'</div>';}
function ruleBody(){
 const m=S.mode;
 if(m==='quick')return row('成片时长',num('quick.min',S.quick.min,1,40,1,'最短时长')+'<span>～</span>'+num('quick.max',S.quick.max,1,40,1,'最长时长')+'<span>秒/条</span><span class="note">素材按顺序取用，超出部分自动截短</span>',1);
 if(m==='mix')return row('抽取镜头',num('mix.kMin',S.mix.kMin,1,30,1,'最少镜头数')+'<span>～</span>'+num('mix.kMax',S.mix.kMax,1,30,1,'最多镜头数')+'<span>个/条</span>',1)+
  row('每个镜头',num('mix.dMin',S.mix.dMin,.1,300,.5,'最短秒数')+'<span>～</span>'+num('mix.dMax',S.mix.dMax,.1,300,.5,'最长秒数')+'<span>秒</span><span class="note" data-sum="mixNote">'+mixNote()+'</span>',1)+
  row('画面速度',chips('speed',[[.75,'0.75x'],[1,'1x'],[1.25,'1.25x'],[1.5,'1.5x'],[2,'2x']],S.speed,'n'));
 if(m==='script'){const s=S.shots[S.cur];if(!s)return '<p class="hint">还没有镜头。<button class="btn link" data-act="addShot">添加镜头组</button></p>';const k='shots.'+S.cur;
  return row('镜头名称','<input class="inp w" data-k="'+k+'.name" value="'+esc(s.name)+'" maxlength="40" aria-label="镜头名称">',1)+row('镜头时长',num(k+'.dur',s.dur,.1,300,.5,'镜头时长')+'<span>秒</span>',1)+
   row('镜头素材','<div class="shot-items">'+s.items.map((id,i)=>{const a=A(id);return '<div class="mt"><img src="'+IMG[a.img]+'" alt="'+esc(a.name)+'"><span class="ops" style="opacity:1"><button data-act="rmShotItem" data-i="'+i+'" aria-label="移除">'+ic('x','s')+'</button></span></div>';}).join('')+'<button class="mt add" data-act="pick" data-v="shot" aria-label="添加镜头素材">'+ic('plus')+'</button></div><span class="note">放多个素材时，每条成片随机取一个</span>')+
   row('字幕/口播','<textarea class="ta" style="min-height:64px" data-k="'+k+'.cap" maxlength="800" aria-label="镜头字幕或口播">'+esc(s.cap)+'</textarea>',1)+
   row('','<span class="ops-row" style="margin:0"><button class="btn xs" data-act="shotOp" data-v="dup">'+ic('copy','s')+'复制</button><button class="btn xs" data-act="shotOp" data-v="up"'+(S.cur?'':' disabled')+'>'+ic('arrow-up','s')+'上移</button><button class="btn xs" data-act="shotOp" data-v="down"'+(S.cur<S.shots.length-1?'':' disabled')+'>'+ic('arrow-down','s')+'下移</button><button class="btn xs danger" data-act="shotOp" data-v="del">'+ic('trash-2','s')+'删除</button></span>')+
   row('时长依据',chips('durBy',[['video','按视频时长'],['voice','按配音时长']],S.durBy)+'<span class="note">按配音时长时，镜头会跟着这一段配音的长短自动伸缩</span>');}
 return row('口播声音','<span style="font-size:13px" data-sum="oralVoice">'+(S.voice?'AI 配音 · '+esc(VN[S.voice]):'口播视频原声')+'</span><button class="btn link" style="font-size:12px" data-act="openSec" data-v="sound">更换</button>')+
  row('语速',rngRaw('rate',S.rate,.8,1.5,.05,'x','语速'))+
  row('穿插节奏','<span>每</span>'+num('oral.every',S.oral.every,2,30,1,'穿插间隔')+'<span>秒插入</span>'+num('oral.len',S.oral.len,1,10,.5,'穿插时长')+'<span>秒画面</span>',1)+
  row('成片时长','<span class="num" data-sum="oralDur">约 '+oralDur()+' 秒</span><span class="note">按文案字数和语速估算，选了配音则以配音实际时长为准</span>');}
const mixNote=()=>{const lo=Math.round(S.mix.kMin*S.mix.dMin),hi=Math.round(S.mix.kMax*S.mix.dMax),c=combos();return '每条约 '+lo+'～'+hi+' 秒，当前素材可组合 '+(c>999?'999+':c)+' 种';};
function textBody(){
 const m=S.mode,md=S.subMode[m];let ed='';
 if(md==='global')ed=row('字幕文案','<div class="lines">'+S.lines.map((l,i)=>'<div class="ln"><em class="num">'+(i+1)+'</em><input class="inp" data-k="lines.'+i+'" value="'+esc(l)+'" maxlength="800" aria-label="第 '+(i+1)+' 条字幕"><button class="x" data-act="rmLine" data-i="'+i+'" aria-label="删除这条">'+ic('x','s')+'</button></div>').join('')+
  '<div class="ops-row"><button class="btn xs" data-act="addLine">'+ic('plus','s')+'添加一条</button><button class="btn xs" data-act="stub" data-v="导入 TXT">导入 TXT</button><button class="btn xs'+gated('asr')+'" data-act="asr" data-cap="asr">识别素材语音'+badge('asr')+'</button></div></div><span class="note">按镜头顺序轮流显示，共 '+S.lines.length+'/100 条</span>');
 else if(md==='sentence')ed=row('逐句字幕','<div class="lines">'+S.sent.map((x,i)=>'<div class="sent">'+num('sent.'+i+'.s',x.s,0,600,.5,'开始秒')+num('sent.'+i+'.e',x.e,0,600,.5,'结束秒')+'<input class="inp" data-k="sent.'+i+'.t" value="'+esc(x.t)+'" maxlength="200" aria-label="字幕内容"><button class="x" data-act="rmSent" data-i="'+i+'" aria-label="删除这句">'+ic('x','s')+'</button></div>').join('')+
  '<div class="ops-row"><button class="btn xs" data-act="addSent">'+ic('plus','s')+'添加一句</button><button class="btn xs'+gated('asr')+'" data-act="asr" data-cap="asr">识别素材语音'+badge('asr')+'</button></div></div><span class="note">开始、结束都按秒填写</span>');
 else if(md==='shot')ed=row('','<span class="note" style="margin:0">每个镜头的字幕在上面「当前镜头」里填写，左侧切换镜头。</span>');
 else if(md==='script')ed=row('','<span class="note" style="margin:0" data-sum="scriptSubs">按口播文案自动断句，共 '+sentences(S.oral.text).length+' 句，时间跟着语速走。</span><button class="btn xs'+gated('asr')+'" data-act="asr" data-cap="asr">改用视频语音识别'+badge('asr')+'</button>');
 return row('字幕',chips('subMode.'+m,SUBMODES[m],md))+ed+
  row('标题','<div class="lines">'+S.titles.map((l,i)=>'<div class="ln"><input class="inp" data-k="titles.'+i+'" value="'+esc(l)+'" maxlength="50" aria-label="标题文案"><button class="x" data-act="rmTitle" data-i="'+i+'" aria-label="删除标题">'+ic('x','s')+'</button></div>').join('')+
  '<div class="ops-row"><button class="btn xs" data-act="addTitle">'+ic('plus','s')+'添加标题</button></div></div><span class="note">显示在第 '+sec(S.sty.ttl.start)+'～'+sec(S.sty.ttl.end)+' 秒，最多 50 字；多条时每条成片随机取一条</span>')+
  row('样式','<button class="btn sm" data-act="style" data-v="sub">'+ic('type','s')+'文字样式</button><span class="note">字体、花字、颜色、位置在这里调，右侧预览跟着变</span>');}
function soundBody(){
 const m=S.mode,tts=okCap('tts');
 const voice='<select class="inp w'+(tts?'':' gated')+'" data-k="voice" data-cap="tts" aria-label="配音音色">'+VOICES.map(([v,l])=>'<option value="'+v+'"'+(S.voice===v?' selected':'')+'>'+l+'</option>').join('')+'</select><button class="btn sm" data-act="listen"'+(S.voice?'':' disabled')+'>'+ic('headphones','s')+'试听</button>'+badge('tts')+
  '<span class="note">'+(m==='oral'?'不选则用口播视频原声；选了音色就由 AI 读口播文案':m==='script'?'配音读每个镜头的「字幕/口播」':'配音读字幕文案')+'</span><button class="btn link" style="font-size:12px" data-act="myVoice" data-cap="icl">管理我的音色'+badge('icl')+'</button>';
 return (m==='oral'?'':row('素材原声','<label class="sw"><input type="checkbox" data-k="keep" data-t="b" data-rr="b"'+(S.keep?' checked':'')+'><i></i><span>'+(S.keep?'保留':'已消除')+'</span></label>'))+
  row('配音',voice)+
  row('背景音乐','<div class="lines">'+S.bgm.map((b,i)=>'<div class="ln"><span class="bgm">'+ic('music')+'<b>'+esc(b.name)+'</b><small class="num">'+fmt(b.d)+'</small></span><button class="x" data-act="rmBgm" data-i="'+i+'" aria-label="移除音乐">'+ic('x','s')+'</button></div>').join('')+
   '<div class="ops-row"><button class="btn xs" data-act="addBgm">'+ic('plus','s')+'从素材库添加</button><button class="btn xs" data-act="stub" data-v="版权音乐库">版权音乐库</button></div></div>')+
  row('音量','<div style="display:flex;flex-direction:column;gap:2px;width:100%">'+rng('配音','vVol',S.vVol,0,300,10,'%')+rng('背景音乐','bVol',S.bVol,0,100,5,'%')+(S.keep||m==='oral'?rng('原声','oVol',S.oVol,0,200,10,'%'):'')+'</div>')+
  (m==='oral'?'':row('配音语速',rngRaw('rate',S.rate,.5,2,.05,'x','配音语速')))+
  row('淡入淡出','<span>淡入</span>'+num('fadeIn',S.fadeIn,0,5,.5,'淡入秒数')+'<span>淡出</span>'+num('fadeOut',S.fadeOut,0,5,.5,'淡出秒数')+'<span>秒</span><button class="btn xs" data-act="stub" data-v="人声降噪">人声降噪</button>',1);}
function fxBody(){
 const L=segs();
 return row('转场',chips('tr',TRS,S.tr))+(S.tr!=='无转场'?row('转场时长',rngRaw('trD',S.trD,.1,2,.1,'s','转场时长')):'')+
  row('滤镜',Object.keys(FILTERS).map(f=>'<button class="ch-btn" aria-pressed="'+S.filters.includes(f)+'" data-act="flt" data-v="'+f+'">'+f+'</button>').join('')+'<span class="note">'+(S.filters.length>1?'选了多种：每个镜头随机用一种':'只选一种：全片统一')+'</span>')+
  (S.mode==='script'?row('画面速度',chips('speed',[[.75,'0.75x'],[1,'1x'],[1.25,'1.25x'],[1.5,'1.5x'],[2,'2x']],S.speed,'n')):'')+
  row('贴纸','<div class="lines">'+S.stickers.map((s,i)=>'<div class="ln"><span class="stk"><span>'+esc(s.name)+'</span><select class="inp" data-k="stickers.'+i+'.shot" data-t="n" aria-label="显示在哪个镜头">'+['全部镜头'].concat(L.map((x,j)=>'镜头 '+(j+1))).map((o,j)=>'<option value="'+j+'"'+(s.shot===j?' selected':'')+'>'+o+'</option>').join('')+'</select></span><button class="x" data-act="rmStk" data-i="'+i+'" aria-label="删除贴纸">'+ic('x','s')+'</button></div>').join('')+
   '<div class="ops-row"><button class="btn xs" data-act="addStk">'+ic('plus','s')+'添加贴纸</button></div></div>')+
  row('调色','<button class="disc" data-act="adj" aria-expanded="'+S.adjOpen+'">'+(S.adjOpen?'收起':'对比度、饱和度、亮度、色相')+ic('chevron-down','s')+'</button>'+(S.adjOpen?'<div style="flex-basis:100%">'+rng('对比度','adj.c',S.adj.c,-100,100,1,'')+rng('饱和度','adj.s',S.adj.s,-100,100,1,'')+rng('亮度','adj.b',S.adj.b,-100,100,1,'')+rng('色相','adj.h',S.adj.h,-100,100,1,'')+'</div>':''));}

/* ---------- 右栏：画面预览 + 成片设置 ---------- */
/* 成片设置收成预览上方一行工具条，预览画面按剩余高度自适应，任何屏幕都不用滚动才能看到画面 */
function colC(){
 const sel=(k,opts,cur,t,lab,extra='')=>'<select class="inp sm" data-k="'+k+'"'+(t?' data-t="'+t+'"':'')+' aria-label="'+lab+'" title="'+lab+'"'+extra+'>'+opts.map(([v,l])=>'<option value="'+v+'"'+(String(cur)===String(v)?' selected':'')+'>'+l+'</option>').join('')+'</select>';
 const pending=Object.keys(CAPS).filter(k=>!okCap(k)).length;
 return '<div class="ch"><h2>'+ic('monitor')+'画面预览</h2><span class="sp"></span><span class="pv-note">排版预览，以云端成片为准</span></div><div class="cb pv">'+
  '<div class="pvbar"><div class="seg sm" role="radiogroup" aria-label="画面比例">'+['9:16','16:9','1:1'].map(r=>'<button role="radio" aria-checked="'+(S.ratio===r)+'" data-act="set" data-k="ratio" data-v="'+r+'">'+r+'</button>').join('')+'</div>'+
  sel('res',[['720P','720P'],['1080P','1080P'],['4K','4K']],S.res,'','清晰度')+sel('fps',[[25,'25FPS'],[30,'30FPS'],[60,'60FPS']],S.fps,'n','帧率')+
  (S.mode==='quick'?'':sel('fill',[['拉伸模糊','背景 拉伸模糊'],['纯色','背景 纯色'],['图片或视频','背景 图片/视频']],S.fill,'','背景填充：素材比例和画面不一致时，用来填空白',' data-rr="c"')+
   (S.fill==='纯色'?'<input type="color" class="clr" data-k="fillColor" value="'+S.fillColor+'" aria-label="填充颜色">':'')+(S.fill==='图片或视频'?'<button class="btn xs" data-act="stub" data-v="选择背景素材">选择素材</button>':''))+'</div>'+
  '<div class="fw"><div class="frame" id="frame"></div></div>'+
  '<div class="ctrl"><button class="play" id="play" data-act="play" aria-label="播放">'+PLAY+'</button><div class="bar" id="bar" data-act="seekBar" role="slider" aria-label="播放进度" tabindex="0"><i id="barI"></i><span id="ticks"></span></div><span class="tm num" id="tm"></span></div></div>'+
  '<div class="svc'+(okCap('ims')?'':' off')+'"><span>'+(okCap('ims')?'云合成已就绪':'云合成待配置')+(pending?' · '+pending+' 项能力接入中':'')+'</span><span class="sp"></span><button class="btn link" style="font-size:12px" data-act="svc">接入状态</button></div>';}
