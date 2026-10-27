<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\clip\{ClipCloudTransport,ClipCloudProvider,ClipCloudJobService,ClipIntegrationService,MerchantClipService,ClipCloudFailure};
use app\common\service\merchant\OemDirectoryService;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Isolated local database required');
$passed=0;
function immCheck(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo "PASS $label\n";}
function immInvalid(callable $fn,string $label):void{try{$fn();}catch(InvalidArgumentException){immCheck(true,$label);return;}immCheck(false,$label);}
final class ImmContractTransport implements ClipCloudTransport
{
    public array $calls=[];public string $status='Running';public bool $uncertain=false;public bool $reject=false;
    public function rpc(array $config,string $action,array $parameters):array{
        $this->calls[]=[$action,$parameters];
        if($this->uncertain)throw new ClipCloudFailure(true);
        if($this->reject)throw new ClipCloudFailure(false);
        return match($action){'CreateFileCompressionTask'=>['TaskId'=>'FileCompression-fixture'],'GetTask'=>['Status'=>$this->status],default=>throw new RuntimeException('Unexpected RPC')};
    }
    public function json(string $url,array $headers,array $body):array{throw new RuntimeException('Unexpected HTTP');}
    public function upload(array $config,string $bucket,string $key,string $path):void{throw new RuntimeException('Package must not re-upload');}
    public function downloadSpeech(string $url,string $path):void{throw new RuntimeException('Unexpected download');}
    public function signed(array $config,string $bucket,string $key,int $ttl=900):string{return 'https://'.$bucket.'.example.test/'.$key.'?ttl='.$ttl;}
}
$transport=new ImmContractTransport();$provider=new ClipCloudProvider($transport);
$config=['settings'=>['region'=>'cn-beijing','project'=>'test-project','output_bucket'=>'test-output']];
$source=[['URI'=>'oss://test-input/one.mp4','Mode'=>'fullname','Alias'=>'/clip-1.mp4']];
immCheck($provider->package($config,$source,'owned/clips.zip','test-token')['provider_id']==='FileCompression-fixture','submit returns actual task ID');
$params=$transport->calls[0][1];
immCheck(json_decode($params['Sources'],true)===$source&&$params['TargetURI']==='oss://test-output/owned/clips.zip','exact-file sources and target serialize correctly');
immCheck($params['ProjectName']==='test-project'&&$params['CompressedFormat']==='zip'&&$params['UserData']==='test-token','project ZIP and correlation token');
foreach(['Running'=>'submitted','Succeeded'=>'success','Failed'=>'failed'] as $s=>$expected){$transport->status=$s;immCheck($provider->packageStatus($config,'FileCompression-fixture')['state']===$expected,'status '.$s);}
immCheck(end($transport->calls)[1]['TaskType']==='FileCompression','GetTask carries correct task type');
immInvalid(fn()=>$provider->package($config,[],'x','x'),'empty sources rejected');
immInvalid(fn()=>$provider->package($config,[['URI'=>'oss://bucket/','Mode'=>'prefix','Alias'=>'/clip-1.mp4']],'x','x'),'whole-prefix packaging rejected');
// Test-only own configuration is changed inside one transaction, never committed.
// All cloud calls use the injected transport, so no existing key is sent anywhere.
$before=hash('sha256',json_encode(Db::name('oem_clip_integration')->order('tenant_id,capability')->select()->toArray()));
$prefix='immqa'.bin2hex(random_bytes(5));$failure=null;
Db::startTrans();
try{
    foreach(['ims','imm'] as $code){
        $old=Db::name('oem_clip_integration')->where(['tenant_id'=>1,'capability'=>$code])->find();
        $settings=['region'=>'cn-beijing','output_bucket'=>'fixture-output','prefix'=>'imm-contract'];
        if($code==='imm')$settings['project']='fixture-project';
        ClipIntegrationService::save(1,0,['capability'=>$code,'revision'=>(int)($old['revision']??0),'enabled'=>true,'credential_mode'=>'own','settings'=>$settings,'secrets'=>['access_key_id'=>'fixtureAccess','access_key_secret'=>'fixtureSecret']]);
    }
    $users=[];
    foreach(['a','b'] as $suffix){$id=OemDirectoryService::saveMerchant(1,['name'=>'IMM事务验收','account'=>$prefix.$suffix,'password'=>'ContractQa2026!','status'=>1,'agent_id'=>0]);$users[]=(int)Db::name('oem_merchant')->where('id',$id)->value('user_id');}
    [$user,$other]=$users;
    $doc=MerchantClipService::save(1,$user,['kind'=>'project','name'=>'IMM事务验收','config'=>['mode'=>'mix']]);
    $otherDoc=MerchantClipService::save(1,$other,['kind'=>'project','name'=>'其他商家','config'=>['mode'=>'mix']]);
    $configs=[];foreach(['ims','imm'] as $code)$configs[$code]=ClipIntegrationService::resolve(1,$code);
    $pins=array_map(fn($c)=>['source_tenant_id'=>$c['source_tenant_id'],'revision'=>$c['revision']],$configs);
    $seed=function(int $owner,int $project,string $state='success')use($prefix,$configs,$pins):int{
        $token=bin2hex(random_bytes(16));
        return (int)Db::name('oem_clip_cloud_job')->insertGetId(['tenant_id'=>1,'user_id'=>$owner,'project_id'=>$project,'revision'=>1,'operation'=>'render','request_key'=>hash('sha256',$prefix.$token),'client_token'=>$token,'state'=>$state,'config_json'=>json_encode(['ims'=>$pins['ims']]),'input_json'=>'{}','result_json'=>'{}','output_key'=>ClipCloudProvider::key($configs['ims'],1,$owner,$token,'output.mp4'),'create_time'=>time(),'update_time'=>time()]);
    };
    $one=$seed($user,(int)$doc['id']);$two=$seed($user,(int)$doc['id']);$foreign=$seed($other,(int)$otherDoc['id']);$pending=$seed($user,(int)$doc['id'],'submitted');
    $request=['id'=>$doc['id'],'revision'=>$doc['revision'],'job_ids'=>[$two,$one]];
    $job=ClipCloudJobService::create(1,$user,'package',$request);$id=(int)$job['id'];
    immCheck($job['state']==='queued','owned completed jobs create queue entry');
    immCheck(ClipCloudJobService::create(1,$user,'package',array_replace($request,['job_ids'=>[$one,$two,$one]]))['id']===$job['id'],'order and duplicates cannot create duplicate package');
    foreach([[],[$foreign],[$pending],[$one,'bad'],range(1,101)] as $bad)immInvalid(fn()=>ClipCloudJobService::create(1,$user,'package',array_replace($request,['job_ids'=>$bad])),'invalid or unauthorized file set rejected');
    immInvalid(fn()=>ClipCloudJobService::create(1,$other,'package',$request),'foreign merchant cannot package project');
    immInvalid(fn()=>(new ClipCloudJobService($transport))->delivery(1,$user,$id),'pending package cannot be downloaded');
    $transport->calls=[];$transport->status='Running';$worker=new ClipCloudJobService($transport);
    $worker->tick($id);$raw=Db::name('oem_clip_cloud_job')->where('id',$id)->find();
    immCheck($raw['state']==='submitted','worker submits package');
    $actual=json_decode($transport->calls[0][1]['Sources'],true);
    immCheck(count($actual)===2&&$actual[0]['Alias']==='/clip-'.$one.'.mp4'&&$actual[1]['Alias']==='/clip-'.$two.'.mp4','owned file aliases remain unique and deterministic');
    immCheck(str_contains($transport->calls[0][1]['TargetURI'],'/t1/u'.$user.'/')&&str_ends_with($transport->calls[0][1]['TargetURI'],'/clips.zip'),'output isolated by tenant and merchant');
    $calls=count($transport->calls);$worker->tick($id);immCheck(count($transport->calls)===$calls,'cooldown prevents repeat calls');
    Db::name('oem_clip_cloud_job')->where('id',$id)->update(['next_poll'=>0]);$worker->tick($id);
    immCheck(Db::name('oem_clip_cloud_job')->where('id',$id)->value('state')==='submitted','running package remains pending');
    $transport->status='Succeeded';Db::name('oem_clip_cloud_job')->where('id',$id)->update(['next_poll'=>0]);$worker->tick($id);
    $done=Db::name('oem_clip_cloud_job')->where('id',$id)->find();
    immCheck($done['state']==='success'&&json_decode($done['result_json'],true)['file_count']===2,'successful package records selected count');
    immCheck(str_contains($worker->delivery(1,$user,$id)['url'],'clips.zip?ttl=900'),'package delivery signs owned output for 15 minutes');
    immInvalid(fn()=>$worker->delivery(1,$other,$id),'foreign merchant cannot download package');
    $single=ClipCloudJobService::create(1,$user,'package',array_replace($request,['job_ids'=>[$one]]));$transport->uncertain=true;
    $worker->tick((int)$single['id']);$transport->uncertain=false;
    immCheck(Db::name('oem_clip_cloud_job')->where('id',$single['id'])->value('state')==='unknown','uncertain submit never marked successful');
    $calls=count($transport->calls);$worker->tick((int)$single['id']);immCheck(count($transport->calls)===$calls,'uncertain submission not retried');
    $expired=ClipCloudJobService::create(1,$user,'package',array_replace($request,['job_ids'=>[$two]]));
    Db::name('oem_clip_cloud_job')->where('id',$expired['id'])->update(['state'=>'submitted','provider_id'=>'expired','create_time'=>time()-8*86400]);
    $calls=count($transport->calls);$worker->tick((int)$expired['id']);
    immCheck(Db::name('oem_clip_cloud_job')->where('id',$expired['id'])->value('state')==='unknown'&&count($transport->calls)===$calls,'expired IMM metadata stops polling without resubmission');
    $third=$seed($user,(int)$doc['id']);$blocked=ClipCloudJobService::create(1,$user,'package',array_replace($request,['job_ids'=>[$third]]));
    Db::name('oem_clip_integration')->where(['tenant_id'=>1,'capability'=>'imm'])->inc('revision')->update();
    $calls=count($transport->calls);$worker->tick((int)$blocked['id']);
    immCheck(Db::name('oem_clip_cloud_job')->where('id',$blocked['id'])->value('state')==='blocked'&&count($transport->calls)===$calls,'configuration change blocks queued work before cloud call');
    immInvalid(fn()=>$worker->delivery(1,$user,$id),'changed configuration blocks issuing new download URL');
    Db::name('oem_clip_integration')->where(['tenant_id'=>1,'capability'=>'ims'])->inc('revision')->update();
    immInvalid(fn()=>ClipCloudJobService::create(1,$user,'package',array_replace($request,['job_ids'=>[$third]])),'old source storage revision rejected');
}catch(Throwable $e){$failure=$e;}finally{Db::rollback();}
immCheck($before===hash('sha256',json_encode(Db::name('oem_clip_integration')->order('tenant_id,capability')->select()->toArray())),'all existing integration configuration restored by rollback');
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}
echo "All $passed IMM checks passed. Injected transport only; database rolled back.\n";
