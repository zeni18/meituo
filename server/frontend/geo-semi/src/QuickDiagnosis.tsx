import {useEffect,useRef,useState} from 'react';
import {Banner,Button,Form,Modal,Space,Tag} from '@douyinfe/semi-ui';
import {IconBolt,IconEdit,IconArrowRight} from '@douyinfe/semi-icons';
import {api,popup,Row} from './api';
import {FieldNote,StateTag,useGeo} from './shared';
import {PlatformLabel} from './PlatformLogo';
import './quick-diagnosis.css';

const lines=(text:unknown)=>[...new Set(String(text||'').split(/\r?\n/).map(q=>q.trim()).filter(Boolean))];
export default function QuickDiagnosis({data,initialValues,busy,onPrepare}:{data:Row;initialValues?:Row;busy:boolean;onPrepare:(values:Row,preview:boolean)=>Promise<void>}){
 const {navigate}=useGeo(),form=useRef<any>(null),request=useRef<Row|null>(null),lock=useRef(false),replaceQuestions=useRef(!initialValues?.questions);
 const defaults={questions:'',surface:'网页端',platforms:['DeepSeek','豆包'],model_id:String(data.text.default_model_id||data.text.models[0]?.id||''),question_count:10,diagnosis_context:data.profile.industry||'',...initialValues};
 const [values,setValues]=useState<Row>(defaults),[showQuestions,setShowQuestions]=useState(!!defaults.questions),[confirmGeneration,setConfirmGeneration]=useState(false),[starting,setStarting]=useState(false),[jobId,setJobId]=useState<number|null>(null),[job,setJob]=useState<Row|null>(null),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[pollRound,setPollRound]=useState(0),[polling,setPolling]=useState(false);
 const storageKey='geo_diagnosis_questions_'+data.text.draft_scope;
 const store=(entry:Row)=>{request.current=entry;try{sessionStorage.setItem(storageKey,JSON.stringify(entry));}catch{}};
 const chosen=data.text.models.find((m:Row)=>String(m.id)===String(values.model_id));
 const price=chosen?`输入 ${chosen.input_price} / ${chosen.input_unit_size} Token，输出 ${chosen.output_price} / ${chosen.output_unit_size} Token（${data.text.point_unit}），按实际用量结算。`:'文本模型尚未开通，开通后显示计费标准。';
 const questions=lines(values.questions),calls=questions.length*(values.platforms?.length||0);
 const generating=starting||polling||!!job&&['queued','running'].includes(job.status),review=job?.status==='review';
 useEffect(()=>{try{const old=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(old?.payload?.purpose==='diagnosis'){request.current=old;if(Number(old.id)>0)setJobId(Number(old.id));else{setUncertain(true);for(const key of ['model_id','question_count','diagnosis_context'])form.current?.setValue(key,old.payload[key]);}}}catch{}},[storageKey]);
 useEffect(()=>{
  if(!jobId)return;let live=true,timer:ReturnType<typeof setTimeout>,attempt=0;setPolling(true);setError('');
  async function poll(){
   try{const result=await api('jobs',{id:jobId});if(!live)return;const current=result.lists[0];if(!current){setError('原拓词任务在当前品牌下不可见，请检查品牌或前往任务记录。');setPolling(false);return;}setJob(current);setError('');
    if(current.status==='success'){
     const rows=current.result?.questions;if(!Array.isArray(rows)||!rows.length)throw Error('原任务没有可用于诊断的问题，请在任务记录查看结果。');
     if(replaceQuestions.current){const text=rows.map((q:Row)=>q.question).join('\n');form.current?.setValue('questions',text);setValues(v=>({...v,questions:text}));replaceQuestions.current=false;}
     setShowQuestions(true);setPolling(false);return;
    }
    if(['failed','review'].includes(current.status)){setError(current.error||'生成未完成，请检查原任务和费用。');setPolling(false);return;}
   }catch(e){if(live)setError((e as Error).message+' 可继续查询原任务，不会自动重新生成。');}
   if(live&&++attempt<90)timer=setTimeout(poll,2000);else if(live){setPolling(false);setError('任务仍未确认完成，请稍后继续查询原任务。');}
  }
  poll();return()=>{live=false;clearTimeout(timer);};
 },[jobId,pollRound]);
 function openGeneration(){
  setError('');if(!String(data.profile.brand_name||'').trim()){setError('请先填写品牌名称。');return;}
  const current=form.current?.getValues()||values;
  if(!uncertain&&!String(current.diagnosis_context||'').trim()&&!['industry','intro','products','customers'].some(k=>String(data.profile[k]||'').trim())){setError('请填写行业或主营业务，AI才能生成相关问题。');return;}
  setConfirmGeneration(true);
 }
 async function generate(){
  if(lock.current)return;lock.current=true;setStarting(true);setError('');
  const current=form.current?.getValues()||values;
  const entry=uncertain&&request.current?request.current:{id:0,payload:{operation:'keywords',purpose:'diagnosis',subject:'品牌可见度诊断问题',question_count:Number(current.question_count),diagnosis_context:current.diagnosis_context||'',model_id:String(current.model_id),request_key:'diagnosis_questions_'+crypto.randomUUID()}};
  store(entry);replaceQuestions.current=true;
  try{const result=await api('generate',{},entry.payload);store({...entry,id:Number(result.id)});setUncertain(false);setJob(null);setJobId(Number(result.id));setPollRound(v=>v+1);setConfirmGeneration(false);}
  catch(e){setUncertain(true);setError((e as Error).message+'；重试将复用原请求编号。');}
  finally{lock.current=false;setStarting(false);}
 }
 async function prepare(preview:boolean){const current=form.current?.getValues()||values;await onPrepare(current,preview);}
 return <div className="gq-diagnosis">
  {!data.options.available&&<Banner type="warning" closeIcon={null} description="诊断服务尚未开通，请联系管理员配置监测服务。你可以先准备问题并保存范围。"/>}
  <div className="gq-brand"><div><small>当前诊断品牌</small><strong>{data.profile.brand_name||'尚未填写品牌名称'}</strong></div><Button theme="borderless" onClick={()=>navigate('brand')}>完善品牌资料</Button></div>
  <Form labelPosition="top" getFormApi={f=>{form.current=f;}} initValues={defaults} onValueChange={v=>setValues({...v,platforms:[...(v.platforms||[])]})} onSubmit={()=>prepare(true)}>
   <section className="gq-section" aria-label="准备诊断问题">
    <div className="gq-section-title"><span>1</span><div><h3>AI 帮你准备诊断问题</h3><p>读取企业知识，覆盖品牌认知、行业推荐和购买决策。</p></div></div>
    <Form.Input field="diagnosis_context" label="行业 / 主营业务" placeholder="例如：企业营销软件、工业设备、连锁餐饮；已有企业资料可不填" maxLength={2000} disabled={generating||uncertain}/>
    <div className="gq-generator-options"><Form.Select field="model_id" label="文本模型" getPopupContainer={popup} optionList={data.text.models.map((m:Row)=>({value:String(m.id),label:m.name}))} placeholder="待管理员开通" disabled={!data.text.text_available||generating||uncertain}/><Form.Select field="question_count" label="问题数量" getPopupContainer={popup} optionList={[5,10,15].map(value=>({value,label:`${value} 个问题`}))} disabled={generating||uncertain}/></div>
    <FieldNote>{price}</FieldNote>
    {!data.text.text_available&&<FieldNote>{data.text.text_notice}，也可自行填写问题继续准备。</FieldNote>}
    <Space wrap><Button theme="solid" icon={<IconBolt/>} loading={starting} disabled={!data.text.text_available||generating||review||!data.profile.brand_name} onClick={openGeneration}>{uncertain?'重试原拓词请求':job?.status==='success'?'换一批问题（再次计费）':'AI 生成诊断问题'}</Button><Button theme="borderless" icon={<IconEdit/>} onClick={()=>setShowQuestions(v=>!v)}>{showQuestions?'收起问题编辑':'自行填写 / 编辑问题'}</Button></Space>
    {job&&<div className="gq-task" role="status"><StateTag value={job.status}/><span>拓词任务 #{job.id}{job.status==='success'?` · 已生成 ${job.result.questions?.length||0} 个问题`:''}{job.user_points!==null?` · ${job.user_points} ${data.text.point_unit}`:''}</span><Button size="small" theme="borderless" onClick={()=>navigate('jobs')}>任务与费用</Button></div>}
    {polling&&<FieldNote>正在查询原拓词任务，关闭弹窗后可重新打开继续查看。</FieldNote>}
    {jobId&&!polling&&job?.status!=='success'&&<Button theme="borderless" onClick={()=>setPollRound(v=>v+1)}>继续查询原任务</Button>}
    {error&&<Banner type="warning" closeIcon={null} description={error}/>}
    <div hidden={!showQuestions} className="gq-questions"><Form.TextArea field="questions" label="诊断问题（每行一个，可直接修改）" rows={6} placeholder="AI 生成后会自动填入，也可以粘贴已有问题"/><FieldNote>当前 {questions.length} 个问题，最多30个，每个最多500字。修改问题不收费。</FieldNote></div>
   </section>
   <section className="gq-section" aria-label="选择检测平台">
    <div className="gq-section-title"><span>2</span><div><h3>选择检测平台</h3><p>先从常用平台开始，确认费用后提交。</p></div></div>
    <Form.Select field="surface" label="检测端" getPopupContainer={popup} optionList={[{value:'网页端',label:'网页端'},{value:'App端',label:'手机App端'}]} onChange={()=>form.current?.setValue('platforms',[])} disabled={busy}/>
    <Form.CheckboxGroup field="platforms" label="目标平台" options={(data.options.platforms_by_surface?.[values.surface]||data.options.platforms).map((name:string)=>({value:name,label:<PlatformLabel name={name}/>}))} disabled={busy}/>
   </section>
   <div className="gq-summary"><span><b>{questions.length}</b> 个问题 × <b>{values.platforms?.length||0}</b> 个平台 = <b>{calls}</b> 次采样</span>{data.options.available&&<Tag color="purple">预计 {Number(calls*data.options.price).toFixed(2)} {data.options.unit}</Tag>}</div>
   {calls>150&&<FieldNote>每轮最多150次采样，请减少问题或平台数量。</FieldNote>}
   <FieldNote>AI 拓展与平台采样分别计费。下一步只预览采样费用，确认后才提交；平台实际可用性和截图以供方返回为准。</FieldNote>
   <div className="gq-actions"><Button disabled={busy||!questions.length} onClick={()=>prepare(false)}>仅保存诊断范围</Button><Button htmlType="submit" theme="solid" loading={busy} disabled={!data.options.available||!questions.length||!values.platforms?.length||calls>150}>预览费用并诊断 <IconArrowRight/></Button></div>
  </Form>
  <Modal title={uncertain?'重试原拓词请求':'确认 AI 拓展费用'} visible={confirmGeneration} getPopupContainer={popup} width={560} maskClosable={!starting} confirmLoading={starting} okText={uncertain?'复用原请求重试':'确认生成（按用量计费）'} onOk={generate} onCancel={()=>{if(!starting)setConfirmGeneration(false);}}>
   <p>为「{data.profile.brand_name}」生成 {uncertain?request.current?.payload.question_count:values.question_count} 个诊断问题。</p><p>{uncertain?'沿用原请求的模型与参数，费用以原任务及消费单为准。':price}</p><FieldNote>这一步只生成问题，不提交平台诊断。生成后可修改；换一批会创建新的文本任务并再次计费。</FieldNote>{uncertain&&<FieldNote>将使用原请求内容和编号核对，不更换模型或自动创建第二个任务。</FieldNote>}
  </Modal>
 </div>;
}
