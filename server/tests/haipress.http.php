<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\OemDirectoryService as Directory;
use app\common\service\press\PressService;
use app\common\service\merchant\clip\ClipCredentialVault as Vault;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Dedicated local DB required');
if(Db::name('press_config')->count())throw new RuntimeException('Refusing to replace existing provider settings');
$prefix='hph'.bin2hex(random_bytes(4));$passed=0;$admins=[];$tokens=[];$tenants=[];$failure=null;
function hcheck(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo 'PASS '.$label."\n";}
function hhttp(string $path,?array $body=null,string $token='',string $cookie='',string $origin=''):array{
 $host=str_starts_with($path,'/api/')?'localhost':'127.0.0.1';$c=curl_init('http://'.$host.':8090'.$path);$headers=[];if($token)$headers[]='token: '.$token;if($cookie)$headers[]='Cookie: token='.$cookie;if($origin)$headers[]='Origin: '.$origin;
 if($body!==null){$headers[]='Content-Type: application/json';curl_setopt_array($c,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body)]);}
 curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>30,CURLOPT_HTTPHEADER=>$headers]);$raw=curl_exec($c);if($raw===false)throw new RuntimeException('Local HTTP failed');$status=curl_getinfo($c,CURLINFO_HTTP_CODE);curl_close($c);$json=json_decode($raw,true);if($status>=500)throw new RuntimeException('HTTP '.$status.' at '.strtok($path,'?'));return ['_status'=>$status,'_raw'=>$raw]+($json??['code'=>0]);
}
try{
 foreach([1,0]as $root){$id=(int)Db::name('admin')->insertGetId(['name'=>$prefix,'account'=>$prefix.'p'.$root,'root'=>$root,'password'=>create_password('PressQa2026!',config('project.unique_identification')),'create_time'=>time(),'login_ip'=>'127.0.0.1']);$admins[$root]=$id;$login=hhttp('/platformapi/login/account',['account'=>$prefix.'p'.$root,'password'=>'PressQa2026!','terminal'=>1]);hcheck($login['code']===1,'platform fixture login '.$root);$tokens[$root]=$login['data']['token'];}
 $root=$tokens[1];$staff=$tokens[0];
 hcheck(hhttp('/platformapi/media.press/config')['code']!==1,'guest cannot read provider settings');hcheck(hhttp('/platformapi/media.press/config',null,$staff)['code']!==1,'ungranted platform staff cannot read settings');
 hcheck(hhttp('/platformapi/media.press/config',null,$root)['code']===1,'platform root can read settings');
 hcheck(hhttp('/platformapi/media.press/save',null,$root)['code']!==1,'GET cannot mutate settings');hcheck(hhttp('/platformapi/media.press/save',['enabled'=>false,'revision'=>0],$root,'','https://example.com')['code']!==1,'cross origin config mutation denied');
 $secret=$prefix.'Secret';$r=hhttp('/platformapi/media.press/save',['enabled'=>false,'revision'=>0,'token'=>$prefix.'Token','key'=>$secret,'public_base'=>'https://press.example.com','markup_bps'=>1000],$root);hcheck($r['code']===1&&!str_contains(json_encode($r),$secret),'disabled config saves encrypted without echo');
 foreach([0,1]as $i){$p=['kind'=>'oem','name'=>$prefix.' OEM'.$i,'account'=>$prefix.'o'.$i,'password'=>'PressQa2026!','domain_alias'=>$prefix.$i.'.example.test','valid_days'=>365,'status'=>1];$r=hhttp('/platformapi/channel.directory/save',$p,$root);hcheck($r['code']===1,'isolated OEM creation '.$i);$tenants[$i]=(int)$r['data']['tenant_id'];$login=hhttp('/tenantapi/login/account',['account'=>$p['account'],'password'=>$p['password'],'terminal'=>1,'tenant_id'=>$tenants[$i]]);hcheck($login['code']===1,'OEM fixture login '.$i);$oemTokens[$i]=$login['data']['token'];}
 [$t,$other]=$tenants;$agentIds=[];$agentTokens=[];
 foreach([1,2,1]as $i=>$level){$aid=Directory::saveAgent($t,['name'=>$prefix.'代理'.$i,'account'=>$prefix.'a'.$i,'password'=>'PressQa2026!','level'=>$level,'parent_id'=>$level===2?$agentIds[0]:0]);$agentIds[]=$aid;$login=hhttp('/tenantapi/login/account',['account'=>$prefix.'a'.$i,'password'=>'PressQa2026!','terminal'=>1,'tenant_id'=>$t]);hcheck($login['code']===1,'agent fixture login '.$i);$agentTokens[]=$login['data']['token'];}
 $orderIds=[];$users=[];
 foreach([[$t,$agentIds[0]],[$t,$agentIds[1]],[$t,$agentIds[2]],[$other,0]]as $i=>[$tt,$aid]){
  $mid=Directory::saveMerchant($tt,['name'=>$prefix.'商家'.$i,'account'=>$prefix.'m'.$i,'password'=>'PressQa2026!','agent_id'=>$aid]);$uid=(int)Db::name('oem_merchant')->where('id',$mid)->value('user_id');$users[]=[$tt,$uid];
  $d=PressService::draftSave($tt,$uid,['title'=>'HTTP QA '.$i,'body'=>'<script>QA</script>']);$draft=Db::name('press_draft')->where('id',$d['id'])->find();if($i===0)$preview=Vault::open($draft['preview_cipher'],$tt,'press_preview')['token'];
  $orderIds[]=(int)Db::name('press_order')->insertGetId(['sn'=>$prefix.'SN'.$i,'tenant_id'=>$tt,'user_id'=>$uid,'request_key'=>$prefix.'Request'.$i,'payload_hash'=>str_repeat('a',64),'draft_id'=>$d['id'],'media_id'=>999999,'title'=>'HTTP QA '.$i,'media_name'=>'HTTP QA media','source_id'=>'QA','cost_cents'=>100,'retail_cents'=>110,'points'=>'110.00','config_revision'=>1,'account_hash'=>str_repeat('a',64),'preview_url'=>'','remark'=>'','state'=>'completed','billing_status'=>'captured','published_url'=>'https://example.com/qa','create_time'=>time(),'update_time'=>time()]);
 }
 $call=fn($action,$token,$tenant,$body=null)=>hhttp('/tenantapi/media.press/'.$action.'?tenant_id='.$tenant,$body,$token);
 foreach([$oemTokens[0],...$agentTokens]as $i=>$token){hcheck($call('config',$token,$t)['code']!==1,'OEM/agent cannot read credentials '.$i);hcheck($call('save',$token,$t,['enabled'=>true])['code']!==1,'OEM/agent cannot configure provider '.$i);hcheck($call('refund',$token,$t,['id'=>$orderIds[0],'evidence'=>'forged'])['code']!==1,'OEM/agent cannot refund '.$i);}
 $list=$call('orders',$oemTokens[0],$t);hcheck($list['code']===1&&$list['data']['count']===3&&$list['data']['summary']['consumed_cents']===330,'OEM list and usage are tenant scoped');
 hcheck($call('orders',$oemTokens[0],$other)['code']!==1,'OEM token cannot change tenant context');hcheck($call('detail&id='.$orderIds[3],$oemTokens[0],$t)['code']!==1,'foreign tenant detail denied');
 foreach([0=>2,1=>1,2=>1]as $i=>$count){$r=$call('orders',$agentTokens[$i],$t);hcheck($r['code']===1&&$r['data']['count']===$count,'agent level scope via HTTP '.$i);hcheck(!str_contains(json_encode($r['data']),'cost_cents'),'agent costs not exposed '.$i);}
 hcheck($call('detail&id='.$orderIds[0],$agentTokens[1],$t)['code']!==1,'level2 cannot request parent merchant detail');
 $r=$call('export',$agentTokens[1],$t);hcheck($r['code']===1&&$r['data']['count']===1&&!str_contains($r['data']['csv'],$prefix.'SN2'),'agent export uses same scope');
 hcheck($call('orders',$agentTokens[1],$t,[])['code']!==1,'agent read routes reject POST');
 $r=hhttp('/press-preview/'.$preview);hcheck($r['_status']===200&&str_contains($r['_raw'],'&lt;script&gt;QA&lt;/script&gt;')&&!str_contains($r['_raw'],'<script>'),'unguessable preview escapes body');hcheck(hhttp('/press-preview/'.str_repeat('0',64))['_status']===404,'invalid preview returns 404');
 $r=hhttp('/platformapi/media.press/orders',null,$root);hcheck($r['code']===1&&$r['data']['count']===4&&$r['data']['summary']['supplier_cost_cents']===400,'platform all tenant orders and supplier costs');
 $logs=json_encode(Db::name('operation_log')->whereIn('admin_id',$admins)->select()->toArray());hcheck(!str_contains($logs,$secret)&&str_contains($logs,'haipress_v1'),'native operation logs redact credentials');
 // Native merchant endpoint, using isolated accounts under the existing licensed local OEM.
 $mid=Directory::saveMerchant(1,['name'=>$prefix.'本地商家','account'=>$prefix.'local','password'=>'PressQa2026!']);$local=['id'=>$mid,'user'=>(int)Db::name('oem_merchant')->where('id',$mid)->value('user_id')];$login=hhttp('/api/merchant/login',['account'=>$prefix.'local','password'=>'PressQa2026!','scene'=>1,'terminal'=>4]);hcheck($login['code']===1,'merchant native login');$merchantToken=$login['data']['token'];
 hcheck(hhttp('/api/mediaPress/orders')['code']===-1,'guest merchant API denied');hcheck(hhttp('/api/mediaPress/orders',null,'',$merchantToken)['code']===1,'merchant own scoped order endpoint');hcheck(hhttp('/api/mediaPress/detail?id='.$orderIds[0],null,'',$merchantToken)['code']!==1,'merchant foreign direct detail denied');
 hcheck(hhttp('/api/mediaPress/draftSave',['title'=>'QA','body'=>'QA'],'',$merchantToken,'https://example.com')['code']!==1,'merchant cross origin write denied');hcheck(hhttp('/api/mediaPress/create',['confirmed'=>true,'request_key'=>str_repeat('a',32)],'',$merchantToken)['code']!==1,'disabled provider cannot place order');
}catch(Throwable $e){$failure=$e;}finally{
 foreach($tokens as $token)(new \app\common\cache\AdminTokenCache())->deleteAdminInfo($token);foreach($oemTokens??[]as $token)(new \app\common\cache\TenantAdminTokenCache())->deleteAdminInfo($token);
 if(isset($admins[1])){Db::name('press_config')->where('updated_by',$admins[1])->delete();Db::name('press_audit')->where('actor_id',$admins[1])->delete();}
 foreach($tenants as $tenant){if(!str_contains((string)Db::name('tenant')->where('id',$tenant)->value('domain_alias'),$prefix))throw new RuntimeException('Unowned tenant cleanup refused');$ids=Db::name('tenant_admin')->where('tenant_id',$tenant)->column('id');foreach(['tenant_admin_session','tenant_admin_role','tenant_admin_dept','tenant_admin_jobs']as $table)if($ids)Db::name($table)->whereIn('admin_id',$ids)->delete();$tables=Db::query('SELECT TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND COLUMN_NAME=?',['aigc_local','tenant_id']);foreach($tables as $table){$name=$table['TABLE_NAME'];if(preg_match('/^la_[A-Za-z0-9_]+$/D',$name))Db::execute('DELETE FROM `'.$name.'` WHERE tenant_id=?',[$tenant]);}Db::name('tenant')->where('id',$tenant)->delete();}
 if(isset($local)){foreach(['user_session','user_membership','oem_merchant_app_access']as $table)Db::name($table)->where(['tenant_id'=>1,'user_id'=>$local['user']])->delete();Db::name('oem_merchant')->where('id',$local['id'])->delete();Db::name('user')->where(['tenant_id'=>1,'id'=>$local['user'],'account'=>$prefix.'local'])->delete();}
 foreach($admins as $id){Db::name('operation_log')->where('admin_id',$id)->delete();Db::name('admin_session')->where('admin_id',$id)->delete();Db::name('admin')->where('id',$id)->whereLike('account',$prefix.'%')->delete();}
}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage().' @'.$failure->getFile().':'.$failure->getLine()."\n");exit(1);}echo 'All '.$passed." HTTP checks passed; owned fixtures removed; no provider network requests.\n";
