/* c-view：预览绘制、镜头轨、浮层（确认抽屉 / 选择素材 / 文字样式 / 拆分镜 / 说明 / 接入状态）、菜单、提示 */
const filterCss=i=>{const f=S.filters.length>1?S.filters[i%S.filters.length]:S.filters[0];const a=S.adj;return [FILTERS[f]||'',a.c?'contrast('+(1+a.c/200).toFixed(2)+')':'',a.s?'saturate('+(1+a.s/100).toFixed(2)+')':'',a.b?'brightness('+(1+a.b/255).toFixed(2)+')':'',a.h?'hue-rotate('+Math.round(a.h*1.8)+'deg)':''].filter(Boolean).join(' ')||'none';};
function txtHtml(kind,text){const st=S.sty[kind];return '<div class="'+kind+'" style="top:'+st.pos+'%;transform:translateY(-50%);font-size:'+(st.size/10.8).toFixed(2)+'cqw;color:'+st.color+';--sc:'+st.stroke+';--sw:'+(st.sw/10.8).toFixed(2)+'cqw;text-align:'+st.align+';font-family:'+FONTCSS[st.font]+'"><span style="'+FLW[st.fl]+'">'+esc(text)+'</span></div>';}
let frameSig='';
function paint(){
 const fr=$('#frame');if(!fr)return;
 const L=segs(),T=total(L);if(S.t>T)S.t=0;
 const cur=L.length?at(S.t,L):null,c=cur&&cur.s.id?caps().find(x=>S.t>=x.s&&S.t<x.e):null;
 const ttl=S.titles[0]&&S.t>=S.sty.ttl.start&&S.t<S.sty.ttl.end?S.titles[0]:'';
 const st=cur?S.stickers.find(s=>s.shot===0||s.shot===cur.i+1):null;
 const sig=[S.ratio,S.mode,cur?cur.i+':'+cur.s.id:'',c?c.t:'',ttl,st?st.name:'',JSON.stringify(S.sty),S.filters.join(),JSON.stringify(S.adj),S.fill,S.fillColor,L.length].join('|');
 if(sig!==frameSig){frameSig=sig;
  fr.className='frame '+({'9:16':'r916','16:9':'r169','1:1':'r11'}[S.ratio]);fr.style.background='';
  let h='';
  if(!cur)h='<div class="emp"><i>'+PLAY+'</i>'+(S.mode==='oral'?'写好口播文案、选好口播视频后可以预览':'添加素材后可以预览排版')+'</div>';
  else if(!cur.s.id)h='<div class="emp"><i>'+ic('image')+'</i>镜头 '+(cur.i+1)+(S.mode==='oral'?' 缺少口播画面':' 还没有素材')+'</div>';
  else{const a=A(cur.s.id),src=IMG[a.img],fit=S.mode!=='quick';
   if(fit&&S.fill==='拉伸模糊')h+='<img class="fill-blur" src="'+src+'" alt="">';
   if(fit&&S.fill==='纯色')fr.style.background=S.fillColor;
   h+='<img class="pic'+(fit&&!(cur.s.host)?' fit':'')+'" src="'+src+'" alt="'+esc(a.name)+'" style="filter:'+filterCss(cur.i)+'">';
   if(cur.s.host)h+='<span class="host-tag">口播画面</span>';
   if(ttl)h+=txtHtml('ttl',ttl);if(c)h+=txtHtml('sub',c.t);
   if(st)h+='<span class="stk-o" style="right:7%;top:'+(S.ratio==='16:9'?8:24)+'%">'+esc(st.name)+'</span>';}
  fr.innerHTML=h;}
 const p=T?Math.min(100,S.t/T*100):0;
 $('#barI').style.width=p+'%';$('#tm').textContent=fmt(S.t)+' / '+fmt(T);
 const pl=$('#play');pl.innerHTML=S.playing?PAUSE:PLAY;pl.disabled=!T;pl.setAttribute('aria-label',S.playing?'暂停':'播放');
 const bar=$('#bar');bar.setAttribute('aria-valuenow',Math.round(S.t));bar.setAttribute('aria-valuemax',Math.round(T));
 let a=0;$('#ticks').innerHTML=L.slice(0,-1).map(s=>'<u style="left:'+((a+=s.d)/(T||1)*100)+'%"></u>').join('');
 const hd=$('#head');if(hd)hd.style.left='calc('+p+'% - 1px)';
 $$('#tk .blk.v').forEach((b,i)=>b.classList.toggle('on',!!cur&&cur.i===i));
 $$('#pool .mt[data-id]').forEach(m=>m.classList.toggle('live',!!cur&&String(cur.s.id)===m.dataset.id&&S.mode==='quick'));}

