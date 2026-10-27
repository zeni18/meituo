<?php
declare(strict_types=1);
namespace app\common\service\merchant;

use think\facade\Db;
use think\facade\Cache;

final class AgentAccessService
{
    public const COOKIE = 'oem_agent_session';
    public const LIFETIME = 28800;

    private static function active(int $tenantId, int $agentId): ?array
    {
        $agent = Db::name('oem_agent')->where('tenant_id',$tenantId)->where('id',$agentId)->where('status',1)->find();
        if (!$agent) return null;
        if ((int)$agent['level'] === 2 && !Db::name('oem_agent')->where(['tenant_id'=>$tenantId,'id'=>$agent['parent_id'],'level'=>1,'status'=>1])->find()) return null;
        return $agent;
    }

    public static function identity(string $token, int $tenantId): ?array
    {
        if ($tenantId <= 0 || !preg_match('/^[a-f0-9]{64}$/D',$token)) return null;
        $session = Db::name('oem_agent_session')->where('tenant_id',$tenantId)->where('token_hash',hash('sha256',$token))->where('expire_time','>',time())->find();
        return $session ? self::active($tenantId,(int)$session['agent_id']) : null;
    }

    public static function scope(array $agent): array
    {
        $current = self::active((int)$agent['tenant_id'],(int)$agent['id']);
        if (!$current) throw new \InvalidArgumentException('代理账号已停用，请重新登录');
        $ids = [(int)$current['id']];
        if ((int)$current['level'] === 1) {
            $ids = array_merge($ids,array_map('intval',Db::name('oem_agent')->where('tenant_id',$current['tenant_id'])->where('parent_id',$current['id'])->where('level',2)->column('id')));
        }
        return $ids;
    }

    public static function login(int $tenantId, string $account, string $password, string $ip): array
    {
        $ipKey = 'agent_login_ip_'.hash('sha256',$tenantId.'|'.$ip);
        $key = 'agent_login_account_'.hash('sha256',$tenantId.'|'.strtolower($account));
        if ((int)Cache::get($key,0) >= 5 || (int)Cache::get($ipKey,0) >= 30) throw new \InvalidArgumentException('登录失败次数过多，请 15 分钟后重试');
        $credentials = strlen($account)<=30 ? Db::name('oem_agent_account')->where('tenant_id',$tenantId)->where('account',$account)->find() : null;
        $hash = $credentials['password_hash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        $correct = strlen($password)<=72 && password_verify($password,$hash);
        $agent = $credentials ? self::active($tenantId,(int)$credentials['agent_id']) : null;
        if (!$correct || !$agent) {
            Cache::set($key,(int)Cache::get($key,0)+1,900);
            Cache::set($ipKey,(int)Cache::get($ipKey,0)+1,900);
            throw new \InvalidArgumentException('代理账号或密码错误，或账号已停用');
        }
        Cache::delete($key);
        $token = bin2hex(random_bytes(32));
        Db::name('oem_agent_session')->where('tenant_id',$tenantId)->where('expire_time','<=',time())->delete();
        Db::name('oem_agent_session')->insert(['token_hash'=>hash('sha256',$token),'tenant_id'=>$tenantId,'agent_id'=>$agent['id'],'create_time'=>time(),'expire_time'=>time()+self::LIFETIME]);
        return ['token'=>$token,'agent'=>$agent];
    }

    public static function logout(string $token, int $tenantId): void
    {
        Db::name('oem_agent_session')->where('tenant_id',$tenantId)->where('token_hash',hash('sha256',$token))->delete();
    }

    public static function saveAccount(int $tenantId, int $agentId, array $p): void
    {
        $old = Db::name('oem_agent_account')->where('tenant_id',$tenantId)->where('agent_id',$agentId)->lock(true)->find();
        $account = trim((string)($p['account'] ?? $old['account'] ?? ''));
        $password = (string)($p['password'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_]{3,30}$/D',$account)) throw new \InvalidArgumentException('代理登录账号须为 3–30 位字母、数字或下划线');
        if (Db::name('tenant_admin')->where('tenant_id',$tenantId)->where('account',$account)->whereNull('delete_time')->find()) throw new \InvalidArgumentException('该账号已被 OEM 管理员使用，请更换代理账号');
        if (Db::name('oem_agent_account')->where('tenant_id',$tenantId)->where('account',$account)->where('agent_id','<>',$agentId)->find()) throw new \InvalidArgumentException('代理登录账号已存在');
        if (!$old || $password !== '') {
            if (strlen($password)<8 || strlen($password)>20 || !preg_match('/[A-Za-z]/',$password) || !preg_match('/[0-9]/',$password)) throw new \InvalidArgumentException('代理密码须为 8–20 位，并包含字母和数字');
        }
        $data = ['tenant_id'=>$tenantId,'account'=>$account,'update_time'=>time()];
        if ($password !== '') $data['password_hash'] = password_hash($password,PASSWORD_DEFAULT);
        if ($old) Db::name('oem_agent_account')->where('tenant_id',$tenantId)->where('agent_id',$agentId)->update($data);
        else Db::name('oem_agent_account')->insert($data+['agent_id'=>$agentId]);
        if (!$old || $password!=='' || $old['account']!==$account) self::revoke($tenantId,[$agentId]);
    }

    public static function revoke(int $tenantId, array $ids): void
    {
        Db::name('oem_agent_session')->where('tenant_id',$tenantId)->whereIn('agent_id',$ids)->delete();
    }
}
