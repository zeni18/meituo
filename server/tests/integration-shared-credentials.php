<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\clip\ClipIntegrationService as Service;
use app\common\service\merchant\clip\ClipCredentialVault as Vault;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Local database required');
$passed=0;
function checkShared(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo "PASS $label\n";}
function invalidShared(callable $fn,string $label):void{try{$fn();}catch(InvalidArgumentException){checkShared(true,$label);return;}throw new RuntimeException($label);}
$secret=['access_key_id'=>'fixture-access-id','access_key_secret'=>'fixture-secret'];
Db::startTrans();
try{
    // All changes are uncommitted and rolled back, including platform configuration.
    foreach([0,1] as $tenant)Db::name('oem_clip_integration')->where('tenant_id',$tenant)->delete();
    Service::saveAliyun(1,0,['revision'=>0,'secrets'=>$secret]);
    $row=Db::name('oem_clip_integration')->where(['tenant_id'=>1,'capability'=>'aliyun'])->find();
    checkShared(!str_contains($row['secret_cipher'],$secret['access_key_secret']),'shared credentials remain encrypted');
    checkShared(!str_contains(json_encode(Service::listing(1)),$secret['access_key_secret']),'default listing does not reveal credentials');
    checkShared(Service::listing(1,true)['aliyun']['secrets']===$secret,'authorized owner can read plain credentials');
    foreach(['oss'=>['region'=>'cn-shanghai','bucket'=>'fixture-bucket'],'ims'=>['region'=>'cn-shanghai','output_bucket'=>'fixture-bucket'],'imm'=>['region'=>'cn-shanghai','output_bucket'=>'fixture-bucket','project'=>'fixture']] as $code=>$settings){
        Service::save(1,0,['capability'=>$code,'revision'=>0,'enabled'=>true,'credential_mode'=>'shared','settings'=>$settings]);
        checkShared(Service::resolve(1,$code)['credentials']===$secret,"$code uses one shared pair");
        checkShared(Service::metadata(1,$code)['state']==='configured',"$code metadata includes shared credentials");
    }
    $next=['access_key_id'=>'fixture-next-id','access_key_secret'=>'fixture-next-secret'];
    Service::saveAliyun(1,0,['revision'=>1,'secrets'=>$next]);
    foreach(['oss','ims','imm'] as $code)checkShared(Service::resolve(1,$code)['credentials']===$next,"$code sees updated shared pair");
    checkShared(Service::resolve(1,'ims')['revision']===2,'shared rotation invalidates previously pinned cloud job config');
    invalidShared(fn()=>Service::saveAliyun(1,0,['revision'=>1,'secrets'=>$secret]),'stale common credential writes rejected');
    invalidShared(fn()=>Service::saveAliyun(1,0,['revision'=>2,'secrets'=>['access_key_id'=>'partial']]),'partial common pair rejected');
    invalidShared(fn()=>Service::saveAliyun(1,0,['revision'=>2,'secrets'=>$next,'unexpected'=>'x']),'unknown shared fields rejected');
    Service::save(1,0,['capability'=>'oss','revision'=>2,'enabled'=>true,'credential_mode'=>'own','settings'=>['region'=>'cn-shanghai','bucket'=>'fixture-bucket'],'secrets'=>$secret]);
    checkShared(Service::resolve(1,'oss')['credentials']===$secret,'independent pair remains supported');
    invalidShared(fn()=>Service::save(1,0,['capability'=>'oss','revision'=>3,'enabled'=>true,'credential_mode'=>'own','settings'=>['region'=>'cn-shanghai','bucket'=>'fixture-bucket'],'secrets'=>$secret,'clear_secrets'=>['access_key_secret']]),'clear wins over echoed plaintext');
    checkShared(Service::resolve(1,'oss')['credentials']===$secret,'failed clear is atomic');
    Service::save(1,0,['capability'=>'llm','revision'=>0,'enabled'=>false,'settings'=>[],'secrets'=>['api_key'=>'fixture-api-key']]);
    $listed=Service::listing(1,true);
    $llm=array_values(array_filter($listed['lists'],fn($r)=>$r['code']==='llm'))[0];
    checkShared($llm['secrets']['api_key']==='fixture-api-key','other own service credentials can be displayed');
    Service::saveAliyun(0,0,['revision'=>0,'secrets'=>['access_key_id'=>'platform-id','access_key_secret'=>'platform-secret']]);
    Service::save(0,0,['capability'=>'imm','revision'=>0,'enabled'=>true,'credential_mode'=>'shared','settings'=>['region'=>'cn-shanghai','project'=>'fixture','output_bucket'=>'fixture-bucket']]);
    Service::reset(1,0,['capability'=>'imm','revision'=>2,'restore'=>false]);
    $policy=Service::policy(1);Service::grant(1,true,0,$policy['revision']);
    checkShared(Service::resolve(1,'imm')['credentials']['access_key_secret']==='platform-secret','borrowed service resolves shared pair of its owner');
    checkShared(!str_contains(json_encode(Service::listing(1,true)),'platform-secret'),'borrowed platform credentials never returned to OEM');
    Service::grant(1,false,0,Service::policy(1)['revision']);
    invalidShared(fn()=>Service::resolve(1,'imm'),'revocation still blocks shared credential borrowing');
    checkShared(!str_contains(json_encode(Db::name('oem_clip_config_audit')->where('actor_id',0)->select()->toArray()),'fixture-secret'),'audit excludes credentials');
}finally{Db::rollback();}
echo "All $passed shared credential checks passed; changes rolled back; no cloud requests.\n";
