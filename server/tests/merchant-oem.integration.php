<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\OemDirectoryService as Directory;
use app\common\service\merchant\MerchantAccessService as Access;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Tests require the dedicated local database');
$passed=0;
function check(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo 'PASS '.$label."\n";}
function rejects(callable $action,string $label):void{try{$action();}catch(InvalidArgumentException){check(true,$label);return;}check(false,$label);}
$failure=null;Db::startTrans();
try{
 $tenant=(int)Db::name('tenant')->whereNull('delete_time')->value('id');$other=$tenant+900000;
 $first=Directory::saveAgent($tenant,['name'=>'测试一级代理','level'=>1,'account'=>'ag1_'.bin2hex(random_bytes(4)),'password'=>'TestLocal2026!']);
 $second=Directory::saveAgent($tenant,['name'=>'测试二级代理','level'=>2,'parent_id'=>$first,'account'=>'ag2_'.bin2hex(random_bytes(4)),'password'=>'TestLocal2026!']);
 check(Directory::list($tenant,'agent',['keyword'=>'测试'])['count']>=2,'agent hierarchy persists');
 check(Directory::list($other,'agent',[])['count']===0,'agent listing is scoped to OEM');
 rejects(fn()=>Directory::saveAgent($other,['id'=>$first,'name'=>'越权修改']),'cross-OEM agent update rejected');
 rejects(fn()=>Directory::saveAgent($tenant,['name'=>'错误级别','level'=>3]),'invalid agent level rejected');
 rejects(fn()=>Directory::saveAgent($tenant,['id'=>$first,'name'=>'循环关系','level'=>2,'parent_id'=>$second]),'cyclic or third-level hierarchy rejected');
 rejects(fn()=>Directory::saveAgent($other,['name'=>'越权下级','level'=>2,'parent_id'=>$first]),'cross-OEM parent rejected');
 $account='test_'.bin2hex(random_bytes(5));
 $merchant=Directory::saveMerchant($tenant,['name'=>'测试商家','account'=>$account,'password'=>'TestLocal2026!','agent_id'=>$second]);
 $record=Db::name('oem_merchant')->where('id',$merchant)->find();
 $owner=Db::name('user')->where('id',$record['user_id'])->find();
 check($owner['account']===$account&&$owner['user_money']=='0.00','merchant has a real zero-balance AI owner account');
 rejects(fn()=>Directory::saveMerchant($other,['id'=>$merchant,'name'=>'越权商家']),'cross-OEM merchant update rejected');
 rejects(fn()=>Directory::saveMerchant($other,['name'=>'跨OEM归属','account'=>'bad_'.bin2hex(random_bytes(4)),'password'=>'TestLocal2026!','agent_id'=>$first]),'cross-OEM merchant assignment rejected');
 $token=bin2hex(random_bytes(16));Db::name('user_session')->insert(['tenant_id'=>$tenant,'user_id'=>$owner['id'],'terminal'=>4,'token'=>$token,'expire_time'=>time()+3600]);
 check(Access::identity($token,$tenant)!==null,'valid merchant session accepted');
 check(Access::identity($token,$other)===null,'token cannot cross OEM boundary');
 Directory::saveMerchant($tenant,['id'=>$merchant,'name'=>'测试商家','agent_id'=>$second,'status'=>0]);
 check(Access::identity($token,$tenant)===null,'disable revokes existing merchant session');
 Directory::saveMerchant($tenant,['id'=>$merchant,'name'=>'测试商家','agent_id'=>$second,'status'=>1]);
 check(Access::identity($token,$tenant)===null,'reenabling does not revive revoked session');
 rejects(fn()=>Directory::saveMerchant($tenant,['name'=>'重复账号','account'=>$account,'password'=>'TestLocal2026!']),'duplicate login account rejected');
 rejects(fn()=>Directory::saveMerchant($tenant,['name'=>'弱密码','account'=>'bad_'.bin2hex(random_bytes(4)),'password'=>'12345678']),'weak initial password rejected');
}catch(\Throwable $error){$failure=$error;}finally{Db::rollback();}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}
echo 'All '.$passed." database integration checks passed; test writes rolled back.\n";
