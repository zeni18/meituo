<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') exit(1);
$root=dirname(__DIR__);
if (!isset($app)) {require $root.'/runtime-loader.php';$app=new \AigcRuntimeApp($root);$app->initialize();}
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents($root.'/upgrade/20261016_haipress.sql'),(string)config('database.connections.mysql.prefix'));
require $root.'/scripts/install-press-resource-sync.php';
$pressFields=\think\facade\Db::name('press_order')->getFields();
foreach (['process_flag'=>'tinyint NOT NULL DEFAULT 0','process_note'=>"varchar(1000) NOT NULL DEFAULT ''",'process_attempted'=>'tinyint NOT NULL DEFAULT 0','process_state'=>"varchar(24) NOT NULL DEFAULT ''"] as $field=>$definition) {
    if (!isset($pressFields[$field])) \think\facade\Db::execute('ALTER TABLE `'.config('database.connections.mysql.prefix').'press_order` ADD COLUMN `'.$field.'` '.$definition);
}
\app\common\service\press\PressMenus::sync();
foreach (['admin/assets/index-CDJMKisd.js','platform/assets/index-CCFvd1qL.js'] as $entry) {
    $path=$root.'/public/'.$entry;$script=file_get_contents($path);$anchor='"/src/views/account/login.vue":';
    foreach (['orders','usage','config'] as $view) {
        if ($view==='config' && str_starts_with($entry,'admin/')) continue;
        $key='"/src/views/media/press/'.$view.'.vue":';
        if (!str_contains($script,$key)) {if (substr_count($script,$anchor)!==1) throw new RuntimeException('Admin route anchor changed: '.$entry);$script=str_replace($anchor,$key.'()=>import("/press/page.js?v=20261016-1"),'.$anchor,$script);}
    }
    file_put_contents($path,$script);
}
$path=$root.'/public/_nuxt/entry.ef871ac3.js';$script=file_get_contents($path);$marker='/* haipress-merchant-route-v1 */';
if (!str_contains($script,$marker)) {
    $anchor='{name:(Zt==null?void 0:Zt.name)??"ai-assets"';if (substr_count($script,$anchor)!==1) throw new RuntimeException('Merchant route anchor changed');
    $route=$marker.'{name:"merchant-haipress",path:"/ai/media-press",meta:{layout:"blank",auth:true},component:()=>import("/merchant/page.js?v=20261015").then(e=>e.default)},';
    file_put_contents($path,str_replace($anchor,$route.$anchor,$script));
}
foreach (['admin/index.html','platform/index.html','pc/index.html'] as $entry) {
    $path=$root.'/public/'.$entry;$html=preg_replace('#/press/portal\.js\?v=[0-9-]+#','/press/portal.js?v=20261019-1',file_get_contents($path));
    if (!str_contains($html,'/press/portal.js')) $html=str_replace('</head>','<script src="/press/portal.js?v=20261019-1" defer></script></head>',$html);
    file_put_contents($path,$html);
}
echo "Haipress tables, menus and routes installed. Provider remains disabled without platform credentials. No external request performed.\n";
