<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);$root=dirname(__DIR__);
if(!isset($app)){require $root.'/runtime-loader.php';$app=new \AigcRuntimeApp($root);$app->initialize();}
foreach(['/app/apps/aigc_geo/migrations/install.sql','/upgrade/20261016_merchant_geo.sql','/upgrade/20261017_geo_workspace.sql','/upgrade/20261017_geo_workflow.sql','/upgrade/20261017_geo_visibility.sql']as $sql)\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents($root.$sql),(string)config('database.connections.mysql.prefix'));
$file=$root.'/public/_nuxt/entry.ef871ac3.js';$s=file_get_contents($file);$marker='/* merchant-geo-route-v1 */';
$legacyRoute='{name:"merchant-geo",path:"/ai/geo",meta:{layout:"blank",auth:true},component:()=>import("/merchant/page.js?v=20261015").then(e=>e.default)}';
$route='{name:"merchant-geo",path:"/ai/geo",meta:{layout:"blank",auth:true},component:()=>ae(()=>import("/merchant/page.js?v=20261015"),["./useAiPcHomeDecorate.3ba8ddd2.css","./ImagineIcon.bcab7711.css","./el-dropdown.9cb36567.css","./el-popover.11b2087f.css","./el-popper.2c369f4c.css","./el-scrollbar.fef41773.css","./el-dialog.cbcead69.css"],import.meta.url).then(e=>e.default)}';
if(str_contains($s,$marker)){
    $s=str_replace($legacyRoute,$route,$s);
    if(!str_contains($s,$route))throw new RuntimeException('GEO shell style dependencies changed; review route adapter');
}else{$anchor='{name:(Zt==null?void 0:Zt.name)??"ai-assets"';if(substr_count($s,$anchor)!==1)throw new RuntimeException('Merchant route anchor changed');$s=str_replace($anchor,$marker.$route.','.$anchor,$s);}
file_put_contents($file,$s);
$file=$root.'/public/_nuxt/useAiPcHomeDecorate.d01e3f4e.js';$s=file_get_contents($file);
foreach(['i.id==="geo"','i.appCode==="aigc_geo"']as $condition){$pattern='/if\('.preg_quote($condition,'/').'\)\{ye\.msgWarning\([^)]*\);return\}/u';$s=preg_replace($pattern,'if('.$condition.'){be("/ai/geo");return}',$s);}
if(!str_contains($s,'if(i.id==="geo"){be("/ai/geo");return}'))throw new RuntimeException('GEO sidebar anchor changed');file_put_contents($file,$s);
$file=$root.'/public/pc/index.html';$s=preg_replace('#/merchant/(?:geo|geo-semi-loader)\.js\?v=[0-9-]+#','/merchant/geo-semi-loader.js?v=20261020-7',file_get_contents($file));if(!str_contains($s,'/merchant/geo-semi-loader.js'))$s=str_replace('</head>','<script src="/merchant/geo-semi-loader.js?v=20261020-7" defer></script></head>',$s);file_put_contents($file,$s);
require __DIR__.'/install-geo-capabilities.php';
require __DIR__.'/install-merchant-automation.php';
echo "Merchant GEO tables, route and sidebar installed. No AI provider or media order called.\n";
