<?php
declare(strict_types=1);
namespace app\api\controller;
use app\common\service\merchant\AgentAdminService;
use app\common\service\app\AppAccessService;
use app\common\service\press\PressService;

final class MediaPressController extends BaseApiController
{
    private function run(callable $fn,bool $write=false,bool $openCase=false)
    {
        try {
            $tenant=(int)$this->request->tenantId;
            if ($r=AppAccessService::assertTenantCanUse($tenant,'merchant_marketing',$this->userId)) return $r;
            \app\common\service\merchant\geo\GeoBrandScope::bind($tenant,$this->userId,$this->request->get('brand_id'));
            if ($write) AgentAdminService::assertWrite($this->request); elseif (!$this->request->isGet()) throw new \InvalidArgumentException('请使用GET请求');
            $result=$fn($tenant,$this->userId);
            return ($openCase?redirect($result):$this->data($result))->header(['Cache-Control'=>'no-store','Referrer-Policy'=>'no-referrer']);
        } catch (\InvalidArgumentException $e) {return $openCase?$this->caseFailure($e->getMessage()):$this->fail($e->getMessage());}catch (\Throwable) {return $openCase?$this->caseFailure('暂时无法打开案例，请返回媒体列表后重试。'):$this->fail('媒体发稿操作失败，请稍后重试');}
    }
    private function caseFailure(string $message)
    {
        return response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>案例暂不可用</title><body><main><h1>案例暂不可用</h1><p>'.htmlspecialchars($message,ENT_QUOTES,'UTF-8').'</p><p>您可以关闭此标签页，继续浏览媒体列表。</p></main></body></html>',422)->header(['Content-Type'=>'text/html; charset=utf-8','Cache-Control'=>'no-store','Referrer-Policy'=>'no-referrer','X-Content-Type-Options'=>'nosniff']);
    }
    public function caseOpen(){return $this->run(fn($t,$u)=>\app\common\service\press\PressMediaDirectory::caseUrl($t,$u,(int)$this->request->get('media_id')),false,true);}
    public function media(){return $this->run(fn($t,$u)=>\app\common\service\press\PressMediaDirectory::listing($t,$u,$this->request->get()));}
    public function mediaOptions(){return $this->run(fn($t,$u)=>\app\common\service\press\PressMediaDirectory::options($t,$u,$this->request->get()));}
    public function favorite(){return $this->run(fn($t,$u)=>\app\common\service\press\PressMediaDirectory::favorite($t,$u,$this->request->post(false)),true);}
    public function drafts(){return $this->run(fn($t,$u)=>PressService::drafts($t,$u));}
    public function draftSave(){return $this->run(fn($t,$u)=>PressService::draftSave($t,$u,$this->request->post(false)),true);}
    public function quote(){return $this->run(fn($t,$u)=>PressService::quote($t,$u,$this->request->post(false)),true);}
    public function create(){return $this->run(fn($t,$u)=>PressService::create($t,$u,$this->request->post(false)),true);}
    public function process(){return $this->run(fn($t,$u)=>PressService::process($t,$u,$this->request->post(false)),true);}
    public function orders(){return $this->run(fn($t,$u)=>PressService::orders($t,$u,null,false,$this->request->get()));}
    public function detail(){return $this->run(fn($t,$u)=>PressService::detail($t,$u,null,false,(int)$this->request->get('id')));}
    public function export(){return $this->run(fn($t,$u)=>PressService::export($t,$u,null,false,$this->request->get()));}
}
