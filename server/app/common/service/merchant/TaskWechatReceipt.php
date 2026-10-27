<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use EasyWeChat\Kernel\Encryptor;
use think\facade\Db;
use app\common\service\merchant\clip\{ClipIntegrationService,ClipCredentialVault};
use InvalidArgumentException as Invalid;

/** Receipts are encrypted, signed and bound to the configured app and recipient. */
final class TaskWechatReceipt
{
    private static function xml(string $raw):array
    {
        if(strlen($raw)>262144||str_contains(strtoupper($raw),'<!DOCTYPE')||str_contains(strtoupper($raw),'<!ENTITY'))throw new Invalid('微信报文无效');
        $xml=@simplexml_load_string($raw,'SimpleXMLElement',LIBXML_NONET|LIBXML_NOCDATA);if(!$xml)throw new Invalid('微信报文无效');
        return json_decode(json_encode($xml,JSON_THROW_ON_ERROR),true,32,JSON_THROW_ON_ERROR);
    }
    public static function decode(array $config,string $raw,array $query,bool $get):array|string
    {
        $app=$config['settings']['appid']??'';$token=$config['credentials']['callback_token']??'';$key=$config['credentials']['callback_aes']??'';
        if($app===''||$token===''||!preg_match('/^[a-zA-Z0-9]{43}$/D',$key))throw new Invalid('微信通知回调尚未配置');
        $stamp=$query['timestamp']??'';$nonce=$query['nonce']??'';
        if(!is_string($stamp)||!ctype_digit($stamp)||abs(time()-(int)$stamp)>300||!is_string($nonce)||$nonce===''||strlen($nonce)>128)throw new Invalid('微信签名参数无效或已过期');
        if($get){$sig=$query['signature']??'';$parts=[$token,$stamp,$nonce];sort($parts,SORT_STRING);if(!is_string($sig)||!hash_equals(sha1(implode('',$parts)),$sig))throw new Invalid('微信签名校验失败');$echo=$query['echostr']??'';if(!is_string($echo)||strlen($echo)>1000)throw new Invalid('微信校验内容无效');return $echo;}
        $envelope=self::xml($raw);$encrypted=$envelope['Encrypt']??'';$signature=$query['msg_signature']??'';
        if(!is_string($encrypted)||$encrypted===''||!is_string($signature))throw new Invalid('通知回调必须使用微信安全模式');
        $plain=(new Encryptor($app,$token,$key,$app))->decrypt($encrypted,$signature,$nonce,$stamp);
        $message=self::xml($plain);
        if(($message['MsgType']??'')!=='event'||strtoupper((string)($message['Event']??''))!=='TEMPLATESENDJOBFINISH')return [];
        $id=$message['MsgID']??'';$openid=$message['FromUserName']??'';$status=$message['Status']??'';
        if(!is_string($id)||!preg_match('/^[0-9]{1,128}$/D',$id)||!is_string($openid)||!preg_match('/^[a-zA-Z0-9_-]{1,128}$/D',$openid)||!is_string($status)||strlen($status)>200||($status!=='success'&&!str_starts_with($status,'failed:')))throw new Invalid('微信送达事件字段无效');
        return ['app_id'=>$app,'msgid'=>$id,'recipient_hash'=>hash('sha256',$app.':'.$openid),'state'=>$status==='success'?'delivered':'delivery_failed','event_time'=>max(0,(int)($message['CreateTime']??time()))];
    }
    public static function receive(int $source,string $raw,array $query,bool $get):string
    {
        // Read this exact owner, never silently resolve a borrowed or replacement account.
        $row=Db::name('oem_clip_integration')->where(['tenant_id'=>$source,'capability'=>'task_notify','enabled'=>1,'is_deleted'=>0])->find();if(!$row)throw new Invalid('微信回调配置不存在');
        $config=['settings'=>json_decode($row['settings_json'],true),'credentials'=>ClipCredentialVault::open($row['secret_cipher'],$source,'task_notify')];
        $event=self::decode($config,$raw,$query,$get);if(is_string($event))return $event;
        if($event){Db::name('oem_task_notification_event')->extra('IGNORE')->insert($event+['create_time'=>time()]);self::reconcile($event['app_id'],$event['msgid'],$event['recipient_hash']);}
        return 'success';
    }
    public static function reconcile(string $app,string $msgid,string $recipient):void
    {
        $event=Db::name('oem_task_notification_event')->where(['app_id'=>$app,'msgid'=>$msgid,'recipient_hash'=>$recipient])->find();if(!$event)return;
        Db::name('oem_task_notification')->where(['msgid'=>$msgid,'recipient_hash'=>$recipient])->whereIn('state',['sent','unknown'])->update(['state'=>$event['state'],'error'=>$event['state']==='delivered'?'':'微信回执确认未送达，请核查关注状态或通知权限','update_time'=>time()]);
    }
}
