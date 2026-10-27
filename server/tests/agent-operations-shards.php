<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\AgentOperationsService as Ops;
use app\common\service\merchant\OemDirectoryService as Directory;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Isolated local database required');
$tag='shardqa_'.bin2hex(random_bytes(5));$tenant=0;$tables=[];$passed=0;$failure=null;
function shardCheck(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo "PASS $label\n";}
try{
 $tenant=(int)Db::name('tenant')->insertGetId(['name'=>$tag,'sn'=>$tag,'tactics'=>1,'disable'=>0,'create_time'=>time(),'update_time'=>time()]);
 foreach(['user','user_account_log'] as $base){$table='la_'.$base.'_'.$tag;Db::execute('CREATE TABLE `'.$table.'` LIKE `la_'.$base.'`');$tables[]=$table;}
 $agentId=Directory::saveAgent($tenant,['name'=>$tag,'account'=>$tag,'password'=>'ShardCheck2026!','level'=>1]);$actor=Db::name('oem_agent')->where('id',$agentId)->find();
 $merchant=Directory::saveMerchant($tenant,['name'=>$tag,'account'=>$tag,'password'=>'ShardCheck2026!','agent_id'=>$agentId]);$user=(int)Db::name('oem_merchant')->where('id',$merchant)->value('user_id');
 $original=Db::name('user')->where('id',$user)->value('user_money');
 Ops::allocate(null,$tenant,0,['target_agent_id'=>$agentId,'points'=>'20.00','request_key'=>bin2hex(random_bytes(16))]);
 Ops::recharge($actor,['merchant_id'=>$merchant,'points'=>'10.00','request_key'=>bin2hex(random_bytes(16))]);
 shardCheck((string)Db::name('user_'.$tag)->where('tenant_id',$tenant)->where('id',$user)->value('user_money')==='10.00','recharge credits the tenant-specific merchant account table');
 shardCheck(Db::name('user')->where('id',$user)->value('user_money')===$original,'same numeric user ID in the shared account table is untouched');
 shardCheck(Db::name('user_account_log_'.$tag)->where('tenant_id',$tenant)->where('user_id',$user)->count()===1,'merchant recharge log uses the tenant-specific ledger table');
 shardCheck(Db::name('user_account_log')->where('tenant_id',$tenant)->count()===0,'no ledger row is written into the wrong shared table');
 $ledger=Ops::ledger($actor,[]);shardCheck($ledger['count']===1&&(float)$ledger['summary']['increase']===10.0,'scoped ledger reads tenant-specific logs');
 $merchants=Ops::merchants($actor,[]);shardCheck($merchants['count']===1&&$merchants['lists'][0]['balance']==='10.00','business service reads the tenant-specific account balance');
 shardCheck(Ops::orders($actor,[])['count']===1,'sharded tenant operation appears in its own order records');
 shardCheck(Ops::overview($actor)['summary']['merchants']===1,'sharded tenant dashboard stays scoped');
}catch(\Throwable $e){$failure=$e;}finally{
 if($tenant){foreach(['oem_agent_wallet_log','oem_agent_wallet','oem_agent_operation','oem_agent_account','oem_agent_session','oem_merchant_app_access','oem_merchant','oem_agent','user_membership'] as $table)Db::name($table)->where('tenant_id',$tenant)->delete();Db::name('tenant')->where('id',$tenant)->where('sn',$tag)->delete();}
 foreach($tables as $table){if(!preg_match('/^la_(?:user|user_account_log)_shardqa_[a-f0-9]{10}$/D',$table))throw new RuntimeException('Unexpected owned test table');Db::execute('DROP TABLE `'.$table.'`');}
}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}echo "All $passed sharded-account checks passed; owned fixtures removed.\n";
