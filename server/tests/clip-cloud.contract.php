<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\clip\{ClipCloudTransport,ClipCloudProvider,ClipImsTimeline,ClipConfiguration,ClipPlanner,ClipCloudJobService,ClipIntegrationService,MerchantClipService,ClipCloudFailure};
use app\common\service\merchant\{OemDirectoryService,MerchantMaterialService};
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Local isolated database required');
$passed=0;
function cloudCheck(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo 'PASS '.$label."\n";}
function cloudInvalid(callable $work,string $label):void{try{$work();}catch(InvalidArgumentException){cloudCheck(true,$label);return;}cloudCheck(false,$label);}
final class ContractCloudTransport implements ClipCloudTransport
{
    public array $calls=[];public bool $uncertain=false;public bool $fail=false;public string $renderState='Success';public array $responses=[];public string $audioBytes='';
    public function rpc(array $config,string $action,array $parameters):array{
        $this->calls[]=[$action,$config['tenant_id'],$config['source_tenant_id'],$parameters];if($this->uncertain)throw new ClipCloudFailure(true);if($this->fail)throw new ClipCloudFailure(false);
        return $action==='SubmitMediaProducingJob'?['JobId'=>'contract-job-1']:['MediaProducingJob'=>['Status'=>$this->renderState,'Duration'=>4.0,'Progress'=>100]];
    }
    public function json(string $url,array $headers,array $body):array{$this->calls[]=[$url,$headers,$body];if($this->uncertain)throw new ClipCloudFailure(true);if($this->fail)throw new ClipCloudFailure(false);return array_shift($this->responses)??['output'=>[['type'=>'message','content'=>[['type'=>'output_text','text'=>'合成文案']]]]];}
    public function upload(array $config,string $bucket,string $key,string $path):void{$this->calls[]=['upload',$config['tenant_id'],$config['source_tenant_id'],$key];if($this->fail)throw new ClipCloudFailure(false);}
    public function downloadSpeech(string $url,string $path):void{file_put_contents($path,$this->audioBytes);}
    public function signed(array $config,string $bucket,string $key,int $ttl=900):string{$this->calls[]=['sign',$config['tenant_id'],$config['source_tenant_id'],$key];return 'https://'.$bucket.'.oss-cn-shanghai.aliyuncs.com/'.$key.'?test-signature';}
}
$transport=new ContractCloudTransport();$provider=new ClipCloudProvider($transport);$prefix='cq'.bin2hex(random_bytes(6));$files=[];
$cfg=['tenant_id'=>1,'source_tenant_id'=>0,'settings'=>['region'=>'cn-shanghai','bucket'=>'contract-bucket','output_bucket'=>'contract-bucket','speaker_ids'=>'voice_a,voice_b','resource_id'=>'seed-tts-2.0','model_id'=>'contract-model'],'credentials'=>['access_key_id'=>'contractAccess','access_key_secret'=>'contractSecret','api_key'=>'contractApi']];
$c=ClipConfiguration::normalize(['mode'=>'mix','material_ids'=>[1],'clip_range'=>[5,5],'music_ids'=>[2],'voiceover_ids'=>[3],'titles'=>['测试标题'],'subtitle_mode'=>'global','subtitles'=>['字幕'],'colors'=>['contrast'=>20]]);
$a=[1=>['kind'=>'video','duration'=>2],2=>['kind'=>'audio','duration'=>8],3=>['kind'=>'voiceover','duration'=>4]];$p=(new ClipPlanner('test'))->build($c,$a);$media=[];foreach($a as $id=>$asset)$media[$id]=['url'=>'https://owned-bucket.oss-cn-shanghai.aliyuncs.com/'.$id]+$asset;
$timeline=ClipImsTimeline::compile($p,$media);$clips=$timeline['VideoTracks'][0]['VideoTrackClips'];
cloudCheck(count($clips)===3,'looped short video expands into bounded IMS clips');cloudCheck(abs(end($clips)['TimelineOut']-5)<.001,'loop duration matches saved plan');cloudCheck(max(array_column($clips,'Out'))<=2,'no out of bounds video trim');
cloudCheck($clips[0]['Effects'][0]===['Type'=>'Volume','Gain'=>0],'mute maps to documented Volume gain');cloudCheck($clips[0]['Effects'][2]['SubType']==='color','color adjustment maps to color filter');
cloudCheck(count($timeline['AudioTracks'])===2&&$timeline['AudioTracks'][1]['AudioTrackClips'][0]['LoopMode']===true,'voice and looping music remain separate tracks');
cloudCheck(count($timeline['SubtitleTracks'])===2,'title and subtitle separate tracks');cloudCheck($timeline['SubtitleTracks'][0]['SubtitleTrackClips'][0]['OutlineColour']==='#000000','subtitle outline preserved');
$independent=$p;$independent['title_style']=array_replace($p['title_style'],['size'=>80,'color'=>'#ff8800','y'=>15,'align'=>'left','title_range'=>[1,4]]);$separate=ClipImsTimeline::compile($independent,$media);
cloudCheck($separate['SubtitleTracks'][0]['SubtitleTrackClips'][0]['FontSize']===42&&$separate['SubtitleTracks'][1]['SubtitleTrackClips'][0]['FontSize']===80,'title font independent from subtitle font');
cloudCheck($separate['SubtitleTracks'][1]['SubtitleTrackClips'][0]['FontColor']==='#ff8800'&&$separate['SubtitleTracks'][1]['SubtitleTrackClips'][0]['Y']===0.15,'title color and height passed to real IMS timeline');
cloudCheck($separate['SubtitleTracks'][1]['SubtitleTrackClips'][0]['TimelineIn']===1.0&&$separate['SubtitleTracks'][1]['SubtitleTrackClips'][0]['TimelineOut']===4.0,'independent title display interval honored');
cloudInvalid(fn()=>ClipConfiguration::normalize(['title_style'=>['size'=>1000]]),'invalid title size rejected server side');
$p['fps']=60;$p['ratio']='16:9';$output=ClipImsTimeline::output($p,'https://example.invalid/output');cloudCheck($output['Width']===1280&&$output['Video']['Fps']===60,'ratio and FPS are explicit output configuration');
$bad=$p;$bad['colors']['hue']=2;cloudInvalid(fn()=>ClipImsTimeline::compile($bad,$media),'unsupported hue fails before paid submission');
$provider->render($cfg,$p,$media,'output.mp4','stable-client-token');$last=end($transport->calls);cloudCheck($last[3]['ClientToken']==='stable-client-token','IMS idempotency token forwarded');cloudCheck(isset(json_decode($last[3]['Timeline'],true)['VideoTracks']),'real IMS request carries Timeline JSON');
cloudCheck($provider->renderStatus($cfg,'job')['state']==='success','IMS Success maps correctly');$transport->renderState='Failed';cloudCheck($provider->renderStatus($cfg,'job')['state']==='failed','IMS Failed maps correctly');$transport->renderState='Processing';cloudCheck($provider->renderStatus($cfg,'job')['state']==='submitted','IMS Processing stays pending');
cloudCheck($provider->script($cfg,[])['text']==='合成文案','Ark output message text parsed');$last=end($transport->calls);cloudCheck($last[2]['model']==='contract-model'&&$last[2]['store']===false,'own model and no provider conversation persistence');
$transport->responses=[['code'=>20000000,'data'=>['task_id'=>'tts-job']]];cloudCheck($provider->voice($cfg,'你好','voice_a','voice-token',12)['provider_id']==='tts-job','async speech returns provider task ID');$last=end($transport->calls);cloudCheck($last[2]['unique_id']==='voice-token'&&$last[2]['req_params']['audio_params']['speech_rate']===0,'voice unique ID and single playback speed application');
cloudInvalid(fn()=>$provider->voice($cfg,'text','foreign_voice','v',1),'unconfigured voice cannot be used');
$transport->responses=[['code'=>20000000,'data'=>['task_status'=>2,'audio_url'=>'https://example.bytespeech.com/a','sentences'=>[['startTime'=>0.1,'endTime'=>1.2,'text'=>'你好']]]]];
cloudCheck($provider->voiceStatus($cfg,'tts-job','t')['sentences'][0]['startTime']===0.1,'speech timestamps remain seconds without fabricated alignment');
$transport->responses=[['result'=>['text'=>'识别文案','utterances'=>[['start_time'=>100,'end_time'=>1000,'text'=>'识别文案']]]]];
$asrCfg=$cfg;$asrCfg['settings']['resource_id']='volc.bigasr.auc_turbo';
cloudCheck($provider->transcribe($asrCfg,'https://owned/audio','asr',1)['text']==='识别文案','ASR result parsed');$last=end($transport->calls);cloudCheck($last[1]['X-Api-Sequence']==='-1','ASR flash documented sequence header');
cloudCheck(ClipCloudProvider::ready('icl')&&ClipCloudProvider::ready('imm'),'clone synthesis and IMM packaging adapters available');
foreach(['http://valid.bytespeech.com/a','https://127.0.0.1/a','https://evilbytespeech.com/a','https://bytespeech.com.evil.test/a','https://user:pass@cdn.bytespeech.com/a','https://cdn.bytespeech.com:8443/a'] as $badUrl)cloudInvalid(fn()=>\app\common\service\merchant\clip\ClipNativeCloudTransport::speechHost($badUrl),'speech download URL blocks SSRF and credential redirection');
cloudCheck(\app\common\service\merchant\clip\ClipNativeCloudTransport::speechHost('https://lf26-lab-speech-tt-sign.bytespeech.com/a')==='lf26-lab-speech-tt-sign.bytespeech.com','official speech signed host accepted');
// All fixture database changes, including temporary policy/keys, roll back together.
if(Db::name('oem_clip_integration')->whereIn('tenant_id',[0,1])->where('is_deleted',0)->count())throw new RuntimeException('Refusing to override real cloud configurations');
Db::startTrans();$failure=null;
try{
    $nativeBefore=hash('sha256',json_encode(Db::name('config')->select()->toArray()));
    foreach(['oss','ims','llm','tts','asr'] as $code){$s=match($code){'oss'=>['region'=>'cn-shanghai','bucket'=>'contract-bucket'],'ims'=>['region'=>'cn-shanghai','output_bucket'=>'contract-bucket'],'llm'=>['model_id'=>'contract-model'],'tts'=>['resource_id'=>'seed-tts-2.0','speaker_ids'=>'voice_a'],'asr'=>['resource_id'=>'volc.bigasr.auc_turbo']};$old=Db::name('oem_clip_integration')->where(['tenant_id'=>0,'capability'=>$code])->find();ClipIntegrationService::save(0,0,['capability'=>$code,'settings'=>$s,'secrets'=>in_array($code,['oss','ims'])?['access_key_id'=>'contractAccess','access_key_secret'=>'contractSecret']:['api_key'=>'contractApi'],'enabled'=>true,'revision'=>(int)($old['revision']??0)]);}
    ClipIntegrationService::grant(1,true,0);
    $merchants=[];foreach(['a','b'] as $suffix){$id=OemDirectoryService::saveMerchant(1,['name'=>'云剪辑验收','account'=>$prefix.$suffix,'password'=>'ContractQa2026!','status'=>1,'agent_id'=>0]);$merchants[]=(int)Db::name('oem_merchant')->where('id',$id)->value('user_id');}[$u,$other]=$merchants;
    $dir=root_path().'public/uploads/clip-contract/';if(!is_dir($dir))mkdir($dir,0700,true);$file=$dir.$prefix.'.png';$files[]=$file;$img=imagecreatetruecolor(8,8);imagepng($img,$file);imagedestroy($img);
    $fileId=(int)Db::name('tenant_file')->insertGetId(['tenant_id'=>1,'source'=>1,'source_id'=>$u,'type'=>10,'name'=>'fixture.png','uri'=>'uploads/clip-contract/'.$prefix.'.png','storage_scope'=>'tenant','storage_engine'=>'local','storage_domain'=>'','create_time'=>time(),'update_time'=>time()]);
    $material=MerchantMaterialService::save(1,$u,['kind'=>'image','name'=>'云剪辑图片','file_ids'=>[$fileId]]);
    $saved=MerchantClipService::save(1,$u,['kind'=>'project','name'=>'云剪辑工程','config'=>['mode'=>'mix','material_ids'=>[$material],'clip_range'=>[4,4]]]);$doc=(int)$saved['id'];$revision=(int)$saved['revision'];
    $planned=MerchantClipService::plan(1,$u,['id'=>$doc,'revision'=>$revision,'count'=>1,'seed'=>'cloud']);$plan=(int)$planned['ids'][0];$request=['id'=>$doc,'revision'=>$revision,'plan_id'=>$plan];
    $job=ClipCloudJobService::create(1,$u,'render',$request);$id=(int)$job['id'];cloudCheck($job['state']==='queued','real adapter queues without cloud request');
    cloudCheck(ClipCloudJobService::create(1,$u,'render',$request)['id']===$id,'repeated render click is idempotent');
    cloudInvalid(fn()=>ClipCloudJobService::create(1,$other,'render',$request),'foreign merchant cannot submit render');cloudInvalid(fn()=>ClipCloudJobService::listing(1,$other,$doc),'foreign merchant cannot list jobs');
    cloudInvalid(fn()=>(new ClipCloudJobService($transport))->delivery(1,$other,$id),'foreign merchant cannot fetch signed output');cloudInvalid(fn()=>ClipCloudJobService::create(1,$u,'render',array_replace($request,['provider_id'=>'forged','revision'=>0])),'reserved fields do not bypass revision check');
    $raw=Db::name('oem_clip_cloud_job')->where('id',$id)->find();cloudCheck(!str_contains($raw['config_json'],'contractSecret')&&!str_contains($raw['config_json'],'api_key'),'job persists configuration version without credentials');
    $transport->calls=[];$transport->renderState='Processing';$worker=new ClipCloudJobService($transport);$worker->tick($id);$raw=Db::name('oem_clip_cloud_job')->where('id',$id)->find();cloudCheck($raw['state']==='submitted','leased worker submits actual provider contract');
    cloudCheck($transport->calls[0][0]==='upload'&&$transport->calls[0][1]===1&&$transport->calls[0][2]===0,'borrowed OSS keeps actual OEM data ownership');cloudCheck(str_contains($transport->calls[0][3],'/t1/u'.$u.'/'),'borrowed object key includes consuming OEM and merchant');
    $calls=count($transport->calls);$worker->tick($id);cloudCheck(count($transport->calls)===$calls,'poll cooldown prevents duplicate requests');
    Db::name('oem_clip_cloud_job')->where('id',$id)->update(['next_poll'=>0]);$worker->tick($id);cloudCheck(ClipCloudJobService::listing(1,$u,$doc)['lists'][0]['state']==='submitted','processing poll does not report fake completion');
    $transport->renderState='Success';Db::name('oem_clip_cloud_job')->where('id',$id)->update(['next_poll'=>0]);$worker->tick($id);cloudCheck(ClipCloudJobService::listing(1,$u,$doc)['lists'][0]['state']==='success','successful query persists completed artifact');
    $url=$worker->delivery(1,$u,$id);cloudCheck($url['expires_in']===900&&str_contains($url['url'],'/t1/u'.$u.'/'),'delivery signed only for owned stored output key');
    ClipIntegrationService::grant(1,false,0);cloudInvalid(fn()=>$worker->delivery(1,$u,$id),'revoked platform borrowing blocks new signed URLs');ClipIntegrationService::grant(1,true,0);
    $script=ClipCloudJobService::create(1,$u,'script',['id'=>$doc,'revision'=>$revision]);$transport->uncertain=true;$worker->tick((int)$script['id']);$raw=Db::name('oem_clip_cloud_job')->where('id',$script['id'])->find();cloudCheck($raw['state']==='unknown','ambiguous submit enters unknown state');$calls=count($transport->calls);$worker->tick((int)$script['id']);cloudCheck(count($transport->calls)===$calls,'unknown request never automatically resubmitted');$transport->uncertain=false;
    MerchantClipService::save(1,$u,['id'=>$doc,'revision'=>$revision,'kind'=>'project','name'=>'版本二','config'=>['mode'=>'mix','material_ids'=>[$material]]]);$revision++;
    $script=ClipCloudJobService::create(1,$u,'script',['id'=>$doc,'revision'=>$revision]);ClipIntegrationService::grant(1,false,0);$transport->calls=[];$worker->tick((int)$script['id']);cloudCheck(Db::name('oem_clip_cloud_job')->where('id',$script['id'])->value('state')==='blocked'&&!$transport->calls,'revocation between queue and execution prevents provider call');
    ClipIntegrationService::grant(1,true,0);$script2=ClipCloudJobService::create(1,$u,'voice',['id'=>$doc,'revision'=>$revision,'text'=>'你好','speaker'=>'voice_a']);Db::name('oem_clip_cloud_job')->where('id',$script2['id'])->update(['state'=>'submitting','lease_until'=>time()-1]);$worker->tick((int)$script2['id']);cloudCheck(Db::name('oem_clip_cloud_job')->where('id',$script2['id'])->value('state')==='unknown','crashed submit is not repeated after lease expiry');
    $voice=ClipCloudJobService::create(1,$u,'voice',['id'=>$doc,'revision'=>$revision,'text'=>'验收成功旁白','speaker'=>'voice_a']);
    $wav=root_path().'runtime/local/'.$prefix.'.wav';$mp3=root_path().'runtime/local/'.$prefix.'.mp3';$files[]=$wav;$files[]=$mp3;$pcm=str_repeat("\0",16000);file_put_contents($wav,'RIFF'.pack('V',36+strlen($pcm)).'WAVEfmt '.pack('VvvVVvv',16,1,1,8000,16000,2,16).'data'.pack('V',strlen($pcm)).$pcm);
    $bin=getenv('LOCALAPPDATA').'/Microsoft/WinGet/Links/ffmpeg.exe';$pipes=[];$proc=proc_open([$bin,'-v','error','-y','-i',$wav,$mp3],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,null,['bypass_shell'=>true]);foreach($pipes as $pipe)fclose($pipe);if(proc_close($proc)!==0)throw new RuntimeException('Fixture audio encoding failed');$transport->audioBytes=file_get_contents($mp3);
    $transport->responses=[['code'=>20000000,'data'=>['task_id'=>'fixture-voice-job']],['code'=>20000000,'data'=>['task_status'=>2,'audio_url'=>'https://fixture.bytespeech.com/audio','sentences'=>[['startTime'=>0.1,'endTime'=>0.8,'text'=>'旁白']]]]];
    $worker->tick((int)$voice['id']);Db::name('oem_clip_cloud_job')->where('id',$voice['id'])->update(['next_poll'=>0]);$worker->tick((int)$voice['id']);$done=Db::name('oem_clip_cloud_job')->where('id',$voice['id'])->find();$result=json_decode($done['result_json'],true);
    cloudCheck($done['state']==='success'&&$result['duration']>0,'TTS MP3 validated and probed before completion');cloudCheck($result['asset']['kind']==='voiceover'&&$result['asset']['id']===$result['material_id'],'TTS creates reusable owned voiceover material');
    $stored=Db::name('tenant_file')->where('id',$result['asset']['file']['id'])->find();$files[]=root_path().'public/'.$stored['uri'];cloudCheck((int)$stored['tenant_id']===1&&(int)$stored['source_id']===$u,'TTS owned file keeps consuming tenant and merchant');
    $materialRow=Db::name('oem_merchant_material')->where('id',$result['material_id'])->find();cloudCheck((int)$materialRow['user_id']===$u&&$materialRow['kind']==='voiceover','TTS result does not enter other merchant library');
    $rawJson=ClipCloudJobService::listing(1,$u,$doc);cloudCheck(!str_contains(json_encode($rawJson),'contractApi')&&!str_contains(json_encode($rawJson),'fixture.bytespeech.com'),'job responses omit credentials and expiring provider download URL');
    cloudCheck(hash('sha256',json_encode(Db::name('config')->select()->toArray()))===$nativeBefore,'native framework configuration never changed by cloud runtime');
}catch(Throwable $e){$failure=$e;}finally{Db::rollback();foreach($files as $file)if(is_file($file))unlink($file);}
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}echo 'All '.$passed." cloud contract checks passed. Mock transport only; no paid cloud calls; database rolled back.\n";
