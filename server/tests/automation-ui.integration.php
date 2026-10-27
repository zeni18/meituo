<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\{AutomationService as A,OemDirectoryService as Directory,MerchantFilmService as Film};
use app\common\service\merchant\clip\MerchantClipService as Clip;
use app\common\service\merchant\clip\ClipIntegrationService;
use app\common\service\merchant\MerchantMaterialService;
$expected=getenv('AUTOMATION_UI_TEST_DB');$port=getenv('AUTOMATION_UI_TEST_PORT');
if(!$expected||!preg_match('/^aigc_dev_[a-z_]+_[0-9]+$/D',$expected)||config('database.connections.mysql.database')!==$expected||(string)config('database.connections.mysql.hostport')!==$port||!in_array(config('database.connections.mysql.hostname'),['127.0.0.1','localhost'],true))throw new RuntimeException('Explicit isolated local development database required');
$passed=[];$original=app()->request;$failure=null;$prefix='autoui'.bin2hex(random_bytes(5));
function check(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed[]=$label;}
function denied(callable $fn,string $label):void{try{$fn();}catch(InvalidArgumentException){check(true,$label);return;}check(false,$label);}
Db::startTrans();try{
 $t=1;$users=[];foreach(['a','b'] as $s){$m=Directory::saveMerchant($t,['name'=>$prefix.$s,'account'=>$prefix.$s,'password'=>'OnlyFixture2026!']);$users[]=(int)Db::name('oem_merchant')->where('id',$m)->value('user_id');}[$u,$other]=$users;
 $req=new \app\Request();$req->tenantId=$t;$req->userId=$u;$req->source=\app\common\enum\AdminTerminalEnum::USER;app()->instance('request',$req);
 $library=Film::saveLibrary($t,$u,['name'=>'自动化验收成片库'])['id'];$doc=Clip::save($t,$u,['kind'=>'project','name'=>'自动化验收工程','config'=>['mode'=>'mix']]);
 $body=['name'=>'暂停保存验收','kind'=>'video','source_id'=>$doc['id'],'library_id'=>$library,'threshold'=>3,'target'=>5,'batch'=>2,'interval_minutes'=>30,'max_runs'=>3,'valid_days'=>7,'request_key'=>$prefix.'_save_0001'];
 $first=A::save($t,$u,$body);$again=A::save($t,$u,$body);
 check($first['id']===$again['id']&&!empty($again['replayed']),'lost save response replays the same plan');
 check(Db::name('oem_automation_plan')->where(['tenant_id'=>$t,'user_id'=>$u])->count()===1,'idempotent save creates exactly one plan');
 denied(fn()=>A::save($t,$u,array_replace($body,['name'=>'其他内容'])),'same request key cannot authorize different content');
 denied(fn()=>A::save($t,$u,array_replace($body,['request_key'=>'bad'])),'malformed save identity rejected');
 denied(fn()=>A::preflight($t,$other,$first['id']),'preflight rejects foreign owner');
 denied(fn()=>A::records($t,$other,$first['id']),'execution records reject foreign owner');
 $beforeRuns=Db::name('oem_automation_run')->count();$beforeCloud=Db::name('oem_clip_cloud_job')->count();
 $pre=A::preflight($t,$u,$first['id']);
 check(!$pre['can_enable']&&in_array('content',array_column(array_filter($pre['checks'],fn($x)=>$x['state']==='fail'),'key')),'preflight refuses a snapshot with no visual material');
 check(Db::name('oem_automation_run')->count()===$beforeRuns&&Db::name('oem_clip_cloud_job')->count()===$beforeCloud,'preflight creates no execution or render jobs');
 $row=Db::name('oem_automation_plan')->find($first['id']);check($row['state']==='paused'&&(int)$row['runs']===0,'save and preflight leave the plan paused');
 $lists=A::listing($t,$u);$plan=$lists['lists'][0];check($plan['config']['library_name']==='自动化验收成片库','plan cards receive the real destination name');
 check(!isset($plan['config']['clip_config'])&&!isset($plan['config']['authority'])&&!isset($plan['config']['save_request']),'listing hides snapshots authority and save metadata');
 $edit=array_replace($body,['id'=>$first['id'],'revision'=>0,'request_key'=>$prefix.'_edit_stale']);denied(fn()=>A::save($t,$u,$edit),'stale revision cannot overwrite a saved plan');
 $month=(new DateTimeImmutable('first day of this month 00:00:00',new DateTimeZone('Asia/Shanghai')))->getTimestamp();
 foreach([$month-60,$month+60,time()] as $i=>$at)Db::name('oem_automation_run')->insert(['tenant_id'=>$t,'user_id'=>$u,'plan_id'=>$first['id'],'sequence_no'=>$i+1,'state'=>$i===2?'running':'success','stage'=>$i===2?'render':'done','budget_cents'=>0,'allocated_cents'=>0,'data_json'=>'{}','note'=>'事务内测试','create_time'=>$at,'finish_time'=>$i===2?0:$at+20]);
 Db::name('oem_automation_plan')->where('id',$first['id'])->update(['runs'=>3]);
 $lists=A::listing($t,$u);check((int)$lists['stats']['month_runs']===2,'monthly metric counts only actual rounds inside the business month');
 check(count($lists['lists'][0]['recent_runs'])===3&&$lists['lists'][0]['latest']['stage']==='render','cards receive ordered actual history and current stage');
 check(A::listing($t,$other)['lists']===[]&&(int)A::listing($t,$other)['stats']['month_runs']===0,'list and monthly metric remain isolated by owner');
 denied(fn()=>A::save($t,$u,array_replace($body,['id'=>$first['id'],'revision'=>1,'request_key'=>$prefix.'_edit_used_1'])),'in-flight plans cannot change execution scope');
 Db::name('oem_automation_run')->where('plan_id',$first['id'])->update(['state'=>'success','stage'=>'done']);
 check(!A::preflight($t,$u,$first['id'])['can_enable'],'completed authorization limit cannot be enabled again');
 Db::name('oem_automation_plan')->where('id',$first['id'])->update(['expires_at'=>time()-1]);
 $checks=A::preflight($t,$u,$first['id'])['checks'];check(array_values(array_filter($checks,fn($c)=>$c['key']==='expiry'))[0]['state']==='fail','expired authorization is explicitly identified');
 check(Db::name('oem_automation_plan')->where('id',$first['id'])->value('state')==='paused','read-only checks never activate a plan');
 foreach(['oss','ims'] as $cap){$old=Db::name('oem_clip_integration')->where(['tenant_id'=>$t,'capability'=>$cap])->find();ClipIntegrationService::save($t,0,['capability'=>$cap,'settings'=>$cap==='oss'?['region'=>'cn-shanghai','bucket'=>'fixture-bucket']:['region'=>'cn-shanghai','output_bucket'=>'fixture-bucket'],'secrets'=>['access_key_id'=>'fixture','access_key_secret'=>'fixture'],'enabled'=>true,'revision'=>(int)($old['revision']??0)]);}
 $uri='merchant/images/clip-empty-materials.png';check(is_file(root_path().'public/'.$uri),'positive preflight uses an existing local image only');
 $file=(int)Db::name('tenant_file')->insertGetId(['tenant_id'=>$t,'source'=>1,'source_id'=>$u,'type'=>10,'name'=>'fixture.png','uri'=>$uri,'storage_scope'=>'tenant','storage_engine'=>'local','storage_domain'=>'','create_time'=>time(),'update_time'=>time()]);
 $material=MerchantMaterialService::save($t,$u,['kind'=>'image','name'=>'事务内验收图片','file_ids'=>[$file]]);
 $doc=Clip::save($t,$u,['kind'=>'project','name'=>'有素材的验收工程','config'=>['mode'=>'mix','material_ids'=>[$material]]]);
 $ready=A::save($t,$u,array_replace($body,['source_id'=>$doc['id'],'request_key'=>$prefix.'_ready_0001']));
 Db::name('oem_automation_heartbeat')->where('id',1)->update(['beat_at'=>time()]);$pre=A::preflight($t,$u,$ready['id']);
 check($pre['can_enable']&&!array_filter($pre['checks'],fn($c)=>$c['state']==='fail'),'valid snapshot and configured services pass readiness without enabling');
 check(Db::name('oem_automation_plan')->where('id',$ready['id'])->value('state')==='paused'&&Db::name('oem_clip_cloud_job')->count()===$beforeCloud,'successful readiness check also creates no cloud tasks');
}catch(Throwable $e){$failure=$e;}finally{Db::rollback();app()->instance('request',$original);}
if($failure){fwrite(STDERR,$failure->getMessage()."\n".$failure->getTraceAsString()."\n");exit(1);}
echo json_encode(['passed'=>count($passed),'checks'=>$passed,'rolled_back'=>true,'external_calls'=>0],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE)."\n";
