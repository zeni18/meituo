<?php
declare(strict_types=1);
namespace app\common\service\press;
final class HaipressHttpTransport implements HaipressTransport
{
    public function request(string $path,array $headers,array $body,bool $json): array
    {
        if (!preg_match('#^/api/(?:member/user/tokenON|media/resources/(?:list(?:[1-9]|1[0-5])ON|stateON)|media/order/(?:createON|queryON|processON))$#D',$path)) throw new \InvalidArgumentException('海讯社接口不在允许清单');
        $h=['Accept: application/json','Content-Type: '.($json?'application/json':'application/x-www-form-urlencoded')];
        foreach ($headers as $k=>$v) { if (preg_match('/[\r\n]/',(string)$v)) throw new \InvalidArgumentException('凭证格式不正确'); $h[]=$k.': '.$v; }
        $raw=''; $c=curl_init('https://api.haipress.com'.$path);
        curl_setopt_array($c,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$json?json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR):http_build_query($body),CURLOPT_HTTPHEADER=>$h,
            CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>30,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_SSL_VERIFYPEER=>true,
            CURLOPT_WRITEFUNCTION=>static function($c,$bytes) use (&$raw) { if (strlen($raw)+strlen($bytes)>8*1024*1024) return 0; $raw.=$bytes; return strlen($bytes); }]);
        $ok=curl_exec($c); $http=(int)curl_getinfo($c,CURLINFO_HTTP_CODE); curl_close($c);
        if ($ok===false || $http!==200) throw new HaipressFailure(true,'transport','海讯社请求结果不确定，请查询原订单，不能重复提交');
        $data=json_decode($raw,true);
        if (!is_array($data) || !isset($data['code'])) throw new HaipressFailure(true,'invalid_response','海讯社返回格式异常，请核查原订单');
        return $data;
    }
}