/* ---------- 镜头轨 ---------- */
function renderT(){
 const el=$('#tk');if(!el)return;
 const L=segs(),T=total(L)||1,C=caps(),m=S.mode;
 const mixNav=m==='mix'&&L.length?'<span class="meta">·</span><button class="btn xs" data-act="mixEx" data-v="-1" aria-label="上一个示例">'+ic('chevron-left','s')+'</button><span class="meta num">示例 '+(S.mix.ex+1)+'/'+Math.max(1,S.gen.mix)+'</span><button class="btn xs" data-act="mixEx" data-v="1" aria-label="下一个示例">'+ic('chevron-right','s')+'</button><button class="btn xs" data-act="mixShuffle">'+ic('rotate-cw','s')+'换一组</button>':'';
 const head='<div class="tk-h"><h2>镜头轨</h2><span class="meta num">共 '+fmt(total(L))+' · '+L.length+' 段</span>'+mixNav+'<span class="sp"></span>'+(S.trackMin?'':'<span class="meta">点镜头跳到对应画面</span>')+'<button class="btn xs" data-act="trackMin" aria-expanded="'+!S.trackMin+'">'+(S.trackMin?'展开':'收起')+ic(S.trackMin?'chevron-up':'chevron-down','s')+'</button></div>';
 el.className='tk'+(S.trackMin?' min':'');
 if(S.trackMin){el.innerHTML=head;return;}
 let a=0;
 const vid=L.length?L.map((s,i)=>{const l=a/T*100,w=s.d/T*100;a+=s.d;const as=s.id?A(s.id):null;return '<button class="blk v'+(as?'':' none')+(s.host?' host':'')+'" style="left:calc('+l+'% + 1px);width:calc('+w+'% - 2px)" data-act="seg" data-i="'+i+'" aria-label="第 '+(i+1)+' 段，'+sec(s.d)+' 秒'+(as?'，'+esc(as.name):'，缺素材')+'">'+(as?'<img src="'+IMG[as.img]+'" alt="">':'缺素材')+'<em class="num">'+sec(s.d)+'s</em></button>';}).join(''):'<button class="blk ph" style="left:0;right:0" data-act="'+(m==='oral'?'focusText':'pick')+'" data-v="pool">'+(m==='oral'?'写好口播文案后自动生成画面轨':'还没有画面 · 点击添加素材')+'</button>';
 const sub=C.map(c=>'<span class="blk s" style="left:calc('+(c.s/T*100)+'% + 1px);width:calc('+((c.e-c.s)/T*100)+'% - 2px)" title="'+esc(c.t)+'">'+esc(c.t)+'</span>').join('')||'<button class="blk ph" style="left:0;right:0" data-act="openSec" data-v="text">无字幕 · 点击设置</button>';
 const vn=S.voice?'配音 · '+VN[S.voice]:(m==='oral'&&S.oral.who==='video'&&S.oral.host?'口播视频原声':'');
 const aud=vn?'<span class="blk a" style="left:1px;right:1px">'+ic('mic','s')+'&nbsp;'+esc(vn)+'</span>':'<button class="blk ph" style="left:0;right:0" data-act="openSec" data-v="sound">未添加配音 · 点击设置</button>';
 const mus=S.bgm.length?'<span class="blk m" style="left:1px;right:1px">'+ic('music','s')+'&nbsp;'+esc(S.bgm.map(b=>b.name).join(' / '))+'</span>':'<button class="blk ph" style="left:0;right:0" data-act="openSec" data-v="sound">无背景音乐 · 点击添加</button>';
 const step=T<=20?2:T<=60?5:10;let rl='';for(let s=0;s<T-.3*step;s+=step)rl+='<span style="left:'+(s/T*100)+'%">'+s+'s</span>';
 el.innerHTML=head+'<div class="tk-b"><div class="labs"><div class="r"></div><div class="v">画面</div><div>字幕</div><div>配音</div><div>音乐</div></div><div class="lns" id="lns"><div class="ruler" data-act="seekRuler">'+rl+'</div><div class="lane v">'+vid+'</div><div class="lane">'+sub+'</div><div class="lane">'+aud+'</div><div class="lane">'+mus+'</div><span class="head" id="head"></span></div></div>';}

