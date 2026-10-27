<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents(dirname(__DIR__).'/upgrade/20261021_task_notification_receipts.sql'),(string)config('database.connections.mysql.prefix'));
echo "Notification receipt table installed. No messages sent.\n";
