<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
$root=dirname(__DIR__);if(!isset($app)){require $root.'/runtime-loader.php';$app=new \AigcRuntimeApp($root);$app->initialize();}
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261016_clip_integration.sql'),(string)config('database.connections.mysql.prefix'));
\app\common\service\merchant\clip\ClipIntegrationMenus::syncPlatform();
foreach(\think\facade\Db::name('tenant')->whereNull('delete_time')->select()->toArray() as $tenant)\app\common\service\merchant\clip\ClipIntegrationMenus::syncOem($tenant);
foreach(['admin/assets/index-CDJMKisd.js','platform/assets/index-CCFvd1qL.js'] as $entry){
 $path=$root.'/public/'.$entry;$script=file_get_contents($path);$key='"/src/views/integration/config.vue":';
 if(!str_contains($script,$key)){$anchor='"/src/views/account/login.vue":';if(substr_count($script,$anchor)!==1)throw new RuntimeException('Admin route anchor changed: '.$entry);$script=str_replace($anchor,$key.'()=>import("/integration/page.js?v=20261016-1"),'.$anchor,$script);file_put_contents($path,$script);}
}
foreach(['admin/index.html','platform/index.html'] as $entry){
 $path=$root.'/public/'.$entry;$html=preg_replace('#/integration/config\.js\?v=[0-9-]+#','/integration/config.js?v=20261019-5',file_get_contents($path));
 if(!str_contains($html,'/integration/config.js'))$html=str_replace('</head>','<script src="/integration/config.js?v=20261019-5" defer></script></head>',$html);
 $html=preg_replace('#/integration/press\.js\?v=[0-9-]+#','/integration/press.js?v=20261019-5',$html);
 if(!str_contains($html,'/integration/press.js'))$html=str_replace('<script src="/integration/config.js','<script src="/integration/press.js?v=20261019-5" defer></script><script src="/integration/config.js',$html);
 file_put_contents($path,$html);
}
echo "Clip integration schema, menus and blank component installed. Existing OEMs have no borrowing grant by default.\n";
