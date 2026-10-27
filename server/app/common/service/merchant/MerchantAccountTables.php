<?php
declare(strict_types=1);
namespace app\common\service\merchant;
use think\facade\Db;

final class MerchantAccountTables
{
    public static function name(int $tenantId, string $base): string
    {
        if (!in_array($base,['user','user_session','user_account_log','tenant_file'],true)) throw new \InvalidArgumentException('Unknown account table');
        $tenant=Db::name('tenant')->where('id',$tenantId)->whereNull('delete_time')->field('sn,tactics')->find();
        if ($tenant && (int)$tenant['tactics']===1) {
            $sn=(string)$tenant['sn'];
            if (!preg_match('/^[A-Za-z0-9_-]+$/D',$sn)) throw new \RuntimeException('Invalid tenant table identifier');
            return $base.'_'.$sn;
        }
        return $base;
    }
}
