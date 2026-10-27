<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;
use think\facade\Db;
/** Register an unsellable local API SKU; pricing remains in the existing market UI. */
final class GeoMarketCatalog
{
    public static function install():array
    {
        self::installVisibility();
        return Db::transaction(function(){Db::name('admin')->where('root',1)->lock(true)->find();$where=['source_code'=>'merchant_geo_local','upstream_resource_key'=>'geo_web_search_v1'];$p=Db::name('power_market_product')->where($where)->find();$id=$p?(int)$p['id']:(int)Db::name('power_market_product')->insertGetId($where+['product_code'=>'merchant_geo_web_search','resource_type'=>'app_api','name'=>'GEO网页检索（博查）','description'=>'本地GEO独立能力，供应商凭证在GEO能力配置维护。SKU默认下架，设置现有市场价格后人工上架。','upstream_app_code'=>'aigc_geo','upstream_api_code'=>'web_search','source_payload'=>'{}','status'=>1,'create_time'=>time(),'update_time'=>time()]);
            $s=Db::name('power_market_sku')->where(['product_id'=>$id,'sku_key'=>'geo_web_search_per_call'])->find();$sid=$s?(int)$s['id']:(int)Db::name('power_market_sku')->insertGetId(['product_id'=>$id,'sku_key'=>'geo_web_search_per_call','title'=>'网页检索 / 次','usage_unit'=>'per_call','usage_unit_size'=>1,'billing_mode'=>'fixed','locked_params'=>'{}','selectable_params'=>'{}','source_payload'=>'{}','upstream_price'=>0,'sale_points'=>0,'sale_status'=>0,'status'=>1,'create_time'=>time(),'update_time'=>time()]);return ['product_id'=>$id,'sku_id'=>$sid];
        });
    }
    private static function installVisibility():void
    {
        Db::transaction(function(){Db::name('admin')->where('root',1)->lock(true)->find();$w=['source_code'=>'merchant_geo_local','upstream_resource_key'=>'geo_visibility_cn_v1'];$p=Db::name('power_market_product')->where($w)->find();$id=$p?(int)$p['id']:(int)Db::name('power_market_product')->insertGetId($w+['product_code'=>'merchant_geo_visibility_cn','resource_type'=>'app_api','name'=>'GEO自动可见度诊断（模力指数）','description'=>'每个问题×平台为一次；search模式含截图。现有市场统一计费，默认下架，管理员配置价格后上架。失败且无有效回答退回商家预扣；供应商成本另行对账。','upstream_app_code'=>'aigc_geo','upstream_api_code'=>'visibility_cn','source_payload'=>'{}','status'=>1,'create_time'=>time(),'update_time'=>time()]);
        if(!Db::name('power_market_sku')->where(['product_id'=>$id,'sku_key'=>'geo_visibility_cn_per_call'])->find())Db::name('power_market_sku')->insert(['product_id'=>$id,'sku_key'=>'geo_visibility_cn_per_call','title'=>'联网诊断含截图 / 问题×平台','usage_unit'=>'per_call','usage_unit_size'=>1,'billing_mode'=>'fixed','locked_params'=>'{}','selectable_params'=>'{}','source_payload'=>'{}','upstream_price'=>0,'sale_points'=>0,'sale_status'=>0,'status'=>1,'create_time'=>time(),'update_time'=>time()]);});
    }
    public static function identity(string $capability='web_search'):array{$key=$capability==='visibility_cn'?'visibility_cn':'web_search';$p=Db::name('power_market_product')->where(['source_code'=>'merchant_geo_local','upstream_resource_key'=>'geo_'.$key.'_v1'])->find();$s=$p?Db::name('power_market_sku')->where(['product_id'=>$p['id'],'sku_key'=>'geo_'.$key.'_per_call'])->find():null;return ['product_id'=>(int)($p['id']??0),'sku_id'=>(int)($s['id']??0)];}
}
