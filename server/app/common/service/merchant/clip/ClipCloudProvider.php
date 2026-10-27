<?php
declare(strict_types=1);
namespace app\common\service\merchant\clip;

final class ClipCloudProvider
{
    public function __construct(private readonly ClipCloudTransport $transport=new ClipNativeCloudTransport()){}
    public static function ready(string $code):bool{return in_array($code,['oss','ims','imm','tts','icl','llm','asr'],true);}
    public static function region(array $config):string
    {
        $region=(string)($config['settings']['region']??'');if(!preg_match('/^[a-z]{2}-[a-z]+-[0-9]+$|^cn-[a-z]+$/D',$region))throw new \InvalidArgumentException('请填写标准地域 ID，例如 cn-shanghai');return $region;
    }
    public static function key(array $config,int $tenant,int $user,string $token,string $suffix):string
    {
        $prefix=trim((string)($config['settings']['prefix']??''),"/ \t\n\r\0\x0B");
        if($prefix==='')$prefix='merchant-clip';
        return $prefix.'/t'.$tenant.'/u'.$user.'/'.$token.'/'.$suffix;
    }
    public static function url(array $config,string $bucket,string $key):string{return 'https://'.$bucket.'.oss-'.self::region($config).'.aliyuncs.com/'.implode('/',array_map('rawurlencode',explode('/',$key)));}
    public function render(array $config,array $plan,array $media,string $key,string $token):array
    {
        if(!empty($plan['public_music_id']))(new ClipPublicMusic($this->transport))->assertAuthorized($config,$plan['public_music_id']);
        $url=self::url($config,$config['settings']['output_bucket'],$key);
        $result=$this->transport->rpc($config,'SubmitMediaProducingJob',['ClientToken'=>$token,'Timeline'=>json_encode(ClipImsTimeline::compile($plan,$media),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'OutputMediaTarget'=>'oss-object','OutputMediaConfig'=>json_encode(ClipImsTimeline::output($plan,$url),JSON_THROW_ON_ERROR),'ProjectMetadata'=>json_encode(['Title'=>'Merchant clip '.$token]),'EditingProduceConfig'=>json_encode(['AutoRegisterOutputImsMedia'=>false,'NeedSnapshot'=>false,'NeedSprite'=>false])]);
        if(empty($result['JobId']))throw new ClipCloudFailure(true,'云端未返回任务 ID，请人工核查');return ['provider_id'=>(string)$result['JobId']];
    }
    public function renderStatus(array $config,string $id):array
    {
        $row=$this->transport->rpc($config,'GetMediaProducingJob',['JobId'=>$id])['MediaProducingJob']??[];
        if(!isset($row['Status']))throw new ClipCloudFailure(true,'任务查询响应异常，请稍后查询');
        return ['state'=>match($row['Status']){'Success'=>'success','Failed'=>'failed',default=>'submitted'},'duration'=>(float)($row['Duration']??0),'progress'=>max(0,min(100,(int)($row['Progress']??0)))];
    }
    /** Sources are constructed from owned completed jobs, never from browser URLs or prefixes. */
    public function package(array $config,array $sources,string $key,string $token):array
    {
        if(!$sources||count($sources)>100)throw new \InvalidArgumentException('每次请选择1～100个成片');
        foreach($sources as $source)if(($source['Mode']??'')!=='fullname'||!str_starts_with($source['URI']??'','oss://')||!preg_match('~^/clip-[1-9][0-9]*\.mp4$~D',$source['Alias']??''))throw new \InvalidArgumentException('打包文件列表不正确');
        $result=$this->transport->rpc($config,'CreateFileCompressionTask',[
            'ProjectName'=>$config['settings']['project'],
            'Sources'=>json_encode($sources,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),
            'TargetURI'=>'oss://'.$config['settings']['output_bucket'].'/'.$key,
            'CompressedFormat'=>'zip','UserData'=>$token,
        ]);
        if(empty($result['TaskId']))throw new ClipCloudFailure(true,'打包服务未返回任务编号，请人工核查，勿重复提交');
        return ['provider_id'=>(string)$result['TaskId']];
    }
    public function packageStatus(array $config,string $id):array
    {
        $row=$this->transport->rpc($config,'GetTask',['ProjectName'=>$config['settings']['project'],'TaskType'=>'FileCompression','TaskId'=>$id]);
        return ['state'=>match($row['Status']??''){
            'Succeeded'=>'success','Failed'=>'failed','Running'=>'submitted',
            default=>throw new ClipCloudFailure(true,'打包任务状态暂不确定，请稍后查询'),
        }];
    }
    public function script(array $config,array $script):array
    {
        $prompt="你是门店短视频编导。根据提供的信息编写中文口播文案，按镜头分段。只输出口播文案，不要解释，不要虚构产品事实，最多3000字。以下是用户提供的创作信息：\n".json_encode($script,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        $result=$this->transport->json('https://ark.cn-beijing.volces.com/api/v3/responses',['Authorization'=>'Bearer '.$config['credentials']['api_key']],['model'=>$config['settings']['model_id'],'input'=>$prompt,'max_output_tokens'=>4096,'store'=>false]);
        $text='';foreach($result['output']??[] as $item)if(($item['type']??'')==='message')foreach($item['content']??[] as $content)if(($content['type']??'')==='output_text')$text.=(string)($content['text']??'');
        $text=trim($text);if($text===''||mb_strlen($text)>10000)throw new ClipCloudFailure(false,'模型未返回有效文案，请检查模型兼容性');return ['text'=>$text];
    }
    public function speakers(array $config):array{return array_values(array_filter(preg_split('/[\s,]+/',$config['settings']['speaker_ids']??'')));}
    public function topics(array $config,array $script):array
    {
        $prompt="你是短视频选题策划。仅根据用户资料生成6个可执行的短视频选题。资料中的网址仅是来源标识，不代表已经读取页面，不得编造其中内容、流量、排名或品牌事实。没有业务资料时列出中性选题。只返回JSON：{\"topics\":[\"选题一\",\"选题二\"]}。每个选题最多200字。用户资料：\n".json_encode($script,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        $r=$this->transport->json('https://ark.cn-beijing.volces.com/api/v3/responses',['Authorization'=>'Bearer '.$config['credentials']['api_key']],['model'=>$config['settings']['model_id'],'input'=>$prompt,'max_output_tokens'=>2048,'store'=>false]);
        $text='';foreach($r['output']??[]as $item)if(($item['type']??'')==='message')foreach($item['content']??[]as $content)if(($content['type']??'')==='output_text')$text.=(string)($content['text']??'');
        $text=trim($text);if(str_starts_with($text,'```'))$text=preg_replace('/^```(?:json)?\s*|\s*```$/u','',$text);
        $data=json_decode($text,true);$topics=$data['topics']??null;if(!is_array($topics)||!array_is_list($topics)||!$topics||count($topics)>10)throw new ClipCloudFailure(true,'选题结果格式未确认，请查看原任务，勿重复提交');
        return ['topics'=>array_values(array_unique(array_map(fn($v)=>ClipConfiguration::text($v,200,true),$topics)))];
    }
    private function speechHeaders(array $config,string $token):array{return ['X-Api-Key'=>$config['credentials']['api_key'],'X-Api-Resource-Id'=>$config['settings']['resource_id'],'X-Api-Request-Id'=>$token];}
    private function speechResult(array $result):array{if(($result['code']??0)!==20000000)throw new ClipCloudFailure(false,'语音服务拒绝请求，请检查资源和音色授权');return $result['data']??[];}
    public function voice(array $config,string $text,string $speaker,string $token,int $user):array
    {
        if(!in_array($speaker,$this->speakers($config),true))throw new \InvalidArgumentException('该音色未获得当前 OEM 配置授权');
        $params=['text'=>$text,'speaker'=>$speaker,'audio_params'=>['format'=>'mp3','sample_rate'=>24000,'speech_rate'=>0,'enable_timestamp'=>true]];
        if(($config['settings']['resource_id']??'')==='seed-icl-2.0')$params['model']='seed-tts-2.0-standard';
        $data=$this->speechResult($this->transport->json('https://openspeech.bytedance.com/api/v3/tts/submit',$this->speechHeaders($config,$token),['user'=>['uid'=>(string)$user],'unique_id'=>$token,'req_params'=>$params]));
        if(empty($data['task_id']))throw new ClipCloudFailure(true,'语音服务未返回任务 ID，请人工核查');return ['provider_id'=>(string)$data['task_id']];
    }
    public function voiceStatus(array $config,string $id,string $token):array
    {
        $data=$this->speechResult($this->transport->json('https://openspeech.bytedance.com/api/v3/tts/query',$this->speechHeaders($config,$token),['task_id'=>$id]));
        return ['state'=>match((int)($data['task_status']??0)){1=>'submitted',2=>'success',3=>'failed',default=>throw new ClipCloudFailure(true,'语音任务状态异常')},'audio_url'=>(string)($data['audio_url']??''),'sentences'=>$data['sentences']??[]];
    }
    public function trainVoice(array $config,string $customId,string $bytes,string $format,string $requestId):array
    {
        if(strlen($bytes)>10*1024*1024||!in_array($format,['wav','mp3','ogg','m4a','aac'],true))throw new \InvalidArgumentException('声音样本格式或大小不正确');
        return $this->transport->json('https://openspeech.bytedance.com/api/v3/tts/voice_clone',
            ['X-Api-Key'=>$config['credentials']['api_key'],'X-Api-Request-Id'=>$requestId],
            ['speaker_id'=>'custom_speaker_id','custom_speaker_id'=>$customId,'audio'=>['data'=>base64_encode($bytes),'format'=>$format],'language'=>0,
             'extra_params'=>['demo_text'=>'你好，这是我的专属音色，欢迎收听。']]);
    }
    public function trainedVoiceStatus(array $config,string $customId,string $requestId):array
    {
        return $this->transport->json('https://openspeech.bytedance.com/api/v3/tts/get_voice',
            ['X-Api-Key'=>$config['credentials']['api_key'],'X-Api-Request-Id'=>$requestId],
            ['speaker_id'=>'custom_speaker_id','custom_speaker_id'=>$customId]);
    }
    public function transcribe(array $config,string $audioUrl,string $token,int $user):array
    {
        $resource=$config['settings']['resource_id'];
        $async=in_array($resource,['volc.seedasr.auc','volc.bigasr.auc'],true);
        if(!$async&&$resource!=='volc.bigasr.auc_turbo')throw new \InvalidArgumentException('请选择录音文件识别2.0或极速版资源 ID');
        $headers=$this->speechHeaders($config,$token)+['X-Api-Sequence'=>'-1'];
        $result=$this->transport->json('https://openspeech.bytedance.com/api/v3/auc/bigmodel/'.($async?'submit':'recognize/flash'),$headers,['user'=>['uid'=>(string)$user],'audio'=>['url'=>$audioUrl],'request'=>['model_name'=>'bigmodel','enable_itn'=>true,'enable_punc'=>true,'show_utterances'=>true]]);
        // Standard API also identifies the task by the submitted X-Api-Request-Id.
        if($async)return ['provider_id'=>(string)($result['task_id']??$token)];
        return $this->transcriptionResult($result);
    }
    public function transcribeStatus(array $config,string $id):array
    {
        $result=$this->transport->json('https://openspeech.bytedance.com/api/v3/auc/bigmodel/query',$this->speechHeaders($config,$id),[]);
        $code=(string)($result['_asr_status_code']??'');
        if(in_array($code,['20000001','20000002'],true))return ['state'=>'submitted'];
        if($code==='20000003')return ['state'=>'success','text'=>'','utterances'=>[]];
        if($code==='20000000'){
            try{return ['state'=>'success']+$this->transcriptionResult($result);}
            catch(ClipCloudFailure $e){if($e->uncertain)throw $e;return ['state'=>'failed'];}
        }
        if(str_starts_with($code,'450'))return ['state'=>'failed'];
        throw new ClipCloudFailure(true,'字幕查询暂未完成，请稍后查询；不会重复提交');
    }
    private function transcriptionResult(array $result):array
    {
        $r=$result['result']??null;
        if(!is_array($r)||!isset($r['text'])||!is_string($r['text']))throw new ClipCloudFailure(true,'识别结果格式异常，请核查原任务');
        $text=trim($r['text']);if(mb_strlen($text)>10000)throw new ClipCloudFailure(false,'识别文本过长，请缩短素材');
        return ['text'=>$text,'utterances'=>is_array($r['utterances']??null)?$r['utterances']:[]];
    }
}
