export type Row=Record<string,any>;
export const tenant=()=>new URLSearchParams(location.search).get('tenant_id')||'';
export const brand=()=>new URLSearchParams(location.search).get('brand_id')||'';
export const href=(path:string)=>{const p=new URLSearchParams();if(tenant())p.set('tenant_id',tenant());if(brand()&&path==='/ai/geo')p.set('brand_id',brand());return path+(p.size?'?'+p:'');};
export async function api(action:string,params:Row={},body?:Row,controller='merchantGeo'){
 const query=new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined&&v!==null).map(([k,v])=>[k,String(v)]));if(tenant())query.set('tenant_id',tenant());if(!query.has('brand_id')&&brand()&&['merchantGeo','mediaPress'].includes(controller))query.set('brand_id',brand());
 const res=await fetch(`/api/${controller}/${action}?${query}`,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(!res.ok)throw Error('服务暂时不可用，请稍后重试');const result=await res.json();if(result.code!==1){if(result.code===-1)location.assign(href('/login'));throw Object.assign(Error(result.msg||'操作失败，请重试'),{apiResponse:true,responseCode:result.code});}return result.data;
}
export const date=(v:number)=>v?new Date(Number(v)*1000).toLocaleString('zh-CN'):'—';
export const labels:Row={knowledge_enhance:'企业知识强化',visibility:'自动可见度诊断',submitting:'提交中',polling:'采样中',queued:'排队中',running:'执行中',success:'已完成',review:'待核对',failed:'未完成',write:'文章写作',keywords:'AI拓词',rewrite:'文章改写',replicate:'爆文结构创作',web_search:'网页检索',not_started:'未产生消费',reserved:'已预扣',settled:'已结算',refunded:'已返还',pending_usage:'待核对用量',settlement_failed:'结算待核对'};
export const platforms=['DeepSeek','豆包','腾讯元宝','通义千问','文心一言','纳米AI','Kimi','智谱AI'];
export const popup=()=>document.getElementById('geo-semi-portals')!;
export function csv(name:string,headers:string[],rows:unknown[][]){const value=(v:unknown)=>{const s=String(v??'');return '"'+(/^[=+\-@\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';};const url=URL.createObjectURL(new Blob(['\uFEFF'+[headers,...rows].map(r=>r.map(value).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
