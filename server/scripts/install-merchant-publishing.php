<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require_once dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents(dirname(__DIR__).'/upgrade/20261016_merchant_publishing.sql'),(string)config('database.connections.mysql.prefix'));
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents(dirname(__DIR__).'/upgrade/20261016_finished_catalog.sql'),(string)config('database.connections.mysql.prefix'));
require __DIR__.'/install-merchant-routes.php';
require __DIR__.'/install-film-generation.php';
echo "Merchant publishing installed.\n";
