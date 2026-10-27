<?php
declare(strict_types=1);
// Adapter for the supplied 1.0.399 PC build until the editable Vue source arrives.
if(PHP_SAPI!=='cli')exit(1);
$file=dirname(__DIR__).'/public/_nuxt/entry.ef871ac3.js';
$source=file_get_contents($file);
if(str_contains($source,'/* merchant-workspace-routes-v4 */')){echo "Merchant PC routes already installed.\n";return;}
$anchor='{name:(Zt==null?void 0:Zt.name)??"ai-assets"';
if(substr_count($source,$anchor)!==1)throw new RuntimeException('PC build changed; review merchant route adapter before installation');
foreach(['v1','v2','v3'] as $version)if(($start=strpos($source,'/* merchant-workspace-routes-'.$version.' */'))!==false){$end=strpos($source,$anchor,$start);if($end===false)throw new RuntimeException('Cannot migrate old merchant route adapter');$source=substr($source,0,$start).substr($source,$end);}
$routes=[];
foreach(['stores','materials/video','materials/image-text','materials/topics','seedcards','materials/images','materials/audio','materials/voiceover','video-editor','films','publish-tasks'] as $index=>$path){
 $routes[]='{name:"merchant-workspace-'.$index.'",path:"/ai/'.$path.'",meta:{layout:"blank",auth:true},component:()=>ae(()=>import("/merchant/page.js?v=20261015"),["./useAiPcHomeDecorate.3ba8ddd2.css","./ImagineIcon.bcab7711.css","./el-dropdown.9cb36567.css","./el-popover.11b2087f.css","./el-popper.2c369f4c.css","./el-scrollbar.fef41773.css","./el-dialog.cbcead69.css"],import.meta.url).then(e=>e.default||e)}';
}
$source=str_replace($anchor,'/* merchant-workspace-routes-v4 */'.implode(',',$routes).','.$anchor,$source);
if(file_put_contents($file,$source)===false)throw new RuntimeException('Cannot write merchant PC route adapter');
echo "Installed eleven independent merchant PC routes; native smart_clip remains separate.\n";
