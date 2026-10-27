<?php
declare(strict_types=1);
// Adapter for the supplied PC build until editable Vue source is available.
if(PHP_SAPI!=='cli')exit(1);
$file=dirname(__DIR__).'/public/_nuxt/useAiPcHomeDecorate.d01e3f4e.js';
$source=file_get_contents($file);
if(str_contains($source,'class:"merchant-header-account"')){echo "Merchant account header already installed.\n";return;}
$start='a("div",nl,[a("button",{class:"ia-account-trigger"';$end='],8,sl)])';
if(substr_count($source,$start)!==1)throw new RuntimeException('PC build changed; review account header adapter');
$a=strpos($source,$start);$b=strpos($source,$end,$a);if($b===false)throw new RuntimeException('Account component boundary changed');$b+=strlen($end);
$account=str_replace('a("div",nl,','a("div",{class:"merchant-header-account"},',substr($source,$a,$b-$a));
$source=substr_replace($source,'N("",!0)',$a,$b-$a);
$a=strpos($source,'a("a",{class:"ia-pill ia-api"');
$notification='a("button",{class:"ia-icon-button","aria-label":u("通知"),onClick:m[8]||(m[8]=p=>bt("notice"))},[$(F,{name:"notification"})],8,$l)';
$b=$a===false?false:strpos($source,','.$notification,$a);
if($a===false||$b===false)throw new RuntimeException('Header actions changed; review adapter');
$source=substr_replace($source,$account,$a,$b-$a);
if(substr_count($source,$account.','.$notification)!==1)throw new RuntimeException('Header account position changed');
$source=str_replace($account.','.$notification,$notification.','.$account,$source);
$placement='placement:X.value==="workspace"?"bottom-end":"top-start"';
if(substr_count($source,$placement)!==1)throw new RuntimeException('Account popup configuration changed');
$source=str_replace($placement,'placement:["workspace","settings","appearance","more"].includes(X.value)?"bottom-end":"top-start"',$source);
if(file_put_contents($file,$source)===false)throw new RuntimeException('Cannot install merchant account header');
echo "Merchant account moved to native header; promotional header actions removed.\n";
