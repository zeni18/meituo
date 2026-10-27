<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use think\facade\Db;
use InvalidArgumentException as Invalid;
use app\common\service\merchant\clip\{ClipIntegrationService as Config,ClipCredentialVault as Vault};

final class TaskNotificationService
{
    public function __construct(private readonly TaskWechatClient $client=new TaskWechatClient()){}
    public function start(array $access):array{
        $config=Config::resolve((int)$access['tenant_id'],'task_notify');$state=bin2hex(random_bytes(24));Db::name('oem_task_oauth_state')->insert(['state_hash'=>hash('sha256',$state),'access_id'=>$access['id'],'config_revision'=>$config['revision'],'source_tenant_id'=>$config['source_tenant_id'],'expire_time'=>time()+600]);$callback=rtrim($config['settings']['public_base'],'/').'/employee/wechat-callback';
        return ['url'=>'https://open.weixin.qq.com/connect/oauth2/authorize?'.http_build_query(['appid'=>$config['settings']['appid'],'redirect_uri'=>$callback,'response_type'=>'code','scope'=>'snsapi_base','state'=>$state]).'#wechat_redirect'];
    }
    public function callback(string $state,string $code):string{
        if(!preg_match('/^[a-f0-9]{48}$/D',$state)||!preg_match('/^[a-zA-Z0-9_-]{1,200}$/D',$code))throw new Invalid('微信授权参数不正确');
        $binding=Db::transaction(function()use($state){$s=Db::name('oem_task_oauth_state')->where('state_hash',hash('sha256',$state))->lock(true)->find();if(!$s||$s['expire_time']<time())throw new Invalid('微信绑定请求已过期，请重新操作');Db::name('oem_task_oauth_state')->where('state_hash',$s['state_hash'])->delete();$a=Db::name('oem_staff_task_access')->where('id',$s['access_id'])->find();if(!$a)throw new Invalid('员工链接已重置');return [$s,$a];});[$s,$a]=$binding;$t=(int)$a['tenant_id'];$token=Vault::open($a['token_cipher'],$t,'task_invite')['token'];MerchantPublishService::access($token);$config=Config::resolve($t,'task_notify');if((int)$s['config_revision']!==$config['revision']||(int)$s['source_tenant_id']!==$config['source_tenant_id'])throw new Invalid('服务号配置已变化，请重新绑定');$openid=$this->client->openid($config,$code);if(!$this->client->subscribed($this->client->token($config),$openid))throw new Invalid('请先关注配置的服务号，再重新绑定任务通知');
        $changed=Db::name('oem_staff_task_access')->where(['id'=>$a['id'],'token_hash'=>$a['token_hash']])->update(['appid'=>$config['settings']['appid'],'openid_cipher'=>Vault::seal(['openid'=>$openid],$t,'task_openid'),'subscribe'=>1,'update_time'=>time()]);if(!$changed)throw new Invalid('员工链接已重置，请重新绑定');return rtrim($config['settings']['public_base'],'/').'/employee/tasks#'.$token;
    }
    public static function payload(array $config,array $task,array $staff,string $openid,string $token):array{
        $settings=$config['settings'];$map=json_decode($settings['data_map'],true);if(!is_array($map)||!$map)throw new Invalid('请配置任务通知模板字段映射');$values=['title'=>$task['title'],'store'=>$staff['store_name'],'content'=>$task['content'],'time'=>date('Y-m-d H:i',(int)$task['due_time'])];$data=[];foreach($map as $field=>$value){if(!in_array($value,['title','store','content','time'],true))throw new Invalid('模板字段映射无效');$data[$field]=['value'=>mb_substr($values[$value],0,str_starts_with($field,'time')?25:20)];}return ['touser'=>$openid,'template_id'=>$settings['template_id'],'url'=>rtrim($settings['public_base'],'/').'/employee/tasks#'.$token,'data'=>$data];
    }
    public function tick():bool{
        // A crashed/inconclusive send is never automatically replayed.
        Db::name('oem_task_notification')->where('state','sending')->where('lease_until','<',time())->update(['state'=>'unknown','error'=>'发送过程被中断，需核查微信消息；禁止自动重复通知','update_time'=>time()]);
        Db::name('oem_task_notification')->where('state','preparing')->where('lease_until','<',time())->update(['state'=>'queued','update_time'=>time()]);
        $job=Db::transaction(function(){$r=Db::name('oem_task_notification')->where('state','queued')->where('due_time','<=',time())->order('id')->lock(true)->find();if(!$r)return null;Db::name('oem_task_notification')->where('id',$r['id'])->update(['state'=>'preparing','lease_until'=>time()+90,'update_time'=>time()]);return $r;});if(!$job)return false;$q=fn()=>Db::name('oem_task_notification')->where('id',$job['id']);$sending=false;
        try{
            $t=(int)$job['tenant_id'];$u=(int)$job['user_id'];$task=MerchantFilmService::scope('oem_publish_task',$t,$u)->where('id',$job['task_id'])->find();if(!$task||$task['state']!=='active'||($task['deadline']&&$task['deadline']<=time())){$q()->update(['state'=>'cancelled','update_time'=>time()]);return true;}
            $access=MerchantFilmService::scope('oem_staff_task_access',$t,$u)->where('staff_id',$job['staff_id'])->find();if(!$access||!$access['subscribe'])throw new Invalid('员工尚未关注并绑定服务号');$token=Vault::open($access['token_cipher'],$t,'task_invite')['token'];$active=MerchantPublishService::access($token);$config=Config::resolve($t,'task_notify');if($access['appid']!==$config['settings']['appid'])throw new Invalid('服务号已更换，请员工重新绑定');$openid=Vault::open($access['openid_cipher'],$t,'task_openid')['openid'];$recipient=hash('sha256',$access['appid'].':'.$openid);
            $body=self::payload($config,$task,$active['staff'],$openid,$token);$apiToken=$this->client->token($config);
            $allowed=Db::transaction(function()use($access,$recipient,$q){Db::name('oem_staff_task_access')->where('id',$access['id'])->lock(true)->find();$scope=['recipient_hash'=>$recipient,'day'=>date('Ymd')];Db::name('oem_task_notification_quota')->extra('IGNORE')->insert($scope+['attempts'=>0]);$quota=Db::name('oem_task_notification_quota')->where($scope)->lock(true)->find();if((int)$quota['attempts']>=3)return false;Db::name('oem_task_notification_quota')->where($scope)->inc('attempts')->update();$q()->update(['state'=>'sending','recipient_hash'=>$recipient,'send_time'=>time(),'attempts'=>Db::raw('attempts+1'),'lease_until'=>time()+90,'update_time'=>time()]);return true;});if(!$allowed)throw new Invalid('本系统单员工每日最多3次任务通知，请次日重试');$sending=true;
            $r=$this->client->send($apiToken,$body);if((int)($r['errcode']??-1)!==0){$q()->update(['state'=>'failed','error'=>'微信拒绝发送，错误码 '.(int)($r['errcode']??-1),'lease_until'=>0,'update_time'=>time()]);return true;}if(empty($r['msgid']))throw new \RuntimeException('微信返回结果缺少消息ID');$q()->update(['state'=>'sent','msgid'=>(string)$r['msgid'],'error'=>'','lease_until'=>0,'update_time'=>time()]);TaskWechatReceipt::reconcile($config['settings']['appid'],(string)$r['msgid'],$recipient);
        }catch(Invalid $e){$q()->update(['state'=>'blocked','error'=>mb_substr($e->getMessage(),0,240),'lease_until'=>0,'update_time'=>time()]);}
        catch(\Throwable){$q()->update(['state'=>$sending?'unknown':'blocked','error'=>$sending?'微信发送结果不明确，请人工核查；不会自动重发':'服务号连接或配置不可用，请检查配置后重试','lease_until'=>0,'update_time'=>time()]);}return true;
    }
    public static function retry(int $t,int $u,array $p):void{$id=MerchantFilmService::number($p['id']??0,1);if(!MerchantFilmService::scope('oem_task_notification',$t,$u)->where('id',$id)->whereIn('state',['blocked','failed'])->update(['state'=>'queued','error'=>'','update_time'=>time()]))throw new Invalid('通知不可重试；已受理或结果不明的通知不得重复发送');}
}
