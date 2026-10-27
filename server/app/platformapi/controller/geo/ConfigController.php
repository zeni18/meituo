<?php
declare(strict_types=1);
namespace app\platformapi\controller\geo;
use app\platformapi\controller\BaseAdminController;
use app\common\service\merchant\geo\{GeoConnections,GeoAdminRecords};
final class ConfigController extends BaseAdminController
{
    private function allowed(string $action):bool{return (int)($this->adminInfo['root']??0)===1||in_array('geo.config/'.$action,array_map('strtolower',(array)(new \app\common\cache\AdminAuthCache($this->adminId))->getAdminUri()),true);}
    private function run(string $action,callable $fn,bool $write=false){if(!$this->allowed($action))return $this->fail('没有GEO管理权限');try{if($write)\app\common\service\merchant\AgentAdminService::assertWrite($this->request);elseif(!$this->request->isGet())throw new \InvalidArgumentException('请使用GET请求');return $this->data($fn())->header(['Cache-Control'=>'no-store']);}catch(\InvalidArgumentException $e){return $this->fail($e->getMessage());}catch(\Throwable){return $this->fail('GEO管理操作失败，请检查配置');}}
    public function lists(){return $this->run('lists',fn()=>GeoConnections::listing(0,0,$this->allowed('save'))+['can_write'=>$this->allowed('save'),'can_grant'=>$this->allowed('grant')]);}
    public function save(){return $this->run('save',fn()=>GeoConnections::save(0,0,$this->adminId,$this->request->post(false)),true);}
    public function check(){return $this->run('save',fn()=>$this->request->post('capability')==='text'?GeoConnections::inspectText(0,$this->request->post(false)):GeoConnections::inspectVisibility(0,$this->request->post(false)),true);}
    public function providerWorkspace(){return $this->run('save',fn()=>GeoConnections::providerWorkspace($this->request->post(false)),true);}
    public function grant(){return $this->run('grant',fn()=>GeoConnections::grant(0,$this->adminId,$this->request->post(false)),true);}
    public function jobs(){return $this->run('jobs',fn()=>GeoAdminRecords::listing(0,null,true,$this->request->get())+['can_recover'=>$this->allowed('recover')]);}
    public function recover(){return $this->run('recover',fn()=>\app\common\service\merchant\geo\GeoVisibility::recover(0,$this->adminId,$this->request->post(false)),true);}
}
