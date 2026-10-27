<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);$root=dirname(__DIR__);if(!isset($app)){require $root.'/runtime-loader.php';$app=new \AigcRuntimeApp($root);$app->initialize();}
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261017_geo_capabilities.sql'),(string)config('database.connections.mysql.prefix'));
\app\common\service\merchant\geo\GeoMenus::sync();
\app\common\service\merchant\geo\GeoMarketCatalog::install();
\app\common\service\merchant\geo\GeoTextRuntime::install();
foreach(['admin/assets/index-CDJMKisd.js','platform/assets/index-CCFvd1qL.js']as $entry){$path=$root.'/public/'.$entry;$s=file_get_contents($path);foreach(['config','jobs']as $page){$key='"/src/views/geo/'.$page.'.vue":';if(!str_contains($s,$key)){$anchor='"/src/views/account/login.vue":';if(substr_count($s,$anchor)!==1)throw new RuntimeException('Admin route anchor changed');$s=str_replace($anchor,$key.'()=>import("/merchant/geo-admin-page.js?v=20261017-1"),'.$anchor,$s);}}file_put_contents($path,$s);}
foreach(['admin/index.html','platform/index.html']as $entry){$path=$root.'/public/'.$entry;$s=preg_replace('#/merchant/geo-admin\.js\?v=[0-9-]+#','/merchant/geo-admin.js?v=20261019-4',file_get_contents($path));if(!str_contains($s,'/merchant/geo-admin.js'))$s=str_replace('</head>','<script src="/merchant/geo-admin.js?v=20261019-4" defer></script></head>',$s);if($entry==='admin/index.html')$s=preg_replace('#/oem/unified-admin\.js(?:\?v=[0-9-]+)?#','/oem/unified-admin.js?v=20261019-1',$s);file_put_contents($path,$s);}
echo "Independent GEO capabilities installed. Local search SKU defaults off; no grants, keys or paid calls.\n";
