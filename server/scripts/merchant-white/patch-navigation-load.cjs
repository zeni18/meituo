/* Asserted migration for the retained Nuxt resource loader and consolidated clip entry. */
'use strict';
const assert=require('node:assert/strict');
const OLD_LOADER="dz=function(t,n,r){if(!n||n.length===0)return t();const a=document.getElementsByTagName(\"link\");return Promise.all(n.map(o=>{if(o=uz(o,r),o in Z2)return;Z2[o]=!0;const s=o.endsWith(\".css\"),i=s?'[rel=\"stylesheet\"]':\"\";if(!!r)for(let u=a.length-1;u>=0;u--){const h=a[u];if(h.href===o&&(!s||h.rel===\"stylesheet\"))return}else if(document.querySelector(`link[href=\"${o}\"]${i}`))return;const c=document.createElement(\"link\");if(c.rel=s?\"stylesheet\":cz,s||(c.as=\"script\",c.crossOrigin=\"\"),c.href=o,document.head.appendChild(c),s)return new Promise((u,h)=>{c.addEventListener(\"load\",u),c.addEventListener(\"error\",()=>h(new Error(`Unable to preload CSS for ${o}`)))})})).then(()=>t())}";
const NEXT_LOADER="/* merchant-css-preload-v3 */dz=function(load,deps,importer){\n  if(!deps||deps.length===0)return load();\n  return Promise.all(deps.map(asset=>{\n    const href=uz(asset,importer);\n    if(Object.prototype.hasOwnProperty.call(Z2,href))return Z2[href];\n    const css=/\\.css(?:[?#]|$)/.test(href);\n    const existing=Array.from(document.getElementsByTagName(\"link\")).find(link=>link.href===href&&(!css||link.rel===\"stylesheet\"));\n    if(!css){\n      if(!existing){const link=document.createElement(\"link\");link.rel=cz;link.as=\"script\";link.crossOrigin=\"\";link.href=href;document.head.appendChild(link);}\n      return Z2[href]=Promise.resolve();\n    }\n    if(existing&&existing.sheet)return Z2[href]=Promise.resolve();\n    let active;\n    const pending=new Promise((resolve,reject)=>{\n      function attempt(retry){\n        const link=document.createElement(\"link\");active=link;link.rel=\"stylesheet\";\n        link.href=retry?href+(href.includes(\"?\")?\"&\":\"?\")+\"mw_css_retry=1\":href;\n        link.addEventListener(\"load\",()=>{if(existing&&existing!==link)existing.remove();resolve();},{once:true});\n        link.addEventListener(\"error\",()=>{\n          if(active!==link)return;link.remove();\n          if(!retry)attempt(true);else reject(new Error(\"Unable to preload CSS for \"+href));\n        },{once:true});\n        document.head.appendChild(link);\n      }\n      attempt(false);\n    }).catch(error=>{if(Z2[href]===pending)delete Z2[href];throw error;});\n    Z2[href]=pending;return pending;\n  })).then(()=>load());\n}/* /merchant-css-preload-v3 */";
function replaceOne(source,before,after,label,checks){
  const count=s=>source.split(s).length-1;
  if(count(after)===1&&count(before)===0){checks.push(label+' already installed');return source;}
  assert.equal(count(before),1,label+': expected one known original');
  assert.equal(count(after),0,label+': no mixed patch');checks.push(label);return source.replace(before,after);
}
function patchNavigationLoad(source,name,checks){
  if(name==='entry.ef871ac3.js'){
    source=replaceOne(source,OLD_LOADER,NEXT_LOADER,'shared CSS waiting and bounded retry',checks);
    source=replaceOne(source,'{label:"AI短视频",path:"/ai/smart_clip"}','{label:"AI短视频",path:"/ai/video-editor"}','expert clip entry',checks);
    source=replaceOne(source,'["/ai/create","/ai/avatar","/ai/smart_clip","/ai/assets","/ai/short-drama"]','["/ai/create","/ai/avatar","/ai/smart_clip","/ai/video-editor","/ai/assets","/ai/short-drama"]','remember editor route',checks);
  }
  if(name==='useAiPcHomeDecorate.d01e3f4e.js'){
    const old=(source.match(/\/ai\/smart_clip/g)||[]).length,next=(source.match(/\/ai\/video-editor/g)||[]).length;
    assert.ok((old===4&&next===0)||(old===0&&next===4),'home clip entries: four consistent routes');
    if(old)source=source.replaceAll('/ai/smart_clip','/ai/video-editor');checks.push('home clip search, card and shortcuts consolidated');
  }
  return source;
}
module.exports={patchNavigationLoad};
