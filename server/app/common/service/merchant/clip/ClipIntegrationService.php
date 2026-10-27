<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

use think\facade\Db;
use InvalidArgumentException as Invalid;

/** New merchant clip/task capabilities only. Native storage/model/channel/WeChat resolution is untouched. */
final class ClipIntegrationService
{
    public const NAMESPACE='merchant_clip_v1';
    private const ALIYUN=['oss','ims','imm'];
    private static function credentialMode(string $code,array $settings,array $secrets):string
    {
        if(!in_array($code,self::ALIYUN,true))return 'own';
        return $settings['credential_mode']??($secrets?'own':'shared');
    }
    private static function credentials(int $tenant,string $code,array $settings,array $secrets):array
    {
        if(self::credentialMode($code,$settings,$secrets)!=='shared')return $secrets;
        $shared=self::row($tenant,'aliyun');
        if(!$shared||(int)$shared['is_deleted'])return [];
        return ClipCredentialVault::open($shared['secret_cipher'],$tenant,'aliyun');
    }
    private static function aliyun(int $tenant,bool $reveal):array
    {
        $row=self::row($tenant,'aliyun');$keys=[];$state='missing';
        if($row&&!(int)$row['is_deleted']){
            try{$keys=ClipCredentialVault::open($row['secret_cipher'],$tenant,'aliyun');$state=empty($keys['access_key_id'])||empty($keys['access_key_secret'])?'incomplete':'configured';}
            catch(\Throwable){$state='unreadable';}
        }
        return ['revision'=>(int)($row['revision']??0),'state'=>$state,'secrets'=>$reveal?$keys:[]];
    }
    public static function saveAliyun(int $tenant,int $actor,array $p):array
    {
        self::tenant($tenant);$expected=self::revision($p['revision']??0);
        if(array_diff(array_keys($p),['revision','secrets']))throw new Invalid('公共凭证包含不支持的字段');
        $keys=$p['secrets']??[];
        if(!is_array($keys)||array_diff(array_keys($keys),['access_key_id','access_key_secret']))throw new Invalid('公共凭证格式不正确');
        foreach(['access_key_id','access_key_secret'] as $key){
            if(!is_string($keys[$key]??null)||trim($keys[$key])===''||strlen($keys[$key])>2048||preg_match('/[\x00-\x20*]/',trim($keys[$key])))throw new Invalid('请填写完整的 AccessKey ID 和 AccessKey Secret');
            $keys[$key]=trim($keys[$key]);
        }
        return Db::transaction(function()use($tenant,$actor,$expected,$keys){
            if($tenant)Db::name('tenant')->where('id',$tenant)->lock(true)->find();else Db::name('admin')->where('root',1)->order('id')->lock(true)->find();
            $old=self::row($tenant,'aliyun',true);
            if((int)($old['revision']??0)!==$expected)throw new Invalid('公共凭证已在其他窗口更新，请刷新后保存');
            $data=['enabled'=>1,'settings_json'=>'{}','secret_cipher'=>ClipCredentialVault::seal($keys,$tenant,'aliyun'),'revision'=>$expected+1,'is_deleted'=>0,'updated_by'=>$actor,'update_time'=>time()];
            if($old)Db::name('oem_clip_integration')->where(['tenant_id'=>$tenant,'capability'=>'aliyun'])->update($data);
            else Db::name('oem_clip_integration')->insert($data+['tenant_id'=>$tenant,'capability'=>'aliyun']);
            // Existing job pins must notice a shared account change just like a per-service edit.
            foreach(self::ALIYUN as $code){
                $service=self::row($tenant,$code,true);if(!$service||(int)$service['is_deleted'])continue;
                $settings=json_decode($service['settings_json'],true)?:[];
                $ownKeys=ClipCredentialVault::open($service['secret_cipher'],$tenant,$code);
                if(self::credentialMode($code,$settings,$ownKeys)!=='shared')continue;
                $revision=(int)$service['revision']+1;
                Db::name('oem_clip_integration')->where(['tenant_id'=>$tenant,'capability'=>$code])->update(['revision'=>$revision,'updated_by'=>$actor,'update_time'=>time()]);
                self::audit($tenant,$code,'shared_credentials',$actor,$revision);
            }
            self::audit($tenant,'aliyun','save',$actor,$expected+1);
            return ['revision'=>$expected+1];
        });
    }
    public static function catalog():array
    {
        $ak=[['access_key_id','AccessKey ID',true,true],['access_key_secret','AccessKey Secret',true,true]];
        return [
            'oss'=>['name'=>'素材云存储','provider'=>'阿里云 OSS','fields'=>array_merge([['region','地域',false,true],['bucket','Bucket',false,true],['prefix','素材目录前缀',false,false]],$ak)],
            'ims'=>['name'=>'视频合成','provider'=>'阿里云 IMS','fields'=>array_merge([['region','地域',false,true],['output_bucket','输出 Bucket',false,true],['role_arn','服务角色 ARN',false,false],['prefix','成片目录前缀',false,false],['template_ids','已审核开放的云模板 ID（最多20个，逗号分隔）',false,false]],$ak)],
            'tts'=>['name'=>'文本配音','provider'=>'火山引擎语音合成','fields'=>[['resource_id','资源 ID',false,true],['speaker_ids','可用音色 ID（每行一个）',false,true],['api_key','API Key',true,true]]],
            'icl'=>['name'=>'自定义音色','provider'=>'火山引擎声音复刻','fields'=>[['resource_id','资源 ID',false,true],['clone_mode','用户上传复刻',false,false],['speaker_ids','已有公共音色 ID（选填，每行一个）',false,false],['api_key','API Key',true,true]]],
            'llm'=>['name'=>'AI脚本','provider'=>'火山方舟文本／多模态模型','fields'=>[['model_id','模型或推理接入点 ID',false,true],['api_key','API Key',true,true]]],
            'asr'=>['name'=>'自动字幕','provider'=>'火山引擎录音识别','fields'=>[['resource_id','资源 ID',false,true],['api_key','API Key',true,true]]],
            'task_notify'=>['name'=>'员工任务通知','provider'=>'微信认证服务号','fields'=>[['appid','服务号 AppID',false,true],['app_secret','服务号 AppSecret',true,true],['template_id','任务通知模板 ID',false,true],['public_base','任务页公网地址（HTTPS域名）',false,true],['data_map','模板字段映射 JSON（字段名: title/store/content/time）',false,true],['callback_token','送达回调 Token（选填，安全模式）',true,false],['callback_aes','送达回调 EncodingAESKey（选填，43位）',true,false]]],
            'imm'=>['name'=>'批量打包下载','provider'=>'阿里云 IMM','fields'=>array_merge([['region','地域',false,true],['project','IMM 项目名称',false,true],['output_bucket','输出 Bucket',false,true],['prefix','打包目录前缀',false,false]],$ak)],
        ];
    }
    private static function capability($code):array
    {
        if(!is_string($code)||!isset(self::catalog()[$code]))throw new Invalid('仅支持本次新增营销能力的配置');return self::catalog()[$code];
    }
    private static function tenant(int $tenant):void
    {
        if($tenant<0||($tenant>0&&!Db::name('tenant')->where('id',$tenant)->whereNull('delete_time')->find()))throw new Invalid('OEM 不存在');
    }
    private static function row(int $tenant,string $code,bool $lock=false):?array{return Db::name('oem_clip_integration')->where(['tenant_id'=>$tenant,'capability'=>$code])->lock($lock)->find();}
    private static function audit(int $tenant,string $code,string $action,int $actor,int $revision):void{Db::name('oem_clip_config_audit')->insert(['tenant_id'=>$tenant,'capability'=>$code,'action'=>$action,'actor_id'=>$actor,'revision'=>$revision,'create_time'=>time()]);}
    public static function boolean($value):bool
    {
        if(!in_array($value,[true,false,0,1,'0','1'],true))throw new Invalid('开关值不正确');return in_array($value,[true,1,'1'],true);
    }
    private static function revision($value):int
    {
        if(!is_int($value)&&!(is_string($value)&&ctype_digit($value)))throw new Invalid('配置版本不正确');if((int)$value<0)throw new Invalid('配置版本不正确');return (int)$value;
    }
    public static function policy(int $tenant):array
    {
        self::tenant($tenant);if($tenant<=0)return ['allow_platform'=>false,'revision'=>0];$r=Db::name('oem_clip_borrow_policy')->where('tenant_id',$tenant)->find();
        return ['allow_platform'=>(int)($r['allow_platform']??0)===1,'revision'=>(int)($r['revision']??0),'capabilities'=>array_keys(self::catalog()),'namespace'=>self::NAMESPACE];
    }
    /** Caller is a platform authority; OEM APIs deliberately never expose this mutation. */
    public static function grant(int $tenant,$allow,int $actor,?int $expected=null):array
    {
        self::tenant($tenant);if($tenant<=0)throw new Invalid('请选择 OEM');$allow=self::boolean($allow);
        return Db::transaction(function()use($tenant,$allow,$actor,$expected){
            // Tenant lock serializes the first policy insert and account provisioning.
            Db::name('tenant')->where('id',$tenant)->lock(true)->find();$old=Db::name('oem_clip_borrow_policy')->where('tenant_id',$tenant)->lock(true)->find();$revision=(int)($old['revision']??0);
            if($expected!==null&&$revision!==$expected)throw new Invalid('借权设置已更新，请刷新重试');
            if($old&&(bool)$old['allow_platform']===$allow)return self::policy($tenant);
            $data=['allow_platform'=>$allow?1:0,'revision'=>$revision+1,'updated_by'=>$actor,'update_time'=>time()];
            if($old)Db::name('oem_clip_borrow_policy')->where('tenant_id',$tenant)->update($data);else Db::name('oem_clip_borrow_policy')->insert($data+['tenant_id'=>$tenant]);
            self::audit($tenant,'policy',$allow?'grant':'revoke',$actor,$revision+1);return self::policy($tenant);
        });
    }
    private static function missing(array $definition,array $settings,array $secrets):array
    {
        $missing=[];foreach($definition['fields'] as [$key,$label,$secret,$required])if($required&&trim((string)(($secret?$secrets:$settings)[$key]??''))==='')$missing[]=$label;
        if(in_array('clone_mode',array_column($definition['fields'],0),true)&&($settings['clone_mode']??'')!=='postpaid'&&trim((string)($settings['speaker_ids']??''))==='')$missing[]='启用用户上传复刻或填写已有公共音色 ID';
        return $missing;
    }
    private static function inspect(?array $row,string $code):array
    {
        if(!$row||(int)$row['is_deleted'])return ['state'=>'missing','complete'=>false,'missing'=>[]];
        try{$settings=json_decode($row['settings_json'],true,32,JSON_THROW_ON_ERROR);$secrets=ClipCredentialVault::open($row['secret_cipher'],(int)$row['tenant_id'],$code);$secrets=self::credentials((int)$row['tenant_id'],$code,$settings,$secrets);$missing=self::missing(self::capability($code),$settings,$secrets);
            return ['state'=>!(int)$row['enabled']?'disabled':($missing?'incomplete':'configured'),'complete'=>!$missing,'missing'=>$missing];
        }catch(\Throwable){return ['state'=>'unreadable','complete'=>false,'missing'=>[]];}
    }
    public static function metadata(int $tenant,string $code):array
    {
        self::capability($code);self::tenant($tenant);$own=self::row($tenant,$code);$info=self::inspect($own,$code);$source=$info['state']==='missing'?'none':($tenant?'oem':'platform');
        if($tenant>0&&$info['state']==='missing'&&self::policy($tenant)['allow_platform']){$platform=self::inspect(self::row(0,$code),$code);$info=$platform;$source=$platform['state']==='missing'?'none':'platform';}
        return $info+['code'=>$code,'source'=>$source,'borrowed'=>$tenant>0&&$source==='platform','adapter_ready'=>$code==='task_notify'||ClipCloudProvider::ready($code),'live_verified'=>false];
    }
    public static function listing(int $tenant,bool $reveal=false):array
    {
        self::tenant($tenant);$rows=[];
        foreach(self::catalog() as $code=>$definition){$row=self::row($tenant,$code);$local=self::inspect($row,$code);$present=$row&&!(int)$row['is_deleted'];$settings=$present?(json_decode($row['settings_json'],true)?:[]):[];$configured=[];$keys=[];
            if($present){try{$keys=ClipCredentialVault::open($row['secret_cipher'],$tenant,$code);foreach($definition['fields'] as [$key,$label,$secret])if($secret)$configured[$key]=isset($keys[$key])&&$keys[$key]!=='';}catch(\Throwable){/* Do not leak decryption details or keys. */}}
            $fields=array_map(fn($f)=>['key'=>$f[0],'label'=>$f[1],'secret'=>$f[2],'required'=>$f[3]],$definition['fields']);
            $rows[]=['code'=>$code,'name'=>$definition['name'],'provider'=>$definition['provider'],'fields'=>$fields,'settings'=>$settings,'secret_configured'=>$configured,'secrets'=>$reveal?$keys:[],'credential_mode'=>self::credentialMode($code,$settings,$keys),
                'enabled'=>$present&&(int)$row['enabled']===1,'exists'=>(bool)$present,'recoverable'=>(bool)($row&&(int)$row['is_deleted']),
                'revision'=>(int)($row['revision']??0),'local_state'=>$local['state'],'missing'=>$local['missing'],'effective'=>self::metadata($tenant,$code)]+($code==='task_notify'?['callback_path'=>'/employee/wechat-events/'.$tenant]:[]);
        }
        return ['namespace'=>self::NAMESPACE,'scope'=>$tenant?'oem':'platform','policy'=>self::policy($tenant),'lists'=>$rows,'aliyun'=>self::aliyun($tenant,$reveal),'notice'=>'仅用于本次新增剪辑及员工任务通知能力。原系统已有应用接口和存储配置保持原逻辑。保存配置不代表已开通云服务或通过连接测试。'];
    }
    private static function values(array $p,array $definition,array $oldSecrets):array
    {
        $settings=$p['settings']??[];$input=$p['secrets']??[];$clear=$p['clear_secrets']??[];
        if(!is_array($settings)||!is_array($input)||!is_array($clear)||!array_is_list($clear))throw new Invalid('配置字段格式不正确');
        $publicKeys=[];$secretKeys=[];foreach($definition['fields'] as [$key,$label,$secret]){if($secret)$secretKeys[]=$key;else $publicKeys[]=$key;}
        if(array_diff(array_keys($settings),$publicKeys)||array_diff(array_keys($input),$secretKeys)||array_diff($clear,$secretKeys))throw new Invalid('配置包含不支持的字段');
        $result=[];$secrets=array_intersect_key($oldSecrets,array_flip($secretKeys));
        foreach($definition['fields'] as [$key,$label,$secret]){
            $value=$secret?($input[$key]??''):($settings[$key]??'');if(!is_string($value)||strlen($value)>($key==='speaker_ids'?8000:2048))throw new Invalid($label.'格式或长度不正确');$value=trim($value);
            if($secret){if(in_array($key,$clear,true)){unset($secrets[$key]);continue;}if($value!==''){if(str_contains($value,'*'))throw new Invalid('请填写完整凭证，留空表示保留原值');if($key==='callback_aes'&&!preg_match('/^[a-zA-Z0-9]{43}$/D',$value))throw new Invalid('EncodingAESKey须为43位字母或数字');if($key==='callback_token'&&!preg_match('/^[a-zA-Z0-9]{3,32}$/D',$value))throw new Invalid('微信Token须为3～32位字母或数字');$secrets[$key]=$value;}continue;}
            if($value!==''&&preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$value))throw new Invalid($label.'包含非法字符');
            if($value!==''&&in_array($key,['region','bucket','output_bucket','resource_id','model_id','project'],true)&&!preg_match('/^[A-Za-z0-9_.:-]{1,200}$/D',$value))throw new Invalid($label.'格式不正确');
            if(in_array($key,['bucket','output_bucket'],true)&&$value!==''&&!preg_match('/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/D',$value))throw new Invalid('Bucket 名称格式不正确');
            if($key==='appid'&&$value!==''&&!preg_match('/^wx[a-zA-Z0-9]{16}$/D',$value))throw new Invalid('AppID 格式不正确');
            if($key==='public_base'&&$value!==''){if(!filter_var($value,FILTER_VALIDATE_URL)||parse_url($value,PHP_URL_SCHEME)!=='https'||parse_url($value,PHP_URL_USER)!==null||parse_url($value,PHP_URL_PASS)!==null||!in_array(parse_url($value,PHP_URL_PATH),[null,'','/'],true)||parse_url($value,PHP_URL_QUERY)!==null||parse_url($value,PHP_URL_FRAGMENT)!==null)throw new Invalid('请填写不含路径的HTTPS公网域名');}
            if($key==='data_map'&&$value!==''){$map=json_decode($value,true);if(!is_array($map)||!$map||count($map)>10)throw new Invalid('模板字段映射须为JSON对象');foreach($map as $field=>$semantic)if(!is_string($field)||!preg_match('/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/D',$field)||!in_array($semantic,['title','store','content','time'],true))throw new Invalid('模板字段映射不正确');}
            if($key==='prefix'&&$value!==''&&(str_contains($value,'..')||str_starts_with($value,'/')||!preg_match('#^[A-Za-z0-9/_-]{1,120}$#D',$value)))throw new Invalid('目录前缀须为相对路径，不能包含上级目录');
            if($key==='role_arn'&&$value!==''&&!preg_match('#^acs:ram::[0-9]+:role/[A-Za-z0-9/_-]+$#D',$value))throw new Invalid('服务角色 ARN 格式不正确');
            if($key==='speaker_ids'&&$value!==''&&!preg_match('/^[A-Za-z0-9_.:\-\r\n, ]+$/D',$value))throw new Invalid('音色 ID 格式不正确');
            if($key==='template_ids'&&$value!==''){$ids=array_values(array_filter(preg_split('/[\s,]+/',$value)));if(count($ids)>20)throw new Invalid('最多开放20个云模板');foreach($ids as $id)if(!preg_match('/^[A-Za-z0-9_-]{8,100}$/D',$id))throw new Invalid('云模板 ID 格式不正确');}
            if($key==='clone_mode'&&!in_array($value,['','disabled','postpaid'],true))throw new Invalid('用户上传复刻模式不正确');
            $result[$key]=$value;
        }
        return [$result,$secrets];
    }
    public static function save(int $tenant,int $actor,array $p):array
    {
        $code=$p['capability']??'';$definition=self::capability($code);self::tenant($tenant);$enabled=self::boolean($p['enabled']??false);$expected=self::revision($p['revision']??0);
        return Db::transaction(function()use($tenant,$actor,$p,$code,$definition,$enabled,$expected){
            // Platform and OEM each serialize initial capability insert against their owner record.
            if($tenant)Db::name('tenant')->where('id',$tenant)->lock(true)->find();else Db::name('admin')->where('root',1)->order('id')->lock(true)->find();
            $old=self::row($tenant,$code,true);$revision=(int)($old['revision']??0);if($revision!==$expected)throw new Invalid('配置已在其他窗口更新，请刷新后保存');
            $oldSecrets=$old&&!(int)$old['is_deleted']?ClipCredentialVault::open($old['secret_cipher'],$tenant,$code):[];
            [$settings,$secrets]=self::values($p,$definition,$oldSecrets);
            if(in_array($code,self::ALIYUN,true)){
                $oldSettings=$old?(json_decode($old['settings_json'],true)?:[]):[];
                $mode=$p['credential_mode']??self::credentialMode($code,$oldSettings,$secrets);
                if(!in_array($mode,['own','shared'],true))throw new Invalid('凭证来源不正确');
                $settings['credential_mode']=$mode;
            }
            $effectiveSecrets=self::credentials($tenant,$code,$settings,$secrets);
            $missing=self::missing($definition,$settings,$effectiveSecrets);if($enabled&&$missing)throw new Invalid('启用前请填写：'.implode('、',$missing).(($settings['credential_mode']??'')==='shared'?'（请先保存阿里云公共凭证）':''));
            $data=['enabled'=>$enabled?1:0,'settings_json'=>json_encode($settings,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'secret_cipher'=>ClipCredentialVault::seal($secrets,$tenant,$code),'revision'=>$revision+1,'is_deleted'=>0,'updated_by'=>$actor,'update_time'=>time()];
            if($old)Db::name('oem_clip_integration')->where(['tenant_id'=>$tenant,'capability'=>$code])->update($data);else Db::name('oem_clip_integration')->insert($data+['tenant_id'=>$tenant,'capability'=>$code]);
            self::audit($tenant,$code,'save',$actor,$revision+1);return ['revision'=>$revision+1,'effective'=>self::metadata($tenant,$code)];
        });
    }
    public static function reset(int $tenant,int $actor,array $p):array
    {
        $code=$p['capability']??'';self::capability($code);self::tenant($tenant);$expected=self::revision($p['revision']??0);$restore=self::boolean($p['restore']??false);
        return Db::transaction(function()use($tenant,$actor,$code,$expected,$restore){$old=self::row($tenant,$code,true);if(!$old||(int)$old['revision']!==$expected||(bool)$old['is_deleted']!==$restore)throw new Invalid('配置不存在或已更新，请刷新重试');
            Db::name('oem_clip_integration')->where(['tenant_id'=>$tenant,'capability'=>$code])->update(['is_deleted'=>$restore?0:1,'revision'=>$expected+1,'updated_by'=>$actor,'update_time'=>time()]);
            self::audit($tenant,$code,$restore?'restore':'reset',$actor,$expected+1);return ['revision'=>$expected+1,'effective'=>self::metadata($tenant,$code)];});
    }
    /** Internal server-only credential resolution. No API returns this structure. */
    public static function resolve(int $tenant,string $capability,string $namespace=self::NAMESPACE):array
    {
        if($namespace!==self::NAMESPACE)throw new Invalid('原系统接口不得使用新增剪辑配置借权');self::capability($capability);self::tenant($tenant);if($tenant<=0)throw new Invalid('调用时必须指定实际 OEM');
        return Db::transaction(function()use($tenant,$capability){
            $owner=Db::name('tenant')->where('id',$tenant)->whereNull('delete_time')->lock(true)->find();
            if(!$owner||(int)$owner['disable']!==0||((int)($owner['contract_status']??0)>0&&(int)$owner['contract_expire_time']>0&&(int)$owner['contract_expire_time']<=time()))throw new Invalid('OEM 已停用或服务到期');
            $source=$tenant;$row=self::row($tenant,$capability,true);$info=self::inspect($row,$capability);
            if($info['state']==='missing'){$policy=Db::name('oem_clip_borrow_policy')->where('tenant_id',$tenant)->lock(true)->find();if((int)($policy['allow_platform']??0)!==1)throw new Invalid('OEM 未配置该能力，且未获得平台借权');$source=0;$row=self::row(0,$capability,true);$info=self::inspect($row,$capability);}
            if($info['state']!=='configured')throw new Invalid('该新增能力缺少可用配置，或已停用、撤权');
            return ['namespace'=>self::NAMESPACE,'tenant_id'=>$tenant,'source'=>$source===0?'platform':'oem','source_tenant_id'=>$source,'capability'=>$capability,'revision'=>(int)$row['revision'],
                'settings'=>json_decode($row['settings_json'],true),'credentials'=>self::credentials($source,$capability,json_decode($row['settings_json'],true),ClipCredentialVault::open($row['secret_cipher'],$source,$capability))];
        });
    }
}
