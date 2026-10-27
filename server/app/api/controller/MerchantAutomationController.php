<?php
declare(strict_types=1);
namespace app\api\controller;
use app\common\service\merchant\{AutomationService as Automation,AgentAdminService};
final class MerchantAutomationController extends BaseApiController
{
    private function run(callable $fn,bool $write=false)
    {
        try{if($write)AgentAdminService::assertWrite($this->request);elseif(!$this->request->isGet())throw new \InvalidArgumentException('请使用GET请求');
            return $this->data($fn((int)$this->request->tenantId,$this->userId))->header(['Cache-Control'=>'no-store']);
        }catch(\InvalidArgumentException $e){return $this->fail($e->getMessage());}catch(\Throwable $e){error_log('Automation API: '.$e->getMessage());return $this->fail('自动化服务暂不可用，请检查安装与服务状态');}
    }
    public function options(){return $this->run(fn($t,$u)=>Automation::options($t,$u));}
    public function lists(){return $this->run(fn($t,$u)=>Automation::listing($t,$u));}
    public function media(){return $this->run(fn($t,$u)=>Automation::media($t,$u,$this->request->get()));}
    public function preflight(){return $this->run(fn($t,$u)=>Automation::preflight($t,$u,(int)$this->request->get('id')));}
    public function records(){return $this->run(fn($t,$u)=>Automation::records($t,$u,(int)$this->request->get('id')));}
    public function save(){return $this->run(fn($t,$u)=>Automation::save($t,$u,$this->request->post(false)),true);}
    public function change(){return $this->run(fn($t,$u)=>Automation::change($t,$u,$this->request->post(false)),true);}
}
