<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/common/service/merchant/clip/ClipCloudProvider.php';
use app\common\service\merchant\clip\ClipCloudProvider as Cloud;
foreach([null,'','/','///',' / ']as $prefix){
    $settings=$prefix===null?[]:['prefix'=>$prefix];$actual=Cloud::key(['settings'=>$settings],1,7,'test-token','input/42.png');
    if($actual!=='merchant-clip/t1/u7/test-token/input/42.png')throw new RuntimeException('Empty optional OSS prefix must use a valid default object key');
}
foreach(['custom','custom/','/custom/']as $prefix){
    $actual=Cloud::key(['settings'=>['prefix'=>$prefix]],1,7,'test-token','input/42.png');
    if($actual!=='custom/t1/u7/test-token/input/42.png')throw new RuntimeException('Custom prefix or merchant scope changed');
}
echo 'PASS empty and custom OSS prefixes retain valid, merchant-scoped object keys.'.PHP_EOL;
