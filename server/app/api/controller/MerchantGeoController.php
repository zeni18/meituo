<?php
declare(strict_types=1);
namespace app\api\controller;
use app\common\service\merchant\{MerchantGeoService as Geo,AgentAdminService};
use app\common\service\app\AppAccessService;
final class MerchantGeoController extends BaseApiController
{
    private function run(callable $fn,bool $write=false)
    {
        try {
            $tenant=(int)$this->request->tenantId;
            if ($r=AppAccessService::assertTenantCanUse($tenant,'merchant_marketing',$this->userId)) return $r;
            \app\common\service\merchant\geo\GeoBrandScope::bind($tenant,$this->userId,$this->request->get('brand_id'));
            if ($write) AgentAdminService::assertWrite($this->request);elseif (!$this->request->isGet()) throw new \InvalidArgumentException('请使用GET请求');
            return $this->data($fn($tenant,$this->userId))->header(['Cache-Control'=>'no-store']);
        }catch (\InvalidArgumentException $e) {return $this->fail($e->getMessage());}catch (\Throwable) {return $this->fail('GEO操作失败，请检查安装和服务状态');}
    }
    public function summary(){return $this->run(fn($t,$u)=>Geo::summary($t,$u));}
    public function profile(){return $this->run(fn($t,$u)=>Geo::profile($t,$u));}
    public function profileSave(){return $this->run(fn($t,$u)=>Geo::profileSave($t,$u,$this->request->post(false)),true);}
    public function lists(){return $this->run(fn($t,$u)=>Geo::lists($t,$u,$this->request->get()));}
    public function save(){return $this->run(fn($t,$u)=>Geo::save($t,$u,$this->request->post(false)),true);}
    public function templates(){return $this->run(fn($t,$u)=>Geo::templates($t,$u),true);}
    public function toPress(){return $this->run(fn($t,$u)=>Geo::toPress($t,$u,(int)$this->request->post('id')),true);}
    public function options(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoJobs::options($t,$u));}
    public function generate(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoJobs::enqueue($t,$u,$this->request->post(false)),true);}
    public function jobs(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoJobs::records($t,$u,$this->request->get()));}
    public function importResult(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoJobs::import($t,$u,(int)$this->request->post('id')),true);}
    public function questionImport(){return $this->run(fn($t,$u)=>Geo::questionImport($t,$u,$this->request->post(false)),true);}
    public function resources(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoWorkspace::resources($t,$u,$this->request->get()));}
    public function resourceSave(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoWorkspace::save($t,$u,$this->request->post(false)),true);}
    public function resourceRecycle(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoWorkspace::recycle($t,$u,$this->request->post(false)),true);}
    public function contentSave(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoWorkspace::contentSave($t,$u,$this->request->post(false)),true);}
    public function workspaceRecords(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoWorkspace::records($t,$u,$this->request->get()));}
    public function workspaceReport(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoWorkspace::report($t,$u));}
    public function dashboard(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoDashboard::view($t,$u,$this->request->get()));}
    public function importQuestions(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoWorkspace::importQuestions($t,$u,$this->request->post(false)),true);}
    public function generateBatch(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoJobs::batch($t,$u,$this->request->post(false)),true);}
    public function articleAgentSessions(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoArticleAgent::sessions($t,$u,$this->request->get()));}
    public function articleAgentView(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoArticleAgent::view($t,$u,(int)$this->request->get('id')));}
    public function articleAgentSend(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoArticleAgent::send($t,$u,$this->request->post(false)),true);}
    public function articleAgentSave(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoArticleAgent::save($t,$u,$this->request->post(false)),true);}
    public function studioGenerate(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoCreationStudio::generate($t,$u,$this->request->post(false)),true);}
    public function studioKeywords(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoCreationStudio::keywords($t,$u,$this->request->post(false)),true);}
    public function studioSaveTopics(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoCreationStudio::saveTopics($t,$u,$this->request->post(false)),true);}
    public function keywordLibrary(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoKeywordLibrary::view($t,$u,$this->request->get()));}
    public function keywordLibraryAdd(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoKeywordLibrary::add($t,$u,$this->request->post(false)),true);}
    public function keywordLibraryUpdate(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoKeywordLibrary::update($t,$u,$this->request->post(false)),true);}
    public function keywordLibrarySave(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoKeywordLibrary::saveLibrary($t,$u,$this->request->post(false)),true);}
    public function keywordManualPreview(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoKeywordLibrary::manualPreview($t,$u,$this->request->post(false)),true);}
    public function workflow(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoWorkflow::view($t,$u,$this->request->get()));}
    public function workflowAction(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoWorkflow::change($t,$u,$this->request->post(false)),true);}
    public function workflowGenerate(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoWorkflow::generate($t,$u,$this->request->post(false)),true);}
    public function visibilityOptions(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoVisibility::options($t,$u));}
    public function visibilityPreview(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoVisibility::preview($t,$u,(int)$this->request->get('project_id')));}
    public function visibilityStart(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoVisibility::enqueue($t,$u,$this->request->post(false)),true);}
    public function visibilityRecords(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoVisibility::records($t,$u,$this->request->get()));}
    public function visibilitySchedule(){return $this->run(fn($t,$u)=>\app\common\service\merchant\geo\GeoVisibility::schedule($t,$u,$this->request->post(false)),true);}
}