/* ---------- 浮层 ---------- */
const X='<button class="ibtn" data-act="closeOv" aria-label="关闭">'+ic('x')+'</button>';
function varsHtml(){const n=S.gen[S.mode],k=Math.min(n,4),u=unitDur();let h='';for(let i=0;i<k;i++){const ids=variant(i);h+='<div class="var"><em class="num">第 '+(i+1)+' 条</em><span class="strip">'+(ids.length?ids.slice(0,8).map(id=>id?'<i><img src="'+IMG[A(id).img]+'" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></i>':'<i></i>').join(''):'<i></i>')+'</span><small class="num">'+sec(u)+'s</small></div>';}if(n>k)h+='<p class="hint" style="margin:4px 0 0">另外 '+(n-k)+' 条按同样规则组合</p>';return h;}
function blkHtml(){const B=blockers();return B.length?'<div class="block" role="alert"><b style="font-size:13px">还差 '+B.length+' 步才能开始</b>'+B.map(b=>'<div>'+ic('info','s')+'<span class="sp">'+esc(b.msg)+'</span>'+(b.act?'<button class="btn link" data-act="'+b.act+'" data-v="'+(b.v??'')+'">'+b.label+'</button>':'')+'</div>').join('')+'</div>':'';}
function drwGen(){
 const n=S.gen[S.mode],B=blockers(),m=S.mode;
 const kv=[['模式',ML[m],'rule'],['单条时长','约 '+sec(unitDur())+' 秒','rule'],['画面',S.ratio+' · '+S.res+' · '+S.fps+'FPS','out'],['字幕',subLabel(),'text'],['配音',S.voice?VN[S.voice]:(m==='oral'?'口播视频原声':'不配音'),'sound'],['背景音乐',S.bgm.length?S.bgm.map(b=>b.name).join('、'):'无','sound']];
 return '<div class="ov side"><aside class="drw" role="dialog" aria-modal="true" aria-labelledby="dg-t"><header><h3 id="dg-t">确认剪辑</h3>'+X+'</header><div class="bd">'+
  '<div class="blk-h">生成数量</div><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="stp"><button data-act="genN" data-v="-1" aria-label="减少">'+ic('minus')+'</button><input class="num" data-k="gen.'+m+'" data-t="n" data-min="1" data-max="100" value="'+n+'" aria-label="生成数量" inputmode="numeric"><button data-act="genN" data-v="1" aria-label="增加">'+ic('plus')+'</button></span><span style="font-size:12px;color:var(--text3);flex:1;min-width:160px">'+GEN_HINT[m]+'</span></div>'+
  '<div class="blk-h">组合预览<span class="sp"></span>'+(m==='mix'?'<button class="btn xs" data-act="mixShuffle">'+ic('rotate-cw','s')+'换一批</button>':'')+'</div><div id="vars">'+varsHtml()+'</div>'+
  '<div class="blk-h">成片参数</div><dl class="kv">'+kv.map(([k,v,s])=>'<dt>'+k+'</dt><dd title="'+esc(v)+'">'+esc(v)+'</dd><button class="btn link" style="font-size:12px" data-act="editFrom" data-v="'+s+'">修改</button>').join('')+'</dl>'+
  '<div class="blk-h">保存到</div><div style="display:flex;gap:8px;align-items:center"><select class="inp w" data-k="lib" aria-label="保存到成片库分组">'+['未分组成片','春季活动','门店日常'].map(o=>'<option'+(S.lib===o?' selected':'')+'>'+o+'</option>').join('')+'</select><button class="btn link" style="font-size:12px" data-act="stub" data-v="管理成片库">管理成片库</button></div>'+
  '<div class="cost"><span style="flex:1"><small>预计消耗</small><b data-sum="cost">'+TP(cost())+'</b></span><small style="text-align:right" data-sum="costNote">'+sec(unitDur())+' 秒 × '+n+' 条，按成片时长估算<br>现阶段由云服务账号结算，暂不扣 TP</small></div>'+
  '<p style="font-size:12px;color:var(--text3);margin:10px 0 0">提交后可以离开本页。进度看右上角的任务胶囊，完成后自动存进作品库「'+esc(S.lib)+'」。</p>'+
  '<div id="blk">'+blkHtml()+'</div>'+
  '</div><footer><button class="btn" data-act="closeOv">取消</button><span class="sp"></span><button class="btn pri" id="startBtn" data-act="start"'+(B.length?' disabled':'')+'>开始剪辑 <span class="num" data-sum="startN">'+n+'</span> 条</button></footer></aside></div>';}
