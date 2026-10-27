<?php
declare(strict_types=1);
namespace app\api\controller;

use app\common\service\merchant\AgentAccessService as Access;
use app\common\service\merchant\OemDirectoryService;

class AgentController extends BaseApiController
{
    public array $notNeedLogin = ['login'];

    private function write(): void
    {
        $origin = rtrim((string)$this->request->header('origin',''),'/');
        if (!$this->request->isPost() || ($origin!=='' && $origin!==rtrim($this->request->domain(),'/')) || strtolower((string)$this->request->header('sec-fetch-site',''))==='cross-site') throw new \InvalidArgumentException('请求来源或方法不正确');
    }
    private function cookieOptions(): array
    {
        return ['expire'=>Access::LIFETIME,'path'=>'/','secure'=>$this->request->isSsl(),'httponly'=>true,'samesite'=>'Lax'];
    }
    public function login()
    {
        try {
            $this->write();
            $result = Access::login((int)$this->request->tenantId,trim((string)$this->request->post('account','')),(string)$this->request->post('password',''),$this->request->ip());
            return $this->data(['redirect'=>'/agent','tenant_id'=>(int)$this->request->tenantId])->cookie(Access::COOKIE,$result['token'],$this->cookieOptions())->header(['Cache-Control'=>'no-store']);
        } catch (\InvalidArgumentException $e) { return $this->fail($e->getMessage()); }
        catch (\Throwable $e) { error_log('Agent login failed: '.$e->getMessage()); return $this->fail('登录失败，请稍后重试'); }
    }
    public function session()
    {
        $agent = $this->request->agentInfo;
        return $this->data(['name'=>$agent['name'],'id'=>(int)$agent['id'],'level'=>(int)$agent['level'],'tenant_id'=>(int)$agent['tenant_id']])->header(['Cache-Control'=>'no-store']);
    }
    public function merchants()
    {
        $agent = $this->request->agentInfo;
        return $this->data(OemDirectoryService::list((int)$agent['tenant_id'],'merchant',$this->request->get(),Access::scope($agent)))->header(['Cache-Control'=>'no-store']);
    }
    public function saveMerchant()
    {
        try {
            $this->write();$agent = $this->request->agentInfo;
            $id = OemDirectoryService::saveMerchant((int)$agent['tenant_id'],$this->request->post(),Access::scope($agent));
            return $this->success('保存成功',['id'=>$id]);
        } catch (\InvalidArgumentException $e) { return $this->fail($e->getMessage()); }
        catch (\Throwable $e) { error_log('Agent merchant save failed: '.$e->getMessage()); return $this->fail('保存失败，请稍后重试'); }
    }
    public function logout()
    {
        try { $this->write(); } catch (\InvalidArgumentException $e) { return $this->fail($e->getMessage()); }
        Access::logout((string)$this->request->cookie(Access::COOKIE,''),(int)$this->request->tenantId);
        $options=$this->cookieOptions();$options['expire']=-3600;
        return $this->success('已退出登录')->cookie(Access::COOKIE,'',$options);
    }
}
