<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\{MerchantMaterialService as Material,MerchantWorkbenchService as Workbench};
$expected=getenv('MERCHANT_AUDIT_TEST_DB');$port=getenv('MERCHANT_AUDIT_TEST_PORT');
if(!$expected||!preg_match('/^aigc_dev_[a-z_]+_[0-9]+$/D',$expected)||config('database.connections.mysql.database')!==$expected||(string)config('database.connections.mysql.hostport')!==$port||!in_array(config('database.connections.mysql.hostname'),['127.0.0.1','localhost'],true))throw new RuntimeException('Explicit isolated local development database required');
$passed=[];function check(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed[]=$label;}
function fixture(string $table,array $patch):int{$data=[];foreach(Db::name($table)->getFields() as $key=>$field){if(!empty($field['autoinc'])||!empty($field['primary']))continue;if(($field['default']??null)!==null||empty($field['notnull']))continue;$data[$key]=preg_match('/int|decimal|float|double/',(string)$field['type'])?0:'';}return (int)Db::name($table)->insertGetId(array_replace($data,$patch));}
 $originalRequest=app()->request;
Db::startTrans();try{
 $t=1;$u=(int)Db::name('oem_merchant')->where(['tenant_id'=>$t])->value('user_id');if(!$u)throw new RuntimeException('Local merchant required');
 $req=new \app\Request();$req->tenantId=$t;$req->userId=$u;$req->source=\app\common\enum\AdminTerminalEnum::USER;app()->instance('request',$req);
 $before=Material::counts($t,$u)['counts'];
 foreach([[$t,$u,0],[$t,$u,time()],[$t,$u+999999,0],[$t+999,$u,0]] as [$tenant,$owner,$trash])Db::name('oem_merchant_material')->insert(['tenant_id'=>$tenant,'user_id'=>$owner,'kind'=>'video','name'=>'事务内界面审计','file_ids'=>'[]','content'=>'','tags'=>'','delete_time'=>$trash,'create_time'=>time(),'update_time'=>time()]);
 $after=Material::counts($t,$u)['counts'];check($after['video']===$before['video']+1,'metadata count isolates owner tenant and trash');
 $meta=Material::metadata($t,$u,['kind'=>'video']);check($meta['counts']===$after,'metadata and count endpoint agree');
 check($meta['folders']['total']===$after['video'],'folder and tab totals agree');
 check($meta['trash_count']>=1,'trash badge uses a scoped count');check(!isset($meta['lists']),'metadata never loads material file rows');
 try{Material::metadata($t,$u,['kind'=>'bad']);throw new RuntimeException('invalid kind accepted');}catch(InvalidArgumentException){$passed[]='invalid material kind rejected';}
 $summary=Workbench::summary($t,$u);check(count($summary['task_lists'])===10,'single workbench read covers ten existing applications');
 check($summary['material_counts']===$after,'workbench shares authoritative counts');check($summary['unavailable']===[],'workbench reads all permitted local task tables');
 foreach($summary['task_lists'] as $entry)foreach($entry['lists'] as $row)check(!isset($row['provider_params_json'])&&!isset($row['user_mobile'])&&!isset($row['storage_engine']),'task snapshot omits provider and user internals');
 check(Workbench::summary($t,$u+999999)['material_counts']['video']===1,'separate owner receives only own material total');
 $task=fixture('aigc_image_task',['tenant_id'=>$t,'user_id'=>$u,'prompt'=>'audit-owned-image','status'=>'success','delete_time'=>0,'create_time'=>time(),'provider_params_json'=>'{}','reference_images'=>'[]']);
 $foreign=fixture('aigc_image_task',['tenant_id'=>$t,'user_id'=>$u+999999,'prompt'=>'audit-foreign-image','status'=>'success','delete_time'=>0,'create_time'=>time(),'provider_params_json'=>'{}','reference_images'=>'[]']);
 fixture('aigc_image_result',['tenant_id'=>$t,'user_id'=>$u,'task_id'=>$task,'image_uri'=>'https://example.com/audit.png','storage_engine'=>'','storage_scope'=>'','storage_domain'=>'','delete_time'=>0,'create_time'=>time()]);
 $read=Workbench::summary($t,$u);$images=$read['task_lists']['aigc_image']['lists'];
 check(in_array($task,array_column($images,'id')),'workbench includes a permitted owner task');
 check(!in_array('audit-foreign-image',array_column($images,'prompt')),'workbench excludes another merchant task');
 $image=array_values(array_filter($images,fn($row)=>(int)$row['id']===$task))[0];check($image['results'][0]['image_url']==='https://example.com/audit.png','workbench resolves stored results without provider polling');
 check(!isset($image['provider_params_json']),'nonempty task snapshot omits provider parameters');
 fixture('aigc_image_result',['tenant_id'=>$t,'user_id'=>$u+999999,'task_id'=>$foreign,'image_uri'=>'https://example.com/foreign.png','storage_engine'=>'','storage_scope'=>'','storage_domain'=>'','delete_time'=>0,'create_time'=>time()]);
 $fit=fixture('aigc_fitting_task',['tenant_id'=>$t,'user_id'=>$u,'status'=>'success','image_task_id'=>$task,'image_task_ids'=>json_encode([$task,$foreign]),'delete_time'=>0,'create_time'=>time()]);
 $next=Workbench::summary($t,$u);$fitting=array_values(array_filter($next['task_lists']['aigc_fitting']['lists'],fn($row)=>(int)$row['id']===$fit))[0];
 check(count($fitting['results'])===1,'fitting only reads mapped image tasks belonging to the current merchant');
 check($fitting['results'][0]['image_url']==='https://example.com/audit.png','fitting stored result uses the same delivery resolver');
 check($next['unavailable']===[],'nonempty fitting snapshot performs no query against a nonexistent result table');
 for($i=0;$i<40;$i++)fixture('aigc_image_task',['tenant_id'=>$t,'user_id'=>$u,'prompt'=>'audit-count-'.$i,'status'=>'success','delete_time'=>0,'create_time'=>time(),'provider_params_json'=>'{}','reference_images'=>'[]']);
 $full=Workbench::summary($t,$u);
 check(count($full['task_lists']['aigc_image']['lists'])===30,'recent task preview remains bounded');
 check(array_sum(array_column($full['task_daily'],'count'))===array_sum(array_column($summary['task_daily'],'count'))+42,'fourteen-day statistics include tasks beyond the thirty-row preview');
 $today=new DateTimeImmutable('today',new DateTimeZone('Asia/Shanghai'));check(count($full['task_daily'])===14&&$full['task_daily'][13]['date']===$today->format('Y-n-j'),'daily buckets use the complete Beijing calendar window');
 $month=$today->modify('first day of this month')->getTimestamp();
 foreach([[$u,$month+60,3.25,2,null],[$u,$month-60,99,2,null],[$u+999999,$month+60,77,2,null],[$u,$month+60,8,1,null],[$u,$month+60,10,2,time()]] as [$owner,$at,$amount,$action,$trash])fixture('user_account_log',['tenant_id'=>$t,'user_id'=>$owner,'sn'=>'audit'.bin2hex(random_bytes(8)),'change_type'=>102,'action'=>$action,'change_amount'=>$amount,'left_amount'=>0,'create_time'=>$at,'delete_time'=>$trash,'extra'=>'{}']);
 $money=Workbench::summary($t,$u)['consumption'];
 check(round($money['month']-$summary['consumption']['month'],2)===3.25,'monthly consumption excludes the prior month other owners income and deleted logs');
 check(round($money['total']-$summary['consumption']['total'],2)===102.25,'lifetime consumption sums the full eligible ledger');
}finally{Db::rollback();app()->instance('request',$originalRequest);}
echo json_encode(['passed'=>count($passed),'checks'=>$passed],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL;