function dlgPick(){
 const P=S.pk,max=PKMAX[P.target],imgOnly=P.target==='cover',vidOnly=P.target==='host';
 const list=ASSETS.filter(a=>(P.folder==='all'||a.f===P.folder)&&(P.type==='all'||a.kind===P.type)&&(!imgOnly||a.kind==='image')&&(!vidOnly||a.kind==='video'));
 const tt={pool:'选择镜头素材',shot:'选择镜头 '+(S.cur+1)+' 的素材',broll:'选择穿插画面',host:'选择口播视频',cover:'选择视频封面'}[P.target];
 return '<div class="ov"><div class="dlg wide" role="dialog" aria-modal="true" aria-labelledby="pk-t"><header><h3 id="pk-t">'+tt+'</h3>'+X+'</header><div class="bd"><p class="hint">按文件夹查找素材，可以直接上传；勾选会跨文件夹保留。'+(imgOnly?'封面只能用图片。':vidOnly?'口播视频只能选一个视频。':'')+'</p>'+
  '<div class="pk"><div class="pk-f">'+FOLDERS.map(([k,l])=>'<button class="'+(P.folder===k?'on':'')+'" data-act="pkF" data-v="'+k+'">'+ic('folder','s')+l+'<small class="num">'+(k==='all'?ASSETS.length:ASSETS.filter(a=>a.f===k).length)+'</small></button>').join('')+'</div>'+
  '<div><div class="pk-t"><div class="seg" role="tablist" aria-label="素材类型">'+[['all','全部'],['video','视频'],['image','图片']].map(([k,l])=>'<button role="tab" aria-selected="'+(P.type===k)+'" data-act="pkT" data-v="'+k+'">'+l+'</button>').join('')+'</div><span style="flex:1"></span><button class="btn sm" data-act="stub" data-v="本地上传（和素材库共用上传组件）">'+ic('upload','s')+'上传</button></div>'+
  '<div class="pk-g">'+(list.map(a=>{const ix=P.sel.indexOf(a.id);return '<button class="pk-i" aria-pressed="'+(ix>=0)+'" data-act="pkI" data-id="'+a.id+'"><span class="im" style="display:block"><img src="'+IMG[a.img]+'" alt=""></span><b>'+esc(a.name)+'</b><small class="num">'+(a.kind==='video'?'视频 · '+fmt(a.d):'图片')+'</small><span class="ck">'+(ix>=0?'<em class="num">'+(ix+1)+'</em>':'')+'</span></button>';}).join('')||'<p class="hint">这个文件夹里没有可用素材</p>')+'</div></div></div></div>'+
  '<footer><span class="num" style="font-size:13px;color:var(--text2)">已选 '+P.sel.length+' / '+max+'</span><button class="btn link" data-act="pkClear">清空选择</button><span class="sp"></span><button class="btn" data-act="closeOv">取消</button><button class="btn pri" data-act="pkOk">确认选择</button></footer></div></div>';}
