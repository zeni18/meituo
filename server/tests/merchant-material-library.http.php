<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\OemDirectoryService;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Isolated preview only');
$passed=0;$fixtures=[];$uploads=[];$temp=[];$failure=null;$prefix='mlqa_'.bin2hex(random_bytes(4));
function mlCheck(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo 'PASS '.$label."\n";}
function mlHttp(string $action,?array $body=null,string $token='',string $origin=''):array{
 $curl=curl_init('http://localhost:8090/api/merchantWorkspace/'.$action);$headers=['Cookie: token='.$token];if($origin)$headers[]='Origin: '.$origin;
 if($body!==null){$headers[]='Content-Type: application/json';curl_setopt($curl,CURLOPT_POST,true);curl_setopt($curl,CURLOPT_POSTFIELDS,json_encode($body));}
 curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>30,CURLOPT_HTTPHEADER=>$headers]);$raw=curl_exec($curl);if($raw===false)throw new RuntimeException(curl_error($curl));curl_close($curl);$json=json_decode($raw,true);if(!is_array($json))throw new RuntimeException('Invalid HTTP JSON for '.$action);return $json;
}
function mlUpload(string $token,string $kind,string $file,string $name,int $folder=0,bool $attach=false):array{
 $curl=curl_init('http://localhost:8090/api/merchantWorkspace/upload');curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>30,CURLOPT_HTTPHEADER=>['Cookie: token='.$token],CURLOPT_POSTFIELDS=>['kind'=>$kind,'folder_id'=>$folder,'attach_only'=>$attach?'1':'0','file'=>new CURLFile($file,'application/octet-stream',$name)]]);$raw=curl_exec($curl);if($raw===false)throw new RuntimeException(curl_error($curl));curl_close($curl);return json_decode($raw,true)??[];
}
try{
 foreach(['a','b'] as $suffix){$account=$prefix.$suffix;$id=OemDirectoryService::saveMerchant(1,['name'=>'素材验收'.$suffix,'account'=>$account,'password'=>'QaVerify2026!','status'=>1,'agent_id'=>0]);$user=(int)Db::name('oem_merchant')->where('id',$id)->value('user_id');$fixtures[]=['id'=>$id,'user'=>$user,'account'=>$account];$curl=curl_init('http://localhost:8090/api/merchant/login');curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_POSTFIELDS=>json_encode(['account'=>$account,'password'=>'QaVerify2026!','scene'=>1,'terminal'=>4])]);$login=json_decode(curl_exec($curl),true);curl_close($curl);mlCheck(($login['code']??0)===1,'merchant login '.$suffix);$tokens[$suffix]=$login['data']['token'];}
 $a=$tokens['a'];$b=$tokens['b'];$call=fn($action,$body=null,$token='')=>mlHttp($action,$body,$token?:$a);
 $saveFolder=function($name,$kind='video',$parent=0,$token='')use($call){$r=$call('folderSave',['kind'=>$kind,'name'=>$name,'parent_id'=>$parent],$token);mlCheck($r['code']===1,'create folder '.$name);return (int)$r['data']['id'];};
 foreach(['library?kind=video','folders?kind=video','labels'] as $path)mlCheck(mlHttp($path)['code']===-1,'guest denied '.$path);
 $f=$saveFolder('门店视频');$child=$saveFolder('子分组','video',$f);$foreign=$saveFolder('其他商家','video',0,$b);$imageFolder=$saveFolder('门店图片','image');$audioFolder=$saveFolder('背景音乐','audio');
 mlCheck(count($call('folders?kind=video')['data']['lists'])===2,'folder directory owner scoped');
 mlCheck(count($call('folders?kind=image')['data']['lists'])===1,'folder directory kind scoped');
 $sibling=$saveFolder('活动视频');$childTwo=$saveFolder('子分组二','video',$f);$folderOrder=[$sibling,$f,$childTwo,$child];
 mlCheck($call('folderReorder',['kind'=>'video','ids'=>$folderOrder])['code']===1,'folder order saved atomically');
 $ordered=$call('folders?kind=video')['data']['lists'];mlCheck(array_map('intval',array_column($ordered,'id'))===$folderOrder,'saved order survives a fresh request');
 $parents=array_column($ordered,'parent_id','id');mlCheck((int)$parents[$child]===$f&&(int)$parents[$childTwo]===$f&&(int)$parents[$sibling]===0,'ordering preserves folder hierarchy');
 foreach([[$foreign,$f,$childTwo,$child],[$sibling,$imageFolder,$childTwo,$child],[$sibling,$f,$childTwo],[$sibling,$f,$childTwo,$childTwo],[],['1x',$f,$childTwo,$child]] as $ids)mlCheck($call('folderReorder',['kind'=>'video','ids'=>$ids])['code']!==1,'invalid or out-of-scope folder order rejected');
 mlCheck($call('folderReorder',['kind'=>'image','ids'=>$folderOrder])['code']!==1,'other material type cannot be sorted');
 mlCheck(mlHttp('folderReorder',['kind'=>'video','ids'=>$folderOrder])['code']===-1,'guest cannot reorder folders');
 mlCheck(mlHttp('folderReorder',['kind'=>'video','ids'=>$folderOrder],$a,'https://invalid.example')['code']!==1,'cross-origin folder ordering denied');
 mlCheck($call('folderReorder?kind=video')['code']!==1,'GET cannot change folder order');
 mlCheck(array_map('intval',array_column($call('folders?kind=video')['data']['lists'],'id'))===$folderOrder,'rejected reorder leaves all folder ranks unchanged');
 mlCheck($call('folderSave',['kind'=>'video','name'=>'外部父级','parent_id'=>$foreign])['code']!==1,'foreign parent rejected');
 mlCheck($call('folderSave',['id'=>$foreign,'kind'=>'video','name'=>'外部修改'])['code']!==1,'foreign folder update rejected');
 mlCheck($call('folderSave',['id'=>$f,'kind'=>'video','name'=>'循环','parent_id'=>$child])['code']!==1,'folder cycle rejected');
 mlCheck($call('folderSave',['kind'=>'video','name'=>'跨类型','parent_id'=>$imageFolder])['code']!==1,'folder kinds cannot mix');
 mlCheck($call('folderSave',['kind'=>'video','name'=>'门店视频'])['code']!==1,'duplicate sibling name rejected');
 $depth=$child;foreach([3,4,5] as $level)$depth=$saveFolder('层级'.$level,'video',$depth);
 mlCheck($call('folderSave',['kind'=>'video','name'=>'层级6','parent_id'=>$depth])['code']!==1,'maximum folder depth enforced on create');
 mlCheck($call('folderRecycle',['kind'=>'video','id'=>$f])['code']!==1,'nonempty parent cannot be removed');
 $r=$call('labelSave',['name'=>'门店精选','color'=>'mint']);mlCheck($r['code']===1,'create label');$label=(int)$r['data']['id'];
 $r=$call('labelSave',['name'=>'私密标签','color'=>'blue'],$b);mlCheck($r['code']===1,'create foreign label');$foreignLabel=(int)$r['data']['id'];
 mlCheck(count($call('labels')['data'])===1,'labels owner scoped');
 mlCheck($call('labelSave',['id'=>$foreignLabel,'name'=>'forged'])['code']!==1,'foreign label edit rejected');
 mlCheck($call('labelSave',['name'=>'bad','color'=>'url(injection)'])['code']!==1,'label colors allowlisted');
 $imagePath=dirname(__DIR__).'/runtime/local/'.$prefix.'.png';$temp[]=$imagePath;$image=imagecreatetruecolor(8,8);imagefill($image,0,0,imagecolorallocate($image,60,150,100));imagepng($image,$imagePath);imagedestroy($image);
 $wavPath=dirname(__DIR__).'/runtime/local/'.$prefix.'.wav';$temp[]=$wavPath;$pcm=str_repeat("\0",16000);file_put_contents($wavPath,'RIFF'.pack('V',36+strlen($pcm)).'WAVEfmt '.pack('VvvVVvv',16,1,1,8000,16000,2,16).'data'.pack('V',strlen($pcm)).$pcm);
 $badPath=dirname(__DIR__).'/runtime/local/'.$prefix.'.txt';$temp[]=$badPath;file_put_contents($badPath,'not an audio file');
 foreach([['image',$imagePath,'店铺图片.png',$imageFolder,$a],['audio',$wavPath,'门店背景.wav',$audioFolder,$a],['voiceover',$wavPath,'商家口播.wav',0,$a],['image',$imagePath,'其他商家图片.png',0,$b]] as [$kind,$path,$name,$folder,$token]){$r=mlUpload($token,$kind,$path,$name,$folder);mlCheck(($r['code']??0)===1,'real multipart upload '.$kind);$uploads[]=(int)$r['data']['file']['id'];$media[]=(int)$r['data']['id'];$url=$r['data']['file']['uri'];if(!in_array(parse_url($url,PHP_URL_HOST),['localhost','127.0.0.1'],true))throw new RuntimeException('Local delivery URL required');$curl=curl_init($url);curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15,CURLOPT_FOLLOWLOCATION=>false]);$delivered=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);mlCheck($status===200&&is_string($delivered)&&hash_equals(hash_file('sha256',$path),hash('sha256',$delivered)),'upload URL returns exact original media bytes '.$kind);}
 [$img,$audio,$voice,$otherImage]=$media;
 mlCheck(mlUpload($a,'audio',$badPath,'forged.mp3')['code']!==1,'audio MIME spoof rejected');
 mlCheck(mlUpload($a,'video',$imagePath,'forged.mp4')['code']!==1,'video MIME spoof rejected');
 mlCheck(mlUpload($a,'image',$imagePath,'forged.png',$foreign)['code']!==1,'upload to foreign folder rejected');
 mlCheck($call('library?kind=image')['data']['count']===1,'media owner counts scoped');
 mlCheck($call('library?kind=audio')['data']['lists'][0]['folder_id']===$audioFolder,'audio assigned to selected folder');
 mlCheck($call('library?kind=voiceover')['data']['count']===1,'voiceover separated from background audio');
 mlCheck($call('library?kind=image&folder_id=0')['data']['count']===0,'unfiled excludes assigned image');
 $r=$call('batch',['kind'=>'image','ids'=>[$img],'action'=>'label','label_ids'=>[$label]]);mlCheck($r['code']===1,'apply labels');
 mlCheck($call('library?kind=image&label_id='.$label)['data']['count']===1,'label filter resolves actual media');
 mlCheck($call('library?kind=image')['data']['lists'][0]['labels']===['门店精选'],'label names hydrated');
 mlCheck($call('labelRemove',['id'=>$label])['code']!==1,'in-use label cannot be deleted');
 mlCheck($call('batch',['kind'=>'image','ids'=>[$img],'action'=>'label','label_ids'=>[$foreignLabel]])['code']!==1,'foreign label assignment rejected');
 mlCheck($call('library?kind=image&label_id='.$foreignLabel)['code']!==1,'foreign label probing rejected');
 mlCheck($call('batch',['kind'=>'image','ids'=>[$img,$otherImage],'action'=>'trash'])['code']!==1,'mixed-owner batch rejected atomically');
 mlCheck($call('library?kind=image')['data']['count']===1,'valid row unchanged after rejected batch');
 mlCheck($call('batch',['kind'=>'image','ids'=>[$img],'action'=>'move','folder_id'=>$foreign])['code']!==1,'foreign folder move rejected');
 mlCheck($call('batch',['kind'=>'image','ids'=>[$img],'action'=>'move','folder_id'=>$f])['code']!==1,'cross-kind move rejected');
 mlCheck($call('batch',['kind'=>'image','ids'=>[$img],'action'=>'move','folder_id'=>0])['code']===1,'move to unfiled succeeds');
 mlCheck($call('library?kind=image&folder_id=0')['data']['count']===1,'unfiled reflects actual move');
 mlCheck($call('folderRecycle',['kind'=>'image','id'=>$imageFolder])['code']===1,'empty folder recycled');
 mlCheck($call('folderRecycle',['kind'=>'image','id'=>$imageFolder,'restore'=>'1'])['code']===1,'empty folder restored');
 mlCheck($call('batch',['kind'=>'image','ids'=>[$img],'action'=>'trash'])['code']===1,'media recycled');
 mlCheck($call('library?kind=image')['data']['count']===0,'trash excluded from active library');
 mlCheck($call('library?kind=image&trash=1')['data']['count']===1,'trash retains media');
 mlCheck($call('batch',['kind'=>'image','ids'=>[$img],'action'=>'restore'])['code']===1,'media restored');
 mlCheck($call('library?kind=image')['data']['count']===1,'restored media visible');
 mlCheck($call('library?kind=image&keyword='.rawurlencode('不存在'))['data']['count']===0,'material search filters results');
 mlCheck($call('library?kind=image&page_size=999')['data']['page_size']===24,'page size bounded');
 mlCheck($call('library?kind=untrusted')['code']!==1,'material types allowlisted');
 mlCheck($call('batch',['kind'=>'image','ids'=>[$img],'action'=>'arbitrary'])['code']!==1,'batch actions allowlisted');
 mlCheck(mlHttp('folderSave',['kind'=>'video','name'=>'origin'],$a,'https://example.com')['code']!==1,'cross-origin writes rejected');
 mlCheck($call('folderSave?kind=video&name=bad')['code']!==1,'GET cannot mutate folders');
 $r=mlUpload($a,'image',$imagePath,'图文附件.png',0,true);mlCheck($r['code']===1&&!isset($r['data']['id']),'graphical attachment upload does not create extra image material');$uploads[]=(int)$r['data']['file']['id'];
 mlCheck($call('library?kind=image')['data']['count']===1,'attachment upload leaves raw image count unchanged');
 $r=$call('materialSave',['kind'=>'image_text','name'=>'图文内容','content'=>'正文','file_ids'=>[(int)$r['data']['file']['id']],'label_ids'=>[$label]]);mlCheck($r['code']===1,'graphical content references original owned upload');$textId=(int)$r['data']['id'];
 $storeId=\app\common\service\merchant\MerchantWorkspaceService::save(1,$fixtures[0]['user'],'store',['name'=>'使用状态验收']);$cardId=\app\common\service\merchant\MerchantWorkspaceService::save(1,$fixtures[0]['user'],'seedcard',['name'=>'素材引用','store_id'=>$storeId,'material_id'=>$textId]);
 mlCheck($call('library?kind=image_text&usage=used')['data']['count']===1,'usage derives from actual seedcard reference');
 mlCheck($call('library?kind=image_text&usage=unused')['data']['count']===0,'used and unused filters mutually exclusive');
 mlCheck($call('choices?kind=material')['data'][0]['id']==$textId&&count($call('choices?kind=material')['data'])===1,'new audio/images cannot enter incompatible legacy seedcard picker');
 mlCheck($call('materialSave',['kind'=>'image','id'=>$otherImage,'name'=>'forged','file_ids'=>[$uploads[0]]])['code']!==1,'foreign material edit rejected');
 foreach(range(1,25) as $index)\app\common\service\merchant\MerchantWorkspaceService::save(1,$fixtures[0]['user'],'material',['kind'=>'topic','name'=>sprintf('分页话题%02d',$index),'content'=>'验收正文']);
 mlCheck($call('library?kind=topic&page=1&page_size=24')['data']['count']===25&&count($call('library?kind=topic&page=1&page_size=24')['data']['lists'])===24,'pagination reports real total and first page');
 mlCheck(count($call('library?kind=topic&page=2&page_size=24')['data']['lists'])===1,'pagination returns remaining rows');
 mlCheck($call('library?kind=topic&sort=name')['data']['lists'][0]['name']==='分页话题01','name sorting applied before pagination');
 mlCheck(\app\common\service\merchant\MerchantMaterialService::listing(987,$fixtures[0]['user'],['kind'=>'topic'])['count']===0,'same numeric user in another tenant has no media');
 mlCheck(\app\common\service\merchant\MerchantMaterialService::folders(987,$fixtures[0]['user'],['kind'=>'video'])['lists']===[],'same numeric user in another tenant has no folders');
 mlCheck($call('folderSave',['kind'=>'video','name'=>'forged tenant','tenant_id'=>987])['code']!==1,'forged tenant request rejected');
 mlCheck($call('batch',['kind'=>'topic','action'=>'trash','ids'=>range(1,101)])['code']!==1,'bulk operation bounded at 100 records');
 Db::name('oem_merchant_app_access')->insert(['tenant_id'=>1,'user_id'=>$fixtures[0]['user'],'app_codes'=>'[]','update_time'=>time()]);
 mlCheck($call('library?kind=image')['code']!==1,'app authorization retained');
 mlCheck($call('folderSave',['kind'=>'video','name'=>'not authorized'])['code']!==1,'app authorization also guards folder writes');
}catch(Throwable $e){$failure=$e;}finally{
 foreach($fixtures as $fixture){$where=['tenant_id'=>1,'user_id'=>$fixture['user']];$files=Db::name('tenant_file')->where(['tenant_id'=>1,'source'=>1,'source_id'=>$fixture['user']])->select()->toArray();foreach($files as $file){if($file['storage_engine']==='local'){$base=realpath(dirname(__DIR__).'/public/uploads');$path=realpath(dirname(__DIR__).'/public/'.ltrim($file['uri'],'/'));if($base&&$path&&str_starts_with(str_replace('\\','/',$path),str_replace('\\','/',$base).'/')&&is_file($path))unlink($path);}Db::name('tenant_file')->where(['id'=>$file['id'],'tenant_id'=>1,'source'=>1,'source_id'=>$fixture['user']])->delete();}
 foreach(['oem_material_meta','oem_material_folder','oem_material_label','oem_merchant_store','oem_merchant_material','oem_merchant_seedcard','oem_merchant_app_access','user_membership','user_session'] as $table)Db::name($table)->where($where)->delete();Db::name('oem_merchant')->where(['id'=>$fixture['id']]+$where)->delete();Db::name('user')->where(['tenant_id'=>1,'id'=>$fixture['user'],'account'=>$fixture['account']])->delete();}
 foreach($temp as $path)if(is_file($path))unlink($path);
}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}echo 'All '.$passed." material-library HTTP checks passed; owned fixtures/files removed; no AI calls.\n";
