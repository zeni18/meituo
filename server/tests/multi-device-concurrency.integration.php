<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new AigcRuntimeApp(dirname(__DIR__)); $app->initialize();
use think\facade\Db;
use app\common\enum\AdminTerminalEnum as Source;
use app\common\cache\{UserTokenCache,AdminTokenCache,TenantAdminTokenCache};
if(!str_starts_with((string)config('database.connections.mysql.database'),'aigc_dev_'))throw new RuntimeException('Development database required');
function concurrentContext(string $kind,int $tenant):void {request()->tenantId=$kind==='platform'?0:$tenant;request()->source=['user'=>Source::USER,'tenant'=>Source::TENANT,'platform'=>Source::PLATFORM][$kind];}
function concurrentService(string $kind):string{return ['user'=>\app\api\service\UserTokenService::class,'tenant'=>\app\tenantapi\service\TenantTokenService::class,'platform'=>\app\platformapi\service\AdminTokenService::class][$kind];}
if(($argv[1]??'')==='worker') {
    [,,$kind,$tenant,$id,$multi]=$argv; concurrentContext($kind,(int)$tenant);$service=concurrentService($kind);
    $result=$kind==='user'?$service::setToken(\app\common\model\user\User::where('id',(int)$id)->find(),4):$service::setToken((int)$id,1,(int)$multi);
    echo json_encode(['issued'=>!empty($result['token']),'hash'=>isset($result['token'])?hash('sha256',$result['token']):null],JSON_THROW_ON_ERROR); exit;
}
$tenant=(int)Db::name('tenant')->whereNull('delete_time')->value('id');$seed='mdc_'.bin2hex(random_bytes(4));$fixtures=[];$checks=0;
$tables=['user','user_session','tenant_admin','tenant_admin_session','admin','admin_session'];$snapshot=static fn()=>array_map(static fn($t)=>Db::name($t)->count(),$tables);$before=$snapshot();
try {
    foreach(['user','tenant','platform']as $kind) {
        $table=['user'=>'user','tenant'=>'tenant_admin','platform'=>'admin'][$kind]; $session=$table.'_session';
        $cache=['user'=>UserTokenCache::class,'tenant'=>TenantAdminTokenCache::class,'platform'=>AdminTokenCache::class][$kind];
        foreach($kind==='user'?[1]:[1,0]as $multi) {
            $data=['account'=>$seed.$kind.$multi,'password'=>'fixture-only','create_time'=>time(),'update_time'=>time()];
            if($kind==='user')$data+=['tenant_id'=>$tenant,'sn'=>random_int(10000000,99999999),'nickname'=>'Concurrent session regression','channel'=>4];
            else {$data+=['name'=>'Concurrent session regression','root'=>1,'disable'=>0,'multipoint_login'=>$multi];if($kind==='tenant')$data['tenant_id']=$tenant;}
            $id=Db::name($table)->insertGetId($data);$fixtures[]=[$table,$session,$kind==='user'?'user_id':'admin_id',$id,$cache];$children=[];
            for($i=0;$i<5;$i++) {
                $process=proc_open([PHP_BINARY,__FILE__,'worker',$kind,(string)$tenant,(string)$id,(string)$multi],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,dirname(__DIR__));
                if(!is_resource($process))throw new RuntimeException('Worker could not start'); fclose($pipes[0]);$children[]=[$process,$pipes];
            }
            $hashes=[];$workerErrors=[];
            foreach($children as [$process,$pipes]) {
                $out=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$exit=proc_close($process);$json=json_decode($out,true);
                if($exit!==0 || !is_array($json)){$workerErrors[]=substr($out.$error,0,350);continue;}$checks++;
                if($multi===1 && !$json['issued'])throw new RuntimeException('Concurrent login did not return an independent session');
                if($json['hash'])$hashes[]=$json['hash'];
            }
            if($workerErrors)throw new RuntimeException('Concurrent worker failed: '.implode(' | ',$workerErrors));
            if($multi===1 && count(array_unique($hashes))!==5)throw new RuntimeException('Concurrent tokens were shared');$checks++;
            $active=Db::name($session)->where($kind==='user'?'user_id':'admin_id',$id)->where('expire_time','>',time())->count();
            if($active!==($multi===1?5:1))throw new RuntimeException('Concurrent session policy violated: '.$kind);$checks++;
        }
    }
}finally{
    foreach(array_reverse($fixtures)as [$table,$session,$idField,$id,$cacheClass]) {
        $cache=new $cacheClass();
        foreach(Db::name($session)->where($idField,$id)->column('token')as $token){if($table==='user')$cache->deleteUserInfo($token);else $cache->deleteAdminInfo($token);}
        Db::name($session)->where($idField,$id)->delete();Db::name($table)->where('id',$id)->whereLike('account',$seed.'%')->delete();
    }
}
if($snapshot()!==$before)throw new RuntimeException('Concurrent fixtures not fully removed');
echo json_encode(['passed'=>++$checks,'parallel_logins'=>25,'fixtures_removed'=>true],JSON_THROW_ON_ERROR).PHP_EOL;
