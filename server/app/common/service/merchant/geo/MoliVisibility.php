<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;
use InvalidArgumentException as Invalid;

/** Official v1.19 contract. No generated-model answers stand in for consumer-platform observations. */
final class MoliVisibility
{
    public function __construct(private readonly ?\Closure $transport=null){}
    public static function origin(string $value):string
    {
        $value=rtrim(trim($value),'/');$p=parse_url($value);
        if(!$p||($p['scheme']??'')!=='https'||isset($p['user'])||isset($p['pass'])||isset($p['query'])||isset($p['fragment'])||!empty($p['path'])||isset($p['port'])||!preg_match('/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/D',strtolower($p['host']??'')))throw new Invalid('请填写供应商正式HTTPS域名，不含端口、路径、账号或参数');
        return 'https://'.strtolower($p['host']);
    }
    public static function publicIp(string $ip):bool{return (bool)filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4|FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE)&&!preg_match('/^(?:100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.(?:0|2)\.|192\.88\.99\.|198\.(?:18|19)\.|198\.51\.100\.|203\.0\.113\.)/D',$ip);}
    public static function platform(string $name,string $surface):string
    {
        $map=['DeepSeek'=>'deepseek','豆包'=>'doubao','腾讯元宝'=>'yuanbao','通义千问'=>'qianwen','Kimi'=>'kimi'];
        if(!isset($map[$name])||($surface==='App端'&&$name==='Kimi'))throw new Invalid($name.'在当前检测端暂无已验证的自动采样契约，请保留人工采样或另建支持范围');
        if(!in_array($surface,['网页端','App端'],true))throw new Invalid('自动诊断仅支持网页端或App端');
        return $map[$name].($surface==='App端'?'_mobile':'');
    }
    public function request(array $connection,string $method,string $path,?array $body=null):array
    {
        if(!preg_match('#^/api/(?:business/monitor/task/(?:batch/shared|(?:status|result)/[a-zA-Z0-9-]{8,64})|business/system/models)$#D',$path))throw new Invalid('监测接口路径无效');
        $origin=self::origin($connection['settings']['api_origin']??'');$token=$connection['credentials']['api_key']??'';
        if($this->transport)$r=($this->transport)($method,$path,$body,$connection);else{
            $host=(string)parse_url($origin,PHP_URL_HOST);$ips=gethostbynamel($host);if(!$ips)throw new GeoProviderFailure($method==='POST','监测域名暂不可用');foreach($ips as $ip)if(!self::publicIp($ip))throw new GeoProviderFailure(false,'监测域名不能指向本机、内网或保留地址');
            $c=curl_init($origin.$path);$raw='';curl_setopt_array($c,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$token,'Content-Type: application/json','Accept: application/json'],CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>35,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROXY=>'',CURLOPT_RESOLVE=>[$host.':443:'.$ips[0]],CURLOPT_WRITEFUNCTION=>static function($ch,$s)use(&$raw){if(strlen($raw)+strlen($s)>4194304)return 0;$raw.=$s;return strlen($s);}]);if($body!==null)curl_setopt($c,CURLOPT_POSTFIELDS,json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));$ok=curl_exec($c);$status=(int)curl_getinfo($c,CURLINFO_HTTP_CODE);curl_close($c);if($ok===false)throw new GeoProviderFailure(true,'监测请求响应未确认，请核对原任务');$r=['status'=>$status,'body'=>json_decode($raw,true)];
        }
        $status=(int)($r['status']??0);$d=$r['body']??null;
        if(in_array($status,[400,401,403],true)||($status===200&&is_array($d)&&($d['success']??null)===false&&in_array((int)($d['code']??0),[300001,400002,500001,401001],true)))throw new GeoProviderFailure(false,'供应商拒绝监测请求，请管理端核对权限、余额和参数');
        if($status!==200||!is_array($d)||($d['success']??null)!==true||(int)($d['code']??0)!==200||!is_array($d['data']??null))throw new GeoProviderFailure(true,'供应商监测响应待核对');return $d['data'];
    }
    public static function safeUrl(mixed $url):string{return is_string($url)&&strlen($url)<=2048&&filter_var($url,FILTER_VALIDATE_URL)&&in_array(parse_url($url,PHP_URL_SCHEME),['https','http'],true)&&parse_url($url,PHP_URL_USER)===null?$url:'';}
    public static function normalize(array $data,array $payload,string $taskId,int $submitted):?array
    {
        if(($data['taskId']??'')!==$taskId)throw new GeoProviderFailure(true,'监测回执任务ID不一致');
        if(!in_array($data['status']??'',['completed','partial_completed','failed','stopped'],true))return null;
        $rows=$data['subTaskList']??null;if(!is_array($rows)||count($rows)!==1)throw new GeoProviderFailure(true,'监测回执数量不符合单问题单平台契约');$s=$rows[0];
        if(($s['prompt']??'')!==$payload['question']||($s['platform']??'')!==$payload['provider_platform']||($s['mode']??'')!=='search')throw new GeoProviderFailure(true,'监测回执问题、平台或模式与确认范围不一致');
        if(in_array($s['status']??'',['failed','stopped'],true))throw new GeoProviderFailure(false,'该问题采样失败，未计为品牌未提及');
        if(($s['status']??'')!=='completed'||!is_string($s['answerContent']??null)||trim($s['answerContent'])===''||mb_strlen($s['answerContent'])>30000)throw new GeoProviderFailure(true,'监测回执尚无可验证的完整回答');
        $at=(int)($s['time']??0);if($at>100000000000)$at=(int)floor($at/1000);if($at<$submitted-300||$at>time()+300)throw new GeoProviderFailure(true,'监测回执时间不在本次采样窗口内');
        $refs=[];$citations=[];foreach(['referenceList'=>'refs','citationList'=>'citations']as $key=>$target){foreach(array_slice(is_array($s[$key]??null)?$s[$key]:[],0,100)as $v){if(!is_array($v)||!($url=self::safeUrl($v['url']??null)))continue;${$target}[]=['url'=>$url,'title'=>mb_substr((string)($v['title']??''),0,255),'site'=>mb_substr((string)($v['site']??''),0,120),'published_at'=>mb_substr((string)($v['publishTime']??''),0,30)];}}
        return ['kind'=>'visibility','provider'=>'moli','method'=>'automatic','question'=>$payload['question'],'platform'=>$payload['platform'],'observed_at'=>$at,'answer'=>$s['answerContent'],'url'=>self::safeUrl($s['pageScreenshot']??null),'references'=>$refs,'citations'=>$citations,'provider_task_id'=>$taskId,'provider_subtask_id'=>(string)($s['subTaskId']??''),'environment'=>$payload['environment'],'accuracy'=>'unknown','recommended'=>false,'notice'=>'真实平台采样；提及不等于推荐，引用不等于优化归因。截图由供应商托管，有效期以供应商规则为准。'];
    }
}
