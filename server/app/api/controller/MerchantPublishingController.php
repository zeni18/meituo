<?php
declare(strict_types=1);
namespace app\api\controller;
use app\common\service\merchant\{MerchantFilmService as Film,MerchantPublishService as Publish,AgentAdminService};
use app\common\service\app\AppAccessService;
final class MerchantPublishingController extends BaseApiController
{
    private function action(callable $fn,bool $write=false){try{if($r=AppAccessService::assertTenantCanUse((int)$this->request->tenantId,'merchant_marketing',$this->userId))return $r;if($write)AgentAdminService::assertWrite($this->request);elseif(!$this->request->isGet())throw new \InvalidArgumentException('请使用GET请求');return $this->data($fn((int)$this->request->tenantId,$this->userId));}catch(\InvalidArgumentException $e){return $this->fail($e->getMessage());}catch(\Throwable $e){error_log('Merchant publishing: '.$e->getMessage());return $this->fail('任务或成片服务暂不可用');}}
    public function libraries(){return $this->action(fn($t,$u)=>Film::libraries($t,$u,$this->request->get()));}
    public function catalogs(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantFinishedCatalogService::listing($t,$u,$this->request->get()));}
    public function catalogSave(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantFinishedCatalogService::save($t,$u,$this->request->post(false)),true);}
    public function catalogRecycle(){return $this->action(function($t,$u){\app\common\service\merchant\MerchantFinishedCatalogService::recycle($t,$u,$this->request->post(false));return [];},true);}
    public function librarySave(){return $this->action(fn($t,$u)=>Film::saveLibrary($t,$u,$this->request->post(false)),true);}
    public function libraryRecycle(){return $this->action(function($t,$u){Film::recycleLibrary($t,$u,$this->request->post());return [];},true);}
    public function films(){return $this->action(fn($t,$u)=>Film::listing($t,$u,$this->request->get()));}
    public function move(){return $this->action(function($t,$u){Film::move($t,$u,$this->request->post(false));return [];},true);}
    public function intent(){return $this->action(fn($t,$u)=>Film::intent($t,$u,$this->request->post(false)),true);}
    public function destination(){return $this->action(fn($t,$u)=>Film::bind($t,$u,$this->request->post(false)),true);}
    public function delivery(){return $this->action(fn($t,$u)=>Film::delivery($t,$u,(string)$this->request->get('ref','')));}
    public function staff(){return $this->action(fn($t,$u)=>Publish::staff($t,$u,$this->request->get()));}
    public function tasks(){return $this->action(fn($t,$u)=>Publish::listing($t,$u,$this->request->get()));}
    public function create(){return $this->action(fn($t,$u)=>Publish::create($t,$u,$this->request->post(false)),true);}
    public function detail(){return $this->action(fn($t,$u)=>Publish::detail($t,$u,$this->request->get()));}
    public function cancel(){return $this->action(function($t,$u){Publish::cancel($t,$u,$this->request->post());return [];},true);}
    public function review(){return $this->action(function($t,$u){Publish::review($t,$u,$this->request->post(false));return [];},true);}
    public function invite(){return $this->action(fn($t,$u)=>Publish::invite($t,$u,$this->request->post()),true);}
    public function retryNotice(){return $this->action(function($t,$u){\app\common\service\merchant\TaskNotificationService::retry($t,$u,$this->request->post());return [];},true);}
}
