<?php
declare(strict_types=1);
namespace app\common\http\middleware;
final class GeoScopeMiddleware
{
    public function handle($request,\Closure $next)
    {
        $path=strtolower(trim($request->pathinfo(),'/'));$path=preg_replace('#^t/[0-9]+/#','',$path);if(!str_starts_with($path,'tenantapi/geo.config/'))return $next($request);
        $token=(string)$request->header('token','');if($token!==''&&!str_starts_with($token,'agent_')){$identity=(new \app\common\cache\TenantAdminTokenCache())->getAdminInfo($token);if($identity&&(int)$identity['tenant_id']!==(int)($request->tenantId??0))return \app\common\service\JsonService::fail('不能跨OEM管理GEO',[],0,0);}return $next($request);
    }
}
