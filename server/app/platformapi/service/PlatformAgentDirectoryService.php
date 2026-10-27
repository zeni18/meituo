<?php
declare(strict_types=1);
namespace app\platformapi\service;

use think\facade\Db;
use app\common\service\merchant\OemDirectoryService;
use app\common\service\tenant\TenantContractService;
use app\common\service\tenant\TenantDomainAliasService;
use app\common\model\tenant\Tenant;
use app\platformapi\logic\tenant\TenantLogic;

final class PlatformAgentDirectoryService
{
    private static function union(): string
    {
        $p=(string)config('database.connections.mysql.prefix');
        if(!preg_match('/^[A-Za-z0-9_]+$/D',$p))throw new \RuntimeException('Invalid table prefix');
        return "SELECT 'oem' kind,t.id,t.id tenant_id,t.name,COALESCE(a.account,'') account,t.tel mobile,'' contact,t.notes,t.domain_alias,IF(t.disable=0,1,0) status,t.create_time,t.name oem_name,0 parent_id,'总平台' parent_name,t.contract_expire_time FROM {$p}tenant t LEFT JOIN {$p}tenant_admin a ON a.id=(SELECT MIN(r.id) FROM {$p}tenant_admin r WHERE r.tenant_id=t.id AND r.root=1 AND r.delete_time IS NULL) WHERE t.delete_time IS NULL
        UNION ALL SELECT IF(d.level=1,'first','second') kind,d.id,d.tenant_id,d.name,COALESCE(c.account,'') account,d.mobile,d.contact,d.notes,t.domain_alias,d.status,d.create_time,t.name oem_name,d.parent_id,COALESCE(p.name,t.name) parent_name,t.contract_expire_time FROM {$p}oem_agent d JOIN {$p}tenant t ON t.id=d.tenant_id AND t.delete_time IS NULL LEFT JOIN {$p}oem_agent_account c ON c.agent_id=d.id AND c.tenant_id=d.tenant_id LEFT JOIN {$p}oem_agent p ON p.id=d.parent_id AND p.tenant_id=d.tenant_id";
    }
    public static function listing(array $p): array
    {
        $base='('.self::union().') d';$where=[];$bindings=[];
        $keyword=mb_substr(trim((string)($p['keyword']??'')),0,80);
        if($keyword!==''){$where[]='(d.name LIKE ? OR d.account LIKE ? OR d.mobile LIKE ?)';$like='%'.addcslashes($keyword,'%_\\').'%';array_push($bindings,$like,$like,$like);}
        if(in_array($p['kind']??'',['oem','first','second'],true)){$where[]='d.kind=?';$bindings[]=$p['kind'];}
        if((int)($p['oem_id']??0)>0){$where[]='d.tenant_id=?';$bindings[]=(int)$p['oem_id'];}
        if(in_array((string)($p['status']??''),['0','1'],true)){$where[]='d.status=?';$bindings[]=(int)$p['status'];}
        $filter=$where?' WHERE '.implode(' AND ',$where):'';
        $count=(int)Db::query('SELECT COUNT(*) n FROM '.$base.$filter,$bindings)[0]['n'];
        $page=max(1,(int)($p['page']??1));$offset=($page-1)*15;
        $rows=Db::query('SELECT d.* FROM '.$base.$filter.' ORDER BY d.create_time DESC,d.kind,d.id DESC LIMIT '.$offset.',15',$bindings);
        $stats=['oem'=>0,'first'=>0,'second'=>0];foreach(Db::query('SELECT kind,COUNT(*) n FROM '.$base.' GROUP BY kind') as $row)$stats[$row['kind']]=(int)$row['n'];
        $oems=Db::name('tenant')->whereNull('delete_time')->field('id,name,disable,contract_expire_time')->order('id')->select()->toArray();
        $parents=Db::name('oem_agent')->alias('a')->join('tenant t','t.id=a.tenant_id AND t.delete_time IS NULL')->where('a.level',1)->where('a.status',1)->where('t.disable',0)->field('a.id,a.name,a.tenant_id')->order('a.id')->select()->toArray();
        foreach($rows as &$row)if($row['kind']==='oem')$row['clip_borrow']=\app\common\service\merchant\clip\ClipIntegrationService::policy((int)$row['tenant_id']);unset($row);
        return ['lists'=>$rows,'count'=>$count,'page'=>$page,'page_size'=>15,'stats'=>$stats,'oems'=>$oems,'parents'=>$parents];
    }
    private static function text(array $p,string $key,int $max,bool $required=false): string
    {
        $value=trim((string)($p[$key]??''));
        if(($required&&$value==='')||mb_strlen($value)>$max)throw new \InvalidArgumentException('请检查'.(['name'=>'名称','account'=>'账号','mobile'=>'电话','contact'=>'联系人','notes'=>'备注','domain_alias'=>'域名'][$key]??$key).'，长度上限为 '.$max.' 字');
        return $value;
    }
    private static function credentials(array $p,bool $required): void
    {
        if(!preg_match('/^[A-Za-z0-9_]{3,30}$/D',(string)($p['account']??'')))throw new \InvalidArgumentException('登录账号须为 3–30 位字母、数字或下划线');
        $password=(string)($p['password']??'');
        if(($required||$password!=='')&&(strlen($password)<8||strlen($password)>20||!preg_match('/[A-Za-z]/',$password)||!preg_match('/[0-9]/',$password)))throw new \InvalidArgumentException('密码须为 8–20 位，并包含字母和数字');
    }
    public static function save(array $p,bool $canGrantClip=false,int $actor=0): array
    {
        $kind=(string)($p['kind']??'');if(!in_array($kind,['oem','first','second'],true))throw new \InvalidArgumentException('请选择 OEM、一级代理或二级代理');
        $id=(int)($p['id']??0);if($id<0)throw new \InvalidArgumentException('记录不存在');
        if(array_key_exists('clip_borrow_platform',$p)&&($kind!=='oem'||!$canGrantClip))throw new \InvalidArgumentException('没有OEM剪辑配置借权授权权限');
        $name=self::text($p,'name',$kind==='oem'?32:80,true);
        if(!in_array((string)($p['status']??'1'),['0','1'],true))throw new \InvalidArgumentException('状态不正确');
        $status=(int)($p['status']??1);$account=self::text($p,'account',30,true);self::credentials($p,$id===0);
        if($kind!=='oem'){
            $tenantId=(int)($p['oem_id']??0);$tenant=Tenant::withoutGlobalScope()->where('id',$tenantId)->findOrEmpty();
            if($tenant->isEmpty()||!TenantContractService::enforceTenantActive($tenant))throw new \InvalidArgumentException('请选择已启用且服务有效的 OEM');
            if($id&&!Db::name('oem_agent')->where('tenant_id',$tenantId)->where('id',$id)->find())throw new \InvalidArgumentException('代理不存在或不属于该 OEM');
            $agent=['id'=>$id,'name'=>$name,'account'=>$account,'password'=>(string)($p['password']??''),'level'=>$kind==='first'?1:2,'parent_id'=>(int)($p['parent_id']??0),'contact'=>self::text($p,'contact',50),'mobile'=>self::text($p,'mobile',32),'notes'=>self::text($p,'notes',500),'status'=>$status];
            return ['kind'=>$kind,'id'=>OemDirectoryService::saveAgent($tenantId,$agent),'tenant_id'=>$tenantId];
        }
        return Db::transaction(function()use($p,$id,$name,$status,$account,$actor){
            $mobile=self::text($p,'mobile',32);$notes=self::text($p,'notes',500);
            if(!$id){
                $domain=self::text($p,'domain_alias',190,true);
                $days=(int)($p['valid_days']??365);if($days<1||$days>3650)throw new \InvalidArgumentException('有效天数须为 1–3650 天');
                $tenant=TenantProvisionService::create(['name'=>$name,'account'=>$account,'password'=>(string)$p['password'],'avatar'=>(string)config('project.default_image.admin_avatar'),'tel'=>$mobile,'domain_alias'=>$domain,'disable'=>$status?0:1,'notes'=>$notes,'tactics'=>0,'allow_custom_storage'=>0,'allow_local_storage'=>1,'contract_expire_time'=>time()+$days*86400]);
                if(array_key_exists('clip_borrow_platform',$p))\app\common\service\merchant\clip\ClipIntegrationService::grant((int)$tenant['id'],$p['clip_borrow_platform'],$actor,0);
                return ['kind'=>'oem','id'=>(int)$tenant['id'],'tenant_id'=>(int)$tenant['id']];
            }
            $tenant=Db::name('tenant')->where('id',$id)->whereNull('delete_time')->lock(true)->find();if(!$tenant)throw new \InvalidArgumentException('OEM 不存在');
            $admin=Db::name('tenant_admin')->where('tenant_id',$id)->where('root',1)->whereNull('delete_time')->lock(true)->find();if(!$admin)throw new \InvalidArgumentException('OEM 管理账号不存在');
            if(Db::name('oem_agent_account')->where('tenant_id',$id)->where('account',$account)->find()||Db::name('tenant_admin')->where('tenant_id',$id)->where('account',$account)->where('id','<>',$admin['id'])->whereNull('delete_time')->find())throw new \InvalidArgumentException('登录账号已被使用');
            $params=$tenant;$params['domain_aliases']=TenantDomainAliasService::getAliasesByTenantId($id);$params['name']=$name;$params['tel']=$mobile;$params['notes']=$notes;$params['disable']=$status?0:1;
            if(!TenantLogic::edit($params))throw new \InvalidArgumentException('OEM 资料保存失败');
            $changes=['account'=>$account];$password=(string)($p['password']??'');if($password!=='')$changes['password']=create_password($password,config('project.unique_identification'));
            Db::name('tenant_admin')->where('tenant_id',$id)->where('id',$admin['id'])->update($changes);
            if(!$status||$password!==''||$admin['account']!==$account){
                $ids=Db::name('tenant_admin')->where('tenant_id',$id)->column('id');$tokens=Db::name('tenant_admin_session')->whereIn('admin_id',$ids)->column('token');
                Db::name('tenant_admin_session')->whereIn('admin_id',$ids)->update(['expire_time'=>time()]);foreach($tokens as $token)(new \app\common\cache\TenantAdminTokenCache())->deleteAdminInfo($token);
                if(!$status)Db::name('oem_agent_session')->where('tenant_id',$id)->delete();
            }
            if(array_key_exists('clip_borrow_platform',$p)){
                $expected=$p['clip_borrow_revision']??null;
                if(!is_int($expected)&&!(is_string($expected)&&ctype_digit($expected)))throw new \InvalidArgumentException('请刷新代理列表以获取借权配置版本');
                \app\common\service\merchant\clip\ClipIntegrationService::grant($id,$p['clip_borrow_platform'],$actor,(int)$expected);
            }
            return ['kind'=>'oem','id'=>$id,'tenant_id'=>$id];
        });
    }
}
