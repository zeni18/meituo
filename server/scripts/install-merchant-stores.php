<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require_once dirname(__DIR__).'/runtime-loader.php';
$storeApp=new \AigcRuntimeApp(dirname(__DIR__));$storeApp->initialize();
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents(dirname(__DIR__).'/upgrade/20261016_merchant_store_directory.sql'),(string)config('database.connections.mysql.prefix'));
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents(dirname(__DIR__).'/upgrade/20261016_store_decoration_designer.sql'),(string)config('database.connections.mysql.prefix'));
echo "Merchant store directory migration installed.\n";
