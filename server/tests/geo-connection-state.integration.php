<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\geo\GeoConnections as Connections;
use app\common\service\merchant\clip\ClipCredentialVault as Vault;

if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Local database required');
$passed=0;
function stateCheck(bool $ok,string $label):void
{
    global $passed;
    if(!$ok)throw new RuntimeException($label);
    $passed++;echo "PASS $label\n";
}
function stateRow(int $tenant,string $code,bool $reveal=false):array
{
    return array_column(Connections::listing($tenant,0,$reveal)['lists'],null,'code')[$code];
}
function stateSnapshot():string
{
    $data=[];
    foreach(['oem_geo_connection','oem_geo_grant','oem_geo_audit'] as $table)$data[$table]=Db::name($table)->order('id')->select()->toArray();
    return hash('sha256',json_encode($data,JSON_THROW_ON_ERROR));
}
$before=stateSnapshot();$failure=null;
Db::startTrans();
try{
    // Uncommitted fixture changes are invisible to workers and always rolled back.
    Db::name('oem_geo_connection')->whereIn('tenant_id',[0,1])->delete();
    Db::name('oem_geo_grant')->whereIn('tenant_id',[0,1])->delete();
    Connections::save(0,0,1,['capability'=>'web_search','mode'=>'own','revision'=>0,
        'settings'=>['product_id'=>4,'sku_id'=>4],'secrets'=>['api_key'=>'fixture-state-key']]);
    $row=stateRow(0,'web_search');
    stateCheck($row['state']==='配置齐全，待联调','saved platform configuration no longer says unconfigured');
    stateCheck($row['local_state']==='configured','platform exposes structured configured state');
    stateCheck(!str_contains(json_encode($row),'fixture-state-key'),'default listing hides credentials');
    stateCheck(stateRow(0,'web_search',true)['secret_values']['api_key']==='fixture-state-key','authorized own credential reveal retained');
    stateCheck(stateRow(0,'text')['local_state']==='missing','absent configuration is missing');
    stateCheck(stateRow(0,'keyword_index')['local_state']==='unavailable','unsupported capability is unavailable');
    stateCheck(stateRow(0,'owned_publish')['state']==='接口待确认，尚未接入','unsupported publishing is not presented as configured');
    Connections::save(1,0,1,['capability'=>'web_search','mode'=>'inherit','revision'=>0]);
    stateCheck(str_contains(stateRow(1,'web_search')['state'],'尚未获得平台'),'inheritance without grant remains unavailable');
    Connections::grant(0,1,['target_tenant_id'=>1,'capability'=>'web_search','revision'=>0,'allow_use'=>true]);
    $inherited=stateRow(1,'web_search',true);
    stateCheck($inherited['state']==='借用平台配置','authorized inheritance retains source label');
    stateCheck($inherited['secret_values']===[],'inherited platform credentials never returned');
    $where=['tenant_id'=>0,'agent_id'=>0,'capability'=>'web_search'];
    Db::name('oem_geo_connection')->where($where)->update(['settings_json'=>'{"product_id":"4","sku_id":""}']);
    stateCheck(stateRow(0,'web_search')['local_state']==='incomplete','missing SKU is incomplete');
    stateCheck(str_contains(stateRow(1,'web_search')['state'],'配置不完整'),'borrower cannot treat incomplete platform config as usable');
    Db::name('oem_geo_connection')->where($where)->update(['settings_json'=>'{"product_id":"4","sku_id":"4"}','secret_cipher'=>'']);
    stateCheck(stateRow(0,'web_search')['local_state']==='incomplete','missing provider key is incomplete');
    Db::name('oem_geo_connection')->where($where)->update(['secret_cipher'=>'invalid-cipher-fixture']);
    stateCheck(stateRow(0,'web_search')['local_state']==='unreadable','corrupt credential has explicit read failure');
    stateCheck(stateRow(1,'web_search')['state']==='配置无法读取，请联系配置管理员','borrowed corrupt credential does not break entire listing');
    Db::name('oem_geo_connection')->where($where)->update(['secret_cipher'=>Vault::seal(['api_key'=>'fixture-state-key'],0,'geo:0:web_search'),'settings_json'=>'{invalid']);
    stateCheck(stateRow(0,'web_search')['local_state']==='unreadable','malformed settings do not break platform listing');
    stateCheck(stateRow(1,'web_search')['state']==='配置无法读取，请联系配置管理员','malformed inherited settings do not break borrower listing');
    Db::name('oem_geo_connection')->where($where)->update(['mode'=>'off']);
    stateCheck(stateRow(0,'web_search')['state']==='已停用','disabled state takes precedence over stored invalid fields');
    Connections::save(0,0,1,['capability'=>'text','mode'=>'own','revision'=>0,'settings'=>['provider'=>'market','model_id'=>1]]);
    stateCheck(stateRow(0,'text')['local_state']==='configured','market text requires no direct provider key');
    Db::name('oem_geo_connection')->where(['tenant_id'=>0,'agent_id'=>0,'capability'=>'text'])->update(['settings_json'=>'{"provider":"deepseek","model_id":"1"}']);
    stateCheck(stateRow(0,'text')['local_state']==='incomplete','direct text requires its own provider key');
    Connections::save(1,0,1,['capability'=>'web_search','mode'=>'own','revision'=>1,
        'settings'=>['product_id'=>4,'sku_id'=>4],'secrets'=>['api_key'=>'fixture-tenant-key']]);
    stateCheck(stateRow(1,'web_search')['state']==='OEM自配','OEM own source remains unchanged');
    stateCheck(stateRow(1,'web_search')['local_state']==='configured','OEM gets same completeness assessment');
}catch(Throwable $e){$failure=$e;}finally{Db::rollback();}
stateCheck(stateSnapshot()===$before,'existing configurations grants and audit restored');
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}
echo "All $passed GEO configuration state checks passed; no external calls; database rolled back.\n";
