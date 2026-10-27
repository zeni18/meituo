<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/runtime-loader.php';$app=new \AigcRuntimeApp(dirname(__DIR__));$app->initialize();
\app\common\service\database\SqlMigrationExecutor::execute(file_get_contents(dirname(__DIR__).'/upgrade/20261021_press_price_options.sql'),(string)config('database.connections.mysql.prefix'));
$changed=0;
\think\facade\Db::name('press_media')->whereIn('kind',[12,13,14])->where('active',0)->chunk(200,function($rows)use(&$changed){foreach($rows as $row){$d=json_decode($row['details_json']??'{}',true)?:[];if((string)($d['flag']??'')==='1'&&(string)($d['deleted']??'')==='1'&&\app\common\service\press\PressPriceOptions::costs($row)){\think\facade\Db::name('press_media')->where('id',$row['id'])->where('active',0)->update(['active'=>1]);$changed++;}}},'id');
echo 'Price options installed; eligible alternative-price resources: '.$changed."\n";
