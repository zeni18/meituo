<?php
// +----------------------------------------------------------------------
// | likeadmin快速开发前后端分离管理后台（PHP版）
// +----------------------------------------------------------------------
// | 欢迎阅读学习系统程序代码，建议反馈是我们前进的动力
// | 开源版本可自由商用，可去除界面版权logo
// | gitee下载：https://gitee.com/likeshop_gitee/likeadmin
// | github下载：https://github.com/likeshop-github/likeadmin
// | 访问官网：https://www.likeadmin.cn
// | likeadmin团队 版权所有 拥有最终解释权
// +----------------------------------------------------------------------
// | author: likeadminTeam
// +----------------------------------------------------------------------

namespace app\tenantapi\controller;

use app\tenantapi\logic\LoginLogic;
use app\tenantapi\validate\LoginValidate;

/**
 * 管理员登录控制器
 * Class LoginController
 * @package app\tenantapi\controller
 */
class LoginController extends BaseAdminController
{
    public array $notNeedLogin = ['account', 'sso'];

    /**
     * @notes 账号登录
     * @date 2021/6/30 17:01
     * @return \think\response\Json
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     * @author 令狐冲
     */
    public function account()
    {
        $account=trim((string)$this->request->post('account',''));
        $tenantId=(int)$this->request->tenantId;
        $native=\think\facade\Db::name('tenant_admin')->where('tenant_id',$tenantId)->where('account',$account)->whereNull('delete_time')->find();
        $agentAccount=\think\facade\Db::name('oem_agent_account')->where('tenant_id',$tenantId)->where('account',$account)->find();
        if (!$native && $agentAccount) {
            try {
                \app\common\service\merchant\AgentAdminService::assertWrite($this->request);
                $result=\app\common\service\merchant\AgentAccessService::login($tenantId,$account,(string)$this->request->post('password',''),$this->request->ip());
                return $this->data(['name'=>$result['agent']['name'],'avatar'=>\app\common\service\merchant\AgentAdminService::avatar(),'role_name'=>\app\common\service\merchant\AgentAdminService::role($result['agent']),'account_type'=>'agent','token'=>'agent_'.$result['token']])->cookie(\app\common\service\merchant\AgentAccessService::COOKIE,'',['expire'=>-3600,'path'=>'/','httponly'=>true,'samesite'=>'Lax']);
            } catch (\InvalidArgumentException $e) { return $this->fail($e->getMessage()); }
            catch (\Throwable $e) { error_log('Unified login failed: '.$e->getMessage());return $this->fail('登录失败，请稍后重试'); }
        }
        $params = (new LoginValidate())->post()->goCheck();
        return $this->data((new LoginLogic())->login($params));
    }

    public function sso()
    {
        $params = $this->request->post();
        try {
            return $this->data((new LoginLogic())->sso($params));
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage());
        }
    }

    /**
     * @notes 退出登录
     * @return \think\response\Json
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     * @author 令狐冲
     * @date 2021/7/8 00:36
     */
    public function logout()
    {
        //退出登录情况特殊，只有成功的情况，也不需要token验证
        (new LoginLogic())->logout($this->adminInfo);
        return $this->success();
    }
}
