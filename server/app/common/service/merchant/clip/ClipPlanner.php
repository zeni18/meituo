<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

use InvalidArgumentException as Invalid;

/** Deterministic, bounded composition planning. A plan is NOT a cloud-rendered preview. */
final class ClipPlanner
{
    private int $cursor=0;
    public function __construct(private readonly string $seed){}
    private function number(float $min,float $max):float
    {
        $v=hexdec(substr(hash('sha256',$this->seed.':'.$this->cursor++),0,8))/4294967295;
        return round($min+($max-$min)*$v,3);
    }
    private function pick(array $items){return $items?(array_values($items)[min(count($items)-1,(int)floor($this->number(0,count($items))))]):null;}
    private function voice(array $ids,array $assets):?int{return $ids?$this->pick($ids):null;}
    public function build(array $c,array $assets):array
    {
        $shots=[];$cursor=0.0;
        $add=function(int $id,float $wanted,string $text='',?int $voice=null,int $group=0)use(&$shots,&$cursor,$assets,$c){
            $a=$assets[$id];$source=(float)($a['duration']??0);$image=$a['kind']==='image';
            if(!$image&&$source<=0)throw new Invalid('视频时长尚不可用，请检查本地文件或等待云端媒体信息接入');
            $duration=$wanted;
            if($voice){$audio=(float)($assets[$voice]['duration']??0);if($audio<=0)throw new Invalid('旁白时长尚不可用');if($c['duration_basis']==='voice')$duration=$audio/$c['voice_speed'];}
            elseif($c['duration_basis']==='voice'&&$text!=='')throw new Invalid('请先为口播文案生成配音或选择已有旁白；请在配音面板生成旁白');
            if($duration<1/$c['fps'])throw new Invalid('镜头时长不足一帧，请调整旁白语速或合成规则');
            $span=$image?0:min($source,$duration*$c['speed']);
            $in=$image?0:$this->number(0,max(0,$source-$span));
            $shots[]=['material_id'=>$id,'kind'=>$a['kind'],'group'=>$group,'timeline_in'=>round($cursor,3),'duration'=>round($duration,3),
                'source_in'=>$in,'source_out'=>round($in+$span,3),'loop'=>!$image&&$span<$duration*$c['speed'],
                'text'=>$text,'voiceover_id'=>$voice];$cursor+=$duration;
            if($cursor>600)throw new Invalid('本期编排单条视频最多600秒，请缩短镜头或旁白');
        };
        if(in_array($c['mode'],['storyboard','script'],true)){
            if($c['mode']==='script'&&$c['script']['copy']==='')throw new Invalid('请先填写口播文案并拆分镜头');
            foreach($c['groups'] as $i=>$g){if(!$g['material_ids'])throw new Invalid('请为每个镜头组选择素材');
                $add($this->pick($g['material_ids']),$g['duration'],$c['subtitle_mode']==='group'?($this->pick($g['texts'])??''):'',$this->voice($g['voiceover_ids'],$assets),$i+1);
            }
        }else{
            $pool=$c['material_ids'];if(!$pool)throw new Invalid('请先选择镜头素材');
            if($c['mode']==='quick'){
                $target=$this->number(...$c['duration_range']);$remaining=$target;
                while($remaining>0.01&&count($shots)<60){$id=$this->pick($pool);$a=$assets[$id];$available=$a['kind']==='image'?5:(float)($a['duration']??0)/$c['speed'];
                    if($available<=0)throw new Invalid('视频时长尚不可用');$duration=min($remaining,$available);$add($id,$duration);$remaining-=$duration;}
                if($remaining>0.01)throw new Invalid('目标时长无法在60个镜头内完成');
            }else{
                $count=(int)floor($this->number($c['shot_range'][0],$c['shot_range'][1]+0.999));
                if($count>count($pool))throw new Invalid('抽取镜头数量超过素材池数量，请增加素材或减少数量');
                for($i=0;$i<$count;$i++){$id=$this->pick($pool);$pool=array_values(array_diff($pool,[$id]));$add($id,$this->number(...$c['clip_range']));}
            }
        }
        $voice=$this->voice($c['voiceover_ids'],$assets);$global=$c['subtitle_mode']==='global'?($this->pick($c['subtitles'])??''):'';
        if($global!==''&&!$voice&&$c['duration_basis']==='voice')throw new Invalid('全局字幕按配音时长合成需先选择或生成旁白');
        if($c['duration_basis']==='voice'&&$voice){
            $target=(float)($assets[$voice]['duration']??0)/$c['voice_speed'];
            if($target<=0)throw new Invalid('全局旁白时长尚不可用');if($target>600)throw new Invalid('旁白合成时长不能超过600秒');
            $position=0.0;foreach($shots as &$shot){$shot['duration']=round($shot['duration']*$target/$cursor,3);if($shot['duration']<1/$c['fps'])throw new Invalid('旁白时长过短，无法覆盖全部镜头，请减少镜头数量');$shot['timeline_in']=round($position,3);$position+=$shot['duration'];
                $a=$assets[$shot['material_id']];$source=(float)($a['duration']??0);$span=$shot['kind']==='image'?0:min($source,$shot['duration']*$c['speed']);$shot['source_in']=min($shot['source_in'],max(0,$source-$span));$shot['source_out']=round($shot['source_in']+$span,3);$shot['loop']=$shot['kind']!=='image'&&$span<$shot['duration']*$c['speed'];
            }unset($shot);$cursor=$position;
        }
        if(!empty($c['filter_pool']))foreach($shots as &$shot){$shot['filter_id']=$this->pick($c['filter_pool']);$shot['colors']=ClipFeatures::FILTERS[$shot['filter_id']]['colors'];}unset($shot);
        $duration=round($cursor,3);$warnings=[];
        if($voice&&($assets[$voice]['duration']??0)>$duration*$c['voice_speed'])$warnings[]='全局旁白长于镜头总时长，云端合成前需调整时长或裁剪规则';
        if(array_filter($shots,fn($s)=>$s['loop']))$warnings[]='部分镜头需循环画面以覆盖设定时长';
        if($global!=='')$warnings[]='当前为整段字幕排版预览，逐句/逐字字幕需要配音时间戳或ASR';
        return ['version'=>1,'mode'=>$c['mode'],'ratio'=>$c['ratio'],'fps'=>$c['fps'],'duration'=>$duration,'shots'=>$shots,
            'music_id'=>$this->pick($c['music_ids']),'voiceover_id'=>$voice,'subtitle'=>$global,'title'=>$this->pick($c['titles'])??'',
            'cover_id'=>$this->pick($c['cover_ids']),'text_style'=>$c['text_style'],'title_style'=>$c['title_style']??array_replace($c['text_style'],['y'=>10]),'background'=>$c['background'],'colors'=>$c['colors'],
            'speed'=>$c['speed'],'mute'=>$c['mute'],'voice_speed'=>$c['voice_speed'],'voice_volume'=>$c['voice_volume'],'music_volume'=>$c['music_volume'],
            'resolution'=>$c['resolution']??'720','transition'=>$c['transition']??[],'audio_effects'=>$c['audio_effects']??[],'public_music_id'=>$c['public_music_id']??'','captions'=>$c['subtitle_mode']==='timed'?($c['captions']??[]):[],
            'stickers'=>$c['stickers'],'warnings'=>$warnings,'state'=>'planned'];
    }
}
