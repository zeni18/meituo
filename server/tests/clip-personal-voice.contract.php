<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\clip\{ClipVoiceProfileService as Voices,ClipCloudTransport,ClipCloudProvider,ClipCloudFailure,ClipIntegrationService,ClipCloudJobService,MerchantClipService};
use app\common\service\merchant\OemDirectoryService;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Isolated local database required');
$passed=0;
function vc(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo "PASS $label\n";}
function vi(callable $fn,string $label):void{try{$fn();}catch(InvalidArgumentException){vc(true,$label);return;}vc(false,$label);}
final class VoiceFixture implements ClipCloudTransport{
    public array $calls=[];public bool $uncertain=false;public int $status=1;
    public function json(string $url,array $headers,array $body):array{
        $this->calls[]=[$url,$headers,$body];
        if($this->uncertain)throw new ClipCloudFailure(true);
        if(str_ends_with($url,'/submit'))return ['code'=>20000000,'data'=>['task_id'=>'fixture-task']];
        return ['status'=>$this->status,'speaker_id'=>$body['custom_speaker_id'],'create_time'=>time()*1000,'speaker_status'=>[['model_type'=>5,'demo_audio'=>'https://fixture.bytespeech.com/preview.mp3']]];
    }
    public function rpc(array $config,string $action,array $parameters):array{throw new RuntimeException('Unexpected RPC');}
    public function upload(array $config,string $bucket,string $key,string $path):void{throw new RuntimeException('Unexpected upload');}
    public function downloadSpeech(string $url,string $path):void{throw new RuntimeException('Unexpected download');}
    public function signed(array $config,string $bucket,string $key,int $ttl=900):string{throw new RuntimeException('Unexpected sign');}
}
$transport=new VoiceFixture();$worker=new Voices($transport);$prefix='voiceqa'.bin2hex(random_bytes(5));
$fixture=root_path().'runtime/local/'.$prefix.'.wav';$payload=str_repeat(pack('v',0),24000*6);
file_put_contents($fixture,'RIFF'.pack('V',36+strlen($payload)).'WAVEfmt '.pack('VvvVVvv',16,1,1,24000,48000,2,16).'data'.pack('V',strlen($payload)).$payload);
$before=hash('sha256',json_encode(Db::name('oem_clip_integration')->order('tenant_id,capability')->select()->toArray()));
$created=[];$failure=null;
Db::startTrans();
try{
    foreach(['icl','oss'] as $code){
        $old=Db::name('oem_clip_integration')->where(['tenant_id'=>1,'capability'=>$code])->find();
        $settings=$code==='icl'?['resource_id'=>'seed-icl-2.0','clone_mode'=>'postpaid','speaker_ids'=>'']:['region'=>'cn-beijing','bucket'=>'fixture-bucket','prefix'=>'contract'];
        $secrets=$code==='icl'?['api_key'=>'fixtureVoiceKey']:['access_key_id'=>'fixtureAccess','access_key_secret'=>'fixtureSecret'];
        ClipIntegrationService::save(1,0,['capability'=>$code,'revision'=>(int)($old['revision']??0),'enabled'=>true,'credential_mode'=>'own','settings'=>$settings,'secrets'=>$secrets]);
    }
    $users=[];foreach(['a','b'] as $s){$id=OemDirectoryService::saveMerchant(1,['name'=>'个人音色事务验收','account'=>$prefix.$s,'password'=>'ContractQa2026!','status'=>1,'agent_id'=>0]);$users[]=(int)Db::name('oem_merchant')->where('id',$id)->value('user_id');}
    [$user,$other]=$users;$config=ClipIntegrationService::resolve(1,'icl');
    $p=['name'=>'我的声音','consent'=>'1','request_key'=>$prefix.'-first'];
    vi(fn()=>Voices::create(1,$user,$fixture,'wav',array_replace($p,['consent'=>'0'])),'rights consent required');
    vi(fn()=>Voices::create(1,$user,$fixture,'txt',$p),'non audio format rejected');
    vi(fn()=>Voices::create(1,0,$fixture,'wav',$p),'unowned account rejected');
    $voice=Voices::create(1,$user,$fixture,'wav',$p);$id=$voice['id'];$row=Db::name('oem_clip_voice')->where('id',$id)->find();$created[]=root_path().'runtime/'.$row['sample_path'];
    vc($voice['state']==='queued','upload queues training');
    vc(!isset($voice['sample_path'],$voice['speaker_id'],$voice['config_signature']),'public view hides private identifiers');
    vc(is_file($created[0])&&!str_contains($created[0],'/public/'),'sample stored outside public uploads');
    vc(Voices::create(1,$user,$fixture,'wav',$p)['id']===$id,'request retry is idempotent');
    vc(Voices::create(1,$user,$fixture,'wav',array_replace($p,['request_key'=>$prefix.'-second']))['id']===$id,'identical sample cannot duplicate training');
    vc(Voices::listing(1,$other)['lists']===[],'other account cannot list voice');
    vi(fn()=>Voices::rename(1,$other,$id,'other'),'other account cannot rename voice');
    vi(fn()=>$worker->refresh(1,$other,$id),'other account cannot refresh voice');
    $worker->refresh(1,$user,$id);vc(count($transport->calls)===0,'refresh cannot submit queued training');
    vc($worker->tick($id),'worker claims queued training');$call=$transport->calls[0];
    vc(str_ends_with($call[0],'/voice_clone')&&$call[2]['speaker_id']==='custom_speaker_id'&&$call[2]['custom_speaker_id']===$row['custom_id'],'postpaid training uses stable custom identity');
    vc(base64_decode($call[2]['audio']['data'])===file_get_contents($fixture)&&$call[1]['X-Api-Key']==='fixtureVoiceKey','audio and scoped key passed only to transport');
    vc(Db::name('oem_clip_voice')->where('id',$id)->value('state')==='training','training status persisted');
    $transport->status=2;$voice=$worker->refresh(1,$user,$id);
    vc($voice['state']==='ready'&&$voice['can_use']&&$voice['requires_activation'],'successful training available for owned synthesis');
    vc(str_ends_with(end($transport->calls)[0],'/get_voice')&&$voice['preview_url']!=='','refresh queries existing voice and provides preview');
    vi(fn()=>Voices::forSynthesis(1,$user,$id,$config,false),'first paid synthesis requires confirmation');
    vi(fn()=>Voices::forSynthesis(1,$other,$id,$config,true),'other account cannot synthesize voice');
    vc(Voices::forSynthesis(1,$user,$id,$config,true)['speaker_id']===$row['custom_id'],'confirmed first synthesis resolves real speaker');
    $project=MerchantClipService::save(1,$user,['kind'=>'project','name'=>'音色合成验收','config'=>['mode'=>'mix']]);
    $request=['id'=>$project['id'],'revision'=>$project['revision'],'text'=>'测试配音','speaker'=>'personal-'.$id,'voice_profile_id'=>$id,'activation_confirmed'=>true];
    $job=ClipCloudJobService::create(1,$user,'clone_voice',$request);
    $input=json_decode(Db::name('oem_clip_cloud_job')->where('id',$job['id'])->value('input_json'),true);
    vc($input['speaker']===$row['custom_id']&&(int)$input['voice_profile_id']===$id,'cloud job binds authorized profile instead of browser speaker');
    vi(fn()=>ClipCloudJobService::create(1,$user,'clone_voice',array_replace($request,['activation_confirmed'=>false])),'job creation also requires activation approval');
    Voices::markUsed(1,$user,$id,$config);
    Db::name('oem_clip_voice')->where('id',$id)->update(['trial_expires'=>time()-1]);
    vc(Voices::forSynthesis(1,$user,$id,$config,false)['state']==='active','activated voice reusable after trial deadline');
    $changed=$config;$changed['credentials']['api_key']='differentAccount';
    vi(fn()=>Voices::forSynthesis(1,$user,$id,$changed,false),'changed cloud account rejected');
    $listed=ClipCloudJobService::voices(1,$user);vc(count(array_filter($listed,fn($v)=>($v['voice_profile_id']??0)===$id))===1,'personal voice included in synthesis picker');
    Db::name('oem_clip_voice')->where('id',$id)->update(['state'=>'ready','activated_at'=>0,'trial_expires'=>time()-1]);
    $next=Voices::create(1,$user,$fixture,'wav',array_replace($p,['request_key'=>$prefix.'-expired']));$nextId=$next['id'];$nextRow=Db::name('oem_clip_voice')->where('id',$nextId)->find();$created[]=root_path().'runtime/'.$nextRow['sample_path'];
    vc($nextId!==$id,'expired trial permits explicit new upload');
    $transport->uncertain=true;$worker->tick($nextId);
    vc(Db::name('oem_clip_voice')->where('id',$nextId)->value('state')==='unknown','uncertain submission stays queryable');
    $transport->uncertain=false;$worker->refresh(1,$user,$nextId);
    vc(str_ends_with(end($transport->calls)[0],'/get_voice'),'uncertain submission only queried, never resubmitted');
    Db::name('oem_clip_voice')->where('id',$nextId)->update(['state'=>'submitting','lease_until'=>0,'next_poll'=>0]);$worker->tick($nextId);
    vc(str_ends_with(end($transport->calls)[0],'/get_voice'),'crashed submit recovered by query');
    $providerConfig=$config;$providerConfig['settings']['speaker_ids']=$row['custom_id'];
    (new ClipCloudProvider($transport))->voice($providerConfig,'测试文案',$row['custom_id'],$prefix,$user);
    $sent=end($transport->calls);
    vc($sent[2]['req_params']['speaker']===$row['custom_id']&&$sent[2]['req_params']['model']==='seed-tts-2.0-standard'&&$sent[1]['X-Api-Resource-Id']==='seed-icl-2.0','cloned synthesis includes required model and resource');
}catch(Throwable $e){$failure=$e;}
finally{
    Db::rollback();
    foreach(array_merge($created,[$fixture]) as $path){$resolved=realpath($path);$runtime=realpath(root_path().'runtime');if($resolved&&str_starts_with(str_replace('\\','/',$resolved),str_replace('\\','/',$runtime).'/'))unlink($resolved);}
}
vc(hash('sha256',json_encode(Db::name('oem_clip_integration')->order('tenant_id,capability')->select()->toArray()))===$before,'real configuration unchanged');
if($failure)throw $failure;
echo "Personal voice contract: $passed passed; no external calls\n";
