<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use app\common\enum\user\AccountLogEnum;
use app\common\service\membership\MembershipService;
use think\facade\Db;

/** All merchant reads join the current ownership, including historical orders and logs. */
final class AgentOperationsService
{
    private static function actor(array $actor, bool $lock=false): array
    {
        $row=Db::name('oem_agent')->where(['tenant_id'=>(int)$actor['tenant_id'],'id'=>(int)$actor['id'],'status'=>1])->lock($lock)->find();
        if (!$row) throw new \InvalidArgumentException('代理账号已停用');
        if ((int)$row['level']===2 && !Db::name('oem_agent')->where(['tenant_id'=>$row['tenant_id'],'id'=>$row['parent_id'],'level'=>1,'status'=>1])->lock($lock)->find()) throw new \InvalidArgumentException('上级代理已停用');
        return $row;
    }
    private static function merchantQuery(array $actor)
    {
        return Db::name('oem_merchant')->alias('m')->where('m.tenant_id',$actor['tenant_id'])->whereIn('m.agent_id',AgentAccessService::scope($actor));
    }
    private static function merchant(array $actor, int $id, bool $lock=false): array
    {
        $row=self::merchantQuery($actor)->where('m.id',$id)->lock($lock)->find();
        if (!$row) throw new \InvalidArgumentException('商家不存在或无管理权限');
        if ($lock) {
            $owner=Db::name('oem_agent')->where(['tenant_id'=>$actor['tenant_id'],'id'=>$row['agent_id']])->lock(true)->find();
            if (!$owner || !((int)$owner['id']===(int)$actor['id'] || ((int)$actor['level']===1 && (int)$owner['level']===2 && (int)$owner['parent_id']===(int)$actor['id']))) throw new \InvalidArgumentException('商家归属已变更，请刷新');
            $user=Db::name(MerchantAccountTables::name((int)$actor['tenant_id'],'user'))->where(['tenant_id'=>$actor['tenant_id'],'id'=>$row['user_id']])->whereNull('delete_time')->lock(true)->find();
            if (!$user || (int)$row['status']!==1 || (int)$user['is_disable']===1 || (int)$owner['status']!==1) throw new \InvalidArgumentException('商家或所属代理已停用');
            $row['balance']=$user['user_money'];
        }
        return $row;
    }
    private static function page($query, array $p, string $order): array
    {
        $page=max(1,(int)($p['page'] ?? 1));
        return ['lists'=>$query->order($order)->page($page,15)->select()->toArray(),'count'=>(clone $query)->removeOption('order')->removeOption('limit')->count(),'page'=>$page,'page_size'=>15];
    }
    private static function filters($query, array $p, string $time, string $name='m.name'): void
    {
        if (isset($p['merchant_id']) && $p['merchant_id']!=='') $query->where('m.id',(int)$p['merchant_id']);
        if (isset($p['agent_id']) && $p['agent_id']!=='') $query->where('m.agent_id',(int)$p['agent_id']);
        $keyword=mb_substr(trim((string)($p['keyword'] ?? '')),0,80);
        if ($keyword!=='') $query->whereLike($name,'%'.addcslashes($keyword,'%_\\').'%');
        foreach (['date_from'=>'>=','date_to'=>'<='] as $key=>$op) {
            if (empty($p[$key])) continue;
            $date=\DateTimeImmutable::createFromFormat('!Y-m-d',(string)$p[$key]);
            if (!$date || $date->format('Y-m-d')!==$p[$key]) throw new \InvalidArgumentException('日期格式不正确');
            $query->where($time,$op,$date->getTimestamp()+($key==='date_to'?86399:0));
        }
    }
    public static function catalog(array $actor): array
    {
        $actor=self::actor($actor);$tenant=(int)$actor['tenant_id'];
        $apps=Db::name('tenant_app')->alias('ta')->join('app a','a.code=ta.app_code')->where('ta.tenant_id',$tenant)->where('a.status','installed')->whereIn('ta.buy_status',['paid','trial'])->where('ta.enable_status','enabled')->where('ta.shelf_status','on')->where(function($q){$q->where('ta.expire_time',0)->whereOr('ta.expire_time','>',time());})->where('a.code','<>','system_default')->field('a.code,a.name,a.description')->order('a.sort desc,a.id asc')->select()->toArray();
        $codes=array_column($apps,'code');
        foreach($apps as &$app)$app['needs_membership']=MembershipService::appRequiresMembership($tenant,$app['code']);unset($app);
        $plans=Db::name('membership_plan')->where(['tenant_id'=>$tenant,'status'=>1])->whereNull('delete_time')->field('id,name,description,duration_months,monthly_price,monthly_bonus_points')->order('sort desc,id asc')->select()->toArray();
        foreach ($plans as &$plan) {
            $plan['app_codes']=array_values(array_intersect($codes,Db::name('membership_plan_app')->where(['tenant_id'=>$tenant,'plan_id'=>$plan['id']])->column('app_code')));
            $plan['permanent']=$plan['name']==='免费会员' && (float)$plan['monthly_price']===0.0 && (float)$plan['monthly_bonus_points']===0.0;
        }
        return ['apps'=>$apps,'plans'=>$plans,'balance'=>self::balance($tenant,(int)$actor['id'])];
    }
    public static function merchants(array $actor, array $p): array
    {
        $actor=self::actor($actor);$tenant=(int)$actor['tenant_id'];
        $query=self::merchantQuery($actor)->join(MerchantAccountTables::name($tenant,'user').' u','u.tenant_id=m.tenant_id AND u.id=m.user_id')->whereNull('u.delete_time')->leftJoin('user_membership um','um.tenant_id=m.tenant_id AND um.user_id=m.user_id')->leftJoin('oem_agent a','a.tenant_id=m.tenant_id AND a.id=m.agent_id')->field('m.id,m.user_id,m.name,m.agent_id,m.status,u.account,u.user_money AS balance,a.name AS agent_name,um.plan_id,um.plan_name,um.expire_time,um.status AS membership_enabled,um.app_codes');
        self::filters($query,$p,'m.create_time');
        $result=self::page($query,$p,'m.id desc');$catalog=self::catalog($actor);
        foreach ($result['lists'] as &$row) {
            $row['member_active']=(int)$row['membership_enabled']===1 && (int)$row['expire_time']>time();
            $row['app_codes']=json_decode($row['app_codes'] ?? '[]',true) ?? [];
            $row['eligible_codes']=array_values(array_column(array_filter($catalog['apps'],fn($a)=>!$a['needs_membership'] || ($row['member_active'] && in_array($a['code'],$row['app_codes'],true))),'code'));
            $row['allowed_codes']=array_values(array_column(array_filter($catalog['apps'],fn($a)=>MerchantAppAccessService::allows($tenant,(int)$row['user_id'],$a['code']) && (!MembershipService::appRequiresMembership($tenant,$a['code']) || ($row['member_active'] && in_array($a['code'],$row['app_codes'],true)))),'code'));
        }
        return $result+['catalog'=>$catalog];
    }
    public static function overview(array $actor): array
    {
        $actor=self::actor($actor);$tenant=(int)$actor['tenant_id'];$start=strtotime('today');
        $query=self::merchantQuery($actor);$count=(clone $query)->count();
        $active=(clone $query)->where('m.status',1)->count();
        $expiring=(clone $query)->join('user_membership um','um.tenant_id=m.tenant_id AND um.user_id=m.user_id')->where('um.status',1)->whereBetween('um.expire_time',[time(),time()+604800])->count();
        $orders=self::orderQuery($actor,[]);
        $summary=['merchants'=>$count,'active'=>$active,'new_today'=>(clone $query)->where('m.create_time','>=',$start)->count(),'expiring'=>$expiring,'balance'=>self::balance($tenant,(int)$actor['id']),'orders'=>(clone $orders)->count(),'paid_amount'=>(clone $orders)->sum('o.paid_amount'),'unrecorded_amount'=>(clone $orders)->where('o.payment_status','未登记收款')->sum('o.amount'),'consumed_today'=>self::ledgerQuery($actor,[])->where('l.action',2)->where('l.change_type',AccountLogEnum::UM_DEC_APP_CONSUME)->where('l.create_time','>=',$start)->sum('l.change_amount')];
        $recent=self::orders($actor,['page'=>1]);
        // Query due merchants directly so pagination cannot omit a reminder.
        $dueQuery=self::merchantQuery($actor)->join('user_membership um','um.tenant_id=m.tenant_id AND um.user_id=m.user_id')->where('um.status',1)->whereBetween('um.expire_time',[time(),time()+604800])->field('m.id,m.name,um.plan_name,um.expire_time')->order('um.expire_time asc')->limit(8)->select()->toArray();
        return ['summary'=>$summary,'recent_orders'=>array_slice($recent['lists'],0,5),'expiring_merchants'=>$dueQuery,'role'=>(int)$actor['level']];
    }
    private static function ledgerQuery(array $actor, array $p)
    {
        $query=Db::name(MerchantAccountTables::name((int)$actor['tenant_id'],'user_account_log'))->alias('l')->join('oem_merchant m','m.tenant_id=l.tenant_id AND m.user_id=l.user_id')->where('l.tenant_id',$actor['tenant_id'])->whereIn('m.agent_id',AgentAccessService::scope($actor))->where('l.change_object',1)->whereNull('l.delete_time');
        self::filters($query,$p,'l.create_time','m.name|l.source_sn');
        if (in_array((string)($p['action'] ?? ''),['1','2'],true)) $query->where('l.action',(int)$p['action']);
        return $query;
    }
    public static function ledger(array $actor, array $p): array
    {
        $actor=self::actor($actor);$query=self::ledgerQuery($actor,$p);
        $totals=['increase'=>(clone $query)->where('l.action',1)->sum('l.change_amount'),'decrease'=>(clone $query)->where('l.action',2)->sum('l.change_amount'),'balance'=>self::balance((int)$actor['tenant_id'],(int)$actor['id'])];
        $query->field('l.id,l.sn,l.source_sn,l.action,l.change_type,l.change_amount,l.left_amount,l.remark,l.create_time,m.id AS merchant_id,m.name AS merchant_name');
        $result=self::page($query,$p,'l.id desc');
        foreach($result['lists'] as &$row) $row['type_name']=AccountLogEnum::getChangeTypeDesc((int)$row['change_type']);
        return $result+['summary'=>$totals];
    }
    private static function orderQuery(array $actor, array $p)
    {
        $scope=AgentAccessService::scope($actor);$tenant=(int)$actor['tenant_id'];
        $base=fn($table,$user)=>Db::name($table)->alias('r')->join('oem_merchant m','m.tenant_id=r.tenant_id AND m.user_id=r.'.$user)->where('r.tenant_id',$tenant)->whereIn('m.agent_id',$scope);
        $membership=$base('membership_order','user_id')->whereNull('r.delete_time')->field("CONCAT('membership:',r.id) AS id,r.order_sn AS sn,'套餐购买' AS kind,m.id AS merchant_id,m.agent_id,m.name AS merchant_name,r.plan_name AS item_name,r.order_amount AS amount,IF(r.pay_status=1,r.order_amount,0) AS paid_amount,IF(r.pay_status=1,'已支付','待支付') AS payment_status,IF(r.pay_status=1,'已开通','待支付') AS delivery_status,r.bonus_points AS points,r.create_time")->buildSql();
        $recharge=$base('recharge_order','user_id')->whereNull('r.delete_time')->field("CONCAT('recharge:',r.id) AS id,r.sn,'在线充值' AS kind,m.id AS merchant_id,m.agent_id,m.name AS merchant_name,r.package_name AS item_name,r.order_amount AS amount,IF(r.pay_status=1,r.order_amount,0) AS paid_amount,IF(r.refund_status>0,'退款处理中/已退款',IF(r.pay_status=1,'已支付','待支付')) AS payment_status,IF(r.refund_status>0,'退款处理中/已退款',IF(r.pay_status=1,'已到账','待支付')) AS delivery_status,r.recharge_points AS points,r.create_time")->buildSql();
        $manual=$base('oem_agent_operation','user_id')->whereIn('r.kind',['membership','recharge'])->field("CONCAT('agent:',r.id) AS id,r.sn,IF(r.kind='membership','代理开通套餐','代理充值') AS kind,m.id AS merchant_id,m.agent_id,m.name AS merchant_name,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.detail,'$.item_name')),'') AS item_name,r.amount,0 AS paid_amount,'未登记收款' AS payment_status,'已办理' AS delivery_status,r.points,r.create_time")->buildSql();
        $union='('.substr($membership,1,-1).' UNION ALL '.substr($recharge,1,-1).' UNION ALL '.substr($manual,1,-1).')';
        $query=Db::table([$union=>'o']);
        $filter=$p;unset($filter['merchant_id'],$filter['agent_id']);self::filters($query,$filter,'o.create_time','o.merchant_name|o.sn');
        if (isset($p['merchant_id']) && $p['merchant_id']!=='') $query->where('o.merchant_id',(int)$p['merchant_id']);
        if (isset($p['agent_id']) && $p['agent_id']!=='') $query->where('o.agent_id',(int)$p['agent_id']);
        if (!empty($p['payment_status'])) $query->where('o.payment_status',(string)$p['payment_status']);
        return $query;
    }
    public static function orders(array $actor, array $p): array
    {
        $actor=self::actor($actor);$query=self::orderQuery($actor,$p);
        $summary=['count'=>(clone $query)->count(),'paid_amount'=>(clone $query)->sum('o.paid_amount'),'unrecorded_amount'=>(clone $query)->where('o.payment_status','未登记收款')->sum('o.amount')];
        return self::page($query,$p,'o.create_time desc,o.id desc')+['summary'=>$summary];
    }
    public static function balance(int $tenant, int $agent): string
    {
        return (string)(Db::name('oem_agent_wallet')->where(['tenant_id'=>$tenant,'agent_id'=>$agent])->value('balance') ?? '0.00');
    }
    private static function cents($value, bool $zero=false): int
    {
        if ((!is_string($value) && !is_int($value) && !is_float($value)) || !preg_match('/^(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?$/D',(string)$value)) throw new \InvalidArgumentException('数量或金额须为最多两位小数的有效数值');
        $result=(int)round((float)$value*100);
        if (!$zero && $result<=0) throw new \InvalidArgumentException('算力数量必须大于零');
        return $result;
    }
    private static function decimal(int $value): string { return sprintf('%d.%02d',intdiv($value,100),abs($value%100)); }
    private static function key(array $p): string
    {
        $key=(string)($p['request_key'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_-]{16,64}$/D',$key)) throw new \InvalidArgumentException('请求标识失效，请重新打开表单');
        return $key;
    }
    private static function operation(int $tenant, int $actor, array $p, string $kind, array $fields, callable $work): array
    {
        $key=self::key($p);ksort($p);$hash=hash('sha256',$kind.'|'.json_encode($p,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
        $old=Db::name('oem_agent_operation')->where(['tenant_id'=>$tenant,'actor_agent_id'=>$actor,'request_key'=>$key])->find();
        if ($old) {
            if (!hash_equals($old['payload_hash'],$hash)) throw new \InvalidArgumentException('同一请求标识不能用于不同操作');
            return ['id'=>(int)$old['id'],'sn'=>$old['sn'],'result'=>json_decode($old['detail'],true),'replayed'=>true];
        }
        $sn='AG'.date('ymdHis').bin2hex(random_bytes(6));
        $id=(int)Db::name('oem_agent_operation')->insertGetId($fields+['sn'=>$sn,'tenant_id'=>$tenant,'actor_agent_id'=>$actor,'kind'=>$kind,'request_key'=>$key,'payload_hash'=>$hash,'detail'=>'{}','create_time'=>time()]);
        $result=$work($id,$sn);
        Db::name('oem_agent_operation')->where('id',$id)->update(['detail'=>json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
        return ['id'=>$id,'sn'=>$sn,'result'=>$result,'replayed'=>false];
    }
    private static function wallet(int $tenant,int $agent,int $delta,int $operation): string
    {
        Db::name('oem_agent_wallet')->extra('IGNORE')->insert(['tenant_id'=>$tenant,'agent_id'=>$agent,'balance'=>'0.00','update_time'=>time()]);
        $row=Db::name('oem_agent_wallet')->where(['tenant_id'=>$tenant,'agent_id'=>$agent])->lock(true)->find();
        $after=self::cents($row['balance'],true)+$delta;
        if ($after<0) throw new \InvalidArgumentException('可分配算力额度不足，请联系上级补充');
        if ($after>999999999) throw new \InvalidArgumentException('额度超过上限');
        $balance=self::decimal($after);
        Db::name('oem_agent_wallet')->where(['tenant_id'=>$tenant,'agent_id'=>$agent])->update(['balance'=>$balance,'update_time'=>time()]);
        Db::name('oem_agent_wallet_log')->insert(['tenant_id'=>$tenant,'agent_id'=>$agent,'operation_id'=>$operation,'delta'=>($delta<0?'-':'').self::decimal(abs($delta)),'balance'=>$balance,'create_time'=>time()]);
        return $balance;
    }
    private static function credit(array $actor,array $merchant,int $points,int $operation,string $sn,int $type): string
    {
        $tenant=(int)$actor['tenant_id'];$table=MerchantAccountTables::name($tenant,'user');
        $before=Db::name($table)->where(['tenant_id'=>$tenant,'id'=>$merchant['user_id']])->lock(true)->value('user_money');
        $after=self::cents($before,true)+$points;
        if ($after>999999999) throw new \InvalidArgumentException('商家算力余额超过上限');
        self::wallet($tenant,(int)$actor['id'],-$points,$operation);
        $balance=self::decimal($after);
        Db::name($table)->where(['tenant_id'=>$tenant,'id'=>$merchant['user_id']])->update(['user_money'=>$balance,'update_time'=>time()]);
        Db::name(MerchantAccountTables::name($tenant,'user_account_log'))->insert(['tenant_id'=>$tenant,'sn'=>'AL'.bin2hex(random_bytes(12)),'user_id'=>$merchant['user_id'],'change_object'=>1,'change_type'=>$type,'action'=>1,'change_amount'=>self::decimal($points),'left_amount'=>$balance,'source_sn'=>$sn,'remark'=>$type===AccountLogEnum::UM_INC_MEMBERSHIP_BONUS?'代理开通套餐赠送算力':'代理额度充值','extra'=>json_encode(['agent_id'=>$actor['id'],'operation_id'=>$operation]),'create_time'=>time(),'update_time'=>time()]);
        return $balance;
    }
    public static function recharge(array $actor,array $p): array
    {
        return Db::transaction(function() use($actor,$p){
            $actor=self::actor($actor,true);self::assertContext($actor,$p);$merchant=self::merchant($actor,(int)($p['merchant_id'] ?? 0),true);
            $points=self::cents($p['points'] ?? '');$amount=self::cents($p['amount'] ?? '0',true);$note=self::note($p);
            return self::operation((int)$actor['tenant_id'],(int)$actor['id'],$p,'recharge',['merchant_id'=>$merchant['id'],'user_id'=>$merchant['user_id'],'points'=>self::decimal($points),'amount'=>self::decimal($amount)],function($id,$sn) use($actor,$merchant,$points,$note){
                return ['item_name'=>'商家算力充值','merchant_balance'=>self::credit($actor,$merchant,$points,$id,$sn,AccountLogEnum::UM_INC_RECHARGE),'note'=>$note];
            });
        });
    }
    public static function assignPlan(array $actor,array $p): array
    {
        return Db::transaction(function() use($actor,$p){
            $actor=self::actor($actor,true);self::assertContext($actor,$p);$tenant=(int)$actor['tenant_id'];$merchant=self::merchant($actor,(int)($p['merchant_id'] ?? 0),true);
            $plan=Db::name('membership_plan')->where(['tenant_id'=>$tenant,'id'=>(int)($p['plan_id'] ?? 0),'status'=>1])->whereNull('delete_time')->lock(true)->find();
            if (!$plan) throw new \InvalidArgumentException('套餐不存在或已下架');
            $mode=(string)($p['mode'] ?? 'open');if (!in_array($mode,['open','renew'],true)) throw new \InvalidArgumentException('套餐办理类型不正确');
            $note=self::note($p);$bonus=self::cents($plan['monthly_bonus_points'],true);
            return self::operation($tenant,(int)$actor['id'],$p,'membership',['merchant_id'=>$merchant['id'],'user_id'=>$merchant['user_id'],'points'=>self::decimal($bonus),'amount'=>$plan['monthly_price']],function($id,$sn) use($actor,$tenant,$merchant,$plan,$mode,$bonus,$note){
                $current=Db::name('user_membership')->where(['tenant_id'=>$tenant,'user_id'=>$merchant['user_id']])->lock(true)->find();
                if ($mode==='renew' && (!$current || (int)$current['plan_id']!==(int)$plan['id'])) throw new \InvalidArgumentException('续费必须选择商家当前套餐');
                $base=($mode==='renew' && (int)$current['expire_time']<4294967295 && (int)$current['status']===1)?max(time(),(int)$current['expire_time']):time();
                $expire=strtotime('+'.max(1,(int)$plan['duration_months']).' months',$base);
                if (!$expire || $expire>=4294967295) throw new \InvalidArgumentException('套餐有效期超过上限');
                if ($plan['name']==='免费会员' && (float)$plan['monthly_price']===0.0 && $bonus===0) $expire=4294967295;
                $catalog=self::catalog($actor);$codes=[];foreach($catalog['plans'] as $option)if((int)$option['id']===(int)$plan['id'])$codes=$option['app_codes'];
                $data=['plan_id'=>$plan['id'],'plan_name'=>$plan['name'],'app_codes'=>json_encode($codes),'features'=>$plan['features'] ?: '[]','start_time'=>$mode==='renew'?(int)($current['start_time'] ?? time()):time(),'expire_time'=>$expire,'status'=>1,'source_order_sn'=>$sn,'update_time'=>time()];
                if ($current) Db::name('user_membership')->where('id',$current['id'])->update($data);
                else Db::name('user_membership')->insert($data+['tenant_id'=>$tenant,'user_id'=>$merchant['user_id'],'create_time'=>time()]);
                if($bonus>0) self::credit($actor,$merchant,$bonus,$id,$sn,AccountLogEnum::UM_INC_MEMBERSHIP_BONUS);
                // Preserve a deliberately restricted whitelist when renewing or changing plan.
                return ['item_name'=>$plan['name'],'plan_id'=>(int)$plan['id'],'mode'=>$mode,'expire_time'=>$expire,'app_codes'=>$codes,'note'=>$note];
            });
        });
    }
    public static function authorizeApps(array $actor,array $p): array
    {
        return Db::transaction(function() use($actor,$p){
            $actor=self::actor($actor,true);self::assertContext($actor,$p);$tenant=(int)$actor['tenant_id'];$merchant=self::merchant($actor,(int)($p['merchant_id'] ?? 0),true);
            if (!isset($p['app_codes']) || !is_array($p['app_codes'])) throw new \InvalidArgumentException('请选择有效应用');
            if(count($p['app_codes'])>200)throw new \InvalidArgumentException('一次最多授权 200 个应用');
            foreach($p['app_codes'] as $code)if(!is_string($code) || strlen($code)>64)throw new \InvalidArgumentException('应用代码不正确');
            $codes=array_values(array_unique($p['app_codes']));
            $catalog=self::catalog($actor);$available=array_column($catalog['apps'],'code');
            $membership=Db::name('user_membership')->where(['tenant_id'=>$tenant,'user_id'=>$merchant['user_id']])->lock(true)->find();
            foreach($codes as $code){if(!in_array($code,$available,true))throw new \InvalidArgumentException('应用未获 OEM 授权或已停用');if(MembershipService::appRequiresMembership($tenant,$code) && (!$membership || (int)$membership['status']!==1 || (int)$membership['expire_time']<=time() || !in_array($code,json_decode($membership['app_codes'],true) ?? [],true)))throw new \InvalidArgumentException('所选应用超出商家当前套餐权益');}
            return self::operation($tenant,(int)$actor['id'],$p,'apps',['merchant_id'=>$merchant['id'],'user_id'=>$merchant['user_id']],function() use($tenant,$merchant,$codes){
                Db::name('oem_merchant_app_access')->replace()->insert(['tenant_id'=>$tenant,'user_id'=>$merchant['user_id'],'app_codes'=>json_encode($codes),'update_time'=>time()]);
                return ['app_codes'=>$codes,'item_name'=>'商家应用授权'];
            });
        });
    }
    private static function assertContext(array $actor,array $p): void
    {
        foreach(['tenant_id'=>(int)$actor['tenant_id'],'actor_agent_id'=>(int)$actor['id']] as $key=>$expected)if(isset($p[$key])&&(string)$p[$key]!== (string)$expected)throw new \InvalidArgumentException('不能指定其他代理或 OEM 身份');
    }
    private static function note(array $p): string
    {
        if(isset($p['note'])&&!is_string($p['note']))throw new \InvalidArgumentException('备注格式不正确');
        $note=trim((string)($p['note'] ?? ''));if(mb_strlen($note)>200)throw new \InvalidArgumentException('备注不能超过 200 字');return $note;
    }
    public static function allocate(?array $actor,int $tenant,int $adminId,array $p): array
    {
        return Db::transaction(function() use($actor,$tenant,$adminId,$p){
            if($actor){$actor=self::actor($actor,true);self::assertContext($actor,$p);if((int)$actor['level']!==1 || (int)$actor['tenant_id']!==$tenant)throw new \InvalidArgumentException('仅一级代理可向自己的二级代理划拨额度');}
            else {Db::name('tenant')->where('id',$tenant)->lock(true)->find();if(isset($p['tenant_id'])&&(int)$p['tenant_id']!==$tenant)throw new \InvalidArgumentException('OEM 身份不正确');}
            $target=Db::name('oem_agent')->where(['tenant_id'=>$tenant,'id'=>(int)($p['target_agent_id'] ?? 0),'status'=>1])->lock(true)->find();
            if(!$target || ($actor && ((int)$target['level']!==2 || (int)$target['parent_id']!==(int)$actor['id'])))throw new \InvalidArgumentException('代理不存在或无额度管理权限');
            $points=self::cents($p['points'] ?? '');$note=self::note($p);
            return self::operation($tenant,(int)($actor['id'] ?? 0),$p,$actor?'allocation':'quota_grant',['admin_id'=>$adminId,'target_agent_id'=>$target['id'],'points'=>self::decimal($points)],function($id) use($actor,$tenant,$target,$points,$note){
                if($actor)self::wallet($tenant,(int)$actor['id'],-$points,$id);
                $balance=self::wallet($tenant,(int)$target['id'],$points,$id);
                return ['item_name'=>$actor?'下级额度划拨':'OEM 授予额度','target_balance'=>$balance,'note'=>$note];
            });
        });
    }
    public static function walletLogs(array $actor,array $p): array
    {
        $actor=self::actor($actor);$query=Db::name('oem_agent_wallet_log')->alias('l')->join('oem_agent_operation o','o.id=l.operation_id AND o.tenant_id=l.tenant_id')->where(['l.tenant_id'=>$actor['tenant_id'],'l.agent_id'=>$actor['id']])->field('l.id,l.delta,l.balance,l.create_time,o.sn,o.kind');
        return self::page($query,$p,'l.id desc')+['balance'=>self::balance((int)$actor['tenant_id'],(int)$actor['id'])];
    }
}