function drwStyle(){
 const k=S.styTab,st=S.sty[k],p='sty.'+k+'.';
 return '<div class="ov side-l clear"><aside class="drw" role="dialog" aria-modal="true" aria-labelledby="st-t"><header><h3 id="st-t">文字样式</h3>'+X+'</header><div class="bd">'+
  '<div class="seg" role="tablist" aria-label="样式对象" style="margin-bottom:12px">'+[['sub','字幕'],['ttl','标题']].map(([v,l])=>'<button role="tab" aria-selected="'+(k===v)+'" data-act="styTab" data-v="'+v+'">'+l+'</button>').join('')+'</div>'+
  row('字体','<select class="inp w" data-k="'+p+'font" aria-label="字体">'+FONTS.map(f=>'<option'+(st.font===f?' selected':'')+'>'+f+'</option>').join('')+'</select>',1)+
  row('花字','<div class="fl">'+FLW.map((f,i)=>'<button class="'+(st.fl===i?'on':'')+'" data-act="set" data-k="'+p+'fl" data-t="n" data-v="'+i+'" aria-label="'+(i?'花字 '+i:'普通文字')+'" aria-pressed="'+(st.fl===i)+'"><span style="'+f+';-webkit-text-stroke:1px var(--sc,transparent)">字</span></button>').join('')+'</div>')+
  row('入场',chips(p+'anim',ANIMS,st.anim))+
  row('字号',rngRaw(p+'size',st.size,12,160,1,'','字号'))+
  row('颜色','<input type="color" data-k="'+p+'color" value="'+st.color+'" aria-label="文字颜色" style="width:32px;height:32px;border:0;padding:0;background:none"><span>描边</span><input type="color" data-k="'+p+'stroke" value="'+st.stroke+'" aria-label="描边颜色" style="width:32px;height:32px;border:0;padding:0;background:none">'+rngRaw(p+'sw',st.sw,0,12,1,'','描边宽度'))+
  row('位置',rngRaw(p+'pos',st.pos,0,100,1,'%','距顶部')+'<span class="note">文字中心到画面顶部的距离</span>')+
  row('对齐',chips(p+'align',[['left','左对齐'],['center','居中'],['right','右对齐']],st.align))+
  (k==='ttl'?row('显示时间',num(p+'start',st.start,0,60,.5,'开始秒')+'<span>～</span>'+num(p+'end',st.end,0,60,.5,'结束秒')+'<span>秒</span>',1):'')+
  '<p class="hint">预览里的花字和动画是近似效果，以云端成片为准。</p></div><footer><button class="btn" data-act="styReset">恢复默认</button><span class="sp"></span><button class="btn pri" data-act="closeOv">完成</button></footer></aside></div>';}
const paras=t=>String(t).split(/\n+/).map(s=>s.trim()).filter(Boolean);
const estDur=p=>clamp(Math.ceil(p.replace(/\s/g,'').length/4.5),2,15);
function drwScript(){
 const d=S.scriptDraft,st=S.scriptStep,P=paras(d.text);
 const SRC=[['brand','分析品牌战略'],['account','分析对标账号'],['video','分析对标视频']];
 let body='';
 if(st===1)body='<div class="seg" role="tablist" aria-label="资料来源" style="margin-bottom:12px">'+SRC.map(([k,l])=>'<button role="tab" aria-selected="'+(d.src===k)+'" data-act="set" data-k="scriptDraft.src" data-v="'+k+'" data-rr="ov">'+l+'</button>').join('')+'</div>'+
  [['goal','推广目的','例如：新品到店引流'],['style','文案风格','例如：亲切口语'],['aud','用户群体','例如：附近 25-40 岁女性']].map(([k,l,ph])=>'<div class="field"><label for="sd-'+k+'">'+l+'</label><input class="inp" id="sd-'+k+'" data-k="scriptDraft.'+k+'" value="'+esc(d[k])+'" maxlength="200" placeholder="'+ph+'"></div>').join('')+
  '<div class="field"><label for="sd-info">'+({brand:'品牌 / 门店资料',account:'对标账号链接与资料',video:'对标视频链接与内容说明'}[d.src])+'</label><textarea class="ta" id="sd-info" style="min-height:90px" data-k="scriptDraft.info" maxlength="2000">'+esc(d.info)+'</textarea></div>'+
  '<div class="field"><label for="sd-topic">本次选题</label><input class="inp" id="sd-topic" data-k="scriptDraft.topic" value="'+esc(d.topic)+'" maxlength="200"></div>';
 if(st===2)body='<div class="field"><label for="sd-text">口播文案 <span class="num" data-sum="scChars">'+d.text.replace(/\s/g,'').length+' 字</span> · 每段一行，一段对应一个镜头</label><textarea class="ta" id="sd-text" style="min-height:280px" data-k="scriptDraft.text" maxlength="10000">'+esc(d.text)+'</textarea></div>';
 if(st===3)body=P.length?'<p class="hint">按段落拆成 '+P.length+' 个镜头，时长按字数估算。已有镜头的素材按顺序保留，生成后可以在左侧继续调整。</p>'+P.map((p,i)=>'<div class="para"><em class="num">镜头 '+(i+1)+'<br>'+estDur(p)+' 秒</em><span>'+esc(p)+'</span></div>').join(''):'<p class="hint">口播文案是空的，先回到上一步填写。</p>';
 const ai=st===1?'<button class="btn'+gated('llm')+'" data-act="aiTopic" data-cap="llm">'+ic('sparkles','s')+'AI 生成选题'+badge('llm')+'</button>':st===2?'<button class="btn'+gated('llm')+'" data-act="aiScript" data-cap="llm">'+ic('sparkles','s')+'AI 写口播文案'+badge('llm')+'</button>':'';
 return '<div class="ov side"><aside class="drw" role="dialog" aria-modal="true" aria-labelledby="sc-t"><header><h3 id="sc-t">从口播文案拆分镜</h3>'+X+'</header><div class="bd"><div class="steps">'+['生成选题','口播文案','拆解分镜'].map((l,i)=>'<button class="'+(st===i+1?'on':'')+'" data-act="scStep" data-v="'+(i+1)+'" aria-current="'+(st===i+1?'step':'false')+'">0'+(i+1)+' '+l+'</button>').join('')+'</div>'+body+'</div>'+
  '<footer>'+ai+'<span class="sp"></span>'+(st>1?'<button class="btn" data-act="scStep" data-v="'+(st-1)+'">上一步</button>':'')+(st<3?'<button class="btn pri" data-act="scStep" data-v="'+(st+1)+'">下一步</button>':'<button class="btn pri" data-act="scApply"'+(P.length?'':' disabled')+'>生成 '+P.length+' 个镜头</button>')+'</footer></aside></div>';}
