<?php
declare(strict_types=1);
namespace app\api\controller;

use app\api\logic\LoginLogic;
use app\api\validate\LoginAccountValidate;
use app\api\service\UserTokenService;
use app\common\service\merchant\MerchantAccessService;
use app\common\service\merchant\MerchantAccountTables;
use app\common\service\merchant\MerchantBrandingService;
use app\common\service\license\CopyrightPolicyService;
use app\common\service\app\AppFrontendManifestService;
use think\facade\Db;

class MerchantController extends BaseApiController
{
    public array $notNeedLogin = ['config', 'login'];

    public function config()
    {
        return $this->data(array_merge(MerchantBrandingService::read(), [
            'copyright' => CopyrightPolicyService::policy(),
        ]));
    }

    private function sameOrigin(): void
    {
        if (!$this->request->isPost()) throw new \RuntimeException('请使用 POST 请求');
        $origin = rtrim((string)$this->request->header('origin', ''), '/');
        if ($origin !== '' && $origin !== rtrim($this->request->domain(), '/')) throw new \RuntimeException('请求来源不匹配');
    }

    public function login()
    {
        try {
            $this->sameOrigin();
            $params = (new LoginAccountValidate())->post()->goCheck();
            if ((int)($params['scene'] ?? 0) !== 1 || (int)($params['terminal'] ?? 0) !== 4) return $this->fail('请使用商家账号密码登录');
            $owner = Db::name(MerchantAccountTables::name((int)$this->request->tenantId,'user'))->where('tenant_id', (int)$this->request->tenantId)->where('account|mobile', $params['account'])->whereNull('delete_time')->find();
            $merchant = $owner ? Db::name('oem_merchant')->where('tenant_id', (int)$this->request->tenantId)->where('user_id', $owner['id'])->where('status', 1)->find() : null;
            if (!$merchant || (int)$owner['is_disable'] !== 0) return $this->fail('商家账号未开通或已停用，请联系服务商');
            $result = LoginLogic::login($params);
            if (!$result) return $this->fail(LoginLogic::getError());
            $cookie = ['expire' => 28800, 'path' => '/', 'secure' => $this->request->isSsl(), 'httponly' => false, 'samesite' => 'Lax'];
            // The original Nuxt client also uses this cookie and the token key.
            return $this->data(['token' => $result['token'], 'tenant_id' => (int)$this->request->tenantId, 'redirect' => '/ai'])->cookie('token', $result['token'], $cookie);
        } catch (\Throwable $e) { return $this->fail($e instanceof \think\exception\ValidateException ? $e->getMessage() : '登录失败，请检查账号后重试'); }
    }

    public function session()
    {
        $identity = MerchantAccessService::identity((string)$this->userInfo['token'], (int)$this->request->tenantId);
        if (!$identity) return $this->fail('登录已过期', [], -1, 0);
        $owner = $identity['owner'];
        return $this->data([
            'merchant' => $identity['merchant'],
            'user' => ['id' => (int)$owner['id'], 'account' => $owner['account'], 'nickname' => $identity['merchant']['name'], 'balance' => $owner['user_money']],
            'tenant_id' => (int)$this->request->tenantId,
            'apps' => AppFrontendManifestService::tenantEntries((int)$this->request->tenantId, 'pc', (int)$owner['id']),
        ]);
    }

    public function check()
    {
        return $this->data(['authenticated'=>true]);
    }

    public function logout()
    {
        try { $this->sameOrigin(); } catch (\Throwable $e) { return $this->fail('请求来源不匹配'); }
        UserTokenService::expireToken((string)$this->userInfo['token']);
        return $this->success('已退出登录')->cookie('token', '', ['expire' => -3600, 'path' => '/', 'samesite' => 'Lax']);
    }
}
