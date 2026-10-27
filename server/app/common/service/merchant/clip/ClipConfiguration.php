<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

use InvalidArgumentException as Invalid;

/** Persist only declarative editing data. URLs, credentials and executable effects are never accepted. */
final class ClipConfiguration
{
    public static function text($value,int $max,bool $required=false):string
    {
        if(!is_string($value))throw new Invalid('文字字段格式不正确');
        $value=trim($value);
        if(($required&&$value==='')||mb_strlen($value)>$max)throw new Invalid('文字内容为空或超出长度限制');
        return $value;
    }
    private static function number($value,float $min,float $max):float
    {
        if(!is_numeric($value)||!is_finite((float)$value)||(float)$value<$min||(float)$value>$max)throw new Invalid('数值超出允许范围');
        return (float)$value;
    }
    private static function integer($value,int $min,int $max):int
    {
        if(!is_int($value)&&!(is_string($value)&&ctype_digit($value)))throw new Invalid('整数格式不正确');
        return (int)self::number($value,$min,$max);
    }
    public static function ids($value,int $max=100):array
    {
        if(!is_array($value)||!array_is_list($value)||count($value)>$max)throw new Invalid('素材数量或格式不正确');
        $ids=[];foreach($value as $id)$ids[]=self::integer($id,1,PHP_INT_MAX);
        return array_values(array_unique($ids));
    }
    private static function choice($value,array $options):string
    {
        if(!is_string($value)||!in_array($value,$options,true))throw new Invalid('设置选项不正确');return $value;
    }
    private static function toggle($value):bool
    {
        if(!is_bool($value))throw new Invalid('开关格式不正确');return $value;
    }
    private static function object($value):array
    {
        if(!is_array($value)||($value&&array_is_list($value)))throw new Invalid('配置格式不正确');return $value;
    }
    private static function texts($value,int $length):array
    {
        if(!is_array($value)||!array_is_list($value)||count($value)>100)throw new Invalid('文案池最多100条');
        return array_values(array_filter(array_map(fn($s)=>self::text($s,$length),$value),fn($s)=>$s!==''));
    }
    private static function range($value,float $min,float $max,bool $integer=false):array
    {
        if(!is_array($value)||count($value)!==2||!array_is_list($value))throw new Invalid('区间格式不正确');
        $range=array_map(fn($v)=>$integer?self::integer($v,(int)$min,(int)$max):self::number($v,$min,$max),$value);
        if($range[0]>$range[1])throw new Invalid('区间下限不能大于上限');return $range;
    }
    private static function color($value):string
    {
        if(!is_string($value)||!preg_match('/^#[0-9a-fA-F]{6}$/D',$value))throw new Invalid('颜色格式不正确');return strtolower($value);
    }
    public static function normalize(array $p):array
    {
        if(strlen(json_encode($p,JSON_THROW_ON_ERROR))>600000)throw new Invalid('工程配置过大');
        $groups=$p['groups']??[[],[],[]];
        if(!is_array($groups)||!array_is_list($groups)||count($groups)<1||count($groups)>30)throw new Invalid('镜头组数量须为1～30');
        $result=[
            'version'=>1,'mode'=>self::choice($p['mode']??'quick',['quick','mix','storyboard','script']),
            'ratio'=>self::choice($p['ratio']??'9:16',['9:16','16:9','1:1']),
            'fps'=>self::integer($p['fps']??25,25,60),
            'mute'=>self::toggle($p['mute']??true),'speed'=>self::number($p['speed']??1,0.75,2),
            'voice_volume'=>self::number($p['voice_volume']??1,0,3),
            'music_volume'=>self::number($p['music_volume']??0.5,0,1),
            'voice_speed'=>self::number($p['voice_speed']??1,0.2,3),
            'duration_range'=>self::range($p['duration_range']??[10,15],1,40),
            'shot_range'=>self::range($p['shot_range']??[1,1],1,30,true),
            'clip_range'=>self::range($p['clip_range']??[3,5],0.1,300),
            'duration_basis'=>self::choice($p['duration_basis']??'video',['video','voice']),
            'subtitle_mode'=>self::choice($p['subtitle_mode']??'none',['none','global','group','timed']),
            'material_ids'=>self::ids($p['material_ids']??[]),
            'music_ids'=>self::ids($p['music_ids']??[]),
            'voiceover_ids'=>self::ids($p['voiceover_ids']??[]),
            'cover_ids'=>self::ids($p['cover_ids']??[],20),
            'subtitles'=>self::texts($p['subtitles']??[],800),
            'titles'=>self::texts($p['titles']??[],50),
        ];
        if(!in_array($result['fps'],[25,30,60],true))throw new Invalid('帧率仅支持25、30、60');
        $style=self::object($p['text_style']??[]);
        $result['text_style']=[
            'size'=>self::integer($style['size']??42,12,160),
            'color'=>self::color($style['color']??'#ffffff'),
            'outline'=>self::color($style['outline']??'#000000'),
            'outline_width'=>self::number($style['outline_width']??2,0,12),
            'y'=>self::number($style['y']??80,0,100),
            'align'=>self::choice($style['align']??'center',['left','center','right']),
            'title_range'=>self::range($style['title_range']??[0,3],0,600),
        ];
        // Independent title typography; old drafts inherit their original shared style.
        $title=self::object($p['title_style']??array_replace($style,['y'=>10]));
        $result['title_style']=[
            'size'=>self::integer($title['size']??$result['text_style']['size'],12,160),
            'color'=>self::color($title['color']??$result['text_style']['color']),
            'outline'=>self::color($title['outline']??$result['text_style']['outline']),
            'outline_width'=>self::number($title['outline_width']??$result['text_style']['outline_width'],0,12),
            'y'=>self::number($title['y']??10,0,100),
            'align'=>self::choice($title['align']??$result['text_style']['align'],['left','center','right']),
            'title_range'=>self::range($title['title_range']??$result['text_style']['title_range'],0,600),
        ];
        $background=self::object($p['background']??[]);
        $result['background']=[
            'type'=>self::choice($background['type']??'color',['color','blur','media']),
            'color'=>self::color($background['color']??'#000000'),
            'material_ids'=>self::ids($background['material_ids']??[],1),
        ];
        $colors=self::object($p['colors']??[]);
        $result['colors']=[];foreach(['contrast'=>100,'saturation'=>100,'brightness'=>255,'hue'=>100] as $key=>$max)$result['colors'][$key]=self::number($colors[$key]??0,-$max,$max);
        $result['groups']=[];
        foreach($groups as $i=>$group){$g=self::object($group);$result['groups'][]=[
            'name'=>self::text($g['name']??('镜头'.($i+1)),40,true),
            'material_ids'=>self::ids($g['material_ids']??[]),
            'texts'=>self::texts($g['texts']??[],800),
            'voiceover_ids'=>self::ids($g['voiceover_ids']??[]),
            'duration'=>self::number($g['duration']??5,0.1,300),
        ];}
        $stickers=$p['stickers']??[];if(!is_array($stickers)||!array_is_list($stickers)||count($stickers)>50)throw new Invalid('贴纸池最多50组');
        $result['stickers']=[];foreach($stickers as $item){$s=self::object($item);$result['stickers'][]=[
            'material_ids'=>self::ids($s['material_ids']??[],2),
            'group'=>self::integer($s['group']??0,0,count($groups)),
            'x'=>self::number($s['x']??70,0,100),'y'=>self::number($s['y']??10,0,100),
            'width'=>self::number($s['width']??20,1,100),
        ];}
        $script=self::object($p['script']??[]);
        $result['script']=[];foreach(['brand'=>2000,'reference'=>2000,'purpose'=>200,'audience'=>200,'style'=>200,'topic'=>2000,'copy'=>10000] as $key=>$max)$result['script'][$key]=self::text($script[$key]??'',$max);
        $result['script']['source']=self::choice($script['source']??'brand',['brand','account','video']);
        return ClipFeatures::normalize($result,$p);
    }
    /** Material IDs paired with allowed types, used for both save and execution revalidation. */
    public static function references(array $c):array
    {
        $refs=[];$add=function(array $ids,array $kinds)use(&$refs){foreach($ids as $id)$refs[]=['id'=>$id,'kinds'=>$kinds];};
        $add($c['material_ids'],['video','image']);$add($c['music_ids'],['audio']);$add($c['voiceover_ids'],['voiceover']);$add($c['cover_ids'],['image']);
        $add($c['background']['material_ids'],['image','video']);
        foreach($c['groups'] as $g){$add($g['material_ids'],['video','image']);$add($g['voiceover_ids'],['voiceover']);}
        foreach($c['stickers'] as $s)$add($s['material_ids'],['image','video']);
        if(count(array_unique(array_column($refs,'id')))>300)throw new Invalid('每个工程最多引用300条不同素材');return $refs;
    }
}