function dlgNotice(){const c=S.ov.cap,soon=SOON[c];
 return '<div class="ov"><div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="nt-t" style="width:min(420px,100%)"><div class="bd" style="padding-top:20px"><div class="notice"><span class="ib">'+ic('info')+'</span><div><b id="nt-t" style="font-size:15px">「'+CAPS[c]+'」'+(soon?'即将上线':'正在接入中')+'</b><p>该功能'+(soon?'即将上线':'正在接入中')+'，敬请期待。接入后可以'+CAP_USE[c]+'，现在做的其他设置不受影响。</p></div></div></div><footer><button class="btn link" data-act="svc">查看全部接入状态</button><span class="sp"></span><button class="btn pri" data-act="closeOv">知道了</button></footer></div></div>';}
function dlgSvc(){return '<div class="ov"><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="sv-t"><header><h3 id="sv-t">云能力接入状态</h3>'+X+'</header><div class="bd"><div class="svc-list">'+Object.keys(CAPS).map(k=>'<div><span><b style="font-weight:500">'+CAPS[k]+'</b><br><small>'+CAP_DEP[k]+'</small></span>'+(okCap(k)?'<span class="bdg" style="background:#E7F6EC;color:#0F7A3D">已就绪</span>':badge(k))+'</div>').join('')+'</div><p class="hint" style="margin-top:12px">未接入的功能保留入口并标注状态，点击会说明原因，不再直接置灰。</p></div><footer><span class="sp"></span><button class="btn pri" data-act="closeOv">知道了</button></footer></div></div>';}
function dlgHelp(){return '<div class="ov"><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="hp-t"><header><h3 id="hp-t">剪辑说明</h3>'+X+'</header><div class="bd" style="font-size:13px;color:var(--text2)">'+
 [['选方式','顶部四个页签：一键成片按时长自动成片；批量混剪随机抽镜头组合多条；口播用一段口播视频配文案字幕；分镜脚本按镜头逐个编排。切换时素材和文案会保留。'],['放素材','左栏添加素材，弹窗里可以直接上传。分镜脚本在左栏管理镜头，口播在左栏写文案、选口播视频。'],['调设置','中栏按「规则 → 字幕 → 声音 → 画面」从上往下设置，收起时标题行直接显示当前设置。'],['看预览','右栏和底部镜头轨实时预览排版，点镜头轨上的任意一段跳到对应画面。'],['生成','点右上「立即剪辑」，确认数量和参数后提交。进度在任务胶囊里看，完成后自动存进作品库。']].map(([t,d],i)=>'<p style="margin:0 0 10px"><b style="color:var(--text)">'+(i+1)+'. '+t+'</b><br>'+d+'</p>').join('')+'</div><footer><span class="sp"></span><button class="btn pri" data-act="closeOv">知道了</button></footer></div></div>';}
