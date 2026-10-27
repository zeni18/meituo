<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\{OemDirectoryService as Directory,MerchantGeoService as Geo};
use app\common\service\merchant\geo\{GeoConnections as C,GeoJobs as Jobs,GeoWorkflow as Workflow,GeoBrandScope as Scope};
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Dedicated local DB required');
if(Db::name('oem_geo_job')->whereIn('status',['queued','running','submitting','polling'])->count())throw new RuntimeException('Real jobs must be idle; pause the GEO worker before testing');
$passed=0;$prefix='gq'.bin2hex(random_bytes(5));$original=app()->request;$failure=null;
function checkQuick(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo 'PASS '.$label."\n";}
function rejectQuick(callable $fn,string $label):void{try{$fn();}catch(InvalidArgumentException){checkQuick(true,$label);return;}throw new RuntimeException($label);}
Db::startTrans();try{
 $t=1;$mid=Directory::saveMerchant($t,['name'=>$prefix,'account'=>$prefix,'password'=>'QuickLocal2026!']);$u=(int)Db::name('oem_merchant')->where('id',$mid)->value('user_id');
 $other=Directory::saveMerchant($t,['name'=>$prefix.'b','account'=>$prefix.'b','password'=>'QuickLocal2026!']);$u2=(int)Db::name('oem_merchant')->where('id',$other)->value('user_id');
 $req=new \app\Request();$req->tenantId=$t;$req->userId=$u;$req->source=\app\common\enum\AdminTerminalEnum::USER;app()->instance('request',$req);
 $product=Db::name('power_market_product')->find()?:[];unset($product['id']);$model=(int)Db::name('power_market_product')->insertGetId(array_replace($product,['product_code'=>$prefix,'upstream_resource_key'=>$prefix,'resource_type'=>'model','model_type'=>'text','name'=>'Quick diagnosis fixture','upstream_model_code'=>'quick-fixture','upstream_channel_code'=>'offline-only','status'=>1,'source_payload'=>'{}']));
 $sku=Db::name('power_market_sku')->find()?:[];unset($sku['id']);Db::name('power_market_sku')->insert(array_replace($sku,['product_id'=>$model,'sku_key'=>$prefix,'status'=>1,'sale_status'=>1,'usage_unit'=>'token','usage_unit_size'=>1000,'sale_points'=>1,'source_payload'=>'{}','locked_params'=>'{}']));
 $rev=(int)Db::name('oem_geo_connection')->where(['tenant_id'=>$t,'agent_id'=>0,'capability'=>'text'])->value('revision');C::save($t,0,1,['capability'=>'text','revision'=>$rev,'mode'=>'own','settings'=>['model_id'=>(string)$model]]);
 $p=['operation'=>'keywords','purpose'=>'diagnosis','subject'=>'品牌可见度诊断问题','question_count'=>5,'diagnosis_context'=>'企业营销软件，帮助门店管理客户与内容','model_id'=>(string)$model,'request_key'=>$prefix.'_questions_0001'];
 rejectQuick(fn()=>Jobs::enqueue($t,$u,$p),'AI question generation requires a brand name');
 Geo::profileSave($t,$u,['revision'=>0,'brand_name'=>'诊断样本品牌']);
 rejectQuick(fn()=>Jobs::enqueue($t,$u,array_replace($p,['diagnosis_context'=>''])),'AI cannot invent business facts from only a brand name');
 rejectQuick(fn()=>Jobs::enqueue($t,$u,array_replace($p,['question_count'=>30])),'AI generation accepts only bounded question counts');
 rejectQuick(fn()=>Jobs::enqueue($t,$u,array_replace($p,['operation'=>'write'])),'diagnosis purpose cannot disguise an article task');
 rejectQuick(fn()=>Jobs::enqueue($t,$u,array_replace($p,['diagnosis_context'=>str_repeat('长',2001)])),'inline business facts use the existing field limit');
 $options=Jobs::options($t,$u);checkQuick($options['text_available']&&in_array((string)$model,array_map(fn($m)=>(string)$m['id'],$options['models']),true),'quick generation uses the existing configured text model catalog');
 checkQuick($options['draft_scope']!==Jobs::options($t,$u2)['draft_scope']&&$options['draft_scope']!==Scope::with($t,$u,987654,fn()=>Jobs::options($t,$u))['draft_scope'],'restoring a task is isolated by merchant and brand');
 $job=Jobs::enqueue($t,$u,$p);checkQuick(Jobs::enqueue($t,$u,$p)['id']===$job['id'],'uncertain submission replays the same paid text task');
 rejectQuick(fn()=>Jobs::enqueue($t,$u,array_replace($p,['question_count'=>10])),'accepted task cannot change its requested count');
 rejectQuick(fn()=>Jobs::enqueue($t,$u,array_replace($p,['diagnosis_context'=>'另一行业'])),'accepted task cannot change its business facts');
 $before=Geo::profile($t,$u);$calls=0;
 $worker=new Jobs(function($tt,$uu,$params,$event)use(&$calls,$t,$u){
  $calls++;$input=json_decode($params['content'],true);checkQuick($tt===$t&&$uu===$u&&request()->userId===$u,'worker retains the submitting merchant identity');
  checkQuick($input['question_count']===5&&$input['diagnosis_context']==='企业营销软件，帮助门店管理客户与内容'&&$input['profile']['brand_name']==='诊断样本品牌','model prompt freezes the brand, count and inline facts');
  checkQuick(str_contains($params['system_prompt'],'其余问题不得包含品牌名或别名')&&str_contains($params['system_prompt'],'不诱导AI必须推荐当前品牌'),'question expansion distinguishes brand recognition and natural discovery');
  checkQuick($params['action_code']==='geo_keywords'&&$params['source_app_code']==='aigc_geo'&&$params['business_table']==='oem_geo_job','generation uses the original text consumption attribution');
  checkQuick($params['_disable_model_fallback']&&$params['_disable_compatibility_retry']&&$params['_disable_transient_retry']&&$params['max_tokens']===2048,'a paid generation cannot silently retry or switch models');
  return ['content'=>json_encode(['questions'=>[['question'=>'诊断样本品牌提供什么服务？','intent'=>'品牌认知'],['question'=>'门店客户管理软件如何选择？','intent'=>'行业推荐'],['question'=>'门店客户管理软件如何选择？','intent'=>'产品选型'],['question'=>'营销软件采购需要比较哪些能力？','intent'=>'转化决策']]],JSON_UNESCAPED_UNICODE)];
 });$worker->tick();$row=Jobs::records($t,$u,['id'=>$job['id']])['lists'][0];
 checkQuick($calls===1&&$row['status']==='success'&&count($row['result']['questions'])===3,'structured generated questions are usable and deduplicated');
 checkQuick(!$worker->tick()&&$calls===1&&Jobs::enqueue($t,$u,$p)['id']===$job['id'],'reopening or retrying a finished task never regenerates questions');
 checkQuick(Geo::profile($t,$u)===$before,'question preparation does not overwrite enterprise knowledge');
 checkQuick(Jobs::records($t,$u2,['id'=>$job['id']])['count']===0&&Scope::with($t,$u,987654,fn()=>Jobs::records($t,$u,['id'=>$job['id']]))['count']===0,'generated results cannot be retrieved across merchant or brand');
 checkQuick(count(Jobs::diagnosisQuestions("```json\n{\"questions\":[{\"question\":\" 一个问题？ \"}]}\n```"))===1,'ordinary JSON code fences are supported');
 foreach(['plain article','{"questions":[]}','{"questions":[{"question":7}]}','{"questions":[{"question":""}]}',json_encode(['questions'=>array_fill(0,31,['question'=>'问题'])]),json_encode(['questions'=>[['question'=>str_repeat('长',501)]]])]as $i=>$bad)rejectQuick(fn()=>Jobs::diagnosisQuestions($bad),'malformed or excessive questions rejected '.$i);
 $bad=Jobs::enqueue($t,$u,array_replace($p,['request_key'=>$prefix.'_bad_output_001']));$badCalls=0;$badWorker=new Jobs(function()use(&$badCalls){$badCalls++;return ['content'=>'这是一篇文章，不是结构化的问题。'];});$badWorker->tick();$badRow=Jobs::records($t,$u,['id'=>$bad['id']])['lists'][0];
 checkQuick($badRow['status']==='failed'&&$badRow['result']['content']==='这是一篇文章，不是结构化的问题。','unusable output preserves evidence instead of fabricating questions');
 checkQuick(!$badWorker->tick()&&$badCalls===1,'bad output is never automatically sent for another paid generation');
 $range=Workflow::change($t,$u,['action'=>'create','request_key'=>$prefix.'_range_0001']);$config=['action'=>'configure','id'=>$range['id'],'revision'=>1,'questions'=>array_column($row['result']['questions'],'question'),'platforms'=>['DeepSeek','豆包'],'surface'=>'网页端','region'=>'全国','search_mode'=>'search','report_days'=>7];
 rejectQuick(fn()=>Workflow::change($t,$u,$config),'ordinary optimization setup retains complete enterprise fact requirements');
 rejectQuick(fn()=>Workflow::change($t,$u,$config+['diagnosis_only'=>'true']),'a string flag cannot bypass ordinary setup requirements');
 Workflow::change($t,$u,$config+['diagnosis_only'=>true]);$view=Workflow::view($t,$u,['id'=>$range['id']]);
 checkQuick($view['project']['state']==='diagnosis'&&$view['project']['config']['diagnosis_only']===true&&$view['project']['config']['profile']['brand_name']==='诊断样本品牌','quick diagnosis accepts brand plus prepared questions without all enterprise fields');
 checkQuick(count($view['cycles'])===1&&$view['cycles'][0]['state']==='open'&&count($view['samples'])===0,'saving a range prepares an empty cycle without pretending to sample');
 checkQuick(Db::name('oem_geo_monitor_run')->where(['tenant_id'=>$t,'user_id'=>$u])->count()===0&&Db::name('oem_geo_job')->where(['tenant_id'=>$t,'user_id'=>$u,'operation'=>'visibility'])->count()===0,'range preparation does not start or bill monitoring before explicit fee confirmation');
 rejectQuick(fn()=>Workflow::view($t,$u2,['id'=>$range['id']]),'saved quick ranges retain merchant ownership');
}catch(Throwable $e){$failure=$e;}finally{app()->instance('request',$original);Db::rollback();}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage().' @'.$failure->getLine()."\n");exit(1);}echo "All $passed quick-diagnosis checks passed; fixtures rolled back, no external requests.\n";
