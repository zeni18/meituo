<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
$base=dirname(__DIR__).'/public/_nuxt/';
// Presentation-only renaming in the supplied build. No original API URL, code or provider changes.
foreach(['entry.ef871ac3.js','_id_.68ad6490.js','useAiPcHomeDecorate.d01e3f4e.js'] as $name){$source=file_get_contents($base.$name);$source=str_replace('AI视频剪辑','AI短视频',$source);file_put_contents($base.$name,$source);}
$file=$base.'useToolDisplayName.596115ba.js';$source=file_get_contents($file);
if(!str_contains($source,'/* native-short-video-title */')){
    $anchor='return l(r&&r!==o?r:a,s)';if(substr_count($source,$anchor)!==1)throw new RuntimeException('Native tool title adapter changed; review before installing');
    $source=str_replace($anchor,'/* native-short-video-title */if(o==="smart_clip")return l("AI短视频",s);'.$anchor,$source);file_put_contents($file,$source);
}
echo "Native smart_clip is AI short video; new editor keeps its independent route.\n";
