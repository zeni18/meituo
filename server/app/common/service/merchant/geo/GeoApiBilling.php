<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;
use think\facade\Db;
use app\common\model\ai\{AiAppTask,AiConsumptionLog};
use app\common\service\point\PointService;
use app\common\service\power\TenantPowerMarketService;
use InvalidArgumentException as Invalid;

/** Per-call GEO APIs use native market prices, wallets and consumption records. */
final class GeoApiBilling
{
    public static function quote(int $tenant,string $capability,array $settings):array
    {
        $product=TenantPowerMarketService::detail($tenant,(int)($settings['product_id']??0));$sku=null;
        foreach($product['skus']??[] as $s)if((int)$s['id']===(int)($settings['sku_id']??0))$sku=$s;
        if(($product['upstream_app_code']??'')!=='aigc_geo'||($product['upstream_api_code']??'')!==$capability||!$sku||empty($sku['sale_status'])||!in_array($sku['usage_unit'],['per_call','call','次'],true)||(float)($sku['usage_unit_size']??1)!==1.0)throw new Invalid('请在原算力市场配置该GEO能力的可售按次SKU');
        return ['product_id'=>(int)$product['id'],'sku_id'=>(int)$sku['id'],'tenant'=>round((float)$sku['platform_sale_points'],2),'user'=>round((float)$sku['sale_points'],2),'usage_unit'=>'per_call'];
    }
    public static function reserve(array $job,array $quote):array
    {
        return Db::transaction(function()use($job,$quote){
            $no='GEO'.$job['id'];$t=(int)$job['tenant_id'];$u=(int)$job['user_id'];$visibility=$job['operation']==='visibility';$cap=$visibility?'visibility_cn':'web_search';$payload=json_decode($job['payload_json'],true);$provider=$visibility?($payload['provider']??'moli'):'bocha';$label=$visibility?'GEO自动可见度诊断':'GEO网页检索';
            $existing=AiConsumptionLog::where('consume_no',$no)->find();if($existing)return ['consumption_id'=>(int)$existing['id'],'app_task_id'=>(int)$existing['app_task_id']];
            PointService::assertCanConsumeAmounts($t,$u,$quote['tenant'],$quote['user']);$now=time();
            $task=AiAppTask::create(['task_no'=>'AT'.$no,'tenant_id'=>$t,'user_id'=>$u,'app_code'=>'aigc_geo','action_code'=>$cap,'business_table'=>'oem_geo_job','business_id'=>$job['id'],'parent_task_id'=>0,'status'=>'running','progress'=>10,'request_summary'=>['operation'=>$job['operation']],'result_summary'=>[],'estimated_tenant_cost'=>$quote['tenant'],'estimated_user_price'=>$quote['user'],'actual_tenant_cost'=>0,'actual_user_price'=>0,'idempotency_key'=>$no,'create_time'=>$now,'update_time'=>$now,'finish_time'=>0]);
            $c=AiConsumptionLog::create(['consume_no'=>$no,'app_task_id'=>$task['id'],'tenant_id'=>$t,'user_id'=>$u,'app_code'=>'aigc_geo','action_code'=>$cap,'resource_type'=>'app_api','product_id'=>$quote['product_id'],'sku_id'=>$quote['sku_id'],'provider'=>$provider,'api_code'=>$cap,'protocol'=>'https_json','quantity'=>1,'usage_unit'=>'per_call','usage_snapshot'=>[],'price_snapshot'=>$quote,'request_summary'=>['job_id'=>$job['id']],'response_summary'=>[],'run_status'=>'submitting','billing_status'=>'reserved','reserved_tenant_cost'=>$quote['tenant'],'reserved_user_price'=>$quote['user'],'actual_tenant_cost'=>0,'actual_user_price'=>0,'tenant_point_sn'=>$no.'-reserve','user_point_sn'=>$no.'-reserve','create_time'=>$now,'update_time'=>$now,'finish_time'=>0]);
            PointService::reserveBusinessAmountsInCurrentTransaction($t,$u,$quote['tenant'],$quote['user'],$no.'-reserve',$label.'预扣',['app_code'=>'aigc_geo','consumption_id'=>$c['id']]);
            Db::name('oem_geo_job')->where('id',$job['id'])->update(['consumption_id'=>$c['id'],'app_task_id'=>$task['id']]);return ['consumption_id'=>(int)$c['id'],'app_task_id'=>(int)$task['id']];
        });
    }
    public static function finish(int $consumption,bool $success):void
    {
        Db::transaction(function()use($consumption,$success){$c=AiConsumptionLog::where('id',$consumption)->lock(true)->findOrEmpty();if($c->isEmpty()||$c['billing_status']!=='reserved')return;$q=$c['price_snapshot'];if(is_string($q))$q=json_decode($q,true);
            PointService::settleReservedBusinessAmountsInCurrentTransaction((int)$c['tenant_id'],(int)$c['user_id'],(float)$q['tenant'],(float)$q['user'],$success?(float)$q['tenant']:0,$success?(float)$q['user']:0,(string)$c['consume_no'],$c['api_code']==='visibility_cn'?'GEO自动可见度诊断':'GEO网页检索',['app_code'=>'aigc_geo','consumption_id'=>$c['id']]);
            $c->save(['billing_status'=>$success?'settled':'refunded','run_status'=>$success?'success':'failed','actual_tenant_cost'=>$success?$q['tenant']:0,'actual_user_price'=>$success?$q['user']:0,'usage_snapshot'=>['calls'=>$success?1:0],'finish_time'=>time(),'update_time'=>time()]);
            AiAppTask::where('id',$c['app_task_id'])->update(['status'=>$success?'success':'failed','progress'=>100,'actual_tenant_cost'=>$success?$q['tenant']:0,'actual_user_price'=>$success?$q['user']:0,'finish_time'=>time(),'update_time'=>time()]);
        });
    }
}
