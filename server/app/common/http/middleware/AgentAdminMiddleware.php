<?php
declare(strict_types=1);
namespace app\common\http\middleware;

use app\common\service\merchant\AgentAccessService as Access;
use app\common\service\merchant\AgentAdminService;
use app\common\service\merchant\OemDirectoryService;
use app\common\service\merchant\AgentOperationsService;
use app\common\service\JsonService;

/** Share the native admin shell, with a fail-closed agent API surface. */
final class AgentAdminMiddleware
{
    public function handle($request, \Closure $next)
    {
        $path = strtolower(trim($request->pathinfo(),'/'));
        if (!str_starts_with($path,'tenantapi/')) return $next($request);
        $action = substr($path,10);
        if (in_array($action,['login/account','config/getconfig'],true)) return $next($request);
        $header = (string)$request->header('token','');
        if (!str_starts_with($header,'agent_')) return $next($request);
        $token = substr($header,6);
        $tenantId = (int)($request->tenantId ?? 0);
        $agent = Access::identity($token,$tenantId);
        if (!$agent) return JsonService::fail('代理登录已失效，请重新登录',[],-1,0);
        // All unknown paths stay denied, including native routes that do not
        // have a registered menu permission in the original application.
        $allowed=['auth.admin/myself','auth.menu/route','oem.directory/merchants','oem.directory/savemerchant','oem.directory/storerequests','oem.directory/storereview','login/logout'];
        $allowed=array_merge($allowed,['media.press/orders','media.press/detail','media.press/export']);
        $allowed=array_merge($allowed,['geo.config/lists','geo.config/save','geo.config/jobs']);
        $reads=['overview','catalog','merchants','ledger','orders','walletlogs'];
        $writes=['recharge','assignplan','authorizeapps'];
        foreach(array_merge($reads,$writes) as $method)$allowed[]='oem.operations/'.$method;
        if ((int)$agent['level']===1) $allowed=array_merge($allowed,['oem.directory/agents','oem.directory/saveagent','oem.directory/grantquota']);
        if (!in_array($action,$allowed,true)) return JsonService::fail('当前代理身份没有此项管理权限',[],0,1);
        try {
            if (in_array($action,array_merge(['geo.config/save','oem.directory/savemerchant','oem.directory/saveagent','oem.directory/grantquota','oem.directory/storereview','login/logout'],array_map(fn($method)=>'oem.operations/'.$method,$writes)),true)) AgentAdminService::assertWrite($request);
            elseif (!$request->isGet()) return JsonService::fail('请使用 GET 请求');
            if ($action==='auth.admin/myself') return JsonService::data(AgentAdminService::profile($agent))->header(['Cache-Control'=>'no-store']);
            if(str_starts_with($action,'geo.config/')){
                $method=substr($action,11);$service=\app\common\service\merchant\geo\GeoConnections::class;
                $data=match($method){'lists'=>$service::listing($tenantId,(int)$agent['id'])+['can_write'=>true,'can_grant'=>false],
                    'save'=>$service::save($tenantId,(int)$agent['id'],(int)$agent['id'],$request->post(false)),
                    'jobs'=>\app\common\service\merchant\geo\GeoAdminRecords::listing($tenantId,$agent,false,$request->get())};
                return JsonService::data($data)->header(['Cache-Control'=>'no-store']);
            }
            if (str_starts_with($action,'media.press/')) {
                $method=substr($action,12);$p=$request->get();$service=\app\common\service\press\PressService::class;
                $data=$method==='detail'?$service::detail($tenantId,null,$agent,false,(int)($p['id']??0)):$service::$method($tenantId,null,$agent,false,$p);
                return JsonService::data($data)->header(['Cache-Control'=>'no-store']);
            }
            if ($action==='auth.menu/route') return JsonService::data(AgentAdminService::menus($agent))->header(['Cache-Control'=>'no-store']);
            if (str_starts_with($action,'oem.operations/')) {
                $method=substr($action,15);
                $map=['assignplan'=>'assignPlan','authorizeapps'=>'authorizeApps','walletlogs'=>'walletLogs'];
                $method=$map[$method] ?? $method;
                // Preserve JSON types: the application's global trim filter turns true into "1".
                $result=AgentOperationsService::$method($agent,$request->isPost()?$request->post(false):$request->get());
                return JsonService::data($result)->header(['Cache-Control'=>'no-store']);
            }
            if ($action==='oem.directory/grantquota') return JsonService::data(AgentOperationsService::allocate($agent,$tenantId,0,$request->post(false)));
            if ($action==='oem.directory/storerequests') return JsonService::data(\app\common\service\merchant\MerchantStoreRequestService::listing($tenantId,$agent,$request->get()))->header(['Cache-Control'=>'no-store']);
            if ($action==='oem.directory/storereview') {\app\common\service\merchant\MerchantStoreRequestService::review($tenantId,$agent,0,$request->post(false));return JsonService::data([]);}
            if ($action==='oem.directory/agents') return JsonService::data(OemDirectoryService::listChildAgents($agent,$request->get()))->header(['Cache-Control'=>'no-store']);
            if ($action==='oem.directory/saveagent') {
                $id=OemDirectoryService::saveChildAgent($agent,$request->post());
                return JsonService::success('保存成功',['id'=>$id]);
            }
            if ($action==='oem.directory/merchants') {
                $data=OemDirectoryService::list($tenantId,'merchant',$request->get(),Access::scope($agent));
                $data['actor_agent_id']=(int)$agent['id'];
                return JsonService::data($data)->header(['Cache-Control'=>'no-store']);
            }
            if ($action==='oem.directory/savemerchant') {
                $id=OemDirectoryService::saveMerchant($tenantId,$request->post(),Access::scope($agent));
                return JsonService::success('保存成功',['id'=>$id]);
            }
            Access::logout($token,$tenantId);
            return JsonService::success('已退出登录')->cookie(Access::COOKIE,'',['expire'=>-3600,'path'=>'/','httponly'=>true,'samesite'=>'Lax']);
        } catch (\InvalidArgumentException $e) { return JsonService::fail($e->getMessage()); }
        catch (\Throwable $e) { error_log('Unified agent admin failed: '.$e->getMessage()); return JsonService::fail('操作失败，请稍后重试'); }
    }
}
