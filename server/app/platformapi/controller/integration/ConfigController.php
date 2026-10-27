<?php
declare(strict_types=1);
namespace app\platformapi\controller\integration;

use app\platformapi\controller\BaseAdminController;
use app\common\cache\AdminAuthCache;
use app\common\service\merchant\AgentAdminService;
use app\common\service\merchant\clip\ClipIntegrationService as Integration;

final class ConfigController extends BaseAdminController
{
    private function allowed(string $action):bool
    {
        if((int)($this->adminInfo['root']??0)===1)return true;
        return in_array('integration.config/'.strtolower($action),array_map('strtolower',(array)(new AdminAuthCache($this->adminId))->getAdminUri()),true);
    }
    private function action(string $permission,callable $work,bool $write=false)
    {
        if(!$this->allowed($permission))return $this->fail('没有剪辑接入配置权限');
        try{if($write)AgentAdminService::assertWrite($this->request);elseif(!$this->request->isGet())throw new \InvalidArgumentException('请使用 GET 请求');return $this->data($work())->header(['Cache-Control'=>'no-store']);}
        catch(\InvalidArgumentException $e){return $this->fail($e->getMessage());}
        catch(\Throwable){return $this->fail('剪辑配置操作失败，请检查配置版本或联系管理员');}
    }
    /** @notes 查看剪辑接入配置 */
    public function lists(){return $this->action('lists',fn()=>Integration::listing(0,$this->allowed('save'))+['can_write'=>$this->allowed('save')]);}
    /** @notes 保存剪辑接入配置 */
    public function save(){return $this->action('save',fn()=>Integration::save(0,$this->adminId,$this->request->post(false)),true);}
    /** @notes 保存阿里云公共凭证 */
    public function aliyun(){return $this->action('save',fn()=>Integration::saveAliyun(0,$this->adminId,$this->request->post(false)),true);}
    /** @notes 重置剪辑接入配置 */
    public function reset(){return $this->action('save',fn()=>Integration::reset(0,$this->adminId,$this->request->post(false)),true);}
    /** @notes 设置OEM剪辑配置借权 */
    public function grant(){return $this->action('grant',function(){$p=$this->request->post(false);if(!isset($p['revision'])||!is_int($p['revision'])||$p['revision']<0)throw new \InvalidArgumentException('借权版本不正确');return Integration::grant((int)($p['target_tenant_id']??0),$p['allow_platform']??false,$this->adminId,$p['revision']);},true);}
}
