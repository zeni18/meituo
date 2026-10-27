<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\OemDirectoryService as Directory;
use app\common\service\merchant\AgentOperationsService as Ops;
use app\common\service\membership\MembershipService;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Isolated local database required');
if (($argv[1] ?? '')==='--credit-worker') {
 $input=json_decode(base64_decode($argv[2]),true,512,JSON_THROW_ON_ERROR);$actor=Db::name('oem_agent')->where(['tenant_id'=>1,'id'=>$input['agent_id']])->find();
 if(!$actor || !str_starts_with($actor['name'],'op_'))throw new RuntimeException('Owned test agent required');
 echo json_encode(Ops::recharge($actor,$input['payload']),JSON_THROW_ON_ERROR);exit;
}
$passed=0;$failure=null;$tenant=1;$agents=[];$merchants=[];$owners=[];$planId=0;$foreign=[];$foreignPlan=0;$staff=0;$staffToken=bin2hex(random_bytes(16));$prefix='op_'.bin2hex(random_bytes(4));$password='OpsCheck2026!';
function checkOps(bool $ok,string $message):void{global $passed;if(!$ok)throw new RuntimeException($message);$passed++;echo "PASS $message\n";}
function opsHttp(string $path,?array $body=null,string $token='',string $origin=''):array{
 $ch=curl_init('http://localhost:8090'.$path);$headers=['token: '.$token];if($origin!=='')$headers[]='Origin: '.$origin;
 if($body!==null){$headers[]='Content-Type: application/json';curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body)]);}
 curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>$headers,CURLOPT_TIMEOUT=>30]);$raw=curl_exec($ch);if($raw===false)throw new RuntimeException(curl_error($ch));curl_close($ch);
 $json=json_decode($raw,true);if(!is_array($json))throw new RuntimeException('Expected JSON for '.$path);return $json;
}
function getOps(string $action,string $token,array $params=[]):array{return opsHttp('/tenantapi/oem.operations/'.$action.($params?'?'.http_build_query($params):''),null,$token);}
function postOps(string $action,string $token,array $p):array{return opsHttp('/tenantapi/oem.operations/'.$action,$p,$token);}
function opKey():string{return bin2hex(random_bytes(16));}
function ownerBalance(int $user):string{return (string)Db::name('user')->where('tenant_id',1)->where('id',$user)->value('user_money');}
try{
 $rootToken=trim(file_get_contents(dirname(__DIR__).'/runtime/local/tenant-token.txt'));
 foreach(['a','b','c','d'] as $key){$agents[$key]=Directory::saveAgent($tenant,['name'=>$prefix.'代理'.$key,'account'=>$prefix.$key,'password'=>$password,'level'=>in_array($key,['c','d'])?2:1,'parent_id'=>$key==='c'?$agents['a']:($key==='d'?$agents['b']:0)]);}
 foreach(['a','b','c','d'] as $key){$id=Directory::saveMerchant($tenant,['name'=>$prefix.'商家'.$key,'account'=>$prefix.'m'.$key,'password'=>$password,'agent_id'=>$agents[$key]]);$merchants[$key]=$id;$owners[$key]=(int)Db::name('oem_merchant')->where('id',$id)->value('user_id');}
 $foreign['merchant']=Directory::saveMerchant(999991,['name'=>$prefix.'异OEM商家','account'=>$prefix.'foreign','password'=>$password]);$foreign['user']=(int)Db::name('oem_merchant')->where('id',$foreign['merchant'])->value('user_id');
 // Even corrupt/forged ownership cannot bypass the mandatory tenant constraint.
 Db::name('oem_merchant')->where('id',$foreign['merchant'])->update(['agent_id'=>$agents['a']]);
 $foreignPlan=(int)Db::name('membership_plan')->insertGetId(['tenant_id'=>999991,'name'=>$prefix.'异OEM套餐','status'=>1]);
 $plan=MembershipService::savePlan($tenant,['name'=>$prefix.'套餐','duration_months'=>1,'monthly_price'=>'29.90','monthly_bonus_points'=>'10.00','app_codes'=>['aigc_image'],'status'=>1]);$planId=(int)$plan['id'];
 $tokens=[];foreach(['a','b','c','d'] as $key){$login=opsHttp('/tenantapi/login/account',['account'=>$prefix.$key,'password'=>$password,'terminal'=>1]);checkOps($login['code']===1,'shared login works for '.$key);$tokens[$key]=$login['data']['token'];}
 foreach(['overview','catalog','merchants','ledger','orders','walletLogs'] as $action)checkOps(getOps($action,'')['code']!==1,'guest cannot read '.$action);
 foreach(['recharge','assignPlan','authorizeApps'] as $action)checkOps(postOps($action,'',['request_key'=>opKey()])['code']!==1,'guest cannot write '.$action);
 foreach(['a','c'] as $key){$profile=opsHttp('/tenantapi/auth.admin/mySelf',null,$tokens[$key]);$paths=array_column($profile['data']['menu'],'paths');checkOps(in_array('agent-workbench',$paths,true)&&in_array('agent-services',$paths,true)&&in_array('agent-power',$paths,true)&&in_array('agent-orders',$paths,true),'business menus granted to '.$key);checkOps(in_array('oem',$paths,true)===($key==='a'),'child management menu remains first-level only');}
 checkOps(getOps('overview',$rootToken)['code']!==1,'native OEM token cannot enter agent-only business dispatch');
 foreach(['recharge'=>['points'=>'1'],'assignPlan'=>['plan_id'=>$planId],'authorizeApps'=>['app_codes'=>[]]] as $action=>$params)checkOps(postOps($action,$tokens['a'],$params+['merchant_id'=>$foreign['merchant'],'request_key'=>opKey()])['code']!==1,'cross-OEM merchant mutation rejected: '.$action);
 checkOps(postOps('assignPlan',$tokens['a'],['merchant_id'=>$merchants['a'],'plan_id'=>$foreignPlan,'request_key'=>opKey()])['code']!==1,'cross-OEM plan ID rejected');
 checkOps(!in_array($foreignPlan,array_column(getOps('catalog',$tokens['a'])['data']['plans'],'id')),'catalog does not expose another OEM package');
 $view=getOps('overview',$tokens['a']);checkOps($view['code']===1&&$view['data']['summary']['merchants']===2,'first-level dashboard includes self and child merchants only');
 $view=getOps('overview',$tokens['c']);checkOps($view['code']===1&&$view['data']['summary']['merchants']===1,'second-level dashboard includes only its own merchant');
 foreach(['a'=>2,'c'=>1] as $key=>$count){$view=getOps('merchants',$tokens[$key]);checkOps($view['code']===1&&$view['data']['count']===$count,'service merchant list respects scope: '.$key);checkOps(!str_contains(json_encode($view),'password_hash'),'catalog and merchant list expose no credentials');}
 $view=getOps('merchants',$tokens['a'],['merchant_id'=>$merchants['b']]);checkOps($view['data']['count']===0,'forged merchant filter returns no foreign data');
 $view=getOps('merchants',$tokens['c'],['agent_id'=>$agents['a']]);checkOps($view['data']['count']===0,'child cannot filter into parent merchant data');
 foreach(['recharge'=>['points'=>'1.00'],'assignPlan'=>['plan_id'=>$planId],'authorizeApps'=>['app_codes'=>[]]] as $action=>$p){foreach([['a','b'],['c','a'],['b','c']] as [$actor,$merchant])checkOps(postOps($action,$tokens[$actor],$p+['merchant_id'=>$merchants[$merchant],'request_key'=>opKey()])['code']!==1,'foreign merchant write rejected: '.$action.' '.$actor.'->'.$merchant);}
 $p=['target_agent_id'=>$agents['a'],'points'=>'1000.00','request_key'=>opKey(),'note'=>'专用测试授额'];
 $grant=opsHttp('/tenantapi/oem.directory/grantQuota',$p,$rootToken);checkOps($grant['code']===1,'OEM root can grant auditable retail allocation quota');
 $staff=(int)Db::name('tenant_admin')->insertGetId(['tenant_id'=>$tenant,'root'=>0,'name'=>$prefix.'员工','account'=>$prefix.'staff','password'=>md5(random_bytes(16)),'login_ip'=>'127.0.0.1','create_time'=>time()]);Db::name('tenant_admin_session')->insert(['admin_id'=>$staff,'terminal'=>1,'token'=>$staffToken,'expire_time'=>time()+3600]);
 checkOps(opsHttp('/tenantapi/oem.directory/grantQuota',['target_agent_id'=>$agents['a'],'points'=>'999','request_key'=>opKey()],$staffToken)['code']!==1,'unprivileged OEM staff cannot mint agent allocation quota');
 checkOps(Ops::balance($tenant,$agents['a'])==='1000.00','OEM quota grant reaches the correct agent');
 checkOps(opsHttp('/tenantapi/oem.directory/grantQuota',$p,$rootToken)['data']['replayed']===true&&Ops::balance($tenant,$agents['a'])==='1000.00','OEM retry does not duplicate quota');
 checkOps(opsHttp('/tenantapi/oem.directory/grantQuota',$p,$tokens['c'])['code']!==1,'second-level agent cannot issue quota');
 checkOps(opsHttp('/tenantapi/oem.directory/grantQuota',['target_agent_id'=>$agents['b'],'points'=>'1.00','request_key'=>opKey()],$tokens['a'])['code']!==1,'first-level cannot allocate quota to another first-level agent');
 checkOps(opsHttp('/tenantapi/oem.directory/grantQuota',['target_agent_id'=>$agents['d'],'points'=>'1.00','request_key'=>opKey()],$tokens['a'])['code']!==1,'first-level cannot allocate quota to another parent child');
 $allocation=['target_agent_id'=>$agents['c'],'points'=>'200.00','request_key'=>opKey()];
 checkOps(opsHttp('/tenantapi/oem.directory/grantQuota',$allocation,$tokens['a'])['code']===1,'first-level can allocate quota to its own child');
 checkOps(Ops::balance($tenant,$agents['a'])==='800.00'&&Ops::balance($tenant,$agents['c'])==='200.00','parent-child quota transfer conserves total');
 checkOps(opsHttp('/tenantapi/oem.directory/grantQuota',$allocation,$tokens['a'])['data']['replayed']===true&&Ops::balance($tenant,$agents['c'])==='200.00','allocation retry conserves quota');
 foreach(['0','-1','NaN','1.001','1e2','10000000','0.00'] as $bad)checkOps(postOps('recharge',$tokens['a'],['merchant_id'=>$merchants['a'],'points'=>$bad,'request_key'=>opKey()])['code']!==1,'invalid credit amount rejected: '.$bad);
 foreach([true,[]] as $bad)checkOps(postOps('recharge',$tokens['a'],['merchant_id'=>$merchants['a'],'points'=>$bad,'request_key'=>opKey()])['code']!==1,'non-numeric JSON amount rejected cleanly');
 $p=['merchant_id'=>$merchants['a'],'points'=>'5.00','amount'=>'12.00','request_key'=>opKey()];$r=postOps('recharge',$tokens['a'],$p);checkOps($r['code']===1,'agent can recharge its direct merchant');
 checkOps(ownerBalance($owners['a'])==='5.00'&&Ops::balance($tenant,$agents['a'])==='795.00','recharge atomically decreases quota and increases real merchant balance');
 checkOps(postOps('recharge',$tokens['a'],$p)['data']['replayed']===true&&ownerBalance($owners['a'])==='5.00','same recharge request cannot credit twice');
 checkOps(postOps('recharge',$tokens['a'],array_merge($p,['points'=>'6.00']))['code']!==1,'same request key cannot be reused for a different amount');
 checkOps(postOps('recharge',$tokens['a'],['merchant_id'=>$merchants['c'],'points'=>'2.00','request_key'=>opKey()])['code']===1,'parent can recharge its child merchant');
 checkOps(postOps('recharge',$tokens['c'],['merchant_id'=>$merchants['c'],'points'=>'3.00','request_key'=>opKey()])['code']===1,'child can recharge its own merchant');
 checkOps(ownerBalance($owners['c'])==='5.00'&&Ops::balance($tenant,$agents['c'])==='197.00','child uses its own allocation quota');
 $beforeOps=Db::name('oem_agent_operation')->where('actor_agent_id',$agents['a'])->count();$beforeQuota=Ops::balance($tenant,$agents['a']);
 checkOps(postOps('recharge',$tokens['a'],['merchant_id'=>$merchants['a'],'points'=>'9999.00','request_key'=>opKey()])['code']!==1,'insufficient allocation quota rejects recharge');
 checkOps(ownerBalance($owners['a'])==='5.00'&&Ops::balance($tenant,$agents['a'])===$beforeQuota&&Db::name('oem_agent_operation')->where('actor_agent_id',$agents['a'])->count()===$beforeOps,'insufficient quota fully rolls back balance, operation and logs');
 $p=['merchant_id'=>$merchants['c'],'plan_id'=>$planId,'mode'=>'open','request_key'=>opKey()];$r=postOps('assignPlan',$tokens['a'],$p);checkOps($r['code']===1,'parent opens an OEM-published package for its child merchant');$expires=(int)$r['data']['result']['expire_time'];
 $member=Db::name('user_membership')->where(['tenant_id'=>$tenant,'user_id'=>$owners['c']])->find();checkOps((int)$member['plan_id']===$planId&&in_array('aigc_image',json_decode($member['app_codes'],true),true),'package writes actual membership and app entitlements');
 checkOps(ownerBalance($owners['c'])==='15.00'&&Ops::balance($tenant,$agents['a'])==='783.00','package bonus is funded by the acting agent quota');
 checkOps(postOps('assignPlan',$tokens['a'],$p)['data']['replayed']===true&&(int)Db::name('user_membership')->where('id',$member['id'])->value('expire_time')===$expires&&ownerBalance($owners['c'])==='15.00','package retry cannot repeat bonus or extend expiry');
 $r=postOps('assignPlan',$tokens['a'],['merchant_id'=>$merchants['c'],'plan_id'=>$planId,'mode'=>'renew','request_key'=>opKey()]);checkOps($r['code']===1&&(int)$r['data']['result']['expire_time']>$expires,'renewal extends the same plan from its expiry');
 checkOps(ownerBalance($owners['c'])==='25.00'&&Ops::balance($tenant,$agents['a'])==='773.00','renewal bonus is deducted exactly once');
 checkOps(postOps('assignPlan',$tokens['b'],['merchant_id'=>$merchants['b'],'plan_id'=>$planId,'mode'=>'open','request_key'=>opKey()])['code']!==1&&ownerBalance($owners['b'])==='0.00','unfunded package bonus rolls back membership changes');
 checkOps(postOps('assignPlan',$tokens['a'],['merchant_id'=>$merchants['a'],'plan_id'=>99999999,'request_key'=>opKey()])['code']!==1,'unknown or foreign package rejected');
 checkOps(postOps('assignPlan',$tokens['a'],['merchant_id'=>$merchants['a'],'plan_id'=>$planId,'mode'=>'renew','request_key'=>opKey()])['code']!==1,'renewal cannot silently switch packages');
 Db::startTrans();try{$freeId=(int)Db::name('membership_plan')->where(['tenant_id'=>1,'name'=>'免费会员','status'=>1])->value('id');$actor=Db::name('oem_agent')->where('id',$agents['a'])->find();$free=Ops::assignPlan($actor,['merchant_id'=>$merchants['a'],'plan_id'=>$freeId,'request_key'=>opKey()]);checkOps($free['result']['expire_time']===4294967295,'assigning the original free plan preserves permanent validity');}finally{Db::rollback();}
 $policy=['merchant_id'=>$merchants['c'],'app_codes'=>[],'request_key'=>opKey()];checkOps(postOps('authorizeApps',$tokens['c'],$policy)['code']===1,'child can revoke app access for its own merchant');
 checkOps(postOps('authorizeApps',$tokens['c'],['merchant_id'=>$merchants['c'],'app_codes'=>[['aigc_image']],'request_key'=>opKey()])['code']!==1,'nested app code input is rejected without leaking a PHP warning');
 checkOps(!MembershipService::userCanUseApp($tenant,$owners['c'],'aigc_image')&&MembershipService::appAccess($tenant,$owners['c'],'aigc_image')['allowed']===0,'whitelist affects actual membership access checks');
 $login=opsHttp('/api/merchant/login',['account'=>$prefix.'mc','password'=>$password,'scene'=>1,'terminal'=>4]);checkOps($login['code']===1,'test merchant can sign in');$merchantToken=$login['data']['token'];
 $denied=opsHttp('/api/app.aigc_image.config/detail',null,$merchantToken);checkOps($denied['code']!==1&&str_contains($denied['msg'],'未获商家授权'),'revoked merchant is rejected by the actual app API middleware');
 checkOps(postOps('authorizeApps',$tokens['a'],['merchant_id'=>$merchants['c'],'app_codes'=>['missing_app'],'request_key'=>opKey()])['code']!==1,'uninstalled app grant rejected');
 checkOps(postOps('authorizeApps',$tokens['a'],['merchant_id'=>$merchants['c'],'app_codes'=>['aigc_image'],'request_key'=>opKey()])['code']===1&&MembershipService::userCanUseApp($tenant,$owners['c'],'aigc_image'),'parent may restore apps included in the merchant package');
 checkOps(postOps('authorizeApps',$tokens['a'],['merchant_id'=>$merchants['a'],'app_codes'=>['aigc_image'],'request_key'=>opKey()])['code']!==1,'app grant cannot exceed current merchant package rights');
 // An isolated catalog app checks upstream revocation without changing live demo apps.
 $fixtureApp=$prefix.'_app';Db::name('app')->insert(['code'=>$fixtureApp,'name'=>$prefix.'应用','status'=>'installed']);Db::name('tenant_app')->insert(['tenant_id'=>$tenant,'app_code'=>$fixtureApp,'buy_status'=>'paid','enable_status'=>'enabled','shelf_status'=>'on','expire_time'=>time()+86400]);Db::name('membership_plan_app')->insert(['tenant_id'=>$tenant,'plan_id'=>$planId,'app_code'=>$fixtureApp]);
 $rights=Db::name('user_membership')->where('user_id',$owners['c'])->value('app_codes');$rights=json_decode($rights,true);$rights[]=$fixtureApp;Db::name('user_membership')->where('user_id',$owners['c'])->update(['app_codes'=>json_encode($rights)]);
 checkOps(postOps('authorizeApps',$tokens['c'],['merchant_id'=>$merchants['c'],'app_codes'=>['aigc_image',$fixtureApp],'request_key'=>opKey()])['code']===1,'OEM enabled app within the package may be granted');
 Db::name('tenant_app')->where(['tenant_id'=>$tenant,'app_code'=>$fixtureApp])->update(['enable_status'=>'disabled']);
 checkOps(!MembershipService::userCanUseApp($tenant,$owners['c'],$fixtureApp),'OEM disabling an app immediately overrides a prior merchant grant');
 // Native payment records and manual operations are merged without claiming manual cash receipts.
 $nativeMembership=Db::name('membership_order')->insertGetId(['tenant_id'=>$tenant,'user_id'=>$owners['c'],'order_sn'=>$prefix.'native_member','plan_id'=>$planId,'plan_name'=>$prefix.'套餐','order_amount'=>'19.00','pay_status'=>1,'create_time'=>time(),'update_time'=>time()]);
 $nativeRecharge=Db::name('recharge_order')->insertGetId(['tenant_id'=>$tenant,'user_id'=>$owners['d'],'sn'=>$prefix.'native_recharge','order_amount'=>'300.00','recharge_points'=>'300.00','pay_status'=>1,'create_time'=>time(),'update_time'=>time()]);
 $r=getOps('orders',$tokens['a']);checkOps($r['code']===1&&$r['data']['count']===6&&$r['data']['summary']['paid_amount']==19,'first-level orders merge owned manual and native records only');
 foreach($r['data']['lists'] as $order)if(str_starts_with($order['id'],'agent:'))checkOps($order['payment_status']==='未登记收款'&&(float)$order['paid_amount']===0.0,'manual service order does not fabricate a payment');
 $r=getOps('orders',$tokens['c']);checkOps($r['data']['count']===5&&$r['data']['summary']['paid_amount']==19,'second-level orders contain only its own merchant');
 foreach(['orders','ledger'] as $action){$r=getOps($action,$tokens['a'],['merchant_id'=>$merchants['d']]);checkOps($r['data']['count']===0,'forged foreign merchant filter cannot expand '.$action);$r=getOps($action,$tokens['c'],['agent_id'=>$agents['a']]);checkOps($r['data']['count']===0,'child cannot query parent '.$action);$r=getOps($action,$tokens['a'],['keyword'=>$prefix.'商家d']);checkOps($r['data']['count']===0,'foreign keyword search cannot reveal '.$action);}
 $r=getOps('ledger',$tokens['c']);checkOps($r['data']['count']===4&&(float)$r['data']['summary']['increase']===25.0,'merchant ledger includes both actor-funded recharge and package bonus within scope');
 $r=getOps('walletLogs',$tokens['c'],['agent_id'=>$agents['a']]);checkOps($r['data']['count']===2&&$r['data']['balance']==='197.00','agent wallet logs cannot be redirected to parent wallet');
 $r=getOps('overview',$tokens['a']);checkOps($r['data']['summary']['paid_amount']==19&&(float)$r['data']['summary']['unrecorded_amount']===71.8,'dashboard separates actual native receipts from manual receivables');
 Db::startTrans();try{Db::name('recharge_order')->insert(['tenant_id'=>1,'user_id'=>$owners['c'],'sn'=>$prefix.'refund','order_amount'=>'20.00','recharge_points'=>'20.00','pay_status'=>1,'refund_status'=>1,'create_time'=>time()]);$actor=Db::name('oem_agent')->where('id',$agents['a'])->find();$overview=Ops::overview($actor);$orders=Ops::orders($actor,[]);checkOps((float)$overview['summary']['paid_amount']===39.0&&(float)$orders['summary']['paid_amount']===39.0&&in_array('退款处理中/已退款',array_column($orders['lists'],'payment_status'),true),'cumulative payment totals stay consistent while refund status is reported separately');}finally{Db::rollback();}
 foreach(['recharge','assignPlan','authorizeApps'] as $action){checkOps(opsHttp('/tenantapi/oem.operations/'.$action,null,$tokens['a'])['code']!==1,'write requires POST: '.$action);checkOps(opsHttp('/tenantapi/oem.operations/'.$action,['merchant_id'=>$merchants['a'],'points'=>'1','plan_id'=>$planId,'app_codes'=>[],'request_key'=>opKey()],$tokens['a'],'https://example.com')['code']!==1,'cross-origin write rejected: '.$action);}
 checkOps(postOps('recharge',$tokens['a'],['merchant_id'=>$merchants['a'],'points'=>'1','tenant_id'=>999999,'request_key'=>opKey()])['code']!==1,'forged OEM identity rejected');
 checkOps(postOps('recharge',$tokens['a'],['merchant_id'=>$merchants['a'],'points'=>'1','actor_agent_id'=>$agents['b'],'request_key'=>opKey()])['code']!==1,'forged acting agent rejected');
 checkOps(getOps('orders',$tokens['a'],['date_from'=>'2026-99-99'])['code']!==1,'invalid date filter rejected');
 Directory::saveMerchant($tenant,['id'=>$merchants['a'],'name'=>$prefix.'商家a','agent_id'=>$agents['a'],'status'=>0]);
 checkOps(postOps('recharge',$tokens['a'],['merchant_id'=>$merchants['a'],'points'=>'1','request_key'=>opKey()])['code']!==1,'disabled merchant cannot be recharged');
 Directory::saveAgent($tenant,['id'=>$agents['c'],'name'=>$prefix.'代理c','level'=>2,'parent_id'=>$agents['b']]);
 foreach(['merchants','orders','ledger'] as $action){$r=getOps($action,$tokens['a'],['merchant_id'=>$merchants['c']]);checkOps($r['data']['count']===0,'reparenting immediately removes historical and current '.$action);}
 checkOps(postOps('authorizeApps',$tokens['a'],['merchant_id'=>$merchants['c'],'app_codes'=>[],'request_key'=>opKey()])['code']!==1,'old parent cannot revoke migrated merchant apps');
 checkOps(getOps('overview',$tokens['b'])['data']['summary']['merchants']===3,'new parent immediately gains child merchant dashboard scope');
 // Two PHP processes compete for the same idempotency key on the same wallet.
 $agents['x']=Directory::saveAgent($tenant,['name'=>$prefix.'并发代理','account'=>$prefix.'x','password'=>$password,'level'=>1]);$merchants['x']=Directory::saveMerchant($tenant,['name'=>$prefix.'并发商家','account'=>$prefix.'mx','password'=>$password,'agent_id'=>$agents['x']]);$owners['x']=(int)Db::name('oem_merchant')->where('id',$merchants['x'])->value('user_id');
 Ops::allocate(null,1,0,['target_agent_id'=>$agents['x'],'points'=>'10.00','request_key'=>opKey()]);
 $input=base64_encode(json_encode(['agent_id'=>$agents['x'],'payload'=>['merchant_id'=>$merchants['x'],'points'=>'1.00','request_key'=>opKey()]]));$processes=[];
 foreach([1,2] as $worker){$pipes=[];$process=proc_open([PHP_BINARY,'-d','extension=gd','-d','extension=zip',__FILE__,'--credit-worker',$input],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,dirname(__DIR__));if(!is_resource($process))throw new RuntimeException('Concurrency worker failed to start');fclose($pipes[0]);$processes[]=[$process,$pipes];}
 $results=[];foreach($processes as [$process,$pipes]){$output=stream_get_contents($pipes[1]);$errors=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$exit=proc_close($process);if($exit!==0)throw new RuntimeException('Concurrency worker failed: '.$errors);$results[]=json_decode($output,true,512,JSON_THROW_ON_ERROR);}
 checkOps($results[0]['sn']===$results[1]['sn']&&$results[0]['replayed']!==$results[1]['replayed'],'concurrent identical requests create one business operation');
 checkOps(ownerBalance($owners['x'])==='1.00'&&Ops::balance(1,$agents['x'])==='9.00','concurrent retries conserve quota and credit the merchant once');
 Directory::saveAgent($tenant,['id'=>$agents['c'],'name'=>$prefix.'代理c','level'=>2,'parent_id'=>$agents['b'],'status'=>0]);
 checkOps(getOps('orders',$tokens['c'])['code']===-1,'disabled agent loses business API access immediately');
}catch(\Throwable $e){$failure=$e;}finally{
 if($staff){(new \app\common\cache\TenantAdminTokenCache())->deleteAdminInfo($staffToken);Db::name('tenant_admin_session')->where('admin_id',$staff)->where('token',$staffToken)->delete();Db::name('tenant_admin')->where('id',$staff)->whereLike('account',$prefix.'%')->delete();}
 if(!empty($foreign['user'])){foreach(['user_membership','oem_merchant','user'] as $table){$query=Db::name($table)->where('tenant_id',999991);$query->where($table==='user'?'id':'user_id',$foreign['user'])->delete();}}
 if($foreignPlan)Db::name('membership_plan')->where('tenant_id',999991)->where('id',$foreignPlan)->whereLike('name',$prefix.'%')->delete();
 Db::name('tenant_app')->where('tenant_id',$tenant)->where('app_code',$prefix.'_app')->delete();Db::name('app')->where('code',$prefix.'_app')->delete();
 foreach($owners as $owner){foreach(['user_account_log','user_membership','user_session','membership_order','recharge_order','oem_merchant_app_access','user_membership','oem_merchant'] as $table)Db::name($table)->where('tenant_id',$tenant)->where('user_id',$owner)->delete();Db::name('user')->where('tenant_id',$tenant)->where('id',$owner)->whereLike('account',$prefix.'%')->delete();}
 foreach(array_reverse($agents) as $id){foreach(['oem_agent_wallet','oem_agent_wallet_log','oem_agent_account','oem_agent_session'] as $table)Db::name($table)->where('tenant_id',$tenant)->where('agent_id',$id)->delete();Db::name('oem_agent_operation')->where('tenant_id',$tenant)->where(function($q)use($id){$q->where('actor_agent_id',$id)->whereOr('target_agent_id',$id);})->delete();Db::name('oem_agent')->where('tenant_id',$tenant)->where('id',$id)->whereLike('name',$prefix.'%')->delete();}
 if($planId){Db::name('membership_plan_app')->where('tenant_id',$tenant)->where('plan_id',$planId)->delete();Db::name('membership_plan')->where('tenant_id',$tenant)->where('id',$planId)->whereLike('name',$prefix.'%')->delete();}
}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}echo "All $passed agent operations HTTP checks passed; owned fixtures removed.\n";
