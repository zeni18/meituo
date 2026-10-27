<?php
declare(strict_types=1);
namespace app\api\controller;

use app\common\service\merchant\MerchantWorkspaceService as Workspace;
use app\common\service\merchant\AgentAdminService;
use app\common\service\app\AppAccessService;

final class MerchantWorkspaceController extends BaseApiController
{
    private function action(callable $work,bool $write=false)
    {
        try{
            if($response=AppAccessService::assertTenantCanUse((int)$this->request->tenantId,'merchant_marketing',$this->userId))return $response;
            if($write)AgentAdminService::assertWrite($this->request);elseif(!$this->request->isGet())throw new \InvalidArgumentException('请使用 GET 请求');
            $brand=$this->request->get('brand_id');$store=(int)$this->request->param('store_id',0);
            if($brand!==null&&$store>0){$ownerBrand=\app\common\service\merchant\MerchantBrandService::owned((int)$this->request->tenantId,$this->userId,(int)$brand);if(!\think\facade\Db::name('oem_brand_store')->where(['tenant_id'=>(int)$this->request->tenantId,'user_id'=>$this->userId,'store_id'=>$store,'brand_id'=>$ownerBrand['id']])->find())throw new \InvalidArgumentException('门店不属于当前品牌');}
            return $this->data($work((int)$this->request->tenantId,$this->userId));
        }catch(\InvalidArgumentException $e){return $this->fail($e->getMessage());}
        catch(\Throwable $e){error_log('Merchant workspace failed: '.$e->getMessage());return $this->fail('操作失败，请稍后重试');}
    }
    public function lists(){return $this->action(fn($t,$u)=>Workspace::listing($t,$u,(string)$this->request->get('directory','store'),$this->request->get()));}
    public function choices(){return $this->action(fn($t,$u)=>Workspace::choices($t,$u,(string)$this->request->get('kind','store'),(string)$this->request->get('keyword','')));}
    public function save(){return $this->action(function($t,$u){$p=$this->request->post(false);return \think\facade\Db::transaction(function()use($t,$u,$p){$kind=(string)($p['directory']??'');$id=Workspace::save($t,$u,$kind,$p);if($kind==='store')\app\common\service\merchant\MerchantBrandService::assignDefaultStore($t,$u,$id);return ['id'=>$id];});},true);}
    public function recycle(){return $this->action(function($t,$u){$p=$this->request->post();Workspace::recycle($t,$u,(string)($p['directory']??''),(int)($p['id']??0),($p['restore']??'')==='1');return [];},true);}
    public function materialCounts(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantMaterialService::counts($t,$u));}
    public function materialMeta(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantMaterialService::metadata($t,$u,$this->request->get()));}
    public function workbench(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantWorkbenchService::summary($t,$u));}
    public function library(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantMaterialService::listing($t,$u,$this->request->get()));}
    public function articleLibrary(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantArticleLibraryService::listing($t,$u,$this->request->get()));}
    public function folders(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantMaterialService::folders($t,$u,$this->request->get()));}
    public function folderSave(){return $this->action(fn($t,$u)=>['id'=>\app\common\service\merchant\MerchantMaterialService::saveFolder($t,$u,$this->request->post(false))],true);}
    public function folderReorder(){return $this->action(function($t,$u){\app\common\service\merchant\MerchantMaterialService::reorderFolders($t,$u,$this->request->post(false));return [];},true);}
    public function folderRecycle(){return $this->action(function($t,$u){\app\common\service\merchant\MerchantMaterialService::recycleFolder($t,$u,$this->request->post());return [];},true);}
    public function labels(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantMaterialService::labels($t,$u));}
    public function labelSave(){return $this->action(fn($t,$u)=>['id'=>\app\common\service\merchant\MerchantMaterialService::saveLabel($t,$u,$this->request->post(false))],true);}
    public function labelRemove(){return $this->action(function($t,$u){\app\common\service\merchant\MerchantMaterialService::removeLabel($t,$u,(int)$this->request->post('id',0));return [];},true);}
    public function materialSave(){return $this->action(fn($t,$u)=>['id'=>\app\common\service\merchant\MerchantMaterialService::save($t,$u,$this->request->post(false))],true);}
    public function batch(){return $this->action(function($t,$u){\app\common\service\merchant\MerchantMaterialService::batch($t,$u,$this->request->post(false));return [];},true);}
    public function upload(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantMaterialService::upload($t,$u,$this->request),true);}
    public function brandLists(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantBrandService::listing($t,$u,$this->request->get()));}
    public function brandChoices(){return $this->action(fn($t,$u)=>['lists'=>\app\common\service\merchant\MerchantBrandService::choices($t,$u)]);}
    public function brandDetail(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantBrandService::detail($t,$u,$this->request->get()));}
    public function brandSave(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantBrandService::save($t,$u,$this->request->post(false)),true);}
    public function brandKnowledgeSave(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantBrandService::knowledgeSave($t,$u,$this->request->post(false)),true);}
    public function brandRecycle(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantBrandService::recycle($t,$u,$this->request->post(false)),true);}
    public function storeLists(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantStoreService::listing($t,$u,$this->request->get()));}
    public function storeSave(){return $this->action(fn($t,$u)=>['id'=>\app\common\service\merchant\MerchantStoreService::save($t,$u,$this->request->post(false))],true);}
    public function storeBatch(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantStoreService::createMany($t,$u,$this->request->post(false)),true);}
    public function storeImport(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantStoreService::importPreview($this->request->file('file')),true);}
    public function storeLogo(){return $this->action(function($t,$u){
        $file=$this->request->file('file');if(!$file||$file->getSize()>5*1024*1024||$this->request->post('kind')!=='image'||$this->request->post('attach_only')!=='1')throw new \InvalidArgumentException('请上传不超过5MB的门店图片');
        return \app\common\service\merchant\MerchantMaterialService::upload($t,$u,$this->request);
    },true);}
    public function storeStaff(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantStoreService::staff($t,$u,$this->request->get()));}
    public function storeStaffSave(){return $this->action(fn($t,$u)=>['id'=>\app\common\service\merchant\MerchantStoreService::saveStaff($t,$u,$this->request->post(false))],true);}
    public function storeStaffBatch(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantStoreService::createStaffMany($t,$u,$this->request->post(false)),true);}
    public function storeStaffRecycle(){return $this->action(function($t,$u){\app\common\service\merchant\MerchantStoreService::recycleStaff($t,$u,$this->request->post(false));return [];},true);}
    public function storeDecoration(){return $this->action(function($t,$u){\app\common\service\merchant\MerchantStoreService::saveDecoration($t,$u,$this->request->post(false));return [];},true);}
    public function storeRequest(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantStoreRequestService::submit($t,$u,$this->request->post(false)),true);}
    public function storeRequests(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantStoreRequestService::history($t,$u,$this->request->get()));}
    public function storeRequestCancel(){return $this->action(function($t,$u){\app\common\service\merchant\MerchantStoreRequestService::cancel($t,$u,$this->request->post(false));return [];},true);}
    public function storeDesign(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantStoreDesignService::load($t,$u,$this->request->get()));}
    public function storeDesignSave(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantStoreDesignService::save($t,$u,$this->request->post(false)),true);}
    public function storeDesignTemplates(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantStoreDesignService::templates($t,$u,$this->request->get()));}
    public function storeDesignTemplate(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantStoreDesignService::template($t,$u,$this->request->get()));}
    public function storeDesignTemplateSave(){return $this->action(fn($t,$u)=>\app\common\service\merchant\MerchantStoreDesignService::saveTemplate($t,$u,$this->request->post(false)),true);}
    public function storeDesignTemplateRecycle(){return $this->action(function($t,$u){\app\common\service\merchant\MerchantStoreDesignService::recycleTemplate($t,$u,$this->request->post(false));return [];},true);}
}
