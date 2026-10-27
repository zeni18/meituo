<?php
declare(strict_types=1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\clip\{ClipCloudTransport,ClipNativeCloudTransport,ClipCloudProvider,ClipCloudJobService,ClipIntegrationService,MerchantClipService,ClipCloudFailure};
use app\common\service\merchant\OemDirectoryService;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Isolated local database required');
$passed=0;
function asrCheck(bool $ok,string $label):void{global $passed;if(!$ok)throw new RuntimeException($label);$passed++;echo "PASS $label\n";}
function asrUncertain(callable $fn,string $label):void{try{$fn();}catch(ClipCloudFailure $e){asrCheck($e->uncertain,$label);return;}throw new RuntimeException($label);}
final class AsrContractTransport implements ClipCloudTransport
{
    public array $calls=[];public array $response=[];public bool $uncertain=false;
    public function rpc(array $config,string $action,array $parameters):array{throw new RuntimeException('Unexpected RPC');}
    public function json(string $url,array $headers,array $body):array{
        $this->calls[]=[$url,$headers,$body];if($this->uncertain)throw new ClipCloudFailure(true);return $this->response;
    }
    public function upload(array $config,string $bucket,string $key,string $path):void{throw new RuntimeException('Unexpected upload');}
    public function downloadSpeech(string $url,string $path):void{throw new RuntimeException('Unexpected speech download');}
    public function signed(array $config,string $bucket,string $key,int $ttl=900):string{throw new RuntimeException('Unexpected signing');}
}
$base='https://openspeech.bytedance.com/api/v3/auc/bigmodel/';
$transport=new AsrContractTransport();$provider=new ClipCloudProvider($transport);
$cfg=['settings'=>['resource_id'=>'volc.seedasr.auc'],'credentials'=>['api_key'=>'fixture-key']];
$transport->response=['task_id'=>'cloud-asr-id'];
asrCheck($provider->transcribe($cfg,'https://owned.example/audio.mp3','stable-token',17)['provider_id']==='cloud-asr-id','2.0 stores returned task ID');
[$url,$headers,$body]=end($transport->calls);
asrCheck($url===$base.'submit'&&$headers['X-Api-Resource-Id']==='volc.seedasr.auc'&&$headers['X-Api-Sequence']==='-1','2.0 uses submit endpoint and resource');
asrCheck($body['request']['show_utterances']===true&&$body['audio']['url']==='https://owned.example/audio.mp3','requests real utterance timestamps');
$transport->response=[];
asrCheck($provider->transcribe($cfg,'https://owned.example/a','stable-token',17)['provider_id']==='stable-token','header-confirmed legacy empty submit uses stable request ID');
foreach(['20000001','20000002'] as $code){
    $transport->response=ClipNativeCloudTransport::decodeJson($base.'query','',['x-api-status-code'=>$code]);
    asrCheck($provider->transcribeStatus($cfg,'cloud-asr-id')['state']==='submitted','pending status '.$code.' stays pending');
}
[$url,$headers,$body]=end($transport->calls);
asrCheck($url===$base.'query'&&$headers['X-Api-Request-Id']==='cloud-asr-id'&&$body===[],'query reuses returned ID and empty payload');
$result=['text'=>'你好','utterances'=>[['text'=>'你好','start_time'=>200,'end_time'=>1200]]];
$transport->response=ClipNativeCloudTransport::decodeJson($base.'query',json_encode(['_asr_status_code'=>'45000001','result'=>$result]),['x-api-status-code'=>'20000000']);
asrCheck($provider->transcribeStatus($cfg,'cloud-asr-id')===['state'=>'success']+$result,'real header overrides body and preserves timestamps');
$transport->response=['_asr_status_code'=>'20000003'];
asrCheck($provider->transcribeStatus($cfg,'cloud-asr-id')===['state'=>'success','text'=>'','utterances'=>[]],'silence finishes without invented text');
$transport->response=['_asr_status_code'=>'45000151'];
asrCheck($provider->transcribeStatus($cfg,'cloud-asr-id')['state']==='failed','invalid audio is terminal');
$transport->response=['_asr_status_code'=>'55000031'];
asrUncertain(fn()=>$provider->transcribeStatus($cfg,'cloud-asr-id'),'busy query is retryable without resubmission');
asrUncertain(fn()=>ClipNativeCloudTransport::decodeJson($base.'submit','{}',[]),'missing status cannot mark submit successful');
asrUncertain(fn()=>ClipNativeCloudTransport::decodeJson($base.'submit','{}',['x-api-status-code'=>'55000031']),'uncertain submit cannot be retried automatically');
$transport->response=['_asr_status_code'=>'20000000'];
asrUncertain(fn()=>$provider->transcribeStatus($cfg,'cloud-asr-id'),'missing final result cannot fabricate success');
$cfg['settings']['resource_id']='volc.bigasr.auc_turbo';$transport->response=['result'=>$result];
asrCheck($provider->transcribe($cfg,'https://owned.example/a','legacy-token',17)===$result&&end($transport->calls)[0]===$base.'recognize/flash','existing flash version remains synchronous');
// Only fixtures inside a transaction, with a transport that cannot make cloud requests.
$before=hash('sha256',json_encode(Db::name('oem_clip_integration')->order('tenant_id,capability')->select()->toArray()));
$failure=null;Db::startTrans();
try{
    foreach(['oss','asr'] as $code){
        $old=Db::name('oem_clip_integration')->where(['tenant_id'=>1,'capability'=>$code])->find();
        ClipIntegrationService::save(1,0,['capability'=>$code,'revision'=>(int)($old['revision']??0),'enabled'=>true,'credential_mode'=>'own',
            'settings'=>$code==='oss'?['region'=>'cn-beijing','bucket'=>'fixture-bucket']:['resource_id'=>'volc.seedasr.auc'],
            'secrets'=>$code==='oss'?['access_key_id'=>'fixtureAccess','access_key_secret'=>'fixtureSecret']:['api_key'=>'fixture-key']]);
    }
    $merchant=OemDirectoryService::saveMerchant(1,['name'=>'ASR事务验收','account'=>'asrqa'.bin2hex(random_bytes(5)),'password'=>'ContractQa2026!','status'=>1,'agent_id'=>0]);
    $user=(int)Db::name('oem_merchant')->where('id',$merchant)->value('user_id');
    $doc=MerchantClipService::save(1,$user,['kind'=>'project','name'=>'ASR事务验收','config'=>['mode'=>'mix']]);
    $configs=[];foreach(['oss','asr'] as $code)$configs[$code]=ClipIntegrationService::resolve(1,$code);
    $pins=array_map(fn($c)=>['source_tenant_id'=>$c['source_tenant_id'],'revision'=>$c['revision']],$configs);
    $seed=function(string $state='submitted',int $age=0)use($user,$doc,$pins):int{
        $token=bin2hex(random_bytes(16));
        return (int)Db::name('oem_clip_cloud_job')->insertGetId(['tenant_id'=>1,'user_id'=>$user,'project_id'=>$doc['id'],'revision'=>1,'operation'=>'asr','request_key'=>hash('sha256',$token),'client_token'=>$token,'provider_id'=>'fixture-task','state'=>$state,'config_json'=>json_encode($pins),'input_json'=>'{}','result_json'=>'{}','create_time'=>time()-$age,'update_time'=>time()]);
    };
    $worker=new ClipCloudJobService($transport);$id=$seed();
    $transport->response=['_asr_status_code'=>'20000002'];$transport->calls=[];$worker->tick($id);
    asrCheck(Db::name('oem_clip_cloud_job')->where('id',$id)->value('state')==='submitted'&&end($transport->calls)[0]===$base.'query','worker polls ASR rather than TTS');
    $transport->uncertain=true;Db::name('oem_clip_cloud_job')->where('id',$id)->update(['next_poll'=>0]);$worker->tick($id);
    asrCheck(Db::name('oem_clip_cloud_job')->where('id',$id)->value('state')==='submitted','network query error keeps original task');
    $transport->uncertain=false;$transport->response=['_asr_status_code'=>'20000000','result'=>$result];
    Db::name('oem_clip_cloud_job')->where('id',$id)->update(['next_poll'=>0]);$worker->tick($id);
    $done=Db::name('oem_clip_cloud_job')->where('id',$id)->find();
    asrCheck($done['state']==='success'&&json_decode($done['result_json'],true)===$result,'worker saves subtitle result');
    asrCheck(count(array_filter($transport->calls,fn($c)=>$c[0]!==$base.'query'))===0,'query failures never submit again');
    $id=$seed();$transport->response=['_asr_status_code'=>'45000151'];$worker->tick($id);
    asrCheck(Db::name('oem_clip_cloud_job')->where('id',$id)->value('state')==='failed','worker terminates rejected audio');
    $id=$seed('submitted',7*3600);$count=count($transport->calls);$worker->tick($id);
    asrCheck(Db::name('oem_clip_cloud_job')->where('id',$id)->value('state')==='unknown'&&count($transport->calls)===$count,'overdue task stops at local safety limit');
    $id=$seed('submitting');$worker->tick($id);
    asrCheck(Db::name('oem_clip_cloud_job')->where('id',$id)->value('state')==='unknown'&&count($transport->calls)===$count,'interrupted submit is not resubmitted');
    $id=$seed();Db::name('oem_clip_integration')->where(['tenant_id'=>1,'capability'=>'asr'])->inc('revision')->update();$worker->tick($id);
    asrCheck(Db::name('oem_clip_cloud_job')->where('id',$id)->value('state')==='blocked'&&count($transport->calls)===$count,'credential revision change blocks poll');
}catch(Throwable $e){$failure=$e;}finally{Db::rollback();}
asrCheck($before===hash('sha256',json_encode(Db::name('oem_clip_integration')->order('tenant_id,capability')->select()->toArray())),'all existing configuration restored');
if($failure){fwrite(STDERR,'FAIL '.$failure->getMessage()."\n");exit(1);}
echo "All $passed ASR checks passed. No cloud requests; database rolled back.\n";
