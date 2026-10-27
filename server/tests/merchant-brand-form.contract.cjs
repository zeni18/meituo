const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('public/merchant/brand-v2.js', 'utf8').replace('    UK.page({', '    window.testBrand = {imagePick, brandDialog, storeDialog, isUrl, normalizeWebsite: typeof normalizeWebsite === "function" ? normalizeWebsite : null};\n    UK.page({');
const requests = [], dialogs = [], notices = [];
let uploadResult = {code:1,data:{file:{id:41,url:'uploads/images/logo.png',uri:'https://ai.zoco2.com/uploads/images/logo.png'}}};
let saveResult = {code:1,data:{id:7}};
let choiceResult = {code:1,data:{lists:[]}}, detailResult, detailWait = null, choiceWait = null;
class Element {
  constructor(){this.listeners={};this.children={};this.inputs=[];this.nodes=[];this.isConnected=true;this.classList={add(){},remove(){}};}
  set innerHTML(html){this.html=html;this.inputs=[...html.matchAll(/<input\b([^>]*)>/g)].filter(m=>/name=/.test(m[1])).map(m=>({name:/name="([^"]+)"/.exec(m[1])[1],value:/value="([^"]*)"/.exec(m[1])?.[1]||'',listeners:{},setAttribute(){},addEventListener(type,fn){this.listeners[type]=fn;},focus(){}}));}
  get innerHTML(){return this.html;}
  querySelector(selector){if(selector==='.bs-err')return this.children[selector]||null;if(selector.startsWith('[name='))return this.inputs.find(i=>i.name===selector.slice(6,-1));return this.children[selector]||(this.children[selector]=new Element());}
  querySelectorAll(selector){return selector==='[name]'?this.inputs:[];}
  addEventListener(type,fn){this.listeners[type]=fn;}
  append(el){this.nodes.push(el);if(el.className==='bs-err')this.children['.bs-err']=el;}
  remove(){this.removed=true;this.isConnected=false;}
  setAttribute(){} scrollIntoView(){} focus(){}
}
const UK={esc:String,icon:()=>'',btn:({label,attrs})=>'<button '+Object.keys(attrs||{}).join(' ')+'>'+label+'</button>',tenant:()=>1,page(){},toast:(msg)=>notices.push(msg),dialog(options){const ctx={el:new Element(),body:options.body,busy(){},close(){this.el.isConnected=false;}};dialogs.push({options,ctx});return ctx;}};
const window={UK};
vm.runInNewContext(source,{window,document:{createElement:()=>new Element(),cookie:''},location:{origin:'https://ai.zoco2.com'},URL,URLSearchParams,FormData,File,console,
fetch:async(url,options)=>{requests.push({url,body:options.body});return{text:async()=>{if(url.includes('brandDetail')&&detailWait)await detailWait;if(url.includes('brandChoices')&&choiceWait)await choiceWait;return JSON.stringify(url.includes('storeLogo')?uploadResult:url.includes('brandChoices')?choiceResult:url.includes('brandDetail')?detailResult:saveResult);}};}});
(async()=>{
  const api=window.testBrand;
  for(const open of [()=>api.brandDialog({name:'号码回归品牌',mobile:'12312131231123112312121231212121'}),()=>api.storeDialog({name:'号码回归门店',mobile:'12312131231123112312121231212121',brand_id:1},[{id:1,name:'所属品牌'}],1)]){
    requests.length=0;open();const dialog=dialogs.at(-1);
    assert.equal(await dialog.options.onAction('ok',dialog.ctx),false);
    assert.equal(requests.length,0,'Invalid brand/store contact numbers cannot issue a save request');
    assert.match(dialog.ctx.body.querySelector('[data-phone-error]').textContent,/有效联系电话/);
  }
  assert.equal(typeof api.normalizeWebsite,'function','brand forms normalize loaded values on submission');
  for(const [input,expected]of [['ai.zoco.com','https://ai.zoco.com'],[' HTTPS://Example.com/path?a=1 ','https://Example.com/path?a=1'],['//example.com','https://example.com'],['','']])assert.equal(api.normalizeWebsite(input),expected);
  for(const input of ['https:// ai.zoco.com','https://\u200bai.zoco.com','https://ai.\u200bzoco.com','\u200b\u00a0https://ai.zoco.com\u2060','HTTPS : // \u200bai.zoco.com','//\u00a0ai.zoco.com'])assert.equal(api.normalizeWebsite(input),'https://ai.zoco.com','clean pasted URL without requiring a new input event');
  for(const value of ['javascript:alert(1)','https://user:password@example.com','https://bad host.com','ftp://example.com'])assert.throws(()=>api.normalizeWebsite(value));
  const box=new Element();const pick=api.imagePick(box,'logo','Logo',null,false);const el=box.querySelector('[data-pick="logo"]');
  await el.listeners.change({target:{files:[new File(['test'],'logo.png',{type:'image/png'})]}});
  assert.equal(pick.url,uploadResult.data.file.uri,'preview uses the absolute public media URI');assert.equal(pick.id,41);
  uploadResult={code:0,msg:'服务器暂时不可用'};
  await el.listeners.change({target:{files:[new File(['test'],'logo.png',{type:'image/png'})]}});
  assert.equal(pick.id,41,'failed replacement retains previous image');assert.equal(pick.busy,false);assert.ok(notices.includes('服务器暂时不可用'));
  requests.length=0;
  api.brandDialog({id:7,revision:3,name:'原品牌',industry:'软件',website:'ai.zoco.com'});
  const {options,ctx}=dialogs.at(-1);ctx.body.querySelector('[name=name]').value='更名后的品牌';
  await options.onAction('ok',ctx);
  assert.equal(requests.length,1,'basic and website details use a single atomic request');
  const payload=JSON.parse(requests[0].body);assert.equal(payload.name,'更名后的品牌');assert.equal(payload.website,'https://ai.zoco.com');assert.equal(payload.industry,'软件');
  requests.length=0;saveResult={code:0,msg:'已存在同名品牌'};
  api.brandDialog({name:'重名品牌',website:'https://\u200bai.zoco.com'});
  assert.equal(dialogs.at(-1).ctx.body.querySelector('[name=website]').value,'https://ai.zoco.com','prefilled URL is cleaned when the dialog opens');
  const retry=dialogs.at(-1);assert.equal(await retry.options.onAction('ok',retry.ctx),false);
  assert.equal(retry.ctx.body.querySelector('.bs-err').textContent,'已存在同名品牌');
  retry.ctx.body.querySelector('[name=name]').value='修改后的名称';saveResult={code:1,data:{id:8}};
  await retry.options.onAction('ok',retry.ctx);
  assert.equal(JSON.parse(requests.at(-1).body).website,'https://ai.zoco.com','duplicate-name retry accepts untouched prefilled website');
  assert.equal(retry.ctx.body.querySelector('.bs-err').textContent,'','successful retry clears previous validation message');
  retry.ctx.body.querySelector('[name=website]').value='https:// ai.zoco.com';
  retry.ctx.body.querySelector('[name=website]').listeners.blur();
  assert.equal(retry.ctx.body.querySelector('[name=website]').value,'https://ai.zoco.com','leaving the URL field displays the corrected address');
  retry.ctx.body.querySelector('[name=website]').value='https://\u200bai.zoco.com';
  await retry.options.onAction('ok',retry.ctx);
  assert.equal(JSON.parse(requests.at(-1).body).website,'https://ai.zoco.com','autofill without a blur/input event is cleaned at submission');
  requests.length=0;let recoveredId=0;
  saveResult={code:0,msg:'当前账号中已存在同名品牌'};
  choiceResult={code:1,data:{lists:[{id:19,name:'其他品牌'},{id:7,name:'已保存的品牌'}]}};
  detailResult={code:1,data:{brand:{id:7,revision:9,name:'已保存的品牌',contact:'旧联系人',email:'saved@example.com',address:'已有地址',logo:{id:31,url:'https://ai.zoco2.com/old.png'},cover:{id:52,url:'https://ai.zoco2.com/cover.png'}},profile:{industry:'旧行业',website:'https://old.example.com',intro:'真实企业事实'}}};
  api.brandDialog({name:'已保存的品牌',industry:'互联网',website:'ai.zoco.com',contact:'新联系人',logo:{id:41,url:'https://ai.zoco2.com/new.png'}},id=>{recoveredId=id;});
  const conflict=dialogs.at(-1);await conflict.options.onAction('ok',conflict.ctx);
  const notice=conflict.ctx.body.nodes.find(node=>node.className==='uk-notice'&&!node.removed);
  assert.ok(notice,'duplicate offers a way to continue the brand already in this account');
  assert.match(notice.innerHTML,/你的账号/);assert.match(notice.innerHTML,/继续完善/);
  assert.equal(requests.filter(r=>r.body).length,1,'conflict lookup does not overwrite or create another brand');
  await notice.querySelector('[data-continue-brand]').listeners.click();
  assert.equal(conflict.ctx.el.isConnected,false,'old create dialog is closed only after recovery data is ready');
  const resumed=dialogs.at(-1);assert.match(resumed.options.title,/继续完善/);
  assert.equal(resumed.ctx.body.querySelector('[name=industry]').value,'互联网');
  assert.equal(resumed.ctx.body.querySelector('[name=contact]').value,'新联系人');
  assert.equal(resumed.ctx.body.querySelector('[name=email]').value,'saved@example.com');
  assert.equal(resumed.ctx.body.querySelector('[name=website]').value,'https://ai.zoco.com');
  saveResult={code:1,data:{id:7}};await resumed.options.onAction('ok',resumed.ctx);
  const recoverySave=JSON.parse(requests.at(-1).body);
  assert.equal(recoverySave.id,7);assert.equal(recoverySave.revision,9);assert.equal(recoverySave.logo_file_id,41);assert.equal(recoverySave.cover_file_id,52);assert.equal(recoveredId,7);
  saveResult={code:0,msg:'当前账号中已存在同名品牌'};api.brandDialog({name:'已保存的品牌'});
  const changeName=dialogs.at(-1);await changeName.options.onAction('ok',changeName.ctx);
  const oldNotice=changeName.ctx.body.nodes.find(node=>node.className==='uk-notice'&&!node.removed);
  changeName.ctx.body.querySelector('[name=name]').value='另一个新品牌';changeName.ctx.body.querySelector('[name=name]').listeners.input();
  const countBefore=requests.length;await oldNotice.querySelector('[data-continue-brand]').listeners.click();
  assert.equal(requests.length,countBefore,'changing name cannot resume a different existing brand');assert.equal(oldNotice.removed,true);
  saveResult={code:1,data:{id:31}};await changeName.options.onAction('ok',changeName.ctx);assert.equal(JSON.parse(requests.at(-1).body).id,0,'a new unique name still creates a new brand');
  saveResult={code:0,msg:'当前账号中已存在同名品牌'};api.brandDialog({name:'已保存的品牌'});
  const closeWhileLoading=dialogs.at(-1);await closeWhileLoading.options.onAction('ok',closeWhileLoading.ctx);
  const closeNotice=closeWhileLoading.ctx.body.nodes.find(node=>node.className==='uk-notice'&&!node.removed);let releaseDetail;
  detailWait=new Promise(resolve=>{releaseDetail=resolve;});const opening=closeNotice.querySelector('[data-continue-brand]').listeners.click();
  const dialogCount=dialogs.length;closeWhileLoading.ctx.close();releaseDetail();await opening;detailWait=null;
  assert.equal(dialogs.length,dialogCount,'closing the dialog during recovery does not reopen it after the request');
  let releaseChoices;choiceWait=new Promise(resolve=>{releaseChoices=resolve;});api.brandDialog({name:'已保存的品牌'});
  const staleChoice=dialogs.at(-1);const lookingUp=staleChoice.options.onAction('ok',staleChoice.ctx);
  staleChoice.ctx.body.querySelector('[name=name]').value='新名称';staleChoice.ctx.body.querySelector('[name=name]').listeners.input();releaseChoices();await lookingUp;choiceWait=null;
  assert.equal(staleChoice.ctx.body.nodes.some(node=>node.className==='uk-notice'&&!node.removed),false,'late conflict response cannot warn about a name the user has already changed');
  console.log('PASS duplicate recovery uses the existing owned brand and preserves entered fields, existing details, and selected images');
  console.log('PASS URL normalization, untouched website on rename, single save, absolute image preview and failed replacement recovery');
})().catch(error=>{console.error(error);process.exitCode=1;});
