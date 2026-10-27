<?php
declare(strict_types=1);
namespace app\api\controller;

use app\common\service\merchant\clip\MerchantClipService as Clip;
use app\common\service\merchant\clip\ClipCloudJobService as Cloud;
use app\common\service\merchant\clip\ClipVoiceProfileService as Voices;
use app\common\service\merchant\MerchantMaterialService as Material;
use app\common\service\merchant\AgentAdminService;
use app\common\service\app\AppAccessService;

final class MerchantClipController extends BaseApiController
{
    private function action(callable $work,bool $write=false)
    {
        try{
            if($response=AppAccessService::assertTenantCanUse((int)$this->request->tenantId,'smart_clip',$this->userId))return $response;
            if($write)AgentAdminService::assertWrite($this->request);elseif(!$this->request->isGet())throw new \InvalidArgumentException('请使用GET请求');
            return $this->data($work((int)$this->request->tenantId,$this->userId));
        }catch(\InvalidArgumentException $e){return $this->fail($e->getMessage());}
        catch(\Throwable $e){error_log('Merchant clip failed: '.$e->getMessage());return $this->fail('剪辑操作失败，请稍后重试');}
    }
    public function publicMusic(){return $this->action(fn($t)=>(new \app\common\service\merchant\clip\ClipPublicMusic())->search(\app\common\service\merchant\clip\ClipIntegrationService::resolve($t,'ims'),$this->request->get()));}
    public function musicPreview(){return $this->action(fn($t)=>(new \app\common\service\merchant\clip\ClipPublicMusic())->preview(\app\common\service\merchant\clip\ClipIntegrationService::resolve($t,'ims'),(string)$this->request->get('media_id','')));}
    public function capabilities(){return $this->action(fn($t,$u)=>Clip::capabilities($t)+['draft_scope'=>$t.':'.$u]);}
    public function draftAssets(){return $this->action(fn($t,$u)=>Clip::draftAssets($t,$u,$this->request->post(false)),true);}
    public function lists(){return $this->action(fn($t,$u)=>Clip::listing($t,$u,$this->request->get()));}
    public function detail(){return $this->action(fn($t,$u)=>Clip::detail($t,$u,(int)$this->request->get('id',0)));}
    public function save(){return $this->action(fn($t,$u)=>Clip::save($t,$u,$this->request->post(false)),true);}
    public function recycle(){return $this->action(function($t,$u){Clip::recycle($t,$u,$this->request->post());return [];},true);}
    public function library(){return $this->action(fn($t,$u)=>Material::listing($t,$u,$this->request->get()));}
    public function folders(){return $this->action(fn($t,$u)=>Material::folders($t,$u,$this->request->get()));}
    public function labels(){return $this->action(fn($t,$u)=>Material::labels($t,$u));}
    public function upload(){return $this->action(fn($t,$u)=>Material::upload($t,$u,$this->request),true);}
    public function plans(){return $this->action(fn($t,$u)=>Clip::plans($t,$u,(int)$this->request->get('project_id',0),$this->request->get('trash','')==='1'));}
    public function plan(){return $this->action(fn($t,$u)=>Clip::plan($t,$u,$this->request->post(false)),true);}
    public function removePlans(){return $this->action(function($t,$u){Clip::removePlans($t,$u,$this->request->post(false));return [];},true);}
    public function render(){return $this->action(fn($t,$u)=>Clip::render($t,$u,$this->request->post(false)),true);}
    public function cloudJobs(){return $this->action(fn($t,$u)=>Cloud::listing($t,$u,(int)$this->request->get('project_id',0)));}
    public function package(){return $this->action(fn($t,$u)=>Cloud::create($t,$u,'package',$this->request->post(false)),true);}
    public function voices(){return $this->action(fn($t,$u)=>Cloud::voices($t,$u));}
    public function voiceProfiles(){return $this->action(fn($t,$u)=>Voices::listing($t,$u));}
    public function uploadVoice(){return $this->action(fn($t,$u)=>Voices::upload($t,$u,$this->request),true);}
    public function refreshVoice(){return $this->action(fn($t,$u)=>(new Voices())->refresh($t,$u,(int)$this->request->post('id',0)),true);}
    public function renameVoice(){return $this->action(fn($t,$u)=>Voices::rename($t,$u,(int)$this->request->post('id',0),(string)$this->request->post('name','')),true);}
    public function script(){return $this->action(fn($t,$u)=>Cloud::create($t,$u,'script',$this->request->post(false)),true);}
    public function topics(){return $this->action(fn($t,$u)=>Cloud::create($t,$u,'topics',$this->request->post(false)),true);}
    public function voice(){return $this->action(fn($t,$u)=>Cloud::create($t,$u,($this->request->post('capability','tts')==='icl'?'clone_voice':'voice'),$this->request->post(false)),true);}
    public function transcribe(){return $this->action(fn($t,$u)=>Cloud::create($t,$u,'asr',$this->request->post(false)),true);}
    public function process(){return $this->action(fn($t,$u)=>Cloud::create($t,$u,'smart_process',$this->request->post(false)),true);}
    public function cloudTemplates(){return $this->action(fn($t)=>(new \app\common\service\merchant\clip\ClipCloudTemplates())->listing(\app\common\service\merchant\clip\ClipIntegrationService::resolve($t,'ims')));}
    public function renderTemplate(){return $this->action(fn($t,$u)=>Cloud::create($t,$u,'template_render',$this->request->post(false)),true);}
    public function recognizeImage(){return $this->action(fn($t,$u)=>Cloud::create($t,$u,$this->request->post('mode','labels')==='text'?'image_text':'image_labels',$this->request->post(false)),true);}
    public function applyLabels(){return $this->action(fn($t,$u)=>Cloud::applyLabels($t,$u,(int)$this->request->post('job_id',0)),true);}
    public function delivery(){return $this->action(fn($t,$u)=>(new Cloud())->delivery($t,$u,(int)$this->request->get('job_id',0),(int)$this->request->get('file_index',0)));}
}
