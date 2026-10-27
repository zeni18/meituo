<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$root=dirname(__DIR__);
require $root.'/runtime-loader.php';
$app=new \AigcRuntimeApp($root);$app->initialize();
use think\facade\Db;
use app\common\service\database\SqlMigrationExecutor;
use app\common\service\merchant\OemMenuService;
use app\common\service\merchant\MerchantAccountTables;
SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261015_oem_merchants.sql'),(string)config('database.connections.mysql.prefix'));
SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261015_oem_agent_accounts.sql'),(string)config('database.connections.mysql.prefix'));
SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261015_platform_agents.sql'),(string)config('database.connections.mysql.prefix'));
SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261015_agent_operations.sql'),(string)config('database.connections.mysql.prefix'));
SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261015_merchant_workspace.sql'),(string)config('database.connections.mysql.prefix'));
SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261016_merchant_store_directory.sql'),(string)config('database.connections.mysql.prefix'));
SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261016_store_decoration_designer.sql'),(string)config('database.connections.mysql.prefix'));
SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261015_merchant_material_library.sql'),(string)config('database.connections.mysql.prefix'));
SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261016_merchant_clip_studio.sql'),(string)config('database.connections.mysql.prefix'));
SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261016_clip_integration.sql'),(string)config('database.connections.mysql.prefix'));
SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261016_clip_cloud_jobs.sql'),(string)config('database.connections.mysql.prefix'));
SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261016_merchant_publishing.sql'),(string)config('database.connections.mysql.prefix'));
$tenants=Db::name('tenant')->whereNull('delete_time')->select()->toArray();
foreach($tenants as $tenant){
 OemMenuService::sync($tenant);
 if((int)$tenant['tactics']===1){
  foreach(Db::name(MerchantAccountTables::name((int)$tenant['id'],'user'))->where('tenant_id',$tenant['id'])->whereNull('delete_time')->select()->toArray() as $owner){
   if(Db::name('oem_merchant')->where('tenant_id',$tenant['id'])->where('user_id',$owner['id'])->find())continue;
   Db::name('oem_merchant')->insert(['tenant_id'=>$tenant['id'],'user_id'=>$owner['id'],'name'=>mb_substr($owner['nickname']?:($owner['account']?:'商家 '.$owner['id']),0,80),'contact'=>mb_substr($owner['real_name'],0,50),'mobile'=>$owner['mobile'],'status'=>(int)$owner['is_disable']===1?0:1,'create_time'=>$owner['create_time'],'update_time'=>time()]);
  }
 }
}
require __DIR__.'/install-merchant-routes.php';
require __DIR__.'/install-merchant-account-header.php';
require __DIR__.'/install-film-generation.php';
require __DIR__.'/install-added-page-selects.php';
require __DIR__.'/install-clip-entrypoints.php';
require __DIR__.'/install-clip-integration.php';
require __DIR__.'/install-haipress.php';
require __DIR__.'/install-merchant-geo.php';
echo 'OEM migration complete; existing AI owner IDs preserved. Merchants: '.Db::name('oem_merchant')->count()."\n";
