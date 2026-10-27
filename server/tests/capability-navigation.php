<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/common/service/integration/CapabilityNavigation.php';
use app\common\service\integration\CapabilityNavigation;
$count=0;
function check(bool $ok,string $message):void{global $count;if(!$ok)throw new RuntimeException($message);$count++;}
function menu(int $id,string $path,string $perm,int $show=1):array{return ['id'=>$id,'pid'=>0,'paths'=>$path,'component'=>$path,'name'=>$path,'type'=>'C','perms'=>$perm,'is_show'=>$show,'is_disable'=>0];}
function visible(array $rows):array{return array_values(array_filter($rows,fn($r)=>!empty($r['is_show'])));}
$clip=menu(1,'integration/config','integration.config/lists');$geo=menu(2,'geo/config','geo.config/lists');$press=menu(3,'media/press/config','media.press/config');$orders=menu(4,'media/press/orders','media.press/orders');$jobs=menu(5,'geo/jobs','geo.config/jobs');
$result=CapabilityNavigation::merge([$clip,$geo,$press,$orders,$jobs]);
check(array_column(visible($result),'paths')===['integration/config','media/press/orders','geo/jobs'],'One configuration entry, business pages retained');
check(array_column($result,'perms')===array_column([$clip,$geo,$press,$orders,$jobs],'perms'),'Existing permissions unchanged');
check(array_column($result,'id')===[1,2,3,4,5],'Existing route identities retained');
foreach([$geo,$press] as $single){$rows=CapabilityNavigation::merge([$single]);$shown=visible($rows);check(count($shown)===1&&$shown[0]['paths']==='integration/config','Single-service role can reach shared page');check($shown[0]['perms']===$single['perms'],'Fallback inherits only original permission');check($rows[0]['id']===$single['id']&&$rows[0]['is_show']===0,'Bookmark route retained and hidden');check(CapabilityNavigation::merge($rows)===$rows,'Normalization is idempotent');}
check(CapabilityNavigation::merge([])===[],'No access creates no menu');
check(visible(CapabilityNavigation::merge([menu(6,'geo/config','geo.config/lists',0)]))===[],'Intentionally hidden config stays hidden');
$rows=CapabilityNavigation::merge([$geo,$press]);check(count(visible($rows))===1,'Multiple legacy permissions get one shared entry');
echo "Passed $count navigation and permission-preservation checks.\n";
