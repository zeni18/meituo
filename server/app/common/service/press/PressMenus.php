<?php
declare(strict_types=1);
namespace app\common\service\press;
use think\facade\Db;

final class PressMenus
{
    public static function sync(): void
    {
        self::install('system_menu',[],true);
        foreach (Db::name('tenant')->whereNull('delete_time')->select()->toArray() as $tenant) self::syncOem($tenant);
    }
    public static function syncOem(array $tenant): void
    {
        self::install((int)$tenant['tactics']===1?'tenant_system_menu_'.$tenant['sn']:'tenant_system_menu',['tenant_id'=>(int)$tenant['id']],false);
    }
    private static function install(string $table,array $scope,bool $platform): void
    {
        $base=$scope+($platform?[]:['source'=>'tenant']);
        $items=[['orders','发稿订单','orders'],['usage','发稿消耗','orders']];if ($platform) array_unshift($items,['config','海讯社接口','config']);
        foreach ($items as [$path,$title,$permission]) {
            $route='media/press/'.$path;
            $old=Db::name($table)->where($scope)->where('paths',$route)->find();
            $data=$base+['pid'=>0,'type'=>'C','name'=>$title,'icon'=>'el-icon-Document','sort'=>65,'perms'=>'media.press/'.$permission,'paths'=>$route,'component'=>'media/press/'.$path,'is_show'=>1,'is_disable'=>0,'create_time'=>time(),'update_time'=>time()];
            if (!$platform) $data['source_menu_key']='media_press_'.$path;
            $id=$old?(int)$old['id']:(int)Db::name($table)->insertGetId($data);
            if ($path==='orders') {
                foreach (['export'=>'导出发稿订单','detail'=>'查看发稿详情']+($platform?['refund'=>'确认供方退款','resume'=>'恢复原单查询']:[]) as $action=>$name) if (!Db::name($table)->where($scope)->where('perms','media.press/'.$action)->find()) Db::name($table)->insert($base+['pid'=>$id,'type'=>'A','name'=>$name,'perms'=>'media.press/'.$action,'is_show'=>0,'is_disable'=>0,'create_time'=>time(),'update_time'=>time()]);
            }
            if ($path==='config') foreach (['save'=>'配置海讯社接口','sync'=>'同步媒体资源'] as $action=>$name) if (!Db::name($table)->where($scope)->where('perms','media.press/'.$action)->find()) Db::name($table)->insert($base+['pid'=>$id,'type'=>'A','name'=>$name,'perms'=>'media.press/'.$action,'is_show'=>0,'is_disable'=>0,'create_time'=>time(),'update_time'=>time()]);
        }
    }
}
