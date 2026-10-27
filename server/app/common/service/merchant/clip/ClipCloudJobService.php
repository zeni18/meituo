<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

use app\common\service\app\AppAccessService;
use think\facade\Db;
use InvalidArgumentException as Invalid;

/** Separate queue for merchant_clip_v1. Native smart_clip tasks and billing are never changed. */
final class ClipCloudJobService
{
    public function __construct(private readonly ClipCloudTransport $transport=new ClipNativeCloudTransport()){}
    private static function table(){return Db::name('oem_clip_cloud_job');}
    private static function json(array $data):string{return json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);}
    public static function dependencies(string $operation):array
    {
        return match($operation){'render','template_render','smart_process'=>['oss','ims'],'image_labels','image_text'=>['oss','imm'],'package'=>['ims','imm'],'script','topics'=>['llm'],'voice'=>['oss','tts'],'clone_voice'=>['oss','icl'],'asr'=>['oss','asr'],default=>throw new Invalid('不支持的剪辑操作')};
    }
    private static function resolved(int $tenant,string $operation):array
    {
        $configs=[];foreach(self::dependencies($operation) as $code)$configs[$code]=ClipIntegrationService::resolve($tenant,$code);
        if(isset($configs['oss'],$configs['ims'])&&ClipCloudProvider::region($configs['oss'])!==ClipCloudProvider::region($configs['ims']))throw new Invalid('OSS 和 IMS 必须配置同一地域');
        if(isset($configs['oss'],$configs['imm'])&&ClipCloudProvider::region($configs['oss'])!==ClipCloudProvider::region($configs['imm']))throw new Invalid('OSS 和 IMM 必须配置同一地域');
        if($operation==='package'&&ClipCloudProvider::region($configs['ims'])!==ClipCloudProvider::region($configs['imm']))throw new Invalid('视频合成和批量打包必须配置同一地域');
        return $configs;
    }
    private static function packageIds($ids):array
    {
        if(!is_array($ids)||!array_is_list($ids)||!$ids||count($ids)>100)throw new Invalid('每次请选择1～100个成片');
        foreach($ids as $id)if((!is_int($id)&&!(is_string($id)&&ctype_digit($id)))||(int)$id<=0)throw new Invalid('成片编号不正确');
        $ids=array_values(array_unique(array_map('intval',$ids)));sort($ids,SORT_NUMERIC);return $ids;
    }
    private static function packageSources(int $tenant,int $user,int $project,array $ids,array $configs):array
    {
        $rows=self::table()->where(['tenant_id'=>$tenant,'user_id'=>$user,'project_id'=>$project,'state'=>'success'])->whereIn('operation',['render','template_render'])->whereIn('id',$ids)->order('id')->select()->toArray();
        if(count($rows)!==count($ids))throw new Invalid('只能打包本商家、本工程已完成的成片');
        $pin=self::pins($configs)['ims'];$sources=[];
        foreach($rows as $row){
            if((json_decode($row['config_json'],true)['ims']??null)!==$pin)throw new Invalid('成片存储配置已变更，请联系管理员核查原任务');
            $expected=ClipCloudProvider::key($configs['ims'],$tenant,$user,$row['client_token'],'output.mp4');
            if($row['output_key']!==$expected)throw new Invalid('成片存储路径不一致，无法打包');
            $sources[]=['URI'=>'oss://'.$configs['ims']['settings']['output_bucket'].'/'.$expected,'Alias'=>'/clip-'.$row['id'].'.mp4','Mode'=>'fullname'];
        }
        return $sources;
    }
    private static function activeMerchant(int $tenant,int $user):void
    {
        $merchant=Db::name('oem_merchant')->where(['tenant_id'=>$tenant,'user_id'=>$user,'status'=>1])->find();
        $account=Db::name(\app\common\service\merchant\MerchantAccountTables::name($tenant,'user'))->where(['tenant_id'=>$tenant,'id'=>$user,'is_disable'=>0])->whereNull('delete_time')->find();
        if(!$merchant||!$account)throw new Invalid('商家账号已停用或不存在');
    }
    private static function pins(array $configs):array{return array_map(fn($c)=>['source_tenant_id'=>$c['source_tenant_id'],'revision'=>$c['revision']],$configs);}
    private static function uuid():string{$h=bin2hex(random_bytes(16));return substr($h,0,8).'-'.substr($h,8,4).'-4'.substr($h,13,3).'-a'.substr($h,17,3).'-'.substr($h,20);}
    public static function create(int $tenant,int $user,string $operation,array $p):array
    {
        self::activeMerchant($tenant,$user);
        $doc=MerchantClipService::detail($tenant,$user,(int)($p['id']??0));
        if($doc['kind']!=='project'||(int)($p['revision']??0)!==(int)$doc['revision'])throw new Invalid('请先保存并使用当前版本工程');
        $configs=self::resolved($tenant,$operation);$planId=0;$input=[];$assets=[];
        if($operation==='render'){
            $planId=(int)($p['plan_id']??0);$plan=Db::name('oem_clip_plan')->where(['tenant_id'=>$tenant,'user_id'=>$user,'project_id'=>$doc['id'],'id'=>$planId,'revision'=>$doc['revision'],'delete_time'=>0])->find();if(!$plan)throw new Invalid('请选择当前工程版本的有效编排');
            $input=['plan'=>json_decode($plan['plan_json'],true),'config'=>$doc['config']];$assets=MerchantClipService::assets($tenant,$user,$doc['config'],true);
            // Validate all timeline features before uploading or invoking a chargeable API.
            $dummy=[];foreach($assets as $id=>$asset)$dummy[$id]=['url'=>'https://example.invalid/owned','kind'=>$asset['kind'],'duration'=>$asset['duration']];ClipImsTimeline::compile($input['plan'],$dummy);
        }elseif($operation==='package'){
            $ids=self::packageIds($p['job_ids']??null);
            self::packageSources($tenant,$user,(int)$doc['id'],$ids,$configs);
            $input=['job_ids'=>$ids,'pins'=>self::pins($configs)];
        }elseif(in_array($operation,['script','topics'],true))$input=['script'=>$doc['config']['script']];
        elseif(in_array($operation,['voice','clone_voice'],true)){
            $text=ClipConfiguration::text($p['text']??'',10000,true);$speaker=ClipConfiguration::text($p['speaker']??'',160,true);$code=$operation==='voice'?'tts':'icl';
            $profileId=(int)($p['voice_profile_id']??0);
            if($operation==='clone_voice'&&$profileId>0){
                $confirmed=($p['activation_confirmed']??false)===true;
                $profile=ClipVoiceProfileService::forSynthesis($tenant,$user,$profileId,$configs['icl'],$confirmed);
                $input=['text'=>$text,'speaker'=>$profile['speaker_id'],'voice_profile_id'=>$profileId,'activation_confirmed'=>$confirmed];
            }else{
                if(!in_array($speaker,(new ClipCloudProvider())->speakers($configs[$code]),true))throw new Invalid('请选择当前 OEM 已授权的音色');$input=['text'=>$text,'speaker'=>$speaker];
            }
        }elseif($operation==='template_render'){
            $id=ClipConfiguration::text($p['template_id']??'',100,true);$schema=(new ClipCloudTemplates())->detail($configs['ims'],$id);
            if(!is_array($p['values']??null))throw new Invalid('请填写模板替换项');$values=ClipCloudTemplates::values($schema,$p['values']);$config=[];
            foreach($schema['slots']as $slot)if($slot['type']==='material'){$material=$values[$slot['key']];$kind=Db::name('oem_merchant_material')->where(['tenant_id'=>$tenant,'user_id'=>$user,'id'=>$material,'delete_time'=>0])->value('kind');if(!in_array($kind,['video','image','audio','voiceover'],true))throw new Invalid('请选择本商家的有效素材');$field=match($kind){'audio'=>'music_ids','voiceover'=>'voiceover_ids',default=>'material_ids'};$config[$field][]=$material;}
            $config=ClipConfiguration::normalize($config);$assets=MerchantClipService::assets($tenant,$user,$config,true);
            $input=['template_id'=>$id,'fingerprint'=>$schema['fingerprint'],'values'=>$values,'config'=>$config,'output'=>array_intersect_key($doc['config'],array_flip(['ratio','fps','resolution']))+['duration'=>600]];
        }elseif(in_array($operation,['smart_process','image_labels','image_text'],true)){
            $input=$operation==='smart_process'?ClipIntelligence::normalize($p):[];
            $material=(int)($p['material_id']??0);$ids=[$material];if(isset($input['second_material_id']))$ids[]=$input['second_material_id'];
            $config=[];
            foreach($ids as $id){$kind=Db::name('oem_merchant_material')->where(['tenant_id'=>$tenant,'user_id'=>$user,'id'=>$id,'delete_time'=>0])->value('kind');if(!in_array($kind,['video','image','audio','voiceover'],true))throw new Invalid('请选择本商家的有效素材');$field=match($kind){'audio'=>'music_ids','voiceover'=>'voiceover_ids',default=>'material_ids'};$config[$field][]=$id;}
            $config=ClipConfiguration::normalize($config);$assets=MerchantClipService::assets($tenant,$user,$config,true);
            $input+=['material_id'=>$material,'config'=>$config];
        }else{
            $material=(int)($p['material_id']??0);if($material<=0)throw new Invalid('请选择旁白或背景音频素材');
            $materialKind=Db::name('oem_merchant_material')->where(['id'=>$material,'tenant_id'=>$tenant,'user_id'=>$user,'delete_time'=>0])->value('kind');if(!in_array($materialKind,['voiceover','audio'],true))throw new Invalid('请选择本商家的音频素材');
            $config=ClipConfiguration::normalize([$materialKind==='audio'?'music_ids':'voiceover_ids'=>[$material]]);$assets=MerchantClipService::assets($tenant,$user,$config,true);
            $extension=strtolower(pathinfo($assets[$material]['file']['url'],PATHINFO_EXTENSION));
            $formats=($configs['asr']['settings']['resource_id']??'')==='volc.bigasr.auc_turbo'?['mp3','wav','ogg','opus']:['mp3','wav','ogg'];
            if(!in_array($extension,$formats,true))throw new Invalid('当前识别服务支持 '.implode('、',$formats).'，请先转换音频格式');
            $input=['material_id'=>$material,'config'=>$config];
        }
        // This validates ownership AND local path before creating a queue entry.
        foreach($assets as $asset){$row=Db::name(\app\common\service\merchant\MerchantAccountTables::name($tenant,'tenant_file'))->where(['tenant_id'=>$tenant,'source'=>1,'source_id'=>$user,'id'=>$asset['file']['id']])->whereNull('delete_time')->find();if(!$row)throw new Invalid('素材文件不可用');$path=ClipCloudStorage::localPath($row);if($operation==='asr'&&(filesize($path)>100*1024*1024||($asset['duration']??0)>7200))throw new Invalid('识别音频不能超过100MB或2小时');if(in_array($operation,['smart_process','image_labels','image_text'],true))ClipIntelligence::validateFile($operation,$input,$asset,$path);}
        $key=hash('sha256',self::json([$doc['id'],$doc['revision'],$operation,$planId,$input]));
        return Db::transaction(function()use($tenant,$user,$doc,$operation,$planId,$input,$key,$configs){
            Db::name('oem_merchant')->where(['tenant_id'=>$tenant,'user_id'=>$user])->lock(true)->find();
            $current=Db::name('oem_clip_document')->where(['id'=>$doc['id'],'tenant_id'=>$tenant,'user_id'=>$user,'delete_time'=>0])->lock(true)->find();if(!$current||(int)$current['revision']!==(int)$doc['revision'])throw new Invalid('工程已经更新，请重新提交');
            $existing=self::table()->where(['tenant_id'=>$tenant,'user_id'=>$user,'request_key'=>$key])->find();if($existing)return self::safe($existing);
            if(self::table()->where(['tenant_id'=>$tenant,'user_id'=>$user])->whereIn('state',['queued','preparing','submitting','submitted'])->count()>=20)throw new Invalid('同时进行的剪辑云任务最多20条');
            $id=(int)self::table()->insertGetId(['tenant_id'=>$tenant,'user_id'=>$user,'project_id'=>$doc['id'],'plan_id'=>$planId,'revision'=>$doc['revision'],'operation'=>$operation,'request_key'=>$key,'client_token'=>self::uuid(),'config_json'=>self::json(self::pins($configs)),'input_json'=>self::json($input),'result_json'=>'{}','create_time'=>time(),'update_time'=>time()]);
            return self::safe(self::table()->where('id',$id)->find());
        });
    }
    private static function safe(array $r):array
    {
        return array_intersect_key($r,array_flip(['id','project_id','plan_id','revision','operation','state','error','create_time','update_time']))+['result'=>json_decode($r['result_json'],true)?:[]];
    }
    public static function listing(int $tenant,int $user,int $project):array
    {
        MerchantClipService::detail($tenant,$user,$project);return ['lists'=>array_map([self::class,'safe'],self::table()->where(['tenant_id'=>$tenant,'user_id'=>$user,'project_id'=>$project])->order('id desc')->limit(100)->select()->toArray())];
    }
    public static function voices(int $tenant,int $user=0):array
    {
        $result=[];foreach(['tts','icl'] as $code){try{$config=ClipIntegrationService::resolve($tenant,$code);foreach((new ClipCloudProvider())->speakers($config) as $id)$result[]=['id'=>$id,'capability'=>$code,'source'=>$config['source']]+ClipVoiceCatalog::describe($id);}catch(Invalid){}}
        if($user>0)foreach(ClipVoiceProfileService::listing($tenant,$user)['lists'] as $voice)if($voice['can_use'])$result[]=['id'=>'personal-'.$voice['id'],'voice_profile_id'=>$voice['id'],'name'=>$voice['name'],'preview_url'=>$voice['preview_url'],'capability'=>'icl','source'=>'personal','requires_activation'=>$voice['requires_activation']];
        return $result;
    }
    public static function applyLabels(int $tenant,int $user,int $id):array
    {
        self::activeMerchant($tenant,$user);
        return Db::transaction(function()use($tenant,$user,$id){
            Db::name('oem_merchant')->where(['tenant_id'=>$tenant,'user_id'=>$user])->lock(true)->find();
            $job=self::table()->where(['tenant_id'=>$tenant,'user_id'=>$user,'id'=>$id,'operation'=>'image_labels','state'=>'success'])->find();if(!$job)throw new Invalid('标签任务不存在或无访问权限');
            $result=json_decode($job['result_json'],true);$material=(int)($result['source_material_id']??0);
            $row=Db::name('oem_merchant_material')->where(['tenant_id'=>$tenant,'user_id'=>$user,'id'=>$material,'kind'=>'image','delete_time'=>0])->lock(true)->find();if(!$row)throw new Invalid('原图片已移除，请重新选择');
            $meta=Db::name('oem_material_meta')->where(['tenant_id'=>$tenant,'user_id'=>$user,'material_id'=>$material])->lock(true)->find();$ids=json_decode($meta['label_ids']??'[]',true)?:[];
            $service=\app\common\service\merchant\MerchantMaterialService::class;$existing=array_column($service::labels($tenant,$user),'id','name');
            foreach(array_slice($result['labels']??[],0,20)as $label){$name=$label['name'];if(!isset($existing[$name]))$existing[$name]=$service::saveLabel($tenant,$user,['name'=>$name]);$ids[]=(int)$existing[$name];}
            $ids=array_values(array_unique($ids));$service::batch($tenant,$user,['ids'=>[$material],'kind'=>'image','action'=>'label','label_ids'=>$ids]);
            return ['material_id'=>$material,'label_count'=>count($ids)];
        });
    }
    public function delivery(int $tenant,int $user,int $id,int $index=0):array
    {
        self::activeMerchant($tenant,$user);
        $job=self::table()->where(['id'=>$id,'tenant_id'=>$tenant,'user_id'=>$user,'state'=>'success'])->whereIn('operation',['render','template_render','package','smart_process'])->find();if(!$job)throw new Invalid('成片或处理文件不存在或无访问权限');
        $configs=self::resolved($tenant,$job['operation']);if(self::pins($configs)!==json_decode($job['config_json'],true))throw new Invalid('成片配置已变更，请联系 OEM 核查原任务的存储账号');
        $code=$job['operation']==='package'?'imm':'ims';
        $key=$job['output_key'];if($job['operation']==='smart_process'){$prefix=ClipCloudProvider::key($configs['ims'],$tenant,$user,$job['client_token'],'smart');$files=json_decode($job['result_json'],true)['files']??[];$key=$files[$index]??'';if($index<0||!is_string($key)||!str_starts_with($key,$prefix.'/')||str_contains($key,'..'))throw new Invalid('处理文件不存在或无访问权限');}
        return ['url'=>$this->transport->signed($configs[$code],$configs[$code]['settings']['output_bucket'],$key,900),'expires_in'=>900];
    }
    private static function validateAssets(array $job,array $input):array
    {
        if(!isset($input['config']))return [];
        return MerchantClipService::assets((int)$job['tenant_id'],(int)$job['user_id'],$input['config'],true);
    }
    /** One leased step. A crashed/uncertain submit is never blindly re-submitted. */
    public function tick(?int $onlyId=null):bool
    {
        $job=Db::transaction(function()use($onlyId){
            $query=self::table()->whereIn('state',['queued','preparing','submitting','submitted'])->where('next_poll','<=',time())->where('lease_until','<',time());if($onlyId!==null)$query->where('id',$onlyId);
            $r=$query->order('id')->lock(true)->find();if(!$r)return null;
            if($r['state']==='submitting'){self::table()->where('id',$r['id'])->update(['state'=>'unknown','error'=>'提交过程被中断，需核查服务商任务，禁止自动重复提交','update_time'=>time()]);return ['skip'=>true];}
            $r['lease_token']=bin2hex(random_bytes(16));self::table()->where('id',$r['id'])->update(['lease_token'=>$r['lease_token'],'lease_until'=>time()+300,'state'=>$r['state']==='submitted'?'submitted':'preparing','update_time'=>time()]);return $r;
        });
        if(!$job)return false;if(isset($job['skip']))return true;
        $q=fn()=>self::table()->where(['id'=>$job['id'],'lease_token'=>$job['lease_token']]);$submitting=false;$provider=new ClipCloudProvider($this->transport);$storage=new ClipCloudStorage($this->transport);
        try{
            $tenant=(int)$job['tenant_id'];$user=(int)$job['user_id'];
            self::activeMerchant($tenant,$user);
            if(AppAccessService::assertTenantCanUse($tenant,'smart_clip',$user))throw new Invalid('当前商家的剪辑应用授权不可用');
            $configs=self::resolved($tenant,$job['operation']);if(self::pins($configs)!==json_decode($job['config_json'],true))throw new Invalid('OEM／平台配置已变更，任务已阻止；请核查原任务，不能自动切换账号');
            $input=json_decode($job['input_json'],true,128,JSON_THROW_ON_ERROR);
            if($job['state']==='submitted'){
                if(in_array($job['operation'],['render','template_render'],true))$result=$provider->renderStatus($configs['ims'],$job['provider_id']);
                elseif($job['operation']==='package'){
                    // IMM retains task metadata for seven days. Stop polling instead of resubmitting.
                    if(time()-(int)$job['create_time']>=7*86400){$q()->update(['state'=>'unknown','error'=>'打包任务已超过查询保留期，请人工核查云端结果，勿重复提交','lease_until'=>0,'update_time'=>time()]);return true;}
                    $result=$provider->packageStatus($configs['imm'],$job['provider_id']);
                    if($result['state']==='success')$result['file_count']=count($input['job_ids']);
                }
                elseif($job['operation']==='smart_process'){
                    if(time()-(int)$job['create_time']>=24*3600){$q()->update(['state'=>'unknown','error'=>'智能处理等待超过24小时，请核查原任务，勿重复提交','lease_until'=>0,'update_time'=>time()]);return true;}
                    $result=(new ClipIntelligence($this->transport))->status($configs['ims'],$job['provider_id'],$input['function'],ClipCloudProvider::key($configs['ims'],$tenant,$user,$job['client_token'],'smart'));
                }
                elseif($job['operation']==='asr'){
                    // Local safety bound, not a provider retention guarantee. Never submit again.
                    if(time()-(int)$job['create_time']>=6*3600){$q()->update(['state'=>'unknown','error'=>'字幕任务等待超过6小时，请核查云端任务，勿重复提交','lease_until'=>0,'update_time'=>time()]);return true;}
                    $result=$provider->transcribeStatus($configs['asr'],$job['provider_id']);
                }
                else{$code=$job['operation']==='clone_voice'?'icl':'tts';$result=$provider->voiceStatus($configs[$code],$job['provider_id'],$job['client_token']);
                    if($result['state']==='success'){$voice=$storage->persistVoice($result['audio_url'],$tenant,$user,$job['client_token'],$configs['oss']);$result=['state'=>'success']+$voice+['sentences'=>$result['sentences']];if(!empty($input['voice_profile_id']))ClipVoiceProfileService::markUsed($tenant,$user,(int)$input['voice_profile_id'],$configs['icl']);}}
                $state=$result['state'];unset($result['state']);$q()->update(['state'=>$state,'result_json'=>self::json($result),'error'=>$state==='failed'?'云端任务失败，请联系管理员核查服务商任务':'','next_poll'=>time()+15,'lease_until'=>0,'update_time'=>time()]);return true;
            }
            if(!Db::name('oem_clip_document')->where(['id'=>$job['project_id'],'tenant_id'=>$tenant,'user_id'=>$user,'kind'=>'project','delete_time'=>0])->count())throw new Invalid('工程已移入回收站，未提交云服务');
            $assets=self::validateAssets($job,$input);
            if(in_array($job['operation'],['smart_process','image_labels','image_text'],true))foreach($assets as $asset){$file=Db::name(\app\common\service\merchant\MerchantAccountTables::name($tenant,'tenant_file'))->where(['tenant_id'=>$tenant,'source'=>1,'source_id'=>$user,'id'=>$asset['file']['id']])->whereNull('delete_time')->find();if(!$file)throw new Invalid('素材文件不可用');ClipIntelligence::validateFile($job['operation'],$input,$asset,ClipCloudStorage::localPath($file));}
            if($job['operation']==='clone_voice'&&!empty($input['voice_profile_id'])){
                $profile=ClipVoiceProfileService::forSynthesis($tenant,$user,(int)$input['voice_profile_id'],$configs['icl'],($input['activation_confirmed']??false)===true);
                if($input['speaker']!==$profile['speaker_id'])throw new Invalid('个人音色标识发生变化，请核查任务');
                // Authorize exactly this owned identity for the provider; never persist it in shared settings.
                $configs['icl']['settings']['speaker_ids']=$profile['speaker_id'];
            }
            $sources=$job['operation']==='package'?self::packageSources($tenant,$user,(int)$job['project_id'],self::packageIds($input['job_ids']??null),$configs):[];
            $heartbeat=function()use($q,$tenant,$user,$job,$configs){self::activeMerchant($tenant,$user);if(AppAccessService::assertTenantCanUse($tenant,'smart_clip',$user))throw new Invalid('商家剪辑应用授权已撤回');if(self::pins(self::resolved($tenant,$job['operation']))!==self::pins($configs))throw new Invalid('素材上传期间配置变更或平台借权已撤回');$q()->update(['lease_until'=>time()+300,'update_time'=>time()]);};
            $media=$assets?$storage->stage($tenant,$user,$assets,$configs['oss'],$job['client_token'],$heartbeat):[];$heartbeat();
            $key='';if(in_array($job['operation'],['render','template_render'],true))$key=ClipCloudProvider::key($configs['ims'],$tenant,$user,$job['client_token'],'output.mp4');
            if($job['operation']==='package')$key=ClipCloudProvider::key($configs['imm'],$tenant,$user,$job['client_token'],'clips.zip');
            if($job['operation']==='smart_process')$key=ClipCloudProvider::key($configs['ims'],$tenant,$user,$job['client_token'],'smart');
            $q()->update(['state'=>'submitting','output_key'=>$key,'lease_until'=>time()+300,'update_time'=>time()]);$submitting=true;
            $result=match($job['operation']){
                'render'=>$provider->render($configs['ims'],$input['plan'],$media,$key,$job['client_token']),
                'template_render'=>(new ClipCloudTemplates($this->transport))->render($configs['ims'],$input,$media,$key,$job['client_token']),
                'package'=>$provider->package($configs['imm'],$sources,$key,$job['client_token']),
                'script'=>$provider->script($configs['llm'],$input['script']),
                'topics'=>$provider->topics($configs['llm'],$input['script']),
                'voice','clone_voice'=>$provider->voice($configs[$job['operation']==='voice'?'tts':'icl'],$input['text'],$input['speaker'],$job['client_token'],$user),
                'asr'=>$provider->transcribe($configs['asr'],$this->transport->signed($configs['oss'],$configs['oss']['settings']['bucket'],$media[$input['material_id']]['key'],14400),$job['client_token'],$user),
                'smart_process'=>(new ClipIntelligence($this->transport))->submit($configs['ims'],$configs['oss'],$input,$media,$key,$job['client_token']),
                'image_labels','image_text'=>(new ClipIntelligence($this->transport))->image($configs['imm'],$configs['oss'],$input,$media,$job['operation']==='image_text'),
            };
            $async=isset($result['provider_id']);$q()->update(['state'=>$async?'submitted':'success','provider_id'=>$result['provider_id']??'','result_json'=>$async?'{}':self::json($result),'error'=>'','next_poll'=>time()+15,'lease_until'=>0,'update_time'=>time()]);
        }catch(Invalid $e){$q()->update(['state'=>'blocked','error'=>mb_substr($e->getMessage(),0,240),'lease_until'=>0,'update_time'=>time()]);}
        catch(ClipCloudFailure $e){$poll=$job['state']==='submitted';$q()->update(['state'=>$poll?'submitted':($submitting&&$e->uncertain?'unknown':'failed'),'error'=>$e->getMessage(),'next_poll'=>time()+60,'lease_until'=>0,'update_time'=>time()]);}
        catch(\Throwable){$q()->update(['state'=>$job['state']==='submitted'?'submitted':($submitting?'unknown':'failed'),'error'=>'剪辑任务处理异常，请联系管理员核查；不会自动重复提交','next_poll'=>time()+60,'lease_until'=>0,'update_time'=>time()]);}
        return true;
    }
}
