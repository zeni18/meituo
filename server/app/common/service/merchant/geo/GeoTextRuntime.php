<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;
use think\facade\Db;
use app\common\service\power\MarketTextModelRuntimeService as Text;
use InvalidArgumentException as Invalid;

final class GeoTextRuntime
{
    public const SCOPE='geo_deepseek_direct';
    public static function provider(array $settings):string{$v=$settings['provider']??'market';if(!in_array($v,['market','deepseek'],true))throw new Invalid('文本服务类型无效');return $v;}
    public static function install():array
    {
        return Db::transaction(function(){
            Db::name('admin')->where('root',1)->lock(true)->find();$where=['source_code'=>'merchant_geo_direct','upstream_resource_key'=>'deepseek_flash_direct_v1'];$p=Db::name('power_market_product')->where($where)->find();
            $meta=['market_metadata'=>['execution_scope'=>self::SCOPE,'protocol'=>'openai_chat','protocols'=>['openai_chat'],'max_output_tokens'=>8192,'default_params'=>['enable_thinking'=>false]]];
            $id=$p?(int)$p['id']:(int)Db::name('power_market_product')->insertGetId($where+['product_code'=>'merchant_geo_deepseek_flash','resource_type'=>'model','model_type'=>'text','name'=>'DeepSeek Flash（GEO官方直连）','description'=>'GEO拓词、文章生成、改写专用。官方Key由接入能力配置维护；输入/输出Token按原市场售价计费。','upstream_model_code'=>DeepSeekText::MODEL,'upstream_channel_code'=>self::SCOPE,'source_payload'=>json_encode($meta,JSON_THROW_ON_ERROR),'status'=>1,'create_time'=>time(),'update_time'=>time()]);
            foreach(['input'=>'输入','output'=>'输出']as $kind=>$title)if(!Db::name('power_market_sku')->where(['product_id'=>$id,'sku_key'=>'geo_deepseek_'.$kind])->find())Db::name('power_market_sku')->insert(['product_id'=>$id,'sku_key'=>'geo_deepseek_'.$kind,'title'=>$title.' / 百万Token','usage_unit'=>'token','usage_unit_size'=>1000000,'billing_mode'=>'usage','locked_params'=>'{}','selectable_params'=>'{}','source_payload'=>'{}','upstream_price'=>0,'sale_points'=>0,'sale_status'=>0,'status'=>1,'create_time'=>time(),'update_time'=>time()]);
            return self::identity();
        });
    }
    public static function identity():array
    {
        $p=Db::name('power_market_product')->where(['source_code'=>'merchant_geo_direct','upstream_resource_key'=>'deepseek_flash_direct_v1'])->find();$ids=[];foreach(['input','output']as $kind)$ids[$kind.'_sku_id']=$p?(int)Db::name('power_market_sku')->where(['product_id'=>$p['id'],'sku_key'=>'geo_deepseek_'.$kind])->value('id'):0;
        return ['model_id'=>(int)($p['id']??0),'model'=>DeepSeekText::MODEL]+$ids;
    }
    public static function models(int $t,array $connection):array
    {
        if(self::provider($connection['settings'])!=='deepseek')return Text::textOptions($t);
        $identity=self::identity();return array_values(array_filter(Text::textOptions($t,self::SCOPE),fn($m)=>(int)$m['id']===(int)$connection['settings']['model_id']&&$m['model_code']===DeepSeekText::MODEL&&(int)$m['input']['sku_id']===$identity['input_sku_id']&&(int)$m['output']['sku_id']===$identity['output_sku_id']));
    }
    public static function model(int $t,array $connection,string $selection=''):array
    {
        if(self::provider($connection['settings'])!=='deepseek')return Text::resolveModel($t,$selection?:$connection['settings']['model_id']);
        $id=(string)$connection['settings']['model_id'];if($selection!==''&&$selection!==$id)throw new Invalid('本能力当前统一使用 DeepSeek Flash');
        $models=self::models($t,$connection);if(!$models)throw new Invalid('请先在原算力市场配置并上架 DeepSeek Flash 输入和输出售价');
        return $models[0];
    }
    public static function generate(int $t,int $u,array $params,array $connection,callable $event,?DeepSeekText $client=null):array
    {
        if(self::provider($connection['settings'])!=='deepseek')return Text::generate($t,$u,$params,$event);
        self::model($t,$connection,(string)$params['model_selection']);$client??=new DeepSeekText();$key=$connection['credentials']['api_key'];
        $params['_disable_model_fallback']=true;$params['_disable_compatibility_retry']=true;$params['_disable_transient_retry']=true;
        if($params['action_code']!=='geo_knowledge_enhance')$params['response_format']=['type'=>'json_object'];
        return Text::generate($t,$u,$params,$event,false,static function($model,$messages,$system,$tokens,$options,$timeout)use($client,$key){if($model['model_code']!==DeepSeekText::MODEL)throw new Invalid('GEO直连模型不匹配');return $client->generate($key,$messages,$system,$tokens,$options,$timeout);},self::SCOPE);
    }
}
