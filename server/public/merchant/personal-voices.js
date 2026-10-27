/* Personal voice workflow. No provider credentials or raw cloud identity are exposed. */
(() => {
  'use strict';
  const labels={queued:'等待复刻',submitting:'正在提交',training:'正在复刻',ready:'待试听启用',active:'已启用',unknown:'结果待查询',review:'需要核查',failed:'复刻失败',blocked:'服务不可用',expired:'试听已过期'};
  function open({api,modal,make,button,input,onUse}){
    const m=modal('我的音色'),list=make('div','mc-voice-library'),note=make('p','mc-note');let timer=0,sequence=0;
    const add=button('上传声音',()=>upload(),true);
    m.content.append(note,list);m.footer.append(button('刷新列表',load),add);
    m.dialog.addEventListener('close',()=>{clearTimeout(timer);sequence++;});
    async function load(){
      clearTimeout(timer);const seq=++sequence;
      try{
        const data=await api('voiceProfiles');if(!m.dialog.isConnected||seq!==sequence)return;
        note.textContent=data.notice;add.disabled=!data.can_create;
        if(!data.can_create)m.error.textContent='尚未获得上传复刻权限，请联系管理员开通。';else m.error.textContent='';
        list.replaceChildren();
        for(const voice of data.lists){
          const card=make('section','mc-voice-row'),head=make('div','mc-voice-row-head'),status=make('span','mc-voice-status',labels[voice.state]||voice.state);
          head.append(make('h3','',voice.name),status);card.append(head);
          if(voice.error)card.append(make('p','mc-note',voice.error));
          if(voice.state==='ready'&&voice.trial_expires)card.append(make('p','mc-note','请于 '+new Date(voice.trial_expires*1000).toLocaleString('zh-CN')+' 前首次配音启用。'));
          if(voice.preview_url){const audio=make('audio');audio.controls=true;audio.preload='none';audio.src=voice.preview_url;audio.setAttribute('aria-label',voice.name+'试听');card.append(audio);}
          const actions=make('div','mc-actions'),refresh=button('更新状态与试听',async()=>{
            refresh.disabled=true;try{await api('refreshVoice',{}, {id:voice.id});await load();}catch(e){m.error.textContent=e.message;}finally{refresh.disabled=false;}
          }),use=button(voice.requires_activation?'选择并首次配音':'使用此音色',()=>{m.dialog.close();onUse(voice.id);},true);
          use.disabled=!voice.can_use;refresh.disabled=!voice.available||voice.state==='queued'||voice.state==='submitting';
          actions.append(refresh,button('重命名',()=>rename(voice)),use);card.append(actions);list.append(card);
        }
        if(!data.lists.length)list.append(make('p','mc-empty','还没有个人音色。上传一段清晰的单人录音，完成复刻后可在当前账号反复使用。'));
        if(data.lists.some(v=>['queued','submitting','training','unknown'].includes(v.state)))timer=setTimeout(load,8000);
      }catch(e){if(m.dialog.isConnected)m.error.textContent=e.message;}
    }
    function reopen(){open({api,modal,make,button,input,onUse});}
    function rename(voice){
      const d=modal('重命名音色',{small:true}),name=input('音色名称',voice.name,()=>{},{maxLength:80,track:false});
      const save=button('保存',async()=>{save.disabled=true;try{await api('renameVoice',{}, {id:voice.id,name:name.querySelector('input').value});d.dialog.close();reopen();}catch(e){d.error.textContent=e.message;}finally{save.disabled=false;}},true);
      d.content.append(name);d.footer.append(button('返回我的音色',reopen),save);
    }
    function upload(){
      const d=modal('上传声音复刻'),name=input('音色名称','我的声音',()=>{},{maxLength:80,track:false}),fileLabel=make('label','mc-field'),file=make('input'),consentLabel=make('label','mc-voice-consent'),consent=make('input');
      const requestKey=crypto.randomUUID();let busy=false;
      file.type='file';file.accept='.wav,.mp3,.ogg,.m4a,.aac';fileLabel.append(make('span','','声音样本（5～60秒，不超过10MB）'),file);
      consent.type='checkbox';consentLabel.append(consent,make('span','','我确认这是本人声音或已取得权利人授权，同意将样本提交给火山引擎进行声音复刻。'));
      d.content.append(name,fileLabel,make('p','mc-note','请使用安静环境下的普通话单人录音，避免音乐和其他人声。复刻后先试听，满意后再首次配音启用；试听会产生语音服务字符费用，首次正式配音另产生音色开通费用，均由服务账号承担。'),consentLabel);
      const back=button('返回我的音色',reopen),submit=button('上传并开始复刻',async()=>{
        if(busy)return;const sample=file.files[0],value=name.querySelector('input').value.trim();
        if(!value||!sample||!consent.checked){d.error.textContent='请填写音色名称、选择声音样本并确认授权。';return;}
        if(sample.size>10*1024*1024){d.error.textContent='声音样本不能超过10MB';return;}
        busy=true;submit.disabled=back.disabled=true;d.dialog.querySelector('header button').disabled=true;d.error.textContent='正在上传，请稍候…';
        const body=new FormData();body.append('file',sample);body.append('name',value);body.append('consent','1');body.append('request_key',requestKey);
        const query=new URLSearchParams();const tenant=new URLSearchParams(location.search).get('tenant_id');if(tenant)query.set('tenant_id',tenant);
        try{
          const response=await fetch('/api/merchantClip/uploadVoice?'+query,{method:'POST',credentials:'same-origin',body});
          const result=await response.json();if(result.code!==1)throw Error(result.msg||'上传失败，请稍后重试');
          d.dialog.close();reopen();
        }catch(e){d.error.textContent=e.message;}
        finally{busy=false;submit.disabled=back.disabled=false;if(d.dialog.isConnected)d.dialog.querySelector('header button').disabled=false;}
      },true);
      d.dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});d.footer.append(back,submit);
    }
    load();
  }
  window.MerchantPersonalVoices={open};
})();
