<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents(dirname(__DIR__).'/upgrade/20261016_merchant_clip_studio.sql'),(string)config('database.connections.mysql.prefix'));
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents(dirname(__DIR__).'/upgrade/20261020_clip_personal_voice.sql'),(string)config('database.connections.mysql.prefix'));
echo "Merchant clip studio schema ready. No cloud service enabled and no paid API called.\n";
