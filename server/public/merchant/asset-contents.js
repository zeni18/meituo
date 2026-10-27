/* Owned merchant content alongside native generated assets; no media is copied. */
(() => {
  'use strict';
  const labels={clip:'剪辑成片',finished_image:'成品图片',image_text:'图文',article:'GEO 软文',copy:'文案'};
  const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
  const button=(text,fn)=>{const b=node('button','mac-button',text);b.type='button';b.addEventListener('click',fn);return b;};
  window.MerchantAssetContents={mount(host,{api,open,navigate}){
    const root=node('section','mac-contents');root.setAttribute('aria-label','营销内容');
    const header=node('header','mac-heading'),title=node('h2','','营销内容'),count=node('span','mac-muted'),tools=node('form','mac-filters'),search=node('input'),kind=node('select');
    search.type='search';search.placeholder='搜索营销内容';search.setAttribute('aria-label','搜索营销内容');search.maxLength=80;kind.setAttribute('aria-label','内容类型');kind.add(new Option('全部类型',''));for(const [key,label] of Object.entries(labels))kind.add(new Option(label,key));
    const refresh=button('刷新',()=>load());tools.append(search,kind,refresh);tools.addEventListener('submit',event=>event.preventDefault());header.append(title,count,tools);
    const note=node('p','mac-muted','正在加载营销内容…'),grid=node('div','mac-grid'),footer=node('footer','mac-pagination'),pageLabel=node('span'),prev=button('上一页',()=>{page--;render();}),next=button('下一页',()=>{page++;render();});footer.append(prev,pageLabel,next);footer.hidden=true;const dialog=node('dialog','mac-dialog');dialog.setAttribute('aria-label','内容预览');root.append(header,note,grid,footer,dialog);host.prepend(root);const mediaTitle=node('h2','mac-native-heading','AI 作品');root.after(mediaTitle);root.setVisible=visible=>{root.hidden=!visible;mediaTitle.hidden=!visible;};
    let rows=[],page=1,seq=0,previewSeq=0,dead=false;const size=12;
    const stop=()=>{for(const media of dialog.querySelectorAll('video,audio')){media.pause();media.removeAttribute('src');media.load();}};dialog.addEventListener('close',()=>{previewSeq++;stop();});
    async function preview(row){
      const request=++previewSeq;stop();dialog.replaceChildren();const top=node('header','mac-dialog-heading');top.append(node('h2','',row.name),button('关闭',()=>dialog.close()));const body=node('div','mac-preview');dialog.append(top,body);dialog.showModal();
      try{let files=row.files||[];if(row.kind==='clip'){body.append(node('p','mac-muted','正在获取播放地址…'));const result=await api('delivery',{ref:row.ref},undefined,'merchantPublishing');if(!dialog.open||dead||request!==previewSeq)return;files=[{url:result.url}];body.replaceChildren();}
        if(row.content)body.append(node('p','mac-copy',row.content));
        for(const file of files){const tag=['video','clip'].includes(row.kind)?'video':['audio','voiceover'].includes(row.kind)?'audio':'img',media=node(tag);media.src=file.url;if(tag==='img')media.alt=row.name;else{media.controls=true;media.preload='metadata';}body.append(media);}
        if(!files.length&&!row.content)body.append(node('p','mac-muted','暂无可预览的内容。'));
        const manage=button('管理'+labels[row.kind],()=>{dialog.close();if(row.kind==='article')open('article');else if(row.kind==='clip')open('video');else if(['image_text','finished_image','copy'].includes(row.kind))open('image_text');else if(row.kind==='topic')open('topic');else navigate('/ai/materials/'+(row.kind==='image'?'images':row.kind)+(new URLSearchParams(location.search).get('tenant_id')?'?tenant_id='+new URLSearchParams(location.search).get('tenant_id'):''));});dialog.append(manage);
      }catch(error){if(request===previewSeq&&!dead)body.replaceChildren(node('p','mac-error',error.message));}
    }
    function render(){
      const text=search.value.trim().toLocaleLowerCase(),filtered=rows.filter(row=>(!kind.value||kind.value===row.kind)&&(!text||[row.name,row.content,row.tags,row.brand_name].join(' ').toLocaleLowerCase().includes(text)));
      page=Math.max(1,Math.min(page,Math.ceil(filtered.length/size)||1));count.textContent=filtered.length+' 项';note.hidden=filtered.length>0;note.textContent=rows.length?'没有符合筛选条件的内容':'暂无营销内容，创建后会自动汇总到这里。';grid.replaceChildren();
      for(const row of filtered.slice((page-1)*size,page*size)){
        const card=button('',()=>preview(row));card.className='mac-card';const cover=node('div','mac-cover'),file=row.files?.[0];
        if(file&&['image','image_text','finished_image'].includes(row.kind)){const image=node('img');image.src=file.url;image.alt=row.name;image.loading='lazy';cover.append(image);}else{cover.append(node('span','mac-symbol',['video','clip'].includes(row.kind)?'▶':['audio','voiceover'].includes(row.kind)?'♫':row.kind==='topic'?'#':'Aa'));if(row.content)cover.append(node('p','mac-excerpt',row.content));}
        const info=node('div','mac-info');info.append(node('strong','',row.name),node('span','mac-muted',labels[row.kind]));card.append(cover,info);card.setAttribute('aria-label','预览 '+row.name);grid.append(card);
      }
      footer.hidden=filtered.length<=size;prev.disabled=page<=1;next.disabled=page*size>=filtered.length;pageLabel.textContent=page+' / '+Math.max(1,Math.ceil(filtered.length/size));
    }
    async function load(){
      const run=++seq;refresh.disabled=true;root.setAttribute('aria-busy','true');note.hidden=false;note.textContent='正在加载营销内容…';const results=[],failures=[],keys=Object.keys(labels);let cursor=0;
      await Promise.all(Array.from({length:3},async()=>{while(cursor<keys.length&&run===seq&&!dead){const key=keys[cursor++];try{let current=1,total=0;do{const data=await api(key==='clip'?'films':key==='article'?'articleLibrary':'library',key==='clip'?{source:'clip',page:current}:key==='article'?{page:current,page_size:100}:{kind:key,page:current,page_size:72},undefined,key==='clip'?'merchantPublishing':'merchantWorkspace');if(dead||run!==seq)return;for(const row of data.lists||[])results.push({...row,kind:key,name:row.name||row.title,files:row.files||[],content:row.content||''});total+=data.lists.length;if(!data.lists.length)break;current++;if(total>=data.count)break;}while(true);}catch(error){failures.push(labels[key]);}}}));
      if(dead||run!==seq)return;rows=results.sort((a,b)=>Number(b.create_time)-Number(a.create_time)||Number(b.id)-Number(a.id));render();if(failures.length){note.hidden=false;note.className='mac-error';note.textContent=failures.join('、')+'加载失败，请点击刷新重试。';}else note.className='mac-muted';refresh.disabled=false;root.removeAttribute('aria-busy');
    }
    search.addEventListener('input',()=>{page=1;render();});kind.addEventListener('change',()=>{page=1;render();});
    const syncArticles=()=>load();window.addEventListener('merchant-articles-changed',syncArticles);
    root.destroy=()=>{window.removeEventListener('merchant-articles-changed',syncArticles);dead=true;seq++;if(dialog.open)dialog.close();stop();mediaTitle.remove();root.remove();};load();return root;
  }};
})();
