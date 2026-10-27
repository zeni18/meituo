<?php
declare(strict_types=1);
namespace app\tenantapi\controller\media;
use app\tenantapi\controller\BaseAdminController;
use app\common\cache\TenantAdminAuthCache;
use app\common\service\press\PressService;

/** OEM read surface. Deliberately no provider settings, sync or refund actions. */
final class PressController extends BaseAdminController
{
    private function run(string $action,callable $fn)
    {
        $allowed=$this->tenantId>0 && ((int)($this->adminInfo['root']??0)===1 || in_array('media.press/'.$action,array_map('strtolower',(array)(new TenantAdminAuthCache($this->adminId))->getAdminUri()),true));
        if (!$allowed) return $this->fail('没有发稿订单查看权限');
        try {if (!$this->request->isGet()) throw new \InvalidArgumentException('请使用GET请求');return $this->data($fn())->header(['Cache-Control'=>'no-store']);}
        catch (\InvalidArgumentException $e) {return $this->fail($e->getMessage());}catch (\Throwable) {return $this->fail('发稿订单查询失败');}
    }
    /** @notes 查看OEM发稿订单与消耗 */
    public function orders(){return $this->run('orders',fn()=>PressService::orders($this->tenantId,null,null,false,$this->request->get()));}
    /** @notes 查看OEM发稿详情 */
    public function detail(){return $this->run('orders',fn()=>PressService::detail($this->tenantId,null,null,false,(int)$this->request->get('id')));}
    /** @notes 导出OEM发稿订单 */
    public function export(){return $this->run('export',fn()=>PressService::export($this->tenantId,null,null,false,$this->request->get()));}
}
