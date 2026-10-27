<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;

use app\common\service\power\MarketTextModelProviderException;
use InvalidArgumentException as Invalid;

/** Official, fixed-host text transport. Credentials never enter model parameters or logs. */
final class DeepSeekText
{
    public const ORIGIN='https://api.deepseek.com';
    public const MODEL='deepseek-flash';
    public function __construct(private readonly ?\Closure $http=null){}
    private static function uncertain(string $message,array $result=[]):never
    {
        throw new MarketTextModelProviderException($message,false,$result+['content'=>'','usage'=>[],'provider_request_id'=>'']);
    }
    public function generate(string $key,array $messages,string $system,int $maxTokens,array $params,int $timeout):array
    {
        if($key===''||preg_match('/[\x00-\x20\x7f]/',$key))throw new Invalid('请先配置 DeepSeek API Key');
        foreach($messages as $message)if(!is_string($message['content']??null))throw new Invalid('GEO 文本直连只接收文本资料');
        if($system!=='')array_unshift($messages,['role'=>'system','content'=>$system]);
        $payload=['model'=>self::MODEL,'messages'=>$messages,'stream'=>false,'thinking'=>['type'=>'disabled'],'max_tokens'=>max(1,min(8192,$maxTokens))];
        if(($params['enable_thinking']??false)===true){$payload['thinking']['type']='enabled';$payload['reasoning_effort']='high';}
        if(($params['response_format']['type']??'')==='json_object')$payload['response_format']=['type'=>'json_object'];
        $reply=$this->request('POST','/chat/completions',$key,$payload,min(240,max(15,$timeout)));
        $body=$reply['body'];$choice=$body['choices'][0]??[];
        $result=['content'=>is_string($choice['message']['content']??null)?$choice['message']['content']:'','content_source'=>'content','provider_request_id'=>(string)($body['id']??''),'usage'=>[]];
        $usage=$body['usage']??[];
        if(is_array($usage)&&isset($usage['prompt_tokens'],$usage['completion_tokens'])&&is_int($usage['prompt_tokens'])&&is_int($usage['completion_tokens'])&&$usage['prompt_tokens']>=0&&$usage['completion_tokens']>=0&&$usage['prompt_tokens']+$usage['completion_tokens']>0)$result['usage']=['prompt_tokens'=>$usage['prompt_tokens'],'completion_tokens'=>$usage['completion_tokens'],'total_tokens'=>$usage['prompt_tokens']+$usage['completion_tokens']];
        if(($body['model']??'')!==self::MODEL&&!str_starts_with((string)($body['model']??''),'deepseek-v4.1-flash'))self::uncertain('DeepSeek 返回模型不匹配，请核对原任务',$result);
        if(($choice['finish_reason']??'')!=='stop'||trim($result['content'])===''||$result['usage']===[])self::uncertain('DeepSeek 返回未完整结束或缺少用量，请核对原任务',$result);
        return $result;
    }
    public function inspect(string $key):array
    {
        $reply=$this->request('GET','/user/balance',$key,null,20);$data=$reply['body'];
        if(!is_bool($data['is_available']??null)||!is_array($data['balance_infos']??null))throw new Invalid('DeepSeek 余额格式不正确');
        $balances=[];foreach($data['balance_infos']as $row)if(is_array($row)&&in_array($row['currency']??'',['CNY','USD'],true)&&is_numeric($row['total_balance']??null))$balances[]=['currency'=>$row['currency'],'total_balance'=>(string)$row['total_balance']];
        return ['available'=>$data['is_available'],'balances'=>$balances,'model'=>self::MODEL,'notice'=>($data['is_available']?'DeepSeek 鉴权与余额查询完成。':'DeepSeek 鉴权完成，账户余额当前不足。').'未生成内容；模型生成仍需配置售价并单独确认费用。'];
    }
    private function request(string $method,string $path,string $key,?array $payload,int $timeout):array
    {
        if($key===''||preg_match('/[\x00-\x20\x7f]/',$key))throw new Invalid('请先配置 DeepSeek API Key');
        $headers=['Authorization: Bearer '.$key,'Content-Type: application/json'];
        if($this->http){try{$reply=($this->http)($method,self::ORIGIN.$path,$payload,$headers);}catch(\Throwable){self::uncertain('DeepSeek 响应未确认，请核对原请求，不会自动重发');}}
        else{
            $ch=curl_init(self::ORIGIN.$path);$buffer='';
            curl_setopt_array($ch,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>$timeout,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_WRITEFUNCTION=>static function($ch,string $chunk)use(&$buffer){if(strlen($buffer)+strlen($chunk)>2097152)return 0;$buffer.=$chunk;return strlen($chunk);}]);
            if($payload!==null)curl_setopt($ch,CURLOPT_POSTFIELDS,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
            $ok=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
            if($ok===false)self::uncertain('DeepSeek 响应未确认，请核对原请求，不会自动重发');
            $reply=['status'=>$status,'body'=>json_decode($buffer,true)];
        }
        $status=(int)($reply['status']??0);
        if(in_array($status,[400,401,402,403,404,422],true))throw new Invalid(match($status){401,403=>'DeepSeek 鉴权失败，请检查 API Key',402=>'DeepSeek 账户余额不足',default=>'DeepSeek 拒绝本次请求，请检查配置与输入'});
        if($status!==200||!is_array($reply['body']??null)||isset($reply['body']['error']))self::uncertain('DeepSeek 返回状态未确认，请核对原请求，不会自动重发');
        return $reply;
    }
}
