<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\{OemDirectoryService as Directory,MerchantGeoService as Geo};
use app\common\service\merchant\geo\{GeoCreationStudio as Studio,GeoArticleAgent as Agent,GeoJobs as Jobs,GeoWorkspace as Workspace,GeoConnections as C,GeoBrandScope as Scope,GeoTextRuntime as Runtime,DeepSeekText as Client,BochaSearch};
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Dedicated local DB required');
if(Db::name('oem_geo_job')->whereIn('status',['queued','running','submitting','polling'])->count())throw new RuntimeException('Pause idle workers first');
$prefix='cs'.bin2hex(random_bytes(5));$passed=0;$failure=null;$original=app()->request;
function cs(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo "PASS $label\n";}
function csReject(callable $fn,string $label):void{try{$fn();}catch(InvalidArgumentException){cs(true,$label);return;}throw new RuntimeException($label);}
Db::startTrans();try{
 $t=1;$identity=Runtime::install();$modelId=(string)$identity['model_id'];
 $mid=Directory::saveMerchant($t,['name'=>$prefix,'account'=>$prefix,'password'=>'StudioFixture2026!']);$u=(int)Db::name('oem_merchant')->where('id',$mid)->value('user_id');
 $other=Directory::saveMerchant($t,['name'=>$prefix.'b','account'=>$prefix.'b','password'=>'StudioFixture2026!']);$u2=(int)Db::name('oem_merchant')->where('id',$other)->value('user_id');
 $req=new \app\Request();$req->tenantId=$t;$req->userId=$u;$req->source=\app\common\enum\AdminTerminalEnum::USER;app()->instance('request',$req);
 Db::name('tenant')->where('id',$t)->update(['point_balance'=>10000]);Db::name('user')->where(['id'=>$u,'tenant_id'=>$t])->update(['user_money'=>10000]);
 Geo::profileSave($t,$u,['revision'=>0,'brand_name'=>'创作台样本品牌','industry'=>'企业软件','products'=>'门店内容管理工具']);
 $rev=(int)Db::name('oem_geo_connection')->where(['tenant_id'=>$t,'agent_id'=>0,'capability'=>'text'])->value('revision');C::save($t,0,1,['capability'=>'text','revision'=>$rev,'mode'=>'own','settings'=>['provider'=>'deepseek','model_id'=>$modelId],'secrets'=>['api_key'=>'offline-studio-fixture']]);
 foreach(['input'=>100,'output'=>200]as $kind=>$price)Db::name('power_market_sku')->where('id',$identity[$kind.'_sku_id'])->update(['sale_points'=>$price,'sale_status'=>1]);
 $material=Geo::save($t,$u,['kind'=>'materials','title'=>'已核实功能','content'=>'支持门店内容管理'])['id'];$foreign=Geo::save($t,$u2,['kind'=>'materials','title'=>'其他商家资料','content'=>'不得使用'])['id'];
 $category=Workspace::save($t,$u,['kind'=>'category','title'=>'选型资料'])['id'];$group=Workspace::save($t,$u,['kind'=>'keyword','title'=>'门店营销','enabled'=>true])['id'];$instruction=Workspace::save($t,$u,['kind'=>'instruction','title'=>'简明写作','content'=>'使用清晰短句'])['id'];
 $quote=Jobs::options($t,$u)['models'][0]['quote_token'];$p=['mode'=>'batch','subjects'=>['门店软件怎么选','门店软件应用场景','采购软件前要问什么'],'article_type'=>'选购指南','words'=>1000,'audience'=>'餐饮老板','tone'=>'专业简明','brand_level'=>'自然融入','requirements'=>'不编造销量','related_questions'=>['如何评估功能？','如何评估功能？'],'category_id'=>$category,'keyword_group_id'=>$group,'instruction_id'=>$instruction,'material_ids'=>[$material],'model_id'=>$modelId,'quote_token'=>$quote,'accept_charge'=>true,'request_key'=>$prefix.'_batch_0001'];
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['mode'=>'invalid'])),'unknown writing mode rejected');
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['subjects'=>[]])),'empty batch rejected');
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['subjects'=>['一','二','三','四']])),'batch is bounded by three tasks');
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['subjects'=>['重复','重复']])),'duplicate topics cannot generate duplicate paid articles');
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['article_type'=>'虚构资质'])),'article template must be declared');
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['words'=>100000])),'output size cannot be arbitrarily expanded');
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['material_ids'=>[$foreign]])),'facts remain merchant owned');
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['instruction_id'=>99999999])),'writing instruction remains merchant owned');
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['accept_charge'=>false])),'batch requires explicit cost confirmation');
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['mode'=>'replicate','subjects'=>['改写主题']])),'rewrite requires a real source text');
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['mode'=>'write'])),'single write cannot silently start a batch');
 cs(Db::name('oem_geo_job')->where('user_id',$u)->count()===0,'invalid input leaves no queue or consumption');
 $batch=Studio::generate($t,$u,$p);$ids=array_column($batch['jobs'],'id');cs(count($ids)===3&&array_column(Studio::generate($t,$u,$p)['jobs'],'id')===$ids,'whole batch replays the same durable jobs');
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['subjects'=>[$p['subjects'][0]]])),'accepted batch cannot silently change its topic count');
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['requirements'=>'更换要求'])),'changed settings under same request cannot duplicate charges');
 csReject(fn()=>Studio::generate($t,$u,array_replace($p,['request_key'=>$prefix.'_over_queue_001'])),'queue capacity is shared with existing GEO work');
 $posts=0;$captured=[];$client=new Client(function($method,$url,$body)use(&$posts,&$captured){$posts++;$input=json_decode($body['messages'][1]['content'],true);$captured[]=$input;cs($body['max_tokens']===4096&&$body['thinking']['type']==='disabled','studio output is bounded and uses official text transport');$out=($input['purpose']??'')==='studio_keywords'?['questions'=>[['question'=>'门店营销软件如何选择？','intent'=>'产品选型'],['question'=>'门店营销软件适合哪些业务场景？','intent'=>'场景需求']]]:['title'=>$input['subject'],'content'=>'## 实际功能\n\n支持门店内容管理。','outline'=>['实际功能','选择标准'],'checks'=>['价格和服务承诺待核实'],'summary'=>'已完成结构化稿件'];return ['status'=>200,'body'=>['id'=>'offline-studio-'.$posts,'model'=>'deepseek-flash','choices'=>[['finish_reason'=>'stop','message'=>['content'=>json_encode($out,JSON_UNESCAPED_UNICODE)]]],'usage'=>['prompt_tokens'=>1000,'completion_tokens'=>1000,'total_tokens'=>2000]]];});$worker=new Jobs(null,new BochaSearch(),$client);
 foreach($ids as $id){$worker->tick();$row=Jobs::records($t,$u,['id'=>$id])['lists'][0];cs($row['status']==='success'&&$row['billing_status']==='settled'&&abs((float)$row['user_points']-.3)<.00001,'each batch member settles its original consumption independently');}
 cs($posts===3&&!$worker->tick(),'batch performs exactly the confirmed three calls');
 $snapshot=$captured[0]['studio'];cs($snapshot['audience']==='餐饮老板'&&$snapshot['words']===1000&&$snapshot['article_type']==='选购指南'&&count($snapshot['related_questions'])===1,'writing settings and deduplicated related questions reach the prompt');
 cs($captured[0]['writing_instruction']==='使用清晰短句'&&$captured[0]['materials'][0]['content']==='支持门店内容管理','owned writing instruction and fact snapshot are passed to the model');
 $saved=Agent::save($t,$u,['job_id'=>$ids[0],'title'=>'确认标题','content'=>'确认正文']);$row=Workspace::records($t,$u,['kind'=>'articles','id'=>$saved['id']])['lists'][0];cs($row['metadata_json']['category_id']===$category&&$row['metadata_json']['keyword_group_id']===$group,'article import preserves classification and keyword grouping');
 cs(Workspace::records($t,$u2,['kind'=>'articles','id'=>$saved['id']])['count']===0&&Scope::with($t,$u,99999,fn()=>Workspace::records($t,$u,['kind'=>'articles','id'=>$saved['id']]))['count']===0,'precise library lookup keeps merchant and brand isolation');
 $revision=Agent::send($t,$u,['session_id'=>$ids[0],'expected_turn_id'=>$ids[0],'instruction'=>'保留手工事实，增加问答','draft'=>['title'=>'确认标题','content'=>'手工核实后的事实'],'model_id'=>$modelId,'quote_token'=>$quote,'accept_charge'=>true,'request_key'=>$prefix.'_revision_001']);$worker->tick();cs(end($captured)['studio']['category_id']===$category&&end($captured)['previous_article']['content']==='手工核实后的事实','AI edits retain studio settings and the current edited document');
 $kw=['subject'=>'门店营销软件','question_count'=>20,'model_id'=>$modelId,'quote_token'=>$quote,'accept_charge'=>true,'keyword_group_id'=>$group,'request_key'=>$prefix.'_keywords_001'];
 csReject(fn()=>Studio::keywords($t,$u,array_replace($kw,['question_count'=>100])),'keyword expansion count is bounded');csReject(fn()=>Studio::keywords($t,$u,array_replace($kw,['quote_token'=>str_repeat('0',64)])),'keyword expansion requires the confirmed current price');csReject(fn()=>Studio::keywords($t,$u,array_replace($kw,['accept_charge'=>'true'])),'keyword expansion rejects string consent');
 $keyword=Studio::keywords($t,$u,$kw);cs(Studio::keywords($t,$u,$kw)['id']===$keyword['id'],'keyword submission is idempotent');$worker->tick();$kr=Jobs::records($t,$u,['id'=>$keyword['id']])['lists'][0];cs(count($kr['result']['questions'])===2&&$kr['result']['questions'][1]['intent']==='场景需求','structured intent-labelled questions are exposed in the same workspace');
 csReject(fn()=>Studio::saveTopics($t,$u2,['topics'=>[['text'=>'门店营销软件如何选择？','source_job_id'=>$keyword['id']]]]),'selected topic import cannot borrow another merchant generation');
 csReject(fn()=>Studio::saveTopics($t,$u,['topics'=>[['text'=>'不是原结果中的问题','source_job_id'=>$keyword['id']]]]),'manual topic cannot claim invented AI provenance');
 $selected=Studio::saveTopics($t,$u,['topics'=>[['text'=>'门店营销软件如何选择？','source_job_id'=>$keyword['id']]],'keyword_group_id'=>$group]);cs(count($selected['ids'])===1&&Studio::saveTopics($t,$u,['topics'=>[['text'=>'门店营销软件如何选择？','source_job_id'=>$keyword['id']]]])['ids']===$selected['ids'],'selected generated topics preserve their source and deduplicate safely');
 Jobs::import($t,$u,$keyword['id']);$questions=Workspace::records($t,$u,['kind'=>'questions'])['lists'];cs(count($questions)===2&&$questions[0]['source']==='ai_generated'&&$questions[0]['metadata_json']['keyword_group_id']===$group,'explicit keyword import preserves source and group, without changing diagnosis ranges');
 cs(Db::name('oem_geo_monitor_run')->where('user_id',$u)->count()===0,'writing question expansion never starts monitoring');
 $queued=Studio::keywords($t,$u,array_replace($kw,['request_key'=>$prefix.'_price_001']));Db::name('power_market_sku')->where('id',$identity['input_sku_id'])->update(['sale_points'=>101]);$worker->tick();cs($posts===5&&Jobs::records($t,$u,['id'=>$queued['id']])['lists'][0]['billing_status']==='not_started','queued keyword price change stops before billing or provider call');
 Db::name('power_market_sku')->where('id',$identity['input_sku_id'])->update(['sale_points'=>100]);
 $block=[];foreach([1,2]as $n)$block[]=Jobs::enqueue($t,$u,['operation'=>'write','subject'=>'占位任务','model_id'=>$modelId,'request_key'=>$prefix.'_pending_000'.$n])['id'];$before=Db::name('oem_geo_job')->count();csReject(fn()=>Studio::generate($t,$u,array_replace($p,['subjects'=>['新选题一','新选题二'],'request_key'=>$prefix.'_atomic_001'])),'partial batch is rejected when remaining capacity is insufficient');cs(Db::name('oem_geo_job')->count()===$before,'batch failure rolls back earlier enqueued members atomically');
 cs(abs((float)Db::name('user')->where('id',$u)->value('user_money')-9998.5)<.00001,'only five accepted text operations charge the original wallet once');
}catch(Throwable $e){$failure=$e;}finally{app()->instance('request',$original);Db::rollback();}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage().' @'.$failure->getLine()."\n");exit(1);}echo "All $passed creation-studio checks passed; fixtures and native wallet changes rolled back, no external calls.\n";
