<?php
declare(strict_types=1);
namespace app\common\service\auth;

use think\facade\Db;

/** Physical session tables follow the account's OEM shard. */
final class LoginSessionService
{
    public static function tenantSuffix(int $tenantId): string
    {
        if ($tenantId <= 0) throw new \InvalidArgumentException('登录租户无效');
        $tenant = Db::name('tenant')->where('id', $tenantId)->whereNull('delete_time')->field('sn,tactics')->find();
        if (!$tenant) throw new \InvalidArgumentException('登录租户不存在');
        if ((int)$tenant['tactics'] !== 1) return '';
        if (!preg_match('/^[A-Za-z0-9_-]+$/D', (string)$tenant['sn'])) throw new \RuntimeException('登录租户分表标识无效');
        return '_' . $tenant['sn'];
    }
}
