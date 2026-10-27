<?php
declare(strict_types=1);
namespace app\common\http\middleware;

/** Scope guard for the new configuration API only, before legacy token-expiry logic. */
final class ClipIntegrationScopeMiddleware
{
    public function handle($request,\Closure $next)
    {
        $path=strtolower(trim($request->pathinfo(),'/'));$path=preg_replace('#^t/[0-9]+/#','',$path);
        if(!str_starts_with($path,'tenantapi/integration.config/'))return $next($request);
        $token=(string)$request->header('token','');if($token===''||str_starts_with($token,'agent_'))return $next($request);
        $identity=(new \app\common\cache\TenantAdminTokenCache())->getAdminInfo($token);
        if($identity&&(int)$identity['tenant_id']!==(int)($request->tenantId??0))return \app\common\service\JsonService::fail('不能跨 OEM 访问剪辑配置',[],0,0);
        return $next($request);
    }
}
