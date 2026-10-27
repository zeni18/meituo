<?php
declare(strict_types=1);
namespace app\common\service\merchant;
use InvalidArgumentException as Invalid;
use think\facade\Db;

/** Audited manual handling only. No payment or external NFC operation is implied. */
final class MerchantStoreRequestService
{
    private static function text(array $p,string $key,int $max):string {
        if(isset($p[$key])&&!is_string($p[$key]))throw new Invalid('文字格式不正确');
        $v=trim($p[$key]??'');if(!mb_check_encoding($v,'UTF-8')||mb_strlen($v)>$max)throw new Invalid('文字长度或编码不正确');return $v;
    }
    private static function store(int $tenant,int $user,int $id):array {
        $row=Db::name('oem_merchant_store')->where(['tenant_id'=>$tenant,'user_id'=>$user,'id'=>$id,'delete_time'=>0])->lock(true)->find();
        if(!$row)throw new Invalid('门店不存在或无访问权限');return $row;
    }
    private static function query(int $tenant,int $user,int $store){return Db::name('oem_merchant_store_request')->where(['tenant_id'=>$tenant,'user_id'=>$user,'store_id'=>$store]);}
    public static function submit(int $tenant,int $user,array $p):array {
        return Db::transaction(function()use($tenant,$user,$p){$id=(int)($p['store_id']??0);self::store($tenant,$user,$id);$kind=$p['kind']??'';
            if(!in_array($kind,['renewal','nfc'],true))throw new Invalid('申请类型不正确');$note=self::text($p,'note',500);if($note==='')throw new Invalid('请填写申请说明');
            if(self::query($tenant,$user,$id)->where(['kind'=>$kind,'status'=>'pending'])->find())throw new Invalid('已有同类待审核申请，请勿重复提交');
            $request=(int)Db::name('oem_merchant_store_request')->insertGetId(['tenant_id'=>$tenant,'user_id'=>$user,'store_id'=>$id,'kind'=>$kind,'note'=>$note,'result'=>'{}','create_time'=>time()]);return ['id'=>$request];
        });
    }
    public static function history(int $tenant,int $user,array $p):array {
        $id=(int)($p['store_id']??0);self::store($tenant,$user,$id);$q=self::query($tenant,$user,$id);$count=(clone $q)->count();$page=max(1,min((int)($p['page']??1),max(1,(int)ceil($count/20))));
        return ['lists'=>$q->order('id desc')->page($page,20)->select()->toArray(),'count'=>$count,'page'=>$page];
    }
    public static function cancel(int $tenant,int $user,array $p):void {
        Db::transaction(function()use($tenant,$user,$p){$store=(int)($p['store_id']??0);self::store($tenant,$user,$store);if(!self::query($tenant,$user,$store)->where(['id'=>(int)($p['id']??0),'status'=>'pending'])->update(['status'=>'cancelled','review_time'=>time()]))throw new Invalid('申请已处理或无访问权限');});
    }
    private static function scoped(int $tenant,?array $agent) {
        $q=Db::name('oem_merchant_store_request')->alias('r')->join('oem_merchant m','m.tenant_id=r.tenant_id AND m.user_id=r.user_id')->join('oem_merchant_store s','s.tenant_id=r.tenant_id AND s.user_id=r.user_id AND s.id=r.store_id')->where('r.tenant_id',$tenant);
        if($agent){if((int)$agent['tenant_id']!==$tenant)throw new Invalid('代理身份不正确');$q->whereIn('m.agent_id',AgentAccessService::scope($agent));}return $q;
    }
    public static function listing(int $tenant,?array $agent,array $p):array {
        $q=self::scoped($tenant,$agent);$status=$p['status']??'';if($status!==''){if(!in_array($status,['pending','approved','rejected','cancelled'],true))throw new Invalid('申请状态不正确');$q->where('r.status',$status);}
        if(!empty($p['merchant_id']))$q->where('m.id',(int)$p['merchant_id']);$count=(clone $q)->count();$page=max(1,min((int)($p['page']??1),max(1,(int)ceil($count/15))));
        return ['lists'=>$q->field('r.*,m.name AS merchant_name,s.name AS store_name,s.delete_time AS store_deleted')->order('r.id desc')->page($page,15)->select()->toArray(),'count'=>$count,'page'=>$page];
    }
    public static function review(int $tenant,?array $agent,int $adminId,array $p):void {
        Db::transaction(function()use($tenant,$agent,$adminId,$p){
            $row=self::scoped($tenant,$agent)->where('r.id',(int)($p['id']??0))->field('r.*,m.status AS merchant_status')->lock(true)->find();if(!$row||$row['status']!=='pending')throw new Invalid('申请已处理或无管理权限');
            if((int)$row['merchant_status']!==1)throw new Invalid('商家已停用');$store=self::store($tenant,(int)$row['user_id'],(int)$row['store_id']);
            $decision=$p['decision']??'';if(!in_array($decision,['approved','rejected'],true))throw new Invalid('审核结果不正确');$note=self::text($p,'review_note',500);if($note==='')throw new Invalid('请填写审核／办理说明');$result=[];
            if($decision==='approved'){
                if($row['kind']==='renewal'){
                    $text=self::text($p,'expire_date',10);$d=\DateTimeImmutable::createFromFormat('!Y-m-d',$text,new \DateTimeZone('Asia/Shanghai'));
                    if(!$d||$d->format('Y-m-d')!==$text||$d->format('Y')>'2100')throw new Invalid('请选择有效到期日期');$expires=$d->getTimestamp()+86399;
                    $where=['tenant_id'=>$tenant,'user_id'=>$row['user_id'],'store_id'=>$row['store_id']];$old=Db::name('oem_merchant_store_meta')->where($where)->lock(true)->find();
                    if($expires<=max(time(),(int)($old['expire_time']??0)))throw new Invalid('新到期日期必须晚于当前到期时间和今日');
                    if($old)Db::name('oem_merchant_store_meta')->where($where)->update(['expire_time'=>$expires,'update_time'=>time()]);else Db::name('oem_merchant_store_meta')->insert($where+['expire_time'=>$expires,'decoration'=>'{}','update_time'=>time()]);$result=['expire_time'=>$expires];
                }else{
                    $ref=self::text($p,'activation_reference',128);if($ref==='')throw new Invalid('请填写线下办理的码牌编号／凭证');$result=['activation_reference'=>$ref,'mode'=>'manual_record'];
                }
            }
            self::query($tenant,(int)$row['user_id'],(int)$row['store_id'])->where('id',$row['id'])->update(['status'=>$decision,'review_note'=>$note,'reviewer_type'=>$agent?'agent':'oem','reviewer_id'=>$agent?(int)$agent['id']:$adminId,'result'=>json_encode($result,JSON_UNESCAPED_UNICODE),'review_time'=>time()]);
        });
    }
}
