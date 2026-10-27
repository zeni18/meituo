<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use think\facade\Db;
use app\common\service\FileService;

final class AgentAdminService
{
    public static function assertWrite($request): void
    {
        $origin=rtrim((string)$request->header('origin',''),'/');
        if (!$request->isPost() || ($origin!=='' && $origin!==rtrim($request->domain(),'/')) || strtolower((string)$request->header('sec-fetch-site',''))==='cross-site') throw new \InvalidArgumentException('请求来源或方法不正确');
    }
    public static function role(array $agent): string { return (int)$agent['level']===1?'一级代理':'二级代理'; }
    public static function avatar(): string { return FileService::getFileUrl((string)config('project.default_image.admin_avatar')); }
    public static function menus(array $agent): array
    {
        $base=['icon'=>'el-icon-Shop','sort'=>100,'perms'=>'','selected'=>'','params'=>'','is_cache'=>0,'is_show'=>1,'is_disable'=>0];
        $child=$base+['id'=>90000002,'pid'=>90000001,'type'=>'C','name'=>'商家列表','paths'=>'lists','component'=>'oem/merchants/index'];
        $child['perms']='oem.directory/merchants';
        $menus=[$base+['id'=>90000001,'pid'=>0,'type'=>'M','name'=>'商家管理','paths'=>'consumer','component'=>'','children'=>[$child]]];
        array_unshift($menus,$base+['id'=>90000010,'pid'=>0,'type'=>'C','name'=>'工作台','paths'=>'agent-workbench','component'=>'oem/operations/workbench']);
        if ((int)$agent['level']===1) {
            $child=$base+['id'=>90000004,'pid'=>90000003,'type'=>'C','name'=>'代理列表','paths'=>'agents','component'=>'oem/agents/index'];
            $child['perms']='oem.directory/agents';
            $menus[]=$base+['id'=>90000003,'pid'=>0,'type'=>'M','name'=>'代理管理','paths'=>'oem','component'=>'','children'=>[$child]];
        }
        $groups=[
            [90000020,'商家服务','agent-services',[[90000021,'商家套餐','packages','merchants'],[90000022,'应用授权','apps','merchants']]],
            [90000030,'算力管理','agent-power',[[90000031,'商家充值','recharge','merchants'],[90000032,'商家算力流水','ledger','ledger'],[90000033,'我的额度流水','quota','walletLogs']]],
        ];
        foreach($groups as [$id,$name,$path,$items]) {
            $children=[];
            foreach($items as [$childId,$childName,$childPath,$permission]) {
                $entry=$base+['id'=>$childId,'pid'=>$id,'type'=>'C','name'=>$childName,'paths'=>$childPath,'component'=>'oem/operations/'.$childPath];
                $entry['perms']='oem.operations/'.$permission;$children[]=$entry;
            }
            $menus[]=$base+['id'=>$id,'pid'=>0,'type'=>'M','name'=>$name,'paths'=>$path,'component'=>'','children'=>$children];
        }
        $menus[]=$base+['id'=>90000040,'pid'=>0,'type'=>'C','name'=>'订单记录','paths'=>'agent-orders','component'=>'oem/operations/orders'];
        foreach ([90000050=>['orders','发稿订单'],90000051=>['usage','发稿消耗']] as $id=>[$path,$title]) {
            $entry=$base+['id'=>$id,'pid'=>0,'type'=>'C','name'=>$title,'paths'=>'media/press/'.$path,'component'=>'media/press/'.$path];
            $entry['perms']='media.press/orders';$menus[]=$entry;
        }
        foreach([90000060=>['config','GEO能力配置','lists'],90000061=>['jobs','GEO任务与消耗','jobs']]as $id=>[$path,$title,$permission]){$entry=$base+['id'=>$id,'pid'=>0,'type'=>'C','name'=>$title,'paths'=>'geo/'.$path,'component'=>'geo/'.$path];$entry['perms']='geo.config/'.$permission;$menus[]=$entry;}
        return \app\common\service\integration\CapabilityNavigation::merge($menus);
    }
    public static function profile(array $agent): array
    {
        $account=Db::name('oem_agent_account')->where('tenant_id',$agent['tenant_id'])->where('agent_id',$agent['id'])->value('account');
        $permissions=['oem.directory/merchants','oem.directory/saveMerchant','oem.directory/storeRequests','oem.directory/storeReview'];
        $permissions=array_merge($permissions,['media.press/orders','media.press/detail','media.press/export']);
        $permissions=array_merge($permissions,['geo.config/lists','geo.config/save','geo.config/jobs']);
        foreach(['overview','catalog','merchants','ledger','orders','walletLogs','recharge','assignPlan','authorizeApps'] as $method)$permissions[]='oem.operations/'.$method;
        if ((int)$agent['level']===1) $permissions=array_merge($permissions,['oem.directory/agents','oem.directory/saveAgent','oem.directory/grantQuota']);
        return ['user'=>['id'=>(int)$agent['id'],'agent_id'=>(int)$agent['id'],'account'=>$account,'name'=>$agent['name'],'root'=>0,'disable'=>0,'avatar'=>self::avatar(),'role_name'=>self::role($agent),'account_type'=>'agent','agent_level'=>(int)$agent['level']],
            'menu'=>self::menus($agent),'permissions'=>$permissions];
    }
}
