<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\OemDirectoryService;
use app\common\service\merchant\MerchantMaterialService;
use app\common\service\merchant\clip\ClipConfiguration;
use app\common\service\merchant\clip\ClipPlanner;
use app\common\service\merchant\clip\MerchantClipService;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Isolated preview only');
$passed=0;$fixtures=[];$temp=[];$failure=null;$prefix='clipqa_'.bin2hex(random_bytes(4));
function ccCheck(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo 'PASS '.$label."\n";}
function ccHttp(string $action,?array $body=null,string $token='',string $origin=''):array{
 $curl=curl_init('http://localhost:8090/api/merchantClip/'.$action);$headers=['Cookie: token='.$token];if($origin)$headers[]='Origin: '.$origin;
 if($body!==null){$headers[]='Content-Type: application/json';curl_setopt($curl,CURLOPT_POST,true);curl_setopt($curl,CURLOPT_POSTFIELDS,json_encode($body));}
 curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>45,CURLOPT_HTTPHEADER=>$headers]);$raw=curl_exec($curl);if($raw===false)throw new RuntimeException(curl_error($curl));curl_close($curl);$json=json_decode($raw,true);if(!is_array($json))throw new RuntimeException('Invalid HTTP JSON for '.$action);return $json;
}
function ccInvalid(callable $work,string $label):void{try{$work();}catch(InvalidArgumentException){ccCheck(true,$label);return;}ccCheck(false,$label);}
function ccUpload(string $token,string $kind,string $path,string $name,string $controller='merchantWorkspace'):array{
 $curl=curl_init('http://localhost:8090/api/'.$controller.'/upload');curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>30,CURLOPT_HTTPHEADER=>['Cookie: token='.$token],CURLOPT_POSTFIELDS=>['kind'=>$kind,'file'=>new CURLFile($path,'application/octet-stream',$name)]]);$raw=curl_exec($curl);curl_close($curl);$result=json_decode($raw,true)??[];ccCheck(($result['code']??0)===1,'real owned upload '.$kind.' via '.$controller);return $result['data'];
}
try{
 $base=ClipConfiguration::normalize([]);ccCheck($base['version']===1&&$base['mode']==='quick','versioned defaults');
 foreach([['fps'=>29],['duration_range'=>[20,10]],['ratio'=>'arbitrary'],['mute'=>'false'],['speed'=>0],['voice_speed'=>4],['material_ids'=>['https://example.com/a.mp4']],['colors'=>['hue'=>101]],['background'=>['color'=>'url(bad)']],['groups'=>[]],['subtitles'=>[str_repeat('字',801)]],['titles'=>[str_repeat('字',51)]],['material_ids'=>range(1,101)],['groups'=>array_fill(0,31,[])],['stickers'=>array_fill(0,51,[])] ] as $i=>$patch)ccInvalid(fn()=>ClipConfiguration::normalize($patch),'configuration validation '.$i);
 $c=ClipConfiguration::normalize(['mode'=>'mix','material_ids'=>[1,2,3],'shot_range'=>[2,2],'clip_range'=>[3,3]]);$assets=[1=>['kind'=>'image'],2=>['kind'=>'video','duration'=>10],3=>['kind'=>'video','duration'=>2]];
 $p=(new ClipPlanner('reproducible'))->build($c,$assets);ccCheck($p===(new ClipPlanner('reproducible'))->build($c,$assets),'same seed produces deterministic plan');ccCheck(count($p['shots'])===2&&count(array_unique(array_column($p['shots'],'material_id')))===2,'mix samples without replacement');ccCheck($p['duration']===6.0,'planned durations sum');
 $short=(new ClipPlanner('s'))->build(ClipConfiguration::normalize(['mode'=>'mix','material_ids'=>[3],'clip_range'=>[5,5]]),$assets);ccCheck($short['shots'][0]['loop']&&$short['shots'][0]['source_out']<=2,'short clips use explicit loop flag and bounded source trim');
 ccInvalid(fn()=>(new ClipPlanner('s'))->build(ClipConfiguration::normalize(['mode'=>'mix','material_ids'=>[1],'shot_range'=>[2,2]]),$assets),'insufficient pool rejected');
 ccInvalid(fn()=>(new ClipPlanner('s'))->build(ClipConfiguration::normalize(['mode'=>'storyboard','groups'=>[['material_ids'=>[1],'texts'=>['口播']]],'subtitle_mode'=>'group','duration_basis'=>'voice']),$assets),'text without synthesized narration cannot pretend voice duration');
 ccInvalid(fn()=>(new ClipPlanner('s'))->build(ClipConfiguration::normalize(['material_ids'=>[2]]),[2=>['kind'=>'video','duration'=>null]]),'unknown metadata cannot invent video duration');
 $global=(new ClipPlanner('g'))->build(ClipConfiguration::normalize(['mode'=>'mix','duration_basis'=>'voice','material_ids'=>[1],'voiceover_ids'=>[4],'voice_speed'=>2]),$assets+[4=>['kind'=>'voiceover','duration'=>12]]);ccCheck($global['duration']===6.0,'global narration determines total duration with playback rate');
 ccInvalid(fn()=>(new ClipPlanner('g'))->build(ClipConfiguration::normalize(['mode'=>'mix','duration_basis'=>'voice','material_ids'=>[1],'voiceover_ids'=>[4]]),$assets+[4=>['kind'=>'voiceover','duration'=>.001]]),'global narration cannot produce sub-frame shots');
 ccInvalid(fn()=>(new ClipPlanner('g'))->build(ClipConfiguration::normalize(['mode'=>'storyboard','duration_basis'=>'voice','groups'=>[['material_ids'=>[1],'voiceover_ids'=>[4]]]]),$assets+[4=>['kind'=>'voiceover','duration'=>.001]]),'group narration cannot produce sub-frame shots');
 foreach(['a','b'] as $suffix){$account=$prefix.$suffix;$id=OemDirectoryService::saveMerchant(1,['name'=>'剪辑验收'.$suffix,'account'=>$account,'password'=>'QaVerify2026!','status'=>1,'agent_id'=>0]);$user=(int)Db::name('oem_merchant')->where('id',$id)->value('user_id');$fixtures[]=['id'=>$id,'user'=>$user,'account'=>$account];$curl=curl_init('http://localhost:8090/api/merchant/login');curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_POSTFIELDS=>json_encode(['account'=>$account,'password'=>'QaVerify2026!','scene'=>1,'terminal'=>4])]);$r=json_decode(curl_exec($curl),true);curl_close($curl);ccCheck(($r['code']??0)===1,'fixture login '.$suffix);$tokens[$suffix]=$r['data']['token'];}
 $a=$tokens['a'];$b=$tokens['b'];$call=fn($path,$body=null,$token='')=>ccHttp($path,$body,$token?:$a);
 foreach(['lists','capabilities','detail?id=1','plans?project_id=1','cloudJobs?project_id=1','voices','delivery?job_id=1'] as $path)ccCheck(ccHttp($path)['code']===-1,'guest denied '.$path);
 foreach(['script','voice','transcribe','render','upload'] as $action)ccCheck(ccHttp($action,['id'=>1,'revision'=>1])['code']===-1,'guest cannot submit '.$action);
 ccCheck($call('capabilities')['data']['rendering']===false,'unconfigured cloud never advertised ready');
 $imagePath=dirname(__DIR__).'/runtime/local/'.$prefix.'.png';$temp[]=$imagePath;$image=imagecreatetruecolor(80,80);imagefill($image,0,0,imagecolorallocate($image,70,130,90));imagepng($image,$imagePath);imagedestroy($image);
 $wavPath=dirname(__DIR__).'/runtime/local/'.$prefix.'.wav';$temp[]=$wavPath;$pcm=str_repeat("\0",16000);file_put_contents($wavPath,'RIFF'.pack('V',36+strlen($pcm)).'WAVEfmt '.pack('VvvVVvv',16,1,1,8000,16000,2,16).'data'.pack('V',strlen($pcm)).$pcm);
 $img=ccUpload($a,'image',$imagePath,'剪辑图片.png');$audio=ccUpload($a,'audio',$wavPath,'背景.wav');$voice=ccUpload($a,'voiceover',$wavPath,'旁白.wav','merchantClip');$foreign=ccUpload($b,'image',$imagePath,'外部图片.png');
 $cfg=ClipConfiguration::normalize(['mode'=>'mix','material_ids'=>[(int)$img['id']],'music_ids'=>[(int)$audio['id']],'titles'=>['标题A','标题B'],'clip_range'=>[3,5]]);
 $r=$call('save',['kind'=>'project','name'=>'自有工程','config'=>$cfg]);ccCheck($r['code']===1,'project persisted');$id=(int)$r['data']['id'];$rev=(int)$r['data']['revision'];
 ccCheck($call('lists')['data']['count']===1&&$call('lists',null,$b)['data']['count']===0,'project lists merchant isolated');
 ccCheck($call('detail?id='.$id)['data']['config']==$cfg,'full normalized configuration round trips');
 ccCheck($call('detail?id='.$id,null,$b)['code']!==1,'foreign project cannot read');
 ccCheck($call('save',['id'=>$id,'revision'=>$rev,'kind'=>'project','name'=>'forged','config'=>$cfg],$b)['code']!==1,'foreign project cannot modify');
 ccCheck($call('recycle',['id'=>$id],$b)['code']!==1,'foreign project cannot trash');
 ccCheck($call('plan',['id'=>$id,'revision'=>$rev,'count'=>1,'seed'=>'x'],$b)['code']!==1,'foreign project cannot compose');
 ccCheck($call('plans?project_id='.$id,null,$b)['code']!==1,'foreign plan list denied');
 ccCheck($call('cloudJobs?project_id='.$id,null,$b)['code']!==1,'foreign cloud job list denied');
 foreach(['script','voice','transcribe','render'] as $action)ccCheck($call($action,['id'=>$id,'revision'=>$rev],$b)['code']!==1,'foreign cloud submit denied '.$action);
 ccCheck($call('delivery?job_id=1',null,$b)['code']!==1,'arbitrary output signed URL denied');
 $bad=$cfg;$bad['material_ids']=[(int)$foreign['id']];ccCheck($call('save',['kind'=>'project','name'=>'foreign','config'=>$bad])['code']!==1,'foreign material cannot reference');
 $bad=$cfg;$bad['music_ids']=[(int)$img['id']];ccCheck($call('save',['kind'=>'project','name'=>'bad kind','config'=>$bad])['code']!==1,'material types enforced');
 ccCheck($call('save',['id'=>$id,'revision'=>0,'kind'=>'project','name'=>'stale','config'=>$cfg])['code']!==1,'stale edits rejected');
 ccCheck($call('save',['id'=>$id,'revision'=>$rev,'kind'=>'template','name'=>'wrong kind','config'=>$cfg])['code']!==1,'record kind immutable');
 $r=$call('plan',['id'=>$id,'revision'=>$rev,'count'=>3,'seed'=>'fixed']);ccCheck($r['code']===1&&$r['data']['created']>0,'compositions saved without cloud call');$plans=$call('plans?project_id='.$id)['data']['lists'];$planIds=array_map('intval',array_column($plans,'id'));ccCheck(count($plans)>0&&$plans[0]['plan']['state']==='planned','plans never labeled rendered');
 ccCheck($call('plan',['id'=>$id,'revision'=>$rev,'count'=>3,'seed'=>'fixed'])['data']['created']===0,'same request cannot duplicate plans');
 ccCheck($call('plan',['id'=>$id,'revision'=>$rev,'count'=>101,'seed'=>'x'])['code']!==1,'plan batch bounded');
 $before=count($call('plans?project_id='.$id)['data']['lists']);ccCheck($call('plan',['id'=>$id,'revision'=>$rev,'count'=>100,'seed'=>'overflow'])['code']!==1,'project active plan limit enforced');ccCheck(count($call('plans?project_id='.$id)['data']['lists'])===$before,'quota overflow rolls back entire composition batch');
 ccCheck($call('render',['id'=>$id])['code']!==1,'unconfigured render rejects without fake success');
 ccCheck($call('plan?id='.$id.'&count=1&seed=x')['code']!==1,'GET cannot generate plans');
 ccCheck(ccHttp('save',['kind'=>'project','name'=>'cross origin','config'=>$cfg],$a,'https://example.com')['code']!==1,'cross-origin mutation denied');
 $r=$call('save',['id'=>$id,'revision'=>$rev,'kind'=>'project','name'=>'新版','config'=>$cfg]);ccCheck($r['code']===1&&$r['data']['revision']===$rev+1,'optimistic revision increment');$rev++;
 ccCheck($call('plans?project_id='.$id)['data']['lists'][0]['outdated']===true,'plans pinned to immutable project revision');
 ccCheck($call('plan',['id'=>$id,'revision'=>$rev-1,'count'=>1,'seed'=>'old'])['code']!==1,'stale composition rejected');
 $r=$call('save',['kind'=>'template','name'=>'模板','config'=>$cfg]);ccCheck($r['code']===1,'template saved');$template=(int)$r['data']['id'];
 ccCheck($call('lists?kind=template')['data']['count']===1&&$call('lists?kind=project')['data']['count']===1,'projects and templates partitioned');
 ccCheck($call('plan',['id'=>$template,'revision'=>1,'count'=>1,'seed'=>'template'])['code']!==1,'template cannot produce without project');
 ccCheck($call('recycle',['id'=>$template])['code']===1&&$call('lists?kind=template')['data']['count']===0,'template soft delete');
 ccCheck($call('lists?kind=template&trash=1')['data']['count']===1&&$call('recycle',['id'=>$template,'restore'=>'1'])['code']===1,'template recoverable');
 ccCheck($call('removePlans',['project_id'=>$id,'ids'=>[$planIds[0]]],$b)['code']!==1,'foreign plan remove denied');
 ccCheck($call('removePlans',['project_id'=>$id,'ids'=>[$planIds[0],999999999]])['code']!==1,'mixed invalid batch rejected atomically');
 ccCheck(count($call('plans?project_id='.$id)['data']['lists'])===count($plans),'failed batch preserves valid plan');
 ccCheck($call('removePlans',['project_id'=>$id,'ids'=>[$planIds[0]]])['code']===1,'owned plan removed');
 ccCheck(count($call('plans?project_id='.$id.'&trash=1')['data']['lists'])===1,'removed plans discoverable in trash');
 ccCheck($call('removePlans',['project_id'=>$id,'ids'=>[$planIds[0]],'restore'=>'1'])['code']===1,'removed plan recoverable');
 $voiceCfg=ClipConfiguration::normalize(['mode'=>'storyboard','duration_basis'=>'voice','subtitle_mode'=>'group','groups'=>[['material_ids'=>[(int)$img['id']],'voiceover_ids'=>[(int)$voice['id']],'texts'=>['真实旁白']]]]);
 $r=$call('save',['kind'=>'project','name'=>'声音时长','config'=>$voiceCfg]);$vId=(int)($r['data']['id']??0);ccCheck($r['code']===1,'storyboard with owned narration saved');$r=$call('plan',['id'=>$vId,'revision'=>1,'count'=>1,'seed'=>'voice']);ccCheck($r['code']===1,'local ffprobe narration measured');$vPlan=$call('plans?project_id='.$vId)['data']['lists'][0]['plan'];ccCheck(abs($vPlan['duration']-1)<.01,'real WAV duration used instead of guessed text duration');
 $where=['tenant_id'=>1,'user_id'=>$fixtures[0]['user']];$material=Db::name('oem_merchant_material')->where('id',$img['id'])->find();Db::name('oem_merchant_material')->where('id',$img['id'])->update(['delete_time'=>time()]);
 ccCheck($call('detail?id='.$id)['code']===1&&$call('detail?id='.$id)['data']['asset_warning']!=='','missing media does not destroy saved draft');
 ccCheck($call('plan',['id'=>$id,'revision'=>$rev,'count'=>1,'seed'=>'missing'])['code']!==1,'recycled media revalidated before composing');Db::name('oem_merchant_material')->where('id',$img['id'])->update(['delete_time'=>$material['delete_time']]);
 ccCheck(MerchantClipService::listing(987,$fixtures[0]['user'],[])['count']===0,'same numeric user in another tenant isolated');
 ccInvalid(fn()=>MerchantClipService::detail(987,$fixtures[0]['user'],$id),'cross-tenant detail denied');
 Db::name('oem_merchant_app_access')->insert(['tenant_id'=>1,'user_id'=>$fixtures[0]['user'],'app_codes'=>'[]','update_time'=>time()]);
 ccCheck($call('lists')['code']!==1&&$call('save',['kind'=>'project','name'=>'denied','config'=>$cfg])['code']!==1,'smart_clip entitlement guards reads and writes');
}catch(Throwable $e){$failure=$e;}finally{
 foreach($fixtures as $fixture){$where=['tenant_id'=>1,'user_id'=>$fixture['user']];$files=Db::name('tenant_file')->where(['tenant_id'=>1,'source'=>1,'source_id'=>$fixture['user']])->select()->toArray();foreach($files as $file){if($file['storage_engine']==='local'){$base=realpath(dirname(__DIR__).'/public/uploads');$path=realpath(dirname(__DIR__).'/public/'.ltrim($file['uri'],'/'));if($base&&$path&&str_starts_with(str_replace('\\','/',$path),str_replace('\\','/',$base).'/')&&is_file($path))unlink($path);}Db::name('tenant_file')->where(['id'=>$file['id'],'tenant_id'=>1,'source'=>1,'source_id'=>$fixture['user']])->delete();}
 foreach(['oem_clip_plan','oem_clip_document','oem_material_meta','oem_merchant_material','oem_merchant_app_access','user_membership','user_session'] as $table)Db::name($table)->where($where)->delete();Db::name('oem_merchant')->where(['id'=>$fixture['id']]+$where)->delete();Db::name('user')->where(['tenant_id'=>1,'id'=>$fixture['user'],'account'=>$fixture['account']])->delete();}
 foreach($temp as $path)if(is_file($path))unlink($path);
}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}echo 'All '.$passed." clip checks passed; owned fixtures removed; no cloud APIs called.\n";
