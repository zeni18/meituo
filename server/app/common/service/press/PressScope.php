<?php
declare(strict_types=1);
namespace app\common\service\press;
use think\facade\Db;
use app\common\service\merchant\AgentAccessService;

final class PressScope
{
    public static function query(int $tenant,?int $user=null,?array $agent=null,bool $platform=false)
    {
        $q=Db::name('press_order')->alias('o')->join('oem_merchant m','m.tenant_id=o.tenant_id AND m.user_id=o.user_id');
        if (!$platform) {
            if ($tenant<=0) throw new \InvalidArgumentException('缺少有效OEM身份');
            $q->where('o.tenant_id',$tenant);
        }
        if ($user!==null) { if ($user<=0) throw new \InvalidArgumentException('商家身份无效'); $q->where('o.user_id',$user);if(\app\common\service\merchant\geo\GeoBrandScope::bound($tenant,$user))$q->where('o.brand_id',\app\common\service\merchant\geo\GeoBrandScope::id($tenant,$user)); }
        if ($agent!==null) {
            if ((int)$agent['tenant_id']!==$tenant) throw new \InvalidArgumentException('不能跨OEM查询');
            $q->whereIn('m.agent_id',AgentAccessService::scope($agent));
        }
        return $q;
    }
}
