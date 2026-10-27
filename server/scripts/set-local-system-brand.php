<?php
/** Update the isolated preview's product name; never changes accounts or customer brand facts. */
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/runtime-loader.php';
$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
use think\facade\Db;
if(config('database.connections.mysql.database')!=='aigc_local'||(int)config('database.connections.mysql.hostport')!==3307)throw new RuntimeException('Dedicated local database required');
$name='美拓AI营销中台';
$entries=['config'=>['platform'=>['name'=>$name],'website'=>['name'=>$name,'shop_name'=>$name,'pc_title'=>$name]],'tenant_config'=>['tenant'=>['name'=>$name],'website'=>['name'=>$name,'shop_name'=>$name,'pc_title'=>$name,'pc_login_title'=>$name]]];
Db::transaction(function()use($entries){foreach($entries as $table=>$types)foreach($types as $type=>$values)foreach($values as $key=>$value){$where=['type'=>$type,'name'=>$key];if($table==='tenant_config')$where['tenant_id']=1;$q=Db::name($table)->where($where);if($q->find())$q->update(['value'=>$value]);else Db::name($table)->insert($where+['value'=>$value]);}});
echo "Local platform, OEM and merchant branding updated: $name\n";
