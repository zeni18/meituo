<?php
declare(strict_types=1);
namespace app\platformapi\service;

use think\facade\Db;
use app\platformapi\logic\tenant\TenantLogic;
use app\platformapi\logic\tenant\TenantAdminLogic;
use app\platformapi\logic\tenant\TenantSystemMenuLogic;
use app\platformapi\logic\setting\pay\PayConfigLogic;
use app\platformapi\logic\setting\pay\PayWayLogic;
use app\common\model\dept\TenantDept;
use app\common\service\app\DefaultAppService;
use app\common\service\billing\PackageProvisionService;
use app\common\service\merchant\OemMenuService;
use app\tenantapi\logic\article\ArticleLogic;
use app\tenantapi\logic\decorate\DecorateDataLogic;
use app\tenantapi\logic\notice\NoticeLogic;

/** One provisioning path for the original OEM form and platform agent list. */
final class TenantProvisionService
{
    public static function create(array $params): array
    {
        return Db::transaction(function()use($params){
            $tenant=TenantLogic::add($params);
            $split=(string)($params['tactics']??0)==='1';
            if($split){
                (new TenantCreatService())->createTenantTable($tenant['sn']);
                (new TenantCreatService())->initializationTenantData($tenant['id'],$tenant['sn'],$params);
            }else{
                ArticleLogic::initialization($tenant['id']);
                $manager=TenantAdminLogic::initialization($tenant['id'],$tenant['sn'],$params);
                TenantDept::initialization($tenant['id'],$manager['id']);
                TenantSystemMenuLogic::initialization($tenant['id']);
                PayConfigLogic::initialization($tenant['id']);
                PayWayLogic::initialization($tenant['id']);
                NoticeLogic::initialization($tenant['id']);
                DecorateDataLogic::initialization($tenant['id']);
            }
            DefaultAppService::syncTenantDefaults((int)$tenant['id'],(string)$tenant['sn'],$split);
            PackageProvisionService::syncTenant((int)$tenant['id'],(string)$tenant['sn'],$split);
            TenantLogic::syncCustomStorageMenu((int)$tenant['id'],(int)($params['allow_custom_storage']??0)===1);
            OemMenuService::sync($tenant->toArray());
            return $tenant->toArray();
        });
    }
}
