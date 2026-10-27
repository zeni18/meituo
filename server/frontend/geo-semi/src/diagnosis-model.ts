import type {Row} from './api';
export const diagnosticPlatforms=['豆包','DeepSeek','Kimi','腾讯元宝','通义千问'];
export const statusLabels:Record<string,string>={success:'已完成',running:'检测中',waiting:'尚未诊断',alert:'异常待处理'};
// Latest-batch progress is kept separate from cumulative evidence metrics.
export function diagnosisModel(metrics:Row[],run?:Row|null){
 const jobs:Row[]=run?.jobs||[];
 const names=[...new Set([...diagnosticPlatforms,...jobs.map(j=>j.platform||j.result?.platform),...metrics.map(p=>p.platform)].filter(Boolean))];
 const platforms:Row[]=names.map(platform=>{
  const cells=jobs.filter(j=>(j.platform||j.result?.platform)===platform),states=cells.map(j=>j.status);
  const success=states.filter(s=>s==='success').length;
  const failed=states.filter(s=>s==='failed'||s==='review').length;
  const active=states.some(s=>['running','submitting','polling'].includes(s));
  const status=failed?'alert':active?'running':cells.length&&success===cells.length?'success':success?'running':'waiting';
  return {...(metrics.find(p=>p.platform===platform)||{}),platform,status,expected:cells.length,success,failed,statusLabel:status==='waiting'&&cells.length?'排队中':statusLabels[status]};
 });
 const counts=Object.fromEntries(Object.keys(statusLabels).map(status=>[status,platforms.filter(p=>p.status===status).length]));
 return {platforms,counts,pending:jobs.some(j=>['queued','running','submitting','polling'].includes(j.status))};
}
