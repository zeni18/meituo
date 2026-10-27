<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Only the isolated local preview database is allowed');
$passed=0;$failure=null;$ownerId=0;$merchantId=0;$adminId=0;
function verify(bool $value,string $label):void{global $passed;if(!$value)throw new RuntimeException($label);$passed++;echo 'PASS '.$label."\n";}
function httpCheck(string $path,?array $body=null,string $token='',string $cookie='',string $origin=''):array{
 $curl=curl_init('http://localhost:8090'.$path);$headers=[];if($token!=='')$headers[]='token: '.$token;if($origin!=='')$headers[]='Origin: '.$origin;
 if($body!==null){$headers[]='Content-Type: application/json';curl_setopt($curl,CURLOPT_POST,true);curl_setopt($curl,CURLOPT_POSTFIELDS,json_encode($body));}
 curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HEADER=>true,CURLOPT_TIMEOUT=>30,CURLOPT_HTTPHEADER=>$headers,CURLOPT_COOKIE=>$cookie]);
 $raw=curl_exec($curl);if($raw===false)throw new RuntimeException('HTTP connection failed: '.curl_error($curl));$length=curl_getinfo($curl,CURLINFO_HEADER_SIZE);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);
 $head=substr($raw,0,$length);$content=substr($raw,$length);return ['status'=>$status,'headers'=>$head,'body'=>$content,'json'=>json_decode($content,true)];
}
$tenant=(int)Db::name('tenant')->whereNull('delete_time')->value('id');$rootToken=trim(file_get_contents(dirname(__DIR__).'/runtime/local/tenant-token.txt'));
$limitedToken=bin2hex(random_bytes(16));$account='httpqa_'.bin2hex(random_bytes(4));
try{
 foreach(['/','/ai','/ai/tools','/merchant','/pc/index.html','/mobile/index.html']as $path){$r=httpCheck($path);verify($r['status']===302&&str_contains($r['headers'],'/login'),'guest page denied: '.$path);}
 foreach(['/api/app/frontend?terminal=pc','/api/pc/config','/api/app.aigc_image.config/detail']as $path){$r=httpCheck($path);verify(($r['json']['code']??null)===-1,'guest API denied: '.$path);}
 verify(httpCheck('/api/login/register',['account'=>'unmanaged','password'=>'Anything2026!','password_confirm'=>'Anything2026!','channel'=>4])['json']['code']===-1,'self-registration cannot create unmanaged merchant');
 verify(httpCheck('/merchant',null,'','token='.str_repeat('0',32))['status']===302,'forged cookie cannot open workbench');
 $minimal=httpCheck('/api/merchant/config')['json'];verify($minimal['code']===1&&!isset($minimal['data']['apps'])&&!isset($minimal['data']['tools']),'login config exposes branding only');
 $adminId=(int)Db::name('tenant_admin')->insertGetId(['tenant_id'=>$tenant,'root'=>0,'name'=>'HTTP验收无权限员工','account'=>$account,'password'=>md5(random_bytes(16)),'login_ip'=>'127.0.0.1','create_time'=>time()]);
 Db::name('tenant_admin_session')->insert(['admin_id'=>$adminId,'terminal'=>1,'token'=>$limitedToken,'expire_time'=>time()+3600]);
 foreach(['agents','merchants']as $action)verify(httpCheck('/tenantapi/oem.directory/'.$action,null,$limitedToken)['json']['code']!==1,'ungranted OEM read denied: '.$action);
 foreach(['saveAgent','saveMerchant']as $action)verify(httpCheck('/tenantapi/oem.directory/'.$action,['name'=>'禁止写入'],$limitedToken)['json']['code']!==1,'ungranted OEM write denied: '.$action);
 $created=httpCheck('/tenantapi/oem.directory/saveMerchant',['name'=>'HTTP验收商家','account'=>$account,'password'=>'QaVerify2026!','agent_id'=>0,'status'=>1],$rootToken)['json'];
 verify(($created['code']??0)===1,'OEM can create a merchant through authenticated HTTP');$merchantId=(int)$created['data']['id'];$ownerId=(int)Db::name('oem_merchant')->where('id',$merchantId)->where('tenant_id',$tenant)->value('user_id');
 $login=httpCheck('/api/merchant/login',['account'=>$account,'password'=>'QaVerify2026!','scene'=>1,'terminal'=>4,'redirect'=>'https://example.com']);
 verify(($login['json']['code']??0)===1,'new OEM-created merchant can sign in');verify($login['json']['data']['redirect']==='/ai/tools','login lands in the original AI merchant interface');
 $token=$login['json']['data']['token'];$cookie='token='.$token;verify(str_contains(strtolower($login['headers']),'samesite=lax'),'session cookie is SameSite scoped');
 $original=httpCheck('/ai/tools',null,'',$cookie);verify($original['status']===200&&str_contains($original['body'],'id="__nuxt"'),'valid cookie opens the original AI interface');
 foreach(['/','/merchant','/login']as $alias){$redirect=httpCheck($alias,null,'',$cookie);verify($redirect['status']===302&&str_contains($redirect['headers'],'/ai/tools'),'authenticated entry redirects to original AI interface: '.$alias);}
 verify(!str_contains($original['body'],'merchant-back-link')&&!str_contains(file_get_contents(dirname(__DIR__).'/public/merchant/bridge.js'),'merchant-back-link'),'original AI interface has no extra workbench button');
 $session=httpCheck('/api/merchant/session',null,'',$cookie)['json'];verify($session['code']===1&&$session['data']['user']['account']===$account,'workbench uses the authenticated merchant account');
 $renamed=httpCheck('/tenantapi/oem.directory/saveMerchant',['id'=>$merchantId,'name'=>'OEM更新后的商家名称','status'=>1,'agent_id'=>0],$rootToken)['json'];verify($renamed['code']===1,'OEM can rename a merchant without changing the login account');
 foreach(['info','center'] as $action){$profile=httpCheck('/api/user/'.$action,null,'',$cookie)['json'];verify($profile['code']===1&&$profile['data']['nickname']==='OEM更新后的商家名称'&&$profile['data']['merchant_id']===$merchantId&&$profile['data']['account']===$account,'merchant identity is authoritative in user/'.$action);}
 verify(httpCheck('/api/user/setInfo',['field'=>'nickname','value'=>'商家自己更新的名称'],'',$cookie)['json']['code']===1,'merchant can update its display name from the original profile form');
 $directory=httpCheck('/tenantapi/oem.directory/merchants?keyword='.rawurlencode('商家自己更新的名称'),null,$rootToken)['json'];verify($directory['code']===1&&$directory['data']['lists'][0]['id']==$merchantId,'profile name changes persist to the OEM merchant directory');
 $profile=httpCheck('/api/user/info',null,'',$cookie)['json'];verify($profile['data']['nickname']==='商家自己更新的名称','profile reload preserves the merchant name');
 verify(httpCheck('/api/user/setInfo',['field'=>'nickname','value'=>str_repeat('名',81)],'',$cookie)['json']['code']!==1,'overlong merchant names are rejected');
 verify(httpCheck('/api/merchant/login',['account'=>$account,'password'=>'QaVerify2026!','scene'=>1,'terminal'=>4],'','','https://example.com')['json']['code']!==1,'cross-origin credential submission rejected');
 verify(httpCheck('/api/merchant/logout',[], '',$cookie)['json']['code']===1,'logout succeeds');verify(httpCheck('/api/merchant/session',null,'',$cookie)['json']['code']===-1,'logged-out token is denied by the API');verify(httpCheck('/merchant',null,'',$cookie)['status']===302,'logged-out cookie cannot reopen workbench');
}catch(\Throwable $error){$failure=$error;}finally{
 if($ownerId>0){Db::name('user_membership')->where('tenant_id',$tenant)->where('user_id',$ownerId)->delete();Db::name('user_session')->where('tenant_id',$tenant)->where('user_id',$ownerId)->delete();Db::name('oem_merchant')->where('tenant_id',$tenant)->where('id',$merchantId)->where('user_id',$ownerId)->delete();Db::name('user')->where('tenant_id',$tenant)->where('id',$ownerId)->where('account',$account)->delete();}
 if($adminId>0){(new \app\common\cache\TenantAdminTokenCache())->deleteAdminInfo($limitedToken);Db::name('tenant_admin_session')->where('admin_id',$adminId)->where('token',$limitedToken)->delete();Db::name('tenant_admin')->where('id',$adminId)->where('account',$account)->where('root',0)->delete();}
}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}echo 'All '.$passed." HTTP checks passed; owned fixtures removed.\n";
