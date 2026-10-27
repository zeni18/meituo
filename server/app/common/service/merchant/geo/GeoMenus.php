<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;
use think\facade\Db;
final class GeoMenus
{
    public static function sync():void{self::install('system_menu',[]);foreach(Db::name('tenant')->whereNull('delete_time')->select()->toArray()as $tenant)self::syncOem($tenant);}
    public static function syncOem(array $tenant):void{self::install((int)$tenant['tactics']===1?'tenant_system_menu_'.$tenant['sn']:'tenant_system_menu',['tenant_id'=>(int)$tenant['id']]);}
    private static function install(string $table,array $scope):void
    {
        foreach(['config'=>['GEO能力配置','lists'],'jobs'=>['GEO任务与消耗','jobs']]as $path=>[$title,$action]){$extra=$scope?['source'=>'tenant','source_menu_key'=>'geo_'.$path]:[];$where=$scope+['paths'=>'geo/'.$path];$r=Db::name($table)->where($where)->find();$id=$r?(int)$r['id']:(int)Db::name($table)->insertGetId($where+$extra+['pid'=>0,'type'=>'C','name'=>$title,'icon'=>'el-icon-SetUp','sort'=>66,'perms'=>'geo.config/'.$action,'component'=>'geo/'.$path,'is_show'=>1,'is_disable'=>0,'create_time'=>time(),'update_time'=>time()]);
            if($path==='config')foreach(['save'=>'维护本级GEO配置','recover'=>'核对自动监测原任务回执','grant'=>$scope?'授权代理GEO能力':'授权OEM借用GEO能力']as $method=>$name)if(!Db::name($table)->where($scope)->where('perms','geo.config/'.$method)->find())Db::name($table)->insert($scope+$extra+['pid'=>$id,'type'=>'A','name'=>$name,'perms'=>'geo.config/'.$method,'is_show'=>0,'is_disable'=>0,'create_time'=>time(),'update_time'=>time()]);
        }
    }
}
