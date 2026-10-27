<?php
declare(strict_types=1);
namespace app\tenantapi\controller\oem;

use app\tenantapi\controller\BaseAdminController;
use app\common\cache\TenantAdminAuthCache;
use app\common\service\merchant\OemDirectoryService;
use app\common\service\merchant\AgentOperationsService;
use app\common\service\merchant\AgentAdminService;

class DirectoryController extends BaseAdminController
{
    private function allowed(string $action): bool
    {
        if ($this->tenantId <= 0) return false;
        if ((int)($this->adminInfo['root'] ?? 0) === 1) return true;
        // Fail closed even when a permission has not yet been registered as a menu.
        $permissions = array_map('strtolower',(array)(new TenantAdminAuthCache($this->adminId))->getAdminUri());
        return in_array('oem.directory/' . strtolower($action),$permissions,true);
    }
    private function listing(string $kind, string $action)
    {
        if (!$this->allowed($action)) return $this->fail('没有此项 OEM 管理权限');
        try { $data=OemDirectoryService::list($this->tenantId,$kind,$this->request->get());$data['can_grant_quota']=(int)($this->adminInfo['root'] ?? 0)===1;return $this->data($data); }
        catch (\Throwable $e) { return $this->fail('目录读取失败，请稍后重试'); }
    }
    public function agents() { return $this->listing('agent','agents'); }
    public function merchants() { return $this->listing('merchant','merchants'); }
    private function saving(string $kind, string $action)
    {
        if (!$this->request->isPost() || !$this->allowed($action)) return $this->fail('没有此项 OEM 管理权限');
        try {
            $id = $kind === 'agent' ? OemDirectoryService::saveAgent($this->tenantId,$this->request->post()) : OemDirectoryService::saveMerchant($this->tenantId,$this->request->post());
            return $this->success('保存成功',['id'=>$id]);
        } catch (\InvalidArgumentException $e) { return $this->fail($e->getMessage()); }
        catch (\Throwable $e) { error_log('OEM directory save failed: '.$e->getMessage()); return $this->fail('保存失败，请刷新后重试'); }
    }
    public function saveAgent() { return $this->saving('agent','saveAgent'); }
    public function saveMerchant() { return $this->saving('merchant','saveMerchant'); }
    public function storeRequests() {
        if(!$this->allowed('merchants')||!$this->request->isGet())return $this->fail('没有门店申请管理权限');
        try{return $this->data(\app\common\service\merchant\MerchantStoreRequestService::listing($this->tenantId,null,$this->request->get()));}catch(\Throwable $e){return $this->fail('申请读取失败');}
    }
    public function storeReview() {
        if(!$this->allowed('saveMerchant'))return $this->fail('没有门店申请审核权限');
        try{AgentAdminService::assertWrite($this->request);\app\common\service\merchant\MerchantStoreRequestService::review($this->tenantId,null,$this->adminId,$this->request->post(false));return $this->data([]);}catch(\InvalidArgumentException $e){return $this->fail($e->getMessage());}catch(\Throwable $e){error_log('Store request review failed: '.$e->getMessage());return $this->fail('审核失败，请稍后重试');}
    }
    public function grantQuota()
    {
        if ((int)($this->adminInfo['root'] ?? 0)!==1) return $this->fail('仅 OEM 主账号可授予代理额度');
        try {
            AgentAdminService::assertWrite($this->request);
            return $this->data(AgentOperationsService::allocate(null,$this->tenantId,$this->adminId,$this->request->post(false)));
        } catch (\InvalidArgumentException $e) { return $this->fail($e->getMessage()); }
        catch (\Throwable $e) { error_log('OEM quota allocation failed: '.$e->getMessage());return $this->fail('额度操作失败，请稍后重试'); }
    }
}