function layer(){
 const L=$('#layer'),o=S.ov;
 if(!o){L.innerHTML='';return;}
 L.innerHTML={gen:drwGen,pick:dlgPick,style:drwStyle,script:drwScript,notice:dlgNotice,svc:dlgSvc,help:dlgHelp}[o.type]();
 const f=$('#layer .drw, #layer .dlg');if(f&&!f.contains(document.activeElement)){const t=f.querySelector('header .ibtn')||f.querySelector('button');t&&t.focus({preventScroll:true});}}

/* ---------- 菜单与任务浮层 ---------- */
function popMore(){return '<div class="gt">工程</div><button class="mi" data-act="newProj">'+ic('plus','s')+'新建空白工程<small>清空当前编辑</small></button><button class="mi" data-act="stub" data-v="打开工程列表">'+ic('folder','s')+'打开工程…</button><button class="mi" data-act="stub" data-v="历史版本列表">'+ic('clock','s')+'历史版本<small>第 '+S.rev+' 版</small></button><hr>'+
 '<div class="gt">模板</div><button class="mi" data-act="saveTpl">'+ic('save','s')+'保存为模板</button><button class="mi" data-act="stub" data-v="我的模板">'+ic('layout','s')+'我的模板</button><button class="mi" data-act="stub" data-v="云端模板">'+ic('layout','s')+'云端模板</button><hr>'+
 '<div class="gt">工具</div><button class="mi" data-act="stub" data-v="素材智能处理（智能封面、去字幕、绿幕抠像等 16 项）">'+ic('sparkles','s')+'素材智能处理…</button><button class="mi" data-act="help">'+ic('info','s')+'剪辑说明</button>';}
function popJobs(){const st=j=>j.st==='queue'?'排队中':j.st==='run'?'云端处理中 · '+Math.round(j.p)+'%':'已完成 · 已存入「'+esc(j.lib)+'」';
 return '<header>剪辑任务<span class="sp"></span><button class="btn link" style="font-size:12px" data-act="clearDone">清除已完成</button></header><div style="max-height:360px;overflow:auto">'+S.jobs.map(j=>'<div class="job"><span class="th">'+(j.img?'<img src="'+IMG[j.img]+'" alt="">':'')+'</span><span><b>'+esc(j.name)+'</b><span class="st">'+(j.st==='done'?ic('check','s'):'')+st(j)+'</span>'+(j.st==='done'?'<span class="acts"><button class="btn xs" data-act="stub" data-v="播放成片">'+ic('play','s')+'预览</button><button class="btn xs" data-act="stub" data-v="下载成片">'+ic('download','s')+'下载</button><button class="btn xs" data-act="stub" data-v="打开作品库">去作品库</button></span>':'<span class="pg"><i style="width:'+j.p+'%"></i></span>')+'</span></div>').join('')+'</div>'+
 '<footer><button class="btn sm" data-act="stub" data-v="云任务与成片（全部记录）">全部任务与成片</button><span class="sp"></span><button class="btn sm'+gated('imm')+'" data-act="pack" data-cap="imm">'+ic('download','s')+'打包下载'+badge('imm')+'</button></footer>';}
function pop(){
 const L=$('#popL'),p=S.pop;if(!p){L.innerHTML='';return;}
 const a=$(p.type==='more'?'#moreBtn':'#jobChip');if(!a){S.pop=null;L.innerHTML='';return;}
 const r=a.getBoundingClientRect();
 L.innerHTML='<div class="pop'+(p.type==='jobs'?' jobs':'')+'" role="'+(p.type==='more'?'menu':'dialog')+'" aria-label="'+(p.type==='more'?'更多操作':'剪辑任务')+'" style="top:'+(r.bottom+6)+'px;right:'+Math.max(8,innerWidth-r.right)+'px">'+(p.type==='more'?popMore():popJobs())+'</div>';}
let toastT=0,UNDO=null;
function toast(msg,undo){const L=$('#toast');L.innerHTML='<div class="toast" role="status"><span>'+esc(msg)+'</span>'+(undo?'<button data-act="undo">撤销</button>':'')+'</div>';UNDO=undo||null;clearTimeout(toastT);toastT=setTimeout(()=>{L.innerHTML='';UNDO=null;},undo?6000:2600);}
