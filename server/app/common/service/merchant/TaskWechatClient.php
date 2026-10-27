<?php
declare(strict_types=1);
namespace app\common\service\merchant;

/** Fixed WeChat endpoints, injectable transport for tests; never logs tokens or provider bodies. */
final class TaskWechatClient
{
    public function __construct(private readonly ?\Closure $transport=null){}
    private function request(string $method,string $path,array $query=[],?array $body=null):array{
        $url='https://api.weixin.qq.com/'.$path.($query?'?'.http_build_query($query):'');if($this->transport)return ($this->transport)($method,$url,$body);
        $h=curl_init($url);curl_setopt_array($h,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>20,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2]);if($method==='POST')curl_setopt_array($h,[CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_POSTFIELDS=>json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);$raw=curl_exec($h);$status=(int)curl_getinfo($h,CURLINFO_HTTP_CODE);curl_close($h);if($raw===false||$status!==200)throw new \RuntimeException('微信连接中断，结果需核查');$r=json_decode($raw,true);if(!is_array($r))throw new \RuntimeException('微信响应异常，结果需核查');return $r;
    }
    public function token(array $config):string{
        $s=$config['settings'];$secret=$config['credentials']['app_secret'];$key='merchant_task_token_'.hash('sha256',$s['appid'].':'.$secret);$cached=$this->transport?null:\think\facade\Cache::get($key);if(is_string($cached)&&$cached!=='')return $cached;
        $r=$this->request('POST','cgi-bin/stable_token',[],['grant_type'=>'client_credential','appid'=>$s['appid'],'secret'=>$secret,'force_refresh'=>false]);if(empty($r['access_token']))throw new \InvalidArgumentException('服务号凭证校验失败，微信代码 '.(int)($r['errcode']??-1));if(!$this->transport)\think\facade\Cache::set($key,$r['access_token'],max(60,(int)($r['expires_in']??7200)-300));return (string)$r['access_token'];
    }
    public function openid(array $config,string $code):string{$r=$this->request('GET','sns/oauth2/access_token',['appid'=>$config['settings']['appid'],'secret'=>$config['credentials']['app_secret'],'code'=>$code,'grant_type'=>'authorization_code']);if(empty($r['openid']))throw new \InvalidArgumentException('微信授权失败，请重新绑定');return (string)$r['openid'];}
    public function subscribed(string $token,string $openid):bool{$r=$this->request('GET','cgi-bin/user/info',['access_token'=>$token,'openid'=>$openid,'lang'=>'zh_CN']);if(isset($r['errcode'])&&(int)$r['errcode']!==0)throw new \InvalidArgumentException('微信关注状态查询失败，错误码 '.(int)$r['errcode']);return (int)($r['subscribe']??0)===1;}
    public function send(string $token,array $body):array{return $this->request('POST','cgi-bin/message/template/send',['access_token'=>$token],$body);}
}
