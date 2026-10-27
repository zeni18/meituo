<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;

/** Fixed official endpoint, server credentials, no redirects or paid retries. */
final class BochaSearch
{
    public function __construct(private readonly ?\Closure $transport=null){}
    public static function options(array $p):array
    {
        $freshness=$p['freshness']??'noLimit';$count=$p['count']??10;
        if(!is_string($freshness)||!in_array($freshness,['noLimit','oneDay','oneWeek','oneMonth','oneYear'],true))throw new \InvalidArgumentException('请选择有效的检索时间范围');
        if((!is_int($count)&&!(is_string($count)&&ctype_digit($count)))||(int)$count<1||(int)$count>50)throw new \InvalidArgumentException('检索条数须为1～50');
        return ['freshness'=>$freshness,'count'=>(int)$count];
    }
    private static function url($value):string
    {
        if(!is_string($value)||strlen($value)>4000||!filter_var($value,FILTER_VALIDATE_URL))return '';
        $p=parse_url($value);$host=strtolower($p['host']??'');
        if(!in_array($p['scheme']??'',['http','https'],true)||isset($p['user'])||isset($p['pass'])||$host==='localhost'||str_ends_with($host,'.local')||!str_contains($host,'.'))return '';
        if(filter_var($host,FILTER_VALIDATE_IP)&&!filter_var($host,FILTER_VALIDATE_IP,FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE))return '';
        return $value;
    }
    public function search(array $connection,string $query,array $options=[]):array
    {
        $options=self::options($options);$payload=['query'=>$query,'summary'=>true]+$options;$key=$connection['credentials']['api_key'];
        if($this->transport)$response=($this->transport)($payload,$key);else{
            $curl=curl_init('https://api.bochaai.com/v1/web-search');$body='';$tooLarge=false;
            curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$key,'Content-Type: application/json'],CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>45,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_WRITEFUNCTION=>static function($ch,$chunk)use(&$body,&$tooLarge){if(strlen($body)+strlen($chunk)>4194304){$tooLarge=true;return 0;}$body.=$chunk;return strlen($chunk);}]);
            $ok=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);
            if($ok===false||$tooLarge)throw new GeoProviderFailure(true,'检索响应未确认，请核对原任务，避免重复提交');
            $response=['status'=>$status,'body'=>json_decode($body,true)];
        }
        $status=(int)($response['status']??0);$d=$response['body']??null;
        if(in_array($status,[400,401,403],true))throw new GeoProviderFailure(false,'博查拒绝请求，请管理员核对API权限和供应商余额');
        if($status!==200||!is_array($d)||(int)($d['code']??0)!==200||!isset($d['data']['webPages'])||!is_array($d['data']['webPages']))throw new GeoProviderFailure(true,'检索结果未确认，等待管理员核对');
        $out=[];foreach(array_slice($d['data']['webPages']['value']??[],0,$options['count'])as $row){$url=self::url($row['url']??'');if($url==='')continue;$out[]=['title'=>mb_substr((string)($row['name']??''),0,255),'url'=>$url,'summary'=>mb_substr((string)($row['summary']??$row['snippet']??''),0,12000),'site'=>mb_substr((string)($row['siteName']??''),0,120),'published_at'=>mb_substr((string)($row['datePublished']??''),0,80)];}
        $images=[];foreach(array_slice($d['data']['images']['value']??[],0,50)as $row){$url=self::url($row['contentUrl']??'');$source=self::url($row['hostPageUrl']??'');if($url===''||$source==='')continue;$images[]=['url'=>$url,'source_url'=>$source,'title'=>mb_substr((string)($row['name']??'图片来源'),0,255)];}
        return ['kind'=>'web_search','query'=>$query,'options'=>$options,'items'=>$out,'images'=>$images,'observed_at'=>time(),'provider'=>'bocha','notice'=>'检索结果需核实；图片版权以来源网站授权为准'];
    }
}
