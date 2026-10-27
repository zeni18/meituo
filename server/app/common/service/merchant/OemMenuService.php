<?php
declare(strict_types=1);
namespace app\common\service\merchant;
use think\facade\Db;

final class OemMenuService
{
    public static function sync(array $tenant): void
    {
        $id=(int)$tenant['id'];
        $table=(int)$tenant['tactics']===1?'tenant_system_menu_'.$tenant['sn']:'tenant_system_menu';
        $time=time();
        $root=Db::name($table)->where('tenant_id',$id)->where('paths','consumer')->where('pid',0)->find();
        if($root){
            Db::name($table)->where('tenant_id',$id)->where('id',$root['id'])->update(['name'=>'商家管理','update_time'=>$time]);
            Db::name($table)->where('tenant_id',$id)->where('pid',$root['id'])->where('paths','lists')->update(['name'=>'商家列表','perms'=>'oem.directory/merchants','update_time'=>$time]);
            Db::name($table)->where('tenant_id',$id)->where('pid',$root['id'])->where('paths','lists/detail')->update(['name'=>'商家详情','is_show'=>0,'update_time'=>$time]);
            $list=Db::name($table)->where('tenant_id',$id)->where('pid',$root['id'])->where('paths','lists')->find();
            if($list)self::permission($table,$id,(int)$list['id'],'oem_merchant_save','管理商家','oem.directory/saveMerchant');
        }
        $agent=Db::name($table)->where('tenant_id',$id)->where('source_menu_key','oem_agent_directory')->find();
        $agentId=$agent ? (int)$agent['id'] : (int)Db::name($table)->insertGetId(['tenant_id'=>$id,'pid'=>0,'type'=>'C','name'=>'代理管理','icon'=>'el-icon-Connection','sort'=>119,'perms'=>'oem.directory/agents','paths'=>'oem/agents','component'=>'oem/agents/index','source'=>'tenant','source_menu_key'=>'oem_agent_directory','is_show'=>1,'is_disable'=>0,'create_time'=>$time,'update_time'=>$time]);
        self::permission($table,$id,$agentId,'oem_agent_save','管理代理','oem.directory/saveAgent');
        $config=Db::name('tenant_config')->where('tenant_id',$id)->where('type','tenant')->where('name','name')->find();
        if(!$config)Db::name('tenant_config')->insert(['tenant_id'=>$id,'type'=>'tenant','name'=>'name','value'=>'OEM 管理端']);
        elseif(in_array($config['value'],['SaaS租户端','SaaS 租户端'],true))Db::name('tenant_config')->where('id',$config['id'])->update(['value'=>'OEM 管理端']);
        \app\common\service\merchant\clip\ClipIntegrationMenus::syncOem($tenant);
        \app\common\service\press\PressMenus::syncOem($tenant);
        \app\common\service\merchant\geo\GeoMenus::syncOem($tenant);
    }
    private static function permission(string $table,int $tenantId,int $parent,string $key,string $label,string $permission): void
    {
        if(!Db::name($table)->where('tenant_id',$tenantId)->where('source_menu_key',$key)->find())Db::name($table)->insert(['tenant_id'=>$tenantId,'pid'=>$parent,'type'=>'A','name'=>$label,'perms'=>$permission,'source'=>'tenant','source_menu_key'=>$key,'is_show'=>0,'is_disable'=>0,'create_time'=>time(),'update_time'=>time()]);
    }
}
