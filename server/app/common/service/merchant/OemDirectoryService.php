<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use think\facade\Db;
use app\common\model\user\User;

final class OemDirectoryService
{
    private static function text(array $p, string $key, int $max, bool $required = false): string
    {
        $value = trim((string)($p[$key] ?? ''));
        if (($required && $value === '') || mb_strlen($value) > $max) throw new \InvalidArgumentException('请检查' . ['name'=>'名称','contact'=>'联系人','mobile'=>'联系电话','industry'=>'行业','notes'=>'备注'][$key] . '，长度上限为 ' . $max . ' 字');
        return $value;
    }
    private static function status(array $p): int
    {
        $value = (string)($p['status'] ?? '1');
        if (!in_array($value, ['0','1'], true)) throw new \InvalidArgumentException('状态不正确');
        return (int)$value;
    }
    public static function list(int $tenantId, string $kind, array $params, ?array $agentScope = null, ?int $parentAgentId = null): array
    {
        if ($tenantId <= 0 || !in_array($kind, ['agent','merchant'], true)) throw new \InvalidArgumentException('OEM 身份无效');
        $query = Db::name('oem_' . $kind)->alias('d')->where('d.tenant_id', $tenantId);
        if ($parentAgentId !== null) {
            if ($kind !== 'agent' || $parentAgentId <= 0) throw new \InvalidArgumentException('没有二级代理管理权限');
            $query->where('d.parent_id',$parentAgentId)->where('d.level',2);
        }
        if ($agentScope !== null) {
            if ($kind !== 'merchant' || !$agentScope) throw new \InvalidArgumentException('没有代理数据权限');
            $query->whereIn('d.agent_id',$agentScope);
        }
        $statsQuery = clone $query;
        $keyword = mb_substr(trim((string)($params['keyword'] ?? '')), 0, 80);
        if ($keyword !== '') $query->whereLike('d.name|d.contact|d.mobile', '%' . addcslashes($keyword, '%_\\') . '%');
        if (isset($params['status']) && in_array((string)$params['status'], ['0','1'], true)) $query->where('d.status', (int)$params['status']);
        if ($kind === 'agent' && in_array((string)($params['level'] ?? ''), ['1','2'], true)) $query->where('d.level', (int)$params['level']);
        if ($kind === 'merchant' && isset($params['agent_id']) && $params['agent_id'] !== '') $query->where('d.agent_id', (int)$params['agent_id']);
        $count = (clone $query)->count();
        $page = max(1, (int)($params['page'] ?? 1));
        if ($kind === 'merchant') {
            $query->join(MerchantAccountTables::name($tenantId,'user').' u', 'u.id=d.user_id AND u.tenant_id=d.tenant_id')->leftJoin('oem_agent a', 'a.id=d.agent_id AND a.tenant_id=d.tenant_id')->field('d.*,u.account,u.user_money AS balance,a.name AS agent_name');
        } else {
            $query->leftJoin('oem_agent p', 'p.id=d.parent_id AND p.tenant_id=d.tenant_id')->leftJoin('oem_agent_account c','c.agent_id=d.id AND c.tenant_id=d.tenant_id')->field('d.*,p.name AS parent_name,c.account');
        }
        $rows = $query->order('d.id desc')->page($page, 15)->select()->toArray();
        if ($kind === 'agent') foreach ($rows as &$row) {
            $row['merchant_count'] = Db::name('oem_merchant')->where('tenant_id', $tenantId)->where('agent_id', $row['id'])->count();
            $row['quota_balance']=AgentOperationsService::balance($tenantId,(int)$row['id']);
        }
        $agents = Db::name('oem_agent')->where('tenant_id',$tenantId);
        if ($parentAgentId !== null) $agents->where('parent_id',$parentAgentId)->where('level',2);
        if ($agentScope !== null) $agents->whereIn('id',$agentScope);
        return ['lists'=>$rows, 'count'=>$count, 'page'=>$page, 'page_size'=>15,
            'stats'=>['total'=>(clone $statsQuery)->count(), 'active'=>(clone $statsQuery)->where('d.status',1)->count()],
            'agents'=>$agents->order('level asc,id asc')->field('id,name,level,parent_id,status')->select()->toArray()];
    }
    public static function listChildAgents(array $actor, array $params): array
    {
        $tenantId=(int)$actor['tenant_id'];
        $parent=self::activeAgent($tenantId,(int)$actor['id']);
        if ((int)$parent['level']!==1) throw new \InvalidArgumentException('仅一级代理可管理名下二级代理');
        $data=self::list($tenantId,'agent',$params,null,(int)$parent['id']);
        $data['actor_agent_id']=(int)$parent['id'];
        return $data;
    }
    public static function saveChildAgent(array $actor, array $p): int
    {
        return Db::transaction(function () use ($actor,$p) {
            $tenantId=(int)$actor['tenant_id'];
            $parent=self::activeAgent($tenantId,(int)$actor['id']);
            $parentId=(int)$parent['id'];
            if ((int)$parent['level']!==1) throw new \InvalidArgumentException('仅一级代理可管理名下二级代理');
            foreach (['tenant_id'=>$tenantId,'parent_id'=>$parentId,'level'=>2] as $key=>$expected) {
                if (isset($p[$key]) && (string)$p[$key] !== (string)$expected) throw new \InvalidArgumentException('只能开通和管理自己名下的二级代理');
            }
            $id=max(0,(int)($p['id'] ?? 0));
            if ($id && !Db::name('oem_agent')->where(['tenant_id'=>$tenantId,'id'=>$id,'parent_id'=>$parentId,'level'=>2])->lock(true)->find()) throw new \InvalidArgumentException('二级代理不存在');
            // The server owns the hierarchy. Never accept a client-selected parent or level.
            return self::saveAgent($tenantId,array_merge($p,['level'=>2,'parent_id'=>$parentId]));
        });
    }
    private static function activeAgent(int $tenantId, int $id): array
    {
        $agent = Db::name('oem_agent')->where('tenant_id',$tenantId)->where('id',$id)->where('status',1)->lock(true)->find();
        if (!$agent) throw new \InvalidArgumentException('请选择本 OEM 下已启用的代理');
        if ((int)$agent['level'] === 2 && !Db::name('oem_agent')->where('tenant_id',$tenantId)->where('id',$agent['parent_id'])->where('status',1)->where('level',1)->lock(true)->find()) throw new \InvalidArgumentException('该代理的上级已停用');
        return $agent;
    }
    public static function saveAgent(int $tenantId, array $p): int
    {
        return Db::transaction(function () use ($tenantId, $p) {
            $id = max(0,(int)($p['id'] ?? 0));
            $old = $id ? Db::name('oem_agent')->where('tenant_id',$tenantId)->where('id',$id)->lock(true)->find() : null;
            if ($id && !$old) throw new \InvalidArgumentException('代理不存在');
            $level = (int)($p['level'] ?? 1);
            if (!in_array($level,[1,2],true)) throw new \InvalidArgumentException('代理级别不正确');
            $parent = $level === 2 ? (int)($p['parent_id'] ?? 0) : 0;
            if ($level === 2) {
                if ($parent <= 0 || $parent === $id) throw new \InvalidArgumentException('请选择有效的一级上级代理');
                if ((int)self::activeAgent($tenantId,$parent)['level'] !== 1) throw new \InvalidArgumentException('二级代理的上级必须是一级代理');
                if ($id && Db::name('oem_agent')->where('tenant_id',$tenantId)->where('parent_id',$id)->count()) throw new \InvalidArgumentException('请先调整此代理的下级关系');
            }
            $data = ['name'=>self::text($p,'name',80,true), 'contact'=>self::text($p,'contact',50), 'mobile'=>self::text($p,'mobile',32), 'notes'=>self::text($p,'notes',500), 'level'=>$level, 'parent_id'=>$parent, 'status'=>self::status($p), 'update_time'=>time()];
            if ($id) Db::name('oem_agent')->where('tenant_id',$tenantId)->where('id',$id)->update($data);
            else $id = (int)Db::name('oem_agent')->insertGetId($data + ['tenant_id'=>$tenantId,'create_time'=>time()]);
            AgentAccessService::saveAccount($tenantId,$id,$p);
            if (!$data['status']) {
                $children = Db::name('oem_agent')->where('tenant_id',$tenantId)->where('parent_id',$id)->column('id');
                AgentAccessService::revoke($tenantId,array_merge([$id],$children));
            }
            return $id;
        });
    }
    public static function saveMerchant(int $tenantId, array $p, ?array $agentScope = null): int
    {
        return Db::transaction(function () use ($tenantId,$p,$agentScope) {
            $userTable = MerchantAccountTables::name($tenantId,'user');
            $sessionTable = MerchantAccountTables::name($tenantId,'user_session');
            $id = max(0,(int)($p['id'] ?? 0));
            $query = Db::name('oem_merchant')->where('tenant_id',$tenantId)->where('id',$id);
            if ($agentScope !== null) {
                if (!$agentScope) throw new \InvalidArgumentException('没有代理数据权限');
                $query->whereIn('agent_id',$agentScope);
            }
            $old = $id ? $query->lock(true)->find() : null;
            if ($id && !$old) throw new \InvalidArgumentException('商家不存在');
            $agentId = max(0,(int)($p['agent_id'] ?? $old['agent_id'] ?? ($agentScope[0] ?? 0)));
            if ($agentScope !== null && !in_array($agentId,$agentScope,true)) throw new \InvalidArgumentException('只能管理自己及名下二级代理的商家');
            if ($agentId > 0 && (!$old || (int)$old['agent_id'] !== $agentId)) self::activeAgent($tenantId,$agentId);
            $data = ['name'=>self::text($p,'name',80,true), 'contact'=>self::text($p,'contact',50), 'mobile'=>self::text($p,'mobile',32), 'industry'=>self::text($p,'industry',50), 'notes'=>self::text($p,'notes',500), 'agent_id'=>$agentId, 'status'=>self::status($p),'update_time'=>time()];
            if ($old) {
                $ownerId = (int)$old['user_id'];
                if (!Db::name($userTable)->where('tenant_id',$tenantId)->where('id',$ownerId)->whereNull('delete_time')->lock(true)->find()) throw new \InvalidArgumentException('关联账号不存在');
                Db::name('oem_merchant')->where('tenant_id',$tenantId)->where('id',$id)->update($data);
            } else {
                $account = trim((string)($p['account'] ?? ''));
                $password = (string)($p['password'] ?? '');
                if (!preg_match('/^[A-Za-z0-9_]{3,30}$/D',$account)) throw new \InvalidArgumentException('登录账号须为 3–30 位字母、数字或下划线');
                if (strlen($password)<8 || strlen($password)>20 || !preg_match('/[A-Za-z]/',$password) || !preg_match('/[0-9]/',$password)) throw new \InvalidArgumentException('密码须为 8–20 位，并包含字母和数字');
                if (Db::name($userTable)->where('account',$account)->find()) throw new \InvalidArgumentException('登录账号已存在，请更换');
                $ownerId = (int)Db::name($userTable)->insertGetId(['tenant_id'=>$tenantId,'sn'=>User::createUserSn(),'nickname'=>mb_substr($data['name'],0,32),'account'=>$account,'password'=>create_password($password,config('project.unique_identification')),'channel'=>4,'create_time'=>time(),'update_time'=>time()]);
                $id = (int)Db::name('oem_merchant')->insertGetId($data + ['tenant_id'=>$tenantId,'user_id'=>$ownerId,'create_time'=>time()]);
                \app\common\service\membership\MembershipService::grantDefaultFreeMembership($tenantId,$ownerId);
            }
            Db::name($userTable)->where('tenant_id',$tenantId)->where('id',$ownerId)->update(['is_disable'=>$data['status'] ? 0 : 1,'real_name'=>mb_substr($data['contact'],0,32),'mobile'=>$data['mobile'],'update_time'=>time()]);
            if (!$data['status']) Db::name($sessionTable)->where('tenant_id',$tenantId)->where('user_id',$ownerId)->update(['expire_time'=>time()]);
            return $id;
        });
    }
}
