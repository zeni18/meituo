<?php
declare(strict_types=1);
namespace app\common\http\middleware;
use app\common\service\merchant\{MerchantPublishService as Publish,TaskNotificationService as Notify,AgentAdminService};
final class TaskPortalMiddleware
{
    public function handle($request,\Closure $next){
        $path='/'.trim($request->pathinfo(),'/');if(!in_array($path,['/employee/tasks','/employee/tasks-api','/employee/wechat-callback'],true))return $next($request);
        $headers=['Cache-Control'=>'no-store','Referrer-Policy'=>'no-referrer','X-Content-Type-Options'=>'nosniff','X-Frame-Options'=>'DENY'];
        if($path==='/employee/tasks')return response(file_get_contents(root_path().'app/view/merchant/employee-tasks.html'))->header($headers+['Content-Type'=>'text/html; charset=utf-8']);
        try{
            if($path==='/employee/wechat-callback'){if(!$request->isGet())throw new \InvalidArgumentException('方法不正确');$url=(new Notify())->callback((string)$request->get('state',''),(string)$request->get('code',''));return redirect($url)->header($headers);}
            AgentAdminService::assertWrite($request);$access=Publish::access((string)$request->header('x-staff-access',''));$p=$request->post(false);$data=match($p['action']??''){'list'=>Publish::portal($access),'bind'=>(new Notify())->start($access),default=>Publish::employeeAction($access,$p)};return json(['code'=>1,'data'=>$data,'msg'=>''])->header($headers);
        }catch(\Throwable $e){$msg=$e instanceof \InvalidArgumentException?$e->getMessage():'员工任务服务暂不可用，请稍后重试';if($path==='/employee/wechat-callback')return response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>任务通知绑定</title><p>'.htmlspecialchars($msg,ENT_QUOTES,'UTF-8').'</p><p>请返回员工任务页重新绑定。</p>')->header($headers+['Content-Type'=>'text/html; charset=utf-8']);return json(['code'=>0,'msg'=>$msg,'data'=>[]])->header($headers);}
    }
}
