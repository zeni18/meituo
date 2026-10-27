<?php
declare(strict_types=1);
namespace app\platformapi\controller\media;
use app\platformapi\controller\BaseAdminController;
use app\common\cache\AdminAuthCache;
use app\common\service\merchant\AgentAdminService;
use app\common\service\press\{PressConfig,PressService};

final class PressController extends BaseAdminController
{
    private function allowed(string $action): bool
    {
        return (int)($this->adminInfo['root']??0)===1 || in_array('media.press/'.strtolower($action),array_map('strtolower',(array)(new AdminAuthCache($this->adminId))->getAdminUri()),true);
    }
    private function run(string $permission,callable $fn,bool $write=false)
    {
        if (!$this->allowed($permission)) return $this->fail('没有媒体发稿管理权限');
        try {if ($write) AgentAdminService::assertWrite($this->request); elseif (!$this->request->isGet()) throw new \InvalidArgumentException('请使用GET请求');return $this->data($fn())->header(['Cache-Control'=>'no-store']);}
        catch (\InvalidArgumentException $e) {return $this->fail($e->getMessage());}
        catch (\app\common\service\press\HaipressFailure $e) {return $this->fail($e->getMessage());}
        catch (\Throwable) {return $this->fail('媒体发稿服务暂不可用，请检查安装与配置');}
    }
    /** @notes 查看海讯社配置 */
    public function config(){return $this->run('config',fn()=>PressConfig::listing($this->allowed('save'))+['can_write'=>$this->allowed('save'),'can_sync'=>$this->allowed('sync')]);}
    /** @notes 保存海讯社配置 */
    public function save(){return $this->run('save',fn()=>PressConfig::save($this->request->post(false),$this->adminId),true);}
    /** @notes 同步海讯社媒体资源 */
    public function sync(){return $this->run('sync',fn()=>(new PressService())->sync((int)$this->request->post('kind',1),(int)$this->request->post('page',1),$this->adminId),true);}
    /** @notes 创建或恢复全部媒体资源同步 */
    public function syncAll(){return $this->run('sync',fn()=>\app\common\service\press\PressResourceSync::start($this->adminId,(int)$this->request->post('revision',0)),true);}
    /** @notes 查看媒体资源同步进度 */
    public function syncStatus(){return $this->run('config',fn()=>\app\common\service\press\PressResourceSync::status());}
    /** @notes 检查海讯社连接与资源能力 */
    public function inspect(){return $this->run('sync',function(){
        if(!$this->allowed('config'))throw new \InvalidArgumentException('没有海讯社配置查看权限');
        return (new \app\common\service\press\HaipressClient())->inspectResources((int)$this->request->post('kind',1),(int)$this->request->post('revision',0));
    },true);}
    /** @notes 查看媒体资源 */
    public function media(){return $this->run('orders',fn()=>PressService::media($this->request->get(),true));}
    /** @notes 查看所有发稿订单与消耗 */
    public function orders(){return $this->run('orders',fn()=>PressService::orders(0,null,null,true,$this->request->get()));}
    /** @notes 查看发稿订单详情 */
    public function detail(){return $this->run('orders',fn()=>PressService::detail(0,null,null,true,(int)$this->request->get('id')));}
    /** @notes 导出发稿订单 */
    public function export(){return $this->run('export',fn()=>PressService::export(0,null,null,true,$this->request->get()));}
    /** @notes 确认供方退款到账并返还商家 */
    public function refund(){return $this->run('refund',fn()=>PressService::refund((int)$this->request->post('id'),$this->adminId,(string)$this->request->post('evidence','')),true);}
    /** @notes 恢复原供方订单查询 */
    public function resume(){return $this->run('resume',fn()=>PressService::resume((int)$this->request->post('id'),$this->adminId),true);}
}
