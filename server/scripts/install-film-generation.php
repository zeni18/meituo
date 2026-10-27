<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
$adapters=[
 ['api.1b3c3da1.js','digital_human','$request.post({url:"/app.aigc_digital_human.generate/index",params:t})'],
 ['api.d8531416.js','image_human','$request.post({url:"/app.image_human.generate/submit",params:e})'],
 ['api.547e25c4.js','pic_lipsync','$request.post({url:`${s}.generate/index`,params:e,retry:0,timeout:18e4})'],
];
foreach($adapters as [$file,$source,$original]){$path=dirname(__DIR__).'/public/_nuxt/'.$file;$js=file_get_contents($path);if(str_contains($js,'/* finished-video-destination-v1 */'))continue;if(substr_count($js,$original)!==1)throw new RuntimeException('Native generation client changed: '.$file);$replacement='/* finished-video-destination-v1 */(window.MerchantFinishedVideo?window.MerchantFinishedVideo.generate("'.$source.'",()=>'.$original.'):'.$original.')';file_put_contents($path,str_replace($original,$replacement,$js));}
echo "Finished-video destination metadata adapters installed; native requests unchanged.\n";
