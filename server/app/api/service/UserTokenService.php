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


namespace app\api\service;

use app\common\cache\UserTokenCache;
use app\common\model\user\UserSession;
use think\facade\Config;
use app\common\service\auth\LoginSessionService;

class UserTokenService
{

    /**
     * @notes 设置或更新用户token
     * @param $userId
     * @param $terminal
     * @return array|false|mixed
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     * @author 段誉
     * @date 2022/9/16 10:10
     */
    public static function setToken($user, $terminal)
    {
        $time = time();
        // Each successful login owns a separate token; another device must not
        // replace or refresh this device's session.
        $userSession = UserSession::create([
            'user_id' => $user->id,
            'tenant_id' => $user->tenant_id,
            'terminal' => $terminal,
            'token' => bin2hex(random_bytes(16)),
            'expire_time' => $time + Config::get('project.user_token.expire_duration'),
            'update_time' => $time,
        ], [], false, LoginSessionService::tenantSuffix((int)$user->tenant_id));

        return (new UserTokenCache())->setUserInfo($userSession->token);
    }


    /**
     * @notes 延长token过期时间
     * @param $token
     * @return array|false|mixed
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     * @author 段誉
     * @date 2022/9/16 10:10
     */
    public static function overtimeToken($token)
    {
        $time = time();
        $userSession = UserSession::where([])->where('token', '=', $token)->where('expire_time', '>', $time)->find();
        if (empty($userSession) || $userSession->isEmpty()) {
            return false;
        }
        //延长token过期时间
        $userSession->expire_time = $time + Config::get('project.user_token.expire_duration');
        $userSession->update_time = $time;
        UserSession::where(['id' => $userSession->id, 'tenant_id' => $userSession->tenant_id])->where('expire_time', '>', $time)->update([
            'expire_time' => $userSession->expire_time, 'update_time' => $time,
        ]);

        return (new UserTokenCache())->setUserInfo($userSession->token);
    }


    /**
     * @notes 设置token为过期
     * @param $token
     * @return bool
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     * @author 段誉
     * @date 2022/9/16 10:10
     */
    public static function expireToken($token)
    {
        $userSession = UserSession::where([])->where('token', '=', $token)
            ->find();
        if (empty($userSession)) {
            return false;
        }

        $time = time();
        $userSession->expire_time = $time;
        $userSession->update_time = $time;
        UserSession::where(['id' => $userSession->id, 'tenant_id' => $userSession->tenant_id])->update([
            'expire_time' => $userSession->expire_time, 'update_time' => $time,
        ]);

        return (new  UserTokenCache())->deleteUserInfo($token);
    }

}
