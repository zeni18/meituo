<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;

use InvalidArgumentException as Invalid;

/** GEO Partner API v1.3: one persisted local job = one direct-prompt run. */
final class PartnerVisibility
{
    public const ORIGIN='https://118.89.28.187';
    public const PLATFORMS=[
        '网页端'=>['DeepSeek'=>'deepseek','豆包'=>'doubao','腾讯元宝'=>'yuanbao','通义千问'=>'qwen','Kimi'=>'kimi','文心一言'=>'baiduai','蚂蚁阿福'=>'antafu','夸克'=>'quark','微博智搜'=>'weibo_zhisou','抖音AI'=>'douyinai','ChatGPT'=>'chatgpt','Google AI'=>'googleai','Bing AI'=>'bingai_overviews'],
        'App端'=>['DeepSeek'=>'deepseek_mobile','豆包'=>'doubao_mobile','腾讯元宝'=>'yuanbao_mobile','通义千问'=>'qianwen_mobile','文心一言'=>'baidu_mobile','小红书点点'=>'xiaohongshu_mobile'],
    ];
    public function __construct(private readonly ?\Closure $transport=null) {}
    public static function origin(string $value):string
    {
        $value=rtrim(trim($value),'/');$p=parse_url($value);$host=strtolower($p['host']??'');
        if(!$p||($p['scheme']??'')!=='https'||isset($p['user'])||isset($p['pass'])||isset($p['port'])||isset($p['query'])||isset($p['fragment'])||!in_array($p['path']??'',['','/api/v1'],true))throw new Invalid('请填写HTTPS服务地址，可带 /api/v1，不含端口、账号或参数');
        if(filter_var($host,FILTER_VALIDATE_IP)){if(!MoliVisibility::publicIp($host))throw new Invalid('服务地址必须为公网IPv4或正式域名');}
        elseif(!preg_match('/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/D',$host))throw new Invalid('服务地址必须为公网IPv4或正式域名');
        return 'https://'.$host;
    }
    public static function platform(string $name,string $surface):string
    {
        return self::PLATFORMS[$surface][$name]??throw new Invalid($name.'暂不支持所选检测端，请调整诊断范围');
    }
    public static function taskId(mixed $id):string
    {
        if(!is_string($id)||!preg_match('/^[a-zA-Z0-9_-]{8,64}$/D',$id))throw new PartnerVisibilityReview('供应商任务编号无效，需核对原任务');return $id;
    }
    public static function pathAllowed(string $method,string $path):bool
    {
        if($method==='POST')return preg_match('#^/api/v1/(?:runs|brands(?:/[a-zA-Z0-9_-]{1,100}/questions)?)$#D',$path)===1;
        return $method==='GET'&&preg_match('#^/api/v1/(?:usage|platforms|brands|brands/[a-zA-Z0-9_-]{1,100}/(?:questions|runs|sources)|brands/[a-zA-Z0-9_-]{1,100}/overview(?:\?days=[1-9][0-9]{0,3})?|runs/[a-zA-Z0-9_-]{8,64}(?:/report)?|screenshots/[a-zA-Z0-9_-]{1,100})$#D',$path)===1;
    }
    /** Only approved paths; credentials never enter URLs, logs or merchant results. */
    public function request(array $connection,string $method,string $path,?array $body=null,string $idempotency=''):array
    {
        if(!self::pathAllowed($method,$path))throw new Invalid('GEO服务商接口路径无效');
        if($method==='POST'&&!preg_match('/^[a-zA-Z0-9_.-]{1,80}$/D',$idempotency))throw new Invalid('采样请求缺少有效幂等编号');
        $origin=self::origin($connection['settings']['api_origin']??'');$token=$connection['credentials']['api_key']??'';
        if(!is_string($token)||$token===''||preg_match('/[\x00-\x20\x7f]/',$token))throw new Invalid('请配置服务商 API Key');
        $headers=['Authorization: Bearer '.$token,'Content-Type: application/json','Accept: application/json'];if($method==='POST')$headers[]='Idempotency-Key: '.$idempotency;
        if($this->transport)$r=($this->transport)($method,$path,$body,$headers);
        else {
            $host=(string)parse_url($origin,PHP_URL_HOST);$ips=filter_var($host,FILTER_VALIDATE_IP)?[$host]:gethostbynamel($host);
            if(!$ips)throw new GeoProviderFailure(false,'服务商域名解析失败，采样尚未提交');
            foreach($ips as $ip)if(!MoliVisibility::publicIp($ip))throw new GeoProviderFailure(false,'服务商域名不能指向本机、内网或保留地址');
            $curl=curl_init($origin.$path);$raw='';$responseHeaders=[];
            curl_setopt_array($curl,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>35,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROXY=>'',CURLOPT_RESOLVE=>[$host.':443:'.$ips[0]],CURLOPT_WRITEFUNCTION=>static function($c,$s)use(&$raw){if(strlen($raw)+strlen($s)>4194304)return 0;$raw.=$s;return strlen($s);},CURLOPT_HEADERFUNCTION=>static function($c,$s)use(&$responseHeaders){$parts=explode(':',$s,2);if(count($parts)===2&&in_array(strtolower(trim($parts[0])),['x-request-id','x-billing-charged-cents','x-balance-cents','content-type'],true))$responseHeaders[strtolower(trim($parts[0]))]=trim($parts[1]);return strlen($s);}]);
            if($body!==null)curl_setopt($curl,CURLOPT_POSTFIELDS,json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
            $ok=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);$error=curl_errno($curl);curl_close($curl);
            if($ok===false){$beforeSend=in_array($error,[CURLE_COULDNT_RESOLVE_HOST,CURLE_COULDNT_CONNECT,CURLE_PEER_FAILED_VERIFICATION],true);throw new GeoProviderFailure(!$beforeSend,$error===CURLE_PEER_FAILED_VERIFICATION?'服务商HTTPS证书校验失败，请配置受信任证书后重试':'服务商响应未确认，请核对原任务，勿重复提交');}
            $mime=strtolower(trim(explode(';',$responseHeaders['content-type']??'')[0]));
            $data=str_starts_with($path,'/api/v1/screenshots/')&&$status===200&&in_array($mime,['image/png','image/jpeg','image/webp'],true)?['mime'=>$mime,'base64'=>base64_encode($raw)]:json_decode($raw,true);
            $r=['status'=>$status,'body'=>$data,'headers'=>$responseHeaders];
        }
        $status=(int)($r['status']??0);$data=$r['body']??null;
        if(in_array($status,[400,401,402,403,404],true))throw new GeoProviderFailure(false,match($status){401=>'服务商密钥无效或已过期',402=>'服务商账户余额不足',403=>'服务商接口已关闭或密钥权限不足',404=>'供应商原任务不存在或无查询权限',default=>'服务商拒绝采样参数，请核对配置'});
        // A conflict may refer to an already charged request; never infer a refund.
        if($status===409)throw new GeoProviderFailure(true,'服务商幂等冲突或销售价未配置，请核对原请求');
        if(!in_array($status,$method==='POST'?($path==='/api/v1/runs'?[202]:[201]):[200],true)||!is_array($data))throw new GeoProviderFailure(true,'服务商响应待核对，请稍后查询原任务');
        return $data;
    }
    public function submit(array $connection,array $payload,string $key):string
    {
        $platform=self::platform($payload['platform'],$payload['environment']['surface']);
        if($platform!==$payload['provider_platform'])throw new Invalid('平台映射与已确认范围不一致');
        $data=$this->request($connection,'POST','/api/v1/runs',['prompt'=>$payload['question'],'platforms'=>[$platform],'collector'=>'molizhishu','repeatCount'=>1,'intervalSeconds'=>60,'platformOptions'=>[$platform=>['screenshot'=>true]]],$key);
        return self::taskId($data['id']??null);
    }
    private static function links(mixed $rows):array
    {
        $out=[];foreach(array_slice(is_array($rows)?$rows:[],0,100) as $row){if(!is_array($row)||!($url=MoliVisibility::safeUrl($row['url']??null)))continue;$out[$url]=['url'=>$url,'title'=>mb_substr((string)($row['title']??''),0,255)];}return array_values($out);
    }
    public static function normalize(array $data,array $payload,string $task,int $submitted):?array
    {
        if(($data['id']??'')!==$task)throw new PartnerVisibilityReview('供应商回执任务编号不一致，需核对原任务');
        $created=null;
        if(isset($data['createdAt'])){$created=is_string($data['createdAt'])?strtotime($data['createdAt']):false;if(!$created||$created<$submitted-300||$created>time()+300)throw new PartnerVisibilityReview('供应商回执创建时间与本次任务不符');}
        if(in_array($data['status']??'',['queued','running'],true))return null;
        if(!in_array($data['status']??'',['completed','partial_failed','failed','cancelled'],true))throw new PartnerVisibilityReview('供应商返回未知任务状态，请核对原任务');
        $rows=$data['platformRuns']??null;if(!is_array($rows)||count($rows)!==1)throw new PartnerVisibilityReview('回执采样数量不符合单问题单平台范围');$sample=$rows[0];
        if(($sample['platformId']??'')!==$payload['provider_platform']||($sample['prompt']['text']??'')!==$payload['question'])throw new PartnerVisibilityReview('供应商回执问题或平台与本次范围不符');
        if(in_array($sample['status']??'',['failed','cancelled'],true))throw new PartnerVisibilityReview('供方已受理但采样失败或取消，供方不自动退款；原预扣保留待管理员核对，未计为品牌未提及');
        $answer=$sample['answer']??null;
        if(($data['status']??'')!=='completed'||($sample['status']??'')!=='completed'||!empty($sample['errorCode'])||!is_array($answer)||!is_string($answer['content']??null)||trim($answer['content'])===''||mb_strlen($answer['content'])>30000)throw new PartnerVisibilityReview('供应商终态回执缺少有效回答，请核对原任务');
        $provider=is_array($answer['providerResult']??null)?$answer['providerResult']:[];
        $rankings=[];foreach(array_slice(is_array($provider['competitorRankings']??null)?$provider['competitorRankings']:[],0,30) as $row)if(is_array($row)&&is_string($row['name']??null))$rankings[]=['name'=>mb_substr($row['name'],0,120),'rank'=>is_int($row['rank']??null)&&$row['rank']>0?$row['rank']:null];
        return ['kind'=>'visibility','provider'=>'geo_partner','method'=>'automatic','question'=>$payload['question'],'platform'=>$payload['platform'],
            // The v1.3 response has no required observation timestamp. Do not invent one.
            'observed_at'=>time(),'time_basis'=>'result_received_at','requested_at'=>$created,'answer'=>$answer['content'],
            'url'=>MoliVisibility::safeUrl($provider['screenshotUrl']??null),'response_url'=>MoliVisibility::safeUrl($answer['responseUrl']??null),
            'references'=>self::links($provider['references']??[]),'citations'=>self::links($answer['citations']??[]),
            'sentiment'=>in_array($provider['sentiment']??null,['positive','negative','neutral'],true)?$provider['sentiment']:null,
            'mention_position'=>is_int($provider['mentionPosition']??null)&&$provider['mentionPosition']>0?$provider['mentionPosition']:null,'competitor_rankings'=>$rankings,
            'provider_task_id'=>$task,'provider_subtask_id'=>(string)($sample['id']??''),'environment'=>$payload['environment'],'accuracy'=>'unknown','recommended'=>false,
            'notice'=>'品牌提及由本平台按当前品牌与别名核对；时间为结果取回时间。截图由供方保留最多90天，签名链接最长1小时；缺失截图不补造。'];
    }
}
