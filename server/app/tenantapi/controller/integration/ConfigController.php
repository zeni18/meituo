<?php
declare(strict_types=1);
namespace app\tenantapi\controller\integration;

use app\tenantapi\controller\BaseAdminController;
use app\common\cache\TenantAdminAuthCache;
use app\common\service\merchant\AgentAdminService;
use app\common\service\merchant\clip\ClipIntegrationService as Integration;

final class ConfigController extends BaseAdminController
{
    private function allowed(string $action):bool
    {
        if($this->tenantId<=0)return false;if((int)($this->adminInfo['root']??0)===1)return true;
        return in_array('integration.config/'.strtolower($action),array_map('strtolower',(array)(new TenantAdminAuthCache($this->adminId))->getAdminUri()),true);
    }
    private function action(string $permission,callable $work,bool $write=false)
    {
        if(!$this->allowed($permission))return $this->fail('没有剪辑接入配置权限');
        try{if($write)AgentAdminService::assertWrite($this->request);elseif(!$this->request->isGet())throw new \InvalidArgumentException('请使用 GET 请求');return $this->data($work())->header(['Cache-Control'=>'no-store']);}
        catch(\InvalidArgumentException $e){return $this->fail($e->getMessage());}
        catch(\Throwable){return $this->fail('剪辑配置操作失败，请检查配置版本或联系管理员');}
    }
    /** @notes 查看OEM剪辑接入配置 */
    public function lists(){return $this->action('lists',fn()=>Integration::listing($this->tenantId,$this->allowed('save'))+['can_write'=>$this->allowed('save')]);}
    /** @notes 保存OEM剪辑接入配置 */
    public function save(){return $this->action('save',fn()=>Integration::save($this->tenantId,$this->adminId,$this->request->post(false)),true);}
    /** @notes 保存阿里云公共凭证 */
    public function aliyun(){return $this->action('save',fn()=>Integration::saveAliyun($this->tenantId,$this->adminId,$this->request->post(false)),true);}
    /** @notes 重置OEM剪辑接入配置 */
    public function reset(){return $this->action('save',fn()=>Integration::reset($this->tenantId,$this->adminId,$this->request->post(false)),true);}
}
