<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);$root=dirname(__DIR__);
if(!isset($app)){require $root.'/runtime-loader.php';$app=new \AigcRuntimeApp($root);$app->initialize();}
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261019_merchant_automation.sql'),(string)config('database.connections.mysql.prefix'));
$path=$root.'/public/_nuxt/entry.ef871ac3.js';$source=file_get_contents($path);
$legacyRoute='{name:"merchant-automation",path:"/ai/automation",meta:{layout:"blank",auth:true},component:()=>import("/merchant/page.js?v=20261015").then(e=>e.default)}';
$route='{name:"merchant-automation",path:"/ai/automation",meta:{layout:"blank",auth:true},component:()=>ae(()=>import("/merchant/page.js?v=20261015"),["./useAiPcHomeDecorate.3ba8ddd2.css","./ImagineIcon.bcab7711.css","./el-dropdown.9cb36567.css","./el-popover.11b2087f.css","./el-popper.2c369f4c.css","./el-scrollbar.fef41773.css","./el-dialog.cbcead69.css"],import.meta.url).then(e=>e.default)}';
if(!str_contains($source,'/* merchant-automation-route-v1 */')){
    $anchor='/* merchant-geo-route-v1 */';if(substr_count($source,$anchor)!==1)throw new RuntimeException('GEO route anchor changed');
    $source=str_replace($anchor,'/* merchant-automation-route-v1 */'.$route.','.$anchor,$source);
}else{$source=str_replace($legacyRoute,$route,$source);if(!str_contains($source,$route))throw new RuntimeException('Automation shell style dependencies changed; review route adapter');}
file_put_contents($path,$source);
echo "Automation tables and independent route installed; no paid tasks started.\n";
