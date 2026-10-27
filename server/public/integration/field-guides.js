/* Field help contains public instructions only; never reads saved form values. */
(() => {
  'use strict';
  const speech='https://console.volcengine.com/speech';
  const ark='https://console.volcengine.com/ark';
  const oss='https://oss.console.aliyun.com/bucket';
  const ram='https://ram.console.aliyun.com/';
  const guide=(steps,url='',link='打开服务控制台')=>({steps,url,link});
  const access=guide(['打开阿里云访问控制 RAM → AccessKey 管理，找到用于本中台的密钥。','复制同一对 AccessKey ID / Secret 到对应框；Secret 无法查看时使用已安全保存的原值。','多个阿里云服务建议在“阿里云公共凭证”填写一次，各服务选择公共凭证并保存。'],ram);
  const voiceKey=guide(['打开豆包语音 → API Key，选择与已开通服务相同的资源项目。','复制该项目可用的 API Key，完整粘贴到此处。','这里使用新版语音 API Key，不填旧版 APP ID / Access Token，也不填方舟模型 Key。'],speech);
  const fields={
    aliyun:{access_key_id:access,access_key_secret:access},
    oss:{
      region:guide(['打开 OSS，选中素材 Bucket，查看所在地域。','填写地域 ID，例如北京 cn-beijing；不要填“北京”中文名称。','剪辑素材与 IMS 合成配置保持同一地域。'],oss),
      bucket:guide(['打开 OSS Bucket 列表，选择用于剪辑素材的存储桶。','复制 Bucket 名称，例如 siro2026，不包含 oss:// 或域名。','确认调用凭证可以读写该桶，再保存。'],oss),
      prefix:guide(['确定素材在 Bucket 内保存的目录；空白表示使用默认根前缀。','可填相对目录，例如 aigc/clip/materials/。','不要填写完整 URL、开头斜杠或 ..；程序继续按商家隔离文件。'])
    },
    ims:{
      region:guide(['打开智能媒体服务，查看控制台所选地域。','填写地域 ID，例如 cn-beijing。','素材 OSS、IMS 与输出 Bucket 必须在同一地域。'],'https://ice.console.aliyun.com/'),
      output_bucket:guide(['打开 IMS → 配置管理 → 存储管理，登记同地域 OSS Bucket。','在这里仅填 Bucket 名称，例如 siro2026。','保存后还需真实合成验收；登记正常不等于密钥权限已验证。'],'https://ice.console.aliyun.com/settings/storage'),
      role_arn:guide(['使用 AccessKey 直接调用时可留空。','需要 STS 角色方案时，在 RAM 角色详情复制完整 ARN。','仅填写允许当前调用者 AssumeRole 的专用角色；不要填 IMS 默认角色名称。'],ram),
      prefix:guide(['确定合成视频输出目录，例如 aigc/clip/output/。','填写 Bucket 内相对路径，不包含 Bucket 名或域名。','修改前先处理执行中的任务，避免旧任务配置核验失败。'])
    },
    imm:{
      region:guide(['打开 IMM 项目列表，查看项目所在地域。','填写地域 ID，例如 cn-beijing。','与 IMS 成片及打包输出 Bucket 使用同一地域。'],'https://imm.console.aliyun.com/'),
      project:guide(['在 IMM 开通服务并完成服务角色授权。','在对应地域创建或选择项目，从列表复制真实项目名称。','仅填名称，例如 meituo-aigc-clip，不填写项目 ID 或自拟未创建的名称。'],'https://imm.console.aliyun.com/v2/cn-beijing/projects'),
      output_bucket:guide(['在 OSS 选择与 IMM 项目同地域的输出 Bucket。','仅填写桶名称，例如 siro2026。','确认 IMM 服务角色可读取成片并向输出桶写入 ZIP。'],oss),
      prefix:guide(['设置 ZIP 输出目录，例如 aigc/clip/packages/。','填写相对目录，不含 Bucket、域名或开头斜杠。','打包只包含所选成片，不会扫描该目录或整个 Bucket。'])
    },
    tts:{
      resource_id:guide(['在豆包语音 → 开通管理确认“语音合成2.0”已开通。','当前异步长文本合成填写 seed-tts-2.0。','该值表示模型资源，不是 APP ID；需与下面的 2.0 音色匹配。'],'https://docs.volcengine.com/docs/DoubaoVoice/Tasksubmission?lang=zh','查看官方接口说明'),
      speaker_ids:guide(['打开豆包语音 → 音色库，选择语音合成2.0支持的音色。','从音色详情复制 speaker / 音色 ID，每行填写一个。','不要填写音色中文名称；保存后商家只能选择这些音色。'],speech),
      api_key:voiceKey
    },
    icl:{
      resource_id:guide(['在豆包语音开通“声音复刻2.0”和“后付费音色”。','复刻音色合成填写 seed-icl-2.0，API Key 使用同项目语音 Key。','开启用户上传复刻后，用户在中台“我的音色”上传、试听并保存到自己的账号。'],'https://docs.volcengine.com/docs/DoubaoVoice/SoundReplicaAPI-V3?lang=zh','查看官方接口说明'),
      clone_mode:guide(['在豆包语音确认声音复刻2.0及后付费音色均已开通。','选择“开启用户上传复刻”，填好语音 API Key 后保存。','当前槽位首次正式合成按138元/音色收费，另按字数计费；七天未启用的试听音色会被清理，实际价格以火山当前规则为准。'],speech),
      speaker_ids:guide(['此项仅用于管理员提供的公共音色，可留空。','个人音色由用户在“我的音色”上传复刻后自动保存，不需要复制到这里。','只有需要共享给授权商家的已有音色，才在这里每行填写一个实际 ID。'],speech),
      api_key:voiceKey
    },
    llm:{
      model_id:guide(['打开火山方舟，在模型广场或在线推理确认模型已开通。','选择支持 Responses API 的文本模型，复制 Model ID 或已运行的推理接入点 ep-…。','填写标识而非显示名称；API Key 需要有权访问该模型或接入点。'],ark),
      api_key:guide(['打开火山方舟 → API Key 管理，切换到模型所在资源项目。','复制可访问目标模型的方舟 API Key 并粘贴。','不要使用豆包语音 Key、IAM AccessKey 或 Agent/Coding Plan 专用凭证。'],ark)
    },
    asr:{
      resource_id:guide(['在豆包语音 → 开通管理中开通录音文件识别2.0。','填写 volc.seedasr.auc；保存后系统会提交任务并自动查询字幕结果。','已有极速版可保留 volc.bigasr.auc_turbo；不要填流式语音识别资源 ID。'],'https://docs.volcengine.com/docs/DoubaoVoice/task-submission-http-1?lang=zh','查看官方接口说明'),
      api_key:voiceKey
    },
    task_notify:{
      appid:guide(['登录微信公众平台，选择已认证的服务号。','在开发与接口相关设置中复制 AppID。','填 wx 开头的完整值，不填小程序 AppID。'],'https://mp.weixin.qq.com/'),
      app_secret:guide(['在同一服务号的开发设置中取得 AppSecret。','完整粘贴，与 AppID 保持同一账号。','无法查看时先找已保存的密钥；重置会影响其他使用方。'],'https://mp.weixin.qq.com/'),
      template_id:guide(['在微信服务号模板消息管理中选择适合员工任务通知的模板。','复制实际模板 ID。','逐项核对模板字段，并填写下方字段映射。'],'https://mp.weixin.qq.com/'),
      public_base:guide(['准备可从公网访问本中台的 HTTPS 域名。','只填写域名，例如 https://tasks.example.com，不附加路径。','在微信配置网页授权域名和服务器 IP 白名单；员工需关注并绑定。']),
      data_map:guide(['打开已选微信模板，查看实际字段名，例如 thing1、time3。','填写 JSON 对象，将字段映射为 title、store、content、time。','例如 {"thing1":"title","time3":"time"}；不要直接照抄与模板不符的字段。'])
    },
    'geo-text':{
      provider:guide(['使用官方直连时选择 DeepSeek Flash；已有统一上游时选择原市场模式。','按所选方式配置凭证或现有模型产品。','保存后在原市场维护并上架输入和输出 Token 售价。']),
      model_id:guide(['打开原模型市场，找到用于 GEO 文本生成的产品。','市场模式填写本系统产品的数字 ID，不是云端模型名称。','DeepSeek 直连模式由系统读取对应产品，此框不可编辑。']),
      api_key:guide(['登录 DeepSeek 开放平台 → API Keys。','复制正式调用 Key，在文本接入方式选择官方直连后填写。','保存后可使用页面的连接与余额检查，不会生成文章。'],'https://platform.deepseek.com/')
    },
    'geo-web_search':{
      api_key:guide(['登录博查开放平台并开通 Web Search。','复制该服务的 API Key，完整粘贴。','在原市场关联对应的 GEO 产品与按次 SKU 后保存。'],'https://open.bochaai.com/')
    },
    'geo-visibility_cn':{
      provider:guide(['核对供应商提供的接入文档。','本次 GEO 服务商使用 API v1.3；原模力指数接入选择对应协议。','地址、密钥和协议必须属于同一供应商，不要混填。']),
      api_origin:guide(['从供应商交付资料复制 HTTPS 服务地址。','GEO 服务商可填写包含 /api/v1 的地址；不要附带密钥或查询参数。','保存后按页面说明检查连接与余额。']),
      api_key:guide(['从已签约供应商后台取得 API Key 或 Bearer Token。','确认有读取和监测所需权限，仅粘贴凭证本身。','查询可能按供方规则收费；使用前核对套餐与余额。'])
    },
    haipress:{
      token:guide(['登录海讯社会员后台，找到接口对接资料。','复制提供给本账号的 Token，填入此框。','与下面 Key 必须同属一个账号，保存后按需验证接口。'],'https://haipress.com/'),
      key:guide(['从海讯社接口对接资料取得 Key。','完整复制到此处，勿与 Token 对调。','此页保存时按当前值更新，清空会移除对应凭证。'],'https://haipress.com/'),
      public_base:guide(['填写部署本中台的公网 HTTPS 域名。','仅填域名，不含路径、端口或 localhost。','只验证接口与同步资源时可空白；正式发稿前必须填写，供方会读取稿件。']),
      markup:guide(['确定基于供方报价的零售加价百分比。','例如填 10 表示加价 10%，填 0 表示不加价。','保存后应用于新报价；先核对业务定价再启用。'])
    }
  };
  const common={
    credential_mode:guide(['多个阿里云服务共用密钥时选择“使用公共凭证”。','先保存本级阿里云公共凭证，再保存当前服务的专属参数。','确需不同账号时选独立凭证，并填写完整 ID / Secret。']),
    mode:guide(['“本级自配”使用当前平台或 OEM 的参数。','“借用”仅在上级已授权时可用；“停用”会阻止能力调用。','选择后保存，查看实际来源与状态。']),
    product_id:guide(['打开原市场产品管理，找到当前 GEO 能力对应产品。','核对应用为 aigc_geo，接口代码与当前能力一致。','复制本系统数字产品 ID，不填供应商产品名称。']),
    sku_id:guide(['打开上方产品的按次规格列表。','选择与当前能力一致且已设置销售价的 SKU。','复制本系统数字 SKU ID，确认该 SKU 属于所填产品。']),
    target:guide(['在 OEM 或代理管理中找到需要授权的目标账号。','复制目标数字 ID，不填名称或域名。','核对现有授权后按业务需要设置，保存授权将影响对方使用权限。'])
  };
  function lookup(service,key){
    if(['oss','ims','imm'].includes(service)&&['access_key_id','access_key_secret'].includes(key))return access;
    return fields[service]?.[key]||common[key];
  }
  let counter=0;
  function observe(container,getService){
    const seen=new WeakSet();let dialog=null;
    const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
    function show(help,title,trigger){
      dialog?.close();const d=el('dialog','ci-dialog ci-guide-dialog'),heading=el('h2','',title+' · 配置步骤'),list=el('ol','ci-guide-steps');
      heading.id='ci-guide-title-'+(++counter);d.setAttribute('aria-labelledby',heading.id);
      help.steps.forEach(step=>list.append(el('li','',step)));d.append(heading,list);
      if(help.url){const a=el('a','ci-guide-link',help.link);a.href=help.url;a.target='_blank';a.rel='noopener noreferrer';d.append(a);}
      const actions=el('div','ci-actions'),close=el('button','ci-button','知道了');close.type='button';close.addEventListener('click',()=>d.close());actions.append(close);d.append(actions);
      container.append(d);dialog=d;d.addEventListener('close',()=>{d.remove();if(dialog===d)dialog=null;if(trigger.isConnected)trigger.focus();},{once:true});d.showModal();
    }
    function scan(){
      for(const input of container.querySelectorAll('input,textarea,select')){
        if(seen.has(input)||!input.name||['checkbox','radio','hidden','button','submit'].includes(input.type))continue;
        const help=lookup(getService(),input.name);if(!help)continue;
        seen.add(input);
        let label=input.closest('label');
        if(!label){label=el('label','ci-field');const title=el('span','',input.getAttribute('aria-label')||input.name);input.before(label);label.append(title,input);}
        const title=label.querySelector('span')?.textContent||input.getAttribute('aria-label')||input.name;
        // Keep the original label/control relationship and all form names/order intact.
        const wrap=el('div','ci-help-field'),trigger=el('button','ci-help-trigger','配置步骤');
        label.before(wrap);wrap.append(label,trigger);trigger.type='button';trigger.setAttribute('aria-label',title.replace(/\s*\*$/,'')+'配置步骤');trigger.setAttribute('aria-haspopup','dialog');
        trigger.addEventListener('click',()=>show(help,title.replace(/\s*\*$/,''),trigger));
      }
    }
    const observer=new MutationObserver(scan);observer.observe(container,{childList:true,subtree:true});scan();
    return ()=>{observer.disconnect();dialog?.close();};
  }
  window.IntegrationGuides={lookup,observe};
})();
