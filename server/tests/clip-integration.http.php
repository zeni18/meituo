<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\clip\ClipIntegrationService as Integration;
use app\common\service\merchant\clip\ClipCredentialVault as Vault;
use app\common\service\merchant\OemDirectoryService;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Isolated local database required');
if(Db::name('oem_clip_integration')->where('tenant_id',0)->count())throw new RuntimeException('Refusing to overwrite existing platform clip settings');
$prefix='ciqa'.bin2hex(random_bytes(4));$passed=0;$tenants=[];$admins=[];$tokens=[];$role=0;$failure=null;
function ciCheck(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo 'PASS '.$label."\n";}
function ciHttp(string $path,?array $body=null,string $token='',string $origin=''):array{
 $curl=curl_init('http://127.0.0.1:8090'.$path);$headers=[];if($token)$headers[]='token: '.$token;if($origin)$headers[]='Origin: '.$origin;
 if($body!==null){$headers[]='Content-Type: application/json';curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body)]);}
 curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>40,CURLOPT_HTTPHEADER=>$headers]);$raw=curl_exec($curl);if($raw===false)throw new RuntimeException(curl_error($curl));$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);if($status>=500){preg_match_all('#<(?:h1|h2)[^>]*>(.*?)</(?:h1|h2)>#si',$raw,$headings);throw new RuntimeException('Unexpected server error for '.strtok($path,'?').' '.mb_substr(strip_tags(implode(' ', $headings[1]??[])),0,300));}return ['_status'=>$status]+(json_decode($raw,true)??['code'=>0]);
}
function ciInvalid(callable $work,string $label):void{try{$work();}catch(InvalidArgumentException){ciCheck(true,$label);return;}ciCheck(false,$label);}
function ciSecrets(string $prefix):array{return ['access_key_id'=>$prefix.'Access','access_key_secret'=>$prefix.'Secret'];}
try{
 foreach([1,0] as $isRoot){$account=$prefix.'p'.$isRoot;$id=(int)Db::name('admin')->insertGetId(['account'=>$account,'name'=>'剪辑配置验收','root'=>$isRoot,'password'=>create_password('ConfigQa2026!',config('project.unique_identification')),'create_time'=>time(),'login_ip'=>'127.0.0.1']);$admins[$isRoot]=$id;
  $login=ciHttp('/platformapi/login/account',['account'=>$account,'password'=>'ConfigQa2026!','terminal'=>1]);ciCheck(($login['code']??0)===1,'isolated platform login '.$isRoot);$tokens[$isRoot]=$login['data']['token'];}
 $root=$tokens[1];$staff=$tokens[0];
 ciCheck((ciHttp('/platformapi/integration.config/lists')['code']??0)!==1,'guest cannot read configuration');
 ciCheck(ciHttp('/platformapi/integration.config/lists',null,$staff)['code']!==1,'ungranted platform staff denied');
 $platform=fn($action,$body=null)=>ciHttp('/platformapi/integration.config/'.$action,$body,$root);
 ciCheck($platform('lists')['code']===1&&count($platform('lists')['data']['lists'])===8,'platform exposes seven clip capabilities plus employee task notifications');
 foreach([false,true] as $index=>$borrow){$p=['kind'=>'oem','name'=>'接入验收'.$index.$prefix,'account'=>$prefix.'o'.$index,'password'=>'ConfigQa2026!','domain_alias'=>$prefix.$index.'.example.test','valid_days'=>365,'status'=>1,'clip_borrow_platform'=>$borrow];$r=ciHttp('/platformapi/channel.directory/save',$p,$root);ciCheck(($r['code']??0)===1,'OEM creation with borrowing '.($borrow?'checked':'unchecked'));$tenants[$index]=(int)$r['data']['tenant_id'];$login=ciHttp('/tenantapi/login/account',['account'=>$p['account'],'password'=>'ConfigQa2026!','terminal'=>1,'tenant_id'=>$tenants[$index]]);ciCheck($login['code']===1,'OEM fixture login '.$index);$tenantTokens[$index]=$login['data']['token'];}
 [$off,$on]=$tenants;$oem=fn($action,$body=null,$which=1)=>ciHttp('/tenantapi/integration.config/'.$action.'?tenant_id='.$tenants[$which],$body,$tenantTokens[$which]);
 ciCheck(!Integration::policy($off)['allow_platform']&&Integration::policy($on)['allow_platform'],'checkbox persists explicit borrowing policy');
 ciCheck($oem('lists')['data']['policy']['allow_platform']&&$oem('lists',null,0)['data']['policy']['allow_platform']===false,'OEM sees own platform-controlled policy');
 ciCheck(($oem('grant',['target_tenant_id'=>$off,'allow_platform'=>true,'revision'=>1])['code']??0)!==1,'OEM cannot self-grant platform credentials');
 ciCheck(ciHttp('/platformapi/integration.config/lists',null,$tenantTokens[1])['code']!==1,'OEM token cannot read platform credential settings');
 $role=(int)Db::name('system_role')->insertGetId(['name'=>$prefix.'role','create_time'=>time()]);Db::name('admin_role')->insert(['admin_id'=>$admins[0],'role_id'=>$role]);
 foreach(Db::name('system_menu')->whereIn('perms',['channel.directory/lists','channel.directory/save'])->column('id') as $menu)Db::name('system_role_menu')->insert(['role_id'=>$role,'menu_id'=>$menu]);(new \app\common\cache\AdminAuthCache($admins[0]))->deleteTag();
 $staffPolicy=ciHttp('/platformapi/channel.directory/save',['kind'=>'oem','id'=>$off,'name'=>'不得提权','account'=>$prefix.'o0','status'=>1,'clip_borrow_platform'=>true,'clip_borrow_revision'=>1],$staff);ciCheck($staffPolicy['code']!==1&&!Integration::policy($off)['allow_platform'],'directory edit permission alone cannot grant borrowing');
 $native=[];foreach(['config','tenant_config','smart_clip_config'] as $table)$native[$table]=hash('sha256',json_encode(Db::name($table)->order('id')->select()->toArray()));
 $settings=['region'=>'cn-shanghai','bucket'=>$prefix.'-bucket','prefix'=>'merchant-clip/'];$secret=ciSecrets($prefix.'Platform');
 ciCheck($platform('save',['capability'=>'oss','revision'=>0,'enabled'=>true,'settings'=>$settings,'secrets'=>$secret])['code']===1,'platform OSS configuration saved');
 $stored=Db::name('oem_clip_integration')->where(['tenant_id'=>0,'capability'=>'oss'])->find();ciCheck(!str_contains($stored['secret_cipher'],$secret['access_key_secret'])&&$stored['secret_cipher']!=='','credentials encrypted at rest');
 ciCheck(Vault::open($stored['secret_cipher'],0,'oss')===$secret,'authenticated encryption round trips');try{Vault::open($stored['secret_cipher'],$on,'oss');ciCheck(false,'vault owner binding');}catch(RuntimeException){ciCheck(true,'vault rejects copying ciphertext to another OEM');}
 $json=json_encode($platform('lists'));ciCheck(str_contains($json,$secret['access_key_id'])&&str_contains($json,$secret['access_key_secret']),'authorized platform editor can inspect own credential values');
 $onList=$oem('lists')['data'];$onOss=array_values(array_filter($onList['lists'],fn($r)=>$r['code']==='oss'))[0];ciCheck($onOss['settings']===[]&&$onOss['effective']['borrowed']&&$onOss['effective']['state']==='configured','OEM sees platform source without platform public settings or secrets');
 $borrowed=Integration::resolve($on,'oss');ciCheck($borrowed['source']==='platform'&&$borrowed['source_tenant_id']===0&&$borrowed['tenant_id']===$on&&$borrowed['credentials']===$secret,'server resolver keeps consuming OEM and credential owner separate');
 ciInvalid(fn()=>Integration::resolve($off,'oss'),'no grant means no fallback to platform');
 ciInvalid(fn()=>Integration::resolve($on,'original_storage'),'native capability names rejected');ciInvalid(fn()=>Integration::resolve($on,'oss','native_storage'),'native resolution namespace rejected');
 ciCheck($oem('save',['capability'=>'oss','revision'=>0,'enabled'=>false,'settings'=>[],'secrets'=>[]])['code']===1,'OEM can explicitly disable own capability');
 ciInvalid(fn()=>Integration::resolve($on,'oss'),'explicitly disabled OEM config does not borrow platform');
 ciCheck($oem('reset',['capability'=>'oss','revision'=>1,'restore'=>false])['code']===1&&Integration::resolve($on,'oss')['source']==='platform','removing own configuration restores authorized fallback');
 ciCheck($oem('reset',['capability'=>'oss','revision'=>2,'restore'=>true])['code']===1,'own configuration recoverable');ciInvalid(fn()=>Integration::resolve($on,'oss'),'restoring disabled config preserves explicit off state');
 $ownSecret=ciSecrets($prefix.'Oem');$ownSettings=$settings;$ownSettings['bucket']=$prefix.'-oem';
 ciCheck($oem('save',['capability'=>'oss','revision'=>3,'enabled'=>true,'settings'=>$ownSettings,'secrets'=>$ownSecret])['code']===1,'OEM stores independent full configuration');
 ciCheck(Integration::resolve($on,'oss')['credentials']===$ownSecret&&Integration::resolve($on,'oss')['source_tenant_id']===$on,'complete OEM configuration wins over platform');
 ciCheck($oem('save',['capability'=>'oss','revision'=>4,'enabled'=>true,'settings'=>$ownSettings,'secrets'=>['access_key_id'=>'','access_key_secret'=>'']])['code']===1&&Integration::resolve($on,'oss')['credentials']===$ownSecret,'blank secret input retains own credentials');
 ciCheck($oem('save',['capability'=>'oss','revision'=>4,'enabled'=>true,'settings'=>$ownSettings,'secrets'=>[]])['code']!==1,'stale configuration write rejected');
 ciCheck($oem('save',['capability'=>'oss','revision'=>5,'enabled'=>true,'settings'=>$ownSettings,'secrets'=>[],'clear_secrets'=>['access_key_secret']])['code']!==1&&Integration::resolve($on,'oss')['credentials']===$ownSecret,'cannot enable incomplete config; failed mutation atomic');
 ciCheck($oem('save',['capability'=>'oss','revision'=>5,'enabled'=>false,'settings'=>$ownSettings,'secrets'=>[],'clear_secrets'=>['access_key_secret']])['code']===1,'explicit secret clearing requires separate intent');
 ciInvalid(fn()=>Integration::resolve($on,'oss'),'partial credentials cannot mix OEM identity with platform secret');
 ciCheck($oem('reset',['capability'=>'oss','revision'=>6,'restore'=>false])['code']===1,'partial own config removable');
 ciCheck($platform('grant',['target_tenant_id'=>$on,'allow_platform'=>false,'revision'=>1])['code']===1,'platform revokes borrowing');ciInvalid(fn()=>Integration::resolve($on,'oss'),'revocation takes effect without cache expiry');
 ciCheck($platform('grant',['target_tenant_id'=>$on,'allow_platform'=>true,'revision'=>1])['code']!==1,'stale grant update rejected');ciCheck($platform('grant',['target_tenant_id'=>$on,'allow_platform'=>true,'revision'=>2])['code']===1,'platform can reauthorize explicitly');
 ciCheck($platform('save',['capability'=>'oss','revision'=>1,'enabled'=>false,'settings'=>$settings,'secrets'=>[]])['code']===1,'platform can stop shared capability');ciInvalid(fn()=>Integration::resolve($on,'oss'),'platform disabled config cannot be borrowed');
 ciCheck($platform('save',['capability'=>'oss','revision'=>2,'enabled'=>true,'settings'=>$settings,'secrets'=>[]])['code']===1,'platform configuration can be restored');
 ciCheck($oem('save',['capability'=>'llm','revision'=>0,'enabled'=>false,'settings'=>[],'secrets'=>[],'tenant_id'=>$off])['code']!==1,'forged OEM request context rejected');
 ciCheck($oem('save',['capability'=>'original_model','revision'=>0,'enabled'=>false])['code']!==1,'original framework config names rejected');
 ciCheck($platform('save',['capability'=>'oss','revision'=>3,'enabled'=>true,'settings'=>$settings+['endpoint'=>'https://example.com'],'secrets'=>[]])['code']!==1,'arbitrary provider endpoint injection rejected');
 $bad=$settings;$bad['prefix']='../../escape';ciCheck($platform('save',['capability'=>'oss','revision'=>3,'enabled'=>true,'settings'=>$bad,'secrets'=>[]])['code']!==1,'unsafe object prefix rejected');
 ciCheck($platform('save')['code']!==1,'GET cannot save configurations');ciCheck(ciHttp('/platformapi/integration.config/save',['capability'=>'oss'],$root,'https://example.com')['code']!==1,'cross-origin configuration writes denied');
 foreach([1,2] as $level){$agent=OemDirectoryService::saveAgent($on,['name'=>$prefix.'agent'.$level,'account'=>$prefix.'a'.$level,'password'=>'ConfigQa2026!','level'=>$level,'parent_id'=>$level===2?$agentId:0]);if($level===1)$agentId=$agent;$login=ciHttp('/tenantapi/login/account',['tenant_id'=>$on,'account'=>$prefix.'a'.$level,'password'=>'ConfigQa2026!','terminal'=>1]);ciCheck($login['code']===1&&str_starts_with($login['data']['token'],'agent_'),'agent fixture login '.$level);$r=ciHttp('/tenantapi/integration.config/lists?tenant_id='.$on,null,$login['data']['token']);ciCheck($r['code']!==1,'agent level '.$level.' cannot read OEM config');$r=ciHttp('/tenantapi/integration.config/save?tenant_id='.$on,['capability'=>'oss'],$login['data']['token']);ciCheck($r['code']!==1,'agent level '.$level.' cannot write OEM config');}
 Db::name('tenant')->where('id',$on)->update(['disable'=>1]);ciInvalid(fn()=>Integration::resolve($on,'oss'),'disabled OEM cannot continue borrowing');Db::name('tenant')->where('id',$on)->update(['disable'=>0]);
 foreach($native as $table=>$hash)ciCheck(hash('sha256',json_encode(Db::name($table)->order('id')->select()->toArray()))===$hash,'native '.$table.' configuration unchanged');
 $logs=Db::name('operation_log')->whereIn('admin_id',$admins)->whereLike('url','%integration.config%')->select()->toArray();$encoded=json_encode($logs);ciCheck(count($logs)>0&&!str_contains($encoded,$secret['access_key_id'])&&!str_contains($encoded,$secret['access_key_secret'])&&!str_contains($encoded,$ownSecret['access_key_secret']),'operation logs redact new credential requests');
 $audit=json_encode(Db::name('oem_clip_config_audit')->whereIn('tenant_id',[0,$off,$on])->select()->toArray());ciCheck(!str_contains($audit,$secret['access_key_secret'])&&!str_contains($audit,$ownSecret['access_key_secret']),'dedicated audit contains no credential payload');
 ciCheck(Integration::metadata($on,'oss')['adapter_ready']===true&&Integration::metadata($on,'oss')['live_verified']===false,'implemented adapter distinguished from live cloud verification');
}catch(Throwable $e){$failure=$e;}finally{
 foreach($tokens as $token)(new \app\common\cache\AdminTokenCache())->deleteAdminInfo($token);
 foreach($tenantTokens??[] as $token)(new \app\common\cache\TenantAdminTokenCache())->deleteAdminInfo($token);
 if(isset($admins[1])){Db::name('oem_clip_integration')->where('tenant_id',0)->where('updated_by',$admins[1])->delete();Db::name('oem_clip_config_audit')->where('tenant_id',0)->where('actor_id',$admins[1])->delete();}
 foreach($tenants as $tenant){if(!str_contains((string)Db::name('tenant')->where('id',$tenant)->value('domain_alias'),$prefix))throw new RuntimeException('Refusing cleanup of unowned tenant');$ids=Db::name('tenant_admin')->where('tenant_id',$tenant)->column('id');foreach(['tenant_admin_session','tenant_admin_role','tenant_admin_dept','tenant_admin_jobs'] as $table)if($ids)Db::name($table)->whereIn('admin_id',$ids)->delete();$tables=Db::query('SELECT TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND COLUMN_NAME=?',['aigc_local','tenant_id']);foreach($tables as $table){$name=$table['TABLE_NAME'];if(preg_match('/^la_[A-Za-z0-9_]+$/D',$name))Db::execute('DELETE FROM `'.$name.'` WHERE tenant_id=?',[$tenant]);}Db::name('tenant')->where('id',$tenant)->delete();}
 foreach($admins as $id){Db::name('operation_log')->where('admin_id',$id)->delete();Db::name('admin_session')->where('admin_id',$id)->delete();Db::name('admin_role')->where('admin_id',$id)->delete();Db::name('admin')->where('id',$id)->whereLike('account',$prefix.'%')->delete();}if($role){Db::name('system_role_menu')->where('role_id',$role)->delete();Db::name('system_role')->where('id',$role)->delete();}
}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}echo 'All '.$passed." clip integration checks passed; isolated fixtures removed; no cloud requests.\n";
