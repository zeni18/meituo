<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

/** Compile an owned, immutable plan; never accept a browser-supplied timeline or URL. */
final class ClipImsTimeline
{
    public static function compile(array $plan,array $media):array
    {
        if(($plan['colors']['hue']??0)!=0)throw new \InvalidArgumentException('当前云合成暂不支持色相调整，请将色相设为0后提交');
        $tracks=[];$clips=[];$audio=[];$subtitles=[];$style=$plan['text_style'];$duration=(float)$plan['duration'];
        $resolve=static function(int $id)use($media):array{if(!isset($media[$id]))throw new \InvalidArgumentException('合成素材缺失');return $media[$id];};
        $segments=static function(array $m,float $in,float $span,float $start,float $length,float $speed,array $extras=[]):array{
            if($m['kind']==='image')return [['Type'=>'Image','MediaURL'=>$m['url'],'TimelineIn'=>$start,'TimelineOut'=>round($start+$length,4),'Duration'=>$length]+$extras];
            if($span<=0)throw new \InvalidArgumentException('视频时长不可用');$result=[];$remaining=$length;$cursor=$start;
            while($remaining>0.00009){if(count($result)>=600)throw new \InvalidArgumentException('循环片段过多，请更换更长的素材');$part=min($remaining,$span/$speed);$result[]=['Type'=>'Video','MediaURL'=>$m['url'],'In'=>$in,'Out'=>round($in+$part*$speed,4),'Speed'=>$speed,'TimelineIn'=>round($cursor,4),'TimelineOut'=>round($cursor+$part,4)]+$extras;$remaining-=$part;$cursor+=$part;}
            return $result;
        };
        $text=static function(string $content,float $start,float $end,bool $title=false)use($style,$plan):array{
            $style=$title?($plan['title_style']??array_replace($style,['y'=>10])):$style;
            $align=$style['align'];return ['Type'=>'Text','Content'=>$content,'TimelineIn'=>$start,'TimelineOut'=>$end,'Font'=>$style['font']??'SimSun','FontSize'=>$style['size'],'FontColor'=>$style['color'],'Outline'=>(int)round($style['outline_width']),'OutlineColour'=>$style['outline'],'Alignment'=>ucfirst($align),'X'=>$align==='left'?0.05:($align==='right'?0.95:0.5),'Y'=>min(.9999,$style['y']/100),'AdaptMode'=>'AutoWrap','TextWidth'=>0.9]+ClipFeatures::textEffects($style,$end-$start);
        };
        $voice=static function(int $id,float $start,float $end,bool $music=false)use($resolve,$plan):array{$m=$resolve($id);return ['MediaURL'=>$m['url'],'In'=>0,'TimelineIn'=>$start,'TimelineOut'=>$end,'Speed'=>$music?1:$plan['voice_speed'],'LoopMode'=>$music,'Effects'=>[['Type'=>'Volume','Gain'=>$music?$plan['music_volume']:$plan['voice_volume']],...ClipFeatures::audioEffects($plan,$end-$start,$music)]];};
        if($plan['background']['type']==='media'){
            $id=(int)($plan['background']['material_ids'][0]??0);$m=$resolve($id);
            $tracks[]=['VideoTrackClips'=>$segments($m,0,(float)($m['duration']??0),0,$duration,1,['AdaptMode'=>'Cover','Effects'=>[['Type'=>'Volume','Gain'=>0]]])];
        }
        foreach($plan['shots'] as $shotIndex=>$shot){
            $effects=[['Type'=>'Volume','Gain'=>$plan['mute']?0:1]];
            if($plan['background']['type']!=='media')$effects[]=$plan['background']['type']==='blur'?['Type'=>'Background','SubType'=>'Blur','Radius'=>0.2]:['Type'=>'Background','SubType'=>'Color','Color'=>$plan['background']['color']];
            $colors=array_intersect_key($shot['colors']??$plan['colors'],array_flip(['contrast','brightness','saturation']));if(array_filter($colors))$effects[]=['Type'=>'Filter','SubType'=>'color','ExtParams'=>json_encode($colors,JSON_THROW_ON_ERROR)];
            $m=$resolve((int)$shot['material_id']);$clips=array_merge($clips,$segments($m,(float)$shot['source_in'],(float)($shot['source_out']-$shot['source_in']),(float)$shot['timeline_in'],(float)$shot['duration'],(float)$plan['speed'],['AdaptMode'=>'Contain','Effects'=>$effects]));
            if(!empty($plan['transition']['type'])&&$shotIndex<count($plan['shots'])-1){$last=count($clips)-1;$next=$plan['shots'][$shotIndex+1];$clips[$last]['Effects'][]=['Type'=>'DLTransition','SubType'=>$plan['transition']['type'],'Duration'=>min((float)$plan['transition']['duration'],($clips[$last]['TimelineOut']-$clips[$last]['TimelineIn'])/2,(float)$next['duration']/2)];}
            $end=round($shot['timeline_in']+$shot['duration'],4);
            if($shot['text']!=='')$subtitles[]=$text($shot['text'],(float)$shot['timeline_in'],$end);
            if($shot['voiceover_id'])$audio[]=['AudioTrackClips'=>[$voice((int)$shot['voiceover_id'],(float)$shot['timeline_in'],$end)]];
        }
        $tracks[]=['VideoTrackClips'=>$clips];
        foreach($plan['stickers'] as $sticker){
            // Pick once per saved plan; do not introduce provider-side random selection.
            $id=(int)($sticker['material_ids'][0]??0);if(!$id)continue;$m=$resolve($id);$overlay=[];
            foreach($plan['shots'] as $shot){if($sticker['group']&&$sticker['group']!==$shot['group'])continue;
                $overlay=array_merge($overlay,$segments($m,0,(float)($m['duration']??0),(float)$shot['timeline_in'],(float)$shot['duration'],1,['X'=>min(.9999,$sticker['x']/100),'Y'=>min(.9999,$sticker['y']/100),'Width'=>min(.9999,$sticker['width']/100),'Effects'=>[['Type'=>'Volume','Gain'=>0]]]));}
            if($overlay)$tracks[]=['VideoTrackClips'=>$overlay];
        }
        if($plan['voiceover_id'])$audio[]=['AudioTrackClips'=>[$voice((int)$plan['voiceover_id'],0,$duration)]];
        if($plan['music_id'])$audio[]=['AudioTrackClips'=>[$voice((int)$plan['music_id'],0,$duration,true)]];
        if($plan['subtitle']!=='')$subtitles[]=$text($plan['subtitle'],0,$duration);
        if(!empty($plan['public_music_id']))$audio[]=['AudioTrackClips'=>[['MediaId'=>ClipFeatures::mediaId($plan['public_music_id']),'TimelineIn'=>0,'TimelineOut'=>$duration,'LoopMode'=>true,'Effects'=>[['Type'=>'Volume','Gain'=>$plan['music_volume']],...ClipFeatures::audioEffects($plan,$duration,true)]]]];
        foreach($plan['captions']??[] as $caption){$start=(float)$caption['start'];$end=min($duration,(float)$caption['end']);if($start<$end)$subtitles[]=$text($caption['text'],$start,$end);}
        if(!empty($plan['cover_id'])){$cover=$resolve((int)$plan['cover_id']);$tracks[]=['VideoTrackClips'=>[['Type'=>'Image','MediaURL'=>$cover['url'],'TimelineIn'=>0,'TimelineOut'=>1/$plan['fps'],'Duration'=>1/$plan['fps'],'AdaptMode'=>'Cover']]];}
        $timeline=['VideoTracks'=>$tracks];if($audio)$timeline['AudioTracks']=$audio;
        if($subtitles)$timeline['SubtitleTracks'][]=['SubtitleTrackClips'=>$subtitles];
        $titleStyle=$plan['title_style']??$style;
        if($plan['title']!==''&&$titleStyle['title_range'][0]<min($duration,$titleStyle['title_range'][1]))$timeline['SubtitleTracks'][]=['SubtitleTrackClips'=>[$text($plan['title'],(float)$titleStyle['title_range'][0],min($duration,(float)$titleStyle['title_range'][1]),true)]];
        return $timeline;
    }
    public static function output(array $plan,string $url):array
    {
        [$w,$h]=match($plan['ratio']){'16:9'=>[1280,720],'1:1'=>[720,720],default=>[720,1280]};
        $factor=((int)($plan['resolution']??720))/720;$w=(int)round($w*$factor);$h=(int)round($h*$factor);
        return ['MediaURL'=>$url,'Width'=>$w,'Height'=>$h,'MaxDuration'=>$plan['duration'],'Video'=>['Fps'=>$plan['fps'],'Codec'=>'H.264']];
    }
}
