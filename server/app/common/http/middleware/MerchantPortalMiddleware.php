<?php
declare(strict_types=1);
namespace app\common\http\middleware;

use app\common\service\merchant\MerchantAccessService;
use app\common\service\merchant\MerchantBrandingService;

final class MerchantPortalMiddleware
{
    public function handle($request, \Closure $next)
    {
        $rawPath = parse_url($request->url(), PHP_URL_PATH) ?: '/';
        $path = preg_replace('#^/t/[0-9]+(?=/|$)#', '', $rawPath) ?: '/';
        if (preg_match('#^/(?:api|tenantapi|platformapi|platform|admin|wechat|install)(?:/|$)#', $path)) return $next($request);
        $tenantId = (int)($request->tenantId ?? 0);
        if (in_array(rtrim($path,'/'),['/agent','/agent/login'],true)) {
            $context = $request->param('tenant_id') ?: $request->param('tenantId');
            $query = $context ? '?tenant_id='.(int)$context : '';
            return redirect('/admin/login'.$query)->header(['Cache-Control'=>'no-store']);
        }
        $identity = MerchantAccessService::identity((string)$request->cookie('token', ''), $tenantId);
        $login = in_array(rtrim($path, '/'), ['/login', '/merchant/login'], true);
        $context = $request->param('tenant_id') ?: $request->param('tenantId');
        $query = $context ? '?tenant_id=' . (int)$context : '';
        if ($login) {
            if ($identity) return redirect('/ai' . $query)->header(['Cache-Control' => 'no-store']);
            $html = file_get_contents(app()->getRootPath() . 'app/view/merchant/login.html');
            return response(MerchantBrandingService::loginHtml($html, MerchantBrandingService::read()))->header(['Content-Type' => 'text/html; charset=utf-8', 'Cache-Control' => 'no-store']);
        }
        if (!$identity) {
            $return = MerchantAccessService::safeReturn($request->url());
            return redirect('/login' . ($query ?: '?') . ($query ? '&' : '') . 'redirect=' . rawurlencode($return))->header(['Cache-Control' => 'no-store']);
        }
        if (in_array(rtrim($path, '/'), ['', '/merchant', '/pc', '/mobile'], true)) {
            return redirect('/ai' . $query)->header(['Cache-Control' => 'no-store']);
        }
        if (preg_match('#^/app/aigc_geo(?:/|$)#',$path)) return redirect('/ai/geo'.$query)->header(['Cache-Control'=>'no-store']);
        if (preg_match('#^/app/aigc_image(?:/|$)#',$path)) return redirect('/ai/create?type=image'.($query?'&':'').$query)->header(['Cache-Control'=>'no-store']);
        if (preg_match('#^/app/aigc_video(?:/|$)#',$path)) return redirect('/ai/create?type=video'.($query?'&':'').$query)->header(['Cache-Control'=>'no-store']);
        if (preg_match('#^/app/aigc_digital_human(?:/|$)#',$path)) return redirect('/ai/avatar'.$query)->header(['Cache-Control'=>'no-store']);
        // Existing AI applications are retained behind the same server-side gate.
        $html = file_get_contents(app()->getRootPath() . 'public/pc/index.html');
        $branding = MerchantBrandingService::read();
        $html = preg_replace_callback('~<title>.*?</title>~is', static fn() => '<title>' . htmlspecialchars($branding['title'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</title>', $html, 1);
        // The merchant shell has one maintained appearance. Run before the module entry.
        $whiteBoot = '<script>window.__MERCHANT_UI__=' . json_encode(['tenantId' => $tenantId, 'white' => true, 'branding' => $branding], JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';</script><script src="/merchant/merchant-white.js?v=u1023white3"></script><link rel="stylesheet" href="/merchant/merchant-white.css?v=u1023white3">';
        $html = str_replace('<head>', '<head>' . $whiteBoot, $html);
        $html = str_replace('</head>', '<style>html,body,#__nuxt{background:var(--ia-bg,#F4F5F7);min-height:100%}.nuxt-spa-loading{display:none}#__nuxt:has(>.nuxt-spa-loading)::before{content:"";position:fixed;left:50%;top:50%;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;border:2.5px solid rgba(22,23,29,.1);border-top-color:#5B5CF6;animation:ui-boot-spin .8s linear infinite}@keyframes ui-boot-spin{to{transform:rotate(360deg)}}</style><link rel="stylesheet" href="/merchant/workspace.css?v=20261019-1"><script src="/merchant/list-space.js?v=20261019-1" defer></script><script src="/merchant/bridge.js" defer></script><script src="/merchant/ui-kit.js?v=u1024brandname2" defer></script><script src="/merchant/materials-v2.js?v=u1024transition1" defer></script><script src="/merchant/assets-v2.js?v=u1023audit17" defer></script><script src="/merchant/brand-v2.js?v=u1026phone1" defer></script><script src="/merchant/geo-content.js?v=u1023audit17" defer></script><script src="/merchant/geo-publish.js?v=u1024geo1" defer></script><script src="/merchant/geo-v2.js?v=u1023white3" defer></script><link rel="stylesheet" href="/merchant/automation-v2.css?v=u1023auto6"><script src="/merchant/automation-v2.js?v=u1023auto6" defer></script><script src="/merchant/identity.js?v=20261016-2" defer></script><link rel="stylesheet" href="/merchant/account-header.css?v=20261016-3"><link rel="stylesheet" href="/merchant/material-library.css?v=20261018-2"><script src="/merchant/folder-sort.js?v=20261016-2" defer></script><script src="/merchant/material-library.js?v=20261018-2" defer></script><link rel="stylesheet" href="/merchant/clip-studio.css?v=20261020-2"><script src="/merchant/clip-group-sort.js?v=20261016-3" defer></script><script src="/merchant/clip-motion.js?v=20261018-2" defer></script><link rel="stylesheet" href="/merchant/personal-voices.css?v=20261020-1"><script src="/merchant/personal-voices.js?v=20261020-1" defer></script><script src="/merchant/clip-studio.js?v=u1024transition1" defer></script><link rel="stylesheet" href="/merchant/store-directory.css?v=20261017-1"><link rel="stylesheet" href="/merchant/store-designer.css?v=20261016-5"><script src="/merchant/store-designer.js?v=20261016-6" defer></script><link rel="stylesheet" href="/merchant/storefront-designer.css?v=20261020-2"><script src="/merchant/storefront-designer.js?v=20261020-2" defer></script><script src="/merchant/store-directory.js?v=20261020-1" defer></script><link rel="stylesheet" href="/merchant/publishing.css?v=20261016-6"><script src="/merchant/finished-video.js?v=u1023clip9" defer></script><script src="/merchant/staff-import.js?v=20261016-1" defer></script><script src="/merchant/publishing.js?v=20261021-capabilities4" defer></script><link rel="stylesheet" href="/merchant/finished-catalog.css?v=20261016-7"><script src="/merchant/finished-catalog.js?v=20261016-5" defer></script><link rel="stylesheet" href="/merchant/finished-library.css?v=20261018-3"><script src="/merchant/asset-contents.js?v=20261018-4" defer></script><link rel="stylesheet" href="/merchant/article-library.css?v=20261018-3"><script src="/merchant/article-library.js?v=20261018-2" defer></script><script src="/merchant/finished-library.js?v=u10221102" defer></script><script src="/merchant/brand-directory.js?v=20261018-4" defer></script><script src="/merchant/workspace.js?v=u1023white3" defer></script><link rel="stylesheet" href="/shared/select.css?v=20261017-1"><script src="/shared/select.js?v=20261017-1" defer></script><link rel="stylesheet" href="/shared/vendor/flatpickr/flatpickr.min.css?v=4.6.13"><link rel="stylesheet" href="/shared/dates.css?v=20261017-1"><script src="/shared/vendor/flatpickr/flatpickr.min.js?v=4.6.13" defer></script><script src="/shared/vendor/flatpickr/zh.js?v=4.6.13" defer></script><script src="/shared/dates.js?v=20261017-1" defer></script><link rel="stylesheet" href="/merchant/light-theme.css?v=20261016-3"><link rel="stylesheet" href="/merchant/merchant-ui.css?v=20261017-2"><link rel="stylesheet" href="/merchant/brand-directory.css?v=20261018-3"><link rel="stylesheet" href="/merchant/clip-workbench.css?v=20261020-2"><link rel="stylesheet" href="/merchant/ui-v2.css?v=20261020-1"><link rel="stylesheet" href="/merchant/ui-kit.css?v=u1024brandname1"><link rel="stylesheet" href="/merchant/materials-v2.css?v=u10221133"><link rel="stylesheet" href="/merchant/assets-v2.css?v=u10221231"><link rel="stylesheet" href="/merchant/brand-v2.css?v=u1026phone1"><link rel="stylesheet" href="/merchant/geo-content.css?v=u10230420"><link rel="stylesheet" href="/merchant/geo-publish.css?v=u1024geo1"><link rel="stylesheet" href="/merchant/geo-v2.css?v=u10230320"><link rel="stylesheet" href="/merchant/clip-editor-v2.css?v=u1024transition1"><link rel="stylesheet" href="/merchant/clip-approved-layout.css?v=u1024transition1"><script src="/merchant/nav-v2.js?v=u1024transition1" defer></script><script src="/merchant/tp.js?v=20261020-1" defer></script><script src="/merchant/entries-v2.js?v=u1024transition1" defer></script><link rel="stylesheet" href="/merchant/workbench-v2.css?v=u10220020"><script src="/merchant/workbench-v2.js?v=u1023audit17" defer></script><link rel="stylesheet" href="/merchant/audit-polish.css?v=u1023audit17"><script src="/merchant/audit-polish.js?v=u1023audit17" defer></script></head>', $html);
        return response($html)->header(['Content-Type' => 'text/html; charset=utf-8', 'Cache-Control' => 'no-store']);
    }
}
