<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use think\facade\Db;

final class MerchantAppAccessService
{
    /** An absent policy preserves existing rights; an empty policy denies all business apps. */
    public static function allows(int $tenantId, int $userId, string $appCode): bool
    {
        if ($userId<=0 || $appCode==='system_default') return true;
        $row=Db::name('oem_merchant_app_access')->where(['tenant_id'=>$tenantId,'user_id'=>$userId])->find();
        if (!$row) return true;
        if (!in_array($appCode,json_decode($row['app_codes'],true) ?? [],true)) return false;
        return Db::name('tenant_app')->alias('ta')->join('app a','a.code=ta.app_code')->where(['ta.tenant_id'=>$tenantId,'ta.app_code'=>$appCode,'ta.enable_status'=>'enabled','ta.shelf_status'=>'on','a.status'=>'installed'])->whereIn('ta.buy_status',['paid','trial'])->where(function($q){$q->where('ta.expire_time',0)->whereOr('ta.expire_time','>',time());})->count()>0;
    }
}
