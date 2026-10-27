<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Local database required');
$prefix='sharedqa'.bin2hex(random_bytes(4));$admins=[];$tenant=0;$tokens=[];$role=0;$passed=0;$failure=null;
function sharedHttp(string $path,?array $body=null,string $token=''):array{
 $c=curl_init('http://127.0.0.1:8090'.$path);$headers=$token?['token: '.$token]:[];
 if($body!==null){$headers[]='Content-Type: application/json';curl_setopt_array($c,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body)]);}
 $responseHeaders=[];curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20,CURLOPT_HTTPHEADER=>$headers,CURLOPT_HEADERFUNCTION=>function($c,$line)use(&$responseHeaders){$responseHeaders[]=trim($line);return strlen($line);}]);
 $raw=curl_exec($c);if($raw===false)throw new RuntimeException('HTTP request failed');curl_close($c);return (json_decode($raw,true)??['code'=>0])+['_headers'=>$responseHeaders];
}
function sharedCheck(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo "PASS $label\n";}
try{
 foreach([1,0] as $root){
  $account=$prefix.'p'.$root;$admins[$root]=(int)Db::name('admin')->insertGetId(['account'=>$account,'name'=>'公共凭证验收','root'=>$root,'password'=>create_password('ConfigQa2026!',config('project.unique_identification')),'create_time'=>time(),'login_ip'=>'127.0.0.1']);
  $r=sharedHttp('/platformapi/login/account',['account'=>$account,'password'=>'ConfigQa2026!','terminal'=>1]);sharedCheck($r['code']===1,'fixture platform login');$tokens[$root]=$r['data']['token'];
 }
 $r=sharedHttp('/platformapi/channel.directory/save',['kind'=>'oem','name'=>$prefix,'account'=>$prefix.'o','password'=>'ConfigQa2026!','domain_alias'=>$prefix.'.example.test','valid_days'=>365,'status'=>1],$tokens[1]);
 sharedCheck($r['code']===1,'isolated OEM created');$tenant=(int)$r['data']['tenant_id'];
 $r=sharedHttp('/tenantapi/login/account',['tenant_id'=>$tenant,'account'=>$prefix.'o','password'=>'ConfigQa2026!','terminal'=>1]);sharedCheck($r['code']===1,'fixture OEM login');$oemToken=$r['data']['token'];
 $api=fn($action,$body=null)=>sharedHttp('/tenantapi/integration.config/'.$action.'?tenant_id='.$tenant,$body,$oemToken);
 $keys=['access_key_id'=>$prefix.'Id','access_key_secret'=>$prefix.'Secret'];
 sharedCheck($api('aliyun',['revision'=>0,'secrets'=>$keys])['code']===1,'authorized shared save works through HTTP');
 $r=$api('lists');sharedCheck($r['data']['aliyun']['secrets']===$keys,'owner sees saved plaintext through HTTP');
 sharedCheck((bool)array_filter($r['_headers'],fn($h)=>preg_match('/^cache-control:\s*no-store$/i',$h)),'plaintext response cannot be cached');
 sharedCheck($api('save',['capability'=>'oss','revision'=>0,'enabled'=>true,'credential_mode'=>'shared','settings'=>['region'=>'cn-shanghai','bucket'=>'fixture-bucket']])['code']===1,'service enables using saved shared credentials');
 sharedCheck($api('aliyun',['revision'=>0,'secrets'=>$keys])['code']!==1,'stale shared HTTP write rejected');
 sharedCheck($api('aliyun')['code']!==1,'GET cannot write shared credentials');
 sharedCheck(sharedHttp('/tenantapi/integration.config/aliyun?tenant_id='.$tenant,['revision'=>1,'secrets'=>$keys])['code']!==1,'guest cannot write shared credentials');
 $role=(int)Db::name('system_role')->insertGetId(['name'=>$prefix,'create_time'=>time()]);
 Db::name('admin_role')->insert(['admin_id'=>$admins[0],'role_id'=>$role]);
 foreach(Db::name('system_menu')->where('perms','integration.config/lists')->column('id') as $menu)Db::name('system_role_menu')->insert(['role_id'=>$role,'menu_id'=>$menu]);
 (new \app\common\cache\AdminAuthCache($admins[0]))->deleteTag();
 $r=sharedHttp('/platformapi/integration.config/lists',null,$tokens[0]);sharedCheck($r['code']===1&&!$r['data']['can_write'],'read-only platform role can inspect status');
 sharedCheck(empty($r['data']['aliyun']['secrets'])&&count(array_filter($r['data']['lists'],fn($r)=>!empty($r['secrets'])))===0,'read-only role receives no plaintext');
 sharedCheck(sharedHttp('/platformapi/integration.config/aliyun',['revision'=>0,'secrets'=>$keys],$tokens[0])['code']!==1,'read-only role cannot save common credentials');
 sharedCheck(sharedHttp('/platformapi/integration.config/lists',null,$oemToken)['code']!==1,'OEM token cannot read platform plaintext');
 sharedCheck(sharedHttp('/tenantapi/integration.config/lists?tenant_id=1',null,$oemToken)['code']!==1,'OEM cannot inspect another owner');
 foreach(['platformapi','tenantapi'] as $area){
  $listener='\\app\\'.$area.'\\listener\\OperationLog';$method=new ReflectionMethod($listener,'formatResult');$content=json_encode(['data'=>['lists'=>[['secrets'=>$keys,'secret_values'=>['api_key'=>$keys['access_key_secret']]]],'aliyun'=>['secrets'=>$keys]]]);
  $redacted=$method->invoke(new $listener(),$content,true);
  sharedCheck(!str_contains($redacted,$keys['access_key_id'])&&!str_contains($redacted,$keys['access_key_secret']),$area.' log formatter removes nested credential values');
 }
 $r=sharedHttp('/platformapi/integration.config/lists',null,$tokens[1]);sharedCheck($r['code']===1&&$r['data']['can_write'],'platform authorized plaintext listing remains available');
}catch(Throwable $e){$failure=$e;}finally{
 foreach($tokens as $token)(new \app\common\cache\AdminTokenCache())->deleteAdminInfo($token);
 if(isset($oemToken))(new \app\common\cache\TenantAdminTokenCache())->deleteAdminInfo($oemToken);
 if($tenant){
  if(Db::name('tenant')->where('id',$tenant)->value('domain_alias')!==$prefix.'.example.test')throw new RuntimeException('Unowned fixture');
  $ids=Db::name('tenant_admin')->where('tenant_id',$tenant)->column('id');
  foreach(['tenant_admin_session','tenant_admin_role','tenant_admin_dept','tenant_admin_jobs'] as $table)if($ids)Db::name($table)->whereIn('admin_id',$ids)->delete();
  foreach(Db::query('SELECT TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND COLUMN_NAME=?',['aigc_local','tenant_id']) as $table){$name=$table['TABLE_NAME'];if(preg_match('/^la_[A-Za-z0-9_]+$/D',$name))Db::execute('DELETE FROM `'.$name.'` WHERE tenant_id=?',[$tenant]);}
  Db::name('tenant')->where('id',$tenant)->delete();
 }
 Db::name('operation_log')->whereLike('account',$prefix.'%')->delete();
 foreach($admins as $id){foreach(['admin_session','admin_role'] as $table)Db::name($table)->where('admin_id',$id)->delete();Db::name('admin')->where('id',$id)->whereLike('account',$prefix.'%')->delete();}
 if($role){Db::name('system_role_menu')->where('role_id',$role)->delete();Db::name('system_role')->where('id',$role)->delete();}
}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}echo "All $passed HTTP checks passed; fixtures removed; no cloud calls.\n";
