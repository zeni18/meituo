<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use think\facade\Db;

final class MerchantAccessService
{
    public static function identity(string $token, int $tenantId): ?array
    {
        if ($token === '' || $tenantId <= 0) return null;
        // Consult the durable session and current account status on every check;
        // an old token cache must not revive a disabled merchant or revoked token.
        $session = Db::name(MerchantAccountTables::name($tenantId,'user_session'))->where('tenant_id', $tenantId)->where('token', $token)->where('expire_time', '>', time())->find();
        if (!$session) return null;
        $owner = Db::name(MerchantAccountTables::name($tenantId,'user'))->where('tenant_id', $tenantId)->where('id', $session['user_id'])->whereNull('delete_time')->where('is_disable', 0)->find();
        if (!$owner) return null;
        $merchant = Db::name('oem_merchant')->where('tenant_id', $tenantId)->where('user_id', $owner['id'])->where('status', 1)->find();
        if (!$merchant) return null;
        return ['merchant' => $merchant, 'owner' => $owner, 'session' => $session];
    }

    public static function publicApi(string $controller, string $action): bool
    {
        $key = strtolower($controller . '/' . $action);
        return in_array($key, [
            'merchant/config', 'merchant/login', 'index/policy',
            'login/account', 'login/logout', 'login/codeurl', 'login/oalogin', 'login/mnplogin',
            'login/silentlogin', 'login/getscancode', 'login/scanlogin', 'login/wechatpcauthorize', 'login/wechatpclogin',
            'pay/notifymnp', 'pay/notifyoa', 'pay/notifyapp', 'pay/notifyplatformmnp',
            'pay/notifyplatformoa', 'pay/notifyplatformapp', 'pay/alinotify',
            'brand.payment/notifywechat', 'brand.payment/notifyali', 'brand.domain/probe',
        ], true);
    }

    public static function safeReturn(string $path): string
    {
        if (!str_starts_with($path, '/') || str_starts_with($path, '//') || str_contains($path, '\\') || preg_match('/[\x00-\x20]/', $path)) return '/ai/tools';
        $pathname = parse_url($path, PHP_URL_PATH) ?: '';
        if (preg_match('#^/(?:login|register|merchant(?:/login)?|api|platform|admin|tenantapi|platformapi)(?:/|$)#i', $pathname)) return '/ai/tools';
        return preg_match('#^/(?:ai|app|user)(?:/|$)#', $pathname) ? $path : '/ai/tools';
    }
}
