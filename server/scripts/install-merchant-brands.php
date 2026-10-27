<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
use app\common\service\merchant\geo\GeoBrandScope;
use app\common\service\merchant\MerchantBrandService;
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents(dirname(__DIR__).'/upgrade/20261017_merchant_brands.sql'),(string)config('database.connections.mysql.prefix'));
$prefix=(string)config('database.connections.mysql.prefix');
$brandTable=$prefix.'oem_merchant_brand';
if(!in_array('cover_file_id',array_column(Db::query('SHOW COLUMNS FROM `'.$brandTable.'`'),'Field'),true))Db::execute('ALTER TABLE `'.$brandTable.'` ADD `cover_file_id` bigint unsigned NOT NULL DEFAULT 0 AFTER `logo_file_id`');
foreach(GeoBrandScope::ROOTS as $table){$name=$prefix.$table;$columns=Db::query('SHOW COLUMNS FROM `'.$name.'`');if(!in_array('brand_id',array_column($columns,'Field'),true))Db::execute('ALTER TABLE `'.$name.'` ADD `brand_id` bigint unsigned NOT NULL DEFAULT 0, ADD INDEX `brand_owner` (`tenant_id`,`user_id`,`brand_id`)');}
foreach(Db::name('oem_merchant')->where('status',1)->field('tenant_id,user_id')->select()->toArray()as $r)MerchantBrandService::migrateOwner((int)$r['tenant_id'],(int)$r['user_id']);
echo "Brand schema and default-brand ownership installed; historical IDs retained.\n";
