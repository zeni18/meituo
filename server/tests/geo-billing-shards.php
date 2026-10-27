<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\geo\{GeoApiBilling as Billing,GeoMarketCatalog};
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Dedicated local DB required');
$tag='geoshqa_'.bin2hex(random_bytes(5));$tables=[];$passed=0;$failure=null;$original=app()->request;$transaction=false;
function gs(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo 'PASS '.$label."\n";}
try{
 foreach(['user','user_account_log','tenant_point_log']as $base){$table='la_'.$base.'_'.$tag;Db::execute('CREATE TABLE `'.$table.'` LIKE `la_'.$base.'`');$tables[]=$table;}
 Db::startTrans();$transaction=true;$t=1;$user=Db::name('user')->where('tenant_id',$t)->whereNull('delete_time')->order('id')->find();if(!$user)throw new RuntimeException('Local account required');$u=(int)$user['id'];$sharedBalance=$user['user_money'];$user['user_money']='1000.00';Db::name('user_'.$tag)->insert($user);Db::name('tenant')->where('id',$t)->update(['sn'=>$tag,'tactics'=>1,'point_balance'=>1000]);
 $req=new \app\Request();$req->tenantId=$t;$req->userId=$u;app()->instance('request',$req); // Same unset source as a CLI worker.
 $id=(int)Db::name('oem_geo_job')->insertGetId(['tenant_id'=>$t,'user_id'=>$u,'request_key'=>$tag,'input_hash'=>str_repeat('a',64),'operation'=>'web_search','status'=>'running','payload_json'=>'{}','authority_json'=>'{}','result_json'=>'{}','create_time'=>time(),'update_time'=>time()]);$job=Db::name('oem_geo_job')->where('id',$id)->find();$identity=GeoMarketCatalog::identity();$billing=Billing::reserve($job,$identity+['tenant'=>1,'user'=>2]);Billing::finish($billing['consumption_id'],true);
 gs((float)Db::name('user_'.$tag)->where('id',$u)->value('user_money')===998.0,'GEO charges tenant-specific merchant balance');gs(Db::name('user')->where(['id'=>$u,'tenant_id'=>$t])->value('user_money')===$sharedBalance,'shared user with same numeric ID remains unchanged');
 gs(Db::name('user_account_log_'.$tag)->where(['tenant_id'=>$t,'user_id'=>$u])->count()===1,'native GEO ledger writes tenant-specific table');gs(Db::name('user_account_log')->where(['tenant_id'=>$t,'user_id'=>$u,'source_sn'=>'GEO'.$id.'-reserve'])->count()===0,'GEO does not write shard transaction into shared ledger');Billing::finish($billing['consumption_id'],true);gs((float)Db::name('user_'.$tag)->where('id',$u)->value('user_money')===998.0,'repeated settlement cannot charge shard twice');
}catch(Throwable $e){$failure=$e;}finally{app()->instance('request',$original);if($transaction)Db::rollback();foreach($tables as $table){if(!preg_match('/^la_(?:user|user_account_log|tenant_point_log)_geoshqa_[a-f0-9]{10}$/D',$table))throw new RuntimeException('Unexpected test table');Db::execute('DROP TABLE `'.$table.'`');}}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage().' @'.$failure->getFile().':'.$failure->getLine()."\n");exit(1);}echo 'All '.$passed." GEO shard billing checks passed; all owned data removed.\n";
