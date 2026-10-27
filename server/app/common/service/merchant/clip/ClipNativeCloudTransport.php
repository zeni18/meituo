<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

use AlibabaCloud\Client\AlibabaCloud;
use OSS\OssClient;

final class ClipNativeCloudTransport implements ClipCloudTransport
{
    public function rpc(array $config,string $action,array $parameters):array
    {
        $imm=in_array($action,['CreateFileCompressionTask','GetTask','DetectImageLabels','DetectImageTexts'],true);
        if(!$imm&&!in_array($action,['SubmitMediaProducingJob','GetMediaProducingJob','SearchPublicMediaInfo','GetPublicMediaInfo','SubmitIProductionJob','QueryIProductionJob','GetTemplate'],true))throw new \InvalidArgumentException('不支持的剪辑云操作');
        $region=ClipCloudProvider::region($config);$credentials=$this->credentials($config);$name='merchant_clip_'.bin2hex(random_bytes(8));
        // Never set the SDK default client: original framework channels keep their own clients.
        $client=isset($credentials['security_token'])?AlibabaCloud::stsClient($credentials['access_key_id'],$credentials['access_key_secret'],$credentials['security_token']):AlibabaCloud::accessKeyClient($credentials['access_key_id'],$credentials['access_key_secret']);
        $client->regionId($region)->options(['verify'=>true])->name($name);
        try{return AlibabaCloud::rpc()->client($name)->product($imm?'imm':'ICE')->version($imm?'2020-09-30':'2020-11-09')->action($action)->method('POST')->scheme('https')->host(($imm?'imm.':'ice.').$region.'.aliyuncs.com')->connectTimeout(8)->timeout(45)->options(['query'=>$parameters,'verify'=>true])->request()->toArray();}
        catch(\AlibabaCloud\Client\Exception\ServerException $e){throw new ClipCloudFailure((int)$e->getCode()>=500);}
        catch(\Throwable){throw new ClipCloudFailure(true,'云请求结果暂不确定，请核查任务；系统不会自动重复提交');}
        finally{AlibabaCloud::del($name);}
    }
    public function json(string $url,array $headers,array $body):array
    {
        $allowed=['https://ark.cn-beijing.volces.com/api/v3/responses','https://openspeech.bytedance.com/api/v3/tts/submit','https://openspeech.bytedance.com/api/v3/tts/query','https://openspeech.bytedance.com/api/v3/tts/voice_clone','https://openspeech.bytedance.com/api/v3/tts/get_voice','https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash','https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit','https://openspeech.bytedance.com/api/v3/auc/bigmodel/query'];
        if(!in_array($url,$allowed,true))throw new \InvalidArgumentException('云服务地址不在允许范围');
        $ch=curl_init($url);$lines=['Content-Type: application/json'];foreach($headers as $key=>$value){if(preg_match('/[\r\n]/',(string)$value))throw new \InvalidArgumentException('云凭证格式不正确');$lines[]=$key.': '.$value;}
        $raw='';$responseHeaders=[];
        curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode((object)$body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),CURLOPT_HTTPHEADER=>$lines,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>90,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,
            CURLOPT_WRITEFUNCTION=>static function($curl,$bytes)use(&$raw){if(strlen($raw)+strlen($bytes)>4*1024*1024)return 0;$raw.=$bytes;return strlen($bytes);},
            CURLOPT_HEADERFUNCTION=>static function($curl,$line)use(&$responseHeaders){$parts=explode(':',$line,2);if(count($parts)===2)$responseHeaders[strtolower(trim($parts[0]))]=trim($parts[1]);return strlen($line);}]);
        $ok=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
        if($ok===false||$status>=500)throw new ClipCloudFailure(true,'云请求结果暂不确定，请核查任务；系统不会自动重复提交');
        if($status<200||$status>=300)throw new ClipCloudFailure(false);
        return self::decodeJson($url,$raw,$responseHeaders);
    }
    public static function decodeJson(string $url,string $raw,array $responseHeaders):array
    {
        $asr=str_starts_with($url,'https://openspeech.bytedance.com/api/v3/auc/bigmodel/');
        $code=(string)($responseHeaders['x-api-status-code']??'');
        if($asr&&$code==='')throw new ClipCloudFailure(true,'识别服务未返回状态，请核查任务，勿重复提交');
        // A queued ASR query can carry an empty body. Only a successful final result needs JSON.
        $result=$raw===''&&$asr&&$code!=='20000000'?[]:json_decode($raw,true);
        if(!is_array($result))throw new ClipCloudFailure(true,'云服务返回格式异常，请核查任务');
        if($asr&&str_ends_with($url,'/query')){
            $result['_asr_status_code']=$code; // Trust the header, never a same-named body field.
            return $result;
        }
        // ASR returns business status in the HTTP headers, not the JSON body.
        if($code!==''&&$code!=='20000000')throw new ClipCloudFailure(str_starts_with($code,'550'),'语音识别失败，请检查资源开通和文件格式');
        return $result;
    }
    private function oss(array $config):OssClient
    {
        $region=ClipCloudProvider::region($config);$key=$this->credentials($config);
        $client=new OssClient($key['access_key_id'],$key['access_key_secret'],'https://oss-'.$region.'.aliyuncs.com',false,$key['security_token']??null);$client->setTimeout(90);$client->setConnectTimeout(8);return $client;
    }
    private function credentials(array $config):array
    {
        $key=$config['credentials'];if(empty($config['settings']['role_arn']))return $key;
        $name='merchant_clip_sts_'.bin2hex(random_bytes(8));
        // Explicit HTTPS verification, including the STS request; do not use the SDK's implicit role provider.
        AlibabaCloud::accessKeyClient($key['access_key_id'],$key['access_key_secret'])->options(['verify'=>true])->name($name);
        try{$result=AlibabaCloud::rpc()->client($name)->product('Sts')->version('2015-04-01')->action('AssumeRole')->method('POST')->scheme('https')->host('sts.aliyuncs.com')->regionId(ClipCloudProvider::region($config))->connectTimeout(8)->timeout(20)->options(['verify'=>true,'query'=>['RoleArn'=>$config['settings']['role_arn'],'RoleSessionName'=>'merchant-clip','DurationSeconds'=>900]])->request()->toArray();$c=$result['Credentials']??[];if(empty($c['AccessKeyId'])||empty($c['AccessKeySecret'])||empty($c['SecurityToken']))throw new \RuntimeException();return ['access_key_id'=>$c['AccessKeyId'],'access_key_secret'=>$c['AccessKeySecret'],'security_token'=>$c['SecurityToken']];}
        catch(\Throwable){throw new ClipCloudFailure(false,'剪辑角色授权失败，请检查 STS AssumeRole 权限和角色信任策略');}
        finally{AlibabaCloud::del($name);}
    }
    public function upload(array $config,string $bucket,string $key,string $path):void
    {
        try{$this->oss($config)->uploadFile($bucket,$key,$path,[OssClient::OSS_HEADERS=>['x-oss-object-acl'=>'private']]);}
        catch(\Throwable){throw new ClipCloudFailure(false,'素材云上传失败，请检查 OSS 开通、Bucket 地域和写入权限');}
    }
    public function signed(array $config,string $bucket,string $key,int $ttl=900):string
    {
        try{return $this->oss($config)->signUrl($bucket,$key,$ttl,'GET');}catch(\Throwable){throw new ClipCloudFailure(false,'无法读取云端文件，请检查 Bucket 权限');}
    }
    public static function speechHost(string $url):string
    {
        $parts=parse_url($url);$host=strtolower($parts['host']??'');
        if(($parts['scheme']??'')!=='https'||isset($parts['user'])||isset($parts['pass'])||isset($parts['port'])||!preg_match('/^(?:[a-z0-9-]+\.)*bytespeech\.com$/D',$host))throw new \InvalidArgumentException('语音下载域名未通过验证，请核对服务商返回地址');return $host;
    }
    public function downloadSpeech(string $url,string $path):void
    {
        $host=self::speechHost($url);$ips=gethostbynamel($host)?:[];$ip='';foreach($ips as $candidate)if(filter_var($candidate,FILTER_VALIDATE_IP,FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE)){$ip=$candidate;break;}if(!$ip)throw new ClipCloudFailure(false,'语音下载地址不可用');
        $file=fopen($path,'wb');if(!$file)throw new ClipCloudFailure(false,'无法保存配音文件');$size=0;$ch=curl_init($url);
        try{curl_setopt_array($ch,[CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_RESOLVE=>[$host.':443:'.$ip],CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>90,CURLOPT_WRITEFUNCTION=>static function($curl,$bytes)use($file,&$size){$size+=strlen($bytes);if($size>50*1024*1024)return 0;return fwrite($file,$bytes);}]);$ok=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);if($ok===false||$status!==200||$size<20)throw new ClipCloudFailure(false,'配音下载失败，请稍后重新查询');}
        finally{curl_close($ch);fclose($file);}
    }
}
