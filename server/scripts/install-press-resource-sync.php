<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$root = dirname(__DIR__);
if (!isset($app)) { require $root.'/runtime-loader.php'; $app = new \AigcRuntimeApp($root); $app->initialize(); }
$prefix = (string)config('database.connections.mysql.prefix');
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261019_press_resource_sync.sql'), $prefix);
$fields = \think\facade\Db::name('press_media')->getFields();
foreach (['sync_batch'=>"char(32) NOT NULL DEFAULT ''", 'details_json'=>'mediumtext NULL'] as $field=>$definition) {
    if (!isset($fields[$field])) \think\facade\Db::execute('ALTER TABLE `'.$prefix.'press_media` ADD COLUMN `'.$field.'` '.$definition);
}
echo "Resource sync schema ready. Existing credentials, orders and resources preserved. No external request.\n";
