<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

/** Local file-only probing. Never invoke a shell or pass browser-supplied URLs to ffprobe. */
final class ClipMediaProbe
{
    public static function duration(array $file):?float
    {
        if(($file['storage_engine']??'')!=='local')return null;
        $base=realpath(root_path().'public/uploads');
        $path=realpath(root_path().'public/'.ltrim((string)$file['uri'],'/'));
        if(!$base||!$path||!is_file($path)||!str_starts_with(str_replace('\\','/',$path),str_replace('\\','/',$base).'/'))return null;
        return self::localDuration($path);
    }
    /** Trusted server-local files only; callers must enforce their own storage boundary. */
    public static function localDuration(string $path):?float
    {
        if(!is_file($path))return null;
        $cache=hash('sha256',$path.':'.filesize($path).':'.filemtime($path));$key='merchant_clip_probe_'.$cache;
        $cached=cache($key);if(is_numeric($cached)&&is_finite((float)$cached)&&(float)$cached>0)return (float)$cached;
        $bin=(string)env('MERCHANT_CLIP_FFPROBE','ffprobe');
        if(!is_file($bin)&&PHP_OS_FAMILY==='Windows'){$link=getenv('LOCALAPPDATA').'/Microsoft/WinGet/Links/ffprobe.exe';if(is_file($link))$bin=$link;}
        if(!function_exists('proc_open'))throw new \InvalidArgumentException('素材时长读取服务未就绪，请联系管理员检查媒体探测组件');
        $pipes=[];$proc=@proc_open([$bin,'-v','error','-protocol_whitelist','file','-show_entries','format=duration:stream=codec_type,duration','-of','json',$path],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,null,['bypass_shell'=>true]);
        if(!is_resource($proc))throw new \InvalidArgumentException('素材时长读取服务未就绪，请联系管理员检查媒体探测组件');
        fclose($pipes[0]);stream_set_blocking($pipes[1],false);stream_set_blocking($pipes[2],false);$out='';$start=microtime(true);
        $timedOut=false;
        do{$out.=stream_get_contents($pipes[1]);stream_get_contents($pipes[2]);$status=proc_get_status($proc);if(!$status['running'])break;if(microtime(true)-$start>8){$timedOut=true;proc_terminate($proc);break;}usleep(20000);}while(true);
        $out.=stream_get_contents($pipes[1]);fclose($pipes[1]);fclose($pipes[2]);$closed=proc_close($proc);$exit=(int)($status['exitcode']??-1);if($exit<0)$exit=$closed;
        if($timedOut)throw new \InvalidArgumentException('素材时长读取超时，请稍后重试');
        if(in_array($exit,[126,127],true))throw new \InvalidArgumentException('素材时长读取服务未就绪，请联系管理员检查媒体探测组件');
        if($exit!==0)return null;
        $data=json_decode($out,true);$value=$data['format']['duration']??null;$duration=is_numeric($value)?(float)$value:0.0;
        if(!is_finite($duration)||$duration<=0){
            $duration=0.0;
            foreach($data['streams']??[]as $stream){$value=$stream['duration']??null;if(in_array($stream['codec_type']??'',['video','audio'],true)&&is_numeric($value)&&is_finite((float)$value)&&(float)$value>0)$duration=max($duration,(float)$value);}
        }
        if(!is_finite($duration)||$duration<=0)return null;cache($key,$duration,3600);return $duration;
    }
}
