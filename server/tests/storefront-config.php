<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/common/service/merchant/MerchantStoreDesignService.php';
use app\common\service\merchant\MerchantStoreDesignService as Design;

$count=0;
function check(bool $ok,string $label):void {global $count;if(!$ok)throw new RuntimeException($label);$count++;echo "PASS $label\n";}
function invalid(array $config,string $label):void {try{Design::normalize(1,1,$config);}catch(InvalidArgumentException $e){check(true,$label);return;}throw new RuntimeException($label);}
$base=Design::normalize(1,1,[]);
check(count($base['storefront']['order'])===28,'default order contains every existing feature');
check($base['style']==='one'&&$base['components']===[],'legacy configuration remains intact');
$config=$base;
$config['storefront']=['enabled'=>false,'hero_template'=>'warm','tagline'=>'欢迎来店里坐坐','hero_size'=>'compact','show_favorite'=>false,'show_deals'=>false,'primary_feature'=>'review_dianping','primary_style'=>'black','order'=>['service_wifi','review_dianping'],'full_width'=>['review_dianping','service_wifi']];
$actual=Design::normalize(1,1,$config);
check(array_slice($actual['storefront']['order'],0,2)===['service_wifi','review_dianping'],'saved order retained with remaining features appended');
foreach($config['storefront'] as $key=>$value)if($key!=='order')check($actual['storefront'][$key]===$value,"round trip $key");
check(Design::normalize(1,1,$actual)===$actual,'normalization is stable across reloads');
$config['features']['review_dianping']=false;
check(Design::normalize(1,1,$config)['storefront']['primary_feature']==='','hidden feature cannot remain the primary action');
foreach([
 ['order',['service_wifi','service_wifi']],['order',['unknown']],['order','service_wifi'],
 ['full_width',['unknown']],['full_width',['service_wifi','service_wifi']],['full_width',['key'=>'service_wifi']],
 ['primary_feature','unknown'],['hero_template','https://example.com/image.jpg'],['hero_size','giant'],
 ['primary_style','script'],['show_favorite',[]],['enabled',2],['tagline',str_repeat('字',81)],
] as [$key,$value]){$bad=$base;$bad['storefront'][$key]=$value;invalid($bad,'reject invalid '.$key);}
invalid(['storefront'=>'invalid'],'reject non-object storefront');
echo "All $count storefront configuration checks passed.\n";
