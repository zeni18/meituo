<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\app\AppRegistryService as Registry;
use app\common\service\app\AppAccessService as Access;
use app\common\service\app\AppDisplayConfigService as Display;
use app\common\service\app\AppPlanService as Plans;
use app\common\service\app\DefaultAppService;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Only the isolated local preview database is allowed');
$tenant=1;$report=['installed'=>[],'enabled'=>[],'blocked'=>[],'generated_ai_calls'=>0];
foreach(glob(dirname(__DIR__).'/app/apps/*/manifest.json') as $file){
 $manifest=json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);$code=$manifest['code'];
 if(!in_array('pc',(array)($manifest['frontends'] ?? []),true))continue;
 if(!Db::name('app')->where(['code'=>$code,'status'=>'installed'])->find()){
  Registry::installFromLocal($code,(string)config('project.version'));$report['installed'][]=$code;
 }
 if(DefaultAppService::isDefaultApp($code))DefaultAppService::ensureTenantDefaultApp($tenant,$code);
 else{
  $current=Db::name('tenant_app')->where(['tenant_id'=>$tenant,'app_code'=>$code])->find();
  if(!$current || ((int)$current['expire_time']>0 && (int)$current['expire_time']<=time())){
   $plan=Db::name('app_plan')->where(['app_code'=>$code,'status'=>1])->where('open_points',0)->where('renew_points',0)->order('id asc')->find();
   if(!$plan){
    // An existing paid catalog is never silently repriced or purchased.
    if(Db::name('app_plan')->where('app_code',$code)->count()){$report['blocked'][]=$code;continue;}
    $planId=(int)Db::name('app_plan')->insertGetId(['app_code'=>$code,'name'=>'本地体验套餐','duration_months'=>12,'open_points'=>'0.00','renew_points'=>'0.00','status'=>1,'sort'=>0,'create_time'=>time(),'update_time'=>time()]);
   }else $planId=(int)$plan['id'];
   Plans::openOrRenew($tenant,0,$code,$planId);
  }
 }
 Db::name('tenant_app')->where(['tenant_id'=>$tenant,'app_code'=>$code])->update(['enable_status'=>'enabled','shelf_status'=>'on','update_time'=>time()]);
 Db::name('app_frontend_entry')->where('app_code',$code)->where('terminal','pc')->update(['status'=>1,'update_time'=>time()]);
 $display=Display::detail($tenant,$code);$display['status']=1;Display::save($tenant,$code,$display);
 $report['enabled'][]=$code;
}
$report['available_codes']=Access::enabledTenantAppCodes($tenant);
file_put_contents(dirname(__DIR__).'/runtime/local/app-activation-report.json',json_encode($report,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
echo json_encode($report,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)."\n";
