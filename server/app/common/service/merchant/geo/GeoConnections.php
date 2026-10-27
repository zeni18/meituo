<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;
use think\facade\Db;
use InvalidArgumentException as Invalid;
use app\common\service\merchant\clip\ClipCredentialVault as Vault;
use app\common\service\merchant\clip\ClipIntegrationService as Values;

/** GEO-only explicit delegation. Never returns credentials in a public view. */
final class GeoConnections
{
    public static function catalog():array
    {
        return [
            'text'=>['name'=>'AI拓词 / 文章生成 / 改写','provider'=>'DeepSeek Flash / 原算力模型市场','ready'=>true,'fields'=>['provider'=>'文本接入方式','model_id'=>'文本模型产品 ID'],'field_options'=>['provider'=>['deepseek'=>'DeepSeek Flash 官方直连','market'=>'原算力市场统一上游']],'secrets'=>['api_key'=>'DeepSeek 官方 API Key'],'guide'=>'三项功能统一使用 DeepSeek Flash，官方地址 api.deepseek.com，默认非思考模式。填写 Key 后保存；在原算力市场维护并上架对应产品的输入、输出 Token 售价。旧市场上游模式沿用原配置，无需填写此 Key。'],
            'web_search'=>['name'=>'网页检索 / 素材溯源','provider'=>'博查 Web Search','ready'=>true,'fields'=>['product_id'=>'GEO 按次市场产品 ID','sku_id'=>'web_search 按次 SKU ID'],'secrets'=>['api_key'=>'博查 API Key'],'guide'=>'open.bochaai.com 开通 Web Search，API Key 加密保存；平台市场产品 app_code=aigc_geo，api_code=web_search，按次 SKU。'],
            'visibility_cn'=>['name'=>'AI 可见度监测','provider'=>'GEO服务商 API / 模力指数','ready'=>true,'fields'=>['provider'=>'接入协议','product_id'=>'现有市场 visibility_cn 产品 ID','sku_id'=>'按问题×平台 / 次 SKU ID','api_origin'=>'HTTPS 服务地址（GEO服务商可填写 /api/v1）'],'field_types'=>['api_origin'=>'url'],'field_options'=>['provider'=>['geo_partner'=>'GEO服务商 API v1.3（本次接入）','moli'=>'模力指数直连（原协议）']],'secrets'=>['api_key'=>'服务商 API Key / Bearer Token'],'guide'=>'GEO服务商地址 https://118.89.28.187，文档 /api-docs；需 read、monitor 权限，直接提问无需 provision。配置后在原算力市场设置按次售价。供方受理即扣款，失败不自动退款，查询也可能收费；本平台每60秒查询，最多30次，异常转待核对。密钥仅服务端使用；OEM可借权，代理仅使用。'],
            'keyword_index'=>['name'=>'关键词指数','provider'=>'数据源合同待确认','ready'=>false,'fields'=>[],'secrets'=>[],'guide'=>'须明确指数平台、端、时间粒度、商用转售及 API 权限。AI 拓词不会生成虚构搜索量。'],
            'owned_publish'=>['name'=>'自有账号 / B2B / 官网发布','provider'=>'各平台及站点授权','ready'=>false,'fields'=>[],'secrets'=>[],'guide'=>'与海讯社媒体采购分开，逐账号/站点取得发布 API 权限后接入。'],
        ];
    }
    private static function definition(string $code):array{return self::catalog()[$code]??throw new Invalid('GEO能力不存在');}
    private static function requiredSecrets(string $code,array $settings):array{return $code==='text'&&GeoTextRuntime::provider($settings)==='market'?[]:self::definition($code)['secrets'];}
    private static function owner(int $tenant,int $agent):void
    {
        if($tenant<0||$agent<0||(!$tenant&&$agent))throw new Invalid('配置身份无效');
        if($tenant){$owner=Db::name('tenant')->where('id',$tenant)->whereNull('delete_time')->where('disable',0)->find();if(!$owner||((int)($owner['contract_status']??0)>0&&(int)$owner['contract_expire_time']>0&&(int)$owner['contract_expire_time']<=time()))throw new Invalid('OEM不可用或服务到期');}
        if($agent&&!Db::name('oem_agent')->where(['id'=>$agent,'tenant_id'=>$tenant,'status'=>1])->find())throw new Invalid('代理不可用');
    }
    private static function row(int $tenant,int $agent,string $code):?array{return Db::name('oem_geo_connection')->where(['tenant_id'=>$tenant,'agent_id'=>$agent,'capability'=>$code])->find();}
    private static function grantRow(int $tenant,int $agent,string $code):array{return Db::name('oem_geo_grant')->where(['tenant_id'=>$tenant,'agent_id'=>$agent,'capability'=>$code])->find()?:['allow_use'=>0,'allow_configure'=>0,'revision'=>0];}
    private static function decode(?string $json):array{return json_decode($json?:'{}',true,32,JSON_THROW_ON_ERROR);}
    private static function expected(array $p):int{if(!isset($p['revision'])||(!is_int($p['revision'])&&!(is_string($p['revision'])&&ctype_digit($p['revision'])))||(int)$p['revision']<0)throw new Invalid('缺少有效配置版本');return (int)$p['revision'];}
    private static function audit(int $tenant,int $agent,string $code,string $action,int $actor,int $revision):void{Db::name('oem_geo_audit')->insert(['tenant_id'=>$tenant,'agent_id'=>$agent,'capability'=>$code,'action'=>$action,'actor_id'=>$actor,'revision'=>$revision,'create_time'=>time()]);}
    /** Platform grants OEM borrowing; OEM grants use/configuration to an actual agent. */
    public static function grant(int $callerTenant,int $actor,array $p):array
    {
        $tenant=(int)($p['target_tenant_id']??$callerTenant);$agent=(int)($p['agent_id']??0);$code=(string)($p['capability']??'');self::definition($code);self::owner($tenant,$agent);
        if($tenant<=0||($callerTenant>0&&($tenant!==$callerTenant||$agent<=0))||($callerTenant===0&&$agent!==0))throw new Invalid('借权目标不在当前权限范围');
        $use=Values::boolean($p['allow_use']??false);$configure=$agent>0&&Values::boolean($p['allow_configure']??false);if($code==='visibility_cn'&&$configure)throw new Invalid('自动监测配置仅由平台和OEM维护');if($configure&&!$use)throw new Invalid('配置权限必须同时具备使用权限');$expected=self::expected($p);
        return Db::transaction(function()use($tenant,$agent,$code,$actor,$use,$configure,$expected){
            Db::name('tenant')->where('id',$tenant)->lock(true)->find();$old=self::grantRow($tenant,$agent,$code);if((int)$old['revision']!==$expected)throw new Invalid('授权已更新，请刷新重试');
            $data=['allow_use'=>(int)$use,'allow_configure'=>(int)$configure,'revision'=>$expected+1,'updated_by'=>$actor,'update_time'=>time()];
            $where=['tenant_id'=>$tenant,'agent_id'=>$agent,'capability'=>$code];if(isset($old['id']))Db::name('oem_geo_grant')->where($where)->update($data);else Db::name('oem_geo_grant')->insert($data+$where);
            self::audit($tenant,$agent,$code,'grant',$actor,$expected+1);return ['revision'=>$expected+1];
        });
    }
    public static function save(int $tenant,int $agent,int $actor,array $p):array
    {
        self::owner($tenant,$agent);$code=(string)($p['capability']??'');$def=self::definition($code);$mode=(string)($p['mode']??'off');$expected=self::expected($p);
        if($code==='visibility_cn'&&$agent)throw new Invalid('自动监测配置仅由平台和OEM维护');
        if(!in_array($mode,$tenant?['off','own','inherit']:['off','own'],true))throw new Invalid('配置模式无效');
        if(!$def['ready']&&$mode!=='off')throw new Invalid('该能力尚待供应商正式接口契约，不能启用');
        $settings=$p['settings']??[];$secrets=$p['secrets']??[];if(!is_array($settings)||!is_array($secrets)||array_diff(array_keys($settings),array_keys($def['fields']))||array_diff(array_keys($secrets),array_keys($def['secrets'])))throw new Invalid('存在不支持的配置字段');
        $clean=[];foreach($def['fields']as $k=>$label){$v=$settings[$k]??'';if($k==='provider'){$clean[$k]=$code==='text'?GeoTextRuntime::provider($settings):GeoVisibilityProviders::code($settings);}elseif($k==='api_origin'){if(!is_string($v))throw new Invalid('接口域名格式无效');$clean[$k]=$v===''?'':GeoVisibilityProviders::origin($settings,$v);}else{if(!is_scalar($v)||!preg_match('/^\d{0,12}$/D',(string)$v))throw new Invalid($label.'格式无效');$clean[$k]=(string)$v;}}
        if($code==='text'&&$clean['provider']==='deepseek'&&$mode==='own'&&((int)$clean['model_id']<=0||(int)$clean['model_id']!==GeoTextRuntime::identity()['model_id']))throw new Invalid('DeepSeek直连请选择已登记的专用文本模型产品');
        return Db::transaction(function()use($tenant,$agent,$actor,$p,$code,$def,$mode,$expected,$clean,$secrets){
            if($tenant)Db::name('tenant')->where('id',$tenant)->lock(true)->find();else Db::name('admin')->where('root',1)->lock(true)->find();
            if($agent){$g=self::grantRow($tenant,$agent,$code);if(!(int)$g['allow_use']||!(int)$g['allow_configure'])throw new Invalid('OEM未授予当前代理该能力的配置权限');}
            $old=self::row($tenant,$agent,$code);if((int)($old['revision']??0)!==$expected)throw new Invalid('配置已更新，请刷新重试');
            $keys=$old?Vault::open((string)$old['secret_cipher'],$tenant,'geo:'.$agent.':'.$code):[];
            if($code==='visibility_cn'&&$old&&$mode==='own'&&!empty($keys['api_key'])&&empty($secrets['api_key'])){
                $previous=self::decode($old['settings_json']);
                if(GeoVisibilityProviders::code($previous)!==GeoVisibilityProviders::code($clean)||($previous['api_origin']??'')!==$clean['api_origin'])throw new Invalid('切换监测服务或地址时，请重新填写该服务的 API Key');
            }
            foreach($secrets as $k=>$v){if(!is_string($v)||strlen($v)>2048||preg_match('/[\x00-\x20\x7f]/',$v))throw new Invalid('凭证格式不正确');if($v!=='')$keys[$k]=$v;}
            if($mode==='own'){foreach($clean as $k=>$v)if($k!=='provider'&&($k==='api_origin'?$v==='':(int)$v<=0))throw new Invalid('启用前请补全接口域名、产品、SKU或模型 ID');foreach(self::requiredSecrets($code,$clean)as $k=>$label)if(empty($keys[$k]))throw new Invalid('请填写'.$label);}
            $data=['mode'=>$mode,'settings_json'=>json_encode($clean,JSON_THROW_ON_ERROR),'secret_cipher'=>Vault::seal($keys,$tenant,'geo:'.$agent.':'.$code),'revision'=>$expected+1,'updated_by'=>$actor,'update_time'=>time()];$where=['tenant_id'=>$tenant,'agent_id'=>$agent,'capability'=>$code];
            if($old)Db::name('oem_geo_connection')->where($where)->update($data);else Db::name('oem_geo_connection')->insert($data+$where);self::audit($tenant,$agent,$code,'save',$actor,$expected+1);return ['revision'=>$expected+1];
        });
    }
    /** Server-only resolution. Agent inheritance never confers access to OEM/platform secrets. */
    public static function resolve(int $tenant,int $agent,string $code):array
    {
        self::owner($tenant,$agent);if($tenant<=0)throw new Invalid('必须指定实际OEM');$def=self::definition($code);if(!$def['ready'])throw new Invalid('该能力尚未接入');
        $path=[];$sourceTenant=$tenant;$sourceAgent=$agent;
        if($agent){$g=self::grantRow($tenant,$agent,$code);$path[]='agent_grant:'.$g['revision'];if(!(int)$g['allow_use'])throw new Invalid('OEM尚未授权当前代理使用该能力');$r=self::row($tenant,$agent,$code);$path[]='agent_config:'.($r['revision']??0);if($r&&$r['mode']==='off')throw new Invalid('代理已停用该能力');if(!$r||$r['mode']==='inherit')$sourceAgent=0;}
        $r=self::row($sourceTenant,$sourceAgent,$code);if(!$r)throw new Invalid('尚未配置该GEO能力');$path[]='oem_config:'.$r['revision'];
        if($r['mode']==='inherit'){$g=self::grantRow($tenant,0,$code);$path[]='platform_grant:'.$g['revision'];if(!(int)$g['allow_use'])throw new Invalid('OEM尚未获得平台该能力借权');$sourceTenant=0;$sourceAgent=0;$r=self::row(0,0,$code);$path[]='platform_config:'.($r['revision']??0);}
        if(!$r||$r['mode']!=='own')throw new Invalid('该能力未配置或已停用');$settings=self::decode($r['settings_json']);$keys=Vault::open($r['secret_cipher'],$sourceTenant,'geo:'.$sourceAgent.':'.$code);
        if($code==='visibility_cn')$settings['provider']=GeoVisibilityProviders::code($settings);
        if($code==='text')$settings['provider']=GeoTextRuntime::provider($settings);
        foreach($def['fields']as $k=>$label)if(empty($settings[$k]))throw new Invalid('配置不完整：'.$label);foreach(self::requiredSecrets($code,$settings)as $k=>$label)if(empty($keys[$k]))throw new Invalid('配置不完整：'.$label);
        return ['source_tenant_id'=>$sourceTenant,'source_agent_id'=>$sourceAgent,'stamp'=>hash('sha256',implode('|',$path)),'settings'=>$settings,'credentials'=>$keys];
    }
    /** Local completeness only: never calls a provider or asserts pricing/cloud availability. */
    private static function configurationState(string $code,?array $row,array $settings,array $keys,bool $readable):string
    {
        $def=self::definition($code);
        if(!$def['ready'])return 'unavailable';
        if(!$row)return 'missing';
        if($row['mode']==='off')return 'disabled';
        if($row['mode']==='inherit')return 'inherited';
        if(!$readable)return 'unreadable';
        if($row['mode']!=='own')return 'incomplete';
        try{
            if($code==='text')$settings['provider']=GeoTextRuntime::provider($settings);
            if($code==='visibility_cn')$settings['provider']=GeoVisibilityProviders::code($settings);
            foreach($def['fields'] as $key=>$label)if(empty($settings[$key]))return 'incomplete';
            foreach(self::requiredSecrets($code,$settings) as $key=>$label)if(empty($keys[$key]))return 'incomplete';
        }catch(Invalid){return 'incomplete';}
        return 'configured';
    }
    public static function listing(int $tenant,int $agent=0,bool $reveal=false):array
    {
        $labels=['missing'=>'未配置','disabled'=>'已停用','unavailable'=>'接口待确认，尚未接入','inherited'=>'等待上级配置','unreadable'=>'配置无法读取，请联系配置管理员','incomplete'=>'配置不完整','configured'=>'配置齐全，待联调'];
        self::owner($tenant,$agent);$rows=[];foreach(self::catalog()as $code=>$def){$r=self::row($tenant,$agent,$code);$g=self::grantRow($tenant,$agent,$code);$configured=[];$keys=[];$settings=[];$readable=true;
            if($r){
                try{$settings=self::decode($r['settings_json']);}catch(\Throwable){$readable=false;}
                try{$keys=Vault::open($r['secret_cipher'],$tenant,'geo:'.$agent.':'.$code);foreach($def['secrets']as $k=>$v)$configured[$k]=!empty($keys[$k]);}catch(\Throwable){$readable=false;}
            }
            $localState=self::configurationState($code,$r,$settings,$keys,$readable);
            $state=$labels[$localState];if($tenant){try{$resolved=self::resolve($tenant,$agent,$code);$state=$resolved['source_tenant_id']===0?'借用平台配置':($resolved['source_agent_id']?'代理自配':'OEM自配');}catch(Invalid $e){$state=$e->getMessage();}catch(\RuntimeException|\JsonException|\TypeError){$state=$labels['unreadable'];}}
            $rows[]=$def+['code'=>$code,'mode'=>$r['mode']??($agent?'inherit':'off'),'revision'=>(int)($r['revision']??0),'settings'=>$agent&&$code==='visibility_cn'?[]:$settings,'secret_configured'=>$configured,'secret_values'=>$reveal&&!$agent?$keys:[],'grant'=>array_intersect_key($g,array_flip(['allow_use','allow_configure','revision'])),'state'=>$state,'local_state'=>$localState,'can_configure'=>!$agent||($code!=='visibility_cn'&&(int)$g['allow_use']&&(int)$g['allow_configure'])];
        }
        $grants=$agent?[]:Db::name('oem_geo_grant')->where($tenant?['tenant_id'=>$tenant]:['agent_id'=>0])->field('tenant_id,agent_id,capability,allow_use,allow_configure,revision')->select()->toArray();
        return ['lists'=>$rows,'grants'=>$grants,'tenant_id'=>$tenant,'agent_id'=>$agent,'search_market'=>GeoMarketCatalog::identity(),'visibility_market'=>GeoMarketCatalog::identity('visibility_cn'),'text_market'=>GeoTextRuntime::identity()];
    }
    public static function providerWorkspace(array $p):array
    {
        $row=self::row(0,0,'visibility_cn');if(!$row||$row['mode']!=='own')throw new Invalid('请先保存并启用平台监测配置');
        $connection=['settings'=>self::decode($row['settings_json']),'credentials'=>Vault::open($row['secret_cipher'],0,'geo:0:visibility_cn')];
        if(GeoVisibilityProviders::code($connection['settings'])!=='geo_partner')throw new Invalid('此功能适用于 GEO 服务商协议');
        try{return (new PartnerWorkspace())->execute($connection,$p);}catch(GeoProviderFailure $e){throw new Invalid($e->getMessage());}
    }
    public static function inspectText(int $tenant,array $p,?DeepSeekText $client=null):array
    {
        self::owner($tenant,0);$row=self::row($tenant,0,'text');if(!$row||(int)$row['revision']!==self::expected($p)||$row['mode']==='off')throw new Invalid('请先保存并启用文本配置，再检查连接');
        $connection=$tenant?self::resolve($tenant,0,'text'):['settings'=>self::decode($row['settings_json']),'credentials'=>Vault::open($row['secret_cipher'],0,'geo:0:text')];
        if(GeoTextRuntime::provider($connection['settings'])!=='deepseek')throw new Invalid('此检查适用于 DeepSeek 官方直连');
        try{return ($client??new DeepSeekText())->inspect((string)($connection['credentials']['api_key']??''));}catch(\Throwable $e){throw new Invalid($e instanceof Invalid?$e->getMessage():'DeepSeek 余额查询未确认，请检查官方账户和网络');}
    }
    /** Explicit admin action; queries can incur the provider's configured request fee. */
    public static function inspectVisibility(int $tenant,array $p,?PartnerVisibility $provider=null):array
    {
        self::owner($tenant,0);$row=self::row($tenant,0,'visibility_cn');
        if(!$row||(int)$row['revision']!==self::expected($p))throw new Invalid('请先保存配置，再检查连接');
        if($row['mode']==='off')throw new Invalid('请先保存并启用监测配置');
        $connection=$tenant?self::resolve($tenant,0,'visibility_cn'):['settings'=>self::decode($row['settings_json']),'credentials'=>Vault::open($row['secret_cipher'],0,'geo:0:visibility_cn')];
        if(GeoVisibilityProviders::code($connection['settings'])!=='geo_partner')throw new Invalid('此连接检查适用于GEO服务商 API v1.3');
        $provider??=new PartnerVisibility();
        try{$usage=$provider->request($connection,'GET','/api/v1/usage');$platforms=$provider->request($connection,'GET','/api/v1/platforms');}catch(GeoProviderFailure $e){throw new Invalid($e->getMessage());}
        if(!is_int($usage['balanceCents']??null)||!array_is_list($platforms))throw new Invalid('服务商返回的余额或平台目录格式不正确');
        $rows=[];foreach($platforms as $platform)if(is_array($platform))$rows[]=['id'=>(string)($platform['id']??''),'name'=>(string)($platform['label']??$platform['name']??''),'client'=>(string)($platform['client']??''),'upstream_configured'=>($platform['upstreamConfigured']??false)===true,'pricing_configured'=>($platform['pricing']['configured']??false)===true];
        return ['balance_cents'=>$usage['balanceCents'],'expires_at'=>$usage['expiresAt']??null,'platforms'=>$rows,'notice'=>'连接检查完成，仅查询余额和平台目录；未发起采样。目录和配置状态不能代替真实诊断验收。'];
    }
}
