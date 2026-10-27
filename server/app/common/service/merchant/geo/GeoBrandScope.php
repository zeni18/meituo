<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;

use think\facade\Db;
use app\common\service\merchant\MerchantBrandService;
use InvalidArgumentException as Invalid;

/** Request-local brand context. Scope zero preserves historical merchant GEO records. */
final class GeoBrandScope
{
    public const ROOTS=['oem_geo_resource','oem_geo_material','aigc_geo_keyword','aigc_geo_article','aigc_geo_diagnosis','oem_geo_job','oem_geo_project','press_draft','press_order'];
    public static function id(int $t,int $u):int{$r=app()->request->geoBrandScope;return is_array($r)&&($r['tenant']??0)===$t&&($r['user']??0)===$u?(int)$r['scope']:0;}
    public static function bound(int $t,int $u):bool{$r=app()->request->geoBrandScope;return is_array($r)&&($r['tenant']??0)===$t&&($r['user']??0)===$u;}
    public static function bind(int $t,int $u,mixed $brand):void
    {
        if($brand!==null&&$brand!==''&&(!is_scalar($brand)||!ctype_digit((string)$brand)||(int)$brand<=0))throw new Invalid('品牌标识无效');
        $row=$brand?MerchantBrandService::owned($t,$u,(int)$brand):Db::name('oem_merchant_brand')->where(['tenant_id'=>$t,'user_id'=>$u,'legacy'=>1])->find();
        if(!$brand&&$row&&(int)$row['delete_time']>0){$row=Db::name('oem_merchant_brand')->where(['tenant_id'=>$t,'user_id'=>$u,'delete_time'=>0])->order('id')->find();if(!$row)throw new Invalid('暂无可用品牌，请先创建或恢复品牌');}
        app()->request->geoBrandScope=['tenant'=>$t,'user'=>$u,'scope'=>$row?(int)$row['geo_scope']:0];
    }
    public static function with(int $t,int $u,int $scope,callable $fn):mixed
    {
        $request=app()->request;$old=$request->geoBrandScope;
        $request->geoBrandScope=['tenant'=>$t,'user'=>$u,'scope'=>$scope];
        try{return $fn();}finally{$request->geoBrandScope=$old;}
    }
    public static function query(string $table,int $t,int $u)
    {
        $q=Db::name($table)->where(['tenant_id'=>$t,'user_id'=>$u]);
        if(in_array($table,self::ROOTS,true))return $q->where('brand_id',self::id($t,$u));
        if($table==='oem_geo_action_link')return $q->whereIn('action_id',Db::raw(self::query('oem_geo_action',$t,$u)->field('id')->buildSql(false)));
        if(in_array($table,['oem_geo_cycle','oem_geo_sample','oem_geo_plan','oem_geo_action','oem_geo_progress_report','oem_geo_monitor_run','oem_geo_monitor_schedule'],true))return $q->whereIn('project_id',Db::raw(self::query('oem_geo_project',$t,$u)->field('id')->buildSql(false)));
        throw new Invalid('品牌资料类型无效');
    }
}
