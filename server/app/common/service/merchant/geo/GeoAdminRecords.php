<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;
use think\facade\Db;
use app\common\service\merchant\AgentAccessService;
final class GeoAdminRecords
{
    public static function listing(int $tenant,?array $agent=null,bool $platform=false,array $p=[]):array
    {
        if(!$platform&&$tenant<=0)throw new \InvalidArgumentException('缺少OEM身份');
        $q=Db::name('oem_geo_job')->alias('j')->join('oem_merchant m','m.tenant_id=j.tenant_id AND m.user_id=j.user_id');if(!$platform)$q->where('j.tenant_id',$tenant);
        if($agent){if((int)$agent['tenant_id']!==$tenant)throw new \InvalidArgumentException('不能跨OEM查询');$q->whereIn('m.agent_id',AgentAccessService::scope($agent));}
        if(!empty($p['merchant_id']))$q->where('m.id',(int)$p['merchant_id']);if($platform&&!empty($p['tenant_id_filter']))$q->where('j.tenant_id',(int)$p['tenant_id_filter']);
        $count=(clone $q)->count();$rows=$q->field('j.*,m.name AS merchant_name,m.id AS merchant_id')->order('j.id desc')->page(max(1,(int)($p['page']??1)),20)->select()->toArray();$rows=array_map(function($r)use($platform,$agent){$v=GeoJobs::publicRow($r,$platform)+['merchant_name'=>$r['merchant_name'],'merchant_id'=>$r['merchant_id']];if(!$agent&&$r['operation']==='visibility'){$c=Db::name('oem_geo_monitor_cell')->where('job_id',$r['id'])->find();$v['provider_task_id']=$c['provider_task_id']??'';$v['provider_consumer_key']=hash('sha256','geo:'.$r['tenant_id'].':'.$r['id'].':'.$r['input_hash']);}return $v;},$rows);return ['lists'=>$rows,'count'=>$count];
    }
}
