<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Isolated local preview required');
$passed=0;$failure=null;$tenantId=0;$agents=[];$adminId=0;$staffToken=bin2hex(random_bytes(16));$prefix='pq'.bin2hex(random_bytes(3));$root=trim(file_get_contents(dirname(__DIR__).'/runtime/local/platform-token.txt'));
function platformCheck(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo 'PASS '.$label."\n";}
function platformHttp(string $path,?array $body=null,string $token='',string $origin=''):array{
 $ch=curl_init('http://127.0.0.1:8090'.$path);$headers=[];if($token!=='')$headers[]='token: '.$token;if($origin!=='')$headers[]='Origin: '.$origin;if($body!==null){$headers[]='Content-Type: application/json';curl_setopt($ch,CURLOPT_POST,true);curl_setopt($ch,CURLOPT_POSTFIELDS,json_encode($body));}
 curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>30,CURLOPT_HTTPHEADER=>$headers]);$raw=curl_exec($ch);if($raw===false)throw new RuntimeException(curl_error($ch));curl_close($ch);return json_decode($raw,true)??[];
}
function platformSave(array $p,string $root):array{return platformHttp('/platformapi/channel.directory/save',$p,$root);}
try{
 platformCheck((platformHttp('/platformapi/channel.directory/lists')['code']??0)!==1,'anonymous platform directory reads denied');platformCheck((platformSave(['kind'=>'first','name'=>'禁止创建'],'')['code']??0)!==1,'anonymous platform provisioning denied');
 $tenantToken=trim(file_get_contents(dirname(__DIR__).'/runtime/local/tenant-token.txt'));platformCheck((platformHttp('/platformapi/channel.directory/lists',null,$tenantToken)['code']??0)!==1,'OEM token cannot access the platform directory');
 $adminId=(int)Db::name('admin')->insertGetId(['name'=>'平台权限验收员工','account'=>$prefix,'password'=>md5(random_bytes(16)),'root'=>0,'create_time'=>time()]);Db::name('admin_session')->insert(['admin_id'=>$adminId,'terminal'=>1,'token'=>$staffToken,'expire_time'=>time()+3600]);
 platformCheck(platformHttp('/platformapi/channel.directory/lists',null,$staffToken)['code']!==1,'ungranted platform staff cannot list channels');platformCheck(platformSave(['kind'=>'oem','name'=>'禁止开通'],$staffToken)['code']!==1,'ungranted platform staff cannot provision accounts');
 $initial=platformHttp('/platformapi/channel.directory/lists',null,$root);platformCheck(($initial['code']??0)===1,'platform root can read unified agent directory');platformCheck(isset($initial['data']['stats']['oem'],$initial['data']['stats']['first'],$initial['data']['stats']['second']),'platform directory includes all three channel types');
 $oem=['kind'=>'oem','name'=>'平台开通验收'.$prefix,'account'=>$prefix.'oem','password'=>'PlatformQa2026!','domain_alias'=>$prefix.'.example.test','valid_days'=>365,'status'=>1];
 $result=platformSave($oem,$root);platformCheck(($result['code']??0)===1,'platform can provision a complete OEM');$tenantId=(int)$result['data']['id'];
 platformCheck((int)Db::name('tenant_admin')->where('tenant_id',$tenantId)->where('root',1)->count()===1,'OEM provisioning creates its management account');
 platformCheck(Db::name('tenant_system_menu')->where('tenant_id',$tenantId)->count()>5&&Db::name('tenant_config')->where('tenant_id',$tenantId)->count()>0,'OEM provisioning initializes menus and configuration');
 platformCheck((float)Db::name('tenant')->where('id',$tenantId)->value('point_balance')===0.0,'new OEM starts without a platform balance grant');
 $login=platformHttp('/tenantapi/login/account',['tenant_id'=>$tenantId,'account'=>$oem['account'],'password'=>$oem['password'],'terminal'=>1]);platformCheck(($login['code']??0)===1&&!str_starts_with($login['data']['token']??'','agent_'),'platform-created OEM can use unified admin login');$oemToken=$login['data']['token'];
 foreach(['first','second']as $kind){$p=['kind'=>$kind,'oem_id'=>$tenantId,'name'=>'平台验收'.($kind==='first'?'一级':'二级').$prefix,'account'=>$prefix.$kind,'password'=>'PlatformQa2026!','status'=>1];if($kind==='second')$p['parent_id']=$agents['first'];$r=platformSave($p,$root);platformCheck(($r['code']??0)===1,'platform can open '.$kind.' agent');$agents[$kind]=(int)$r['data']['id'];}
 platformCheck((int)Db::name('oem_agent')->where('id',$agents['second'])->value('parent_id')===$agents['first'],'second-level agent is linked to the selected parent');
 foreach(['first','second']as $kind){$r=platformHttp('/tenantapi/login/account',['tenant_id'=>$tenantId,'account'=>$prefix.$kind,'password'=>'PlatformQa2026!','terminal'=>1]);platformCheck(($r['code']??0)===1&&str_starts_with($r['data']['token']??'','agent_'),'platform-created '.$kind.' uses unified login');$r=platformHttp('/platformapi/channel.directory/lists',null,$r['data']['token']);platformCheck(($r['code']??0)!==1,'agent cannot read global platform data');}
 $r=platformHttp('/platformapi/channel.directory/lists?oem_id='.$tenantId,null,$root);platformCheck($r['code']===1&&$r['data']['count']===3,'OEM filter returns its OEM and both agents');
 $r=platformHttp('/platformapi/channel.directory/lists?oem_id='.$tenantId.'&kind=second',null,$root);platformCheck($r['data']['count']===1&&$r['data']['lists'][0]['parent_name']==='平台验收一级'.$prefix,'type filter preserves the displayed parent relationship');
 $r=platformHttp('/platformapi/channel.directory/lists?keyword='.rawurlencode($prefix.'first'),null,$root);platformCheck($r['data']['count']===1&&$r['data']['lists'][0]['kind']==='first','platform directory searches by login account');
 platformCheck(!str_contains(json_encode($r),'password_hash')&&!str_contains(json_encode($r),'token_hash'),'platform directory never returns credential hashes');
 $dashboard=platformHttp('/platformapi/workbench/index',null,$root);$all=platformHttp('/platformapi/channel.directory/lists',null,$root);
 platformCheck($dashboard['code']===1&&$dashboard['data']['summary_cards'][0]['title']==='代理总数'&&(int)$dashboard['data']['summary_cards'][0]['value']===array_sum($all['data']['stats']),'platform dashboard agent count includes OEM and both levels');
 platformCheck(in_array('代理管理',array_column($dashboard['data']['menu'],'name'),true)&&$dashboard['data']['summary_cards'][1]['title']==='商家总数','platform dashboard uses agent and merchant terminology');
 $other=Db::name('oem_agent')->where('tenant_id',1)->where('level',1)->value('id');if($other)platformCheck(platformSave(['kind'=>'second','oem_id'=>$tenantId,'name'=>'越权上级','account'=>$prefix.'bad','password'=>'PlatformQa2026!','parent_id'=>$other],$root)['code']!==1,'second-level parent cannot cross OEM boundaries');
 platformCheck(platformSave(['kind'=>'first','id'=>$agents['first'],'oem_id'=>1,'name'=>'错误归属','account'=>$prefix.'first'],$root)['code']!==1,'existing agent cannot be moved to another OEM by forged ID');
 platformCheck(platformSave(['kind'=>'second','oem_id'=>$tenantId,'name'=>'缺失上级','account'=>$prefix.'bad','password'=>'PlatformQa2026!','parent_id'=>0],$root)['code']!==1,'second-level provisioning requires a valid parent');
 platformCheck(platformSave(['kind'=>'third','name'=>'错误级别'],$root)['code']!==1,'unsupported channel type rejected');
 platformCheck(platformSave($oem+['id'=>0],$root)['code']!==1,'duplicate OEM domain rejected without a partial account');
 platformCheck(platformSave(['kind'=>'first','oem_id'=>$tenantId,'name'=>'弱密码','account'=>$prefix.'weak','password'=>'12345678'],$root)['code']!==1,'weak initial agent password rejected');
 $edited=platformSave(['kind'=>'second','id'=>$agents['second'],'oem_id'=>$tenantId,'name'=>'平台修改后的二级代理','account'=>$prefix.'second','password'=>'','parent_id'=>$agents['first'],'status'=>1],$root);platformCheck($edited['code']===1,'platform can edit a second-level agent without resetting its password');
 platformCheck(platformHttp('/platformapi/channel.directory/save',null,$root)['code']!==1,'platform channel writes require POST');
 platformCheck(platformHttp('/platformapi/channel.directory/save',['kind'=>'oem'], $root,'https://example.com')['code']!==1,'cross-origin platform writes rejected');
 $edited=platformSave(['kind'=>'oem','id'=>$tenantId,'name'=>'平台修改后的 OEM','account'=>$prefix.'oem','password'=>'','mobile'=>'','status'=>0],$root);platformCheck($edited['code']===1,'platform can pause an OEM without losing existing configuration');
 platformCheck(platformHttp('/tenantapi/auth.admin/mySelf?tenant_id='.$tenantId,null,$oemToken)['code']!==1,'paused OEM cannot reuse its previous management session');
 platformCheck(platformSave(['kind'=>'first','oem_id'=>$tenantId,'name'=>'停用 OEM 下开通','account'=>$prefix.'stop','password'=>'PlatformQa2026!'],$root)['code']!==1,'new agents cannot be opened under a paused OEM');
 platformCheck(Db::name('tenant_domain_alias')->where('tenant_id',$tenantId)->where('domain',$oem['domain_alias'])->count()===1,'OEM editing preserves its bound domain');
}catch(\Throwable $e){$failure=$e;}finally{
 if($tenantId>0){
  if(Db::name('tenant')->where('id',$tenantId)->value('domain_alias')!==$oem['domain_alias'])throw new RuntimeException('Refusing cleanup of an unowned OEM fixture');
  $admins=Db::name('tenant_admin')->where('tenant_id',$tenantId)->column('id');foreach(['tenant_admin_session','tenant_admin_role','tenant_admin_dept','tenant_admin_jobs']as $table)if($admins)Db::name($table)->whereIn('admin_id',$admins)->delete();
  $tables=Db::query('SELECT TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND COLUMN_NAME=?',['aigc_local','tenant_id']);foreach($tables as $table){$name=$table['TABLE_NAME'];if(preg_match('/^la_[A-Za-z0-9_]+$/D',$name))Db::execute('DELETE FROM `'.$name.'` WHERE tenant_id=?',[$tenantId]);}
  Db::name('tenant')->where('id',$tenantId)->where('sn','<>','localdemo')->delete();
 }
 if($adminId){(new \app\common\cache\AdminTokenCache())->deleteAdminInfo($staffToken);Db::name('admin_session')->where('admin_id',$adminId)->where('token',$staffToken)->delete();Db::name('admin')->where('id',$adminId)->where('account',$prefix)->where('root',0)->delete();}
}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}echo 'All '.$passed." platform channel HTTP checks passed; owned fixtures removed.\n";
