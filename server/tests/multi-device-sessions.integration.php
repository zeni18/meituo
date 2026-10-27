<?php
declare(strict_types=1);
// Runs against the development database only. All account/session fixtures roll back.
require dirname(__DIR__).'/runtime-loader.php';
$app = new AigcRuntimeApp(dirname(__DIR__)); $app->initialize();
use think\facade\Db;
use app\common\enum\AdminTerminalEnum as Source;
use app\api\service\UserTokenService;
use app\common\model\user\User;
use app\common\cache\{UserTokenCache,AdminTokenCache,TenantAdminTokenCache};
use app\common\service\merchant\MerchantAccessService;
if (!str_starts_with((string)config('database.connections.mysql.database'),'aigc_dev_')) throw new RuntimeException('Development database required');
$tenant = (int)Db::name('tenant')->whereNull('delete_time')->value('id');
if (!$tenant) throw new RuntimeException('Development tenant required');
$checks = []; $tokens = []; $seed = 'md_'.bin2hex(random_bytes(5));
$tables = ['user','oem_merchant','user_session','admin','admin_session','tenant_admin','tenant_admin_session','tenant_sso_ticket'];
$snapshot = static fn()=>array_map(static fn($t)=>Db::name($t)->count(),$tables);
$before = $snapshot();
function checkSession(bool $ok,string $label):void { global $checks; if (!$ok) throw new RuntimeException($label); $checks[]=$label; }
function sessionContext(string $source,int $tenant,string $ip='192.0.2.10'):void {
    request()->source=$source; request()->tenantId=$tenant;
    // Simulate independent request addresses entirely in-process; no network requests.
    $property=new ReflectionProperty(\think\Request::class,'realIP'); $property->setAccessible(true); $property->setValue(request(),$ip);
}
Db::startTrans();
try {
    sessionContext(Source::USER,$tenant);
    $id=Db::name('user')->insertGetId(['tenant_id'=>$tenant,'sn'=>random_int(10000000,99999999),'account'=>$seed,'nickname'=>'Session regression','password'=>'fixture-only','channel'=>4,'create_time'=>time(),'update_time'=>time()]);
    Db::name('oem_merchant')->insert(['tenant_id'=>$tenant,'user_id'=>$id,'name'=>$seed,'status'=>1,'create_time'=>time(),'update_time'=>time()]);
    $user=User::where('id',$id)->find(); $cache=new UserTokenCache(); $users=[];
    for($i=0;$i<3;$i++){ $users[]=UserTokenService::setToken($user,4); $tokens[]=[$cache,$users[$i]['token']]; }
    checkSession(count(array_unique(array_column($users,'token')))===3,'merchant: three devices get independent tokens');
    foreach($users as $s) checkSession(MerchantAccessService::identity($s['token'],$tenant)!==null,'merchant: earlier device remains authenticated');
    checkSession(MerchantAccessService::identity($users[1]['token'],$tenant+900000)===null,'merchant: cross-tenant access denied');
    $cache->deleteUserInfo($users[1]['token']); checkSession(($cache->getUserInfo($users[1]['token'])['user_id']??0)===$id,'merchant: session survives cache rebuild');
    $secondExpiry=Db::name('user_session')->where('token',$users[1]['token'])->value('expire_time');
    checkSession(!empty(UserTokenService::overtimeToken($users[0]['token'])),'merchant: current device renews');
    checkSession(Db::name('user_session')->where('token',$users[1]['token'])->value('expire_time')===$secondExpiry,'merchant: renewal leaves other device unchanged');
    UserTokenService::expireToken($users[0]['token']);
    checkSession(!$cache->getUserInfo($users[0]['token']) && MerchantAccessService::identity($users[1]['token'],$tenant)!==null,'merchant: logout revokes only current device');
    checkSession(UserTokenService::overtimeToken($users[0]['token'])===false,'merchant: logged out session cannot be renewed');
    Db::name('user_session')->where('token',$users[2]['token'])->update(['expire_time'=>time()-1]); $cache->deleteUserInfo($users[2]['token']);
    checkSession(!$cache->getUserInfo($users[2]['token']) && UserTokenService::overtimeToken($users[2]['token'])===false,'merchant: expired session cannot be revived');
    Db::name('user')->where('id',$id)->update(['is_disable'=>1]);
    checkSession(MerchantAccessService::identity($users[1]['token'],$tenant)===null,'merchant: disabled account is rejected on every device');
    foreach(['tenant','platform'] as $kind) {
        $isTenant=$kind==='tenant'; $table=$isTenant?'tenant_admin':'admin'; $session=$table.'_session';
        $service=$isTenant?\app\tenantapi\service\TenantTokenService::class:\app\platformapi\service\AdminTokenService::class;
        $authClass=$isTenant?\app\tenantapi\http\middleware\AuthMiddleware::class:\app\platformapi\http\middleware\AuthMiddleware::class;
        $cache=$isTenant?new TenantAdminTokenCache():new AdminTokenCache();
        $source=$isTenant?Source::TENANT:Source::PLATFORM;
        sessionContext($source,$isTenant?$tenant:0);
        $fixture=['account'=>$seed.$kind,'name'=>'Session regression','password'=>'fixture-only','root'=>1,'disable'=>0,'multipoint_login'=>1,'create_time'=>time(),'update_time'=>time()];
        if($isTenant)$fixture['tenant_id']=$tenant;
        $adminId=Db::name($table)->insertGetId($fixture);
        $one=$service::setToken($adminId,1,1); $tokens[]=[$cache,$one['token']];
        sessionContext($source,$isTenant?$tenant:0,'192.0.2.20');
        $two=$service::setToken($adminId,1,1); $tokens[]=[$cache,$two['token']];
        checkSession($one['token']!==$two['token'] && !empty($cache->getAdminInfo($one['token'])),$kind.': second device preserves first token');
        checkSession($cache->getAdminInfo($one['token'])['login_ip']==='192.0.2.10' && $cache->getAdminInfo($two['token'])['login_ip']==='192.0.2.20',$kind.': device login addresses remain independent');
        request()->controllerObject=new class { public function isNotNeedLogin(){return false;} };
        request()->adminInfo=$cache->getAdminInfo($two['token']);
        checkSession((new $authClass())->handle(request(),static fn()=>true)===true,$kind.': second device passes existing IP check');
        sessionContext($source,$isTenant?$tenant:0,'192.0.2.10'); request()->adminInfo=$cache->getAdminInfo($one['token']);
        checkSession((new $authClass())->handle(request(),static fn()=>true)===true,$kind.': first device still passes existing IP check');
        sessionContext($source,$isTenant?$tenant:0,'192.0.2.99');
        $rejected=(new $authClass())->handle(request(),static fn()=>true);
        checkSession($rejected!==true && $rejected->getData()['code']===-1,$kind.': mismatched address remains rejected');
        sessionContext($source,$isTenant?$tenant:0,'192.0.2.10');
        $otherExpiry=Db::name($session)->where('token',$two['token'])->value('expire_time');
        checkSession(!empty($service::overtimeToken($one['token'])) && Db::name($session)->where('token',$two['token'])->value('expire_time')===$otherExpiry,$kind.': renewal is independent');
        $service::expireToken($one['token']);
        checkSession(!$cache->getAdminInfo($one['token']) && !empty($cache->getAdminInfo($two['token'])),$kind.': logout invalidates only current session');
        checkSession($service::overtimeToken($one['token'])===false,$kind.': logged out session cannot be renewed');
        Db::name($session)->where('token',$two['token'])->update(['expire_time'=>time()-1]); $cache->deleteAdminInfo($two['token']);
        checkSession($service::overtimeToken($two['token'])===false && !$cache->getAdminInfo($two['token']),$kind.': expired session cannot be revived');
        $three=$service::setToken($adminId,1,1); $tokens[]=[$cache,$three['token']];
        if ($isTenant) {
            $ssoTokens=[];
            for($j=0;$j<2;$j++) {
                sessionContext($source,$tenant,$j===0?'192.0.2.10':'192.0.2.20');
                $ticket=bin2hex(random_bytes(16));
                Db::name('tenant_sso_ticket')->insert(['ticket'=>$ticket,'tenant_id'=>$tenant,'tenant_admin_id'=>$adminId,'platform_admin_id'=>0,'expire_time'=>time()+60,'create_time'=>time(),'update_time'=>time()]);
                $sso=\app\common\service\tenant\TenantSsoService::consume($ticket,$tenant,1);$tokens[]=[$cache,$sso['token']];$ssoTokens[]=$sso['token'];
                checkSession($sso['token']!==$three['token'] && !empty($cache->getAdminInfo($three['token'])),'tenant SSO: platform entry preserves password-login device');
                $reused=false;try{\app\common\service\tenant\TenantSsoService::consume($ticket,$tenant,1);}catch(Exception $e){$reused=true;}
                checkSession($reused,'tenant SSO: ticket still works only once');
            }
            checkSession($ssoTokens[0]!==$ssoTokens[1] && $cache->getAdminInfo($ssoTokens[0])['login_ip']==='192.0.2.10' && $cache->getAdminInfo($ssoTokens[1])['login_ip']==='192.0.2.20','tenant SSO: independent device tokens and addresses');
            $service::expireToken($ssoTokens[0]);
            checkSession(!$cache->getAdminInfo($ssoTokens[0]) && !empty($cache->getAdminInfo($ssoTokens[1])),'tenant SSO: logout preserves another SSO device');
        }
        Db::name($table)->where('id',$adminId)->update(['multipoint_login'=>0]);
        $four=$service::setToken($adminId,1,0); $tokens[]=[$cache,$four['token']];
        checkSession(!$cache->getAdminInfo($three['token']) && !empty($cache->getAdminInfo($four['token'])),$kind.': explicit single-login policy still replaces earlier devices');
        Db::name($table)->where('id',$adminId)->update(['disable'=>1]);
        $failed=false;try{$service::setToken($adminId,1,1);}catch(RuntimeException $e){$failed=true;}
        checkSession($failed,$kind.': disabled administrator cannot create a session');
    }
} finally {
    Db::rollback();
    foreach($tokens as [$cache,$token]) {
        if($cache instanceof UserTokenCache)$cache->deleteUserInfo($token);else $cache->deleteAdminInfo($token);
    }
}
checkSession($snapshot()===$before,'all account/session fixtures rolled back');
echo json_encode(['passed'=>count($checks),'checks'=>$checks,'fixtures_rolled_back'=>true],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR).PHP_EOL;
