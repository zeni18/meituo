<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

use InvalidArgumentException as Invalid;

/** Bounded declarative options; never accept arbitrary vendor JSON or media URLs. */
final class ClipFeatures
{
    public const FONTS=['SimSun'=>'宋体','Alibaba PuHuiTi'=>'阿里巴巴普惠体','Microsoft YaHei'=>'微软雅黑','KaiTi'=>'楷体','Source Han Sans CN'=>'思源黑体','Source Han Serif CN'=>'思源宋体','HappyZcool-2016'=>'站酷快乐体'];
    public const TRANSITIONS=[''=>'无转场','fade'=>'渐隐','wipeleft'=>'向左擦除','wiperight'=>'向右擦除','circleopen'=>'圆形溶解','simplezoom'=>'放大消失'];
    public const MOTIONS=[''=>'无动画','fade_in'=>'淡入','slide_up_in'=>'上滑','typewriter1_in'=>'打字机','spring_in'=>'弹入'];
    public const FILTERS=['original'=>['name'=>'原始画面','colors'=>['contrast'=>0,'saturation'=>0,'brightness'=>0]],'bright'=>['name'=>'清晰明亮','colors'=>['contrast'=>12,'saturation'=>8,'brightness'=>8]],'soft'=>['name'=>'柔和自然','colors'=>['contrast'=>-8,'saturation'=>-5,'brightness'=>12]],'vivid'=>['name'=>'鲜明色彩','colors'=>['contrast'=>8,'saturation'=>20,'brightness'=>0]]];
    public static function catalog():array
    {
        $flowers=[''=>'普通文字'];for($i=1;$i<=16;$i++)$flowers['CS0001-'.str_pad((string)$i,6,'0',STR_PAD_LEFT)]='花字 '.$i;
        return ['fonts'=>self::FONTS,'flowers'=>$flowers,'transitions'=>self::TRANSITIONS,'motions'=>self::MOTIONS,'filters'=>array_map(fn($row)=>$row['name'],self::FILTERS)];
    }
    private static function choice(mixed $value,array $allowed):string
    {if(!is_string($value)||!array_key_exists($value,$allowed))throw new Invalid('效果选项不正确');return $value;}
    private static function number(mixed $value,float $min,float $max):float
    {if(!is_numeric($value)||!is_finite((float)$value)||(float)$value<$min||(float)$value>$max)throw new Invalid('效果数值超出范围');return (float)$value;}
    public static function mediaId(mixed $id):string
    {if(!is_string($id)||!preg_match('/^icepublic-[a-zA-Z0-9_-]{8,100}$/D',$id))throw new Invalid('版权音乐编号无效');return $id;}
    public static function normalize(array $c,array $p):array
    {
        $catalog=self::catalog();
        foreach(['text_style','title_style'] as $key){$style=$p[$key]??[];
            $c[$key]['font']=self::choice($style['font']??'SimSun',$catalog['fonts']);
            $c[$key]['flower']=self::choice($style['flower']??'',$catalog['flowers']);
            $c[$key]['motion']=self::choice($style['motion']??'',$catalog['motions']);
        }
        $c['resolution']=self::choice((string)($p['resolution']??'720'),['720'=>true,'1080'=>true,'2160'=>true]);
        $pool=$p['filter_pool']??[];if(!is_array($pool)||!array_is_list($pool)||count($pool)>4)throw new Invalid('滤镜池格式不正确');$c['filter_pool']=[];foreach($pool as $filter)$c['filter_pool'][]=self::choice($filter,self::FILTERS);$c['filter_pool']=array_values(array_unique($c['filter_pool']));
        $transition=$p['transition']??[];if(!is_array($transition))throw new Invalid('转场设置无效');
        $c['transition']=['type'=>self::choice($transition['type']??'',self::TRANSITIONS),'duration'=>self::number($transition['duration']??0.5,0.1,2)];
        $audio=$p['audio_effects']??[];if(!is_array($audio))throw new Invalid('声音设置无效');
        $c['audio_effects']=['fade_in'=>self::number($audio['fade_in']??0,0,5),'fade_out'=>self::number($audio['fade_out']??0,0,5),'denoise'=>(int)self::choice((string)($audio['denoise']??0),['0'=>true,'1'=>true,'2'=>true,'3'=>true,'4'=>true])];
        $c['public_music_id']=empty($p['public_music_id'])?'':self::mediaId($p['public_music_id']);
        if($c['public_music_id']&&$c['music_ids'])throw new Invalid('版权音乐与本地背景音乐请选择一种');
        $rows=$p['captions']??[];if(!is_array($rows)||!array_is_list($rows)||count($rows)>500)throw new Invalid('逐句字幕最多500句');
        $c['captions']=[];$last=0.0;
        foreach($rows as $row){if(!is_array($row))throw new Invalid('逐句字幕格式错误');$start=self::number($row['start']??null,0,600);$end=self::number($row['end']??null,0,600);
            if($end<=$start||$start<$last)throw new Invalid('字幕时间须按顺序排列且不能重叠');$last=$end;
            $c['captions'][]=['start'=>$start,'end'=>$end,'text'=>ClipConfiguration::text($row['text']??'',800,true)];
        }
        return $c;
    }
    public static function textEffects(array $style,float $duration):array
    {
        $r=[];if(!empty($style['flower']))$r['EffectColorStyle']=$style['flower'];
        if(!empty($style['motion'])){$r['AaiMotionInEffect']=$style['motion'];$r['AaiMotionIn']=min(0.5,$duration/2);}
        return $r;
    }
    public static function audioEffects(array $p,float $duration,bool $music):array
    {
        $r=[];$c=$p['audio_effects']??[];
        foreach(['fade_in'=>'In','fade_out'=>'Out'] as $key=>$type)if(($c[$key]??0)>0)$r[]=['Type'=>'AFade','SubType'=>$type,'Duration'=>min((float)$c[$key],$duration/2),'Curve'=>'tri'];
        if(!$music&&($c['denoise']??0)>0)$r[]=['Type'=>'ADenoise','Mode'=>(int)$c['denoise']];return $r;
    }
}
