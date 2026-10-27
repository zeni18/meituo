<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;

use InvalidArgumentException as Invalid;

/** Platform operator only; provider-wide data must never be exposed to merchants. */
final class PartnerWorkspace
{
    public function __construct(private readonly PartnerVisibility $client=new PartnerVisibility()){}
    public static function id(mixed $id):string
    {if(!is_string($id)||!preg_match('/^[a-zA-Z0-9_-]{1,100}$/D',$id))throw new Invalid('请选择有效的服务商品牌或任务');return $id;}
    public function execute(array $connection,array $p):array
    {
        if(($p['confirmed']??false)!==true)throw new Invalid('请确认按供应商实际规则计费后操作');
        $action=$p['action']??'';$method='GET';$body=null;$id='';$key='';
        if(in_array($action,['questions','runs','overview','sources','add_questions'],true))$id=self::id($p['brand_id']??'');
        $path=match($action){'brands','create_brand'=>'/brands','questions','add_questions'=>'/brands/'.$id.'/questions','runs'=>'/brands/'.$id.'/runs','overview'=>'/brands/'.$id.'/overview','sources'=>'/brands/'.$id.'/sources','report'=>'/runs/'.self::id($p['run_id']??'').'/report','screenshot'=>'/screenshots/'.self::id($p['asset_id']??''),default=>throw new Invalid('不支持的服务商操作')};
        if($action==='overview')$path.='?days='.max(1,min(3650,(int)($p['days']??30)));
        if(in_array($action,['create_brand','add_questions'],true)){
            $method='POST';$key=$p['request_key']??'';if(!is_string($key)||!preg_match('/^[a-zA-Z0-9_.-]{16,80}$/D',$key))throw new Invalid('操作请求编号无效');
            if($action==='create_brand'){$name=\app\common\service\merchant\clip\ClipConfiguration::text($p['name']??'',100,true);$aliases=$p['aliases']??[];if(!is_array($aliases)||!array_is_list($aliases)||count($aliases)>20)throw new Invalid('品牌别名最多20个');$body=['name'=>$name,'aliases'=>array_map(fn($s)=>\app\common\service\merchant\clip\ClipConfiguration::text($s,100,true),$aliases)];}
            else{$texts=$p['texts']??[];if(!is_array($texts)||!array_is_list($texts)||!$texts||count($texts)>100)throw new Invalid('请填写1～100个问题');$body=['texts'=>array_map(fn($s)=>\app\common\service\merchant\clip\ClipConfiguration::text($s,2000,true),$texts),'category'=>\app\common\service\merchant\clip\ClipConfiguration::text($p['category']??'',100)];}
        }
        return ['action'=>$action,'data'=>$this->client->request($connection,$method,'/api/v1'.$path,$body,$key)];
    }
}
