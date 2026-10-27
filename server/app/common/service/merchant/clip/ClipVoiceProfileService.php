<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

use app\common\service\app\AppAccessService;
use app\common\service\merchant\MerchantAccountTables;
use think\facade\Db;
use InvalidArgumentException as Invalid;

/** Account-owned voice identities; samples are private and never browser-addressable. */
final class ClipVoiceProfileService
{
    public function __construct(private readonly ClipCloudTransport $transport=new ClipNativeCloudTransport()){}
    private static function table(){return Db::name('oem_clip_voice');}
    private static function owned(int $tenant,int $user,int $id,bool $lock=false):array
    {
        self::access($tenant,$user);
        $row=self::table()->where(['id'=>$id,'tenant_id'=>$tenant,'user_id'=>$user])->lock($lock)->find();
        if(!$row)throw new Invalid('音色不存在或不属于当前账号');return $row;
    }
    private static function access(int $tenant,int $user):void
    {
        if(!Db::name('oem_merchant')->where(['tenant_id'=>$tenant,'user_id'=>$user,'status'=>1])->count()
            ||!Db::name(MerchantAccountTables::name($tenant,'user'))->where(['tenant_id'=>$tenant,'id'=>$user,'is_disable'=>0])->whereNull('delete_time')->count()
            ||AppAccessService::assertTenantCanUse($tenant,'smart_clip',$user))throw new Invalid('当前账号没有可用的声音复刻权限');
    }
    public static function signature(array $config):string
    {
        return hash('sha256',json_encode([$config['source_tenant_id'],$config['credentials']['api_key'],$config['settings']['resource_id']],JSON_THROW_ON_ERROR));
    }
    private static function configFor(array $row):array
    {
        $config=ClipIntegrationService::resolve((int)$row['tenant_id'],'icl');
        if(!hash_equals($row['config_signature'],self::signature($config)))throw new Invalid('音色所属云账号配置已变更，请联系管理员核查，不能自动换账号调用');
        return $config;
    }
    private static function safe(array $row,?array $config):array
    {
        $available=$config&&hash_equals($row['config_signature'],self::signature($config));
        $state=$row['state'];
        if($state==='ready'&&(int)$row['trial_expires']<=time())$state='expired';
        return ['id'=>(int)$row['id'],'name'=>$row['name'],'state'=>$state,'available'=>(bool)$available,
            'can_use'=>$available&&in_array($state,['ready','active'],true),'requires_activation'=>!(int)$row['activated_at'],
            'preview_url'=>$available&&(int)$row['preview_expires']>time()?$row['preview_url']:'',
            'trial_expires'=>(int)$row['trial_expires'],'create_time'=>(int)$row['create_time'],
            'error'=>$available?$row['error']:'当前服务配置与音色所属账号不一致，请联系管理员'];
    }
    public static function listing(int $tenant,int $user):array
    {
        self::access($tenant,$user);$config=null;try{$config=ClipIntegrationService::resolve($tenant,'icl');}catch(Invalid){}
        $rows=self::table()->where(['tenant_id'=>$tenant,'user_id'=>$user])->order('id desc')->limit(100)->select()->toArray();
        return ['lists'=>array_map(fn($r)=>self::safe($r,$config),$rows),
            'can_create'=>$config&&($config['settings']['clone_mode']??'')==='postpaid',
            'notice'=>'首次正式配音会启用音色并产生音色开通费用，费用由服务账号承担。试听音色需在7天内启用；启用后可反复使用，不能重新训练覆盖。'];
    }
    public static function upload(int $tenant,int $user,$request):array
    {
        $file=$request->file('file');if(!$file)throw new Invalid('请选择声音样本');
        return self::create($tenant,$user,$file->getPathname(),strtolower($file->getOriginalExtension()),$request->post(false));
    }
    public static function create(int $tenant,int $user,string $path,string $format,array $p):array
    {
        self::access($tenant,$user);
        if(!in_array($p['consent']??null,[true,'1',1],true))throw new Invalid('请确认这是本人声音或已取得声音权利人的授权，并同意将样本交由语音服务处理');
        $name=ClipConfiguration::text($p['name']??'',80,true);$requestKey=$p['request_key']??'';
        if(!is_string($requestKey)||!preg_match('/^[a-zA-Z0-9-]{16,64}$/D',$requestKey))throw new Invalid('上传请求标识无效，请重新打开上传窗口');
        $config=ClipIntegrationService::resolve($tenant,'icl');
        if(($config['settings']['clone_mode']??'')!=='postpaid')throw new Invalid('请联系管理员启用用户上传复刻及后付费音色服务');
        if(!is_file($path)||filesize($path)<100||filesize($path)>10*1024*1024)throw new Invalid('声音样本需小于10MB');
        $mime=(new \finfo(FILEINFO_MIME_TYPE))->file($path);
        if(!in_array($format,['wav','mp3','ogg','m4a','aac'],true)||(!str_starts_with($mime,'audio/')&&!in_array($mime,['video/mp4','application/ogg'],true)))throw new Invalid('请选择有效的 wav、mp3、ogg、m4a 或 aac 音频');
        $duration=ClipMediaProbe::localDuration($path);
        if(!$duration||$duration<5||$duration>60)throw new Invalid('请上传5～60秒清晰、单人说话的声音样本');
        $signature=self::signature($config);$hash=hash_file('sha256',$path);$createdPath=null;
        try{return Db::transaction(function()use($tenant,$user,$name,$requestKey,$signature,$hash,$path,$format,$duration,$config,&$createdPath){
            Db::name('oem_merchant')->where(['tenant_id'=>$tenant,'user_id'=>$user])->lock(true)->find();
            $old=self::table()->where(['tenant_id'=>$tenant,'user_id'=>$user,'request_key'=>$requestKey])->find();
            self::table()->where(['tenant_id'=>$tenant,'user_id'=>$user,'state'=>'ready','activated_at'=>0])->where('trial_expires','>',0)->where('trial_expires','<=',time())->where('lease_until','<',time())->update(['state'=>'expired','update_time'=>time()]);
            if(!$old)$old=self::table()->where(['tenant_id'=>$tenant,'user_id'=>$user,'sample_hash'=>$hash,'config_signature'=>$signature])->whereNotIn('state',['failed','expired'])->order('id desc')->find();
            if($old)return self::safe($old,$config);
            if(self::table()->where(['tenant_id'=>$tenant,'user_id'=>$user])->whereNotIn('state',['failed','expired'])->count()>=20)throw new Invalid('当前账号最多保留20个音色');
            $custom='mtvoice_'.bin2hex(random_bytes(16));$relative='merchant-voices/t'.$tenant.'/u'.$user.'/'.$custom.'.'.$format;
            $target=root_path().'runtime/'.$relative;$dir=dirname($target);
            if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new Invalid('声音存储暂不可用');
            if(!copy($path,$target))throw new Invalid('声音样本保存失败');$createdPath=$target;@chmod($target,0600);
            $id=self::table()->insertGetId(['tenant_id'=>$tenant,'user_id'=>$user,'name'=>$name,'request_key'=>$requestKey,'custom_id'=>$custom,
                'config_signature'=>$signature,'sample_hash'=>$hash,'sample_path'=>$relative,'sample_format'=>$format,'duration'=>$duration,
                'state'=>'queued','preview_url'=>'','consent_version'=>'voice-rights-v1','consent_time'=>time(),'create_time'=>time(),'update_time'=>time()]);
            return self::safe(self::owned($tenant,$user,(int)$id),$config);
        });}catch(\Throwable $e){if($createdPath&&is_file($createdPath))unlink($createdPath);throw $e;}
    }
    public static function rename(int $tenant,int $user,int $id,string $name):array
    {
        self::owned($tenant,$user,$id);$name=ClipConfiguration::text($name,80,true);
        self::table()->where(['tenant_id'=>$tenant,'user_id'=>$user,'id'=>$id])->update(['name'=>$name,'update_time'=>time()]);return ['id'=>$id,'name'=>$name];
    }
    public static function forSynthesis(int $tenant,int $user,int $id,array $config,bool $activationConfirmed):array
    {
        $row=self::owned($tenant,$user,$id);self::configFor($row);
        if(!hash_equals($row['config_signature'],self::signature($config)))throw new Invalid('音色服务来源不一致');
        if(!in_array($row['state'],['ready','active'],true)||($row['state']==='ready'&&(int)$row['trial_expires']<=time()))throw new Invalid('音色尚未就绪或试听已过期，请在我的音色中查看');
        if(!(int)$row['activated_at']&&!$activationConfirmed)throw new Invalid('首次使用会产生音色开通费用，请先试听并确认启用');
        if($row['speaker_id']==='')throw new Invalid('音色未返回可用标识');return $row;
    }
    public static function markUsed(int $tenant,int $user,int $id,array $config):void
    {
        $row=self::owned($tenant,$user,$id);if(!hash_equals($row['config_signature'],self::signature($config)))throw new Invalid('音色服务配置已变更');
        self::table()->where(['id'=>$id,'tenant_id'=>$tenant,'user_id'=>$user])->update(['state'=>'active','activated_at'=>time(),'error'=>'','update_time'=>time()]);
    }
    /** Manual refresh never submits training or synthesizes paid audio. */
    public function refresh(int $tenant,int $user,int $id):array
    {
        self::owned($tenant,$user,$id);
        self::table()->where(['id'=>$id,'tenant_id'=>$tenant,'user_id'=>$user])->whereIn('state',['training','ready','active','unknown','review','expired','blocked'])->where('lease_until','<',time())->update(['next_poll'=>0]);
        $this->tick($id,true);$row=self::owned($tenant,$user,$id);$config=null;try{$config=self::configFor($row);}catch(Invalid){}
        return self::safe($row,$config);
    }
    private static function samplePath(array $row):string
    {
        $base=realpath(root_path().'runtime/merchant-voices/t'.$row['tenant_id'].'/u'.$row['user_id']);
        $path=realpath(root_path().'runtime/'.$row['sample_path']);
        if(!$base||!$path||!str_starts_with(str_replace('\\','/',$path),str_replace('\\','/',$base).'/')||!is_file($path)||!hash_equals($row['sample_hash'],hash_file('sha256',$path)))throw new Invalid('声音样本不可用，请重新上传');
        return $path;
    }
    private static function result(array $row,array $result):array
    {
        if(!isset($result['status'])||!in_array($result['status'],[0,1,2,3,4],true))throw new ClipCloudFailure(true,'复刻状态暂不明确，请刷新查询；不会重复训练');
        $state=match($result['status']){0=>(int)$row['trial_expires']>0&&time()>=(int)$row['trial_expires']?'expired':'unknown',1=>'training',2=>'ready',3=>'failed',4=>'active'};
        $patch=['state'=>$state,'error'=>$state==='failed'?'声音复刻未通过，请检查样本质量后重新上传':'','preview_url'=>'','preview_expires'=>0];
        if(in_array($state,['ready','active'],true)){
            $speaker=(string)($result['speaker_id']??$row['custom_id']);if($speaker==='custom_speaker_id')$speaker=$row['custom_id'];
            if(!preg_match('/^[A-Za-z0-9_-]{1,160}$/D',$speaker))throw new ClipCloudFailure(true,'音色标识异常，请联系管理员');
            $patch['speaker_id']=$speaker;$cloudCreated=(int)floor(((int)($result['create_time']??0))/1000);
            $patch['trial_expires']=(int)$row['trial_expires']?:($cloudCreated>0?min(time(),$cloudCreated):(int)$row['create_time'])+7*86400;
            if($state==='active'||(int)$row['activated_at']){$patch['state']='active';$patch['activated_at']=(int)$row['activated_at']?:time();}
            foreach($result['speaker_status']??[] as $voice)if(in_array((int)($voice['model_type']??0),[5,4],true)&&!empty($voice['demo_audio'])){
                try{ClipNativeCloudTransport::speechHost($voice['demo_audio']);$patch['preview_url']=$voice['demo_audio'];$patch['preview_expires']=time()+3300;}catch(Invalid){}break;
            }
        }
        return $patch;
    }
    public function tick(?int $onlyId=null,bool $queryOnly=false):bool
    {
        $row=Db::transaction(function()use($onlyId,$queryOnly){
            $states=$queryOnly?['training','ready','active','unknown','review','expired','blocked']:['queued','submitting','training','unknown','ready'];
            $q=self::table()->whereIn('state',$states)->where('next_poll','<=',time())->where('lease_until','<',time());if($onlyId!==null)$q->where('id',$onlyId);
            $r=$q->order('next_poll,id')->lock(true)->find();if(!$r)return null;
            $r['lease_token']=bin2hex(random_bytes(16));self::table()->where('id',$r['id'])->update(['lease_token'=>$r['lease_token'],'lease_until'=>time()+300]);return $r;
        });
        if(!$row)return false;$q=fn()=>self::table()->where(['id'=>$row['id'],'lease_token'=>$row['lease_token']]);$submitting=false;
        try{
            self::access((int)$row['tenant_id'],(int)$row['user_id']);$config=self::configFor($row);$provider=new ClipCloudProvider($this->transport);
            if($row['state']==='queued'&&!$queryOnly){
                if(($config['settings']['clone_mode']??'')!=='postpaid')throw new Invalid('管理员已停用用户上传复刻');
                $bytes=file_get_contents(self::samplePath($row));if($bytes===false)throw new Invalid('无法读取声音样本');
                $q()->update(['state'=>'submitting','update_time'=>time()]);$submitting=true;
                $result=$provider->trainVoice($config,$row['custom_id'],$bytes,$row['sample_format'],self::uuid());
            }else $result=$provider->trainedVoiceStatus($config,$row['custom_id'],self::uuid());
            $patch=self::result($row,$result);
            if(in_array($patch['state'],['unknown','training'],true)&&time()-(int)$row['create_time']>6*3600)$patch=['state'=>'review','error'=>'复刻任务等待超过6小时，请联系管理员核查原音色，勿重复训练'];
            $q()->update($patch+['lease_until'=>0,'next_poll'=>time()+(in_array($patch['state'],['ready','active'],true)?1800:30),'update_time'=>time()]);
        }catch(Invalid $e){$q()->update(['state'=>'blocked','error'=>mb_substr($e->getMessage(),0,240),'lease_until'=>0,'update_time'=>time()]);}
        catch(\Throwable $e){
            $state=$submitting?($e instanceof ClipCloudFailure&&!$e->uncertain?'failed':'unknown'):($row['state']==='submitting'?'unknown':$row['state']);
            if(in_array($state,['unknown','training'],true)&&time()-(int)$row['create_time']>6*3600)$state='review';
            $q()->update(['state'=>$state,'error'=>'复刻结果暂不可用，请刷新查询或联系管理员；系统不会自动重复训练','lease_until'=>0,'next_poll'=>time()+60,'update_time'=>time()]);
        }
        return true;
    }
    private static function uuid():string{$h=bin2hex(random_bytes(16));return substr($h,0,8).'-'.substr($h,8,4).'-4'.substr($h,13,3).'-a'.substr($h,17,3).'-'.substr($h,20);}
}
