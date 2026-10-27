<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

use InvalidArgumentException as Invalid;

/** Bounded native jobs. Browser input never supplies a vendor payload, source URL or output path. */
final class ClipIntelligence
{
    public const FUNCTIONS=[
        'Cover'=>['智能封面','video','png'], 'VideoClip'=>['视频摘要','video','mp4'],
        'VideoDelogo'=>['去除图标','video','mp4'], 'VideoDetext'=>['去除画面字幕','video','mp4'],
        'CaptionExtraction'=>['提取画面字幕','video','srt'], 'VideoGreenScreenMatting'=>['绿幕抠像','video','webm'],
        'FaceBeauty'=>['人像美颜','video','mp4'], 'VideoH2V'=>['横屏转竖屏','video','mp4'],
        'MusicSegmentDetect'=>['副歌检测','audio','json'], 'AudioBeatDetection'=>['节拍检测','audio','json'],
        'AudioQualityAssessment'=>['音质检测','audio','json'], 'SpeechDenoise'=>['语音降噪','audio','wav'],
        'AudioMixing'=>['双音轨混音','audio','wav'], 'MusicDemix'=>['人声与伴奏分离','audio','wav'],
    ];
    public function __construct(private readonly ClipCloudTransport $transport=new ClipNativeCloudTransport()){}
    public static function catalog():array
    {
        $out=[];foreach(self::FUNCTIONS as $id=>[$name,$kind])$out[]=['id'=>$id,'name'=>$name,'kind'=>$kind];
        return $out;
    }
    public static function normalize(array $p):array
    {
        $f=$p['function']??'';if(!is_string($f)||!isset(self::FUNCTIONS[$f]))throw new Invalid('请选择支持的智能处理能力');
        $out=['function'=>$f,'params'=>[]];
        if($f==='Cover'){$model=$p['cover_type']??'png';if(!in_array($model,['png','gif'],true))throw new Invalid('封面格式不正确');$out['cover_type']=$model;if($model==='gif')$out['params']['Model']='gif';}
        if($f==='VideoDelogo')$out['params']['LogoModel']='tv,internet';
        if($f==='FaceBeauty')$out['params']['beauty_params']='whiten=20,smooth=50,face_thin=50';
        if($f==='CaptionExtraction'){$lang=$p['language']??'ch';if(!in_array($lang,['ch','en','ch_ml'],true))throw new Invalid('字幕语言不正确');$out['params']=['lang'=>$lang,'fps'=>5];}
        if($f==='AudioMixing'){$id=$p['second_material_id']??0;if((!is_int($id)&&!(is_string($id)&&ctype_digit($id)))||(int)$id<=0)throw new Invalid('请选择第二条本商家音轨');$out['second_material_id']=(int)$id;}
        return $out;
    }
    public static function validateFile(string $operation,array $input,array $asset,string $path):void
    {
        $kind=$asset['kind'];$ext=strtolower(pathinfo($path,PATHINFO_EXTENSION));
        if(in_array($operation,['image_labels','image_text'],true)){
            $size=@getimagesize($path);if($kind!=='image'||!in_array($ext,['jpg','jpeg','png'],true)||!$size||filesize($path)>20*1024*1024||max($size[0],$size[1])>30000||$size[0]*$size[1]>250000000)throw new Invalid('图片识别支持20MB内的JPG或PNG，边长不超过30000像素');
            if($operation==='image_text'&&(min($size[0],$size[1])<20||max($size[0],$size[1])/min($size[0],$size[1])>=2))throw new Invalid('文字识别图片短边须至少20像素，长短边比例须小于2');
            return;
        }
        $f=$input['function'];$expected=self::FUNCTIONS[$f][1];
        if($expected==='video'?($kind!=='video'||!in_array($ext,['mp4','mov'],true)):(!in_array($kind,['audio','voiceover'],true)||!in_array($ext,['mp3','wav','m4a','aac','ogg'],true)))throw new Invalid('该能力需要'.($expected==='video'?'MP4或MOV视频':'音频素材'));
        if(filesize($path)>100*1024*1024||($asset['duration']??0)<=0||$asset['duration']>600)throw new Invalid('智能处理素材须在100MB、10分钟以内，且时长可读取');
        if(in_array($f,['SpeechDenoise','AudioQualityAssessment'],true)){
            $wav=self::wav($path);$allowed=$f==='SpeechDenoise'?[16000,48000]:[8000,11025,12000,16000,22050,24000,32000,44100,48000];
            if($ext!=='wav'||!$wav||$wav['format']!==1||$wav['bits']!==16||!in_array($wav['channels'],[1,2],true)||!in_array($wav['rate'],$allowed,true))throw new Invalid($f==='SpeechDenoise'?'降噪需要16位PCM WAV，采样率16kHz或48kHz':'音质检测需要16位PCM WAV，采样率8～48kHz');
        }
    }
    private static function wav(string $path):?array
    {
        $h=fopen($path,'rb');if(!$h)return null;
        try{$head=fread($h,12);if(strlen($head)!==12||substr($head,0,4)!=='RIFF'||substr($head,8,4)!=='WAVE')return null;
            for($i=0;$i<100&&!feof($h);$i++){$chunk=fread($h,8);if(strlen($chunk)!==8)return null;$len=unpack('V',substr($chunk,4))[1];if($len>1048576)return null;
                if(substr($chunk,0,4)==='fmt '){$bytes=fread($h,min($len,16));if(strlen($bytes)<16)return null;return unpack('vformat/vchannels/Vrate/Vbytes/vblock/vbits',$bytes);}
                if(fseek($h,$len+($len%2),SEEK_CUR)!==0)return null;
            }return null;
        }finally{fclose($h);}
    }
    public function image(array $imm,array $oss,array $input,array $media,bool $text):array
    {
        $p=['ProjectName'=>$imm['settings']['project'],'SourceURI'=>'oss://'.$oss['settings']['bucket'].'/'.$media[$input['material_id']]['key']];
        if(!$text)$p['Threshold']=0.7;
        $r=$this->transport->rpc($imm,$text?'DetectImageTexts':'DetectImageLabels',$p);
        if($text){if(!is_string($r['OCRTexts']??null))throw new ClipCloudFailure(true,'文字识别结果格式未确认');return ['text'=>mb_substr($r['OCRTexts'],0,10000),'source_material_id'=>$input['material_id']];}
        if(!is_array($r['Labels']??null))throw new ClipCloudFailure(true,'标签识别结果格式未确认');
        $labels=[];foreach(array_slice($r['Labels'],0,50)as $row){$name=trim((string)($row['LabelName']??''));$confidence=$row['LabelConfidence']??0;if($name===''||mb_strlen($name)>30||!is_numeric($confidence)||$confidence<0.7||$confidence>1)continue;$labels[$name]=['name'=>$name,'confidence'=>(float)$confidence];}
        return ['labels'=>array_values($labels),'source_material_id'=>$input['material_id']];
    }
    public function submit(array $ims,array $oss,array $input,array $media,string $prefix,string $token):array
    {
        $f=$input['function'];$params=$input['params'];
        if($f==='AudioMixing')$params['inputs']=[['file'=>$this->transport->signed($oss,$oss['settings']['bucket'],$media[$input['second_material_id']]['key'],14400)]];
        $ext=$f==='Cover'?($input['cover_type']??'png'):self::FUNCTIONS[$f][2];
        $r=$this->transport->rpc($ims,'SubmitIProductionJob',['Name'=>'Merchant '.$token,'FunctionName'=>$f,'Input'=>json_encode(['Type'=>'OSS','Media'=>'oss://'.$oss['settings']['bucket'].'/'.$media[$input['material_id']]['key']],JSON_THROW_ON_ERROR),'Output'=>json_encode(['Type'=>'OSS','Media'=>'oss://'.$ims['settings']['output_bucket'].'/'.$prefix.'/{sequenceId}-{resultType}.'.$ext],JSON_THROW_ON_ERROR),'JobParams'=>json_encode((object)$params,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'UserData'=>$token]);
        if(empty($r['JobId']))throw new ClipCloudFailure(true,'智能处理未返回任务编号，请核查原任务');return ['provider_id'=>(string)$r['JobId']];
    }
    public static function result(array $r,string $function,string $prefix):array
    {
        if(($r['FunctionName']??'')!==$function)throw new ClipCloudFailure(true,'智能处理返回能力不匹配');
        $state=match($r['Status']??''){'Success'=>'success','Fail'=>'failed','Queuing','Analysing'=>'submitted',default=>throw new ClipCloudFailure(true,'智能处理状态未确认')};
        if($state!=='success')return ['state'=>$state];
        $files=[];foreach($r['OutputFiles']??[] as $key){
            if(!is_string($key)||strlen($key)>1000||!str_starts_with($key,$prefix.'/')||str_contains($key,'..')||!preg_match('#^[A-Za-z0-9/_\-.]+$#D',$key))throw new ClipCloudFailure(true,'智能处理输出路径未通过校验');
            if(!in_array(strtolower(pathinfo($key,PATHINFO_EXTENSION)),['png','gif','jpg','jpeg','mp4','webm','wav','json','srt'],true))throw new ClipCloudFailure(true,'智能处理输出类型未通过校验');
            $files[]=$key;if(count($files)>100)throw new ClipCloudFailure(true,'智能处理输出数量异常');
        }
        $raw=json_decode((string)($r['Result']??'{}'),true);$details=[];
        if($function==='VideoClip')foreach(array_slice($raw['VideoSummaryList']??[],0,100)as $one){$start=$one['StartTime']??null;$end=$one['EndTime']??null;if(is_numeric($start)&&is_numeric($end)&&$start>=0&&$start<$end&&$end<=600)$details[]=['start'=>(float)$start,'end'=>(float)$end];}
        if($function==='MusicSegmentDetect')foreach(array_slice(is_array($raw)?$raw:[],0,100)as $one){if(is_numeric($one['start']??null)&&is_numeric($one['end']??null)&&$one['start']>=0&&$one['start']<$one['end']&&$one['end']<=600)$details[]=['start'=>(float)$one['start'],'end'=>(float)$one['end'],'title'=>mb_substr((string)($one['title']??''),0,50)];}
        if($function==='AudioQualityAssessment')foreach(array_slice(is_array($raw)?$raw:[],0,2)as $one){if(is_array($one))$details[]=array_intersect_key($one,array_flip(['Channel','MOS','MOS(0-5)','Noisiness','Loudness','Coloration','Discontinuity','Speech Ratio','Total Duration']));}
        if(!$files&&!in_array($function,['VideoClip','AudioQualityAssessment','MusicSegmentDetect'],true))throw new ClipCloudFailure(true,'智能处理输出尚未确认，请稍后查询');
        return ['state'=>'success','function'=>$function,'files'=>$files,'details'=>$details];
    }
    public function status(array $ims,string $id,string $function,string $prefix):array
    {
        $r=$this->transport->rpc($ims,'QueryIProductionJob',['JobId'=>$id]);
        if(($r['JobId']??'')!==$id)throw new ClipCloudFailure(true,'智能处理返回任务编号不匹配');
        return self::result($r,$function,$prefix);
    }
}
