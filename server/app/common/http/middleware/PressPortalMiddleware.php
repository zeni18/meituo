<?php
declare(strict_types=1);
namespace app\common\http\middleware;

final class PressPortalMiddleware
{
    public function handle($request,\Closure $next)
    {
        $path=parse_url($request->url(),PHP_URL_PATH)?:'/';
        if (preg_match('#^/press-preview/([a-f0-9]{64})$#D',$path,$m)) {
            if (!$request->isGet()) return response('Not found',404);
            $r=\think\facade\Db::name('press_draft')->where('preview_hash',hash('sha256',$m[1]))->where('expires_at','>',time())->find();
            if (!$r) return response('Not found',404);
            $e=fn($v)=>htmlspecialchars($v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
            $html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.$e($r['title']).'</title><style>body{font-family:sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.8}pre{white-space:pre-wrap;font:inherit;overflow-wrap:anywhere}</style><h1>'.$e($r['title']).'</h1><pre>'.$e($r['body']).'</pre></html>';
            return response($html)->header(['Content-Type'=>'text/html; charset=utf-8','Cache-Control'=>'no-store','Referrer-Policy'=>'no-referrer','X-Robots-Tag'=>'noindex, nofollow','Content-Security-Policy'=>"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"]);
        }
        $normalized=strtolower(trim($request->pathinfo(),'/'));$normalized=preg_replace('#^t/[0-9]+/#','',$normalized);
        if (str_starts_with($normalized,'tenantapi/media.press/')) {
            $token=(string)$request->header('token','');
            if ($token!=='' && !str_starts_with($token,'agent_')) {
                $identity=(new \app\common\cache\TenantAdminTokenCache())->getAdminInfo($token);
                if ($identity && (int)$identity['tenant_id']!==(int)($request->tenantId??0)) return \app\common\service\JsonService::fail('不能跨OEM查看发稿订单',[],0,0);
            }
        }
        return $next($request);
    }
}
