<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\OemDirectoryService;
use app\common\service\app\AppRegistryService;
use app\common\service\app\AppDisplayConfigService;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Only the isolated local preview database is allowed');
$passed=0;$fixtures=[];$fileIds=[];$failure=null;$prefix='mwqa_'.bin2hex(random_bytes(4));
function checkWorkspace(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo 'PASS '.$label."\n";}
function workspaceHttp(string $path,?array $body=null,string $token='',string $origin=''):array{
 $curl=curl_init('http://localhost:8090'.$path);$headers=['Cookie: token='.$token];if($origin!=='')$headers[]='Origin: '.$origin;
 if($body!==null){$headers[]='Content-Type: application/json';curl_setopt($curl,CURLOPT_POST,true);curl_setopt($curl,CURLOPT_POSTFIELDS,json_encode($body));}
 curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>30,CURLOPT_HTTPHEADER=>$headers]);$raw=curl_exec($curl);if($raw===false)throw new RuntimeException(curl_error($curl));$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);
 return ['status'=>$status,'json'=>json_decode($raw,true),'body'=>$raw];
}
try{
 foreach(['a','b'] as $suffix){$account=$prefix.$suffix;$id=OemDirectoryService::saveMerchant(1,['name'=>'验收商家'.$suffix,'account'=>$account,'password'=>'QaVerify2026!','status'=>1,'agent_id'=>0]);$user=(int)Db::name('oem_merchant')->where('id',$id)->value('user_id');$fixtures[]=['id'=>$id,'user'=>$user,'account'=>$account];$login=workspaceHttp('/api/merchant/login',['account'=>$account,'password'=>'QaVerify2026!','scene'=>1,'terminal'=>4])['json'];checkWorkspace(($login['code']??0)===1,'fixture merchant signs in: '.$suffix);$tokens[$suffix]=$login['data']['token'];}
 $a=$tokens['a'];$b=$tokens['b'];$uid=$fixtures[0]['user'];
 $call=fn(string $action,?array $body=null,string $token='')=>workspaceHttp('/api/merchantWorkspace/'.$action,$body,$token?:$a)['json'];
 checkWorkspace(workspaceHttp('/api/merchantWorkspace/lists?directory=store')['json']['code']===-1,'guest cannot read stores');
 checkWorkspace(workspaceHttp('/api/merchantWorkspace/save',['directory'=>'store','name'=>'no'])['json']['code']===-1,'guest cannot create stores');
 $save=function(array $p,string $token='')use($call):int{$r=$call('save',$p,$token);checkWorkspace(($r['code']??0)===1,'save '.$p['directory'].' '.($p['kind']??''));return (int)$r['data']['id'];};
 checkWorkspace($call('save',['directory'=>'store','name'=>'forged tenant','tenant_id'=>987])['code']!==1,'forged tenant context rejected');
 $store=$save(['directory'=>'store','name'=>'验收门店A','description'=>'<script>literal text</script>','user_id'=>$fixtures[1]['user']]);
 checkWorkspace((int)Db::name('oem_merchant_store')->where('id',$store)->value('user_id')===$uid,'forged owner does not change stored ownership');
 $store2=$save(['directory'=>'store','name'=>'验收门店A2']);$foreign=$save(['directory'=>'store','name'=>'其他商家门店'],$b);
 $lists=$call('lists?directory=store');checkWorkspace($lists['data']['count']===2,'store counts include only current merchant');
 checkWorkspace($call('lists?directory=store',null,$b)['data']['count']===1,'other merchant has separate directory');
 checkWorkspace($call('lists?directory=store&keyword='.rawurlencode('其他商家'))['data']['count']===0,'search cannot reveal other merchant');
 checkWorkspace($call('save',['directory'=>'store','id'=>$foreign,'name'=>'forbidden'])['code']!==1,'cross-merchant store update rejected');
 checkWorkspace($call('recycle',['directory'=>'store','id'=>$foreign])['code']!==1,'cross-merchant store recycle rejected');
 checkWorkspace($call('save',['directory'=>'material','kind'=>'topic','name'=>'forbidden','content'=>'test','store_id'=>$foreign])['code']!==1,'foreign store binding rejected');
 $topic=$save(['directory'=>'material','kind'=>'topic','name'=>'门店话题','content'=>'分享门店体验','store_id'=>$store]);
 $material=$save(['directory'=>'material','kind'=>'image_text','name'=>'通用图文','content'=>'营销正文','file_ids'=>[]]);
 $foreignMaterial=$save(['directory'=>'material','kind'=>'image_text','name'=>'其他商家图文','content'=>'private','file_ids'=>[]],$b);
 foreach([[$uid,10],[$fixtures[1]['user'],10],[$uid,20]] as [$owner,$type])$fileIds[]=(int)Db::name('tenant_file')->insertGetId(['tenant_id'=>1,'source'=>1,'source_id'=>$owner,'type'=>$type,'name'=>$prefix,'uri'=>'uploads/'.$prefix.'.fixture','storage_scope'=>'tenant','storage_engine'=>'local','storage_domain'=>'','create_time'=>time(),'update_time'=>time()]);
 $save(['directory'=>'material','kind'=>'image_text','name'=>'本商家图片','file_ids'=>[$fileIds[0]]]);
 $save(['directory'=>'material','kind'=>'video','name'=>'本商家视频','file_ids'=>[$fileIds[2]]]);
 checkWorkspace($call('save',['directory'=>'material','kind'=>'image_text','name'=>'foreign','file_ids'=>[$fileIds[1]]])['code']!==1,'other merchant uploaded file rejected');
 checkWorkspace($call('save',['directory'=>'material','kind'=>'video','name'=>'wrong type','file_ids'=>[$fileIds[0]]])['code']!==1,'image cannot masquerade as video');
 checkWorkspace($call('save',['directory'=>'material','kind'=>'video','name'=>'empty video','file_ids'=>[]])['code']!==1,'video requires a file');
 checkWorkspace($call('save',['directory'=>'material','kind'=>'topic','name'=>'empty topic','content'=>''])['code']!==1,'topic requires content');
 checkWorkspace($call('save',['directory'=>'material','id'=>$topic,'kind'=>'image_text','name'=>'changed','file_ids'=>[]])['code']!==1,'material type cannot be changed');
 checkWorkspace($call('lists?directory=material&kind=topic')['data']['count']===1,'material directory filters kind');
 checkWorkspace(count($call('choices?kind=store')['data'])===2,'store choices scoped to merchant');
 checkWorkspace(count($call('choices?kind=material')['data'])===3,'material choices exclude topics and other merchants');
 checkWorkspace($call('lists?directory=material&kind=video')['data']['lists'][0]['files'][0]['id']===$fileIds[2],'native upload metadata resolves for owned video');
 $card=$save(['directory'=>'seedcard','name'=>'门店种草卡','store_id'=>$store,'material_id'=>$material,'topic_id'=>$topic]);
 checkWorkspace($call('lists?directory=seedcard')['data']['lists'][0]['store_name']==='验收门店A','card listing resolves owned store');
 checkWorkspace($call('save',['directory'=>'seedcard','name'=>'foreign','store_id'=>$store,'material_id'=>$foreignMaterial])['code']!==1,'card cannot bind another merchant material');
 checkWorkspace($call('save',['directory'=>'seedcard','name'=>'mismatch','store_id'=>$store2,'material_id'=>$material,'topic_id'=>$topic])['code']!==1,'card topic must match store or be generic');
 checkWorkspace($call('recycle',['directory'=>'seedcard','id'=>$card,'restore'=>'0'])['code']===1,'card moves to recycle bin');
 checkWorkspace($call('lists?directory=seedcard')['data']['count']===0,'recycled card disappears from active directory');
 checkWorkspace($call('lists?directory=seedcard&trash=1')['data']['count']===1,'recycled card remains recoverable');
 checkWorkspace($call('recycle',['directory'=>'seedcard','id'=>$card,'restore'=>'1'])['code']===1,'card can be restored');
 checkWorkspace($call('lists?directory=seedcard')['data']['count']===1,'restored card is visible');
 checkWorkspace($call('lists?directory=seedcard',null,$b)['data']['count']===0,'card list is private to current merchant');
 checkWorkspace(workspaceHttp('/api/merchantWorkspace/save',['directory'=>'store','name'=>'origin'],$a,'https://example.com')['json']['code']!==1,'cross-origin writes rejected');
 checkWorkspace($call('save?directory=store&name=method')['code']!==1,'GET cannot mutate stores');
 checkWorkspace($call('lists?directory=user')['code']!==1,'table names are allowlisted');
 checkWorkspace($call('choices?kind=user')['code']!==1,'choice kinds are allowlisted');
 checkWorkspace(\app\common\service\merchant\MerchantWorkspaceService::listing(987,$uid,'store',[])['count']===0,'same user ID under another tenant reveals no stores');
 foreach(['/ai/stores','/ai/materials/video','/ai/materials/image-text','/ai/materials/topics','/ai/seedcards'] as $path){$guest=workspaceHttp($path);checkWorkspace($guest['status']===302,'independent route is login gated: '.$path);$own=workspaceHttp($path,null,$a);checkWorkspace($own['status']===200&&str_contains($own['body'],'background:var(--ia-bg,#08140f)')&&str_contains($own['body'],'/merchant/workspace.js'),'independent route returns theme-aware merchant shell: '.$path);}
 Db::name('oem_merchant_app_access')->insert(['tenant_id'=>1,'user_id'=>$uid,'app_codes'=>'[]','update_time'=>time()]);
 checkWorkspace($call('lists?directory=store')['code']!==1,'merchant app authorization remains enforced');
 Db::name('oem_merchant_app_access')->where(['tenant_id'=>1,'user_id'=>$uid])->delete();
 $entries=AppRegistryService::frontendEntries(1,'pc');$codes=array_unique(array_column($entries,'app_code'));
 foreach(glob(dirname(__DIR__).'/app/apps/*/manifest.json') as $file){$m=json_decode(file_get_contents($file),true);if(!in_array('pc',$m['frontends']??[],true))continue;checkWorkspace(in_array($m['code'],$codes,true),'existing PC app frontend enabled: '.$m['code']);checkWorkspace(AppDisplayConfigService::detail(1,$m['code'])['status']===1,'existing PC app display enabled: '.$m['code']);}
 foreach(['/ai/tools/aigc_music','/ai/tools/aigc_music_cover','/ai/smart_clip','/ai/avatar?tab=image_human','/ai/tools/aigc_background_removal','/ai/tools/aigc_model_wear','/ai/tools/aigc_fashion_lookbook','/ai/tools/aigc_watermark_removal','/app/aigc_geo'] as $path){$r=workspaceHttp($path,null,$a);checkWorkspace($r['status']===200&&str_contains($r['body'],'__nuxt'),'existing page loads without generation: '.$path);}
}catch(Throwable $e){$failure=$e;}finally{
 foreach($fixtures as $fixture){$where=['tenant_id'=>1,'user_id'=>$fixture['user']];foreach(['oem_merchant_store','oem_merchant_material','oem_merchant_seedcard','oem_merchant_app_access','user_membership','user_session'] as $table)Db::name($table)->where($where)->delete();Db::name('oem_merchant')->where(['id'=>$fixture['id']]+$where)->delete();Db::name('user')->where(['tenant_id'=>1,'id'=>$fixture['user'],'account'=>$fixture['account']])->delete();}
 if($fileIds)Db::name('tenant_file')->whereIn('id',$fileIds)->where('name',$prefix)->delete();
}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}echo 'All '.$passed." workspace HTTP checks passed; owned fixtures removed; no AI generation calls.\n";
