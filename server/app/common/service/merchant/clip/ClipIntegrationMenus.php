<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

use think\facade\Db;

final class ClipIntegrationMenus
{
    public static function syncPlatform():void{self::sync('system_menu',null);}
    public static function syncOem(array $tenant):void{self::sync((int)$tenant['tactics']===1?'tenant_system_menu_'.$tenant['sn']:'tenant_system_menu',(int)$tenant['id']);}
    private static function sync(string $table,?int $tenant):void
    {
        $scope=$tenant===null?[]:['tenant_id'=>$tenant];$q=Db::name($table)->where($scope)->where('perms','integration.config/lists');$row=$q->find();$extra=$tenant===null?[]:['source'=>'tenant','source_menu_key'=>'clip_integration_config'];
        $id=$row?(int)$row['id']:(int)Db::name($table)->insertGetId($scope+$extra+['pid'=>0,'type'=>'C','name'=>'接入能力配置','icon'=>'el-icon-SetUp','sort'=>70,'perms'=>'integration.config/lists','paths'=>'integration/config','component'=>'integration/config','is_show'=>1,'is_disable'=>0,'create_time'=>time(),'update_time'=>time()]);
        if($row)Db::name($table)->where('id',$id)->where($scope)->update(['name'=>'接入能力配置']);
        $permissions=['save'=>'编辑剪辑配置'];if($tenant===null)$permissions['grant']='授权OEM借用剪辑配置';
        foreach($permissions as $method=>$name)if(!Db::name($table)->where($scope)->where('perms','integration.config/'.$method)->find())Db::name($table)->insert($scope+($tenant===null?[]:['source'=>'tenant','source_menu_key'=>'clip_integration_'.$method])+['pid'=>$id,'type'=>'A','name'=>$name,'perms'=>'integration.config/'.$method,'is_show'=>0,'is_disable'=>0,'create_time'=>time(),'update_time'=>time()]);
    }
}
